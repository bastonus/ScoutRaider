/**
 * IGNClient.ts — Client for geocoding and routing using free, keyless APIs.
 * Ported from legacy/utils/ign_client.py
 *
 * Priority chain:
 *  1. BRouter Web (brouter.de) — Best for hiking/pedestrian
 *  2. OSRM Demo Server — Good general-purpose
 *  3. Valhalla (for small roads)
 */
import type { DangerLevel, LegRoute } from './types';

// ─── Simple TTL LRU Cache ────────────────────────────────────────────────────

class TTLCache<T> {
    private store = new Map<string, { ts: number; val: T }>();
    private maxSize: number;
    private ttlMs: number;

    constructor(maxSize: number = 200, ttlSeconds: number = 300) {
        this.maxSize = maxSize;
        this.ttlMs = ttlSeconds * 1000;
    }

    private getKey(...args: any[]): string {
        return JSON.stringify(args);
    }

    get(...args: any[]): T | null {
        const k = this.getKey(...args);
        const item = this.store.get(k);
        if (!item) return null;

        if (Date.now() - item.ts > this.ttlMs) {
            this.store.delete(k);
            return null;
        }

        // Move to end (MRU)
        this.store.delete(k);
        this.store.set(k, item);
        return item.val;
    }

    put(val: T, ...args: any[]): void {
        const k = this.getKey(...args);
        this.store.delete(k);
        this.store.set(k, { ts: Date.now(), val });

        if (this.store.size > this.maxSize) {
            const firstKey = this.store.keys().next().value;
            if(firstKey !== undefined) this.store.delete(firstKey);
        }
    }

    clear(): void {
        this.store.clear();
    }
}

// ─── IGN Client ──────────────────────────────────────────────────────────────

export class IGNClient {
    private static routeCache = new TTLCache<LegRoute[]>(200, 300);
    private static geocodeCache = new TTLCache<any[]>(100, 600);
    private static BASE_GEOCODING = "https://api-adresse.data.gouv.fr/search/";

    // ── GEOCODING ────────────────────────────────────────────────────────────

    static async searchAddress(query: string, limit: number = 5): Promise<{ results: any[]; error: string | null }> {
        if (!query) return { results: [], error: "query_too_short" };

        const cleaned = query.replace(/[^\w\s,.'-àâäéèêëïîôùûüÿçœæ]/g, '').trim();
        if (cleaned.length < 3) return { results: [], error: "query_too_short" };

        const cached = this.geocodeCache.get("geocode", cleaned, limit);
        if (cached) return { results: cached, error: null };

        const params = new URLSearchParams({ q: cleaned, limit: limit.toString() });

        let lastError = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);

                const response = await fetch(`${this.BASE_GEOCODING}?${params.toString()}`, {
                    signal: controller.signal,
                    headers: { "Accept": "application/json" }
                });
                clearTimeout(timeoutId);

                if (response.status === 400) {
                    return { results: [], error: "bad_request" };
                }
                if (response.status === 504) {
                    lastError = "timeout";
                    if (attempt === 0) {
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                    return { results: [], error: "timeout" };
                }

                if (!response.ok) throw new Error("HTTP " + response.status);

                const data = await response.json();
                const results = [];

                for (const feature of (data.features || [])) {
                    const props = feature.properties || {};
                    const coords = feature.geometry?.coordinates || [0, 0];
                    results.push({
                        label: props.label || "Inconnu",
                        city: props.city || props.municipality || "",
                        postcode: props.postcode || "",
                        lat: coords[1],
                        lon: coords[0]
                    });
                }

                this.geocodeCache.put(results, "geocode", cleaned, limit);
                return { results, error: null };

            } catch (e: any) {
                if (e.name === 'AbortError') {
                    lastError = "timeout";
                    if (attempt === 0) {
                        await new Promise(r => setTimeout(r, 800));
                        continue;
                    }
                } else {
                    lastError = "network_error";
                    if (attempt === 0) {
                        await new Promise(r => setTimeout(r, 500));
                        continue;
                    }
                }
            }
        }
        return { results: [], error: lastError || "network_error" };
    }

    // ── ROUTING ──────────────────────────────────────────────────────────────

    static async computeRoute(startCoords: [number, number], endCoords: [number, number], profile = "pedestrian"): Promise<any | null> {
        const alts = await this.computeRouteAlternatives(startCoords, endCoords, profile, 1, false);
        return alts.length > 0 ? alts[0].geometry : null;
    }

    static async computeRouteAlternatives(
        startCoords: [number, number],
        endCoords: [number, number],
        profile: string = "pedestrian",
        maxAlts: number = 3,
        smallRoadsOnly: boolean = false
    ): Promise<LegRoute[]> {
        const [startLat, startLon] = startCoords;
        const [endLat, endLon] = endCoords;

        // Cache check
        const cacheKey = [
            Number(startLat.toFixed(6)), Number(startLon.toFixed(6)),
            Number(endLat.toFixed(6)), Number(endLon.toFixed(6)),
            profile, maxAlts, smallRoadsOnly
        ];

        const cached = this.routeCache.get(...cacheKey);
        if (cached) return cached;

        const results: LegRoute[] = [];

        if (smallRoadsOnly) {
            // brouter hiking
            try {
                const brResults = await this._brouterRoute(startLon, startLat, endLon, endLat, "hiking", maxAlts);
                for (const r of brResults) {
                    r.name += " (BRouter Strict)";
                    results.push(r);
                }
            } catch (e) { console.debug("BRouter hiking failed:", e); }

            if (results.length === 0) {
                // brouter trekking
                try {
                    const brResults = await this._brouterRoute(startLon, startLat, endLon, endLat, "trekking", maxAlts);
                    for (const r of brResults) {
                        r.name += " (BRouter Trekking)";
                        if(r.geometry.properties) r.geometry.properties.is_fallback = true;
                        results.push(r);
                    }
                } catch (e) {}
            }

            if (results.length === 0) {
                // osrm foot
                try {
                    const osrmResults = await this._osrmRoute(startLon, startLat, endLon, endLat, "foot", maxAlts);
                    for (const r of osrmResults) {
                        r.name += " (OSRM Secours)";
                        if(r.geometry.properties) {
                            r.geometry.properties.is_fallback = true;
                            r.geometry.properties.danger_level = "high";
                        }
                        results.push(r);
                    }
                } catch (e) {}
            }
        } else {
            // Normal mode
            try {
                const profilesToTry = profile === "pedestrian" ? ["trekking"] : ["car-fast"];
                for (const pName of profilesToTry) {
                    if (results.length >= maxAlts) break;
                    const brResults = await this._brouterRoute(startLon, startLat, endLon, endLat, pName, maxAlts - results.length);
                    results.push(...brResults);
                }
            } catch (e) {}

            if (results.length === 0) {
                try {
                    const osrmProfile = profile === "pedestrian" ? "foot" : "car";
                    const osrmResults = await this._osrmRoute(startLon, startLat, endLon, endLat, osrmProfile, maxAlts);
                    results.push(...osrmResults);
                } catch (e) {}
            }
        }

        if (results.length > 0) {
            this.routeCache.put(results, ...cacheKey);
        }

        return results;
    }

    private static async _brouterRoute(slon: number, slat: number, elon: number, elat: number, profileName: string, maxAlts: number): Promise<LegRoute[]> {
        const brouterUrl = "https://brouter.de/brouter";
        const results: LegRoute[] = [];

        for (let i = 0; i < maxAlts; i++) {
            const params = new URLSearchParams({
                lonlats: `${slon},${slat}|${elon},${elat}`,
                profile: profileName,
                alternativeidx: i.toString(),
                format: "geojson"
            });

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000);
                const resp = await fetch(`${brouterUrl}?${params.toString()}`, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (resp.ok) {
                    const data = await resp.json();
                    if (data.features && data.features.length > 0) {
                        const geom = data.features[0].geometry;
                        if (geom && !results.find(r => JSON.stringify(r.geometry.coordinates) === JSON.stringify(geom.coordinates))) {
                            // Parse Danger tags
                            let dangerLevel: DangerLevel | undefined;
                            try {
                                const msgs = data.features[0].properties?.messages || [];
                                if (msgs.length > 1) {
                                    const headers = msgs[0];
                                    const wayTagIdx = headers.indexOf("WayTags");
                                    const distIdx = headers.indexOf("Distance");
                                    
                                    let extremeDist = 0, highDist = 0, minorDist = 0;
                                    let prevD = 0;
                                    let hasMotorwayCross = false;

                                    for (let m = 1; m < msgs.length; m++) {
                                        const msgLine = msgs[m];
                                        if (msgLine.length > wayTagIdx && msgLine.length > distIdx) {
                                            const t = msgLine[wayTagIdx] || "";
                                            const d = parseFloat(msgLine[distIdx]) || prevD;
                                            const delta = d - prevD;
                                            prevD = d;

                                            if (t.includes("highway=motorway")) {
                                                hasMotorwayCross = true;
                                                extremeDist += delta;
                                            } else if (t.includes("highway=trunk") || t.includes("highway=primary")) {
                                                highDist += delta;
                                            } else if (t.includes("highway=secondary") || t.includes("highway=tertiary")) {
                                                minorDist += delta;
                                            }
                                        }
                                    }

                                    if (extremeDist > 200) dangerLevel = "extreme";
                                    else if (highDist > 200) dangerLevel = "high";
                                    else if (minorDist > 300) dangerLevel = "minor";
                                    else if (hasMotorwayCross) dangerLevel = "motorway_cross";
                                }
                            } catch (e) {}

                            // Setup properly wrapped object
                            if (!geom.properties) geom.properties = {};
                            geom.properties.danger_level = dangerLevel;
                            geom.properties.is_fallback = false;

                            results.push({
                                name: `Alt ${results.length + 1}`,
                                leg_key: Math.random().toString(), // Will be overwritten by caller
                                geometry: geom
                            });
                        }
                    }
                }
            } catch (e) {
                break;
            }
            if (results.length >= maxAlts) break;
        }

        return results;
    }

    private static async _osrmRoute(slon: number, slat: number, elon: number, elat: number, osrmProfile: string, maxAlts: number): Promise<LegRoute[]> {
        const osrmUrl = `https://router.project-osrm.org/route/v1/${osrmProfile}/${slon},${slat};${elon},${elat}`;
        const params = new URLSearchParams({
            overview: "full",
            geometries: "geojson",
            alternatives: "true"
        });

        const results: LegRoute[] = [];
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(`${osrmUrl}?${params.toString()}`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (resp.ok) {
                const data = await resp.json();
                for (let i = 0; i < (data.routes || []).length; i++) {
                    const r = data.routes[i];
                    const geom = r.geometry;
                    if (geom && !results.find(res => JSON.stringify(res.geometry.coordinates) === JSON.stringify(geom.coordinates))) {
                        if (!geom.properties) geom.properties = {};
                        geom.properties.is_fallback = false;
                        results.push({
                            name: `Alt ${i + 1} (OSRM)`,
                            leg_key: Math.random().toString(),
                            geometry: geom
                        });
                    }
                    if (results.length >= maxAlts) break;
                }
            }
        } catch (e) {}
        
        return results;
    }

    static clearCache(): void {
        this.routeCache.clear();
        this.geocodeCache.clear();
    }
}

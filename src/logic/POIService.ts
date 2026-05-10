/**
 * POIService.ts — Fetches points of interest from OSM Overpass API.
 * Per-segment strategy: fetches a small bounding box around each segment
 * midpoint instead of one large global BBOX, giving much more relevant results.
 *
 * Returns a map: segmentIndex → POIResult[] (all candidates, not just nearest).
 * The TOGGLE_POI action in AppContext then lets the user enable/disable them.
 */

import type { PolySegment } from './types';
import type { POIResult } from './types';
import { Logger } from './Logger';

export interface RawOSMPOI {
    id: number;
    lat: number;
    lon: number;
    tags: Record<string, string>;
}

// ─── Theme-aware POI label mapping (mirrors legacy pdf_helpers.py) ─────────────

const pickSynonym = (id: number, options: string[]) => options[id % options.length];

const POI_TYPE_LABELS: Array<{
    type: string;
    test: (tags: Record<string, string>) => boolean;
    label: (tags: Record<string, string>, id: number) => string;
}> = [
    // Bars, cafes, pubs
    { type: 'bar', test: t => ['pub', 'bar', 'cafe'].includes(t.amenity), label: (t, id) => pickSynonym(id, ['un bar', 'un café', 'une taverne', 'un bistrot', 'un estaminet', 'un troquet', 'un pub']) },
    // Churches, worship
    { type: 'church', test: t => ['church', 'place_of_worship'].includes(t.amenity), label: (t, id) => pickSynonym(id, ['une église', 'une chapelle', 'un lieu de culte', 'une paroisse', 'un temple']) },
    // Police
    { type: 'police', test: t => t.amenity === 'police', label: (t, id) => pickSynonym(id, ['un poste de police', 'la gendarmerie', 'le commissariat']) },
    { type: 'bank', test: t => t.amenity === 'bank', label: () => 'une banque' },
    { type: 'hospital', test: t => t.amenity === 'hospital', label: () => "un hôpital" },
    { type: 'bakery', test: t => t.shop === 'bakery', label: () => 'une boulangerie' },
    { type: 'alcohol', test: t => t.shop === 'alcohol', label: () => 'un caviste' },
    { type: 'castle', test: t => ['monument', 'castle', 'ruins'].includes(t.historic), label: (t, id) => t.name ? `un monument` : pickSynonym(id, ["un monument", "des ruines", "un édifice historique", "un vieux bâtiment"]) },
    // Generic natural / hiking landmarks
    { type: 'water', test: t => t.amenity === 'fountain' || t.amenity === 'drinking_water', label: (t, id) => pickSynonym(id, ["un point d'eau", "une fontaine"]) },
    { type: 'cross', test: t => t.historic === 'wayside_cross', label: () => 'un calvaire' },
    { type: 'shrine', test: t => t.historic === 'wayside_shrine', label: () => 'un oratoire' },
    { type: 'memorial', test: t => t.historic === 'memorial', label: (t, id) => pickSynonym(id, ['un mémorial', 'un monument aux morts', 'une stèle commemorative', 'un lieu de mémoire']) },
    { type: 'peak', test: t => t.natural === 'peak', label: () => 'un sommet' },
    { type: 'waterfall', test: t => t.waterway === 'waterfall', label: () => 'une cascade' },
    { type: 'water_tower', test: t => t.man_made === 'water_tower', label: () => "un château d'eau" },
    { type: 'shelter', test: t => t.amenity === 'shelter', label: () => 'un abri' },
    { type: 'hunting_stand', test: t => t.amenity === 'hunting_stand', label: () => 'une palombière' },
    // Fallback: named node
    { type: 'landmark', test: t => !!t.name, label: (t) => t.name as string },
];

function getPOIData(tags: Record<string, string>, id: number): { label: string; type: string } | null {
    for (const entry of POI_TYPE_LABELS) {
        if (entry.test(tags)) {
            const label = entry.label(tags, id);
            // Append name if we have one and it's not already the label
            const name = tags.name;
            let finalLabel = label;
            if (name && label !== name && !label.includes(name)) {
                finalLabel = `${label} ${name}`;
            }
            return { label: finalLabel, type: entry.type };
        }
    }
    return null;
}

// ─── Distance helper ───────────────────────────────────────────────────────────

function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const dlat = (lat2 - lat1) * 111000;
    const dlon = (lon2 - lon1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
    return Math.sqrt(dlat * dlat + dlon * dlon);
}

// ─── Bounding box helper (tight around a midpoint) ────────────────────────────

function bboxAroundPoint(
    lat: number,
    lon: number,
    radiusM: number
): [number, number, number, number] {
    const latDeg = radiusM / 111000;
    const lonDeg = radiusM / (111000 * Math.cos((lat * Math.PI) / 180));
    return [lat - latDeg, lon - lonDeg, lat + latDeg, lon + lonDeg];
}

// ─── Global cache (avoid re-fetching identical bboxes) ────────────────────────

const _bboxCache = new Map<string, RawOSMPOI[]>();

async function fetchOverpassPOIs(
    south: number, west: number, north: number, east: number
): Promise<RawOSMPOI[]> {
    const key = `${south.toFixed(4)},${west.toFixed(4)},${north.toFixed(4)},${east.toFixed(4)}`;
    if (_bboxCache.has(key)) return _bboxCache.get(key)!;

    const query = `
        [out:json][timeout:20];
        (
          nwr["amenity"~"church|place_of_worship|pub|bar|cafe|bank|police|hospital|fountain|drinking_water|shelter|hunting_stand"](${south},${west},${north},${east});
          nwr["shop"~"bakery|supermarket|butcher|alcohol"](${south},${west},${north},${east});
          nwr["historic"~"monument|castle|ruins|memorial|wayside_cross|wayside_shrine"](${south},${west},${north},${east});
          nwr["natural"~"peak|cave_entrance|spring"](${south},${west},${north},${east});
          nwr["man_made"~"water_tower|tower"](${south},${west},${north},${east});
          nwr["waterway"="waterfall"](${south},${west},${north},${east});
        );
        out center;
    `;

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ data: query }).toString(),
        });
        if (!response.ok) return [];
        const data = await response.json();
        const results: RawOSMPOI[] = (data.elements || []).map((e: any) => ({
            id: e.id,
            lat: e.lat ?? e.center?.lat,
            lon: e.lon ?? e.center?.lon,
            tags: e.tags || {}
        })).filter((e: any) => e.lat && e.lon);
        _bboxCache.set(key, results);
        return results;
    } catch {
        return [];
    }
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export class POIService {
    /**
     * Fetch POIs for all segments using a SINGLE global bounding box request
     * to avoid 504 Gateway Timeouts from Overpass.
     */
    static _segmentCache = new Map<string, POIResult[]>();

    static async fetchPOIsPerSegment(
        segments: PolySegment[],
        oldSegments?: PolySegment[],
        oldPois?: Record<string, POIResult[]>,
        radiusM = 20
    ): Promise<Record<number, POIResult[]>> {
        if (segments.length === 0) return {};

        const result: Record<number, POIResult[]> = {};
        const missingSegments: { idx: number; lat: number; lon: number }[] = [];

        // 1. Calculate start points for all new segments
        const newMids: Array<{ idx: number; lat: number; lon: number } | null> = segments.map((seg, idx) => {
            if (!seg.coords || seg.coords.length === 0) return null;
            // Use the start of the segment (intersection / azimuth change)
            const [lon, lat] = seg.coords[0];
            return { idx, lat, lon };
        });

        // 2. Identify unchanged segments by distance to old segments (< 5 meters)
        let oldMids: Array<{ idx: number; lat: number; lon: number } | null> = [];
        if (oldSegments && oldPois) {
            oldMids = oldSegments.map((seg, idx) => {
                if (!seg.coords || seg.coords.length === 0) return null;
                const [lon, lat] = seg.coords[0];
                return { idx, lat, lon };
            });
        }

        for (const newMid of newMids) {
            if (!newMid) continue;
            let foundOldPois: POIResult[] | null = null;
            
            const cacheKey = `${newMid.lat.toFixed(5)},${newMid.lon.toFixed(5)}`;
            if (POIService._segmentCache.has(cacheKey)) {
                foundOldPois = POIService._segmentCache.get(cacheKey)!.map(p => {
                    const parts = p.id.split('-');
                    if (parts.length === 4) return { ...p, id: `poi-${newMid.idx}-${parts[2]}-${parts[3]}` };
                    return p;
                });
            } else if (oldSegments && oldPois) {
                // Find if an old segment's midpoint is identical (< 5m difference)
                for (const oldMid of oldMids) {
                    if (!oldMid) continue;
                    const d = distanceM(newMid.lat, newMid.lon, oldMid.lat, oldMid.lon);
                    if (d < 5) {
                        // Reuse its POIs! We MUST update the segment ID in the poi ID string so it works with toggles
                        const cached = oldPois[oldMid.idx];
                        if (cached) {
                            foundOldPois = cached.map(p => {
                                const parts = p.id.split('-'); // poi-oldIdx-rawId-i
                                if (parts.length === 4) {
                                    return { ...p, id: `poi-${newMid.idx}-${parts[2]}-${parts[3]}` };
                                }
                                return p;
                            });
                        }
                        break;
                    }
                }
            }

            if (foundOldPois) {
                result[newMid.idx] = foundOldPois;
            } else {
                missingSegments.push(newMid);
            }
        }

        if (missingSegments.length === 0) {
            return result;
        }

        // 3. For missing segments, fetch using a SINGLE global BBOX to avoid 429 timeouts
        // Overpass easily handles a large bounding box but struggles with dozens of 'around' sub-queries.
        const lats = missingSegments.map(m => m.lat);
        const lons = missingSegments.map(m => m.lon);
        
        // Add a ~500m padding to the bounding box
        const padLat = 0.005;
        const padLon = 0.005 / Math.cos((lats[0] || 0) * Math.PI / 180);
        
        const south = Math.min(...lats) - padLat;
        const north = Math.max(...lats) + padLat;
        const west = Math.min(...lons) - padLon;
        const east = Math.max(...lons) + padLon;

        const startTime = performance.now();
        Logger.info(`[POIService] Fetching POIs for ${missingSegments.length} missing segments (BBOX: ${south.toFixed(4)},${west.toFixed(4)} to ${north.toFixed(4)},${east.toFixed(4)})...`);

        const query = `
            [out:json][timeout:25];
            (
              nwr["amenity"~"church|place_of_worship|pub|bar|cafe|bank|police|hospital|fountain|drinking_water|shelter|hunting_stand"](${south},${west},${north},${east});
              nwr["shop"~"bakery|supermarket|butcher|alcohol"](${south},${west},${north},${east});
              nwr["historic"~"monument|castle|ruins|memorial|wayside_cross|wayside_shrine"](${south},${west},${north},${east});
              nwr["natural"~"peak|cave_entrance|spring"](${south},${west},${north},${east});
              nwr["man_made"~"water_tower|tower"](${south},${west},${north},${east});
              nwr["waterway"="waterfall"](${south},${west},${north},${east});
              way["highway"~"primary|secondary|tertiary|unclassified|residential|service|path|track|footway"]["name"](${south},${west},${north},${east});
            );
            out center;
        `;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({ data: query }).toString(),
            });
            
            if (response.ok) {
                const data = await response.json();
                const rawPOIs: RawOSMPOI[] = (data.elements || []).map((e: any) => ({
                    id: e.id,
                    lat: e.lat ?? e.center?.lat,
                    lon: e.lon ?? e.center?.lon,
                    tags: e.tags || {}
                })).filter((e: any) => e.lat && e.lon);
                
                const fetchTimeMs = (performance.now() - startTime).toFixed(0);
                Logger.info(`[POIService] Overpass returned ${rawPOIs.length} elements in ${fetchTimeMs}ms.`);

                // Assign these rawPOIs exclusively to the nearest segment
                const globalCandidates: Array<{ label: string; type: string; lat: number; lon: number; rawId: number }> = [];
                const usedLabels = new Set<string>();

                for (const p of rawPOIs) {
                    const data = getPOIData(p.tags, p.id);
                    let label = data?.label;
                    let type = data?.type || 'landmark';
                    
                    if (!label && p.tags.highway && p.tags.name) {
                        label = p.tags.name; // Fallback for named roads
                    }
                    if (!label || usedLabels.has(label)) continue;
                    usedLabels.add(label);
                    globalCandidates.push({ label, type, lat: p.lat, lon: p.lon, rawId: p.id });
                }

                Logger.info(`[POIService] Parsed ${globalCandidates.length} unique labels. Assigning to ${missingSegments.length} segments...`);

                const segPoiMap: Record<number, Array<{ label: string; type: string; dist: number; rawId: number; lat: number; lon: number }>> = {};

                for (const c of globalCandidates) {
                    let bestSegIdx = -1;
                    let bestDist = Infinity;

                    for (const mid of missingSegments) {
                        const d = distanceM(mid.lat, mid.lon, c.lat, c.lon);
                        if (d < bestDist) {
                            bestDist = d;
                            bestSegIdx = mid.idx;
                        }
                    }

                    if (bestSegIdx === -1 || bestDist > radiusM) continue;
                    if (!segPoiMap[bestSegIdx]) segPoiMap[bestSegIdx] = [];
                    segPoiMap[bestSegIdx].push({ label: c.label, type: c.type, dist: bestDist, rawId: c.rawId, lat: c.lat, lon: c.lon });
                }

                let totalAssigned = 0;
                for (const mid of missingSegments) {
                    const pois = segPoiMap[mid.idx] || [];
                    pois.sort((a, b) => a.dist - b.dist);
                    const mapped = pois.slice(0, 5).map((c, idx) => ({
                        id: `poi-${mid.idx}-${c.rawId}-${idx}`,
                        name: c.label,
                        type: c.type,
                        selected: idx === 0,
                        lat: c.lat,
                        lon: c.lon
                    }));
                    result[mid.idx] = mapped;
                    if (mapped.length > 0) {
                        totalAssigned += mapped.length;
                        POIService._segmentCache.set(`${mid.lat.toFixed(5)},${mid.lon.toFixed(5)}`, mapped);
                    }
                }
                const totalTimeMs = (performance.now() - startTime).toFixed(0);
                Logger.info(`[POIService] Assigned ${totalAssigned} POIs across segments in ${totalTimeMs}ms total.`);
            } else {
                Logger.error(`[POIService] Overpass error: status ${response.status} (${response.statusText})`);
                for (const mid of missingSegments) result[mid.idx] = [];
            }
        } catch (e) {
            console.error("Overpass fetch failed:", e);
            for (const mid of missingSegments) result[mid.idx] = [];
        }

        return result;
    }

    /** Clear the in-memory cache (call on new project / route change) */
    static clearCache() {
        _bboxCache.clear();
    }
}

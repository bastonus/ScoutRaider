/**
 * ElevationService.ts — Elevation profiles and topographical metrics using IGN Géoplateforme.
 * Keyless, fast, smoothed elevation data for ScoutRaider raids.
 */

export interface ElevationPoint {
    distance_m: number;
    altitude_m: number;
    slope_pct?: number;
    lat: number;
    lon: number;
    stageLabel?: string;
}

export interface ElevationProfileResult {
    points: ElevationPoint[];
    ascend_m: number;
    descend_m: number;
    min_alt_m: number;
    max_alt_m: number;
    total_dist_m: number;
    estimated_duration_min: number; // Based on Naismith/Tobler with 12kg pack
}

class TTLElevationCache {
    private cache = new Map<string, { data: ElevationProfileResult; timestamp: number }>();
    private ttlMs = 1000 * 60 * 30; // 30 minutes

    get(key: string): ElevationProfileResult | null {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.timestamp > this.ttlMs) {
            this.cache.delete(key);
            return null;
        }
        return item.data;
    }

    set(key: string, data: ElevationProfileResult): void {
        this.cache.set(key, { data, timestamp: Date.now() });
    }

    clear(): void {
        this.cache.clear();
    }
}

const elevationCache = new TTLElevationCache();

export class ElevationService {
    private static GP_BASE = 'https://data.geopf.fr';

    /**
     * Compute elevation profile for a route coordinate list.
     * @param coordinates Array of [lon, lat] (standard GeoJSON) or [lat, lon]
     * @param format 'lonlat' (GeoJSON) or 'latlon' (Leaflet)
     * @param stageLabels Optional mapping or list of stages to project onto the profile
     */
    static async computeProfile(
        coordinates: [number, number][],
        format: 'lonlat' | 'latlon' = 'lonlat',
        stages?: { label: string; coords: [number, number] }[]
    ): Promise<ElevationProfileResult | null> {
        if (!coordinates || coordinates.length < 2) return null;

        // Normalize coordinates to [lon, lat]
        const ptsLonLat: [number, number][] = coordinates.map(c => 
            format === 'latlon' ? [c[1], c[0]] : [c[0], c[1]]
        );

        // Cache key based on length and boundary points
        const key = `${ptsLonLat.length}:${ptsLonLat[0].join(',')}:${ptsLonLat[Math.floor(ptsLonLat.length / 2)].join(',')}:${ptsLonLat[ptsLonLat.length - 1].join(',')}`;
        const cached = elevationCache.get(key);
        if (cached) return cached;

        // Resample route so elevation queries are evenly spaced (approx every 40-50m, 30 to 300 pts)
        const totalDist = this.computeTotalDistance(ptsLonLat);
        if (totalDist <= 0) return null;

        const numSamples = Math.max(30, Math.min(300, Math.round(totalDist / 45)));
        const resampled = this.resample(ptsLonLat, numSamples);

        // Fetch elevation in chunks of 150 points (IGN max URL payload)
        const elevations = await this.fetchElevationsFromIGN(resampled);
        if (!elevations || elevations.length === 0) return null;

        // Apply 3-point moving average smoothing and hysteresis analysis
        const analyzed = this.smoothAndAnalyze(resampled, elevations);

        // Match stage labels if provided
        if (stages && stages.length > 0) {
            this.projectStageLabels(analyzed.points, stages);
        }

        elevationCache.set(key, analyzed);
        return analyzed;
    }

    /**
     * Fetch raw elevations from IGN Géoplateforme
     */
    private static async fetchElevationsFromIGN(points: { lon: number; lat: number; dist_m: number }[]): Promise<number[] | null> {
        const chunkSize = 100;
        const chunks: { lon: number; lat: number }[][] = [];

        for (let i = 0; i < points.length; i += chunkSize) {
            chunks.push(points.slice(i, i + chunkSize));
        }

        try {
            const results = await Promise.all(chunks.map(async chunk => {
                const lons = chunk.map(p => p.lon.toFixed(5)).join('|');
                const lats = chunk.map(p => p.lat.toFixed(5)).join('|');
                const url = `${this.GP_BASE}/altimetrie/1.0/calcul/alti/rest/elevation.json?resource=ign_rge_alti_wld&zonly=true&lon=${encodeURIComponent(lons)}&lat=${encodeURIComponent(lats)}`;

                let lastError = null;
                for (let attempt = 0; attempt < 2; attempt++) {
                    try {
                        const controller = new AbortController();
                        const timer = setTimeout(() => controller.abort(), 12000);
                        const resp = await fetch(url, {
                            signal: controller.signal,
                            headers: { 'Accept': 'application/json' }
                        });
                        clearTimeout(timer);

                        if (!resp.ok) throw new Error(`Altimétrie IGN HTTP ${resp.status}`);
                        const data = await resp.json();
                        return (data.elevations || []) as number[];
                    } catch (err) {
                        lastError = err;
                        if (attempt === 0) {
                            await new Promise(r => setTimeout(r, 600));
                        }
                    }
                }
                throw lastError;
            }));

            return results.flat();
        } catch (e) {
            console.warn('[ElevationService] Failed to fetch elevations from IGN:', e);
            return null;
        }
    }

    /**
     * Smooth raw z values using a 3-point moving window and a 2-meter hysteresis filter to eliminate noise
     */
    private static smoothAndAnalyze(
        resampled: { lon: number; lat: number; dist_m: number }[],
        rawZ: number[]
    ): ElevationProfileResult {
        // Fallback for null / negative outlier values
        let lastValid = 0;
        const validZ = rawZ.map((v, i) => {
            if (v == null || v < -400) {
                return lastValid;
            }
            lastValid = v;
            return v;
        });

        // 3-point moving average
        const smoothed = validZ.map((val, idx) => {
            const prev = validZ[Math.max(0, idx - 1)];
            const next = validZ[Math.min(validZ.length - 1, idx + 1)];
            return Math.round(((prev + val + next) / 3.0) * 10) / 10;
        });

        // 2-meter hysteresis filter (eliminates GPS/LIDAR micro-jitters)
        let ascend = 0;
        let descend = 0;
        let ref = smoothed[0] || 0;

        for (let i = 1; i < smoothed.length; i++) {
            const delta = smoothed[i] - ref;
            if (delta >= 2.0) {
                ascend += delta;
                ref = smoothed[i];
            } else if (delta <= -2.0) {
                descend += Math.abs(delta);
                ref = smoothed[i];
            }
        }

        const totalDist = resampled[resampled.length - 1]?.dist_m || 0;

        // Build final points list
        const points: ElevationPoint[] = resampled.map((pt, idx) => {
            const alt = smoothed[idx];
            let slope = 0;
            if (idx > 0) {
                const dDist = pt.dist_m - resampled[idx - 1].dist_m;
                const dAlt = alt - smoothed[idx - 1];
                if (dDist > 0) slope = Math.round((dAlt / dDist) * 100);
            }
            return {
                distance_m: Math.round(pt.dist_m),
                altitude_m: Math.round(alt),
                slope_pct: slope,
                lat: pt.lat,
                lon: pt.lon
            };
        });

        const minAlt = Math.min(...smoothed);
        const maxAlt = Math.max(...smoothed);

        // Tobler / Naismith formula adapted for scouts with heavy packs (12-15 kg)
        // 4.0 km/h baseline on flat + 1h per 300m ascent + 10 min break every 2 hours
        const km = totalDist / 1000.0;
        const walkingHours = (km / 4.0) + (ascend / 300.0);
        const breaksHours = Math.floor(walkingHours / 2.0) * (10.0 / 60.0);
        const totalDurationMin = Math.round((walkingHours + breaksHours) * 60);

        return {
            points,
            ascend_m: Math.round(ascend),
            descend_m: Math.round(descend),
            min_alt_m: Math.round(minAlt),
            max_alt_m: Math.round(maxAlt),
            total_dist_m: Math.round(totalDist),
            estimated_duration_min: totalDurationMin
        };
    }

    /**
     * Resample a polyline into N points regularly spaced along the track
     */
    private static resample(
        pts: [number, number][],
        numSamples: number
    ): { lon: number; lat: number; dist_m: number }[] {
        const cumDist = [0];
        for (let i = 1; i < pts.length; i++) {
            cumDist.push(cumDist[i - 1] + this.haversine(pts[i - 1], pts[i]));
        }

        const total = cumDist[cumDist.length - 1];
        if (total === 0 || pts.length < 2) {
            return pts.map((p, i) => ({ lon: p[0], lat: p[1], dist_m: cumDist[i] || 0 }));
        }

        const out: { lon: number; lat: number; dist_m: number }[] = [];
        let j = 0;

        for (let k = 0; k < numSamples; k++) {
            const targetDist = (total * k) / (numSamples - 1);
            while (j < cumDist.length - 2 && cumDist[j + 1] < targetDist) {
                j++;
            }
            const segLen = cumDist[j + 1] - cumDist[j];
            const t = segLen > 0 ? (targetDist - cumDist[j]) / segLen : 0;
            out.push({
                lon: pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t,
                lat: pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t,
                dist_m: targetDist
            });
        }

        return out;
    }

    private static computeTotalDistance(pts: [number, number][]): number {
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            total += this.haversine(pts[i - 1], pts[i]);
        }
        return total;
    }

    private static haversine(p1: [number, number], p2: [number, number]): number {
        const R = 6371000;
        const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
        const dLon = ((p2[0] - p1[0]) * Math.PI) / 180;
        const lat1 = (p1[1] * Math.PI) / 180;
        const lat2 = (p2[1] * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    private static projectStageLabels(points: ElevationPoint[], stages: { label: string; coords: [number, number] }[]): void {
        stages.forEach(st => {
            // Find closest elevation point
            let bestIdx = 0;
            let minDist = Infinity;
            points.forEach((pt, idx) => {
                const d = this.haversine([pt.lon, pt.lat], [st.coords[1], st.coords[0]]);
                if (d < minDist) {
                    minDist = d;
                    bestIdx = idx;
                }
            });
            if (minDist < 600) { // within 600m
                points[bestIdx].stageLabel = st.label;
            }
        });
    }

    /**
     * Generate a standalone, publication-quality SVG string for PDF/HTML print and carnet export.
     */
    static generateSvg(
        profile: ElevationProfileResult,
        options: {
            width?: number;
            height?: number;
            accentColor?: string;
            textColor?: string;
            isDarkTheme?: boolean;
        } = {}
    ): string {
        const w = options.width || 720;
        const h = options.height || 180;
        const accent = options.accentColor || '#5cbd6e';
        const isDark = options.isDarkTheme ?? false;
        const textCol = options.textColor || (isDark ? '#e2e8f0' : '#1e293b');
        const gridCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

        const padLeft = 45;
        const padRight = 20;
        const padTop = 25;
        const padBottom = 30;

        const plotW = w - padLeft - padRight;
        const plotH = h - padTop - padBottom;

        const pts = profile.points;
        if (pts.length < 2) return '';

        const maxD = profile.total_dist_m;
        const minZ = Math.max(0, profile.min_alt_m - 20);
        const maxZ = profile.max_alt_m + 25;
        const rangeZ = Math.max(10, maxZ - minZ);

        const getX = (d: number) => padLeft + (d / maxD) * plotW;
        const getY = (z: number) => padTop + plotH - ((z - minZ) / rangeZ) * plotH;

        // Path for polygon area
        let areaPath = `M ${getX(pts[0].distance_m)} ${padTop + plotH}`;
        pts.forEach(p => {
            areaPath += ` L ${getX(p.distance_m).toFixed(1)} ${getY(p.altitude_m).toFixed(1)}`;
        });
        areaPath += ` L ${getX(pts[pts.length - 1].distance_m).toFixed(1)} ${padTop + plotH} Z`;

        // Path for line stroke
        let linePath = `M ${getX(pts[0].distance_m).toFixed(1)} ${getY(pts[0].altitude_m).toFixed(1)}`;
        for (let i = 1; i < pts.length; i++) {
            linePath += ` L ${getX(pts[i].distance_m).toFixed(1)} ${getY(pts[i].altitude_m).toFixed(1)}`;
        }

        // Horizontal grid lines
        const zStep = rangeZ > 400 ? 100 : rangeZ > 150 ? 50 : 25;
        const startZ = Math.ceil(minZ / zStep) * zStep;
        let gridLines = '';
        for (let z = startZ; z <= maxZ; z += zStep) {
            const y = getY(z);
            gridLines += `<line x1="${padLeft}" y1="${y.toFixed(1)}" x2="${w - padRight}" y2="${y.toFixed(1)}" stroke="${gridCol}" stroke-dasharray="3,3" />`;
            gridLines += `<text x="${padLeft - 6}" y="${(y + 3).toFixed(1)}" font-size="9" fill="${textCol}" opacity="0.75" text-anchor="end" font-family="sans-serif">${z}m</text>`;
        }

        // Stage markers on profile
        let stageMarks = '';
        pts.forEach(p => {
            if (p.stageLabel) {
                const x = getX(p.distance_m);
                const y = getY(p.altitude_m);
                stageMarks += `
                    <line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x.toFixed(1)}" y2="${padTop + plotH}" stroke="${accent}" stroke-width="1.5" stroke-dasharray="2,2" opacity="0.6"/>
                    <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${accent}" stroke="#ffffff" stroke-width="1.5"/>
                    <circle cx="${x.toFixed(1)}" cy="${padTop - 8}" r="9" fill="${accent}"/>
                    <text x="${x.toFixed(1)}" y="${padTop - 4.5}" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${p.stageLabel}</text>
                `;
            }
        });

        // Distance indicators (km)
        const kmStep = maxD > 25000 ? 5 : maxD > 10000 ? 2 : 1;
        let distLabels = '';
        for (let km = 0; km * 1000 <= maxD; km += kmStep) {
            const x = getX(km * 1000);
            distLabels += `<text x="${x.toFixed(1)}" y="${h - 10}" font-size="9" fill="${textCol}" opacity="0.75" text-anchor="middle" font-family="sans-serif">${km} km</text>`;
        }

        const gradientId = `alti_grad_${Math.random().toString(36).substring(2, 7)}`;

        return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="overflow: visible; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <defs>
                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="${accent}" stop-opacity="0.03"/>
                </linearGradient>
            </defs>
            
            <!-- Grid and axes -->
            ${gridLines}
            <line x1="${padLeft}" y1="${padTop + plotH}" x2="${w - padRight}" y2="${padTop + plotH}" stroke="${gridCol}" stroke-width="1.5" />
            
            <!-- Elevation area and stroke -->
            <path d="${areaPath}" fill="url(#${gradientId})" />
            <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
            
            <!-- Stage markers -->
            ${stageMarks}
            
            <!-- Distance scale labels -->
            ${distLabels}
        </svg>
        `.trim();
    }
}

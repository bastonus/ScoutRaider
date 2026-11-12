/**
 * TrailSafety.ts — Smart assistance for scout route planning:
 * 1. Retrace / Backtrack detector (detects duplicate segments on the same path)
 * 2. Village center / Church snapping (snaps waypoints to historic village hubs)
 */

export interface RetraceResult {
    hasRetrace: boolean;
    totalDuplicatedM: number;
    warningText?: string;
    duplicateRanges: { startIdx: number; endIdx: number }[];
}

export class TrailSafety {
    private static GP_BASE = 'https://data.geopf.fr';

    /**
     * Detects if a route line passes over the exact same trail twice (e.g. accidental U-turn or overlap).
     * Uses a spatial 2D grid hashing algorithm.
     * @param line Coordinates array in [lat, lon] or [lon, lat]
     * @param format 'latlon' or 'lonlat'
     */
    static detectRetrace(line: [number, number][], format: 'latlon' | 'lonlat' = 'latlon'): RetraceResult {
        const out: RetraceResult = {
            hasRetrace: false,
            totalDuplicatedM: 0,
            duplicateRanges: []
        };

        if (!line || line.length < 5) return out;

        const pts: [number, number][] = line.map(p => format === 'lonlat' ? [p[1], p[0]] : [p[0], p[1]]);
        const lat0 = pts[0][0];
        const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
        const ky = 110540;

        // Sample points every 10 meters along the line
        const samples: { x: number; y: number; originalIdx: number }[] = [];
        for (let i = 0; i + 1 < pts.length; i++) {
            const ax = pts[i][1] * kx;
            const ay = pts[i][0] * ky;
            const bx = pts[i + 1][1] * kx;
            const by = pts[i + 1][0] * ky;
            const len = Math.hypot(bx - ax, by - ay);
            const n = Math.max(1, Math.round(len / 10));

            for (let j = 0; j < n; j++) {
                samples.push({
                    x: ax + ((bx - ax) * j) / n,
                    y: ay + ((by - ay) * j) / n,
                    originalIdx: i
                });
            }
        }

        if (samples.length < 15) return out;

        // 20m grid hashing
        const cellSize = 20;
        const grid = new Map<string, number[]>();
        const hits = new Uint8Array(samples.length);

        samples.forEach((s, idx) => {
            const cx = Math.floor(s.x / cellSize);
            const cy = Math.floor(s.y / cellSize);
            let isHit = false;

            for (let dx = -1; dx <= 1 && !isHit; dx++) {
                for (let dy = -1; dy <= 1 && !isHit; dy++) {
                    const key = `${cx + dx},${cy + dy}`;
                    const bucket = grid.get(key);
                    if (!bucket) continue;

                    for (const prevIdx of bucket) {
                        // At least 12 samples (120m) apart in trail sequence to avoid detecting neighboring trail curve
                        if (idx - prevIdx > 12) {
                            const dist = Math.hypot(samples[prevIdx].x - s.x, samples[prevIdx].y - s.y);
                            if (dist <= 15) { // within 15 meters
                                isHit = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (isHit) {
                hits[idx] = 1;
            }

            const currentKey = `${cx},${cy}`;
            const b = grid.get(currentKey) || [];
            b.push(idx);
            grid.set(currentKey, b);
        });

        // Group consecutive hits into duplicate runs
        let inRun = false;
        let runCount = 0;
        let totalDupM = 0;

        for (let k = 0; k < hits.length; k++) {
            if (hits[k]) {
                if (!inRun) {
                    inRun = true;
                    runCount = 1;
                } else {
                    runCount++;
                }
            } else {
                if (inRun) {
                    // Only count runs of at least 6 consecutive hits (~60 meters)
                    if (runCount >= 6) {
                        totalDupM += runCount * 10;
                    }
                    inRun = false;
                }
            }
        }
        if (inRun && runCount >= 6) {
            totalDupM += runCount * 10;
        }

        if (totalDupM >= 80) {
            out.hasRetrace = true;
            out.totalDuplicatedM = totalDupM;
            out.warningText = `Attention : l'itinéraire repasse sur lui-même sur environ ${Math.round(totalDupM)} m.`;
        }

        return out;
    }

    /**
     * Snap a click near a village to the village center or landmark using IGN Reverse POI.
     * @param lat Click latitude
     * @param lon Click longitude
     * @param radiusM Search radius in meters (e.g. 300-800m)
     */
    static async snapToVillageCenter(lat: number, lon: number, radiusM = 600): Promise<{ name: string; lat: number; lon: number; category: string } | null> {
        try {
            const url = `${this.GP_BASE}/geocodage/reverse?index=poi&limit=10&lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}`;

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 8000);
            const resp = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
            clearTimeout(timer);

            if (!resp.ok) return null;
            const data = await resp.json();
            const features = data.features || [];

            // Find best village center (lieu-dit habité, commune or building)
            for (const feat of features) {
                const props = feat.properties || {};
                const cats: string[] = Array.isArray(props.category) ? props.category : [props.category || ''];
                const dist = props.distance ?? 0;

                const isVillage = cats.some(c => c.includes('lieu-dit') || c.includes('commune') || c.includes('habitation') || c.includes('culte'));
                if (isVillage && dist <= radiusM) {
                    const coords = feat.geometry?.coordinates;
                    if (coords && coords.length >= 2) {
                        const name = props.toponym || (Array.isArray(props.name) ? props.name[0] : props.name) || props.city?.[0] || 'Centre';
                        return {
                            name,
                            lat: coords[1],
                            lon: coords[0],
                            category: cats.join(', ')
                        };
                    }
                }
            }
        } catch (e) {
            console.debug('[TrailSafety] snapToVillageCenter failed:', e);
        }
        return null;
    }
}

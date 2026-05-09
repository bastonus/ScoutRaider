/**
 * PolygonalEngine.ts — Polygonalisation logic
 * Translates detailed route trajectories into abstracted straight-line segments.
 */

import { Geodesic } from 'geographiclib-geodesic';
import type { PolySegment } from './types';

export class PolygonalEngine {
    /**
     * Calculates the initial forward azimuth (bearing) from pt1 to pt2.
     * @param pt1 First point [longitude, latitude].
     * @param pt2 Second point [longitude, latitude].
     * @returns Azimuth in degrees from 0 to 360.
     */
    static calculateBearing(pt1: [number, number], pt2: [number, number]): number {
        const res = Geodesic.WGS84.Inverse(pt1[1], pt1[0], pt2[1], pt2[0]);
        let azi = res.azi1 || 0;
        if (azi < 0) azi += 360;
        return azi;
    }

    /**
     * Calculates the geodesic distance between two geographic coordinates.
     * @param pt1 First point [longitude, latitude].
     * @param pt2 Second point [longitude, latitude].
     * @returns Distance in meters.
     */
    static calculateDistance(pt1: [number, number], pt2: [number, number]): number {
        const res = Geodesic.WGS84.Inverse(pt1[1], pt1[0], pt2[1], pt2[0]);
        return res.s12 || 0;
    }

    /**
     * Calculates bearing looking ahead given meters to avoid local curve noise.
     */
    static calculateSmartBearing(points: [number, number][], startIdx: number, lookaheadMeters: number = 20): number {
        if (!points || startIdx >= points.length - 1) return 0;
        const pStart = points[startIdx];
        let acc = 0;
        for (let i = startIdx; i < points.length - 1; i++) {
            const d = this.calculateDistance(points[i], points[i + 1]);
            acc += d;
            if (acc >= lookaheadMeters) {
                return this.calculateBearing(pStart, points[i + 1]);
            }
        }
        return this.calculateBearing(pStart, points[points.length - 1]);
    }

    /**
     * Get intersections from Overpass API
     */
    private static async getIntersectionsFromOverpass(allPoints: [number, number][]): Promise<[number, number][]> {
        if (!allPoints || allPoints.length === 0) return [];
        const lons = allPoints.map(p => p[0]);
        const lats = allPoints.map(p => p[1]);
        const minLon = Math.min(...lons) - 0.002;
        const maxLon = Math.max(...lons) + 0.002;
        const minLat = Math.min(...lats) - 0.002;
        const maxLat = Math.max(...lats) + 0.002;

        const query = `
        [out:json][timeout:30];
        way["highway"](${minLat},${minLon},${maxLat},${maxLon});
        node(w);
        out body;
        `;

        try {
            const resp = await fetch('http://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ data: query })
            });

            if (!resp.ok) return [];

            const data = await resp.json();
            const nodeCounts: Record<number, number> = {};

            for (const element of data.elements || []) {
                if (element.type === 'way') {
                    for (const nodeId of element.nodes || []) {
                        nodeCounts[nodeId] = (nodeCounts[nodeId] || 0) + 1;
                    }
                }
            }

            const intersectionNodeIds = new Set(
                Object.entries(nodeCounts)
                    .filter(([_, count]) => count > 1)
                    .map(([id, _]) => parseInt(id, 10))
            );

            const intersectionCoords: [number, number][] = [];
            for (const element of data.elements || []) {
                if (element.type === 'node' && intersectionNodeIds.has(element.id)) {
                    intersectionCoords.push([element.lon, element.lat]);
                }
            }
            return intersectionCoords;
        } catch (e) {
            console.error("Overpass API failed:", e);
            return [];
        }
    }

    /**
     * Analyzes trajectory geometry and intersection indices.
     */
    static async analyzeTrajectory(data: any, forcerCarrefours: boolean = true): Promise<{ allPoints: [number, number][], carrefourIndices: number[], instrCount: number }> {
        let allPoints: [number, number][] = [];
        const instr = data?.geoportail?.compute?.results?.routeInstructions || [];

        // 1. Geometry Recovery
        if (instr && instr.length > 0) {
            for (const i of instr) {
                if (i.geometry && i.geometry.coordinates) {
                    for (const p of i.geometry.coordinates) {
                        if (allPoints.length === 0 || this.calculateDistance(allPoints[allPoints.length - 1], p) > 0.1) {
                            allPoints.push(p);
                        }
                    }
                }
            }
        } else {
            // Fallback greedy path assembly
            const lineFeats = (data?.features || []).filter((f: any) => f?.geometry?.type === 'LineString');
            const availableNodes: [number, number][][] = lineFeats.map((f: any) => f.geometry.coordinates);

            if (availableNodes.length > 0) {
                allPoints = [...availableNodes.shift()!];
                let changed = true;
                while (changed && availableNodes.length > 0) {
                    changed = false;
                    for (let i = 0; i < availableNodes.length; i++) {
                        const coords = availableNodes[i];
                        const dStart = this.calculateDistance(allPoints[allPoints.length - 1], coords[0]);
                        const dEnd = this.calculateDistance(allPoints[allPoints.length - 1], coords[coords.length - 1]);

                        if (dStart < 50) {
                            allPoints.push(...coords.slice(1));
                            availableNodes.splice(i, 1);
                            changed = true;
                            break;
                        } else if (dEnd < 50) {
                            allPoints.push(...[...coords].slice(0, -1).reverse());
                            availableNodes.splice(i, 1);
                            changed = true;
                            break;
                        }

                        const dStartPrev = this.calculateDistance(allPoints[0], coords[0]);
                        const dEndPrev = this.calculateDistance(allPoints[0], coords[coords.length - 1]);

                        if (dEndPrev < 50) {
                            allPoints = [...coords, ...allPoints.slice(1)];
                            availableNodes.splice(i, 1);
                            changed = true;
                            break;
                        } else if (dStartPrev < 50) {
                            allPoints = [...[...coords].reverse(), ...allPoints.slice(1)];
                            availableNodes.splice(i, 1);
                            changed = true;
                            break;
                        }
                    }
                }
            }
        }

        if (allPoints.length < 2) {
            return { allPoints: [], carrefourIndices: [], instrCount: 0 };
        }

        // 2. Intersection Detection
        const carrefourIndices = new Set<number>([0, allPoints.length - 1]);
        
        if (forcerCarrefours) {
            if (instr && instr.length > 0) {
                for (const i of instr) {
                    const c = i.geometry.coordinates[0];
                    for (let idx = 0; idx < allPoints.length; idx++) {
                        const p = allPoints[idx];
                        if (Math.abs(p[0] - c[0]) < 0.0005 && Math.abs(p[1] - c[1]) < 0.0005) {
                            if (this.calculateDistance(p, c) < 10) {
                                carrefourIndices.add(idx);
                                break;
                            }
                        }
                    }
                }
            } else {
                const osmIntersections = await this.getIntersectionsFromOverpass(allPoints);
                for (const osmP of osmIntersections) {
                    for (let idx = 0; idx < allPoints.length; idx++) {
                        const p = allPoints[idx];
                        if (Math.abs(p[0] - osmP[0]) < 0.0005 && Math.abs(p[1] - osmP[1]) < 0.0005) {
                            if (this.calculateDistance(p, osmP) < 10) {
                                carrefourIndices.add(idx);
                                break;
                            }
                        }
                    }
                }
            }
        }

        return { allPoints, carrefourIndices: Array.from(carrefourIndices), instrCount: instr.length };
    }

    /**
     * Transforms points into abstracted segments.
     */
    static solvePolygonalisation(
        allPoints: [number, number][],
        carrefourIndices: number[],
        toleranceAngle: number = 45,
        minDist: number = 80,
        horsPiste: boolean = false,
        forcerCarrefours: boolean = true,
        maskedNodes: number[] = [],
        forcedNodes: number[] = []
    ): PolySegment[] {
        if (!allPoints || allPoints.length === 0) return [];

        const carrefourSet = new Set(carrefourIndices);
        const maskedSet = new Set(maskedNodes);
        const forcedSet = new Set(forcedNodes);

        const finalSegments: PolySegment[] = [];
        let lastIdx = 0;
        let currentDist = 0;

        for (let i = 1; i < allPoints.length; i++) {
            const pPrev = allPoints[i - 1];
            const pCurr = allPoints[i];
            currentDist += this.calculateDistance(pPrev, pCurr);

            const isLast = (i === allPoints.length - 1);
            let doSplit = false;

            if (isLast) {
                doSplit = true;
            } else if (forcedSet.has(i)) {
                doSplit = true;
            } else if (maskedSet.has(i)) {
                doSplit = false;
            } else if (currentDist < minDist) {
                doSplit = false;
            } else {
                const pNext = allPoints[i + 1];
                const b1 = this.calculateBearing(pPrev, pCurr);
                const b2 = this.calculateBearing(pCurr, pNext);

                let diff = Math.abs(b1 - b2);
                if (diff > 180) diff = 360 - diff;

                if (carrefourSet.has(i) && forcerCarrefours) {
                    if (diff > 15) doSplit = true;
                } else if (diff > toleranceAngle) {
                    doSplit = true;
                }
            }

            if (doSplit) {
                const pStart = allPoints[lastIdx];
                const sectionAzi = this.calculateSmartBearing(allPoints, lastIdx, 20);
                
                let geomCoords = allPoints.slice(lastIdx, i + 1);
                if (horsPiste) {
                    geomCoords = [pStart, pCurr];
                }

                finalSegments.push({
                    azimut: Math.round(sectionAzi),
                    distance: Math.round(currentDist),
                    coords: geomCoords,
                    properties: {
                        azimut: Math.round(sectionAzi),
                        metrage: Math.round(currentDist),
                        coords_intersection: pStart,
                        start_idx: lastIdx,
                        point_idx: i,
                    }
                });

                lastIdx = i;
                currentDist = 0;
            }
        }

        return finalSegments;
    }

    /**
     * Unified entry point.
     */
    static async processTrajectoryData(
        data: any,
        toleranceAngle: number = 45,
        minDist: number = 80,
        horsPiste: boolean = false,
        forcerCarrefours: boolean = true,
        maskedNodes: number[] = [],
        forcedNodes: number[] = []
    ): Promise<PolySegment[]> {
        const { allPoints, carrefourIndices } = await this.analyzeTrajectory(data, forcerCarrefours);
        return this.solvePolygonalisation(
            allPoints, 
            carrefourIndices, 
            toleranceAngle, 
            minDist, 
            horsPiste, 
            forcerCarrefours, 
            maskedNodes, 
            forcedNodes
        );
    }
}

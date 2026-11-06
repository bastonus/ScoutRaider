import { IGNClient } from './IGNClient';

/**
 * GeoUtils.ts — Geodesic geometry calculations for ScoutRaider
 */

/**
 * Compute boundary of a polygon where each edge between vertices follows pedestrian paths / trails (BRouter).
 */
export async function computeRoutedAreaBoundary(
    vertices: [number, number][],
    profile: string = 'pedestrian'
): Promise<[number, number][]> {
    if (!vertices || vertices.length < 3) return vertices || [];
    const boundary: [number, number][] = [];
    const n = vertices.length;

    for (let i = 0; i < n; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % n];

        try {
            const geom = await IGNClient.computeRoute(p1, p2, profile);
            if (geom && geom.coordinates && geom.coordinates.length > 0) {
                const edgePts: [number, number][] = geom.coordinates.map((c: any) => [c[1], c[0]]);
                boundary.push(...edgePts.slice(0, -1));
            } else {
                boundary.push(p1);
            }
        } catch (e) {
            boundary.push(p1);
        }
    }

    return boundary.length >= 3 ? boundary : vertices;
}

/**
 * Calculate the surface area of a polygon on Earth's spherical surface (in square meters).
 * @param coords Array of [lat, lon] points
 */
export function calculatePolygonArea(coords: [number, number][]): number {
    if (!coords || coords.length < 3) return 0;
    const R = 6378137; // Earth radius in meters
    let total = 0;
    const len = coords.length;
    for (let i = 0; i < len; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % len];
        const lat1 = (p1[0] * Math.PI) / 180;
        const lat2 = (p2[0] * Math.PI) / 180;
        const lon1 = (p1[1] * Math.PI) / 180;
        const lon2 = (p2[1] * Math.PI) / 180;
        total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    const area = Math.abs((total * R * R) / 2.0);
    return Math.round(area * 10) / 10;
}

/**
 * Format an area in m² into human readable m², ha, or km².
 */
export function formatArea(areaM2: number): string {
    if (!areaM2 || isNaN(areaM2) || areaM2 <= 0) return '0 m²';
    if (areaM2 >= 1_000_000) {
        return `${(areaM2 / 1_000_000).toFixed(2)} km²`;
    }
    if (areaM2 >= 10_000) {
        return `${(areaM2 / 10_000).toFixed(2)} ha`;
    }
    return `${Math.round(areaM2)} m²`;
}

/**
 * RouteEngine.ts — Pure backend logic for multi-route management.
 * Ported from legacy/utils/route_engine.py.
 * Operates on plain objects without UI coupling.
 */
import type { RouteDict } from './types';

function generateId(): string {
    return 'route_' + Math.random().toString(36).substr(2, 8);
}

function getPaletteColor(index: number): string {
    const PALETTE = [
        "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
        "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
    ];
    return PALETTE[Math.abs(index) % PALETTE.length];
}

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return hash;
}

export class RouteEngine {
    static createRoute(name: string, geojsonGeometry: any, color?: string): RouteDict {
        const routeId = generateId();
        return {
            id: routeId,
            name: name,
            geojson: geojsonGeometry,
            color: color || getPaletteColor(hashCode(routeId)),
            visible: true,
            locked: false,
            order: 0,
            distance_m: 0
        };
    }

    static createRouteFromFeatureCollection(name: string, featureCollection: any, color?: string): RouteDict | null {
        for (const feature of (featureCollection.features || [])) {
            const geom = feature.geometry || {};
            if (geom.type === "LineString") {
                return this.createRoute(name, geom, color);
            } else if (geom.type === "MultiLineString") {
                const allCoords: [number, number][] = [];
                for (const line of (geom.coordinates || [])) {
                    allCoords.push(...line);
                }
                return this.createRoute(name, { type: "LineString", coordinates: allCoords }, color);
            }
        }
        
        // Fallback
        for (const feature of (featureCollection.features || [])) {
            const geom = feature.geometry || {};
            const coords = geom.coordinates || [];
            if (coords.length > 0 && Array.isArray(coords[0])) {
                return this.createRoute(name, { type: "LineString", coordinates: coords }, color);
            }
        }
        
        return null;
    }

    static reverseRoute(route: RouteDict): RouteDict {
        const newRoute = JSON.parse(JSON.stringify(route));
        const coords = newRoute.geojson?.coordinates || [];
        newRoute.geojson.coordinates = [...coords].reverse();
        newRoute.name = route.name + " (reversed)";
        return newRoute;
    }

    static splitRoute(route: RouteDict, splitIndex: number): [RouteDict, RouteDict] | null {
        const coords = route.geojson?.coordinates || [];
        if (splitIndex <= 0 || splitIndex >= coords.length - 1) {
            return null;
        }

        const coordsA = coords.slice(0, splitIndex + 1);
        const coordsB = coords.slice(splitIndex);

        const routeA = JSON.parse(JSON.stringify(route));
        routeA.id = generateId();
        routeA.name = route.name + " (part 1)";
        if(routeA.geojson) routeA.geojson.coordinates = coordsA;

        const routeB = JSON.parse(JSON.stringify(route));
        routeB.id = generateId();
        routeB.name = route.name + " (part 2)";
        if(routeB.geojson) routeB.geojson.coordinates = coordsB;

        return [routeA, routeB];
    }

    static mergeRoutes(routeA: RouteDict, routeB: RouteDict): RouteDict {
        const coordsA = routeA.geojson?.coordinates || [];
        const coordsB = routeB.geojson?.coordinates || [];
        
        // Skip duplicate junction point if identical
        const mergedCoords = [...coordsA];
        if (coordsB.length > 0) {
            if (mergedCoords.length > 0 && 
                mergedCoords[mergedCoords.length - 1][0] === coordsB[0][0] && 
                mergedCoords[mergedCoords.length - 1][1] === coordsB[0][1]) {
                mergedCoords.push(...coordsB.slice(1));
            } else {
                mergedCoords.push(...coordsB);
            }
        }

        const merged = JSON.parse(JSON.stringify(routeA));
        merged.id = generateId();
        merged.name = `${routeA.name} + ${routeB.name}`;
        if(merged.geojson) merged.geojson.coordinates = mergedCoords;

        return merged;
    }

    static addWaypoint(route: RouteDict, lat: number, lon: number, afterIndex: number): RouteDict {
        const newRoute = JSON.parse(JSON.stringify(route));
        const coords = newRoute.geojson?.coordinates || [];
        
        if (afterIndex < 0 || afterIndex >= coords.length) {
            return newRoute;
        }

        // GeoJSON uses [lon, lat]
        coords.splice(afterIndex + 1, 0, [lon, lat]);
        if(newRoute.geojson) newRoute.geojson.coordinates = coords;
        
        return newRoute;
    }

    static removeWaypoint(route: RouteDict, index: number): RouteDict {
        const newRoute = JSON.parse(JSON.stringify(route));
        const coords = newRoute.geojson?.coordinates || [];
        
        if (index <= 0 || index >= coords.length - 1) {
            return newRoute;
        }

        coords.splice(index, 1);
        if(newRoute.geojson) newRoute.geojson.coordinates = coords;
        
        return newRoute;
    }

    static duplicateRoute(route: RouteDict): RouteDict {
        const newRoute = JSON.parse(JSON.stringify(route));
        newRoute.id = generateId();
        newRoute.name = route.name + " (copy)";
        return newRoute;
    }

    static getChainedGeoJSON(routes: RouteDict[], routeChain?: string[] | null): any {
        const routeMap = new Map<string, RouteDict>();
        for (const r of routes) {
            routeMap.set(r.id, r);
        }

        let ordered: RouteDict[] = [];
        if (routeChain && routeChain.length > 0) {
            for (const rid of routeChain) {
                const r = routeMap.get(rid);
                if (r) ordered.push(r);
            }
        } else {
            ordered = routes.filter(r => r.visible !== false);
        }

        if (ordered.length === 0) {
            return { type: "FeatureCollection", features: [] };
        }

        const allCoords: [number, number][] = [];
        let hasFallback = false;
        let maxDanger: string | null = null;
        const dangerScores: Record<string, number> = { extreme: 3, high: 2, minor: 1 };

        for (const r of ordered) {
            const geojson = r.geojson || {};
            const coords = geojson.coordinates || [];
            const props = geojson.properties || {};

            if (props.is_fallback) hasFallback = true;
            
            const dl = props.danger_level;
            if (dl) {
                if (!maxDanger || (dangerScores[dl] || 0) > (dangerScores[maxDanger] || 0)) {
                    maxDanger = dl;
                }
            }

            if (allCoords.length > 0 && coords.length > 0) {
                if (allCoords[allCoords.length - 1][0] === coords[0][0] && 
                    allCoords[allCoords.length - 1][1] === coords[0][1]) {
                    allCoords.push(...coords.slice(1));
                } else {
                    allCoords.push(...coords);
                }
            } else {
                allCoords.push(...coords);
            }
        }

        const mergedFeature = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: allCoords
            },
            properties: {
                name: ordered.map(r => r.name).join(" → "),
                route_count: ordered.length,
                is_fallback: hasFallback,
                danger_level: maxDanger
            }
        };

        return {
            type: "FeatureCollection",
            features: [mergedFeature]
        };
    }

    static computeRouteDistance(route: RouteDict): number {
        const coords = route.geojson?.coordinates || [];
        let total = 0.0;
        for (let i = 0; i < coords.length - 1; i++) {
            total += this.haversine(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0]);
        }
        return Math.round(total);
    }

    private static haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371000;
        const p = Math.PI / 180;
        const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2 + 
                 Math.cos(lat1 * p) * Math.cos(lat2 * p) * 
                 (1 - Math.cos((lon2 - lon1) * p)) / 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }
}

/**
 * RouteRubberbandLayer.tsx — Interactive drag-to-reroute (Rubber-banding)
 * 
 * Allows users to click & drag any portion of a route polyline to divert/bend it
 * onto a different path or trail (like in Google Maps, Komoot, and ScoutMap).
 * Drops a new intermediate stage between stages[i] and stages[i+1] and reroutes both legs.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Polyline, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import { IGNClient } from '../../logic/IGNClient';

const ghostIcon = L.divIcon({
    className: 'rubberband-ghost-handle',
    html: `
        <div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid #0284c7;
            box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.35), 0 2px 6px rgba(0,0,0,0.45);
            cursor: grab;
            transition: transform 0.12s cubic-bezier(0.16, 1, 0.3, 1);
        "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

const draggingIcon = L.divIcon({
    className: 'rubberband-dragging-handle',
    html: `
        <div style="
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #0284c7;
            border: 3px solid #ffffff;
            box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.4), 0 4px 12px rgba(0,0,0,0.55);
            cursor: grabbing;
        "></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
});

interface HoverState {
    legIdx: number;
    lat: number;
    lon: number;
}

export default function RouteRubberbandLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const [hover, setHover] = useState<HoverState | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragPos, setDragPos] = useState<[number, number] | null>(null);
    const markerRef = useRef<any>(null);
    const hideTimeoutRef = useRef<any>(null);

    const activeTool = state.active_tool;
    const isToolAllowed = ['route', 'route_direct', 'select', 'pointer'].includes(activeTool) || !activeTool;

    // Reset when tool changes or stages change
    useEffect(() => {
        if (!isDragging) {
            setHover(null);
            setDragPos(null);
        }
    }, [activeTool, state.stages.length]);

    // Clear ghost handle on map click or zoom start
    useEffect(() => {
        const onMapMove = () => {
            if (!isDragging) setHover(null);
        };
        map.on('zoomstart', onMapMove);
        return () => {
            map.off('zoomstart', onMapMove);
        };
    }, [map, isDragging]);

    const handlePolylineMouseMove = useCallback((e: any, legIdx: number) => {
        if (!isToolAllowed || isDragging) return;
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        const { lat, lng } = e.latlng;
        setHover({ legIdx, lat, lon: lng });
    }, [isToolAllowed, isDragging]);

    const handlePolylineMouseOut = useCallback(() => {
        if (isDragging) return;
        hideTimeoutRef.current = setTimeout(() => {
            if (!isDragging) setHover(null);
        }, 1200);
    }, [isDragging]);

    const handleDragStart = useCallback(() => {
        setIsDragging(true);
        (window as any).__markerDragging = true;
        map.dragging.disable();
    }, [map]);

    const handleDrag = useCallback((e: any) => {
        const latlng = e.target.getLatLng();
        setDragPos([latlng.lat, latlng.lng]);
    }, []);

    const handleDragEnd = useCallback(async (e: any) => {
        const target = e.target;
        const latlng = target.getLatLng();
        const dropLat = latlng.lat;
        const dropLon = latlng.lng;

        // Re-enable map dragging
        map.dragging.enable();
        setTimeout(() => {
            (window as any).__markerDragging = false;
        }, 200);

        const currentHover = hover;
        setIsDragging(false);
        setHover(null);
        setDragPos(null);

        if (!currentHover) return;
        const legIdx = currentHover.legIdx;
        const stageA = state.stages[legIdx];
        const stageB = state.stages[legIdx + 1];
        if (!stageA || !stageB) return;

        const currentRoute = state.routes[legIdx];
        const profile = currentRoute?.profile || (state.active_tool === 'route_direct' ? 'direct' : 'pedestrian');

        // 1. Insert new stage between legIdx and legIdx + 1
        const newStageId = `stage-${Date.now()}`;
        dispatch({
            type: 'INSERT_STAGE',
            afterIdx: legIdx,
            lat: dropLat,
            lon: dropLon,
            id: newStageId
        });

        // 2. Remove old single leg route
        if (currentRoute) {
            dispatch({ type: 'REMOVE_ROUTE', id: currentRoute.id });
        }

        // 3. Enqueue 2 new routed legs through drop point
        dispatch({
            type: 'SET_LOADING',
            isLoading: true,
            text: 'Recalcul de la déviation...'
        });

        backgroundEngine.enqueue('route_leg', 0, `job-rubberband-${Date.now()}-1`, {
            p1: [stageA.coords[0], stageA.coords[1]],
            p2: [dropLat, dropLon],
            profile,
            small_roads: state.small_roads_only,
            insertIdx: legIdx
        });

        backgroundEngine.enqueue('route_leg', 0, `job-rubberband-${Date.now()}-2`, {
            p1: [dropLat, dropLon],
            p2: [stageB.coords[0], stageB.coords[1]],
            profile,
            small_roads: state.small_roads_only,
            insertIdx: legIdx + 1
        });

        // 4. Reverse geocode address for the new stage
        try {
            const addr = await IGNClient.reverseGeocode(dropLat, dropLon);
            if (addr) {
                dispatch({
                    type: 'MOVE_STAGE',
                    id: newStageId,
                    lat: dropLat,
                    lon: dropLon,
                    address: addr
                });
            }
        } catch (err) {
            console.debug('[RouteRubberband] Geocode failed for diverted stage:', err);
        }

        dispatch({
            type: 'ADD_NOTIFICATION',
            message: `Tracé dévié : nouvelle étape insérée.`,
            notifType: 'info'
        });
    }, [hover, state.stages, state.routes, state.small_roads_only, state.active_tool, map, dispatch]);

    if (!isToolAllowed) return null;

    const routes = state.routes || [];
    const stages = state.stages || [];
    if (stages.length < 2 || routes.length === 0) return null;

    const activeLegIdx = hover?.legIdx ?? -1;
    const stageA = activeLegIdx >= 0 && activeLegIdx < stages.length ? stages[activeLegIdx] : null;
    const stageB = activeLegIdx >= 0 && activeLegIdx < stages.length - 1 ? stages[activeLegIdx + 1] : null;
    const activeMarkerPos: [number, number] | null = dragPos || (hover ? [hover.lat, hover.lon] : null);

    return (
        <>
            {/* Invisible wide hitboxes for each route leg to detect hover easily */}
            {routes.map((route, i) => {
                if (!route) return null;
                const geom = route.geojson?.geometry || route.geojson;
                const coords = geom?.coordinates || [];
                if (!Array.isArray(coords) || coords.length < 2) return null;

                const latLngs: [number, number][] = coords.map((c: any) => [c[1], c[0]]);

                return (
                    <Polyline
                        key={`rubberband-hitbox-${route.id || i}`}
                        positions={latLngs}
                        pathOptions={{
                            color: 'transparent',
                            weight: 22,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                        eventHandlers={{
                            mousemove: (e) => handlePolylineMouseMove(e, i),
                            mouseout: handlePolylineMouseOut,
                        }}
                    />
                );
            })}

            {/* Dynamic Rubber-band Preview Lines while dragging */}
            {isDragging && activeMarkerPos && stageA && stageB && (
                <>
                    {/* Glow backdrop */}
                    <Polyline
                        positions={[stageA.coords, activeMarkerPos, stageB.coords]}
                        pathOptions={{
                            color: '#0284c7',
                            weight: 8,
                            opacity: 0.25,
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                    {/* Crisp Dashed Guide Line */}
                    <Polyline
                        positions={[stageA.coords, activeMarkerPos, stageB.coords]}
                        pathOptions={{
                            color: '#0284c7',
                            weight: 3,
                            opacity: 0.95,
                            dashArray: '6, 8',
                            lineCap: 'round',
                            lineJoin: 'round',
                        }}
                    />
                </>
            )}

            {/* Draggable Handle */}
            {activeMarkerPos && (
                <Marker
                    ref={markerRef}
                    position={activeMarkerPos}
                    draggable={true}
                    zIndexOffset={9999}
                    bubblingMouseEvents={true}
                    icon={isDragging ? draggingIcon : ghostIcon}
                    eventHandlers={{
                        dragstart: handleDragStart,
                        drag: handleDrag,
                        dragend: handleDragEnd,
                    }}
                >
                    {!isDragging && (
                        <Tooltip direction="top" offset={[0, -10]} opacity={0.92}>
                            <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', padding: '2px 4px' }}>
                                <b style={{ color: '#0284c7' }}>Déviation de tracé</b>
                                <div style={{ fontSize: '10px', color: '#cbd5e1', marginTop: '2px' }}>
                                    Glisser pour dévier · Clic : insérer une étape
                                </div>
                            </div>
                        </Tooltip>
                    )}
                </Marker>
            )}
        </>
    );
}

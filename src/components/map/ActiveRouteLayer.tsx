import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Polyline, Marker, Popup, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import { ALL_MODULE_IDS, MODULE_META } from '../../logic/ModuleRegistry';
import { themeManager } from '../../logic/ThemeManager';
import { ModuleLogic } from '../../logic/ModuleLogic';
import { NavigationText } from '../../logic/NavigationText';
import { PolygonalEngine } from '../../logic/PolygonalEngine';

/** Helper: Haversine distance in meters */
const getDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Helper: Calculate bearing from two lat/lng points */
const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
};

/** Helper: Calculate destination point given distance and bearing */
const getDestLatLng = (lat: number, lng: number, azi: number, distMeters: number): [number, number] => {
    const R = 6371000, ad = distMeters / R, brng = azi * Math.PI / 180;
    const lat1 = lat * Math.PI / 180, lon1 = lng * Math.PI / 180;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ad) + Math.cos(lat1) * Math.sin(ad) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(ad) * Math.cos(lat1), Math.cos(ad) - Math.sin(lat1) * Math.sin(lat2));
    return [lat2 * 180 / Math.PI, lon2 * 180 / Math.PI];
};

const modColors: Record<string, string> = {
    'carte_ign': '#3b82f6', 'drapeaux': '#f59e0b', 'gilwell': '#8b5cf6',
    'morse': '#ef4444', 'vigenere': '#ec4899', 'templier': '#f97316',
    'texte_clair': '#10b981', 'avocat': '#14b8a6', 'cassis': '#a855f7',
    'maritime': '#06b6d4', 'polybe': '#f43f5e', 'unassigned': '#6b7280'
};

const nodeIcon = L.divIcon({
    className: 'node-marker-icon',
    html: '<div style="width:10px;height:10px;background:#fff;border:2px solid #555;border-radius:1px;cursor:pointer;box-sizing:border-box;box-shadow:0 1px 2px rgba(0,0,0,0.5)"></div>',
    iconSize: [10, 10], 
    iconAnchor: [5, 5]
});

// ── Isolated Azimut Handle to ensure imperative drag persists ──
const AzimutHandle = React.memo(({ idx, position, azimut, onDrag, onDragEnd }: { 
    idx: number, position: [number, number], azimut: number, 
    onDrag: (e: any, idx: number) => void, onDragEnd: (e: any, idx: number) => void 
}) => {
    const markerRef = useRef<any>(null);

    useEffect(() => {
        if (markerRef.current) {
            const leafletEl = markerRef.current._leaflet_id ? markerRef.current : markerRef.current._marker || markerRef.current;
            if (leafletEl?.dragging) leafletEl.dragging.enable();
        }
    }, []);

    return (
        <Marker 
            ref={markerRef}
            position={position}
            draggable={true}
            zIndexOffset={2000}
            icon={L.divIcon({
                className: 'azi-handle',
                html: '<div style="width:18px;height:18px;border-radius:50%;background:#fff;border:3px solid #2d8ceb;cursor:move;box-shadow:0 1px 6px rgba(0,0,0,0.5);pointer-events:all;"></div>',
                iconSize: [18, 18], iconAnchor: [9, 9]
            })}
            eventHandlers={{
                dragstart: (e) => {
                    const handle = e.target;
                    if (handle.dragging) handle.dragging.enable();
                    handle.bindTooltip(`<span style="font-weight:bold;color:#2d8ceb">${azimut || 0}°</span>`, { permanent: true, direction: 'top', offset: [0, -12] }).openTooltip();
                },
                drag: (e) => onDrag(e, idx),
                dragend: (e) => {
                    onDragEnd(e, idx);
                    e.target.unbindTooltip();
                }
            }}
        />
    );
});

export default function ActiveRouteLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const activeTool = state.active_tool;
    const [zoom, setZoom] = useState(map.getZoom());

    // Track zoom changes for label density
    useMapEvents({
        zoomend: () => setZoom(map.getZoom())
    });

    const steps = state.polygonal_steps;
    const showPolygons = steps.length > 0;
    const showArrows = zoom >= 14;

    const [encodingPopupVal, setEncodingPopupVal] = useState<{ idx: number, latlng: [number, number] } | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

    React.useEffect(() => {
        const handleDragOver = (e: DragEvent) => {
            const map = (window as any).__leafletMap;
            if (!map) return;
            const dropPoint = map.mouseEventToContainerPoint(e);
            let closestIdx = -1;
            let minPixelDist = Infinity;
            
            for (let i = 0; i < steps.length; i++) {
                const coords = steps[i].coords;
                if (coords.length < 2) continue;
                
                for (let j = 0; j < coords.length - 1; j++) {
                    const pt1 = coords[j];
                    const pt2 = coords[j+1];
                    const a = map.latLngToContainerPoint([pt1[1], pt1[0]]);
                    const b = map.latLngToContainerPoint([pt2[1], pt2[0]]);
                    const p = dropPoint;
                    
                    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
                    let dist = 0;
                    if (l2 === 0) {
                        dist = Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
                    } else {
                        let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
                        t = Math.max(0, Math.min(1, t));
                        const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
                        dist = Math.sqrt(Math.pow(p.x - proj.x, 2) + Math.pow(p.y - proj.y, 2));
                    }

                    if (dist < minPixelDist) {
                        minPixelDist = dist;
                        closestIdx = i;
                    }
                }
            }
            if (closestIdx !== -1 && minPixelDist < 50) setDragOverIdx(closestIdx);
            else setDragOverIdx(null);
        };
        const handleEnd = () => setDragOverIdx(null);

        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('dragleave', handleEnd);
        window.addEventListener('drop', handleEnd);
        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('dragleave', handleEnd);
            window.removeEventListener('drop', handleEnd);
        };
    }, [steps]);

    // ── Phase 0 Fix: Node drag now properly updates the polygonal steps ──
    const [optimisticNodes, setOptimisticNodes] = useState<Record<number, [number, number]>>({});

    // Clear optimistic nodes when the steps actually change from the backend
    React.useEffect(() => {
        setOptimisticNodes({});
    }, [steps]);

    const allCoords = React.useMemo(() => state.routes.flatMap((r: any) =>
        r?.geojson?.geometry?.coordinates || r?.geojson?.coordinates || []
    ), [state.routes]);

    const findClosestRoutePoint = useCallback((lat: number, lng: number) => {
        let minPixelDist = Infinity;
        let closestPt: [number, number] = [lat, lng];
        let closestIdx = -1;

        const p = map.latLngToContainerPoint([lat, lng]);

        for (let i = 0; i < allCoords.length - 1; i++) {
            const pt1 = allCoords[i];
            const pt2 = allCoords[i+1];
            // map.latLngToContainerPoint expects [lat, lng] or L.LatLng
            const a = map.latLngToContainerPoint([pt1[1], pt1[0]]);
            const b = map.latLngToContainerPoint([pt2[1], pt2[0]]);
            
            const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
            let proj;
            if (l2 === 0) {
                proj = a;
            } else {
                let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
                t = Math.max(0, Math.min(1, t));
                proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
            }

            const dist = Math.sqrt(Math.pow(p.x - proj.x, 2) + Math.pow(p.y - proj.y, 2));

            if (dist < minPixelDist) {
                minPixelDist = dist;
                const latlng = map.containerPointToLatLng(proj as any);
                closestPt = [latlng.lat, latlng.lng];
                
                // For data index, we pick the closest vertex of the segment
                const d1 = Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2);
                const d2 = Math.pow(p.x - b.x, 2) + Math.pow(p.y - b.y, 2);
                closestIdx = d1 < d2 ? i : i + 1;
            }
        }
        return { idx: closestIdx, latlng: closestPt, dist: minPixelDist };
    }, [allCoords, map]);

    const handleNodeDrag = useCallback((e: any) => {
        const { lat, lng } = e.target.getLatLng();
        const closest = findClosestRoutePoint(lat, lng);
        e.target.setLatLng(closest.latlng);
    }, [findClosestRoutePoint]);

    const handleNodeDragEnd = useCallback((e: any, segIdx: number) => {
        const { lat, lng } = e.target.getLatLng();
        const closest = findClosestRoutePoint(lat, lng);
        const seg = steps[segIdx];
        if (!seg || closest.idx === -1) return;

        const oldStartIdx = seg.properties.start_idx;
        
        let newForced = [...state.polygonalization_settings.forced_nodes];
        let newMasked = [...state.polygonalization_settings.masked_nodes];

        // If it was already a forced node, we just update it.
        if (newForced.includes(oldStartIdx)) {
            newForced = newForced.filter(idx => idx !== oldStartIdx);
        } else {
            // If it was an automatic node, we mask it so it doesn't reappear at the same spot.
            newMasked.push(oldStartIdx);
        }
        newForced.push(closest.idx);

        // Optimistically update the node position locally to prevent "flicker" while waiting for background engine
        setOptimisticNodes(prev => ({ ...prev, [segIdx]: [lat, lng] }));

        dispatch({ type: 'SET_POLYGONAL_SETTINGS', settings: { 
            forced_nodes: Array.from(new Set(newForced)),
            masked_nodes: Array.from(new Set(newMasked))
        } as any });
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Nœud déplacé.', notifType: 'info' });
    }, [dispatch, findClosestRoutePoint, steps, state.polygonalization_settings.forced_nodes, state.polygonalization_settings.masked_nodes]);

    // ── Phase 0 Fix: Azimut drag now properly writes back to state ──
    const handleAzimutDrag = useCallback((e: any, segIdx: number) => {
        const handle = e.target;
        const latlng = handle.getLatLng();
        const line = (window as any).__aziLines?.[segIdx];
        if (line) {
            const currentLatLngs = line.getLatLngs();
            if (currentLatLngs.length === 2) {
                line.setLatLngs([currentLatLngs[0], latlng]);
                const startPt = currentLatLngs[0];
                const newAzimut = Math.round(getBearing(startPt.lat, startPt.lng, latlng.lat, latlng.lng));
                if (handle.getTooltip()) {
                    handle.getTooltip().setContent(`<span style="font-weight:bold;color:#2d8ceb">${newAzimut}°</span>`);
                }
            }
        }
    }, []);

    const handleAzimutDragEnd = useCallback((e: any, segIdx: number) => {
        const handle = e.target.getLatLng();
        const seg = steps[segIdx];
        if (!seg) return;

        const startPt = [seg.coords[0][1], seg.coords[0][0]] as [number, number]; // [lat, lon]
        const newAzimut = Math.round(getBearing(startPt[0], startPt[1], handle.lat, handle.lng));

        dispatch({ type: 'UPDATE_AZIMUT', segIdx, azimut: newAzimut });
    }, [dispatch, steps]);


    // ── Node context menu (remove node) ──
    const handleNodeRemove = useCallback((segIdx: number) => {
        const seg = steps[segIdx];
        if (!seg) return;
        const startIdx = seg.properties.start_idx;

        // If it's a forced node, just unforce it.
        // If it's an automatic node, mask it.
        if (state.polygonalization_settings.forced_nodes.includes(startIdx)) {
            const newForced = state.polygonalization_settings.forced_nodes.filter(i => i !== startIdx);
            dispatch({ type: 'SET_POLYGONAL_SETTINGS', settings: { forced_nodes: newForced } as any });
        } else {
            const newMasked = [...state.polygonalization_settings.masked_nodes, startIdx];
            dispatch({ type: 'SET_POLYGONAL_SETTINGS', settings: { masked_nodes: newMasked } as any });
        }
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Nœud supprimé.', notifType: 'info' });
    }, [dispatch, steps, state.polygonalization_settings.forced_nodes, state.polygonalization_settings.masked_nodes]);

    const recalculateRouteLeg = useCallback((idx: number, newProfile: string) => {
        const stageA = state.stages[idx];
        const stageB = state.stages[idx + 1];
        if (!stageA || !stageB) return;

        dispatch({ type: 'REMOVE_ROUTE', id: state.routes[idx].id });
        dispatch({ type: 'SET_LOADING', isLoading: true, text: newProfile === 'direct' ? 'Ligne droite...' : 'Routage (BRouter)...' });
        backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}`, {
            p1: [stageA.coords[0], stageA.coords[1]],
            p2: [stageB.coords[0], stageB.coords[1]],
            profile: newProfile,
            small_roads: state.small_roads_only,
            insertIdx: idx
        });
    }, [state.stages, state.routes, state.small_roads_only, dispatch]);

    // Extract alternative rendering so it shows in both modes
    const renderAlternatives = () => {
        return state.routes.map((route: any) => {
            if (!route || !route.alternatives || route.alternatives.length <= 1) return null;
            
            return route.alternatives.map((alt: any, altIdx: number) => {
                // Skip if this is the currently active alternative (check by matching distance)
                if (Math.abs((route.distance_m || 0) - (alt.distance || 0)) < 1) return null;

                const coords = (alt.geometry?.coordinates || []).map((c: any) => [c[1], c[0]]);
                if (coords.length < 2) return null;

                return (
                    <React.Fragment key={`alt-${route.id}-${altIdx}`}>
                        {/* Invisible thick line for easier clicking */}
                        <Polyline
                            positions={coords}
                            color="transparent"
                            weight={20}
                            eventHandlers={{
                                click: () => {
                                    dispatch({ type: 'SWAP_ROUTE_ALTERNATIVE', id: route.id, altIdx });
                                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Itinéraire alternatif sélectionné. Recalcul...', notifType: 'info' });
                                }
                            }}
                        />
                        {/* Visible thin grey line */}
                        <Polyline
                            positions={coords}
                            color="#9ca3af"
                            weight={6}
                            opacity={0.5}
                            dashArray="8, 8"
                            interactive={false}
                        />
                    </React.Fragment>
                );
            });
        });
    };

    if (!showPolygons) {
        // Fallback: Just draw raw BRouter routes
        return (
            <>
                {renderAlternatives()}
                {state.routes.map((r: any, idx: number) => {
                    if (!r) return null;
                    const positions = (r.geojson?.geometry?.coordinates || r.geojson?.coordinates || []).map((c: any) => [c[1], c[0]]);
                    return (
                        <React.Fragment key={`route-${r.id}`}>
                            {/* Invisible wide line for clicking */}
                            <Polyline
                                positions={positions}
                                color="transparent"
                                weight={30}
                                interactive={true}
                                eventHandlers={{
                                    click: (e: any) => {
                                        L.DomEvent.stop(e.originalEvent);
                                        if (activeTool === 'route_direct' && r.profile !== 'direct') {
                                            recalculateRouteLeg(idx, 'direct');
                                        } else if (activeTool === 'route' && r.profile === 'direct') {
                                            recalculateRouteLeg(idx, 'pedestrian');
                                        }
                                    },
                                    mouseover: () => {
                                        if ((activeTool === 'route_direct' && r.profile !== 'direct') || (activeTool === 'route' && r.profile === 'direct')) {
                                            (window as any).__isHoveringCompatible = true;
                                        }
                                    },
                                    mouseout: () => {
                                        (window as any).__isHoveringCompatible = false;
                                    }
                                }}
                            >
                                {(activeTool === 'route_direct' || activeTool === 'route') && (
                                    <Tooltip sticky>
                                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)' }}>
                                            <b style={{ color: 'var(--accent-default)' }}>{r.profile === 'direct' ? 'Hors piste' : 'Tracé pédestre'}</b><br />
                                            {activeTool === 'route_direct' && r.profile !== 'direct' && <span>Clic : convertir en hors piste</span>}
                                            {activeTool === 'route' && r.profile === 'direct' && <span>Clic : convertir en tracé BRouter</span>}
                                        </div>
                                    </Tooltip>
                                )}
                            </Polyline>
                            {/* Visible route line */}
                            <Polyline 
                                positions={positions} 
                                color="#2d8ceb"
                                weight={6}
                                opacity={0.8}
                                interactive={false}
                            />
                        </React.Fragment>
                    );
                })}
            </>
        );
    }

    return (
        <>
            {/* Draw alternatives underneath polygons */}
            {renderAlternatives()}
            {steps.map((seg, idx) => {
                const latLngs: [number, number][] = seg.coords.map((c: any) => [c[1], c[0]]);
                if (latLngs.length < 2) return null;

                const mod = seg.assigned_module || 'unassigned';
                let color = modColors[mod] || '#6b7280';
                let weight = 5;
                let isDragOver = dragOverIdx === idx;
                
                if (isDragOver) {
                    const draggingMod = (window as any).__draggingModuleId;
                    if (draggingMod && modColors[draggingMod]) {
                        color = modColors[draggingMod];
                    }
                    weight = 12; // Thicker to show drop target
                }
                
                let segDist = 0;
                for (let i = 0; i < latLngs.length - 1; i++) {
                    segDist += getDistanceMeters(latLngs[i][0], latLngs[i][1], latLngs[i+1][0], latLngs[i+1][1]);
                }

                const azimut = seg.azimut;
                const startPt = optimisticNodes[idx] || latLngs[0];
                const arrowLen = Math.max(80, Math.min(250, segDist * 0.4));
                const destPt = azimut !== undefined ? getDestLatLng(startPt[0], startPt[1], azimut, arrowLen) : null;

                const isAzimutTool = activeTool === 'azimut';
                const isNodeTool = activeTool === 'node';

                return (
                    <React.Fragment key={`poly-seg-${idx}`}>
                        {/* ── Invisible Thicker Line for easier interaction ── */}
                        <Polyline 
                            positions={latLngs} 
                            pathOptions={{ color: 'transparent', weight: 20 }}
                            eventHandlers={{
                                click: (e: any) => {
                                    if (activeTool === 'encodage') {
                                        setEncodingPopupVal({ idx, latlng: [e.latlng.lat, e.latlng.lng] });
                                    } else if (activeTool === 'node') {
                                        const closest = findClosestRoutePoint(e.latlng.lat, e.latlng.lng);
                                        if (closest.idx !== -1) {
                                            const newForced = [...state.polygonalization_settings.forced_nodes, closest.idx];
                                            dispatch({ type: 'SET_POLYGONAL_SETTINGS', settings: { forced_nodes: Array.from(new Set(newForced)) } as any });
                                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Nœud ajouté.', notifType: 'info' });
                                        }
                                    } else if (activeTool === 'route' || activeTool === 'route_direct') {
                                        // Use the leg_key to find which route leg to toggle
                                        const leg_key = (seg as any).leg_key;
                                        const legIdx = state.routes.findIndex(r => r && r.id === leg_key);
                                        if (legIdx !== -1) {
                                            const route = state.routes[legIdx];
                                            if (activeTool === 'route_direct' && route.profile !== 'direct') {
                                                recalculateRouteLeg(legIdx, 'direct');
                                            } else if (activeTool === 'route' && route.profile === 'direct') {
                                                recalculateRouteLeg(legIdx, 'pedestrian');
                                            }
                                        }
                                    }
                                }
                            }}
                        >
                            {isNodeTool && (
                                <Tooltip sticky>
                                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)' }}>
                                        <b style={{ color: 'var(--accent-default)' }}>Outil Nœud</b><br />
                                        <span>Clic-gauche : ajouter un nœud</span><br />
                                        <span>Clic-droit : supprimer un nœud</span>
                                    </div>
                                </Tooltip>
                            )}
                            {(activeTool === 'route_direct' || activeTool === 'route') && (
                                <Tooltip sticky>
                                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)' }}>
                                        <b style={{ color: 'var(--accent-default)' }}>Conversion de tracé</b><br />
                                        {activeTool === 'route_direct' && <span>Clic : convertir ce tronçon en hors piste (ligne droite)</span>}
                                        {activeTool === 'route' && <span>Clic : convertir ce tronçon en tracé pédestre (BRouter)</span>}
                                    </div>
                                </Tooltip>
                            )}
                        </Polyline>

                        {/* Visible Segment Line */}
                        <Polyline 
                            positions={latLngs} 
                            pathOptions={{ color, weight, opacity: isDragOver ? 1 : 0.85 }}
                            interactive={false}
                        />

                        {/* ── Azimut Arrows — ALWAYS rendered when zoom permits ── */}
                        {/* Phase 0 fix: arrows now persist for all tools, not just azimut */}
                        {showArrows && destPt && segDist >= 30 && (
                            <>
                                {isAzimutTool ? (
                                    /* Draggable Azimut Handle */
                                    <>
                                        <Polyline 
                                            positions={[startPt, destPt]} 
                                            color="#2d8ceb" 
                                            weight={3} 
                                            dashArray="5, 8"
                                            opacity={1}
                                            interactive={false}
                                            ref={(ref: any) => { if (ref) { (window as any).__aziLines = (window as any).__aziLines || {}; (window as any).__aziLines[idx] = ref; } }}
                                        />
                                        <AzimutHandle 
                                            idx={idx}
                                            position={destPt}
                                            azimut={azimut || 0}
                                            onDrag={handleAzimutDrag}
                                            onDragEnd={handleAzimutDragEnd}
                                        />
                                    </>
                                ) : (
                                    /* Standard Azimut Arrow + Label — always visible */
                                    <>
                                        <Polyline 
                                            positions={[startPt, destPt]} 
                                            color="#2d8ceb" 
                                            weight={2} 
                                            dashArray="5, 8" 
                                            opacity={0.8} 
                                        />
                                        <Marker 
                                            position={destPt} 
                                            interactive={false}
                                            icon={L.divIcon({
                                                className: 'azi-label',
                                                html: `<span style="color:#2d8ceb;font-weight:700;font-size:12px;text-shadow:1px 1px 2px rgba(255,255,255,0.8)">${azimut}°</span>`,
                                                iconAnchor: [-6, 12]
                                            })}
                                        />
                                    </>
                                )}
                            </>
                        )}

                        {/* ── Node Markers — rendered for ALL nodes, not just idx > 0 ── */}
                        {/* Phase 0 fix: removed idx > 0 guard so first node is visible */}
                        <Marker 
                            position={startPt}
                            icon={nodeIcon}
                            draggable={isNodeTool || isAzimutTool}
                            eventHandlers={{
                                dragstart: (e) => e.target.closePopup(),
                                drag: handleNodeDrag,
                                dragend: (e) => handleNodeDragEnd(e, idx),
                                contextmenu: (e) => {
                                    if (isNodeTool || isAzimutTool) {
                                        L.DomEvent.preventDefault(e as any);
                                        handleNodeRemove(idx);
                                    }
                                },
                                click: (e) => {
                                    if ((isNodeTool || isAzimutTool) && e.originalEvent && e.originalEvent.altKey) {
                                        handleNodeRemove(idx);
                                    }
                                }
                            }}
                        >
                            {isNodeTool && (
                                <Popup closeButton={false}>
                                    <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-ui)' }}>
                                        <span style={{ color: 'var(--accent-default)', fontWeight: 700 }}>Nœud #{idx}</span>
                                        <br />
                                        <span>Clic-droit ou <kbd style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px', padding: '1px 4px', fontSize: '10px' }}>Alt+Clic</kbd> pour supprimer</span>
                                    </div>
                                </Popup>
                            )}
                        </Marker>
                    </React.Fragment>
                );
            })}

            {/* DANGER POIs (Route safety warnings) */}
            {state.show_dangers_on_map && state.routes.map((route: any, routeIdx: number) => {
                if (!route) return null;
                const geojson = route.geojson;
                if (!geojson) return null;
                
                // geojson can be a LineString with .properties directly attached by IGNClient
                const features = geojson.type === 'FeatureCollection' ? geojson.features : (geojson.type === 'Feature' ? [geojson] : [{ type: 'Feature', geometry: geojson, properties: geojson.properties || {} }]);
                if (!features || features.length === 0) return null;
                
                return features.map((feat: any, featIdx: number) => {
                    const pCoords = feat.geometry.coordinates;
                    if (!pCoords || pCoords.length < 2) return null;

                    const dangerIntervals = feat.properties?.danger_intervals || [];
                    const globalDl = feat.properties?.danger_level;

                    // 1. Precise intervals if available
                    if (dangerIntervals.length > 0) {
                        return dangerIntervals.map((di: any, diIdx: number) => {
                            // Filter noise
                            const intervalLength = di.end - di.start;
                            if (intervalLength < 30 && di.level !== 'extreme') return null;

                            // Find the coordinate at the midpoint of the interval
                            const midM = (di.start + di.end) / 2;
                            let currentM = 0;
                            let targetPt = pCoords[0];
                            for (let i = 0; i < pCoords.length - 1; i++) {
                                const d = PolygonalEngine.calculateDistance(pCoords[i], pCoords[i+1]);
                                currentM += d;
                                if (currentM >= midM) {
                                    targetPt = pCoords[i+1];
                                    break;
                                }
                            }

                            let color = '#eab308';
                            let title = "Danger localisé";
                            if (di.level === 'extreme') { color = '#ef4444'; title = "Attention : Voie Rapide / Autoroute"; }
                            else if (di.level === 'motorway_cross') { color = '#ef4444'; title = "Attention : Traversée de Voie Rapide"; }
                            else if (di.level === 'high') { color = '#ea580c'; title = "Prudence : Route Nationale"; }

                            const dangerIcon = L.divIcon({
                                className: 'danger-poi',
                                html: `<div style="color:${color}; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.8));">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}33" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                                </div>`,
                                iconSize: [28, 28], iconAnchor: [14, 14]
                            });

                            return (
                                <Marker key={`danger-${route.id}-${featIdx}-${diIdx}`} position={[targetPt[1], targetPt[0]]} icon={dangerIcon}>
                                    <Popup closeButton={false}>
                                        <div style={{ padding: '10px 12px', minWidth: '160px', fontFamily: 'var(--font-ui)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>{title}</span>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        });
                    }

                    // 2. Fallback to leg-center marker if no precise points
                    if (!globalDl) return null;
                    const mid = pCoords[Math.floor(pCoords.length / 2)];
                    const pt: [number, number] = [mid[1], mid[0]];

                    let color = '#eab308';
                    let title = "Info : Trajet prolongé sur Départementale";
                    if (globalDl === 'extreme') { color = '#ef4444'; title = "Attention : Trajet prolongé sur Autoroute"; }
                    else if (globalDl === 'motorway_cross') { color = '#ef4444'; title = "Attention : Le trajet traverse une autoroute !"; }
                    else if (globalDl === 'high') { color = '#ea580c'; title = "Attention : Trajet prolongé sur Nationale"; }
                    
                    const dangerIcon = L.divIcon({
                        className: 'danger-poi',
                        html: `<div style="color:${color}; display:flex; align-items:center; justify-content:center; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.8));">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="${color}33" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                        </div>`,
                        iconSize: [28, 28], iconAnchor: [14, 14]
                    });

                    return (
                        <Marker key={`danger-leg-${route.id}-${featIdx}`} position={pt} icon={dangerIcon}>
                            <Popup closeButton={false}>
                                <div style={{ padding: '12px 14px', minWidth: '180px', fontFamily: 'var(--font-ui)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>{title}</span>
                                    </div>
                                    <button
                                        onClick={() => dispatch({ type: 'ADD_NOTIFICATION', message: 'Évitement validé.', notifType: 'info' })}
                                        style={{
                                            width: '100%', padding: '6px 0', borderRadius: '6px', border: 'none',
                                            background: `${color}22`, color: color,
                                            fontSize: '11px', fontWeight: 700, cursor: 'pointer'
                                        }}
                                    >
                                        Valider l'évitement
                                    </button>
                                </div>
                            </Popup>
                        </Marker>
                    );
                });
            })}

            {/* ENCODING POPUP (Legacy parity + Live Preview) */}
            {encodingPopupVal && activeTool === 'encodage' && (() => {
                const seg = steps[encodingPopupVal.idx];
                let segDist = 0;
                if (seg && seg.coords) {
                    for (let i = 0; i < seg.coords.length - 1; i++) {
                        segDist += getDistanceMeters(seg.coords[i][1], seg.coords[i][0], seg.coords[i+1][1], seg.coords[i+1][0]);
                    }
                }
                const theme = themeManager.getTheme(state.theme_id);
                // Basic nav text for preview
                const navText = NavigationText.generate(segDist || 100, seg?.azimut || 0, null, theme);

                return (
                    <Popup 
                        position={encodingPopupVal.latlng}
                        eventHandlers={{ remove: () => setEncodingPopupVal(null) }}
                        closeButton={false}
                        className="encoding-map-popup"
                    >
                        <div style={{
                            padding: '12px',
                            width: '290px',
                            fontFamily: 'var(--font-ui)'
                        }}>
                            <div style={{ fontSize: '11px', color: '#999', fontWeight: 600, marginBottom: '8px', padding: '0 4px' }}>
                                ASSIGNER UN MODULE (Tronçon {encodingPopupVal.idx})
                            </div>
                            <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {ALL_MODULE_IDS.map(modId => {
                                    const meta = MODULE_META[modId];
                                    const encodedPreview = ModuleLogic.encode(modId, navText, { key: theme.vigenere_key });
                                    
                                    return (
                                        <button
                                            key={modId}
                                            onClick={() => {
                                                dispatch({ 
                                                    type: 'ASSIGN_MODULES_RANGE', 
                                                    startIdx: encodingPopupVal.idx, 
                                                    endIdx: encodingPopupVal.idx, 
                                                    moduleId: modId 
                                                });
                                                setEncodingPopupVal(null);
                                            }}
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: '4px',
                                                background: 'transparent', border: '1px solid transparent', padding: '6px 8px',
                                                borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'transparent';
                                                e.currentTarget.style.borderColor = 'transparent';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color }} />
                                                <span style={{ color: '#e5e7eb', fontSize: '12px', fontWeight: 600 }}>{meta.label}</span>
                                            </div>
                                            {/* Live Preview Text */}
                                            {modId !== 'carte_ign' && modId !== 'gilwell' && (
                                                <div style={{ 
                                                    fontSize: '10px', 
                                                    color: 'rgba(255,255,255,0.5)', 
                                                    fontFamily: modId === 'morse' ? 'monospace' : 'inherit',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                    paddingLeft: '16px'
                                                }}>
                                                    {encodedPreview.replace(/\n/g, ' ')}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </Popup>
                );
            })()}
        </>
    );
}

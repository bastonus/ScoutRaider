import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Marker, Polygon, Polyline, Tooltip, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { buildAreaDisplayCoords } from '../../AppContext';
import { AreaAnnotation } from '../../logic/types';
import { calculatePolygonArea, formatArea, computeRoutedAreaBoundary } from '../../logic/GeoUtils';
import { backgroundEngine, invalidateRouteCacheForLeg } from '../../logic/BackgroundEngine';
import { IGNClient } from '../../logic/IGNClient';
import { PRESET_COLORS } from './AnnotationModals';
import { Trash2, Trees } from 'lucide-react';

// ── Teardrop marker icon — title embedded in HTML, always visible ─────────────
function createPointIcon(color: string, title: string, isSelected = false) {
    const escaped = (title || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return L.divIcon({
        className: 'annotation-point-marker',
        html: `<div style="position:relative;display:inline-block;pointer-events:none;">
            <div style="
                position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);
                white-space:nowrap;color:#fff;font-size:13px;font-weight:800;
                font-family:Inter,system-ui,sans-serif;letter-spacing:0.02em;
                text-shadow:0 1px 4px rgba(0,0,0,0.98),0 0 12px rgba(0,0,0,0.85),
                    1px 1px 0 rgba(0,0,0,0.9),-1px -1px 0 rgba(0,0,0,0.9),
                    1px -1px 0 rgba(0,0,0,0.9),-1px 1px 0 rgba(0,0,0,0.9);
                pointer-events:none;line-height:1;
            ">${escaped}</div>
            <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg"
                style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.55));cursor:grab;display:block;">
                <path d="M13,1 C7,1 2,6 2,12 C2,20 13,33 13,33 C13,33 24,20 24,12 C24,6 19,1 13,1 Z"
                    fill="${color}" stroke="${isSelected ? '#fff' : 'rgba(255,255,255,0.75)'}"
                    stroke-width="${isSelected ? 2.5 : 1.5}"/>
                <circle cx="13" cy="12" r="${isSelected ? 4 : 3}"
                    fill="${isSelected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)'}"/>
            </svg>
        </div>`,
        iconSize: [26, 34], iconAnchor: [13, 33], popupAnchor: [0, -50]
    });
}

function createVertexIcon(color: string, isFirst = false, isDraft = false) {
    const s = isFirst ? 14 : 11;
    const border = isDraft ? `3px solid ${color}` : `${isFirst ? 3 : 2}px solid ${color}`;
    return L.divIcon({
        className: 'area-vertex-handle',
        html: `<div style="width:${s}px;height:${s}px;border-radius:50%;background:#fff;border:${border};box-shadow:0 1px 6px rgba(0,0,0,0.65);cursor:move;"></div>`,
        iconSize: [s, s], iconAnchor: [s / 2, s / 2]
    });
}

// ── BRouter edge request for area annotations ─────────────────────────────────
// legKey format: "area-edge-{areaId}-{edgeIdx}"
// Results are handled in AppContext BackgroundEngine listener.
function enqueueAreaEdge(areaId: string, edgeIdx: number, p1: [number, number], p2: [number, number]) {
    const legKey = `area-edge-${areaId}-${edgeIdx}`;
    invalidateRouteCacheForLeg(p1, p2, 'pedestrian');
    backgroundEngine.enqueue('route_leg', 0, legKey, {
        p1, p2,
        profile: 'pedestrian',
        small_roads: false,
        legKey,
    }, legKey); // dedupKey = legKey → new drag cancels the pending one
}

export default function AnnotationsMapLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const activeTool = state.active_tool;

    // ── Selection ─────────────────────────────────────────────────────────────
    const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

    // ── Point hover / geocode cache ───────────────────────────────────────────
    const [hoveringPointId, setHoveringPointId] = useState<string | null>(null);
    const addressCache = useRef<Record<string, string>>({});

    // ── Live vertex drag (60fps preview) ─────────────────────────────────────
    const [liveDragVertex, setLiveDragVertex] = useState<{ areaId: string; vertexIdx: number; coords: [number, number] } | null>(null);

    // ── AREA DRAWING state (pure local → auto-committed per click) ────────────
    const [draftCoords, setDraftCoords] = useState<[number, number][]>([]);
    const draftCoordsRef = useRef<[number, number][]>([]);
    // draftEdgeRoutes mirrors store edgeRoutes for the in-progress area
    const [draftEdgeRoutes, setDraftEdgeRoutes] = useState<([number, number][] | null)[]>([]);
    const draftEdgeRoutesRef = useRef<([number, number][] | null)[]>([]);
    const [draftAreaId, setDraftAreaId] = useState<string | null>(null);
    const draftAreaIdRef = useRef<string | null>(null);
    const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);
    const ignoreNextClick = useRef(false);

    const isDrawingArea = activeTool === 'annotate_area' || activeTool === 'annotate_area_routed';

    // Sync draftEdgeRoutes from store (BackgroundEngine populates them via AppContext listener)
    useEffect(() => {
        if (!draftAreaIdRef.current) return;
        const area = state.area_annotations?.find(a => a.id === draftAreaIdRef.current);
        if (area?.edgeRoutes) {
            draftEdgeRoutesRef.current = area.edgeRoutes;
            setDraftEdgeRoutes([...area.edgeRoutes]);
        }
    }, [state.area_annotations]);

    // Auto-cancel when tool switches away externally
    useEffect(() => {
        if (!isDrawingArea && draftAreaIdRef.current) {
            draftCoordsRef.current = [];
            draftEdgeRoutesRef.current = [];
            draftAreaIdRef.current = null;
            setDraftCoords([]);
            setDraftEdgeRoutes([]);
            setDraftAreaId(null);
            setCursorPos(null);
        }
    }, [isDrawingArea]);

    // ── Reset draft ───────────────────────────────────────────────────────────
    const resetDraft = useCallback(() => {
        draftCoordsRef.current = [];
        draftEdgeRoutesRef.current = [];
        draftAreaIdRef.current = null;
        setDraftCoords([]);
        setDraftEdgeRoutes([]);
        setDraftAreaId(null);
        setCursorPos(null);
    }, []);

    // ── Finish drawing ────────────────────────────────────────────────────────
    const finishDrawing = useCallback((toolOverride?: string) => {
        const coords = draftCoordsRef.current;
        const id = draftAreaIdRef.current;
        const tool = toolOverride ?? activeTool;

        if (!id) return;

        if (coords.length < 3) {
            dispatch({ type: 'REMOVE_AREA_ANNOTATION', id });
            resetDraft();
            return;
        }

        // For routed tool: request the closing edge (last → first)
        if (tool === 'annotate_area_routed' && coords.length >= 3) {
            const n = coords.length;
            enqueueAreaEdge(id, n - 1, coords[n - 1], coords[0]);
        }

        const displayCoords = buildAreaDisplayCoords(coords, draftEdgeRoutesRef.current);
        const m2 = calculatePolygonArea(displayCoords.length >= 3 ? displayCoords : coords);
        dispatch({
            type: 'UPDATE_AREA_ANNOTATION', id,
            patch: { coords, area_m2: m2, formatted_area: formatArea(m2) }
        });

        resetDraft();
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
    }, [activeTool, dispatch, resetDraft]);

    // ── Cancel drawing ────────────────────────────────────────────────────────
    const cancelDrawing = useCallback(() => {
        const id = draftAreaIdRef.current;
        if (id) {
            backgroundEngine.clearByType('route_leg'); // cancel pending edge requests
            dispatch({ type: 'REMOVE_AREA_ANNOTATION', id });
        }
        resetDraft();
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
    }, [dispatch, resetDraft]);

    // ── Toggle road-follow on existing area ───────────────────────────────────
    const handleToggleRoadFollow = useCallback(async (area: AreaAnnotation) => {
        const newFollow = !area.followRoads;
        if (!newFollow) {
            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { followRoads: false, edgeRoutes: undefined, routedCoords: undefined } });
            return;
        }
        // Request all edges via BackgroundEngine
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul des arêtes...' });
        const n = area.coords.length;
        const newEdgeRoutes: ([number, number][] | null)[] = Array(n).fill(null);
        dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { followRoads: true, edgeRoutes: newEdgeRoutes } });
        for (let i = 0; i < n; i++) {
            enqueueAreaEdge(area.id, i, area.coords[i], area.coords[(i + 1) % n]);
        }
    }, [dispatch]);

    // Filter visible
    const layersMap = new Map((state.annotation_layers || []).map(l => [l.id, l.visible]));
    const visiblePoints = (state.point_annotations || []).filter(p => {
        const lv = layersMap.has(p.layerId) ? layersMap.get(p.layerId) : true;
        return lv && p.visible;
    });
    const visibleAreas = (state.area_annotations || []).filter(a => {
        if (a.id === draftAreaId) return false; // rendered via local preview
        const lv = layersMap.has(a.layerId) ? layersMap.get(a.layerId) : true;
        return lv && a.visible;
    });

    // ── Map events ────────────────────────────────────────────────────────────
    useMapEvents({
        mousemove(e) {
            if (isDrawingArea) setCursorPos([e.latlng.lat, e.latlng.lng]);
        },

        click(e) {
            if ((window as any).__markerDragging) return;
            if (ignoreNextClick.current) { ignoreNextClick.current = false; return; }

            if (activeTool === 'annotate_point') {
                const ptCount = (state.point_annotations?.length || 0) + 1;
                const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
                dispatch({
                    type: 'ADD_POINT_ANNOTATION',
                    point: { type: 'point' as const, title: `Repère ${ptCount}`, text: '', coords, color: '#3b82f6', icon: 'pin' as const, layerId: 'layer-points', visible: true }
                });

            } else if (activeTool === 'annotate_area' || activeTool === 'annotate_area_routed') {
                const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
                const prevCoords = draftCoordsRef.current;
                const newCoords: [number, number][] = [...prevCoords, pt];
                draftCoordsRef.current = newCoords;
                setDraftCoords([...newCoords]);

                if (!draftAreaIdRef.current) {
                    // First click — create area in store
                    const newId = `area-annot-${Date.now()}`;
                    draftAreaIdRef.current = newId;
                    setDraftAreaId(newId);
                    const areaCount = (state.area_annotations?.length || 0) + 1;
                    dispatch({
                        type: 'ADD_AREA_ANNOTATION',
                        area: {
                            id: newId, type: 'area' as const,
                            title: `Zone ${areaCount}`, text: '',
                            layerId: 'layer-areas', coords: [pt],
                            color: '#5b6af0', fillOpacity: 0.3,
                            visible: true, followRoads: activeTool === 'annotate_area_routed',
                            edgeRoutes: [],
                        } as any
                    });
                } else {
                    // Subsequent clicks
                    const id = draftAreaIdRef.current;
                    const edgeIdx = prevCoords.length - 1; // edge from prevCoords[last] → pt

                    // For routed tool: enqueue BRouter for the new edge
                    if (activeTool === 'annotate_area_routed' && prevCoords.length >= 1) {
                        enqueueAreaEdge(id, edgeIdx, prevCoords[prevCoords.length - 1], pt);
                    }

                    const m2 = newCoords.length >= 3 ? calculatePolygonArea(newCoords) : 0;
                    dispatch({
                        type: 'UPDATE_AREA_ANNOTATION', id,
                        patch: { coords: newCoords, area_m2: m2, formatted_area: newCoords.length >= 3 ? formatArea(m2) : '' }
                    });
                }

            } else {
                setSelectedAreaId(null);
                setSelectedPointId(null);
            }
        },

        dblclick(e) {
            if ((activeTool === 'annotate_area' || activeTool === 'annotate_area_routed') && draftAreaIdRef.current) {
                ignoreNextClick.current = true;
                const before = draftCoordsRef.current;
                const trimmed = before.length > 3 ? before.slice(0, -1) : before;
                draftCoordsRef.current = trimmed;
                setDraftCoords([...trimmed]);
                finishDrawing(activeTool);
                L.DomEvent.stopPropagation(e as any);
            }
        },

        keydown(e: any) {
            if (activeTool === 'annotate_area' || activeTool === 'annotate_area_routed') {
                if (e.originalEvent?.key === 'Escape') cancelDrawing();
                if (e.originalEvent?.key === 'Enter') finishDrawing(activeTool);
            }
        }
    });

    // ── Vertex drag on finalized areas ────────────────────────────────────────
    const handleVertexDrag = (areaId: string, vIdx: number, e: any) => {
        const ll = e.target.getLatLng();
        setLiveDragVertex({ areaId, vertexIdx: vIdx, coords: [ll.lat, ll.lng] });
    };

    const handleVertexDragEnd = (areaId: string, vIdx: number, e: any) => {
        const ll = e.target.getLatLng();
        const area = state.area_annotations.find(a => a.id === areaId);
        setLiveDragVertex(null);
        if (!area) return;

        const nc = [...area.coords] as [number, number][];
        nc[vIdx] = [ll.lat, ll.lng];
        const n = nc.length;

        // Reset edge routes for the two adjacent edges
        const newEdgeRoutes = area.edgeRoutes ? [...area.edgeRoutes] : Array(n).fill(null);
        const prevIdx = (vIdx - 1 + n) % n;
        newEdgeRoutes[prevIdx] = null; // edge from prev vertex → moved vertex
        newEdgeRoutes[vIdx] = null;    // edge from moved vertex → next vertex

        const displayPoly = buildAreaDisplayCoords(nc, newEdgeRoutes);
        const m2 = calculatePolygonArea(displayPoly.length >= 3 ? displayPoly : nc);
        dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: areaId, patch: { coords: nc, edgeRoutes: newEdgeRoutes, area_m2: m2, formatted_area: formatArea(m2) } });

        // Re-route the two adjacent edges (if area uses road-following)
        if (area.followRoads) {
            enqueueAreaEdge(areaId, prevIdx, nc[prevIdx], nc[vIdx]);
            enqueueAreaEdge(areaId, vIdx, nc[vIdx], nc[(vIdx + 1) % n]);
        }

        setTimeout(() => { (window as any).__markerDragging = false; }, 100);
    };

    // ── Toggle individual edge: BRouter ↔ straight ───────────────────────────
    const handleToggleEdge = useCallback((area: AreaAnnotation, edgeIdx: number) => {
        const n = area.coords.length;
        const newEdgeRoutes: ([number, number][] | null)[] = area.edgeRoutes
            ? [...area.edgeRoutes]
            : Array(n).fill(null);
        // Ensure array is the right length
        while (newEdgeRoutes.length < n) newEdgeRoutes.push(null);

        const isCurrentlyRouted = !!(newEdgeRoutes[edgeIdx] && newEdgeRoutes[edgeIdx]!.length >= 2);

        if (isCurrentlyRouted) {
            // Switch to straight
            newEdgeRoutes[edgeIdx] = null;
            const dp = buildAreaDisplayCoords(area.coords, newEdgeRoutes);
            const m2 = calculatePolygonArea(dp.length >= 3 ? dp : area.coords);
            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { edgeRoutes: newEdgeRoutes, area_m2: m2, formatted_area: formatArea(m2) } });
        } else {
            // Switch to BRouter — enqueue and mark pending (null = will be filled by engine)
            newEdgeRoutes[edgeIdx] = null;
            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { edgeRoutes: newEdgeRoutes } });
            enqueueAreaEdge(area.id, edgeIdx, area.coords[edgeIdx], area.coords[(edgeIdx + 1) % n]);
        }
    }, [dispatch]);

    // ── Draft display polygon (combines local coords + BRouter edges from store) ─
    const draftDisplayCoords = buildAreaDisplayCoords(draftCoords, draftEdgeRoutes);

    return (
        <>
            {/* ── 1. POINT ANNOTATIONS ──────────────────────────────────────── */}
            {visiblePoints.map(point => {
                const isSelected = selectedPointId === point.id;
                return (
                    <Marker
                        key={point.id}
                        position={point.coords}
                        icon={createPointIcon(point.color || '#3b82f6', point.title || '', isSelected)}
                        draggable={true}
                        eventHandlers={{
                            dragstart: () => { (window as any).__markerDragging = true; },
                            dragend: (e: any) => {
                                const p = e.target.getLatLng();
                                dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: point.id, patch: { coords: [p.lat, p.lng] } });
                                delete addressCache.current[point.id];
                                setTimeout(() => { (window as any).__markerDragging = false; }, 100);
                            },
                            click: () => setSelectedPointId(point.id === selectedPointId ? null : point.id),
                            mouseover: async () => {
                                setHoveringPointId(point.id);
                                if (!addressCache.current[point.id]) {
                                    const addr = await IGNClient.reverseGeocode(point.coords[0], point.coords[1]);
                                    addressCache.current[point.id] = addr;
                                    setHoveringPointId(id => id);
                                }
                            },
                            mouseout: () => setHoveringPointId(null),
                            contextmenu: (e: any) => {
                                L.DomEvent.stopPropagation(e);
                                dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: point.id });
                            }
                        }}
                    >
                        {/* Hover card — description + address (shown on hover only) */}
                        {hoveringPointId === point.id && (point.text || addressCache.current[point.id]) && (
                            <Tooltip permanent direction="top" offset={[0, -60]} className="sr-map-label-point-hover">
                                {point.text && (
                                    <div style={{ marginBottom: '4px', fontSize: '11px', color: '#e2e8f0', maxWidth: '200px', whiteSpace: 'normal', lineHeight: 1.4 }}>
                                        {point.text}
                                    </div>
                                )}
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                                    {addressCache.current[point.id] || `${point.coords[0].toFixed(5)}, ${point.coords[1].toFixed(5)}`}
                                </div>
                            </Tooltip>
                        )}

                        {/* Edit popup */}
                        <Popup className="sr-annotation-popup" autoPanPadding={[40, 40]}>
                            <div style={{ minWidth: '210px', padding: '10px', background: '#141e17', borderRadius: '10px', border: `1px solid ${point.color || '#3b82f6'}55`, color: '#e8f0eb' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: point.color || '#3b82f6', flexShrink: 0 }} />
                                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#fff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{point.title}</span>
                                </div>
                                <input type="text" value={point.title}
                                    onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: point.id, patch: { title: e.target.value } })}
                                    placeholder="Nom du repère..."
                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontWeight: 600, fontSize: '11px', outline: 'none', marginBottom: '8px' }}
                                />
                                <textarea rows={2} value={point.text || ''}
                                    onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: point.id, patch: { text: e.target.value } })}
                                    placeholder="Notes..."
                                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px', color: '#cbd5e1', fontSize: '11px', outline: 'none', resize: 'vertical', marginBottom: '8px' }}
                                />
                                <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                                    {PRESET_COLORS.map(c => (
                                        <div key={c.value} title={c.label}
                                            onClick={() => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: point.id, patch: { color: c.value } })}
                                            style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.value, cursor: 'pointer', boxShadow: point.color === c.value ? '0 0 0 2px #fff' : 'none' }}
                                        />
                                    ))}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
                                    <span>Glisser · Clic droit = supprimer</span>
                                    <button type="button" onClick={() => dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: point.id })}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                                        <Trash2 size={11} />
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            {/* ── 2. DRAFT POLYGON PREVIEW ──────────────────────────────────── */}
            {isDrawingArea && draftCoords.length > 0 && (
                <>
                    {/* Closed polygon preview */}
                    {draftDisplayCoords.length >= 3 && (
                        <Polygon
                            positions={draftDisplayCoords}
                            pathOptions={{ color: '#5b6af0', fillColor: '#5b6af0', fillOpacity: 0.2, weight: 2, dashArray: '6 4' }}
                            interactive={false}
                        />
                    )}
                    {/* Open polyline when < 3 control points */}
                    {draftCoords.length >= 2 && draftDisplayCoords.length < 3 && (
                        <Polyline
                            positions={draftDisplayCoords}
                            pathOptions={{ color: '#5b6af0', weight: 2, dashArray: '6 4' }}
                            interactive={false}
                        />
                    )}
                    {/* Rubber-band to cursor */}
                    {cursorPos && draftCoords.length > 0 && (
                        <Polyline
                            positions={[draftCoords[draftCoords.length - 1], cursorPos]}
                            pathOptions={{ color: '#5b6af0', weight: 2, dashArray: '4 4', opacity: 0.6 }}
                            interactive={false}
                        />
                    )}
                    {/* Draft vertex dots — tooltip hint on hover */}
                    {draftCoords.map((v, i) => (
                        <Marker
                            key={`draft-v-${i}`}
                            position={v}
                            icon={createVertexIcon('#5b6af0', i === 0, true)}
                            interactive={true}
                        >
                            <Tooltip direction="top" offset={[0, -8]}>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)' }}>
                                    {i === 0
                                        ? <span>S1 — <b>Double-clic</b> pour fermer · Échap pour annuler</span>
                                        : <span>S{i + 1}{draftCoords.length >= 3 && i === draftCoords.length - 1 ? ' — Double-clic pour terminer' : ''}</span>
                                    }
                                    {activeTool === 'annotate_area_routed' && i > 0 && draftEdgeRoutes[i - 1] && (
                                        <span style={{ color: '#10b981', marginLeft: '4px' }}>⛰ routé</span>
                                    )}
                                </div>
                            </Tooltip>
                        </Marker>
                    ))}
                </>
            )}

            {/* ── 3. FINALIZED AREAS (from store, draft excluded) ───────────── */}
            {visibleAreas.map(area => {
                const isSelected = selectedAreaId === area.id;

                // Build display coords: use edgeRoutes if available, else straight
                let displayCoords = buildAreaDisplayCoords(area.coords, area.edgeRoutes);

                // Live drag preview overrides the moved vertex and clears adjacent routed edges
                if (liveDragVertex && liveDragVertex.areaId === area.id) {
                    const nc = [...area.coords] as [number, number][];
                    nc[liveDragVertex.vertexIdx] = liveDragVertex.coords;
                    const n = nc.length;
                    const tempEdges = area.edgeRoutes ? [...area.edgeRoutes] : Array(n).fill(null);
                    tempEdges[(liveDragVertex.vertexIdx - 1 + n) % n] = null;
                    tempEdges[liveDragVertex.vertexIdx] = null;
                    displayCoords = buildAreaDisplayCoords(nc, tempEdges);
                }

                const isComplete = displayCoords.length >= 3;
                const liveM2 = isComplete ? calculatePolygonArea(displayCoords) : 0;
                const formatted = isComplete ? (area.formatted_area || formatArea(liveM2)) : '';
                const hasRouted = area.edgeRoutes?.some(e => e && e.length > 0);
                const n = area.coords.length;

                return (
                    <React.Fragment key={area.id}>

                        {/* ── Fill polygon (non-interactive when selected: clicks go to edges) ── */}
                        {isComplete ? (
                            <Polygon
                                positions={displayCoords}
                                pathOptions={{
                                    color: isSelected ? 'transparent' : (area.color || '#5b6af0'),
                                    fillColor: area.color || '#5b6af0',
                                    fillOpacity: isSelected ? 0.18 : (area.fillOpacity ?? 0.22),
                                    weight: isSelected ? 0 : 2,
                                }}
                                eventHandlers={{
                                    click: (e: any) => {
                                        if (isSelected) return; // clicks go to edge polylines when selected
                                        L.DomEvent.stopPropagation(e);
                                        setSelectedAreaId(area.id);
                                    }
                                }}
                            >
                                {!isSelected && (
                                    <Tooltip permanent sticky direction="center" className="sr-map-label-area">
                                        <span style={{ color: area.color || '#5b6af0' }}>{area.title}</span>
                                        {' '}<span style={{ opacity: 0.75 }}>({formatted})</span>
                                        {hasRouted && <span style={{ marginLeft: '4px', color: '#10b981' }}>⛰</span>}
                                    </Tooltip>
                                )}
                            </Polygon>
                        ) : (
                            <Polyline
                                positions={displayCoords}
                                pathOptions={{ color: area.color || '#5b6af0', weight: 2, dashArray: '6 4' }}
                                eventHandlers={{ click: () => setSelectedAreaId(area.id) }}
                            />
                        )}

                        {/* ── Per-edge interactive polylines (selected only) ──────────── */}
                        {isSelected && isComplete && area.coords.map((_, eIdx) => {
                            const nextIdx = (eIdx + 1) % n;
                            const edgeRoute = area.edgeRoutes?.[eIdx];
                            const isRouted = !!(edgeRoute && edgeRoute.length >= 2);
                            // Visible path: use routed if available, else straight from control points
                            const visiblePts: [number,number][] = isRouted
                                ? edgeRoute!
                                : [area.coords[eIdx], area.coords[nextIdx]];
                            // Live drag correction
                            const edgePts: [number,number][] = (liveDragVertex && liveDragVertex.areaId === area.id)
                                ? (() => {
                                    const nc = [...area.coords] as [number,number][];
                                    nc[liveDragVertex.vertexIdx] = liveDragVertex.coords;
                                    const tempEdges = area.edgeRoutes ? [...area.edgeRoutes] : Array(n).fill(null);
                                    const pIdx = (liveDragVertex.vertexIdx - 1 + n) % n;
                                    tempEdges[pIdx] = null;
                                    tempEdges[liveDragVertex.vertexIdx] = null;
                                    if (eIdx === pIdx || eIdx === liveDragVertex.vertexIdx) {
                                        return [nc[eIdx], nc[nextIdx]];
                                    }
                                    return visiblePts;
                                  })()
                                : visiblePts;

                            return (
                                <Polyline
                                    key={`edge-${area.id}-${eIdx}`}
                                    positions={edgePts}
                                    pathOptions={{
                                        color: isRouted ? '#10b981' : (area.color || '#5b6af0'),
                                        weight: 3,
                                        dashArray: isRouted ? undefined : '6 4',
                                        opacity: 0.9,
                                    }}
                                    eventHandlers={{
                                        click: (e: any) => {
                                            L.DomEvent.stopPropagation(e);
                                            handleToggleEdge(area, eIdx);
                                        },
                                        mouseover: (e: any) => { e.target.setStyle({ weight: 5, opacity: 1 }); },
                                        mouseout:  (e: any) => { e.target.setStyle({ weight: 3, opacity: 0.9 }); },
                                    }}
                                >
                                    <Tooltip sticky direction="top">
                                        <div style={{ fontSize: '10px' }}>
                                            {isRouted
                                                ? <><span style={{ color: '#10b981' }}>⛰ BRouter</span> — <span style={{ color: 'rgba(255,255,255,0.5)' }}>clic → trait droit</span></>
                                                : <>— Droit — <span style={{ color: '#10b981' }}>clic → router</span></>
                                            }
                                        </div>
                                    </Tooltip>
                                </Polyline>
                            );
                        })}

                        {/* ── Draggable vertex handles (selected only) ─────────────────── */}
                        {isSelected && area.coords.map((vertex, vIdx) => {
                            const pos = liveDragVertex && liveDragVertex.areaId === area.id && liveDragVertex.vertexIdx === vIdx
                                ? liveDragVertex.coords : vertex;
                            return (
                                <Marker
                                    key={`vertex-${area.id}-${vIdx}`}
                                    position={pos}
                                    icon={createVertexIcon(area.color || '#5b6af0', vIdx === 0)}
                                    draggable={true}
                                    eventHandlers={{
                                        dragstart: () => { (window as any).__markerDragging = true; },
                                        drag:    (e: any) => handleVertexDrag(area.id, vIdx, e),
                                        dragend: (e: any) => handleVertexDragEnd(area.id, vIdx, e),
                                    }}
                                >
                                    <Tooltip direction="top" offset={[0, -8]}>
                                        <div style={{ fontSize: '10px' }}>
                                            <b>S{vIdx + 1}</b> — glisser pour déformer
                                        </div>
                                    </Tooltip>
                                </Marker>
                            );
                        })}

                        {/* ── Label (selected state) + Edit popup ──────────────────────── */}
                        {isSelected && isComplete && (
                            <Polygon
                                positions={displayCoords}
                                pathOptions={{ color: 'transparent', fillOpacity: 0, weight: 0 }}
                                eventHandlers={{ click: (e: any) => { L.DomEvent.stopPropagation(e); } }}
                            >
                                <Tooltip permanent sticky direction="center" className="sr-map-label-area">
                                    <span style={{ color: area.color || '#5b6af0' }}>{area.title}</span>
                                    {' '}<span style={{ opacity: 0.75 }}>({formatted})</span>
                                    {hasRouted && <span style={{ marginLeft: '4px', color: '#10b981' }}>⛰</span>}
                                </Tooltip>
                                <Popup className="sr-annotation-popup">
                                    <div style={{ minWidth: '220px', padding: '10px', background: '#141e17', borderRadius: '10px', border: `1px solid ${area.color || '#5b6af0'}55`, color: '#e8f0eb' }}>
                                        <input type="text" value={area.title}
                                            onChange={e => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { title: e.target.value } })}
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontWeight: 700, fontSize: '12px', outline: 'none', marginBottom: '6px' }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6ee7b7', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '5px', marginBottom: '8px' }}>
                                            <span>Superficie</span>
                                            <span>{formatted}</span>
                                        </div>
                                        <div style={{ marginBottom: '8px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
                                            Cliquer une arête pour basculer BRouter ↔ droit
                                        </div>
                                        <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                                            {PRESET_COLORS.map(c => (
                                                <div key={c.value} onClick={() => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { color: c.value } })}
                                                    style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.value, cursor: 'pointer', boxShadow: area.color === c.value ? '0 0 0 2px #fff' : 'none' }}
                                                />
                                            ))}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
                                            <button type="button" onClick={() => { dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id }); setSelectedAreaId(null); }}
                                                style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                                                <Trash2 size={11} /> Supprimer la zone
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </Polygon>
                        )}
                    </React.Fragment>
                );
            })}
        </>
    );
}

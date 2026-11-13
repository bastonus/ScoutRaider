import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Marker, Polygon, Polyline, Tooltip, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { buildAreaDisplayCoords } from '../../AppContext';
import { AreaAnnotation, PointAnnotation } from '../../logic/types';
import { calculatePolygonArea, formatArea } from '../../logic/GeoUtils';
import { backgroundEngine, invalidateRouteCacheForLeg } from '../../logic/BackgroundEngine';
import { IGNClient } from '../../logic/IGNClient';
import { PRESET_COLORS } from './AnnotationModals';
import { Trash2 } from 'lucide-react';
import { layerPaneName } from '../../logic/LayerOrder';

// ── Icons ─────────────────────────────────────────────────────────────────────
function createPointIcon(color: string, title: string, isSelected = false, pointId = '', lat = 0, lng = 0) {
    const escaped = (title || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const idAttr = pointId
        ? ` data-sr-point-id="${pointId.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`
        : '';
    const anchorAttr = ` data-sr-anchor-lat="${lat}" data-sr-anchor-lng="${lng}"`;
    return L.divIcon({
        className: 'annotation-point-marker',
        html: `<div${idAttr}${anchorAttr} style="position:relative;display:inline-block;pointer-events:all;">
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
                style="filter:drop-shadow(0 2px 5px rgba(0,0,0,0.55));cursor:grab;display:block;pointer-events:all;">
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

// ── BRouter ───────────────────────────────────────────────────────────────────
function enqueueAreaEdge(areaId: string, edgeIdx: number, p1: [number, number], p2: [number, number]) {
    const legKey = `area-edge-${areaId}-${edgeIdx}`;
    invalidateRouteCacheForLeg(p1, p2, 'pedestrian');
    backgroundEngine.enqueue('route_leg', 0, legKey, { p1, p2, profile: 'pedestrian', small_roads: false, legKey }, legKey);
}

// ── Area popup ────────────────────────────────────────────────────────────────
function AreaPopupContent({ area, formatted, dispatch, onDelete }: {
    area: AreaAnnotation; formatted: string;
    dispatch: (a: any) => void; onDelete: () => void;
}) {
    return (
        <div style={{ minWidth: '220px', padding: '10px', background: '#141e17', borderRadius: '10px', border: `1px solid ${area.color || '#5b6af0'}55`, color: '#e8f0eb' }}>
            <input type="text" value={area.title}
                onChange={e => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { title: e.target.value } })}
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', color: '#fff', fontWeight: 700, fontSize: '12px', outline: 'none', marginBottom: '6px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6ee7b7', fontWeight: 700, background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '5px', marginBottom: '8px' }}>
                <span>Superficie</span><span>{formatted}</span>
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
                <button type="button" onClick={onDelete}
                    style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                    <Trash2 size={11} /> Supprimer la zone
                </button>
            </div>
        </div>
    );
}

// ── Memoized Vertex Marker (isolated to avoid unbinding listeners mid-drag) ───
interface VertexMarkerProps {
    areaId: string;
    vIdx: number;
    position: [number, number];
    color: string;
    isFirst: boolean;
    isDrawing: boolean;
    totalVertices: number;
    onDrag: (areaId: string, vIdx: number, lat: number, lng: number) => void;
    onDragEnd: (areaId: string, vIdx: number, lat: number, lng: number) => void;
}

const VertexMarker = React.memo(function VertexMarker({
    areaId, vIdx, position, color, isFirst, isDrawing, totalVertices, onDrag, onDragEnd
}: VertexMarkerProps) {
    const markerRef = useRef<any>(null);

    useEffect(() => {
        if (!markerRef.current) return;
        const m = markerRef.current._marker || markerRef.current;
        m.dragging?.enable();
    }, []);

    const icon = useMemo(() => {
        const s = isFirst ? 16 : 14;
        const border = isDrawing ? `2px dashed ${color}` : `${isFirst ? 3 : 2}px solid ${color}`;
        return L.divIcon({
            className: 'area-vertex-handle',
            html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:grab;pointer-events:all;">
                <div style="width:${s}px;height:${s}px;border-radius:50%;background:#ffffff;border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.7);"></div>
            </div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    }, [color, isFirst, isDrawing]);

    const handleDragStart = useCallback(() => {
        (window as any).__markerDragging = true;
        if (markerRef.current?.dragging) markerRef.current.dragging.enable();
    }, []);

    const handleDrag = useCallback((e: any) => {
        const ll = e.target.getLatLng();
        onDrag(areaId, vIdx, ll.lat, ll.lng);
    }, [areaId, vIdx, onDrag]);

    const handleDragEnd = useCallback((e: any) => {
        const ll = e.target.getLatLng();
        onDragEnd(areaId, vIdx, ll.lat, ll.lng);
        setTimeout(() => { (window as any).__markerDragging = false; }, 100);
    }, [areaId, vIdx, onDragEnd]);

    const eventHandlers = useMemo(() => ({
        dragstart: handleDragStart,
        drag: handleDrag,
        dragend: handleDragEnd,
        // Ne pas stopper la propagation : le clic doit remonter à la map
        // pour permettre la fermeture du polygone (clic sur le premier sommet).
        click: (e: any) => { /* laisser remonter à la map */ },
    }), [handleDragStart, handleDrag, handleDragEnd]);

    return (
        <Marker
            ref={(ref: any) => { markerRef.current = ref; }}
            position={position}
            icon={icon}
            draggable={true}
            bubblingMouseEvents={true}
            zIndexOffset={3000}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -12]}>
                <span style={{ fontSize: '10px' }}>
                    <b>S{vIdx + 1}</b>
                    {isDrawing && vIdx === 0 && totalVertices >= 3 ? ' — clic pour fermer' : ' — glisser pour déplacer'}
                </span>
            </Tooltip>
        </Marker>
    );
});

// ── Memoized Point Marker ─────────────────────────────────────────────────────
interface PointMarkerProps {
    point: PointAnnotation;
    isSelected: boolean;
    /** True while an area tool (annotate_area / annotate_area_routed) is active. */
    areaMode: boolean;
    activeTool: string;
    onSelect: (id: string) => void;
    onDragEnd: (id: string, lat: number, lng: number) => void;
    onDelete: (id: string) => void;
    dispatch: (a: any) => void;
}

const PointAnnotationMarker = React.memo(function PointAnnotationMarker({
    point, isSelected, areaMode, activeTool, onSelect, onDragEnd, onDelete, dispatch
}: PointMarkerProps) {
    const markerRef = useRef<any>(null);
    const [hovering, setHovering] = useState(false);
    const [address, setAddress] = useState<string>('');

    useEffect(() => {
        if (!markerRef.current) return;
        const m = markerRef.current._marker || markerRef.current;
        m.dragging?.enable();
    }, []);

    const icon = useMemo(() => {
        return createPointIcon(point.color || '#3b82f6', point.title || '', isSelected, point.id, point.coords[0], point.coords[1]);
    }, [point.color, point.title, isSelected]);

    const handleDragStart = useCallback(() => {
        (window as any).__markerDragging = true;
        if (markerRef.current?.dragging) markerRef.current.dragging.enable();
    }, []);

    const handleDragEnd = useCallback((e: any) => {
        const p = e.target.getLatLng();
        onDragEnd(point.id, p.lat, p.lng);
        setTimeout(() => { (window as any).__markerDragging = false; }, 100);
    }, [point.id, onDragEnd]);

    const handleClick = useCallback((e: any) => {
        // If route or area tool is active, clicking a repère must let the click bubble
        // so the map handler snaps the new stage or polygon vertex to the repère's exact coordinates.
        if (activeTool === 'route' || activeTool === 'route_direct' || areaMode) return;
        L.DomEvent.stopPropagation(e);
        onSelect(point.id);
    }, [point.id, onSelect, areaMode, activeTool]);

    const handleContextMenu = useCallback((e: any) => {
        L.DomEvent.stopPropagation(e);
        onDelete(point.id);
    }, [point.id, onDelete]);

    const eventHandlers = useMemo(() => ({
        dragstart: handleDragStart,
        dragend: handleDragEnd,
        click: handleClick,
        contextmenu: handleContextMenu,
        mouseover: async () => {
            setHovering(true);
            if (!address) {
                const addr = await IGNClient.reverseGeocode(point.coords[0], point.coords[1]);
                setAddress(addr);
            }
        },
        mouseout: () => setHovering(false),
    }), [handleDragStart, handleDragEnd, handleClick, handleContextMenu, address, point.coords, areaMode, activeTool]);

    return (
        <Marker
            ref={(ref: any) => { markerRef.current = ref; }}
            position={point.coords}
            icon={icon}
            draggable={true}
            zIndexOffset={2000}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -42]} className="sr-map-label-point-hover">
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', padding: '2px 4px' }}>
                    <div style={{ fontWeight: 800, color: point.color || '#3b82f6', marginBottom: '2px' }}>{point.title}</div>
                    {point.text && <div style={{ fontSize: '10px', color: '#e2e8f0', maxWidth: '200px', whiteSpace: 'normal', lineHeight: 1.3, marginBottom: '2px' }}>{point.text}</div>}
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginBottom: '4px' }}>
                        {address || `${point.coords[0].toFixed(5)}, ${point.coords[1].toFixed(5)}`}
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '3px' }}>
                        {activeTool === 'route' || activeTool === 'route_direct' ? (
                            <span style={{ color: '#6ee7b7' }}>Clic : relier l'itinéraire à ce repère</span>
                        ) : areaMode ? (
                            <span style={{ color: '#6ee7b7' }}>Clic : ancrer le sommet de la zone</span>
                        ) : (
                            <span>Clic : éditer · Glisser : déplacer · Clic droit : supprimer</span>
                        )}
                    </div>
                </div>
            </Tooltip>
            <Popup className="sr-annotation-popup" autoPanPadding={[40, 40]}>
                <div style={{ minWidth: '210px', padding: '10px', background: '#141e17', borderRadius: '10px', border: `1px solid ${point.color || '#3b82f6'}55`, color: '#e8f0eb' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: point.color || '#3b82f6' }} />
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
                        <button type="button" onClick={() => onDelete(point.id)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                            <Trash2 size={11} />
                        </button>
                    </div>
                </div>
            </Popup>
        </Marker>
    );
});

// ── Component ─────────────────────────────────────────────────────────────────
export default function AnnotationsMapLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const activeTool = state.active_tool;
    const isAreaTool = activeTool === 'annotate_area' || activeTool === 'annotate_area_routed';

    // ── Global selection shared across all components ─────────────────────────
    const selectedId = state.selected_layer_id;
    const setSelectedId = useCallback((id: string | null) => {
        dispatch({ type: 'SET_SELECTED_LAYER', id });
    }, [dispatch]);

    // ── Leaflet Polygon references for imperative 60fps drag updates ──────────
    const polygonRefs = useRef<Record<string, any>>({});
    const areaAnnotationsRef = useRef(state.area_annotations);
    useEffect(() => { areaAnnotationsRef.current = state.area_annotations; }, [state.area_annotations]);

    // ── Active drawing area ───────────────────────────────────────────────────
    const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
    const activeDrawingIdRef = useRef<string | null>(null);
    const [cursorPos, setCursorPos] = useState<[number, number] | null>(null);

    // Stop active drawing when leaving area tool
    useEffect(() => {
        if (!isAreaTool) {
            activeDrawingIdRef.current = null;
            setActiveDrawingId(null);
            setCursorPos(null);
        }
    }, [isAreaTool]);

    const snapMeters = () => {
        const p1 = map.containerPointToLatLng([0, 0]);
        const p2 = map.containerPointToLatLng([18, 0]);
        return map.distance(p1, p2);
    };

    // ── Toggle edge BRouter ↔ straight ────────────────────────────────────────
    const handleToggleEdge = useCallback((area: AreaAnnotation, edgeIdx: number) => {
        const n = area.coords.length;
        const newEdgeRoutes: ([number, number][] | null)[] = area.edgeRoutes
            ? [...area.edgeRoutes] : Array(n).fill(null);
        while (newEdgeRoutes.length < n) newEdgeRoutes.push(null);
        const isRouted = !!(newEdgeRoutes[edgeIdx] && newEdgeRoutes[edgeIdx]!.length >= 2);
        if (isRouted) {
            newEdgeRoutes[edgeIdx] = null;
            const dp = buildAreaDisplayCoords(area.coords, newEdgeRoutes);
            const m2 = calculatePolygonArea(dp.length >= 3 ? dp : area.coords);
            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { edgeRoutes: newEdgeRoutes, area_m2: m2, formatted_area: formatArea(m2) } });
        } else {
            newEdgeRoutes[edgeIdx] = null;
            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { edgeRoutes: newEdgeRoutes } });
            enqueueAreaEdge(area.id, edgeIdx, area.coords[edgeIdx], area.coords[(edgeIdx + 1) % n]);
        }
    }, [dispatch]);

    // ── Visible layers ────────────────────────────────────────────────────────
    const layersMap = new Map((state.annotation_layers || []).map(l => [l.id, l.visible]));
    const visiblePoints = (state.point_annotations || []).filter(p => {
        const lv = layersMap.has(p.layerId) ? layersMap.get(p.layerId) : true;
        return lv && p.visible;
    });
    const visibleAreas = (state.area_annotations || []).filter(a => {
        const lv = layersMap.has(a.layerId) ? layersMap.get(a.layerId) : true;
        return lv && a.visible;
    });

    // ── Map events ────────────────────────────────────────────────────────────
    useMapEvents({
        mousemove(e) {
            if (isAreaTool && activeDrawingIdRef.current) setCursorPos([e.latlng.lat, e.latlng.lng]);
        },
        click(e) {
            if ((window as any).__markerDragging) return;

            const targetEl = e.originalEvent?.target as HTMLElement | null;

            // ── Ancrage à un repère existant (outil de zone) ───────────────────
            // Cliquer sur un repère utilise ses coordonnées exactes comme sommet
            // de l'aire en cours, sans sélectionner le repère ni ouvrir sa popup.
            let anchorPt: [number, number] | null = null;
            if (isAreaTool) {
                const anchorEl = targetEl?.closest?.('[data-sr-anchor-lat]');
                if (anchorEl) {
                    const al = parseFloat(anchorEl.getAttribute('data-sr-anchor-lat') || '');
                    const ag = parseFloat(anchorEl.getAttribute('data-sr-anchor-lng') || '');
                    if (!isNaN(al) && !isNaN(ag)) {
                        anchorPt = [al, ag];
                    }
                }
            }

            // A click landing on an existing marker/overlay must never create
            // a new annotation underneath it: the marker handles its own click
            // (selection + popup), and we stop here.
            // Exception: vertex markers of the area currently being drawn are
            // allowed to pass through so we can close the polygon by clicking
            // the first summit.
            if (!anchorPt && targetEl?.closest?.('.leaflet-marker-icon, .leaflet-popup, .leaflet-control')) {
                const isVertexOfCurrentArea = isAreaTool && activeDrawingIdRef.current
                    && targetEl?.closest?.('.area-vertex-handle');
                if (!isVertexOfCurrentArea) return;
            }

            const pt: [number, number] = anchorPt ?? [e.latlng.lat, e.latlng.lng];

            if (activeTool === 'annotate_point') {
                const ptCount = (state.point_annotations?.length || 0) + 1;
                const coords: [number, number] = pt;
                const newId = `poi-annot-${Date.now()}`;
                dispatch({
                    type: 'ADD_POINT_ANNOTATION',
                    point: { id: newId, type: 'point' as const, title: `Repère ${ptCount}`, text: '', coords, color: '#3b82f6', icon: 'pin' as const, layerId: 'layer-points', visible: true } as any
                });
                return;
            }

            if (activeTool === 'annotate_area' || activeTool === 'annotate_area_routed') {
                const currentId = activeDrawingIdRef.current;

                if (!currentId) {
                    // Pas d'aire en cours de dessin → clic sur la zone de travail
                    // démarre immédiatement une nouvelle aire.
                    const newId = `area-annot-${Date.now()}`;
                    activeDrawingIdRef.current = newId;
                    setActiveDrawingId(newId);
                    setSelectedId(newId);
                    const areaCount = (state.area_annotations?.length || 0) + 1;
                    dispatch({
                        type: 'ADD_AREA_ANNOTATION',
                        area: { id: newId, type: 'area' as const, title: `Zone ${areaCount}`, text: '', layerId: 'layer-areas', coords: [pt], fillOpacity: 0.3, visible: true, followRoads: activeTool === 'annotate_area_routed', edgeRoutes: [] } as any
                    });
                } else {
                    const area = areaAnnotationsRef.current.find(a => a.id === currentId);
                    if (!area) return;

                    // ── Clic sur un sommet existant de l'aire en cours ─────────
                    // Si on clique sur un sommet déjà placé, soit on ferme (premier
                    // sommet avec 3+ points), soit on ne fait rien (autres sommets).
                    const vertexIdx = area.coords.findIndex(c =>
                        map.distance({ lat: pt[0], lng: pt[1] }, { lat: c[0], lng: c[1] }) <= snapMeters()
                    );
                    if (vertexIdx >= 0) {
                        if (vertexIdx === 0 && area.coords.length >= 3) {
                            // Fermer le polygone en reliant le dernier point au premier
                            if (activeTool === 'annotate_area_routed') {
                                const n = area.coords.length;
                                enqueueAreaEdge(currentId, n - 1, area.coords[n - 1], area.coords[0]);
                            }
                            activeDrawingIdRef.current = null;
                            setActiveDrawingId(null);
                            setCursorPos(null);
                            setSelectedId(currentId);
                            return;
                        }
                        // Clic sur un autre sommet : ne rien faire (éviter le doublon)
                        return;
                    }

                    // Pas sur un sommet existant : ajouter un nouveau point.
                    const prevCoords = area.coords;
                    const newCoords: [number, number][] = [...prevCoords, pt];
                    const edgeIdx = prevCoords.length - 1;
                    if (activeTool === 'annotate_area_routed' && prevCoords.length >= 1)
                        enqueueAreaEdge(currentId, edgeIdx, prevCoords[prevCoords.length - 1], pt);
                    const m2 = newCoords.length >= 3 ? calculatePolygonArea(newCoords) : 0;
                    dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: currentId, patch: { coords: newCoords, area_m2: m2, formatted_area: newCoords.length >= 3 ? formatArea(m2) : '' } });
                }
                return;
            }
        },
        keydown(e: any) {
            const key = e.originalEvent?.key;
            if (!isAreaTool) return;
            if (key === 'Escape') {
                const id = activeDrawingIdRef.current;
                if (id) {
                    const area = areaAnnotationsRef.current.find(a => a.id === id);
                    if (area && area.coords.length < 3) dispatch({ type: 'REMOVE_AREA_ANNOTATION', id });
                    activeDrawingIdRef.current = null;
                    setActiveDrawingId(null);
                    setCursorPos(null);
                }
            }
        },
    });

    // ── Imperative 60fps Vertex Drag Handlers (ZERO React re-renders during drag!) ───
    const handleVertexDrag = useCallback((areaId: string, vIdx: number, lat: number, lng: number) => {
        const poly = polygonRefs.current[areaId];
        const area = areaAnnotationsRef.current.find(a => a.id === areaId);
        if (poly && area) {
            const nc = [...area.coords] as [number, number][];
            nc[vIdx] = [lat, lng];
            const n = nc.length;
            const prevIdx = (vIdx - 1 + n) % n;
            const tempEdges: ([number, number][] | null)[] = area.edgeRoutes ? [...area.edgeRoutes] : Array(n).fill(null);
            tempEdges[prevIdx] = null;
            tempEdges[vIdx] = null;
            const dp = buildAreaDisplayCoords(nc, tempEdges);
            poly.setLatLngs(dp);
        }
    }, []);

    const handleVertexDragEnd = useCallback((areaId: string, vIdx: number, lat: number, lng: number) => {
        const area = areaAnnotationsRef.current.find(a => a.id === areaId);
        if (!area) return;
        const nc = [...area.coords] as [number, number][];
        nc[vIdx] = [lat, lng];
        const n = nc.length;
        const prevIdx = (vIdx - 1 + n) % n;
        const newEdgeRoutes = area.edgeRoutes ? [...area.edgeRoutes] : Array(n).fill(null) as ([number, number][] | null)[];
        const prevWasRouted = !!(area.edgeRoutes?.[prevIdx]?.length);
        const nextWasRouted = !!(area.edgeRoutes?.[vIdx]?.length);
        newEdgeRoutes[prevIdx] = null;
        newEdgeRoutes[vIdx]    = null;
        const dp = buildAreaDisplayCoords(nc, newEdgeRoutes);
        const m2 = calculatePolygonArea(dp.length >= 3 ? dp : nc);
        dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: areaId, patch: { coords: nc, edgeRoutes: newEdgeRoutes, area_m2: m2, formatted_area: formatArea(m2) } });
        if (prevWasRouted || area.followRoads) enqueueAreaEdge(areaId, prevIdx, nc[prevIdx], nc[vIdx]);
        if (nextWasRouted || area.followRoads) enqueueAreaEdge(areaId, vIdx, nc[vIdx], nc[(vIdx + 1) % n]);
    }, [dispatch]);

    const handlePointDragEnd = useCallback((id: string, lat: number, lng: number) => {
        dispatch({ type: 'UPDATE_POINT_ANNOTATION', id, patch: { coords: [lat, lng] } });
    }, [dispatch]);

    const handlePointDelete = useCallback((id: string) => {
        dispatch({ type: 'REMOVE_POINT_ANNOTATION', id });
    }, [dispatch]);

    return (
        <>
            {/* ── 1. POINTS ─────────────────────────────────────────────────── */}
            {visiblePoints.map(point => (
                <PointAnnotationMarker
                    key={point.id}
                    point={point}
                    isSelected={selectedId === point.id}
                    areaMode={isAreaTool}
                    activeTool={activeTool}
                    onSelect={setSelectedId}
                    onDragEnd={handlePointDragEnd}
                    onDelete={handlePointDelete}
                    dispatch={dispatch}
                />
            ))}

            {/* ── 2. RUBBER-BAND while drawing ──────────────────────────────── */}
            {isAreaTool && activeDrawingId && cursorPos && (() => {
                const area = visibleAreas.find(a => a.id === activeDrawingId);
                if (!area || area.coords.length === 0) return null;
                const lastV = area.coords[area.coords.length - 1];
                return (
                    <Polyline positions={[lastV, cursorPos]}
                        pathOptions={{ color: area.color || '#10b981', weight: 2, dashArray: '5 5', opacity: 0.6 }}
                        interactive={false}
                    />
                );
            })()}

            {/* ── 3. AREAS ──────────────────────────────────────────────────── */}
            {visibleAreas.map(area => {
                const isDrawing  = activeDrawingId === area.id;
                const isSelected = selectedId === area.id;
                const n = area.coords.length;
                const displayCoords = buildAreaDisplayCoords(area.coords, area.edgeRoutes);
                const isComplete = displayCoords.length >= 3;
                const liveM2    = isComplete ? calculatePolygonArea(displayCoords) : 0;
                const formatted = isComplete ? (area.formatted_area || formatArea(liveM2)) : '';
                const hasRouted = area.edgeRoutes?.some(e => e && e.length > 0);

                // ── NON-AREA TOOL: simple read-only display ───────────────────
                if (!isAreaTool) {
                    return (
                        <React.Fragment key={area.id}>
                            {isComplete ? (
                                <Polygon
                                    ref={(ref: any) => { if (ref) polygonRefs.current[area.id] = ref; }}
                                    positions={displayCoords}
                                    pathOptions={{
                                        color: area.color || '#10b981',
                                        fillColor: area.color || '#10b981',
                                        fillOpacity: area.fillOpacity ?? 0.18,
                                        weight: 1.5,
                                        interactive: false,
                                    } as any}
                                >
                                    <Tooltip permanent direction="center" className="sr-map-label-area">
                                        <span style={{ color: area.color || '#10b981', fontWeight: 700 }}>{area.title}</span>
                                        {formatted && <span style={{ opacity: 0.7 }}> ({formatted})</span>}
                                        {hasRouted && <span style={{ marginLeft: '4px', color: '#10b981' }}>⛰</span>}
                                    </Tooltip>
                                </Polygon>
                            ) : area.coords.length >= 2 ? (
                                <Polyline positions={area.coords}
                                    pathOptions={{ color: area.color || '#10b981', weight: 2, dashArray: '6 4', interactive: false } as any}
                                />
                            ) : null}
                        </React.Fragment>
                    );
                }

                // ── AREA TOOL: interactive with vertex handles ─────────────────
                const showHandles  = isDrawing || isSelected;
                const showEdges    = isSelected && !isDrawing && isComplete;

                // Pendant le dessin avec 3+ points : remplissage coloré de la zone
                // (sans trait de fermeture premier→dernier), traits consécutifs
                // en trait plein. Le rubber-band vers le curseur est géré ci-dessus.
                let areaFill: JSX.Element | null = null;
                let areaOutline: JSX.Element | null = null;
                if (isComplete) {
                    if (isDrawing) {
                        // Remplissage uniquement (pas de stroke, pas de fermeture)
                        areaFill = (
                            <Polygon
                                ref={(ref: any) => { if (ref) polygonRefs.current[area.id] = ref; }}
                                positions={displayCoords}
                                pane={layerPaneName(area.id)}
                                pathOptions={{
                                    stroke: false,
                                    fillColor: area.color || '#10b981',
                                    fillOpacity: area.fillOpacity ?? 0.22,
                                    interactive: false,
                                } as any}
                            />
                        );
                        // Segments entre sommets consécutifs (dernier→premier NON inclus)
                        areaOutline = (
                            <Polyline
                                positions={displayCoords}
                                pane={layerPaneName(area.id)}
                                pathOptions={{
                                    color: area.color || '#10b981',
                                    weight: 2,
                                    opacity: 1,
                                    interactive: false,
                                } as any}
                            />
                        );
                    } else {
                        // Aire terminée : polygon normal (trait plein + remplissage)
                        areaFill = (
                            <Polygon
                                ref={(ref: any) => { if (ref) polygonRefs.current[area.id] = ref; }}
                                positions={displayCoords}
                                pane={layerPaneName(area.id)}
                                pathOptions={{
                                    color: area.color || '#10b981',
                                    fillColor: area.color || '#10b981',
                                    fillOpacity: (isSelected && !isDrawing) ? 0.15 : (area.fillOpacity ?? 0.22),
                                    weight: (isSelected && !isDrawing) ? 2 : 2,
                                    opacity: 1,
                                    dashArray: undefined,
                                    interactive: true,
                                } as any}
                                eventHandlers={{
                                    click: (e: any) => {
                                        L.DomEvent.stopPropagation(e);
                                        if (!isDrawing) {
                                            // Clic sur une aire existante en mode outil :
                                            // bascule en mode édition sur cette aire
                                            // pour pouvoir lui ajouter des sommets.
                                            setSelectedId(area.id);
                                            activeDrawingIdRef.current = area.id;
                                            setActiveDrawingId(area.id);
                                        }
                                    }
                                }}
                            >
                                <Tooltip permanent direction="center" className="sr-map-label-area">
                                    <span style={{ color: area.color || '#10b981', fontWeight: 700 }}>{area.title}</span>
                                    {formatted && <span style={{ opacity: 0.7 }}> ({formatted})</span>}
                                    {hasRouted && <span style={{ marginLeft: '4px', color: '#10b981' }}>⛰</span>}
                                </Tooltip>
                                {!isDrawing && (
                                    <Popup className="sr-annotation-popup">
                                        <AreaPopupContent area={area} formatted={formatted} dispatch={dispatch}
                                            onDelete={() => { dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id }); setSelectedId(null); }}
                                        />
                                    </Popup>
                                )}
                            </Polygon>
                        );
                    }
                } else if (area.coords.length >= 2) {
                    // 1 ou 2 points : juste le trait entre les sommets placés
                    areaOutline = (
                        <Polyline positions={area.coords}
                            pane={layerPaneName(area.id)}
                            pathOptions={{ color: area.color || '#10b981', weight: 2, dashArray: undefined, interactive: false } as any}
                        />
                    );
                }

                return (
                    <React.Fragment key={area.id}>
                        {areaFill}
                        {areaOutline}

                        {/* Per-edge polylines (selected + finalized only) */}
                        {showEdges && area.coords.map((_, eIdx) => {
                            const nextIdx  = (eIdx + 1) % n;
                            const edgeRoute = area.edgeRoutes?.[eIdx];
                            const isRouted  = !!(edgeRoute && edgeRoute.length >= 2);
                            const edgePts = isRouted ? edgeRoute! : [area.coords[eIdx], area.coords[nextIdx]];
                            return (
                                <Polyline key={`edge-${area.id}-${eIdx}`} positions={edgePts}
                                    pane={layerPaneName(area.id)}
                                    pathOptions={{ color: isRouted ? '#10b981' : (area.color || '#5b6af0'), weight: 4, dashArray: isRouted ? undefined : '7 5', opacity: 0.95, interactive: true } as any}
                                    eventHandlers={{
                                        click:     (e: any) => { L.DomEvent.stopPropagation(e); handleToggleEdge(area, eIdx); },
                                        mouseover: (e: any) => { e.target.setStyle({ weight: 6 }); },
                                        mouseout:  (e: any) => { e.target.setStyle({ weight: 4 }); },
                                    }}
                                >
                                    <Tooltip sticky direction="top">
                                        <div style={{ fontSize: '10px' }}>
                                            {isRouted
                                                ? <><span style={{ color: '#10b981' }}>⛰ BRouter</span> — <span style={{ opacity: 0.6 }}>clic → droit</span></>
                                                : <>— Droit — <span style={{ color: '#10b981' }}>clic → router</span></>}
                                        </div>
                                    </Tooltip>
                                </Polyline>
                            );
                        })}

                        {/* Vertex handles — memoized so dragging is 100% stable and smooth */}
                        {showHandles && area.coords.map((coords, vIdx) => (
                            <VertexMarker
                                key={`vertex-${area.id}-${vIdx}`}
                                areaId={area.id}
                                vIdx={vIdx}
                                position={coords}
                                color={area.color || '#10b981'}
                                isFirst={vIdx === 0}
                                isDrawing={isDrawing}
                                totalVertices={area.coords.length}
                                onDrag={handleVertexDrag}
                                onDragEnd={handleVertexDragEnd}
                            />
                        ))}

                    </React.Fragment>
                );
            })}
        </>
    );
}

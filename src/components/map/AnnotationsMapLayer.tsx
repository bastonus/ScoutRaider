import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Marker, Polygon, Polyline, Tooltip, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { PointAnnotation, AreaAnnotation, AnnotationIcon } from '../../logic/types';
import { calculatePolygonArea, formatArea, computeRoutedAreaBoundary } from '../../logic/GeoUtils';
import { PRESET_COLORS } from './AnnotationModals';
import { Check, X, Trash2, Edit2, Move, Trees, Compass, Plus, CornerDownRight } from 'lucide-react';

const svgIcons: Record<AnnotationIcon, string> = {
    pin: `<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z"/><circle cx="12" cy="9" r="2.5"/>`,
    camp: `<path d="M19 21 12 4 5 21"/><path d="m19 21-7-8-7 8"/><path d="M2 21h20"/>`,
    flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>`,
    water: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`,
    danger: `<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>`,
    star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
    info: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>`,
};

function createPointIcon(color: string, iconType: AnnotationIcon = 'pin', isSelected: boolean = false) {
    const iconPath = svgIcons[iconType] || svgIcons.pin;
    return L.divIcon({
        className: 'annotation-point-marker',
        html: `
            <div style="
                width: 28px;
                height: 28px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                background: ${color};
                border: 2px solid #ffffff;
                box-shadow: ${isSelected ? `0 0 0 3px #fff, 0 0 12px ${color}` : '0 2px 8px rgba(0,0,0,0.5)'};
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: grab;
            ">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(45deg);">
                    ${iconPath}
                </svg>
            </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26]
    });
}

function createVertexHandleIcon(color: string, isFirst: boolean = false) {
    return L.divIcon({
        className: 'area-vertex-handle',
        html: `
            <div style="
                width: ${isFirst ? '14px' : '11px'};
                height: ${isFirst ? '14px' : '11px'};
                border-radius: 50%;
                background: ${isFirst ? '#ffffff' : '#ffffff'};
                border: ${isFirst ? '3px' : '2px'} solid ${color};
                box-shadow: 0 1px 6px rgba(0,0,0,0.65);
                cursor: move;
            "></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
}

export default function AnnotationsMapLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const activeTool = state.active_tool;

    // Selected item for interaction
    const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

    // Live dragging vertex state (areaId, vertexIdx, live coordinates during drag)
    const [liveDragVertex, setLiveDragVertex] = useState<{ areaId: string; vertexIdx: number; coords: [number, number] } | null>(null);

    // Current area in creation: holds ID of the area currently being drawn in real-time
    const [currentDrawingAreaId, setCurrentDrawingAreaId] = useState<string | null>(null);

    // Routing in progress flag
    const [isRoutingArea, setIsRoutingArea] = useState(false);

    // Filter points & areas by layer visibility
    const layersMap = new Map((state.annotation_layers || []).map(l => [l.id, l.visible]));
    const visiblePoints = (state.point_annotations || []).filter(p => {
        const layerVisible = layersMap.has(p.layerId) ? layersMap.get(p.layerId) : true;
        return layerVisible && p.visible;
    });
    const visibleAreas = (state.area_annotations || []).filter(a => {
        const layerVisible = layersMap.has(a.layerId) ? layersMap.get(a.layerId) : true;
        return layerVisible && a.visible;
    });

    // Toggle route trail following for an area
    const handleToggleRoadFollow = useCallback(async (area: AreaAnnotation) => {
        const newFollow = !area.followRoads;
        if (!newFollow) {
            dispatch({
                type: 'UPDATE_AREA_ANNOTATION',
                id: area.id,
                patch: { followRoads: false, routedCoords: undefined }
            });
            return;
        }

        setIsRoutingArea(true);
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul du tracé sur les chemins...' });

        try {
            const routed = await computeRoutedAreaBoundary(area.coords, 'pedestrian');
            const m2 = calculatePolygonArea(routed);
            dispatch({
                type: 'UPDATE_AREA_ANNOTATION',
                id: area.id,
                patch: {
                    followRoads: true,
                    routedCoords: routed,
                    area_m2: m2,
                    formatted_area: formatArea(m2)
                }
            });
            dispatch({ type: 'ADD_NOTIFICATION', message: `Arêtes ajustées sur les chemins (${formatArea(m2)})`, notifType: 'info' });
        } catch (e) {
            console.error('Failed to route area edges:', e);
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Impossible de router toutes les arêtes.', notifType: 'warning' });
        } finally {
            setIsRoutingArea(false);
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    }, [dispatch]);

    // Map click events for real-time creation
    useMapEvents({
        click(e) {
            if ((window as any).__markerDragging) return;

            if (activeTool === 'annotate_point') {
                // AUTOMATIC POINT CREATION: Instant on click!
                const ptCount = (state.point_annotations?.length || 0) + 1;
                const coords: [number, number] = [e.latlng.lat, e.latlng.lng];
                dispatch({
                    type: 'ADD_POINT_ANNOTATION',
                    point: {
                        type: 'point' as const,
                        title: `Repère ${ptCount}`,
                        text: '',
                        coords,
                        color: '#3b82f6',
                        icon: 'pin' as const,
                        layerId: 'layer-points',
                        visible: true
                    }
                });
                dispatch({ type: 'ADD_NOTIFICATION', message: `Repère ${ptCount} placé. Clic droit pour supprimer, glisser pour déplacer.`, notifType: 'info' });
            } else if (activeTool === 'annotate_area') {
                const clickedPt: [number, number] = [e.latlng.lat, e.latlng.lng];

                // If we don't have an area currently in creation, or the current one is not found:
                let targetArea = currentDrawingAreaId ? state.area_annotations.find(a => a.id === currentDrawingAreaId) : null;

                if (!targetArea) {
                    // Create a new area with the first vertex
                    const areaCount = (state.area_annotations?.length || 0) + 1;
                    const newId = `area-annot-${Date.now()}`;
                    dispatch({
                        type: 'ADD_AREA_ANNOTATION',
                        area: {
                            id: newId,
                            title: `Zone ${areaCount}`,
                            text: '',
                            layerId: 'layer-areas',
                            coords: [clickedPt],
                            color: '#10b981',
                            fillOpacity: 0.22,
                            visible: true,
                            followRoads: false
                        } as any
                    });
                    setCurrentDrawingAreaId(newId);
                    setSelectedAreaId(newId);
                } else {
                    // Append vertex to the existing area in REAL TIME
                    const newCoords: [number, number][] = [...targetArea.coords, clickedPt];
                    const m2 = newCoords.length >= 3 ? calculatePolygonArea(newCoords) : 0;
                    dispatch({
                        type: 'UPDATE_AREA_ANNOTATION',
                        id: targetArea.id,
                        patch: {
                            coords: newCoords,
                            routedCoords: undefined,
                            area_m2: m2,
                            formatted_area: formatArea(m2)
                        }
                    });

                    // If it just reached 3 vertices, it is now an active closed polygon in real time!
                    if (newCoords.length === 3) {
                        dispatch({ type: 'ADD_NOTIFICATION', message: `Zone délimitée (${formatArea(m2)}). Continuez à cliquer pour ajouter des sommets.`, notifType: 'info' });
                    }
                }
            } else {
                // Click on empty map with selection tool deselects
                setSelectedAreaId(null);
                setSelectedPointId(null);
            }
        }
    });

    // Handle vertex drag live in real-time
    const handleVertexDrag = (areaId: string, vertexIdx: number, e: any) => {
        const latlng = e.target.getLatLng();
        setLiveDragVertex({
            areaId,
            vertexIdx,
            coords: [latlng.lat, latlng.lng]
        });
    };

    const handleVertexDragEnd = (areaId: string, vertexIdx: number, e: any) => {
        const latlng = e.target.getLatLng();
        const area = state.area_annotations.find(a => a.id === areaId);
        setLiveDragVertex(null);

        if (!area) return;
        const newCoords: [number, number][] = [...area.coords];
        newCoords[vertexIdx] = [latlng.lat, latlng.lng];
        const m2 = calculatePolygonArea(newCoords);

        dispatch({
            type: 'UPDATE_AREA_ANNOTATION',
            id: areaId,
            patch: {
                coords: newCoords,
                routedCoords: undefined, // reset routed coords on vertex move
                area_m2: m2,
                formatted_area: formatArea(m2)
            }
        });

        // If followRoads was active, recompute in background
        if (area.followRoads) {
            computeRoutedAreaBoundary(newCoords, 'pedestrian').then(routed => {
                const routedM2 = calculatePolygonArea(routed);
                dispatch({
                    type: 'UPDATE_AREA_ANNOTATION',
                    id: areaId,
                    patch: {
                        routedCoords: routed,
                        area_m2: routedM2,
                        formatted_area: formatArea(routedM2)
                    }
                });
            }).catch(() => {});
        }

        setTimeout(() => { (window as any).__markerDragging = false; }, 100);
    };

    // Handle deleting a vertex of an area
    const handleDeleteVertex = (areaId: string, vertexIdx: number) => {
        const area = state.area_annotations.find(a => a.id === areaId);
        if (!area || area.coords.length <= 3) {
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Une zone doit comporter au moins 3 sommets.', notifType: 'warning' });
            return;
        }

        dispatch({ type: 'DELETE_AREA_VERTEX', areaId, vertexIdx });
        dispatch({ type: 'ADD_NOTIFICATION', message: `Sommet #${vertexIdx + 1} supprimé.`, notifType: 'info' });
    };

    return (
        <>
            {/* ── 1. RENDER POINT ANNOTATIONS (DRAGGABLE + PERMANENT LABELS) ── */}
            {visiblePoints.map(point => {
                const isSelected = selectedPointId === point.id;
                const icon = createPointIcon(point.color || '#3b82f6', point.icon || 'pin', isSelected);

                return (
                    <Marker
                        key={point.id}
                        position={point.coords}
                        icon={icon}
                        draggable={true}
                        eventHandlers={{
                            dragstart: () => {
                                (window as any).__markerDragging = true;
                            },
                            dragend: (e: any) => {
                                const pos = e.target.getLatLng();
                                dispatch({
                                    type: 'UPDATE_POINT_ANNOTATION',
                                    id: point.id,
                                    patch: { coords: [pos.lat, pos.lng] }
                                });
                                setTimeout(() => { (window as any).__markerDragging = false; }, 100);
                            },
                            click: (e: any) => {
                                setSelectedPointId(point.id);
                            },
                            contextmenu: (e: any) => {
                                // RIGHT-CLICK DELETES THE POINT IMMEDIATELY!
                                L.DomEvent.stopPropagation(e);
                                dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: point.id });
                                dispatch({ type: 'ADD_NOTIFICATION', message: `Point "${point.title}" supprimé.`, notifType: 'info' });
                            }
                        }}
                    >
                        {/* PERMANENT LABEL DIRECTLY VISIBLE ON THE MAP */}
                        <Tooltip
                            permanent={true}
                            direction="bottom"
                            offset={[0, 4]}
                            className="sr-map-label-point"
                        >
                            <span style={{ color: point.color || '#3b82f6', marginRight: '4px' }}>●</span>
                            <span>{point.title}</span>
                        </Tooltip>

                        {/* Interactive edit card on click */}
                        <Popup className="sr-annotation-popup" autoPanPadding={[40, 40]}>
                            <div style={{
                                minWidth: '220px', padding: '10px',
                                background: '#141e17', borderRadius: '10px',
                                border: `1px solid ${point.color || '#3b82f6'}55`,
                                color: '#e8f0eb', fontFamily: 'var(--font-ui, sans-serif)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: point.color, flexShrink: 0 }} />
                                    <input
                                        type="text"
                                        value={point.title}
                                        onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: point.id, patch: { title: e.target.value } })}
                                        style={{
                                            flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '6px', padding: '4px 6px', color: '#fff', fontWeight: 700, fontSize: '12px', outline: 'none'
                                        }}
                                        placeholder="Nom du repère..."
                                    />
                                </div>

                                <textarea
                                    rows={2}
                                    value={point.text || ''}
                                    onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: point.id, patch: { text: e.target.value } })}
                                    placeholder="Notes, consignes..."
                                    style={{
                                        width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)',
                                        border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px',
                                        color: '#cbd5e1', fontSize: '11px', outline: 'none', resize: 'vertical', marginBottom: '8px'
                                    }}
                                />

                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '8px' }}>
                                    {PRESET_COLORS.map(c => (
                                        <div
                                            key={c.value}
                                            title={c.label}
                                            onClick={() => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: point.id, patch: { color: c.value } })}
                                            style={{
                                                width: '14px', height: '14px', borderRadius: '50%', background: c.value, cursor: 'pointer',
                                                boxShadow: point.color === c.value ? '0 0 0 2px #fff' : 'none'
                                            }}
                                        />
                                    ))}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '9px', color: 'rgba(255,255,255,0.4)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
                                    <span>Glisser pour déplacer · Clic droit pour supprimer</span>
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: point.id })}
                                        style={{
                                            background: 'transparent', border: 'none', color: '#ef4444',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px'
                                        }}
                                    >
                                        <Trash2 size={11} /> Supprimer
                                    </button>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}

            {/* ── 2. RENDER AREA ANNOTATIONS (REAL-TIME LIVE DRAG + ROUTED EDGES) ── */}
            {visibleAreas.map(area => {
                const isSelected = selectedAreaId === area.id || currentDrawingAreaId === area.id;
                
                // Build live display coordinates (if dragging a vertex, update it in 60fps real-time!)
                let displayCoords = area.followRoads && area.routedCoords && area.routedCoords.length >= 3
                    ? area.routedCoords
                    : area.coords;

                if (liveDragVertex && liveDragVertex.areaId === area.id && !area.followRoads) {
                    const modified = [...area.coords];
                    modified[liveDragVertex.vertexIdx] = liveDragVertex.coords;
                    displayCoords = modified;
                }

                // If area has fewer than 3 points (during very initial click), draw polyline instead of polygon
                const isComplete = displayCoords.length >= 3;
                const liveAreaM2 = isComplete ? calculatePolygonArea(displayCoords) : 0;
                const formatted = isComplete ? (area.formatted_area || formatArea(liveAreaM2)) : '';

                return (
                    <React.Fragment key={area.id}>
                        {isComplete ? (
                            <Polygon
                                positions={displayCoords}
                                pathOptions={{
                                    color: area.color || '#10b981',
                                    fillColor: area.color || '#10b981',
                                    fillOpacity: isSelected ? 0.35 : (area.fillOpacity ?? 0.22),
                                    weight: isSelected ? 3.5 : 2,
                                    dashArray: area.followRoads ? undefined : undefined
                                }}
                                eventHandlers={{
                                    click: (e: any) => {
                                        L.DomEvent.stopPropagation(e);
                                        setSelectedAreaId(isSelected ? null : area.id);
                                    }
                                }}
                            >
                                {/* PERMANENT LABEL DIRECTLY VISIBLE ON THE MAP */}
                                <Tooltip
                                    permanent={true}
                                    sticky={true}
                                    direction="center"
                                    className="sr-map-label-area"
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        {area.followRoads && <Trees size={12} style={{ color: '#10b981' }} />}
                                        <span style={{ color: area.color || '#10b981' }}>{area.title}</span>
                                        <span style={{ opacity: 0.8, fontWeight: 500 }}>({formatted})</span>
                                    </div>
                                </Tooltip>

                                {/* Popup for inline adjustment */}
                                <Popup className="sr-annotation-popup">
                                    <div style={{
                                        minWidth: '230px', padding: '10px',
                                        background: '#141e17', borderRadius: '10px',
                                        border: `1px solid ${area.color || '#10b981'}55`,
                                        color: '#e8f0eb', fontFamily: 'var(--font-ui, sans-serif)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                            <input
                                                type="text"
                                                value={area.title}
                                                onChange={e => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { title: e.target.value } })}
                                                style={{
                                                    flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '6px', padding: '4px 6px', color: '#fff', fontWeight: 700, fontSize: '12px', outline: 'none'
                                                }}
                                                placeholder="Nom de la zone..."
                                            />
                                        </div>

                                        <div style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            fontSize: '11px', color: '#10b981', fontWeight: 700,
                                            background: 'rgba(16, 185, 129, 0.12)', padding: '4px 8px', borderRadius: '6px',
                                            marginBottom: '6px'
                                        }}>
                                            <span>Superficie :</span>
                                            <span>{formatted}</span>
                                        </div>

                                        {/* Road / Trail Following Toggle */}
                                        <button
                                            type="button"
                                            onClick={() => handleToggleRoadFollow(area)}
                                            style={{
                                                width: '100%', padding: '6px 8px', borderRadius: '6px',
                                                background: area.followRoads ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                                                border: `1px solid ${area.followRoads ? '#10b981' : 'rgba(255, 255, 255, 0.15)'}`,
                                                color: area.followRoads ? '#6ee7b7' : 'var(--text-bright)',
                                                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                                marginBottom: '8px'
                                            }}
                                        >
                                            <Trees size={14} style={{ color: area.followRoads ? '#10b981' : 'inherit' }} />
                                            <span>{area.followRoads ? 'Arêtes sur sentiers (Actif)' : 'Suivre les chemins (BRouter)'}</span>
                                        </button>

                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '8px' }}>
                                            {PRESET_COLORS.map(c => (
                                                <div
                                                    key={c.value}
                                                    title={c.label}
                                                    onClick={() => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { color: c.value } })}
                                                    style={{
                                                        width: '14px', height: '14px', borderRadius: '50%', background: c.value, cursor: 'pointer',
                                                        boxShadow: area.color === c.value ? '0 0 0 2px #fff' : 'none'
                                                    }}
                                                />
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px', fontSize: '10px' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px' }}>
                                                Glisser les sommets pour déformer · Clic droit sur sommet pour supprimer
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id });
                                                    setSelectedAreaId(null);
                                                }}
                                                style={{
                                                    background: 'transparent', border: 'none', color: '#ef4444',
                                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px'
                                                }}
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </div>
                                    </div>
                                </Popup>
                            </Polygon>
                        ) : (
                            // Less than 3 points (draft line)
                            <Polyline
                                positions={displayCoords}
                                pathOptions={{
                                    color: area.color || '#10b981',
                                    weight: 2.5,
                                    dashArray: '5, 5'
                                }}
                            />
                        )}

                        {/* Interactive draggable vertex handles shown when zone is selected or active! */}
                        {isSelected && area.coords.map((vertex, vIdx) => {
                            // If this vertex is currently being live-dragged, use the live coordinates
                            const pos = liveDragVertex && liveDragVertex.areaId === area.id && liveDragVertex.vertexIdx === vIdx
                                ? liveDragVertex.coords
                                : vertex;

                            return (
                                <Marker
                                    key={`vertex-${area.id}-${vIdx}`}
                                    position={pos}
                                    icon={createVertexHandleIcon(area.color || '#10b981', vIdx === 0)}
                                    draggable={true}
                                    eventHandlers={{
                                        dragstart: () => {
                                            (window as any).__markerDragging = true;
                                        },
                                        drag: (e: any) => {
                                            // REAL-TIME VERTEX DRAGGING: updates polygon shape live at 60fps!
                                            handleVertexDrag(area.id, vIdx, e);
                                        },
                                        dragend: (e: any) => {
                                            handleVertexDragEnd(area.id, vIdx, e);
                                        },
                                        contextmenu: (e: any) => {
                                            // RIGHT CLICK DELETES THIS VERTEX!
                                            L.DomEvent.stopPropagation(e);
                                            handleDeleteVertex(area.id, vIdx);
                                        }
                                    }}
                                >
                                    <Tooltip direction="top" offset={[0, -8]}>
                                        <div style={{ fontSize: '10px' }}>
                                            <b>Sommet #{vIdx + 1}</b><br />
                                            Glisser pour déformer l'aire en direct<br />
                                            <span style={{ color: '#ef4444' }}>Clic droit pour supprimer</span>
                                        </div>
                                    </Tooltip>
                                </Marker>
                            );
                        })}
                    </React.Fragment>
                );
            })}

            {/* ── 3. FLOATING HUD FOR REAL-TIME AREA TOOL ─────────────────── */}
            {activeTool === 'annotate_area' && (
                <div style={{
                    position: 'absolute', top: '74px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 1100, pointerEvents: 'all',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: 'rgba(14, 22, 17, 0.94)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    borderRadius: '24px', padding: '6px 14px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    color: '#fff', fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontWeight: 700, color: '#10b981' }}>Outil Zone en direct :</span>
                        <span style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {currentDrawingAreaId ? (
                                (() => {
                                    const a = state.area_annotations.find(x => x.id === currentDrawingAreaId);
                                    if (!a) return 'Cliquez pour commencer une zone';
                                    const count = a.coords.length;
                                    const m2 = count >= 3 ? calculatePolygonArea(a.coords) : 0;
                                    return `${count} sommet${count > 1 ? 's' : ''}${count >= 3 ? ` (${formatArea(m2)})` : ' (posez 3 sommets)'}`;
                                })()
                            ) : (
                                'Cliquez sur la carte pour tracer une zone'
                            )}
                        </span>
                    </div>

                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.15)' }} />

                    {/* Button: Snap edges to trails (BRouter) */}
                    {currentDrawingAreaId && (
                        <button
                            type="button"
                            onClick={() => {
                                const a = state.area_annotations.find(x => x.id === currentDrawingAreaId);
                                if (a) handleToggleRoadFollow(a);
                            }}
                            title="Faire épouser les chemins et sentiers pédestres aux arêtes de la zone"
                            style={{
                                background: 'rgba(16, 185, 129, 0.18)', color: '#6ee7b7',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                                fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                        >
                            <Trees size={13} />
                            <span>Suivre les chemins</span>
                        </button>
                    )}

                    {/* Button: Start fresh new area */}
                    {currentDrawingAreaId && (
                        <button
                            type="button"
                            onClick={() => {
                                setCurrentDrawingAreaId(null);
                                dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouvelle zone prête. Cliquez pour poser le 1er sommet.', notifType: 'info' });
                            }}
                            title="Démarrer une nouvelle zone distincte"
                            style={{
                                background: 'rgba(255, 255, 255, 0.08)', color: '#fff',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                padding: '3px 10px', borderRadius: '12px', fontSize: '11px',
                                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                        >
                            <Plus size={12} />
                            <span>+ Autre zone</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            setCurrentDrawingAreaId(null);
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
                        }}
                        title="Quitter l'outil zone"
                        style={{
                            background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px'
                        }}
                    >
                        <X size={15} />
                    </button>
                </div>
            )}
        </>
    );
}

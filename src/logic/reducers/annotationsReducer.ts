// src/logic/reducers/annotationsReducer.ts - Reducer for Points, Areas, Draws, Texts, Layers & Selection
import type {
    AppState,
    PointAnnotation,
    AreaAnnotation,
    DrawAnnotation,
    DrawStroke,
    TextAnnotation,
    TextItem,
    AnnotationLayerDef
} from '../types';
import type { AppAction } from '../../AppContext';
import { calculatePolygonArea, formatArea } from '../GeoUtils';
import { pushHistory } from '../historyManager';

export function annotationsReducer(state: AppState, action: AppAction): AppState | null {
    switch (action.type) {
        // ── Points ─────────────────────────────────────────────────────────
        case 'ADD_POINT_ANNOTATION': {
            pushHistory(state);
            const ptCount = (state.point_annotations?.length || 0) + 1;
            const newPoint: PointAnnotation = {
                id: (action.point as any).id || `poi-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'point',
                layerId: action.point.layerId || 'layer-points',
                title: action.point.title || `Repère ${ptCount}`,
                text: action.point.text || '',
                coords: action.point.coords,
                color: action.point.color || '#3b82f6',
                icon: action.point.icon || 'pin',
                visible: action.point.visible !== undefined ? action.point.visible : true,
                createdAt: Date.now()
            };
            return {
                ...state,
                point_annotations: [...(state.point_annotations || []), newPoint],
                selected_layer_id: newPoint.id,
            };
        }

        case 'UPDATE_POINT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                point_annotations: (state.point_annotations || []).map(p =>
                    p.id === action.id ? { ...p, ...action.patch } : p
                )
            };
        }

        case 'REMOVE_POINT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                point_annotations: (state.point_annotations || []).filter(p => p.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
            };
        }

        case 'TOGGLE_POINT_VISIBILITY': {
            return {
                ...state,
                point_annotations: (state.point_annotations || []).map(p =>
                    p.id === action.id ? { ...p, visible: !p.visible } : p
                )
            };
        }

        // ── Areas ──────────────────────────────────────────────────────────
        case 'ADD_AREA_ANNOTATION': {
            pushHistory(state);
            const areaCount = (state.area_annotations?.length || 0) + 1;
            const m2 = calculatePolygonArea(action.area.coords);
            const areaColors = new Set((state.area_annotations || []).map(a => a.color));
            const colors = ['#10b981', '#f97316', '#2d8ceb', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];
            const areaColor = action.area.color
                || colors.find(c => !areaColors.has(c))
                || colors[(areaCount - 1) % colors.length];
            const newArea: AreaAnnotation = {
                id: (action.area as any).id || `area-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'area',
                layerId: action.area.layerId || 'layer-areas',
                title: action.area.title || `Zone ${areaCount}`,
                text: action.area.text || '',
                coords: action.area.coords,
                color: areaColor,
                fillOpacity: action.area.fillOpacity ?? 0.25,
                visible: action.area.visible !== undefined ? action.area.visible : true,
                area_m2: m2,
                formatted_area: formatArea(m2),
                createdAt: Date.now()
            };
            return {
                ...state,
                area_annotations: [...(state.area_annotations || []), newArea],
                selected_layer_id: newArea.id,
            };
        }

        case 'UPDATE_AREA_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a => {
                    if (a.id !== action.id) return a;
                    const updated = { ...a, ...action.patch };
                    if (action.patch.coords) {
                        const m2 = calculatePolygonArea(action.patch.coords);
                        updated.area_m2 = m2;
                        updated.formatted_area = formatArea(m2);
                    }
                    return updated;
                })
            };
        }

        case 'REMOVE_AREA_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                area_annotations: (state.area_annotations || []).filter(a => a.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
            };
        }

        case 'DELETE_AREA_VERTEX': {
            pushHistory(state);
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a => {
                    if (a.id !== action.areaId) return a;
                    if (a.coords.length <= 3) return a; // Keep at least 3 points
                    const newCoords = a.coords.filter((_, idx) => idx !== action.vertexIdx);
                    const m2 = calculatePolygonArea(newCoords);
                    return {
                        ...a,
                        coords: newCoords,
                        routedCoords: undefined,
                        area_m2: m2,
                        formatted_area: formatArea(m2)
                    };
                })
            };
        }

        case 'SET_AREA_ROUTED_COORDS': {
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a => {
                    if (a.id !== action.areaId) return a;
                    return {
                        ...a,
                        routedCoords: action.routedCoords,
                        area_m2: action.area_m2,
                        formatted_area: action.formatted_area
                    };
                })
            };
        }

        case 'TOGGLE_AREA_VISIBILITY': {
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a =>
                    a.id === action.id ? { ...a, visible: !a.visible } : a
                )
            };
        }

        // ── Draw (brush) annotations ───────────────────────────────────────
        case 'ADD_DRAW_ANNOTATION': {
            pushHistory(state);
            const newDraw: DrawAnnotation = {
                ...action.draw,
                id: (action.draw as any).id || `draw-annot-${Date.now()}`,
                createdAt: Date.now(),
                strokes: action.draw.strokes ?? [],
            };
            return {
                ...state,
                draw_annotations: [...(state.draw_annotations || []), newDraw],
                selected_layer_id: newDraw.id,
            };
        }

        case 'UPDATE_DRAW_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d =>
                    d.id === action.id ? { ...d, ...action.patch } : d
                )
            };
        }

        case 'APPEND_DRAW_STROKE': {
            pushHistory(state);
            const strokeObj: DrawStroke = action.stroke as unknown as DrawStroke;
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d =>
                    d.id === action.id ? { ...d, strokes: [...d.strokes, strokeObj] } : d
                )
            };
        }

        case 'UPDATE_DRAW_STROKE': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d => {
                    if (d.id !== action.drawId) return d;
                    return {
                        ...d,
                        strokes: d.strokes.map((s: DrawStroke) =>
                            s.id === action.strokeId ? { ...s, ...action.patch } : s
                        )
                    };
                })
            };
        }

        case 'REMOVE_DRAW_STROKE': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d => {
                    if (d.id !== action.drawId) return d;
                    return { ...d, strokes: d.strokes.filter((s: DrawStroke) => s.id !== action.strokeId) };
                }),
                selected_sublayer_id: state.selected_sublayer_id === action.strokeId ? null : state.selected_sublayer_id,
            };
        }

        case 'REMOVE_DRAW_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).filter(d => d.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
                selected_sublayer_id: state.selected_layer_id === action.id ? null : state.selected_sublayer_id,
            };
        }

        case 'TOGGLE_DRAW_VISIBILITY': {
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d =>
                    d.id === action.id ? { ...d, visible: !d.visible } : d
                )
            };
        }

        // ── Text Annotations ──────────────────────────────────────────────
        case 'ADD_TEXT_ANNOTATION': {
            pushHistory(state);
            const newText: TextAnnotation = {
                ...action.text,
                id: (action.text as any).id || `text-annot-${Date.now()}`,
                createdAt: Date.now(),
                texts: action.text.texts ?? [],
            };
            return {
                ...state,
                text_annotations: [...(state.text_annotations || []), newText],
                selected_layer_id: newText.id,
            };
        }

        case 'UPDATE_TEXT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t =>
                    t.id === action.id ? { ...t, ...action.patch } : t
                )
            };
        }

        case 'APPEND_TEXT_ITEM': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t =>
                    t.id === action.id ? { ...t, texts: [...t.texts, action.textItem] } : t
                )
            };
        }

        case 'UPDATE_TEXT_ITEM': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t => {
                    if (t.id !== action.textId) return t;
                    return {
                        ...t,
                        texts: t.texts.map((item: TextItem) =>
                            item.id === action.itemId ? { ...item, ...action.patch } : item
                        )
                    };
                })
            };
        }

        case 'REMOVE_TEXT_ITEM': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t => {
                    if (t.id !== action.textId) return t;
                    return { ...t, texts: t.texts.filter((item: TextItem) => item.id !== action.itemId) };
                }),
                selected_sublayer_id: state.selected_sublayer_id === action.itemId ? null : state.selected_sublayer_id,
            };
        }

        case 'REMOVE_TEXT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).filter(t => t.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
                selected_sublayer_id: state.selected_layer_id === action.id ? null : state.selected_sublayer_id,
            };
        }

        case 'TOGGLE_TEXT_VISIBILITY': {
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t =>
                    t.id === action.id ? { ...t, visible: !t.visible } : t
                )
            };
        }

        // ── Layer Order & Selection ────────────────────────────────────────
        case 'SET_LAYER_ORDER': {
            if (action.recordHistory !== false) pushHistory(state);
            return {
                ...state,
                layer_order: action.order
            };
        }

        case 'SET_SELECTED_LAYER': {
            const updatedItins = (state.itineraries || []).map(it => it.id === state.active_itinerary_id ? {
                ...it,
                stages: state.stages,
                routes: state.routes,
                polygonal_steps: state.polygonal_steps,
                polygonal_legs: state.polygonal_legs,
                carnet_steps: state.carnet_steps,
                custom_assignments: state.custom_assignments,
                custom_languages: state.custom_languages,
            } : it);

            const targetItin = updatedItins.find(it => it.id === action.id);
            if (targetItin) {
                const annotationTools = ['annotate_point', 'annotate_area', 'annotate_area_routed', 'annotate_draw', 'annotate_text'];
                const nextTool = annotationTools.includes(state.active_tool) ? state.active_tool : 'route';
                return {
                    ...state,
                    itineraries: updatedItins,
                    active_itinerary_id: targetItin.id,
                    selected_layer_id: targetItin.id,
                    selected_sublayer_id: null,
                    active_tool: nextTool,
                    stages: targetItin.stages || [],
                    routes: targetItin.routes || [],
                    polygonal_steps: targetItin.polygonal_steps || [],
                    polygonal_legs: targetItin.polygonal_legs || {},
                    carnet_steps: targetItin.carnet_steps || [],
                    custom_assignments: targetItin.custom_assignments || {},
                    custom_languages: targetItin.custom_languages || {},
                    anchor_stage_idx: (targetItin.stages?.length || 0) - 1
                };
            }

            return {
                ...state,
                itineraries: updatedItins,
                selected_layer_id: action.id,
                selected_sublayer_id: null,
            };
        }

        case 'SET_SELECTED_SUBLAYER': {
            return {
                ...state,
                selected_layer_id: action.layerId,
                selected_sublayer_id: action.sublayerId,
            };
        }

        case 'TOGGLE_ANNOTATION_LAYER_VISIBILITY': {
            const layer = (state.annotation_layers || []).find(l => l.id === action.layerId);
            if (!layer) return state;
            const newVis = !layer.visible;
            return {
                ...state,
                annotation_layers: (state.annotation_layers || []).map(l =>
                    l.id === action.layerId ? { ...l, visible: newVis } : l
                ),
                point_annotations: (state.point_annotations || []).map(p =>
                    p.layerId === action.layerId ? { ...p, visible: newVis } : p
                ),
                area_annotations: (state.area_annotations || []).map(a =>
                    a.layerId === action.layerId ? { ...a, visible: newVis } : a
                )
            };
        }

        case 'ADD_ANNOTATION_LAYER': {
            pushHistory(state);
            const newLayer: AnnotationLayerDef = {
                id: `layer-${Date.now()}`,
                name: action.name,
                type: action.layerType || 'mixed',
                visible: true,
                color: action.color || '#3b82f6',
                isDefault: false
            };
            return {
                ...state,
                annotation_layers: [...(state.annotation_layers || []), newLayer]
            };
        }

        case 'REMOVE_ANNOTATION_LAYER': {
            pushHistory(state);
            return {
                ...state,
                annotation_layers: (state.annotation_layers || []).filter(l => l.id !== action.layerId),
                point_annotations: (state.point_annotations || []).filter(p => p.layerId !== action.layerId),
                area_annotations: (state.area_annotations || []).filter(a => a.layerId !== action.layerId)
            };
        }

        default:
            return null;
    }
}

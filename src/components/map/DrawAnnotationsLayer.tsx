/**
 * DrawAnnotationsLayer — freehand brush drawing on the Leaflet map.
 *
 * Implements a hierarchical Group & Shape architecture (like react-konva & tldraw):
 *   - DrawAnnotation = Group
 *   - DrawStroke = Shape (sub-layer)
 *   - Integrated vector <Transformer /> with Bounding Box, 8 scale handles,
 *     and rotation handle that operates on either individual strokes or the entire group.
 *   - Ctrl+T shortcut support
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import type { DrawAnnotation, DrawStroke } from '../../logic/types';
import { layerPaneName } from '../../logic/LayerOrder';
import Transformer, { TransformerTarget } from './Transformer';

const MIN_SAMPLE_PX = 4;

export default function DrawAnnotationsLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const activeTool = state.active_tool;
    const isDrawTool = activeTool === 'annotate_draw';

    const draws: DrawAnnotation[] = state.draw_annotations || [];
    const selectedLayerId = state.selected_layer_id;
    const selectedSublayerId = state.selected_sublayer_id;

    // Active draw annotation id being drawn into
    const activeDrawIdRef = useRef<string | null>(null);
    const [activeDrawId, setActiveDrawId] = useState<string | null>(null);

    // Live stroke being drawn right now (before pointerup)
    const liveStrokeRef = useRef<[number, number][]>([]);
    const [liveStroke, setLiveStroke] = useState<[number, number][]>([]);
    const isDrawingRef = useRef(false);
    const lastPixelRef = useRef<[number, number] | null>(null);

    // Live transform preview strokes (during move/scale/rotate)
    const [livePreviewStrokes, setLivePreviewStrokes] = useState<Array<{ id: string; points: [number, number][] }> | null>(null);

    // Active draw config for in-progress stroke
    const activeDrawRef = useRef<DrawAnnotation | null>(null);
    useEffect(() => {
        activeDrawRef.current = draws.find(d => d.id === activeDrawId) ?? null;
    }, [draws, activeDrawId]);

    // Reset when leaving draw tool
    useEffect(() => {
        if (!isDrawTool) {
            activeDrawIdRef.current = null;
            setActiveDrawId(null);
            liveStrokeRef.current = [];
            setLiveStroke([]);
            isDrawingRef.current = false;
        }
    }, [isDrawTool]);

    // Ensure map dragging is disabled while in draw mode so panning does not conflict
    useEffect(() => {
        const container = map.getContainer();
        if (isDrawTool) {
            map.dragging.disable();
            container.style.cursor = 'crosshair';
        } else {
            map.dragging.enable();
            container.style.cursor = '';
        }
        return () => {
            map.dragging.enable();
            container.style.cursor = '';
        };
    }, [isDrawTool, map]);

    // Ensure a draw annotation exists and return it
    const ensureActiveDraw = useCallback(() => {
        // 1. If activeDrawIdRef is set and still exists, use it
        if (activeDrawIdRef.current) {
            const existing = draws.find(d => d.id === activeDrawIdRef.current);
            if (existing) {
                activeDrawRef.current = existing;
                return existing;
            }
        }
        // 2. If the user currently has a draw layer selected, draw into it
        if (selectedLayerId) {
            const selectedDraw = draws.find(d => d.id === selectedLayerId);
            if (selectedDraw) {
                activeDrawIdRef.current = selectedDraw.id;
                setActiveDrawId(selectedDraw.id);
                activeDrawRef.current = selectedDraw;
                return selectedDraw;
            }
        }
        // 3. Otherwise, if no draw layer is selected, create a brand-new draw annotation
        const id = `draw-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        activeDrawIdRef.current = id;
        setActiveDrawId(id);
        const drawCount = (state.draw_annotations?.length || 0) + 1;
        const newDraw: DrawAnnotation = {
            id,
            type: 'draw' as const,
            layerId: 'layer-draws',
            title: `Dessin ${drawCount}`,
            visible: true,
            color: '#ef4444',
            strokeWidth: 4,
            opacity: 0.85,
            strokes: [],
            createdAt: Date.now(),
        };
        activeDrawRef.current = newDraw;
        dispatch({
            type: 'ADD_DRAW_ANNOTATION',
            draw: newDraw,
        });
        return newDraw;
    }, [dispatch, state.draw_annotations?.length, draws, selectedLayerId]);

    // ── Pointer events on map container (freehand drawing) ─────────────
    useEffect(() => {
        if (!isDrawTool) return;
        const container = map.getContainer();

        const onDown = (e: PointerEvent) => {
            if (e.button !== 0 && e.pointerType !== 'touch') return;
            // Ignore if pointer is down on a transformer handle, rotation knob,
            // a map marker (repère, étape, nœud…) or a Leaflet popup/control.
            // Let the marker receive its own click so it can be selected/edited
            // instead of starting a stray brush stroke on top of it.
            const targetEl = e.target as HTMLElement | null;
            if (
                targetEl?.closest?.('[data-transformer-handle], .leaflet-marker-icon, .leaflet-popup, .leaflet-control') ||
                (window as any).__markerDragging
            ) {
                return;
            }

            e.preventDefault();
            isDrawingRef.current = true;
            liveStrokeRef.current = [];
            lastPixelRef.current = null;
            setLiveStroke([]);

            ensureActiveDraw();

            // Native Leaflet conversion to avoid tile-relative offsetX / offsetY bugs
            const latlng = map.mouseEventToLatLng(e);
            const containerPt = map.mouseEventToContainerPoint(e);
            const pt: [number, number] = [latlng.lat, latlng.lng];

            liveStrokeRef.current = [pt];
            lastPixelRef.current = [containerPt.x, containerPt.y];
            setLiveStroke([pt]);

            try {
                container.setPointerCapture(e.pointerId);
            } catch (_) {}
        };

        const onMove = (e: PointerEvent) => {
            if (!isDrawingRef.current) return;
            const last = lastPixelRef.current;
            const pt = map.mouseEventToContainerPoint(e);
            if (last) {
                const dx = pt.x - last[0];
                const dy = pt.y - last[1];
                if (Math.hypot(dx, dy) < MIN_SAMPLE_PX) return;
            }
            const latlng = map.mouseEventToLatLng(e);
            const newPt: [number, number] = [latlng.lat, latlng.lng];
            liveStrokeRef.current = [...liveStrokeRef.current, newPt];
            lastPixelRef.current = [pt.x, pt.y];
            setLiveStroke([...liveStrokeRef.current]);
        };

        const onUp = (e: PointerEvent) => {
            if (!isDrawingRef.current) return;
            isDrawingRef.current = false;

            try {
                if (container.hasPointerCapture(e.pointerId)) {
                    container.releasePointerCapture(e.pointerId);
                }
            } catch (_) {}

            const pts = liveStrokeRef.current;
            const drawId = activeDrawIdRef.current;
            let finalPts = pts;

            // If user single-tapped/clicked without dragging, create a tiny dot segment
            if (finalPts.length === 1) {
                finalPts = [finalPts[0], [finalPts[0][0] + 0.000001, finalPts[0][1] + 0.000001]];
            }

            if (finalPts.length >= 2 && drawId) {
                const draw = activeDrawRef.current || draws.find(d => d.id === drawId);
                const strokeObj: DrawStroke = {
                    id: `stroke-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    points: finalPts,
                    color: draw?.color || '#ef4444',
                    strokeWidth: draw?.strokeWidth || 4,
                    opacity: draw?.opacity || 0.85,
                    createdAt: Date.now(),
                };
                dispatch({ type: 'APPEND_DRAW_STROKE', id: drawId, stroke: strokeObj as any });
                // Automatically select the freshly committed stroke with Transformer
                dispatch({ type: 'SET_SELECTED_SUBLAYER', layerId: drawId, sublayerId: strokeObj.id });
            }
            liveStrokeRef.current = [];
            setLiveStroke([]);
            lastPixelRef.current = null;
        };

        container.addEventListener('pointerdown', onDown);
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup', onUp);
        container.addEventListener('pointerleave', onUp);
        return () => {
            container.removeEventListener('pointerdown', onDown);
            container.removeEventListener('pointermove', onMove);
            container.removeEventListener('pointerup', onUp);
            container.removeEventListener('pointerleave', onUp);
        };
    }, [isDrawTool, map, dispatch, ensureActiveDraw, draws]);

    // ── Keyboard shortcuts (Ctrl+T, Delete, Escape) ────────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
                e.preventDefault();
                // If a stroke is selected, switch to group selection; if group is selected, deselect
                if (selectedLayerId) {
                    if (selectedSublayerId) {
                        dispatch({ type: 'SET_SELECTED_SUBLAYER', layerId: selectedLayerId, sublayerId: null });
                    } else {
                        dispatch({ type: 'SET_SELECTED_LAYER', id: null });
                    }
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                const targetEl = e.target as HTMLElement;
                if (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.isContentEditable) return;

                if (selectedLayerId && selectedSublayerId) {
                    e.preventDefault();
                    dispatch({ type: 'REMOVE_DRAW_STROKE', drawId: selectedLayerId, strokeId: selectedSublayerId } as any);
                } else if (selectedLayerId) {
                    const isDraw = draws.some(d => d.id === selectedLayerId);
                    if (isDraw) {
                        e.preventDefault();
                        dispatch({ type: 'REMOVE_DRAW_ANNOTATION', id: selectedLayerId } as any);
                    }
                }
            } else if (e.key === 'Escape') {
                if (selectedLayerId) {
                    dispatch({ type: 'SET_SELECTED_LAYER', id: null });
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [selectedLayerId, selectedSublayerId, draws, dispatch]);

    // ── Build Transformer Target ──────────────────────────────────────
    const selectedDraw = draws.find(d => d.id === selectedLayerId);
    let transformerTarget: TransformerTarget | null = null;

    if (selectedDraw && selectedDraw.visible) {
        if (selectedSublayerId) {
            // Individual stroke (sub-layer) selected
            const stroke = selectedDraw.strokes.find(s => s.id === selectedSublayerId);
            if (stroke && stroke.points.length >= 2) {
                const preview = livePreviewStrokes?.find(p => p.id === stroke.id);
                transformerTarget = {
                    kind: 'stroke',
                    drawId: selectedDraw.id,
                    strokeId: stroke.id,
                    title: `Trait · ${selectedDraw.title}`,
                    color: stroke.color,
                    strokes: [{ id: stroke.id, points: preview ? preview.points : stroke.points }],
                };
            }
        } else if (selectedDraw.strokes.length > 0) {
            // Entire draw group selected
            const validStrokes = selectedDraw.strokes.filter(s => s.points.length >= 2);
            if (validStrokes.length > 0) {
                transformerTarget = {
                    kind: 'group',
                    drawId: selectedDraw.id,
                    title: `${selectedDraw.title} (${validStrokes.length} trait${validStrokes.length > 1 ? 's' : ''})`,
                    color: selectedDraw.color,
                    strokes: validStrokes.map(s => {
                        const preview = livePreviewStrokes?.find(p => p.id === s.id);
                        return { id: s.id, points: preview ? preview.points : s.points };
                    }),
                };
            }
        }
    }

    const activeDraw = draws.find(d => d.id === activeDrawId);

    return (
        <>
            {/* ── All committed strokes (hierarchical group & shape rendering) ── */}
            {draws.filter(d => d.visible).map(draw =>
                draw.strokes.map(stroke => {
                    const preview = livePreviewStrokes?.find(s => s.id === stroke.id);
                    const pts = preview ? preview.points : stroke.points;
                    if (pts.length < 2) return null;

                    const isStrokeSelected = selectedLayerId === draw.id && selectedSublayerId === stroke.id;
                    const isGroupSelected = selectedLayerId === draw.id && !selectedSublayerId;

                    return (
                        <React.Fragment key={`stroke-${draw.id}-${stroke.id}`}>
                            {/* Hit-area polyline for easy selection */}
                            <Polyline
                                positions={pts}
                                pane={layerPaneName(draw.id)}
                                pathOptions={{
                                    color: 'transparent',
                                    weight: Math.max(stroke.strokeWidth + 12, 18),
                                    interactive: true,
                                } as any}
                                eventHandlers={{
                                    click: (e) => {
                                        L.DomEvent.stopPropagation(e);
                                        // Clicking a stroke selects this specific sublayer
                                        dispatch({ type: 'SET_SELECTED_SUBLAYER', layerId: draw.id, sublayerId: stroke.id });
                                    }
                                }}
                            />
                            {/* Visual stroke */}
                            <Polyline
                                positions={pts}
                                pane={layerPaneName(draw.id)}
                                pathOptions={{
                                    color: stroke.color,
                                    weight: stroke.strokeWidth,
                                    opacity: stroke.opacity,
                                    lineCap: 'round',
                                    lineJoin: 'round',
                                    interactive: false,
                                } as any}
                            />
                            {/* Subtle selection glow outline */}
                            {(isStrokeSelected || isGroupSelected) && (
                                <Polyline
                                    positions={pts}
                                    pane={layerPaneName(draw.id)}
                                    pathOptions={{
                                        color: '#2d8ceb',
                                        weight: stroke.strokeWidth + 3,
                                        opacity: 0.35,
                                        lineCap: 'round',
                                        lineJoin: 'round',
                                        interactive: false,
                                    } as any}
                                />
                            )}
                        </React.Fragment>
                    );
                })
            )}

            {/* ── Live (in-progress) stroke during mouse drag ──────────── */}
            {isDrawTool && liveStroke.length >= 2 && (
                <Polyline
                    positions={liveStroke}
                    pane={activeDrawId ? layerPaneName(activeDrawId) : undefined}
                    pathOptions={{
                        color: activeDrawRef.current?.color || activeDraw?.color || '#ef4444',
                        weight: activeDrawRef.current?.strokeWidth || activeDraw?.strokeWidth || 4,
                        opacity: activeDrawRef.current?.opacity || activeDraw?.opacity || 0.85,
                        lineCap: 'round',
                        lineJoin: 'round',
                        interactive: false,
                    } as any}
                />
            )}

            {/* ── Vector <Transformer /> Bounding Box & Handles ─────────── */}
            {transformerTarget && (
                <Transformer
                    target={transformerTarget}
                    onUpdatePreview={setLivePreviewStrokes}
                    onCommit={(finalStrokes) => {
                        if (transformerTarget.kind === 'stroke' && transformerTarget.strokeId) {
                            dispatch({
                                type: 'UPDATE_DRAW_STROKE',
                                drawId: transformerTarget.drawId,
                                strokeId: transformerTarget.strokeId,
                                patch: { points: finalStrokes[0].points }
                            } as any);
                        } else if (transformerTarget.kind === 'group' && selectedDraw) {
                            const strokeMap = new Map(finalStrokes.map(s => [s.id, s.points]));
                            const updated = selectedDraw.strokes.map(s => ({
                                ...s,
                                points: strokeMap.get(s.id) || s.points
                            }));
                            dispatch({
                                type: 'UPDATE_DRAW_ANNOTATION',
                                id: transformerTarget.drawId,
                                patch: { strokes: updated }
                            } as any);
                        }
                    }}
                    onDelete={() => {
                        if (transformerTarget.kind === 'stroke' && transformerTarget.strokeId) {
                            dispatch({
                                type: 'REMOVE_DRAW_STROKE',
                                drawId: transformerTarget.drawId,
                                strokeId: transformerTarget.strokeId
                            } as any);
                        } else {
                            dispatch({
                                type: 'REMOVE_DRAW_ANNOTATION',
                                id: transformerTarget.drawId
                            } as any);
                        }
                    }}
                />
            )}
        </>
    );
}

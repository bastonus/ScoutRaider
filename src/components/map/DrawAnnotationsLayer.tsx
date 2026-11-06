/**
 * DrawAnnotationsLayer — freehand brush drawing on the Leaflet map.
 *
 * When the "annotate_draw" tool is active:
 *  - Map panning is disabled while the mouse button is held
 *  - Pointer events on the map container are captured
 *  - Points are sampled from mousemove/pointermove and converted to lat/lng
 *  - On mouseup the stroke is committed to the active draw annotation via
 *    APPEND_DRAW_STROKE dispatch
 *
 * When NOT active, all draw annotations are rendered as read-only Polylines.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { DrawAnnotation } from '../../logic/types';

// Minimum distance (px) between sampled points to avoid over-sampling
const MIN_SAMPLE_PX = 4;

export default function DrawAnnotationsLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const activeTool = state.active_tool;
    const isDrawTool = activeTool === 'annotate_draw';

    const draws = state.draw_annotations || [];

    // ── Active draw annotation id ─────────────────────────────────────
    const activeDrawIdRef = useRef<string | null>(null);
    const [activeDrawId, setActiveDrawId] = useState<string | null>(null);

    // ── Current in-progress stroke (local, not in store until complete) ─
    const [liveStroke, setLiveStroke] = useState<[number, number][]>([]);
    const liveStrokeRef = useRef<[number, number][]>([]);
    const isDrawingRef = useRef(false);
    const lastPixelRef = useRef<[number, number] | null>(null);

    // Active draw annotation object (for color/width while rendering live stroke)
    const activeDrawRef = useRef<DrawAnnotation | null>(null);
    useEffect(() => {
        activeDrawRef.current = draws.find(d => d.id === activeDrawId) ?? null;
    }, [draws, activeDrawId]);

    // When tool leaves draw mode, stop drawing
    useEffect(() => {
        if (!isDrawTool) {
            activeDrawIdRef.current = null;
            setActiveDrawId(null);
            liveStrokeRef.current = [];
            setLiveStroke([]);
            isDrawingRef.current = false;
        }
    }, [isDrawTool]);

    // ── Ensure an active draw annotation exists ───────────────────────
    const ensureActiveDrawAnnotation = useCallback(() => {
        if (activeDrawIdRef.current) return activeDrawIdRef.current;
        const id = `draw-annot-${Date.now()}`;
        activeDrawIdRef.current = id;
        setActiveDrawId(id);
        const drawCount = (state.draw_annotations?.length || 0) + 1;
        dispatch({
            type: 'ADD_DRAW_ANNOTATION',
            draw: {
                type: 'draw' as const,
                layerId: 'layer-draws',
                title: `Dessin ${drawCount}`,
                visible: true,
                color: '#ef4444',
                strokeWidth: 4,
                opacity: 0.85,
                strokes: [],
            }
        });
        return id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dispatch]);

    // ── Pointer event handlers on map container ───────────────────────
    useEffect(() => {
        if (!isDrawTool) return;
        const container = map.getContainer();

        const onDown = (e: PointerEvent) => {
            if (e.button !== 0 && e.pointerType !== 'touch') return;
            e.preventDefault();
            map.dragging.disable();
            isDrawingRef.current = true;
            liveStrokeRef.current = [];
            lastPixelRef.current = null;
            setLiveStroke([]);
            ensureActiveDrawAnnotation();
            // Add first point
            const ll = map.containerPointToLatLng(L.point(e.offsetX, e.offsetY));
            const pt: [number, number] = [ll.lat, ll.lng];
            liveStrokeRef.current = [pt];
            lastPixelRef.current = [e.offsetX, e.offsetY];
            setLiveStroke([pt]);
        };

        const onMove = (e: PointerEvent) => {
            if (!isDrawingRef.current) return;
            const last = lastPixelRef.current;
            if (last) {
                const dx = e.offsetX - last[0];
                const dy = e.offsetY - last[1];
                if (Math.sqrt(dx * dx + dy * dy) < MIN_SAMPLE_PX) return;
            }
            const ll = map.containerPointToLatLng(L.point(e.offsetX, e.offsetY));
            const pt: [number, number] = [ll.lat, ll.lng];
            liveStrokeRef.current = [...liveStrokeRef.current, pt];
            lastPixelRef.current = [e.offsetX, e.offsetY];
            setLiveStroke([...liveStrokeRef.current]);
        };

        const onUp = () => {
            if (!isDrawingRef.current) return;
            isDrawingRef.current = false;
            map.dragging.enable();
            const stroke = liveStrokeRef.current;
            if (stroke.length >= 2 && activeDrawIdRef.current) {
                dispatch({ type: 'APPEND_DRAW_STROKE', id: activeDrawIdRef.current, stroke });
            }
            liveStrokeRef.current = [];
            setLiveStroke([]);
            lastPixelRef.current = null;
        };

        container.addEventListener('pointerdown', onDown);
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup',   onUp);
        container.addEventListener('pointerleave', onUp);

        return () => {
            container.removeEventListener('pointerdown', onDown);
            container.removeEventListener('pointermove', onMove);
            container.removeEventListener('pointerup',   onUp);
            container.removeEventListener('pointerleave', onUp);
            map.dragging.enable();
        };
    }, [isDrawTool, map, dispatch, ensureActiveDrawAnnotation]);

    const activeDraw = draws.find(d => d.id === activeDrawId);

    return (
        <>
            {/* ── Committed strokes (all draw annotations) ─────────────── */}
            {draws.filter(d => d.visible).map(draw =>
                draw.strokes.map((stroke, sIdx) => (
                    stroke.length >= 2 && (
                        <Polyline
                            key={`draw-${draw.id}-${sIdx}`}
                            positions={stroke}
                            pathOptions={{
                                color: draw.color,
                                weight: draw.strokeWidth,
                                opacity: draw.opacity,
                                lineCap: 'round',
                                lineJoin: 'round',
                                interactive: false,
                            } as any}
                        />
                    )
                ))
            )}

            {/* ── Live (in-progress) stroke ─────────────────────────────── */}
            {isDrawTool && liveStroke.length >= 2 && activeDraw && (
                <Polyline
                    positions={liveStroke}
                    pathOptions={{
                        color: activeDraw.color,
                        weight: activeDraw.strokeWidth,
                        opacity: activeDraw.opacity,
                        lineCap: 'round',
                        lineJoin: 'round',
                        interactive: false,
                    } as any}
                />
            )}
        </>
    );
}

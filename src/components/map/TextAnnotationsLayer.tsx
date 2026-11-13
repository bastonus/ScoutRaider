/**
 * TextAnnotationsLayer — rotatable, resizable tactical text annotations on Leaflet map.
 *
 * Implements the exact same architecture and capabilities as DrawAnnotationsLayer (react-konva & tldraw):
 *   - TextAnnotation = Group (Calque)
 *   - TextItem = Shape (Sous-calque with 4-corner bounding quad points in [lat, lng])
 *   - Full vector <Transformer /> integration (bounding box, 8 scale handles, rotation knob, translation body)
 *   - Scaling dynamically scales font size and dimensions
 *   - Rotation smoothly spins the text at any angle
 *   - Double-click or Enter for instant inline text editing
 *   - Ctrl+T to toggle between single text item and entire group selection
 *   - Full undo/redo (Ctrl+Z / Ctrl+Y) compatibility
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import type { TextAnnotation, TextItem } from '../../logic/types';
import Transformer, { TransformerTarget } from './Transformer';

export default function TextAnnotationsLayer() {
    const { state, dispatch } = useApp();
    const map = useMap();
    const activeTool = state.active_tool;
    const isTextTool = activeTool === 'annotate_text';

    const textLayers: TextAnnotation[] = state.text_annotations || [];
    const selectedLayerId = state.selected_layer_id;
    const selectedSublayerId = state.selected_sublayer_id;

    // Active text layer being edited
    const activeTextIdRef = useRef<string | null>(null);
    const [, forceUpdate] = useState(0);

    // Live transform preview (during move/scale/rotate)
    const [livePreviewItems, setLivePreviewItems] = useState<Array<{ id: string; points: [number, number][] }> | null>(null);

    // Inline editing state: which text item is currently in typing mode
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editTextValue, setEditTextValue] = useState('');
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Re-render when map moves/zooms so screen coordinates stay locked
    useEffect(() => {
        const onMapMove = () => forceUpdate(n => n + 1);
        map.on('move', onMapMove);
        map.on('zoom', onMapMove);
        map.on('resize', onMapMove);
        return () => {
            map.off('move', onMapMove);
            map.off('zoom', onMapMove);
            map.off('resize', onMapMove);
        };
    }, [map]);

    // Ensure map dragging is disabled while in text mode for placing
    useEffect(() => {
        const container = map.getContainer();
        if (isTextTool) {
            container.style.cursor = 'crosshair';
        } else {
            container.style.cursor = '';
        }
        return () => {
            container.style.cursor = '';
        };
    }, [isTextTool, map]);

    // Focus input when inline editing starts
    useEffect(() => {
        if (editingItemId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingItemId]);

    // Ensure a TextAnnotation group exists and return it
    const ensureActiveTextLayer = useCallback(() => {
        // 1. If currently selected layer is a text annotation, use it
        if (selectedLayerId) {
            const found = textLayers.find(t => t.id === selectedLayerId);
            if (found) {
                activeTextIdRef.current = found.id;
                return found;
            }
        }
        // 2. If activeTextIdRef exists, use it
        if (activeTextIdRef.current) {
            const found = textLayers.find(t => t.id === activeTextIdRef.current);
            if (found) return found;
        }
        // 3. Otherwise create a brand new text layer
        const id = `text-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        activeTextIdRef.current = id;
        const count = textLayers.length + 1;
        const newLayer: TextAnnotation = {
            id,
            type: 'text',
            layerId: 'layer-texts',
            title: `Texte ${count}`,
            visible: true,
            color: '#38bdf8',
            fontSize: 16,
            opacity: 1,
            texts: [],
            createdAt: Date.now(),
        };
        dispatch({
            type: 'ADD_TEXT_ANNOTATION',
            text: newLayer,
        });
        return newLayer;
    }, [dispatch, textLayers, selectedLayerId]);

    // ── Handle map click to place text ──────────────────────────────────
    useEffect(() => {
        if (!isTextTool) return;
        const container = map.getContainer();

        const onClick = (e: MouseEvent) => {
            // Ignore if clicked on a transformer handle, input, or while dragging
            const targetEl = e.target as HTMLElement | null;
            if (
                targetEl?.closest?.('[data-transformer-handle]') ||
                targetEl?.tagName === 'INPUT' ||
                targetEl?.tagName === 'TEXTAREA' ||
                (window as any).__markerDragging
            ) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            const targetLayer = ensureActiveTextLayer();
            const clickPt = map.mouseEventToContainerPoint(e);

            // Default initial size of text box in pixels: 130px wide, 36px high
            const w = 130;
            const h = 36;
            const spTL = L.point(clickPt.x - w / 2, clickPt.y - h / 2);
            const spTR = L.point(clickPt.x + w / 2, clickPt.y - h / 2);
            const spBR = L.point(clickPt.x + w / 2, clickPt.y + h / 2);
            const spBL = L.point(clickPt.x - w / 2, clickPt.y + h / 2);

            const llTL = map.containerPointToLatLng(spTL);
            const llTR = map.containerPointToLatLng(spTR);
            const llBR = map.containerPointToLatLng(spBR);
            const llBL = map.containerPointToLatLng(spBL);

            const initialQuad: [number, number][] = [
                [llTL.lat, llTL.lng],
                [llTR.lat, llTR.lng],
                [llBR.lat, llBR.lng],
                [llBL.lat, llBL.lng],
            ];

            const defaultText = `Texte ${(targetLayer.texts?.length || 0) + 1}`;
            const newItem: TextItem = {
                id: `text-item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                text: defaultText,
                points: initialQuad,
                color: targetLayer.color || '#38bdf8',
                fontSize: targetLayer.fontSize || 16,
                backgroundColor: 'transparent',
                opacity: 1,
                bold: true,
                createdAt: Date.now(),
            };

            dispatch({
                type: 'APPEND_TEXT_ITEM',
                id: targetLayer.id,
                textItem: newItem,
            });

            // Automatically select the freshly committed text item with Transformer
            dispatch({
                type: 'SET_SELECTED_SUBLAYER',
                layerId: targetLayer.id,
                sublayerId: newItem.id,
            });

            // Open inline editor immediately for seamless typing
            setEditingItemId(newItem.id);
            setEditTextValue(defaultText);
        };

        container.addEventListener('click', onClick);
        return () => {
            container.removeEventListener('click', onClick);
        };
    }, [isTextTool, map, dispatch, ensureActiveTextLayer]);

    // ── Save text edits ────────────────────────────────────────────────
    const commitTextEdit = useCallback((textLayerId: string, itemId: string, value: string) => {
        const trimmed = value.trim();
        if (trimmed) {
            dispatch({
                type: 'UPDATE_TEXT_ITEM',
                textId: textLayerId,
                itemId,
                patch: { text: trimmed },
            });
        }
        setEditingItemId(null);
    }, [dispatch]);

    // ── Keyboard shortcuts (Ctrl+T, Delete, F2, Escape) ─────────────────
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            // Ignore while actively typing in the input
            if (editingItemId) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (selectedLayerId && editingItemId) {
                        commitTextEdit(selectedLayerId, editingItemId, editTextValue);
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setEditingItemId(null);
                }
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
                e.preventDefault();
                // Toggle between single text item and entire group selection
                if (selectedLayerId) {
                    if (selectedSublayerId) {
                        dispatch({ type: 'SET_SELECTED_SUBLAYER', layerId: selectedLayerId, sublayerId: null });
                    } else {
                        dispatch({ type: 'SET_SELECTED_LAYER', id: null });
                    }
                }
            } else if (e.key === 'F2') {
                if (selectedLayerId && selectedSublayerId) {
                    e.preventDefault();
                    const layer = textLayers.find(l => l.id === selectedLayerId);
                    const item = layer?.texts.find(t => t.id === selectedSublayerId);
                    if (item) {
                        setEditingItemId(item.id);
                        setEditTextValue(item.text);
                    }
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                const targetEl = e.target as HTMLElement;
                if (targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.isContentEditable) return;

                if (selectedLayerId && selectedSublayerId) {
                    e.preventDefault();
                    dispatch({ type: 'REMOVE_TEXT_ITEM', textId: selectedLayerId, itemId: selectedSublayerId });
                } else if (selectedLayerId) {
                    const isText = textLayers.some(t => t.id === selectedLayerId);
                    if (isText) {
                        e.preventDefault();
                        dispatch({ type: 'REMOVE_TEXT_ANNOTATION', id: selectedLayerId });
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
    }, [selectedLayerId, selectedSublayerId, textLayers, editingItemId, editTextValue, commitTextEdit, dispatch]);

    // ── Build Transformer Target ────────────────────────────────────────
    const selectedTextLayer = textLayers.find(t => t.id === selectedLayerId);
    let transformerTarget: TransformerTarget | null = null;

    if (selectedTextLayer && selectedTextLayer.visible) {
        if (selectedSublayerId) {
            // Individual text item selected
            const item = selectedTextLayer.texts.find(t => t.id === selectedSublayerId);
            if (item && item.points.length >= 4) {
                const preview = livePreviewItems?.find(p => p.id === item.id);
                transformerTarget = {
                    kind: 'stroke',
                    drawId: selectedTextLayer.id,
                    strokeId: item.id,
                    title: `Texte · ${item.text}`,
                    color: item.color,
                    strokes: [{ id: item.id, points: preview ? preview.points : item.points }],
                };
            }
        } else if (selectedTextLayer.texts.length > 0) {
            // Entire text group selected
            const validTexts = selectedTextLayer.texts.filter(t => t.points.length >= 4);
            if (validTexts.length > 0) {
                transformerTarget = {
                    kind: 'group',
                    drawId: selectedTextLayer.id,
                    title: `${selectedTextLayer.title} (${validTexts.length} texte${validTexts.length > 1 ? 's' : ''})`,
                    color: selectedTextLayer.color,
                    strokes: validTexts.map(t => {
                        const preview = livePreviewItems?.find(p => p.id === t.id);
                        return { id: t.id, points: preview ? preview.points : t.points };
                    }),
                };
            }
        }
    }

    return (
        <>
            {/* ── All committed text items ── */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1150 }}>
                {textLayers.filter(l => l.visible).map(layer =>
                    layer.texts.map(item => {
                        const preview = livePreviewItems?.find(p => p.id === item.id);
                        const pts = preview ? preview.points : item.points;
                        if (!pts || pts.length < 4) return null;

                        // Calculate projected container positions of the 4 quad corners
                        const spTL = map.latLngToContainerPoint([pts[0][0], pts[0][1]]);
                        const spTR = map.latLngToContainerPoint([pts[1][0], pts[1][1]]);
                        const spBL = map.latLngToContainerPoint([pts[3][0], pts[3][1]]);

                        const width = Math.max(Math.hypot(spTR.x - spTL.x, spTR.y - spTL.y), 30);
                        const height = Math.max(Math.hypot(spBL.x - spTL.x, spBL.y - spTL.y), 18);
                        const angleDeg = Math.atan2(spTR.y - spTL.y, spTR.x - spTL.x) * (180 / Math.PI);

                        // Dynamic scaled font size: proportional to current transformed height
                        const dynamicFontSize = Math.max(9, Math.round(item.fontSize * (height / 36)));

                        const isSelected = selectedLayerId === layer.id && selectedSublayerId === item.id;
                        const isGroupSelected = selectedLayerId === layer.id && !selectedSublayerId;
                        const isEditing = editingItemId === item.id;
                        const hasBg = Boolean(item.backgroundColor && item.backgroundColor !== 'transparent');
                        const isOtherCreationTool = [
                            'route', 'route_direct', 'annotate_point', 'annotate_area', 
                            'annotate_area_routed', 'annotate_draw', 'node', 'azimut'
                        ].includes(activeTool);
                        const canInteractWithText = isTextTool || !isOtherCreationTool;

                        return (
                            <div
                                key={`text-${layer.id}-${item.id}`}
                                title={canInteractWithText ? `Texte : "${item.text}" — Double-clic : éditer · Clic : déplacer` : undefined}
                                style={{
                                    position: 'absolute',
                                    left: spTL.x,
                                    top: spTL.y,
                                    width: `${width}px`,
                                    height: `${height}px`,
                                    transform: `rotate(${angleDeg}deg)`,
                                    transformOrigin: 'top left',
                                    pointerEvents: canInteractWithText ? 'auto' : 'none',
                                    cursor: isEditing ? 'text' : (canInteractWithText ? 'pointer' : 'default'),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '2px 8px',
                                    background: hasBg ? item.backgroundColor : 'transparent',
                                    border: isSelected
                                        ? `2px solid #2d8ceb`
                                        : isGroupSelected
                                        ? `1.5px dashed rgba(45, 140, 235, 0.6)`
                                        : isEditing
                                        ? `1px dashed rgba(45, 140, 235, 0.8)`
                                        : hasBg
                                        ? `1px solid rgba(255, 255, 255, 0.18)`
                                        : 'none',
                                    borderRadius: hasBg ? '5px' : '2px',
                                    boxShadow: isSelected
                                        ? '0 0 14px rgba(45, 140, 235, 0.5)'
                                        : hasBg
                                        ? '0 2px 8px rgba(0,0,0,0.5)'
                                        : 'none',
                                    color: item.color,
                                    fontSize: `${dynamicFontSize}px`,
                                    fontWeight: item.bold ? 700 : 500,
                                    fontStyle: item.italic ? 'italic' : 'normal',
                                    opacity: item.opacity,
                                    userSelect: 'none',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    textShadow: hasBg
                                        ? 'none'
                                        : '0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9)',
                                    backdropFilter: hasBg ? 'blur(6px)' : 'none',
                                    transition: livePreviewItems ? 'none' : 'border-color 0.15s',
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isEditing) {
                                        dispatch({ type: 'SET_SELECTED_SUBLAYER', layerId: layer.id, sublayerId: item.id });
                                    }
                                }}
                                onDoubleClick={(e) => {
                                    e.stopPropagation();
                                    setEditingItemId(item.id);
                                    setEditTextValue(item.text);
                                }}
                            >
                                {isEditing ? (
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={editTextValue}
                                        onChange={(e) => setEditTextValue(e.target.value)}
                                        onBlur={() => commitTextEdit(layer.id, item.id, editTextValue)}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            color: item.color,
                                            fontSize: `${dynamicFontSize}px`,
                                            fontWeight: item.bold ? 700 : 500,
                                            textAlign: 'center',
                                            padding: 0,
                                            margin: 0,
                                            textShadow: hasBg ? 'none' : '0 0 3px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.9)',
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    <span style={{ pointerEvents: 'none' }}>{item.text}</span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* ── Vector <Transformer /> Bounding Box & Handles ─────────── */}
            {transformerTarget && (
                <Transformer
                    target={transformerTarget}
                    onUpdatePreview={setLivePreviewItems}
                    onCommit={(finalStrokes) => {
                        if (transformerTarget.kind === 'stroke' && transformerTarget.strokeId) {
                            dispatch({
                                type: 'UPDATE_TEXT_ITEM',
                                textId: transformerTarget.drawId,
                                itemId: transformerTarget.strokeId,
                                patch: { points: finalStrokes[0].points }
                            });
                        } else if (transformerTarget.kind === 'group' && selectedTextLayer) {
                            const strokeMap = new Map(finalStrokes.map(s => [s.id, s.points]));
                            const updated = selectedTextLayer.texts.map(t => ({
                                ...t,
                                points: strokeMap.get(t.id) || t.points
                            }));
                            dispatch({
                                type: 'UPDATE_TEXT_ANNOTATION',
                                id: transformerTarget.drawId,
                                patch: { texts: updated }
                            });
                        }
                    }}
                    onDelete={() => {
                        if (transformerTarget.kind === 'stroke' && transformerTarget.strokeId) {
                            dispatch({
                                type: 'REMOVE_TEXT_ITEM',
                                textId: transformerTarget.drawId,
                                itemId: transformerTarget.strokeId
                            });
                        } else {
                            dispatch({
                                type: 'REMOVE_TEXT_ANNOTATION',
                                id: transformerTarget.drawId
                            });
                        }
                    }}
                />
            )}
        </>
    );
}

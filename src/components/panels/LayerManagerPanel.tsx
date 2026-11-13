import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Trash2, Route, MapPin, Maximize2, Pencil, Check, X, GripVertical, Paintbrush, ChevronRight, ChevronDown, Type } from 'lucide-react';
import { useApp } from '../../AppContext';
import { mapRef } from '../map/MapComponent';
import { calculatePolygonArea, formatArea } from '../../logic/GeoUtils';
import { PRESET_COLORS } from '../map/AnnotationModals';
import { Itinerary, PointAnnotation, AreaAnnotation, DrawAnnotation, DrawStroke, TextAnnotation, TextItem } from '../../logic/types';
import { computeLayerOrder, layerOrdersEqual, type LayerOrderItem } from '../../logic/LayerOrder';

// ─── Types ───────────────────────────────────────────────────────────
type OrderItem = LayerOrderItem;

// ─── Icons ───────────────────────────────────────────────────────────
function PolygonIcon({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 20 8 17 18 7 18 4 8 12 2" />
        </svg>
    );
}

// ─── Context Menu ────────────────────────────────────────────────────
interface CtxMenuItem { icon?: React.ReactNode; label: string; shortcut?: string; danger?: boolean; onClick: () => void; }
interface CtxMenuSeparator { separator: true; }

function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: (CtxMenuItem | CtxMenuSeparator)[]; onClose: () => void; }) {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x, y });

    useEffect(() => {
        const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', handler, true);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', handler, true); document.removeEventListener('keydown', esc); };
    }, [onClose]);

    useEffect(() => {
        if (!ref.current) return;
        const r = ref.current.getBoundingClientRect();
        setPos({ x: r.right > window.innerWidth ? Math.max(0, x - r.width) : x, y: r.bottom > window.innerHeight ? Math.max(0, y - r.height) : y });
    }, [x, y]);

    return (
        <div ref={ref} onContextMenu={e => e.preventDefault()}
            style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '4px', minWidth: '190px', boxShadow: 'var(--shadow-lg)' }}>
            {items.map((item, i) => 'separator' in item
                ? <div key={i} style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '3px 0' }} />
                : <button key={i} type="button" onClick={() => { item.onClick(); onClose(); }}
                    onMouseEnter={e => { e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 'var(--radius-xs)', color: item.danger ? 'var(--semantic-danger)' : 'var(--text-bright)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 100ms ease' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.icon && <span style={{ opacity: 0.7, flexShrink: 0 }}>{item.icon}</span>}
                        {item.label}
                    </span>
                    {item.shortcut && (
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', opacity: 0.65, fontFamily: 'monospace', marginLeft: 'auto', padding: '1px 5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px' }}>
                            {item.shortcut}
                        </span>
                    )}
                </button>
            )}
        </div>
    );
}

// ─── Color picker ────────────────────────────────────────────────────
function ColorPickerPopup({ x, y, currentColor, onPick, onClose }: { x: number; y: number; currentColor: string; onPick: (c: string) => void; onClose: () => void; }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
        document.addEventListener('mousedown', h, true);
        return () => document.removeEventListener('mousedown', h, true);
    }, [onClose]);
    return (
        <div ref={ref} onContextMenu={e => e.preventDefault()}
            style={{ position: 'fixed', left: x, top: y, zIndex: 10000, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px', boxShadow: 'var(--shadow-lg)', display: 'flex', flexWrap: 'wrap', gap: '6px', maxWidth: '170px' }}>
            {PRESET_COLORS.map(c => (
                <div key={c.value} title={c.label} onClick={() => { onPick(c.value); onClose(); }}
                    style={{ width: '18px', height: '18px', borderRadius: 'var(--radius-xs)', background: c.value, cursor: 'pointer', boxShadow: currentColor === c.value ? '0 0 0 2px var(--text-primary)' : 'none', transform: currentColor === c.value ? 'scale(1.1)' : 'scale(1)', transition: 'transform 100ms ease' }}
                />
            ))}
        </div>
    );
}

// ─── Inline rename ───────────────────────────────────────────────────
function InlineRename({ value, onConfirm, onCancel }: { value: string; onConfirm: (v: string) => void; onCancel: () => void; }) {
    const [v, setV] = useState(value);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.select(); }, []);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
            <input ref={ref} value={v} onChange={e => setV(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onConfirm(v); if (e.key === 'Escape') onCancel(); }}
                style={{ flex: 1, minWidth: 0, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(110,201,126,0.4)', borderRadius: '5px', padding: '2px 6px', color: '#fff', fontSize: '11px', fontWeight: 600, outline: 'none' }}
                autoFocus />
            <button type="button" onClick={() => onConfirm(v)} style={{ background: 'transparent', border: 'none', color: '#6ec97e', cursor: 'pointer', padding: '1px', display: 'flex' }}><Check size={12} /></button>
            <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '1px', display: 'flex' }}><X size={12} /></button>
        </div>
    );
}

// ─── Layer row ───────────────────────────────────────────────────────
function LayerRow({ icon, label, sublabel, color, visible, isEditing, isSelected, onToggleVisible, onContextMenu, renameSlot, dragHandleProps, expandToggle }: {
    icon: React.ReactNode; label: string; sublabel?: string; color: string;
    visible: boolean; isEditing: boolean; isSelected?: boolean;
    onToggleVisible: () => void; onContextMenu: (e: React.MouseEvent) => void;
    renameSlot?: React.ReactNode;
    dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
    expandToggle?: React.ReactNode;
}) {
    const bg = isSelected ? 'rgba(110,201,126,0.12)' : 'transparent';
    const borderL = isSelected ? '#6ec97e' : 'transparent';
    return (
        <div onContextMenu={onContextMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px 6px 6px', background: bg, borderLeft: `2px solid ${borderL}`, cursor: 'pointer', transition: 'background 0.12s', outline: isSelected ? '1px solid rgba(110,201,126,0.22)' : 'none', outlineOffset: '-1px' }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
        >
            {/* Expand / collapse chevron (for groups) or drag handle */}
            {expandToggle || (
                <span {...dragHandleProps} onClick={e => e.stopPropagation()} style={{ color: 'rgba(255,255,255,0.2)', cursor: 'grab', display: 'flex', flexShrink: 0, touchAction: 'none', ...dragHandleProps?.style }}>
                    <GripVertical size={13} />
                </span>
            )}

            {/* Eye */}
            <button type="button" onClick={e => { e.stopPropagation(); onToggleVisible(); }}
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: visible ? color : 'rgba(255,255,255,0.2)', display: 'flex', flexShrink: 0 }}>
                {visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>

            {/* Color dot */}
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />

            {/* Type icon */}
            <span style={{ color: isSelected ? '#6ec97e' : 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{icon}</span>

            {/* Label or rename */}
            {isEditing && renameSlot
                ? renameSlot
                : (
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: isSelected ? 600 : 500, color: isSelected ? '#fff' : 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {label}
                            </span>
                        </div>
                        {sublabel && <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px' }}>{sublabel}</div>}
                    </div>
                )}

            {/* ⋮ menu button */}
            {!isEditing && (
                <button type="button" onClick={e => { e.stopPropagation(); onContextMenu(e); }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                    style={{ background: 'transparent', border: 'none', padding: '2px 4px', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', display: 'flex', flexShrink: 0, borderRadius: '4px' }}
                    title="Options (clic droit)">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                    </svg>
                </button>
            )}
        </div>
    );
}

// ─── Main ────────────────────────────────────────────────────────────
export default function LayerManagerPanel() {
    const { state, dispatch } = useApp();

    const itineraries  = state.itineraries || [];
    const activeItinId = state.active_itinerary_id;
    const points       = state.point_annotations || [];
    const areas        = state.area_annotations  || [];
    const draws        = (state as any).draw_annotations as DrawAnnotation[] || [];
    const texts        = (state as any).text_annotations as TextAnnotation[] || [];
    const selectedId   = state.selected_layer_id;
    const selectedSublayerId = state.selected_sublayer_id;

    // ── Flat ordered list (local + store synchronized) ───────────────
    const savedLayerOrder = (state as any).layer_order as OrderItem[] || [];
    const [order, setOrder] = useState<OrderItem[]>([]);
    const [expandedDrawIds, setExpandedDrawIds] = useState<Set<string>>(new Set());
    const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());
    const listRef = useRef<HTMLDivElement>(null);

    // Auto-expand draw group when selected
    useEffect(() => {
        if (selectedId && draws.some(d => d.id === selectedId)) {
            setExpandedDrawIds(prev => new Set(prev).add(selectedId));
        }
    }, [selectedId, draws]);

    // Auto-expand text group when selected
    useEffect(() => {
        if (selectedId && texts.some(t => t.id === selectedId)) {
            setExpandedTextIds(prev => new Set(prev).add(selectedId));
        }
    }, [selectedId, texts]);

    useEffect(() => {
        const next = computeLayerOrder({
            itineraries,
            points,
            areas,
            draws,
            texts,
            savedOrder: savedLayerOrder,
            currentOrder: order,
            selectedId: state.selected_layer_id,
        });
        setOrder(prev => layerOrdersEqual(prev, next) ? prev : next);
        // Keep the persisted order in sync (without an undo entry) so the map
        // applies the exact same z-order as the panel, including new layers.
        if (!layerOrdersEqual(savedLayerOrder, next)) {
            dispatch({ type: 'SET_LAYER_ORDER', order: next, recordHistory: false });
        }
    }, [itineraries, points, areas, draws, texts, state.selected_layer_id, savedLayerOrder, order, dispatch]);

    // ── Selecting a layer row ─────────────────────────────────────────
    const handleSelectRow = (item: OrderItem) => {
        const isAlreadySelected = selectedId === item.id;
        const nextId = isAlreadySelected ? null : item.id;
        dispatch({ type: 'SET_SELECTED_LAYER', id: nextId });

        if (nextId) {
            if (item.kind === 'area') {
                const area = areas.find(a => a.id === item.id);
                // When an area is selected, ALWAYS activate area tool so sommets are visible and draggable!
                const targetTool = area?.followRoads ? 'annotate_area_routed' : 'annotate_area';
                if (state.active_tool !== targetTool) {
                    dispatch({ type: 'SET_ACTIVE_TOOL', tool: targetTool });
                }
            } else if (item.kind === 'draw') {
                if (state.active_tool !== 'annotate_draw') {
                    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_draw' });
                }
            } else if (item.kind === 'text') {
                if (state.active_tool !== 'annotate_text') {
                    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_text' });
                }
            } else if (item.kind === 'itin') {
                if (state.active_tool !== 'route') {
                    dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
                }
            }
        }
    };

    // ── Context menu + color picker + rename ──────────────────────────
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: (CtxMenuItem | CtxMenuSeparator)[] } | null>(null);
    const [colorPicker, setColorPicker] = useState<{ x: number; y: number; currentColor: string; onPick: (c: string) => void } | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const closeCtx   = useCallback(() => setCtxMenu(null), []);
    const closeColor = useCallback(() => setColorPicker(null), []);

    // ── Drag & drop ───────────────────────────────────────────────────
    const dragIdx    = useRef<number | null>(null);
    const [dropOver, setDropOver] = useState<number | null>(null);

    const handleDragStart = (idx: number) => { dragIdx.current = idx; };
    const handleDragOver  = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDropOver(idx); };
    const handleDrop      = (idx: number) => {
        if (dragIdx.current === null || dragIdx.current === idx) { dragIdx.current = null; setDropOver(null); return; }
        const next = [...order];
        const [moved] = next.splice(dragIdx.current, 1);
        next.splice(idx, 0, moved);
        setOrder(next);
        dispatch({ type: 'SET_LAYER_ORDER', order: next as any });
        dragIdx.current = null;
        setDropOver(null);
    };
    const handleDragEnd = () => { dragIdx.current = null; setDropOver(null); };

    // ── Helpers ───────────────────────────────────────────────────────
    const flyTo    = (coords: [number, number]) => mapRef.current?.flyTo(coords, Math.max(mapRef.current.getZoom(), 15), { duration: 0.8 });
    const fitBounds = (coords: [number, number][]) => { if (coords.length > 0) mapRef.current?.fitBounds(coords, { padding: [40, 40], maxZoom: 16 }); };
    const getItinKm = (itin: Itinerary) => {
        const routes = itin.id === activeItinId ? state.routes : (itin.routes || []);
        return routes.reduce((acc, r) => acc + (r?.distance_m || 0), 0) / 1000;
    };

    // ── Keyboard shortcuts ────────────────────────────────────────────
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (renamingId) return; // Let InlineRename handle keys
        const idx = order.findIndex(x => x.id === selectedId);

        switch (e.key) {
            case 'ArrowUp': {
                e.preventDefault();
                const nextItem = idx > 0 ? order[idx - 1] : order[order.length - 1];
                if (nextItem) handleSelectRow(nextItem);
                break;
            }
            case 'ArrowDown': {
                e.preventDefault();
                const nextItem = idx < order.length - 1 ? order[idx + 1] : order[0];
                if (nextItem) handleSelectRow(nextItem);
                break;
            }
            case 'F2':
                e.preventDefault();
                if (selectedId) setRenamingId(selectedId);
                break;
            case 'Delete':
            case 'Backspace': {
                e.preventDefault();
                if (!selectedId) break;
                const item = order.find(x => x.id === selectedId);
                if (!item) break;
                if (item.kind === 'itin') {
                    const itin = itineraries.find(x => x.id === selectedId);
                    if (itin && window.confirm(`Supprimer "${itin.name}" ?`))
                        dispatch({ type: 'REMOVE_ITINERARY', id: selectedId });
                } else if (item.kind === 'point') {
                    dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: selectedId });
                } else if (item.kind === 'area') {
                    dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: selectedId });
                } else if (item.kind === 'draw') {
                    dispatch({ type: 'REMOVE_DRAW_ANNOTATION', id: selectedId } as any);
                }
                dispatch({ type: 'SET_SELECTED_LAYER', id: null });
                break;
            }
            case ' ': {
                e.preventDefault();
                if (!selectedId) break;
                const item2 = order.find(x => x.id === selectedId);
                if (!item2) break;
                if (item2.kind === 'itin')  dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: selectedId });
                if (item2.kind === 'point') dispatch({ type: 'TOGGLE_POINT_VISIBILITY',    id: selectedId });
                if (item2.kind === 'area')  dispatch({ type: 'TOGGLE_AREA_VISIBILITY',     id: selectedId });
                if (item2.kind === 'draw')  dispatch({ type: 'TOGGLE_DRAW_VISIBILITY',     id: selectedId } as any);
                break;
            }
            case 'Enter': {
                if (selectedId) {
                    const item3 = order.find(x => x.id === selectedId);
                    if (item3?.kind === 'itin') dispatch({ type: 'SET_ACTIVE_ITINERARY', id: selectedId });
                }
                break;
            }
            case 'Escape':
                dispatch({ type: 'SET_SELECTED_LAYER', id: null });
                break;
        }
    };

    // ── Context menu builders with shortcut hints ─────────────────────
    const openItinCtx = (e: React.MouseEvent, itin: Itinerary) => {
        e.preventDefault(); e.stopPropagation();
        const isSelected = itin.id === selectedId;
        setCtxMenu({ x: e.clientX, y: e.clientY, items: [
            { icon: <Pencil size={13} />, label: 'Renommer', shortcut: 'F2', onClick: () => setRenamingId(itin.id) },
            { icon: <div style={{ width: 13, height: 13, borderRadius: 3, background: itin.color }} />, label: 'Changer la couleur', onClick: () => setColorPicker({ x: e.clientX, y: e.clientY, currentColor: itin.color, onPick: c => dispatch({ type: 'UPDATE_ITINERARY', id: itin.id, color: c }) }) },
            { separator: true },
            ...(!isSelected ? [{ icon: <Route size={13} />, label: 'Sélectionner', shortcut: 'Entrée', onClick: () => dispatch({ type: 'SET_SELECTED_LAYER', id: itin.id }) } as CtxMenuItem] : []),
            { icon: <Eye size={13} />, label: (itin.visible !== false) ? 'Masquer' : 'Afficher', shortcut: 'Espace', onClick: () => dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: itin.id }) },
            { separator: true },
            { icon: <Trash2 size={13} />, label: 'Supprimer', shortcut: 'Suppr', danger: true, onClick: () => { if (window.confirm(`Supprimer "${itin.name}" ?`)) dispatch({ type: 'REMOVE_ITINERARY', id: itin.id }); } },
        ]});
    };

    const openPointCtx = (e: React.MouseEvent, pt: PointAnnotation) => {
        e.preventDefault(); e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, items: [
            { icon: <Pencil size={13} />, label: 'Renommer', shortcut: 'F2', onClick: () => setRenamingId(pt.id) },
            { icon: <div style={{ width: 13, height: 13, borderRadius: 3, background: pt.color }} />, label: 'Changer la couleur', onClick: () => setColorPicker({ x: e.clientX, y: e.clientY, currentColor: pt.color, onPick: c => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { color: c } }) }) },
            { separator: true },
            { icon: <Maximize2 size={13} />, label: 'Centrer la carte', shortcut: 'Entrée', onClick: () => flyTo(pt.coords) },
            { icon: <Eye size={13} />, label: pt.visible ? 'Masquer' : 'Afficher', shortcut: 'Espace', onClick: () => dispatch({ type: 'TOGGLE_POINT_VISIBILITY', id: pt.id }) },
            { separator: true },
            { icon: <Trash2 size={13} />, label: 'Supprimer', shortcut: 'Suppr', danger: true, onClick: () => dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: pt.id }) },
        ]});
    };

    const openAreaCtx = (e: React.MouseEvent, area: AreaAnnotation) => {
        e.preventDefault(); e.stopPropagation();
        const isComplete = area.coords.length >= 3;
        setCtxMenu({ x: e.clientX, y: e.clientY, items: [
            { icon: <Pencil size={13} />, label: 'Renommer', shortcut: 'F2', onClick: () => setRenamingId(area.id) },
            { icon: <div style={{ width: 13, height: 13, borderRadius: 3, background: area.color }} />, label: 'Changer la couleur', onClick: () => setColorPicker({ x: e.clientX, y: e.clientY, currentColor: area.color, onPick: c => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { color: c } }) }) },
            { separator: true },
            ...(isComplete ? [{ icon: <Maximize2 size={13} />, label: 'Cadrer la zone', shortcut: 'Entrée', onClick: () => fitBounds(area.coords) } as CtxMenuItem] : []),
            { icon: <Eye size={13} />, label: area.visible ? 'Masquer' : 'Afficher', shortcut: 'Espace', onClick: () => dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: area.id }) },
            { separator: true },
            { icon: <Trash2 size={13} />, label: 'Supprimer', shortcut: 'Suppr', danger: true, onClick: () => dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id }) },
        ]});
    };

    const openDrawCtx = (e: React.MouseEvent, draw: DrawAnnotation) => {
        e.preventDefault(); e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, items: [
            { icon: <Pencil size={13} />, label: 'Renommer', shortcut: 'F2', onClick: () => setRenamingId(draw.id) },
            { icon: <div style={{ width: 13, height: 13, borderRadius: 3, background: draw.color }} />, label: 'Changer la couleur', onClick: () => setColorPicker({ x: e.clientX, y: e.clientY, currentColor: draw.color, onPick: c => dispatch({ type: 'UPDATE_DRAW_ANNOTATION', id: draw.id, patch: { color: c } } as any) }) },
            { separator: true },
            { icon: <Eye size={13} />, label: draw.visible ? 'Masquer' : 'Afficher', shortcut: 'Espace', onClick: () => dispatch({ type: 'TOGGLE_DRAW_VISIBILITY', id: draw.id } as any) },
            { separator: true },
            { icon: <Trash2 size={13} />, label: 'Supprimer', shortcut: 'Suppr', danger: true, onClick: () => dispatch({ type: 'REMOVE_DRAW_ANNOTATION', id: draw.id } as any) },
        ]});
    };

    const openTextCtx = (e: React.MouseEvent, text: TextAnnotation) => {
        e.preventDefault(); e.stopPropagation();
        setCtxMenu({ x: e.clientX, y: e.clientY, items: [
            { icon: <Pencil size={13} />, label: 'Renommer', shortcut: 'F2', onClick: () => setRenamingId(text.id) },
            { icon: <div style={{ width: 13, height: 13, borderRadius: 3, background: text.color }} />, label: 'Changer la couleur', onClick: () => setColorPicker({ x: e.clientX, y: e.clientY, currentColor: text.color, onPick: c => dispatch({ type: 'UPDATE_TEXT_ANNOTATION', id: text.id, patch: { color: c } } as any) }) },
            { separator: true },
            { icon: <Eye size={13} />, label: text.visible ? 'Masquer' : 'Afficher', shortcut: 'Espace', onClick: () => dispatch({ type: 'TOGGLE_TEXT_VISIBILITY', id: text.id } as any) },
            { separator: true },
            { icon: <Trash2 size={13} />, label: 'Supprimer', shortcut: 'Suppr', danger: true, onClick: () => dispatch({ type: 'REMOVE_TEXT_ANNOTATION', id: text.id } as any) },
        ]});
    };

    // ── Render one item ───────────────────────────────────────────────
    const renderItem = (item: OrderItem, idx: number) => {
        const isDraggingOver = dropOver === idx;
        const isSelected = selectedId === item.id;
        const wrapStyle: React.CSSProperties = {
            borderTop: isDraggingOver ? '2px solid #6ec97e' : '2px solid transparent',
            transition: 'border-color 0.1s',
        };

        const dragProps = {
            draggable: true,
            onDragStart: () => handleDragStart(idx),
            onDragOver: (e: React.DragEvent) => handleDragOver(e, idx),
            onDrop: () => handleDrop(idx),
            onDragEnd: handleDragEnd,
            onClick: () => handleSelectRow(item),
        };

        if (item.kind === 'itin') {
            const itin = itineraries.find(x => x.id === item.id);
            if (!itin) return null;
            const isActive   = itin.id === activeItinId;
            const km         = getItinKm(itin);
            const stages     = isSelected ? state.stages.length : (itin.stages?.length || 0);
            const isRenaming = renamingId === itin.id;
            return (
                <div key={item.id} style={wrapStyle} {...dragProps}
                    onClick={() => handleSelectRow(item)}>
                    <LayerRow icon={<Route size={12} />} label={itin.name}
                        sublabel={`${km.toFixed(1)} km · ${stages} étape${stages !== 1 ? 's' : ''}`}
                        color={itin.color} visible={itin.visible !== false}
                        isEditing={isRenaming} isSelected={isSelected}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: itin.id })}
                        onContextMenu={e => openItinCtx(e, itin)}
                        dragHandleProps={{}}
                        renameSlot={<InlineRename value={itin.name} onConfirm={v => { dispatch({ type: 'UPDATE_ITINERARY', id: itin.id, name: v }); setRenamingId(null); }} onCancel={() => setRenamingId(null)} />}
                    />
                </div>
            );
        }

        if (item.kind === 'point') {
            const pt = points.find(x => x.id === item.id);
            if (!pt) return null;
            const isRenaming = renamingId === pt.id;
            return (
                <div key={item.id} style={wrapStyle} {...dragProps}>
                    <LayerRow icon={<MapPin size={12} />} label={pt.title}
                        sublabel={`${pt.coords[0].toFixed(4)}, ${pt.coords[1].toFixed(4)}`}
                        color={pt.color} visible={pt.visible}
                        isEditing={isRenaming} isSelected={isSelected}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_POINT_VISIBILITY', id: pt.id })}
                        onContextMenu={e => openPointCtx(e, pt)}
                        dragHandleProps={{}}
                        renameSlot={<InlineRename value={pt.title} onConfirm={v => { dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { title: v } }); setRenamingId(null); }} onCancel={() => setRenamingId(null)} />}
                    />
                </div>
            );
        }

        if (item.kind === 'area') {
            const area = areas.find(x => x.id === item.id);
            if (!area) return null;
            const isComplete = area.coords.length >= 3;
            const surface    = area.formatted_area || (isComplete ? formatArea(calculatePolygonArea(area.coords)) : '—');
            const isRenaming = renamingId === area.id;
            return (
                <div key={item.id} style={wrapStyle} {...dragProps}>
                    <LayerRow icon={<PolygonIcon size={12} />} label={area.title}
                        sublabel={isComplete ? surface : `${area.coords.length} sommet${area.coords.length > 1 ? 's' : ''} (en cours)`}
                        color={area.color} visible={area.visible}
                        isEditing={isRenaming} isSelected={isSelected}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: area.id })}
                        onContextMenu={e => openAreaCtx(e, area)}
                        dragHandleProps={{}}
                        renameSlot={<InlineRename value={area.title} onConfirm={v => { dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { title: v } }); setRenamingId(null); }} onCancel={() => setRenamingId(null)} />}
                    />
                </div>
            );
        }

        if (item.kind === 'draw') {
            const draw = draws.find(x => x.id === item.id);
            if (!draw) return null;
            const isRenaming = renamingId === draw.id;
            const strokes = (draw.strokes || []) as unknown as DrawStroke[];
            const isExpanded = expandedDrawIds.has(draw.id);

            const toggleExpand = (e: React.MouseEvent) => {
                e.stopPropagation();
                setExpandedDrawIds(prev => {
                    const next = new Set(prev);
                    if (next.has(draw.id)) next.delete(draw.id);
                    else next.add(draw.id);
                    return next;
                });
            };

            return (
                <div key={item.id} style={wrapStyle} {...dragProps}>
                    <LayerRow icon={<Paintbrush size={12} />} label={draw.title}
                        sublabel={`${strokes.length} trait${strokes.length !== 1 ? 's' : ''}`}
                        color={draw.color} visible={draw.visible}
                        isEditing={isRenaming} isSelected={isSelected && !selectedSublayerId}
                        expandToggle={strokes.length > 0 ? (
                            <button
                                type="button"
                                onClick={toggleExpand}
                                style={{ background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}
                            >
                                {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </button>
                        ) : undefined}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_DRAW_VISIBILITY', id: draw.id } as any)}
                        onContextMenu={e => openDrawCtx(e, draw)}
                        dragHandleProps={{}}
                        renameSlot={<InlineRename value={draw.title} onConfirm={v => { dispatch({ type: 'UPDATE_DRAW_ANNOTATION', id: draw.id, patch: { title: v } } as any); setRenamingId(null); }} onCancel={() => setRenamingId(null)} />}
                    />
                    {/* ── Sub-stroke list (Group Hierarchy like Figma/tldraw) ── */}
                    {isExpanded && strokes.length > 0 && (
                        <div style={{ marginLeft: '22px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                            {strokes.map((stroke, sIdx) => {
                                const isSubSelected = isSelected && selectedSublayerId === stroke.id;
                                return (
                                    <div
                                        key={stroke.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            dispatch({ type: 'SET_SELECTED_SUBLAYER', layerId: draw.id, sublayerId: stroke.id });
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '7px',
                                            padding: '4px 8px 4px 10px',
                                            background: isSubSelected ? 'rgba(45,140,235,0.14)' : 'transparent',
                                            borderLeft: isSubSelected ? '2px solid #2d8ceb' : '2px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'background 0.1s',
                                        }}
                                        onMouseEnter={e => { if (!isSubSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                        onMouseLeave={e => { if (!isSubSelected) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {/* Color dot (click triggers color picker) */}
                                        <div
                                            title="Changer la couleur"
                                            onClick={e => {
                                                e.stopPropagation();
                                                setColorPicker({
                                                    x: e.clientX, y: e.clientY,
                                                    currentColor: stroke.color,
                                                    onPick: (c) => dispatch({ type: 'UPDATE_DRAW_STROKE', drawId: draw.id, strokeId: stroke.id, patch: { color: c } } as any)
                                                });
                                            }}
                                            style={{ width: '8px', height: '8px', borderRadius: '2px', background: stroke.color, flexShrink: 0, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.25)' }}
                                        />
                                        <span style={{ fontSize: '11px', color: isSubSelected ? '#fff' : 'var(--text-bright)', flex: 1, fontWeight: isSubSelected ? 600 : 400 }}>
                                            Trait {sIdx + 1}
                                        </span>
                                        {/* Stroke width badge */}
                                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', padding: '1px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                                            {stroke.strokeWidth}px
                                        </span>
                                        {/* Delete button */}
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_DRAW_STROKE', drawId: draw.id, strokeId: stroke.id } as any); }}
                                            title="Supprimer ce trait"
                                            style={{ background: 'transparent', border: 'none', padding: '1px 3px', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', borderRadius: '3px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        if (item.kind === 'text') {
            const text = texts.find(t => t.id === item.id);
            if (!text) return null;
            const isRenaming = renamingId === text.id;
            const isExpanded = expandedTextIds.has(text.id);
            const textItems = text.texts || [];
            const toggleExpand = (e: React.MouseEvent) => {
                e.stopPropagation();
                setExpandedTextIds(prev => {
                    const next = new Set(prev);
                    if (next.has(text.id)) next.delete(text.id);
                    else next.add(text.id);
                    return next;
                });
            };

            return (
                <div key={item.id} style={wrapStyle} {...dragProps}>
                    <LayerRow icon={<Type size={12} />} label={text.title}
                        sublabel={`${textItems.length} texte${textItems.length !== 1 ? 's' : ''}`}
                        color={text.color} visible={text.visible}
                        isEditing={isRenaming} isSelected={isSelected && !selectedSublayerId}
                        expandToggle={textItems.length > 0 ? (
                            <button
                                type="button"
                                onClick={toggleExpand}
                                style={{ background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center' }}
                            >
                                {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                            </button>
                        ) : undefined}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_TEXT_VISIBILITY', id: text.id } as any)}
                        onContextMenu={e => openTextCtx(e, text)}
                        dragHandleProps={{}}
                        renameSlot={<InlineRename value={text.title} onConfirm={v => { dispatch({ type: 'UPDATE_TEXT_ANNOTATION', id: text.id, patch: { title: v } } as any); setRenamingId(null); }} onCancel={() => setRenamingId(null)} />}
                    />
                    {/* ── Sub-text item list ── */}
                    {isExpanded && textItems.length > 0 && (
                        <div style={{ marginLeft: '22px', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                            {textItems.map((tItem, tIdx) => {
                                const isSubSelected = isSelected && selectedSublayerId === tItem.id;
                                return (
                                    <div
                                        key={tItem.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            dispatch({ type: 'SET_SELECTED_SUBLAYER', layerId: text.id, sublayerId: tItem.id });
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '7px',
                                            padding: '4px 8px 4px 10px',
                                            background: isSubSelected ? 'rgba(45,140,235,0.14)' : 'transparent',
                                            borderLeft: isSubSelected ? '2px solid #2d8ceb' : '2px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'background 0.1s',
                                        }}
                                        onMouseEnter={e => { if (!isSubSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                        onMouseLeave={e => { if (!isSubSelected) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div
                                            title="Changer la couleur"
                                            onClick={e => {
                                                e.stopPropagation();
                                                setColorPicker({
                                                    x: e.clientX, y: e.clientY,
                                                    currentColor: tItem.color,
                                                    onPick: (c) => dispatch({ type: 'UPDATE_TEXT_ITEM', textId: text.id, itemId: tItem.id, patch: { color: c } } as any)
                                                });
                                            }}
                                            style={{ width: '8px', height: '8px', borderRadius: '2px', background: tItem.color, flexShrink: 0, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.25)' }}
                                        />
                                        <span style={{ fontSize: '11px', color: isSubSelected ? '#fff' : 'var(--text-bright)', flex: 1, fontWeight: isSubSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {tItem.text || `Texte ${tIdx + 1}`}
                                        </span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', padding: '1px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                                            {tItem.fontSize}px
                                        </span>
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_TEXT_ITEM', textId: text.id, itemId: tItem.id } as any); }}
                                            title="Supprimer ce texte"
                                            style={{ background: 'transparent', border: 'none', padding: '1px 3px', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex', borderRadius: '3px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            );
        }

        return null;
    };

    const isEmpty = itineraries.length === 0 && points.length === 0 && areas.length === 0 && draws.length === 0 && texts.length === 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', userSelect: 'none', fontSize: '12px', color: 'var(--text-primary)' }}>

            {/* ── Flat layer list ── */}
            <div ref={listRef} tabIndex={0}
                title="Le premier calque de la liste est affiché au premier plan sur la carte."
                style={{ flex: 1, overflowY: 'auto', outline: 'none' }}
                onKeyDown={handleKeyDown}>
                {isEmpty ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
                        Aucun calque.<br />
                        <span style={{ opacity: 0.6 }}>Utilisez les boutons ci-dessous pour créer.</span>
                    </div>
                ) : (
                    order.map((item, idx) => renderItem(item, idx))
                )}
            </div>

            {/* ── Bottom toolbar ── */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px 10px', display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.25)', flexShrink: 0 }}>
                <button type="button"
                    onClick={() => {
                        dispatch({ type: 'ADD_ITINERARY' });
                        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouvel itinéraire créé.', notifType: 'info' });
                    }}
                    title="Créer un nouvel itinéraire"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '6px', background: (state.active_tool === 'route' && selectedId === state.active_itinerary_id) ? '#2d8ceb' : 'rgba(45,140,235,0.1)', border: `1px solid ${(state.active_tool === 'route' && selectedId === state.active_itinerary_id) ? '#2d8ceb' : 'rgba(45,140,235,0.22)'}`, color: (state.active_tool === 'route' && selectedId === state.active_itinerary_id) ? '#fff' : '#60a5fa', cursor: 'pointer', fontSize: '9px', fontWeight: 700 }}>
                    <Route size={15} />Itinéraire
                </button>
                <button type="button"
                    onClick={() => { dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_point' }); dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour placer un repère.', notifType: 'info' }); }}
                    title="Activer l'outil Point"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '6px', background: state.active_tool === 'annotate_point' ? '#3b82f6' : 'rgba(59,130,246,0.1)', border: `1px solid ${state.active_tool === 'annotate_point' ? '#3b82f6' : 'rgba(59,130,246,0.22)'}`, color: state.active_tool === 'annotate_point' ? '#fff' : '#60a5fa', cursor: 'pointer', fontSize: '9px', fontWeight: 700 }}>
                    <MapPin size={15} />Repère
                </button>
                <button type="button"
                    onClick={() => { dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_area' }); dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour tracer les sommets.', notifType: 'info' }); }}
                    title="Activer l'outil Zone"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '6px', background: (state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? '#10b981' : 'rgba(16,185,129,0.1)', border: `1px solid ${(state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? '#10b981' : 'rgba(16,185,129,0.22)'}`, color: (state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? '#fff' : '#6ee7b7', cursor: 'pointer', fontSize: '9px', fontWeight: 700 }}>
                    <PolygonIcon size={15} color={(state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? '#fff' : '#6ee7b7'} />Zone
                </button>
                <button type="button"
                    onClick={() => { dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_draw' }); dispatch({ type: 'ADD_NOTIFICATION', message: 'Dessinez librement sur la carte.', notifType: 'info' }); }}
                    title="Activer l'outil Dessin (B)"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '6px', background: state.active_tool === 'annotate_draw' ? '#f59e0b' : 'rgba(245,158,11,0.1)', border: `1px solid ${state.active_tool === 'annotate_draw' ? '#f59e0b' : 'rgba(245,158,11,0.22)'}`, color: state.active_tool === 'annotate_draw' ? '#fff' : '#fcd34d', cursor: 'pointer', fontSize: '9px', fontWeight: 700 }}>
                    <Paintbrush size={15} />Dessin
                </button>
                <button type="button"
                    onClick={() => { dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_text' }); dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour placer un texte.', notifType: 'info' }); }}
                    title="Activer l'outil Texte (T)"
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', padding: '7px 4px', borderRadius: '6px', background: state.active_tool === 'annotate_text' ? '#38bdf8' : 'rgba(56,189,248,0.1)', border: `1px solid ${state.active_tool === 'annotate_text' ? '#38bdf8' : 'rgba(56,189,248,0.22)'}`, color: state.active_tool === 'annotate_text' ? '#fff' : '#7dd3fc', cursor: 'pointer', fontSize: '9px', fontWeight: 700 }}>
                    <Type size={15} />Texte
                </button>
            </div>

            {/* Portals */}
            {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeCtx} />}
            {colorPicker && <ColorPickerPopup x={colorPicker.x} y={colorPicker.y} currentColor={colorPicker.currentColor} onPick={colorPicker.onPick} onClose={closeColor} />}
        </div>
    );
}

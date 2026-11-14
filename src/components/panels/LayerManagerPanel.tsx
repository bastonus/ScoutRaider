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
            style={{
                position: 'fixed',
                left: pos.x,
                top: pos.y,
                zIndex: 9999,
                background: 'var(--bg-elevated)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '6px',
                minWidth: '200px',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.1)'
            }}>
            {items.map((item, i) => 'separator' in item
                ? <div key={i} style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                : <button key={i} type="button" onClick={() => { item.onClick(); onClose(); }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = item.danger ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-hover)';
                        if (item.danger) e.currentTarget.style.color = '#f87171';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = item.danger ? 'var(--semantic-danger)' : 'var(--text-primary)';
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        width: '100%',
                        padding: '7px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: item.danger ? 'var(--semantic-danger)' : 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 100ms ease'
                    }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.icon && <span style={{ opacity: 0.85, flexShrink: 0 }}>{item.icon}</span>}
                        {item.label}
                    </span>
                    {item.shortcut && (
                        <span style={{
                            fontSize: '10px',
                            color: 'var(--text-dim)',
                            fontFamily: 'monospace',
                            marginLeft: 'auto',
                            padding: '2px 6px',
                            background: 'rgba(255, 255, 255, 0.06)',
                            borderRadius: '4px'
                        }}>
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
            style={{
                position: 'fixed',
                left: x,
                top: y,
                zIndex: 10000,
                background: 'var(--bg-elevated)',
                backdropFilter: 'blur(16px)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '10px',
                boxShadow: '0 16px 36px rgba(0, 0, 0, 0.55)',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                maxWidth: '180px'
            }}>
            {PRESET_COLORS.map(c => (
                <div key={c.value} title={c.label} onClick={() => { onPick(c.value); onClose(); }}
                    style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        background: c.value,
                        cursor: 'pointer',
                        boxShadow: currentColor === c.value ? '0 0 0 2px #fff' : 'none',
                        transform: currentColor === c.value ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 100ms ease, box-shadow 100ms ease'
                    }}
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
                style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--accent-default)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    color: '#fff',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    outline: 'none',
                    boxShadow: 'none'
                }}
                autoFocus />
            <button type="button" onClick={() => onConfirm(v)} style={{ background: 'var(--accent-transparent)', border: '1px solid var(--accent-default)', borderRadius: '6px', color: 'var(--accent-hover)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={12} strokeWidth={2.5} />
            </button>
            <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={12} strokeWidth={2} />
            </button>
        </div>
    );
}

// ─── Layer row ───────────────────────────────────────────────────────
function LayerRow({
    icon,
    label,
    sublabel,
    color,
    visible,
    isEditing,
    isSelected,
    isActiveItin,
    onToggleVisible,
    onContextMenu,
    renameSlot,
    dragHandleProps,
    expandToggle
}: {
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    color: string;
    visible: boolean;
    isEditing: boolean;
    isSelected?: boolean;
    isActiveItin?: boolean;
    onToggleVisible: () => void;
    onContextMenu: (e: React.MouseEvent) => void;
    renameSlot?: React.ReactNode;
    dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
    expandToggle?: React.ReactNode;
}) {
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            onContextMenu={onContextMenu}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 10px',
                borderRadius: '12px',
                margin: '3px 8px',
                background: isSelected
                    ? 'var(--accent-transparent)'
                    : isHovered
                        ? 'var(--bg-hover)'
                        : 'rgba(255, 255, 255, 0.02)',
                border: isSelected
                    ? '1px solid var(--accent-default)'
                    : isHovered
                        ? '1px solid rgba(255, 255, 255, 0.12)'
                        : '1px solid var(--border-subtle)',
                boxShadow: 'none',
                cursor: 'pointer',
                transition: 'all 120ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
        >
            {/* Expand / collapse chevron (for groups) or drag handle */}
            {expandToggle || (
                <span
                    {...dragHandleProps}
                    onClick={e => e.stopPropagation()}
                    title="Glisser pour réorganiser"
                    style={{
                        color: isHovered ? 'var(--text-dim)' : 'rgba(255, 255, 255, 0.2)',
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '14px',
                        flexShrink: 0,
                        touchAction: 'none',
                        transition: 'color 120ms ease',
                        ...dragHandleProps?.style
                    }}
                >
                    <GripVertical size={13} />
                </span>
            )}

            {/* Visibility Eye button */}
            <button
                type="button"
                onClick={e => { e.stopPropagation(); onToggleVisible(); }}
                title={visible ? "Masquer ce calque" : "Afficher ce calque"}
                style={{
                    background: visible ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    border: 'none',
                    borderRadius: '7px',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    color: visible ? color : 'rgba(255, 255, 255, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 120ms ease'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = visible ? 'rgba(255, 255, 255, 0.04)' : 'transparent'; }}
            >
                {visible ? <Eye size={13} strokeWidth={2.2} /> : <EyeOff size={13} strokeWidth={2} />}
            </button>

            {/* Color Dot */}
            <div
                style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                    boxShadow: 'none',
                    opacity: visible ? 1 : 0.4,
                    transition: 'all 120ms ease'
                }}
            />

            {/* Type icon inside subtle pill */}
            <div
                style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    background: isSelected ? 'var(--accent-transparent)' : 'rgba(255, 255, 255, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isSelected ? 'var(--accent-hover)' : 'var(--text-dim)',
                    flexShrink: 0,
                    transition: 'all 120ms ease'
                }}
            >
                {icon}
            </div>

            {/* Label or rename */}
            {isEditing && renameSlot ? (
                renameSlot
            ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            fontSize: '12px',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? '#fff' : 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {label}
                        </span>
                        {isActiveItin && (
                            <span style={{
                                fontSize: '9px',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: 'var(--accent-transparent)',
                                color: 'var(--accent-hover)',
                                border: '1px solid var(--accent-default)',
                                flexShrink: 0
                            }}>
                                Actif
                            </span>
                        )}
                    </div>
                    {sublabel && (
                        <div style={{
                            fontSize: '10.5px',
                            color: 'var(--text-dim)',
                            marginTop: '1px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                        }}>
                            {sublabel}
                        </div>
                    )}
                </div>
            )}

            {/* Options button */}
            {!isEditing && (
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onContextMenu(e); }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = isHovered ? 'var(--text-dim)' : 'rgba(255, 255, 255, 0.2)';
                    }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: isHovered ? 'var(--text-dim)' : 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 120ms ease'
                    }}
                    title="Options (clic droit)"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
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
            borderTop: isDraggingOver ? '2px solid var(--accent-default)' : '2px solid transparent',
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
                    <LayerRow icon={<Route size={13} strokeWidth={2.2} />} label={itin.name}
                        sublabel={`${km.toFixed(1)} km · ${stages} étape${stages !== 1 ? 's' : ''}`}
                        color={itin.color} visible={itin.visible !== false}
                        isEditing={isRenaming} isSelected={isSelected}
                        isActiveItin={isActive}
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
                    <LayerRow icon={<MapPin size={13} strokeWidth={2.2} />} label={pt.title}
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
                    <LayerRow icon={<PolygonIcon size={13} />} label={area.title}
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
                    <LayerRow icon={<Paintbrush size={13} strokeWidth={2.2} />} label={draw.title}
                        sublabel={`${strokes.length} trait${strokes.length !== 1 ? 's' : ''}`}
                        color={draw.color} visible={draw.visible}
                        isEditing={isRenaming} isSelected={isSelected && !selectedSublayerId}
                        expandToggle={strokes.length > 0 ? (
                            <button
                                type="button"
                                onClick={toggleExpand}
                                style={{ background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
                            >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                        ) : undefined}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_DRAW_VISIBILITY', id: draw.id } as any)}
                        onContextMenu={e => openDrawCtx(e, draw)}
                        dragHandleProps={{}}
                        renameSlot={<InlineRename value={draw.title} onConfirm={v => { dispatch({ type: 'UPDATE_DRAW_ANNOTATION', id: draw.id, patch: { title: v } } as any); setRenamingId(null); }} onCancel={() => setRenamingId(null)} />}
                    />
                    {/* ── Sub-stroke list (Group Hierarchy like Figma/tldraw) ── */}
                    {isExpanded && strokes.length > 0 && (
                        <div style={{
                            marginLeft: '28px',
                            marginRight: '8px',
                            marginBottom: '4px',
                            paddingLeft: '10px',
                            borderLeft: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                        }}>
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
                                            gap: '8px',
                                            padding: '5px 8px',
                                            borderRadius: '8px',
                                            background: isSubSelected ? 'var(--accent-transparent)' : 'transparent',
                                            border: isSubSelected ? '1px solid var(--accent-default)' : '1px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'all 100ms ease',
                                        }}
                                        onMouseEnter={e => { if (!isSubSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
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
                                            style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: stroke.color,
                                                flexShrink: 0,
                                                cursor: 'pointer',
                                                boxShadow: `0 0 4px ${stroke.color}80`
                                            }}
                                        />
                                        <span style={{ fontSize: '11px', color: isSubSelected ? '#fff' : 'var(--text-primary)', flex: 1, fontWeight: isSubSelected ? 600 : 400 }}>
                                            Trait {sIdx + 1}
                                        </span>
                                        {/* Stroke width badge */}
                                        <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', padding: '2px 5px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', fontWeight: 600 }}>
                                            {stroke.strokeWidth}px
                                        </span>
                                        {/* Delete button */}
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_DRAW_STROKE', drawId: draw.id, strokeId: stroke.id } as any); }}
                                            title="Supprimer ce trait"
                                            style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', borderRadius: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
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
                    <LayerRow icon={<Type size={13} strokeWidth={2.2} />} label={text.title}
                        sublabel={`${textItems.length} texte${textItems.length !== 1 ? 's' : ''}`}
                        color={text.color} visible={text.visible}
                        isEditing={isRenaming} isSelected={isSelected && !selectedSublayerId}
                        expandToggle={textItems.length > 0 ? (
                            <button
                                type="button"
                                onClick={toggleExpand}
                                style={{ background: 'transparent', border: 'none', padding: '0 2px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}
                            >
                                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                        ) : undefined}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_TEXT_VISIBILITY', id: text.id } as any)}
                        onContextMenu={e => openTextCtx(e, text)}
                        dragHandleProps={{}}
                        renameSlot={<InlineRename value={text.title} onConfirm={v => { dispatch({ type: 'UPDATE_TEXT_ANNOTATION', id: text.id, patch: { title: v } } as any); setRenamingId(null); }} onCancel={() => setRenamingId(null)} />}
                    />
                    {/* ── Sub-text item list ── */}
                    {isExpanded && textItems.length > 0 && (
                        <div style={{
                            marginLeft: '28px',
                            marginRight: '8px',
                            marginBottom: '4px',
                            paddingLeft: '10px',
                            borderLeft: '1px solid var(--border-subtle)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                        }}>
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
                                            gap: '8px',
                                            padding: '5px 8px',
                                            borderRadius: '8px',
                                            background: isSubSelected ? 'var(--accent-transparent)' : 'transparent',
                                            border: isSubSelected ? '1px solid var(--accent-default)' : '1px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'all 100ms ease',
                                        }}
                                        onMouseEnter={e => { if (!isSubSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
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
                                            style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: tItem.color,
                                                flexShrink: 0,
                                                cursor: 'pointer',
                                                boxShadow: `0 0 4px ${tItem.color}80`
                                            }}
                                        />
                                        <span style={{ fontSize: '11px', color: isSubSelected ? '#fff' : 'var(--text-primary)', flex: 1, fontWeight: isSubSelected ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {tItem.text || `Texte ${tIdx + 1}`}
                                        </span>
                                        <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', padding: '2px 5px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', fontWeight: 600 }}>
                                            {tItem.fontSize}px
                                        </span>
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); dispatch({ type: 'REMOVE_TEXT_ITEM', textId: text.id, itemId: tItem.id } as any); }}
                                            title="Supprimer ce texte"
                                            style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', color: 'var(--text-dim)', display: 'flex', borderRadius: '4px' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'transparent', userSelect: 'none', fontSize: '12px', color: 'var(--text-primary)' }}>

            {/* ── Flat layer list ── */}
            <div ref={listRef} tabIndex={0}
                title="Le premier calque de la liste est affiché au premier plan sur la carte."
                style={{ flex: 1, overflowY: 'auto', outline: 'none', padding: '4px 0' }}
                onKeyDown={handleKeyDown}>
                {isEmpty ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '36px 20px',
                        textAlign: 'center',
                        height: '100%'
                    }}>
                        <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '14px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '12px',
                            color: 'var(--text-dim)'
                        }}>
                            <Route size={20} strokeWidth={1.8} />
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            Aucun calque sur la carte
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4, maxWidth: '220px' }}>
                            Tracez un itinéraire ou ajoutez un repère avec la barre ci-dessous.
                        </div>
                    </div>
                ) : (
                    order.map((item, idx) => renderItem(item, idx))
                )}
            </div>

            {/* ── Bottom toolbar (Island style matching FloatingToolbar) ── */}
            <div style={{
                padding: '8px 10px',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-dark)',
                flexShrink: 0
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '12px',
                    padding: '3px',
                }}>
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'ADD_ITINERARY' });
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouvel itinéraire créé.', notifType: 'info' });
                        }}
                        title="Créer un itinéraire (P)"
                        style={{
                            flex: 1,
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            border: (state.active_tool === 'route' && selectedId === state.active_itinerary_id)
                                ? '1px solid var(--accent-default)'
                                : '1px solid transparent',
                            borderRadius: '8px',
                            background: (state.active_tool === 'route' && selectedId === state.active_itinerary_id)
                                ? 'var(--accent-transparent)'
                                : 'transparent',
                            color: (state.active_tool === 'route' && selectedId === state.active_itinerary_id)
                                ? 'var(--accent-hover)'
                                : 'var(--text-dim)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            transition: 'all 120ms ease'
                        }}
                        onMouseEnter={e => {
                            if (!(state.active_tool === 'route' && selectedId === state.active_itinerary_id)) {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!(state.active_tool === 'route' && selectedId === state.active_itinerary_id)) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }
                        }}
                    >
                        <Route size={13} strokeWidth={2.2} />
                        <span>Tracé</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_point' });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour placer un repère.', notifType: 'info' });
                        }}
                        title="Activer l'outil Repère"
                        style={{
                            flex: 1,
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            border: state.active_tool === 'annotate_point' ? '1px solid var(--accent-default)' : '1px solid transparent',
                            borderRadius: '8px',
                            background: state.active_tool === 'annotate_point' ? 'var(--accent-transparent)' : 'transparent',
                            color: state.active_tool === 'annotate_point' ? 'var(--accent-hover)' : 'var(--text-dim)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            transition: 'all 120ms ease'
                        }}
                        onMouseEnter={e => {
                            if (state.active_tool !== 'annotate_point') {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (state.active_tool !== 'annotate_point') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }
                        }}
                    >
                        <MapPin size={13} strokeWidth={2.2} />
                        <span>Repère</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_area' });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour tracer les sommets.', notifType: 'info' });
                        }}
                        title="Activer l'outil Zone"
                        style={{
                            flex: 1,
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            border: (state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? '1px solid #10b981' : '1px solid transparent',
                            borderRadius: '8px',
                            background: (state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? 'rgba(16,185,129,0.15)' : 'transparent',
                            color: (state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? '#34d399' : 'var(--text-dim)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            transition: 'all 120ms ease'
                        }}
                        onMouseEnter={e => {
                            if (!(state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed')) {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (!(state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed')) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }
                        }}
                    >
                        <PolygonIcon size={13} color={(state.active_tool === 'annotate_area' || state.active_tool === 'annotate_area_routed') ? '#34d399' : 'currentColor'} />
                        <span>Zone</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_draw' });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Dessinez librement sur la carte.', notifType: 'info' });
                        }}
                        title="Activer l'outil Dessin (B)"
                        style={{
                            flex: 1,
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            border: state.active_tool === 'annotate_draw' ? '1px solid #f59e0b' : '1px solid transparent',
                            borderRadius: '8px',
                            background: state.active_tool === 'annotate_draw' ? 'rgba(245,158,11,0.15)' : 'transparent',
                            color: state.active_tool === 'annotate_draw' ? '#fbbf24' : 'var(--text-dim)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            transition: 'all 120ms ease'
                        }}
                        onMouseEnter={e => {
                            if (state.active_tool !== 'annotate_draw') {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (state.active_tool !== 'annotate_draw') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }
                        }}
                    >
                        <Paintbrush size={13} strokeWidth={2.2} />
                        <span>Dessin</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_text' });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour placer un texte.', notifType: 'info' });
                        }}
                        title="Activer l'outil Texte (T)"
                        style={{
                            flex: 1,
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            border: state.active_tool === 'annotate_text' ? '1px solid #38bdf8' : '1px solid transparent',
                            borderRadius: '8px',
                            background: state.active_tool === 'annotate_text' ? 'rgba(56,189,248,0.15)' : 'transparent',
                            color: state.active_tool === 'annotate_text' ? '#38bdf8' : 'var(--text-dim)',
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: 600,
                            transition: 'all 120ms ease'
                        }}
                        onMouseEnter={e => {
                            if (state.active_tool !== 'annotate_text') {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (state.active_tool !== 'annotate_text') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }
                        }}
                    >
                        <Type size={13} strokeWidth={2.2} />
                        <span>Texte</span>
                    </button>
                </div>
            </div>

            {/* Portals */}
            {ctxMenu && <ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeCtx} />}
            {colorPicker && <ColorPickerPopup x={colorPicker.x} y={colorPicker.y} currentColor={colorPicker.currentColor} onPick={colorPicker.onPick} onClose={closeColor} />}
        </div>
    );
}

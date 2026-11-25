import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    Eye,
    EyeOff,
    Trash2,
    Route,
    MapPin,
    Edit3,
    Check,
    Copy,
    RotateCcw,
    Pencil,
    Pentagon,
    ChevronRight,
    ChevronDown,
    Type,
    Plus,
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { mapRef } from '../map/MapComponent';
import { calculatePolygonArea, formatArea } from '../../logic/GeoUtils';
import { formatDistanceFr, formatStageAddress } from '../../logic/geocoding';
import { PRESET_COLORS } from '../map/AnnotationModals';
import {
    Itinerary,
    PointAnnotation,
    AreaAnnotation,
    DrawAnnotation,
    DrawStroke,
    TextAnnotation,
} from '../../logic/types';
import { computeLayerOrder, layerOrdersEqual, type LayerOrderItem } from '../../logic/LayerOrder';

type OrderItem = LayerOrderItem;

const DEFAULT_LAYER_COLORS: Record<OrderItem['kind'], string> = {
    itin: '#2d8ceb',
    point: '#3b82f6',
    area: '#10b981',
    draw: '#ef4444',
    text: '#38bdf8',
};

interface CtxMenuItem {
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
    onClick: () => void;
}
interface CtxMenuSeparator {
    separator: true;
}

function clampMenuPosition(x: number, y: number, estHeight = 130): { top: number; left: number } {
    const menuWidth = 200;
    const top = y + estHeight > window.innerHeight ? Math.max(8, y - estHeight) : y;
    const left = Math.min(Math.max(8, x), window.innerWidth - menuWidth - 8);
    return { top, left };
}

function LayerContextMenu({
    x,
    y,
    items,
    onClose,
}: {
    x: number;
    y: number;
    items: (CtxMenuItem | CtxMenuSeparator)[];
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const pos = clampMenuPosition(x, y);

    useEffect(() => {
        const handleDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleDown, true);
        document.addEventListener('keydown', handleKey, true);
        return () => {
            document.removeEventListener('mousedown', handleDown, true);
            document.removeEventListener('keydown', handleKey, true);
        };
    }, [onClose]);

    return createPortal(
        <div
            ref={ref}
            role="menu"
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            style={{
                position: 'fixed',
                top: `${pos.top}px`,
                left: `${pos.left}px`,
                width: '200px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
                padding: '4px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
            }}
        >
            {items.map((item, i) =>
                'separator' in item ? (
                    <div key={`sep-${i}`} style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 4px' }} />
                ) : (
                    <button
                        key={i}
                        type="button"
                        role="menuitem"
                        className="sr-menu-item"
                        style={{
                            minHeight: '36px',
                            fontSize: '12px',
                            gap: '8px',
                            padding: '0 10px',
                            justifyContent: 'flex-start',
                            textAlign: 'left',
                            color: item.danger ? 'var(--semantic-danger)' : 'var(--text-primary)',
                        }}
                        onClick={() => {
                            onClose();
                            item.onClick();
                        }}
                    >
                        {item.icon}
                        <span>{item.label}</span>
                    </button>
                )
            )}
        </div>,
        document.body
    );
}

function InlineRename({
    value,
    onConfirm,
    onCancel,
}: {
    value: string;
    onConfirm: (v: string) => void;
    onCancel: () => void;
}) {
    const [val, setVal] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const commit = () => {
        const trimmed = val.trim();
        if (trimmed) onConfirm(trimmed);
        else onCancel();
    };

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                boxSizing: 'border-box',
                minHeight: '28px',
                padding: '2px 4px 2px 6px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border-strong)',
                borderRadius: '7px',
            }}
        >
            <input
                ref={inputRef}
                type="text"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        commit();
                    } else if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        onCancel();
                    }
                }}
                onBlur={commit}
                style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-ui)',
                }}
            />
            <button
                type="button"
                aria-label="Annuler le renommage"
                title="Annuler"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                    e.stopPropagation();
                    onCancel();
                }}
                style={{
                    width: '22px',
                    height: '22px',
                    border: 'none',
                    background: 'transparent',
                    color: '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    borderRadius: '4px',
                }}
            >
                <RotateCcw size={12} />
            </button>
        </div>
    );
}

function ColorSwatchBar({
    currentColor,
    defaultColor,
    onPick,
}: {
    currentColor: string;
    defaultColor: string;
    onPick: (c: string) => void;
}) {
    const swatches = [
        { label: 'Par défaut', value: defaultColor, isDefault: true },
        ...PRESET_COLORS.filter((c) => c.value.toLowerCase() !== defaultColor.toLowerCase()).map((c) => ({
            ...c,
            isDefault: false,
        })),
    ].slice(0, 8);

    return (
        <div
            role="group"
            aria-label="Couleur du calque"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                flexWrap: 'wrap',
            }}
        >
            {swatches.map((c) => {
                const active = currentColor.toLowerCase() === c.value.toLowerCase();
                return (
                    <button
                        key={c.value}
                        type="button"
                        title={c.isDefault ? `${c.label} (aucune teinte)` : c.label}
                        aria-label={c.isDefault ? 'Couleur par défaut' : `Couleur ${c.label}`}
                        aria-pressed={active}
                        onClick={(e) => {
                            e.stopPropagation();
                            onPick(c.value);
                        }}
                        style={{
                            width: '16px',
                            height: '16px',
                            padding: 0,
                            borderRadius: '999px',
                            background: c.value,
                            border: active ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.18)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'transform 100ms ease',
                            transform: active ? 'scale(1.12)' : 'scale(1)',
                            position: 'relative',
                        }}
                    />
                );
            })}
        </div>
    );
}

function ChipSelector<T extends number>({
    label,
    options,
    value,
    onChange,
}: {
    label: string;
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
}) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: '#94A3B8', flexShrink: 0 }}>{label}</span>
            <div
                role="group"
                aria-label={label}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: '26px',
                    padding: '2px',
                    borderRadius: '7px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    gap: '2px',
                }}
            >
                {options.map((opt) => {
                    const active = opt.value === value;
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            aria-pressed={active}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(opt.value);
                            }}
                            className="tabular-nums"
                            style={{
                                height: '100%',
                                padding: '0 8px',
                                borderRadius: '5px',
                                border: 'none',
                                background: active ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                                color: active ? '#ffffff' : '#94A3B8',
                                fontSize: '11px',
                                fontWeight: active ? 600 : 500,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {opt.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

interface LayerRowProps {
    icon: React.ReactNode;
    label: string;
    rightText?: string;
    color: string;
    defaultColor: string;
    visible: boolean;
    isSelected: boolean;
    isEditing: boolean;
    isMobile: boolean;
    isHoveredDrag?: boolean;
    chevron?: React.ReactNode;
    isMultiSelected?: boolean;
    onSelect: (meta: { ctrl: boolean; shift: boolean }) => void;
    onToggleVisible: () => void;
    onStartRename: () => void;
    onConfirmRename: (v: string) => void;
    onCancelRename: () => void;
    onContextMenu: (x: number, y: number) => void;
    onColorPick: (c: string) => void;
    onDelete: () => void;
    detailSlot?: React.ReactNode;
    hoverSubline?: React.ReactNode;
    defaultSubline?: string;
    dragProps: {
        draggable: boolean;
        onDragStart: () => void;
        onDragOver: (e: React.DragEvent) => void;
        onDrop: (e: React.DragEvent) => void;
        onDragEnd: () => void;
    };
    rowRef?: (el: HTMLDivElement | null) => void;
}

function LayerRow({
    icon,
    label,
    rightText,
    color,
    defaultColor,
    visible,
    isSelected,
    isEditing,
    isMobile,
    chevron,
    isMultiSelected,
    onSelect,
    onToggleVisible,
    onStartRename,
    onConfirmRename,
    onCancelRename,
    onContextMenu,
    onColorPick,
    onDelete,
    detailSlot,
    hoverSubline,
    defaultSubline,
    dragProps,
    rowRef,
}: LayerRowProps) {
    const [isHovered, setIsHovered] = useState(false);
    const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const touchOriginRef = useRef<{ x: number; y: number } | null>(null);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (longPressRef.current) clearTimeout(longPressRef.current);
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        };
    }, []);

    return (
        <div
            ref={rowRef}
            role="option"
            aria-selected={isSelected}
            draggable={dragProps.draggable && !isEditing}
            onDragStart={dragProps.onDragStart}
            onDragOver={dragProps.onDragOver}
            onDrop={dragProps.onDrop}
            onDragEnd={dragProps.onDragEnd}
            onClick={(e) => {
                if (isEditing) return;
                const ctrl = e.ctrlKey || e.metaKey;
                const shift = e.shiftKey;
                // Modifier clicks are immediate (no double-click ambiguity)
                if (ctrl || shift) {
                    if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                    onSelect({ ctrl, shift });
                    return;
                }
                if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                clickTimerRef.current = setTimeout(() => {
                    clickTimerRef.current = null;
                    onSelect({ ctrl: false, shift: false });
                }, 210);
            }}
            onDoubleClick={(e) => {
                if (isEditing) return;
                e.stopPropagation();
                if (clickTimerRef.current) {
                    clearTimeout(clickTimerRef.current);
                    clickTimerRef.current = null;
                }
                onStartRename();
            }}
            onContextMenu={(e) => {
                if (isEditing) return;
                e.preventDefault();
                e.stopPropagation();
                onContextMenu(e.clientX, e.clientY);
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onTouchStart={(e) => {
                if (isEditing || e.touches.length !== 1) return;
                const t = e.touches[0];
                touchOriginRef.current = { x: t.clientX, y: t.clientY };
                if (longPressRef.current) clearTimeout(longPressRef.current);
                longPressRef.current = setTimeout(() => {
                    touchOriginRef.current = null;
                    onContextMenu(t.clientX, t.clientY);
                }, 500);
            }}
            onTouchMove={(e) => {
                if (!longPressRef.current || !touchOriginRef.current || e.touches.length !== 1) return;
                const dx = e.touches[0].clientX - touchOriginRef.current.x;
                const dy = e.touches[0].clientY - touchOriginRef.current.y;
                if (Math.hypot(dx, dy) > 8) {
                    clearTimeout(longPressRef.current);
                    longPressRef.current = null;
                }
            }}
            onTouchEnd={() => {
                if (longPressRef.current) {
                    clearTimeout(longPressRef.current);
                    longPressRef.current = null;
                }
            }}
            style={{
                borderBottom: '1px solid var(--border-subtle)',
                background: (() => {
                    const isCustomColor = color.toLowerCase() !== defaultColor.toLowerCase();
                    const overlay = isSelected
                        ? 'rgba(255, 255, 255, 0.06)'
                        : isMultiSelected
                          ? 'rgba(255, 255, 255, 0.045)'
                          : isHovered
                            ? 'rgba(255, 255, 255, 0.03)'
                            : 'transparent';
                    if (!isCustomColor) return overlay;
                    const tintPct = visible ? 14 : 7;
                    return `linear-gradient(${overlay}, ${overlay}), color-mix(in srgb, ${color} ${tintPct}%, transparent)`;
                })(),
                transition: 'background 120ms ease',
                cursor: isEditing ? 'text' : 'grab',
            }}
        >
            {/* Primary row */}
            <div
                style={{
                    display: 'flex',
                    alignItems: isSelected && !isEditing ? 'flex-start' : 'center',
                    gap: '8px',
                    padding: isEditing ? '6px 12px' : isSelected ? '10px 12px 0 12px' : '4px 12px',
                    minHeight: isSelected ? undefined : isMobile ? '48px' : '40px',
                }}
            >
                {/* Visibility Eye (neutral) */}
                <button
                    type="button"
                    aria-label={visible ? 'Masquer le calque' : 'Afficher le calque'}
                    title={visible ? 'Masquer' : 'Afficher'}
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleVisible();
                    }}
                    style={{
                        width: '24px',
                        height: '24px',
                        marginTop: isSelected && !isEditing ? '-1px' : 0,
                        border: 'none',
                        borderRadius: '6px',
                        background: 'transparent',
                        color: visible ? '#94A3B8' : '#64748B',
                        opacity: visible ? 1 : 0.45,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                    }}
                >
                    {visible ? <Eye size={14} /> : <EyeOff size={14} />}
                </button>

                {/* Colored Type Icon (carries the object color directly) */}
                <span
                    aria-hidden="true"
                    style={{
                        width: '18px',
                        height: '20px',
                        marginTop: isSelected && !isEditing ? '1px' : 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color,
                        opacity: visible ? 1 : 0.45,
                        flexShrink: 0,
                    }}
                >
                    {icon}
                </span>

                {/* Name + optional 2nd line (when selected) */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {isEditing ? (
                        <InlineRename value={label} onConfirm={onConfirmRename} onCancel={onCancelRename} />
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                                <span
                                    title={label}
                                    style={{
                                        fontSize: '12.5px',
                                        fontWeight: isSelected ? 600 : 500,
                                        color: 'var(--text-primary)',
                                        opacity: visible ? 1 : 0.45,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        lineHeight: 1.3,
                                        minWidth: 0,
                                    }}
                                >
                                    {label}
                                </span>
                                {isHovered && (
                                    <button
                                        type="button"
                                        aria-label="Renommer le calque"
                                        title="Renommer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onStartRename();
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '0 2px',
                                            color: '#94A3B8',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            flexShrink: 0,
                                            lineHeight: 1,
                                        }}
                                    >
                                        <Edit3 size={12} aria-hidden="true" />
                                    </button>
                                )}
                            </div>
                            {isSelected && (defaultSubline || hoverSubline) && (
                                <div
                                    style={{
                                        height: '15px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontSize: '12px',
                                        color: '#94A3B8',
                                        lineHeight: 1.25,
                                        overflow: 'hidden',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {isHovered && hoverSubline ? (
                                        hoverSubline
                                    ) : (
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {defaultSubline}
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right slot: short info + optional chevron */}
                {!isEditing && (rightText || chevron) && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0,
                            marginTop: isSelected ? '1px' : 0,
                        }}
                    >
                        {rightText && (
                            <span
                                className="tabular-nums"
                                style={{
                                    fontSize: '12px',
                                    color: '#94A3B8',
                                    fontWeight: 500,
                                    whiteSpace: 'nowrap',
                                    opacity: visible ? 1 : 0.45,
                                    maxWidth: '140px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {rightText}
                            </span>
                        )}
                        {chevron}
                    </div>
                )}
            </div>

            {/* Animated open row: type detail + 8-color palette + isolated Delete */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    display: 'grid',
                    gridTemplateRows: isSelected && !isEditing ? '1fr' : '0fr',
                    opacity: isSelected && !isEditing ? 1 : 0,
                    transition: 'grid-template-rows 150ms ease, opacity 150ms ease',
                }}
            >
                <div style={{ overflow: 'hidden' }}>
                    <div
                        style={{
                            padding: '10px 12px 10px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                        }}
                    >
                        {detailSlot}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                            <ColorSwatchBar currentColor={color} defaultColor={defaultColor} onPick={onColorPick} />
                            <button
                                type="button"
                                aria-label="Supprimer le calque"
                                title="Supprimer"
                                onClick={onDelete}
                                style={{
                                    boxSizing: 'border-box',
                                    marginLeft: 'auto',
                                    width: isMobile ? '36px' : '30px',
                                    height: isMobile ? '36px' : '30px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    color: 'var(--semantic-red)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    flexShrink: 0,
                                }}
                            >
                                <Trash2 size={12} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function LayerAddButtons({
    variant = 'bar',
    onCreated,
}: {
    variant?: 'bar' | 'sheet';
    onCreated?: (id: string) => void;
}) {
    const { state, dispatch } = useApp();
    const draws = ((state as any).draw_annotations as DrawAnnotation[]) || [];
    const texts = ((state as any).text_annotations as TextAnnotation[]) || [];
    const selectedId = state.selected_layer_id;
    const isBar = variant === 'bar';

    const items = [
        {
            kind: 'itin' as const,
            label: 'Ajouter un tracé · P',
            Icon: Route,
            onTap: () => {
                dispatch({ type: 'ADD_ITINERARY' });
                dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
            },
        },
        {
            kind: 'point' as const,
            label: 'Ajouter un repère · R',
            Icon: MapPin,
            onTap: () => {
                const id = `poi-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const ptCount = (state.point_annotations?.length || 0) + 1;
                dispatch({
                    type: 'ADD_POINT_ANNOTATION',
                    point: { id, type: 'point' as const, title: `Repère ${ptCount}`, text: '', coords: [0, 0] as [number, number], color: DEFAULT_LAYER_COLORS.point, icon: 'pin' as const, layerId: 'layer-points', visible: false } as any
                });
                dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_point' });
                onCreated?.(id);
            },
        },
        {
            kind: 'area' as const,
            label: 'Ajouter une zone · Z',
            Icon: Pentagon,
            onTap: () => {
                const id = `area-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const areaCount = (state.area_annotations?.length || 0) + 1;
                dispatch({
                    type: 'ADD_AREA_ANNOTATION',
                    area: { id, type: 'area' as const, title: `Zone ${areaCount}`, text: '', layerId: 'layer-areas', coords: [] as [number, number][], fillOpacity: 0.3, visible: false, followRoads: false, edgeRoutes: [] } as any
                });
                dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_area' });
                onCreated?.(id);
            },
        },
        {
            kind: 'draw' as const,
            label: 'Ajouter un dessin · B',
            Icon: Pencil,
            onTap: () => {
                const id = `draw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const newDraw: DrawAnnotation = {
                    id,
                    type: 'draw',
                    layerId: 'layer-draws',
                    title: `Dessin ${draws.length + 1}`,
                    visible: true,
                    color: DEFAULT_LAYER_COLORS.draw,
                    strokeWidth: 4,
                    opacity: 1,
                    strokes: [],
                    createdAt: Date.now(),
                };
                dispatch({ type: 'ADD_DRAW_ANNOTATION', draw: newDraw } as any);
                dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_draw' });
                onCreated?.(id);
            },
        },
        {
            kind: 'text' as const,
            label: 'Ajouter un texte · T',
            Icon: Type,
            onTap: () => {
                const id = `text-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                const count = texts.length + 1;
                const newText: TextAnnotation = {
                    id,
                    type: 'text',
                    layerId: 'layer-texts',
                    title: count === 1 ? 'Textes' : `Textes ${count}`,
                    visible: true,
                    color: DEFAULT_LAYER_COLORS.text,
                    fontSize: 16,
                    opacity: 1,
                    texts: [],
                    createdAt: Date.now(),
                };
                dispatch({ type: 'ADD_TEXT_ANNOTATION', text: newText } as any);
                dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_text' });
                onCreated?.(id);
            },
        },
    ];

    return (
        <div
            role="group"
            aria-label="Ajouter un calque"
            style={
                isBar
                    ? { display: 'flex', alignItems: 'center', gap: '2px' }
                    : { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', width: '100%' }
            }
        >
            {items.map(({ kind, label, Icon, onTap }) => (
                <button
                    key={kind}
                    type="button"
                    aria-label={label}
                    title={label}
                    onClick={onTap}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = isBar ? 'transparent' : 'rgba(255, 255, 255, 0.04)';
                        e.currentTarget.style.color = '#94A3B8';
                    }}
                    style={{
                        position: 'relative',
                        width: isBar ? '32px' : undefined,
                        height: isBar ? '32px' : '44px',
                        borderRadius: isBar ? '10px' : '7px',
                        border: 'none',
                        background: isBar ? 'transparent' : 'rgba(255, 255, 255, 0.04)',
                        color: '#94A3B8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 120ms ease, color 120ms ease',
                        flexShrink: 0,
                    }}
                >
                    <Icon size={15} strokeWidth={2} aria-hidden="true" />
                    <Plus
                        size={8}
                        strokeWidth={2.75}
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            top: isBar ? '4px' : '8px',
                            right: isBar ? '4px' : '10px',
                            opacity: 0.9,
                        }}
                    />
                </button>
            ))}
        </div>
    );
}

// ── Layer Drag Preview Row ─────────────────────────────────────────────────────
/** Ghost placeholder row shown at the insertion point during layer drag-and-drop. */
function LayerPreviewRow({
    item,
    label,
    onDrop,
}: {
    item: OrderItem;
    label: string;
    onDrop: () => void;
}) {
    const iconMap: Record<OrderItem['kind'], React.ReactNode> = {
        itin: <Route size={13} strokeWidth={2.2} />,
        point: <MapPin size={13} strokeWidth={2.2} />,
        area: <Pentagon size={13} strokeWidth={2.2} />,
        draw: <Pencil size={13} strokeWidth={2.2} />,
        text: <Type size={13} strokeWidth={2.2} />,
    };
    const color = DEFAULT_LAYER_COLORS[item.kind];
    return (
        <div
            aria-hidden="true"
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDrop();
            }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                margin: '2px 6px',
                padding: '6px 10px',
                minHeight: '34px',
                borderRadius: '8px',
                background: 'rgba(148, 163, 184, 0.07)',
                border: '1.5px dashed rgba(148, 163, 184, 0.4)',
                pointerEvents: 'auto',
            }}
        >
            <span style={{ color, opacity: 0.6, flexShrink: 0, display: 'flex' }}>
                {iconMap[item.kind]}
            </span>
            <span
                style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: '12px',
                    fontWeight: 500,
                    color: '#94A3B8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
            >
                {label}
            </span>
        </div>
    );
}

export default function LayerManagerPanel({
    isMobile = false,
}: {
    isMobile?: boolean;
    onClose?: () => void;
}) {
    const { state, dispatch } = useApp();

    const itineraries = state.itineraries || [];
    const activeItinId = state.active_itinerary_id;
    const points = state.point_annotations || [];
    const areas = state.area_annotations || [];
    const draws = ((state as any).draw_annotations as DrawAnnotation[]) || [];
    const texts = ((state as any).text_annotations as TextAnnotation[]) || [];
    const selectedId = state.selected_layer_id;
    const selectedSublayerId = state.selected_sublayer_id;

    const savedLayerOrder = ((state as any).layer_order as OrderItem[]) || [];
    const [order, setOrder] = useState<OrderItem[]>([]);
    const [expandedDrawIds, setExpandedDrawIds] = useState<Set<string>>(new Set());
    const [expandedTextIds, setExpandedTextIds] = useState<Set<string>>(new Set());
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; items: (CtxMenuItem | CtxMenuSeparator)[] } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [copyToast, setCopyToast] = useState<{ text: string; key: number } | null>(null);

    const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const dragIdx = useRef<number | null>(null);
    /** Reactive mirror of dragIdx.current for JSX rendering — updated alongside the ref. */
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    /** Insert index (0 = before first, N = after last). null = not dragging. */
    const [dropInsert, setDropInsert] = useState<number | null>(null);
    /** Multi-selection set (layer ids). When non-empty, single detail view is suppressed. */
    const [multiSel, setMultiSel] = useState<Set<string>>(new Set());
    /** Index of the last plain-clicked item, used as anchor for Shift-range. */
    const lastSelIdx = useRef<number | null>(null);

    useEffect(() => {
        if (!copyToast) return;
        const t = setTimeout(() => setCopyToast(null), 2500);
        return () => clearTimeout(t);
    }, [copyToast]);

    // Auto-scroll selected layer into view
    useEffect(() => {
        if (!selectedId) return;
        const el = rowRefs.current.get(selectedId);
        if (!el) return;
        const t = setTimeout(() => {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 60);
        return () => clearTimeout(t);
    }, [selectedId]);

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
        setOrder((prev) => (layerOrdersEqual(prev, next) ? prev : next));
        if (!layerOrdersEqual(savedLayerOrder, next)) {
            dispatch({ type: 'SET_LAYER_ORDER', order: next, recordHistory: false });
        }
    }, [itineraries, points, areas, draws, texts, state.selected_layer_id, savedLayerOrder, order, dispatch]);

    const handleSelectRow = (item: OrderItem) => {
        const isAlreadySelected = selectedId === item.id && !selectedSublayerId;
        const nextId = isAlreadySelected ? null : item.id;
        dispatch({ type: 'SET_SELECTED_LAYER', id: nextId });

        if (!nextId) return;
        if (item.kind === 'area') {
            const area = areas.find((a) => a.id === item.id);
            const targetTool = area?.followRoads ? 'annotate_area_routed' : 'annotate_area';
            if (state.active_tool !== targetTool) dispatch({ type: 'SET_ACTIVE_TOOL', tool: targetTool });
        } else if (item.kind === 'draw') {
            if (state.active_tool !== 'annotate_draw') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_draw' });
        } else if (item.kind === 'text') {
            if (state.active_tool !== 'annotate_text') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_text' });
        } else if (item.kind === 'itin') {
            if (state.active_tool !== 'route') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
        }
    };

    const handleCopyPointCoords = (pt: PointAnnotation) => {
        const text = `${pt.coords[0].toFixed(4)}, ${pt.coords[1].toFixed(4)}`;
        navigator.clipboard?.writeText(text).catch(() => {});
        setCopiedId(pt.id);
        setCopyToast({ text, key: Date.now() });
        setTimeout(() => setCopiedId((prev) => (prev === pt.id ? null : prev)), 1500);
    };

    /**
     * insertAt: the destination index in the original `order` array (0 = before first item, order.length = after last).
     * After removing the dragged item, we insert before that adjusted position.
     */
    const handleDrop = (insertAt: number) => {
        const from = dragIdx.current;
        dragIdx.current = null;
        setDraggingIdx(null);
        setDropInsert(null);
        if (from === null) return;
        // Clamp to valid range
        const target = Math.max(0, Math.min(insertAt, order.length));
        if (from === target || from === target - 1) return; // no-op
        const next = [...order];
        const [moved] = next.splice(from, 1);
        // After removing `from`, insertion index shifts if target > from
        const adjustedTarget = target > from ? target - 1 : target;
        next.splice(adjustedTarget, 0, moved);
        setOrder(next);
        dispatch({ type: 'SET_LAYER_ORDER', order: next as any });
    };

    const getItinMeters = (itin: Itinerary) => {
        const routes = itin.id === activeItinId ? state.routes : itin.routes || [];
        return routes.reduce((acc, r) => acc + (r?.distance_m || 0), 0);
    };

    const visibleCount = order.filter((item) => {
        if (item.kind === 'itin') return itineraries.find((x) => x.id === item.id)?.visible !== false;
        if (item.kind === 'point') return points.find((x) => x.id === item.id)?.visible !== false;
        if (item.kind === 'area') return areas.find((x) => x.id === item.id)?.visible !== false;
        if (item.kind === 'draw') return draws.find((x) => x.id === item.id)?.visible !== false;
        if (item.kind === 'text') return texts.find((x) => x.id === item.id)?.visible !== false;
        return false;
    }).length;

    const handleToggleAllVisibility = useCallback(() => {
        const hideAll = visibleCount > 0;
        order.forEach((item) => {
            if (item.kind === 'itin') {
                const it = itineraries.find((x) => x.id === item.id);
                if (it && (it.visible !== false) === hideAll) {
                    dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: it.id });
                }
            } else if (item.kind === 'point') {
                const pt = points.find((x) => x.id === item.id);
                if (pt && pt.visible === hideAll) dispatch({ type: 'TOGGLE_POINT_VISIBILITY', id: pt.id });
            } else if (item.kind === 'area') {
                const area = areas.find((x) => x.id === item.id);
                if (area && area.visible === hideAll) dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: area.id });
            } else if (item.kind === 'draw') {
                const draw = draws.find((x) => x.id === item.id);
                if (draw && draw.visible === hideAll) dispatch({ type: 'TOGGLE_DRAW_VISIBILITY', id: draw.id } as any);
            } else if (item.kind === 'text') {
                const text = texts.find((x) => x.id === item.id);
                if (text && text.visible === hideAll) dispatch({ type: 'TOGGLE_TEXT_VISIBILITY', id: text.id } as any);
            }
        });
    }, [dispatch, order, visibleCount, itineraries, points, areas, draws, texts]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'h') {
                const tag = (document.activeElement as HTMLElement | null)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                e.preventDefault();
                handleToggleAllVisibility();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [handleToggleAllVisibility]);

    /** Delete a single layer item by kind+id. */
    const deleteItem = useCallback((item: OrderItem) => {
        if (item.kind === 'itin') dispatch({ type: 'REMOVE_ITINERARY', id: item.id });
        else if (item.kind === 'point') dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: item.id });
        else if (item.kind === 'area') dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: item.id });
        else if (item.kind === 'draw') dispatch({ type: 'REMOVE_DRAW_ANNOTATION', id: item.id } as any);
        else if (item.kind === 'text') dispatch({ type: 'REMOVE_TEXT_ANNOTATION', id: item.id } as any);
    }, [dispatch]);

    /** Toggle visibility for a single layer item. */
    const toggleItemVisibility = useCallback((item: OrderItem) => {
        if (item.kind === 'itin') dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: item.id });
        else if (item.kind === 'point') dispatch({ type: 'TOGGLE_POINT_VISIBILITY', id: item.id });
        else if (item.kind === 'area') dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: item.id });
        else if (item.kind === 'draw') dispatch({ type: 'TOGGLE_DRAW_VISIBILITY', id: item.id } as any);
        else if (item.kind === 'text') dispatch({ type: 'TOGGLE_TEXT_VISIBILITY', id: item.id } as any);
    }, [dispatch]);

    // Escape → clear multi-selection; Delete → delete all selected
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (document.activeElement as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'Escape') {
                if (multiSel.size > 0) { e.preventDefault(); setMultiSel(new Set()); }
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && multiSel.size > 0) {
                e.preventDefault();
                const items = order.filter((x) => multiSel.has(x.id));
                if (!window.confirm(`Supprimer ${items.length} calque${items.length > 1 ? 's' : ''} ?`)) return;
                items.forEach(deleteItem);
                setMultiSel(new Set());
                dispatch({ type: 'SET_SELECTED_LAYER', id: null });
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [multiSel, order, deleteItem, dispatch]);

    const closeCtx = useCallback(() => setCtxMenu(null), []);

    const setRowRef = (id: string) => (el: HTMLDivElement | null) => {
        if (el) rowRefs.current.set(id, el);
        else rowRefs.current.delete(id);
    };

    /**
     * Unified click handler for all layer rows.
     * - Plain click: clear multi-sel, do single-select (may expand).
     * - Ctrl/Cmd click: toggle item in multi-sel without expanding.
     * - Shift click: add range from lastSelIdx anchor without expanding.
     * Returns true if the caller should proceed with single-select expand; false to skip.
     */
    const handleLayerClick = useCallback((
        item: OrderItem,
        idx: number,
        meta: { ctrl: boolean; shift: boolean },
        onPlainSelect: () => void,
    ) => {
        if (meta.ctrl) {
            setMultiSel((prev) => {
                const next = new Set(prev);
                if (next.has(item.id)) next.delete(item.id);
                else next.add(item.id);
                return next;
            });
            lastSelIdx.current = idx;
            return;
        }
        if (meta.shift && lastSelIdx.current !== null) {
            const from = Math.min(lastSelIdx.current, idx);
            const to = Math.max(lastSelIdx.current, idx);
            setMultiSel(new Set(order.slice(from, to + 1).map((x) => x.id)));
            return;
        }
        // Plain click: clear multi-sel and do normal select
        setMultiSel(new Set());
        lastSelIdx.current = idx;
        onPlainSelect();
    }, [order]);

    const renderItem = (item: OrderItem, idx: number) => {
        // In multi-select mode, only show highlight — no expand
        const isInMultiSel = multiSel.has(item.id);
        // "expanded" means the detail slot is visible: only when truly single-selected and not in multi-sel mode
        const isExpanded = selectedId === item.id && multiSel.size === 0;
        // Visual selection (highlight) = expanded OR multi-selected
        const isSelected = isExpanded || isInMultiSel;

        /** Build a multi-selection context menu (common actions for all selected items). */
        const multiCtxItems = (): (CtxMenuItem | CtxMenuSeparator)[] => {
            const selItems = order.filter((x) => multiSel.has(x.id));
            const n = selItems.length;
            const label = `${n} calque${n > 1 ? 's' : ''}`;
            return [
                {
                    icon: <EyeOff size={13} />,
                    label: `Masquer · ${label}`,
                    onClick: () => { selItems.forEach(toggleItemVisibility); },
                },
                {
                    icon: <Eye size={13} />,
                    label: `Afficher · ${label}`,
                    onClick: () => { selItems.forEach(toggleItemVisibility); },
                },
                { separator: true as const },
                {
                    icon: <Trash2 size={13} />,
                    label: `Supprimer · ${label}`,
                    danger: true,
                    onClick: () => {
                        if (window.confirm(`Supprimer ${n} calque${n > 1 ? 's' : ''} ?`)) {
                            selItems.forEach(deleteItem);
                            setMultiSel(new Set());
                            dispatch({ type: 'SET_SELECTED_LAYER', id: null });
                        }
                    },
                },
            ];
        };
        const dragProps = {
            draggable: true,
            onDragStart: () => {
                dragIdx.current = idx;
                setDraggingIdx(idx);
                setDropInsert(null);
            },
            onDragOver: (e: React.DragEvent) => {
                e.preventDefault();
                if (dragIdx.current === null) return;
                // Insert before or after based on mouse Y relative to row midpoint
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const insert = e.clientY < rect.top + rect.height / 2 ? idx : idx + 1;
                setDropInsert(insert);
            },
            onDrop: (e?: React.DragEvent) => {
                e?.preventDefault();
                handleDrop(dropInsert ?? idx);
            },
            onDragEnd: () => {
                dragIdx.current = null;
                setDraggingIdx(null);
                setDropInsert(null);
            },
        };

        if (item.kind === 'itin') {
            const itin = itineraries.find((x) => x.id === item.id);
            if (!itin) return null;
            const meters = getItinMeters(itin);
            const isActive = itin.id === activeItinId;
            const visible = itin.visible !== false;

            return (
                <div key={item.id} style={{}}>
                    <LayerRow
                        rowRef={setRowRef(itin.id)}
                        icon={<Route size={14} strokeWidth={2.2} />}
                        label={itin.name}
                        rightText={formatDistanceFr(meters)}
                        color={itin.color}
                        defaultColor={DEFAULT_LAYER_COLORS.itin}
                        visible={visible}
                        isSelected={isSelected}
                        isMultiSelected={isInMultiSel && multiSel.size >= 2}
                        isEditing={renamingId === itin.id}
                        isMobile={isMobile}
                        chevron={
                            <button
                                type="button"
                                aria-label="Activer ce tracé"
                                title={isActive ? 'Tracé actif' : 'Activer ce tracé'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id });
                                    dispatch({ type: 'SET_SELECTED_LAYER', id: itin.id });
                                }}
                                style={{
                                    width: '20px',
                                    height: '20px',
                                    padding: 0,
                                    border: 'none',
                                    background: 'transparent',
                                    color: isActive ? 'var(--text-primary)' : '#94A3B8',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                }}
                            >
                                <ChevronRight size={13} />
                            </button>
                        }
                        onSelect={(meta) => handleLayerClick(item, idx, meta, () => {
                            const wasSelected = selectedId === item.id && !selectedSublayerId;
                            handleSelectRow(item);
                            if (!wasSelected) dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id });
                        })}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: itin.id })}
                        onStartRename={() => setRenamingId(itin.id)}
                        onConfirmRename={(v) => {
                            dispatch({ type: 'UPDATE_ITINERARY', id: itin.id, name: v });
                            setRenamingId(null);
                        }}
                        onCancelRename={() => setRenamingId(null)}
                        onColorPick={(c) => dispatch({ type: 'UPDATE_ITINERARY', id: itin.id, color: c })}
                        onDelete={() => {
                            if (window.confirm(`Supprimer « ${itin.name} » ?`)) {
                                dispatch({ type: 'REMOVE_ITINERARY', id: itin.id });
                            }
                        }}
                        onContextMenu={(x, y) =>
                            setCtxMenu({
                                x,
                                y,
                                items: isInMultiSel && multiSel.size >= 2 ? multiCtxItems() : [
                                    { icon: <Edit3 size={13} />, label: 'Renommer', onClick: () => setRenamingId(itin.id) },
                                    {
                                        icon: visible ? <EyeOff size={13} /> : <Eye size={13} />,
                                        label: visible ? 'Masquer' : 'Afficher',
                                        onClick: () => dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: itin.id }),
                                    },
                                    { separator: true },
                                    {
                                        icon: <Trash2 size={13} />,
                                        label: 'Supprimer',
                                        danger: true,
                                        onClick: () => {
                                            if (window.confirm(`Supprimer « ${itin.name} » ?`)) {
                                                dispatch({ type: 'REMOVE_ITINERARY', id: itin.id });
                                            }
                                        },
                                    },
                                ],
                            })
                        }
                        detailSlot={
                            isExpanded && itineraries.length > 1 ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '54px' }}>
                                    <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                                        {isActive ? 'Tracé actif dans Étapes' : 'Tracé secondaire'}
                                    </span>
                                    {!isActive && (
                                        <button
                                            type="button"
                                            onClick={() => dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id })}
                                            style={{
                                                padding: '3px 8px',
                                                borderRadius: '6px',
                                                border: '1px solid var(--border-subtle)',
                                                background: 'rgba(255,255,255,0.06)',
                                                color: 'var(--text-primary)',
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Définir comme actif
                                        </button>
                                    )}
                                </div>
                            ) : undefined
                        }
                        dragProps={dragProps}
                    />
                </div>
            );
        }

        if (item.kind === 'point') {
            const pt = points.find((x) => x.id === item.id);
            if (!pt) return null;
            const parsed = pt.address ? formatStageAddress(pt.address) : null;
            const coordsText = `${pt.coords[0].toFixed(4)}, ${pt.coords[1].toFixed(4)}`;
            const isCopied = copiedId === pt.id;

            return (
                <div key={item.id} style={{}}>
                    <LayerRow
                        rowRef={setRowRef(pt.id)}
                        icon={<MapPin size={14} strokeWidth={2.2} />}
                        label={pt.title}
                        rightText={!isExpanded ? parsed?.primary || undefined : undefined}
                        defaultSubline={parsed?.secondary || parsed?.primary || coordsText}
                        hoverSubline={
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyPointCoords(pt);
                                }}
                                title="Copier les coordonnées"
                                aria-label="Copier les coordonnées"
                                className="tabular-nums"
                                style={{
                                    padding: 0,
                                    background: 'transparent',
                                    border: 'none',
                                    fontSize: '11.5px',
                                    color: isCopied ? '#CBD5E1' : '#94A3B8',
                                    fontFamily: 'var(--font-mono)',
                                    lineHeight: 1.25,
                                    whiteSpace: 'nowrap',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    cursor: 'pointer',
                                }}
                            >
                                <span>{coordsText}</span>
                                {isCopied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
                            </button>
                        }
                        color={pt.color}
                        defaultColor={DEFAULT_LAYER_COLORS.point}
                        visible={pt.visible}
                        isSelected={isSelected}
                        isMultiSelected={isInMultiSel && multiSel.size >= 2}
                        isEditing={renamingId === pt.id}
                        isMobile={isMobile}
                        onSelect={(meta) => handleLayerClick(item, idx, meta, () => {
                            handleSelectRow(item);
                            mapRef.current?.flyTo(pt.coords, Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 });
                        })}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_POINT_VISIBILITY', id: pt.id })}
                        onStartRename={() => setRenamingId(pt.id)}
                        onConfirmRename={(v) => {
                            dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { title: v } });
                            setRenamingId(null);
                        }}
                        onCancelRename={() => setRenamingId(null)}
                        onColorPick={(c) => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { color: c } })}
                        onDelete={() => dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: pt.id })}
                        onContextMenu={(x, y) =>
                            setCtxMenu({
                                x,
                                y,
                                items: isInMultiSel && multiSel.size >= 2 ? multiCtxItems() : [
                                    { icon: <Edit3 size={13} />, label: 'Renommer', onClick: () => setRenamingId(pt.id) },
                                    {
                                        icon: <MapPin size={13} />,
                                        label: 'Copier les coordonnées',
                                        onClick: () => handleCopyPointCoords(pt),
                                    },
                                    { separator: true },
                                    {
                                        icon: <Trash2 size={13} />,
                                        label: 'Supprimer',
                                        danger: true,
                                        onClick: () => dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: pt.id }),
                                    },
                                ],
                            })
                        }
                        dragProps={dragProps}
                    />
                </div>
            );
        }

        if (item.kind === 'area') {
            const area = areas.find((x) => x.id === item.id);
            if (!area) return null;
            const isComplete = area.coords.length >= 3;
            const surface = area.formatted_area || (isComplete ? formatArea(calculatePolygonArea(area.coords)) : `${area.coords.length} pts`);

            return (
                <div key={item.id} style={{}}>
                    <LayerRow
                        rowRef={setRowRef(area.id)}
                        icon={<Pentagon size={14} strokeWidth={2.2} />}
                        label={area.title}
                        rightText={surface}
                        color={area.color}
                        defaultColor={DEFAULT_LAYER_COLORS.area}
                        visible={area.visible}
                        isSelected={isSelected}
                        isMultiSelected={isInMultiSel && multiSel.size >= 2}
                        isEditing={renamingId === area.id}
                        isMobile={isMobile}
                        onSelect={(meta) => handleLayerClick(item, idx, meta, () => {
                            handleSelectRow(item);
                            if (isComplete) mapRef.current?.fitBounds(area.coords, { padding: [40, 40], maxZoom: 16 });
                        })}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: area.id })}
                        onStartRename={() => setRenamingId(area.id)}
                        onConfirmRename={(v) => {
                            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { title: v } });
                            setRenamingId(null);
                        }}
                        onCancelRename={() => setRenamingId(null)}
                        onColorPick={(c) => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { color: c } })}
                        onDelete={() => dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id })}
                        onContextMenu={(x, y) =>
                            setCtxMenu({
                                x,
                                y,
                                items: isInMultiSel && multiSel.size >= 2 ? multiCtxItems() : [
                                    { icon: <Edit3 size={13} />, label: 'Renommer', onClick: () => setRenamingId(area.id) },
                                    {
                                        icon: area.visible ? <EyeOff size={13} /> : <Eye size={13} />,
                                        label: area.visible ? 'Masquer' : 'Afficher',
                                        onClick: () => dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: area.id }),
                                    },
                                    { separator: true },
                                    {
                                        icon: <Trash2 size={13} />,
                                        label: 'Supprimer',
                                        danger: true,
                                        onClick: () => dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id }),
                                    },
                                ],
                            })
                        }
                        detailSlot={
                            isExpanded ? <ChipSelector
                                label="Remplissage"
                                value={
                                    area.fillOpacity <= 0.25 ? 0.2 : area.fillOpacity >= 0.5 ? 0.6 : 0.35
                                }
                                options={[
                                    { value: 0.2, label: '20 %' },
                                    { value: 0.35, label: '35 %' },
                                    { value: 0.6, label: '60 %' },
                                ]}
                                onChange={(val) =>
                                    dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { fillOpacity: val } })
                                }
                            /> : undefined
                        }
                        dragProps={dragProps}
                    />
                </div>
            );
        }

        if (item.kind === 'draw') {
            const draw = draws.find((x) => x.id === item.id);
            if (!draw) return null;
            const strokes = (draw.strokes || []) as unknown as DrawStroke[];
            const hasMultiple = strokes.length > 1;
            const isDrawExpanded = hasMultiple && expandedDrawIds.has(draw.id);
            const isLayerOnlySelected = isExpanded && !selectedSublayerId;

            return (
                <div key={item.id} style={{}}>
                    <LayerRow
                        rowRef={setRowRef(draw.id)}
                        icon={<Pencil size={14} strokeWidth={2.2} />}
                        label={draw.title}
                        rightText={`${strokes.length} trait${strokes.length !== 1 ? 's' : ''}`}
                        color={draw.color}
                        defaultColor={DEFAULT_LAYER_COLORS.draw}
                        visible={draw.visible}
                        isSelected={isLayerOnlySelected || (isInMultiSel && multiSel.size < 2)}
                        isMultiSelected={isInMultiSel && multiSel.size >= 2}
                        isEditing={renamingId === draw.id}
                        isMobile={isMobile}
                        chevron={
                            hasMultiple ? (
                                <button
                                    type="button"
                                    aria-label={isDrawExpanded ? 'Replier les traits' : 'Déplier les traits'}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedDrawIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(draw.id)) next.delete(draw.id);
                                            else next.add(draw.id);
                                            return next;
                                        });
                                    }}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        padding: 0,
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#94A3B8',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isDrawExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                            ) : undefined
                        }
                        onSelect={(meta) => handleLayerClick(item, idx, meta, () => handleSelectRow(item))}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_DRAW_VISIBILITY', id: draw.id } as any)}
                        onStartRename={() => setRenamingId(draw.id)}
                        onConfirmRename={(v) => {
                            dispatch({ type: 'UPDATE_DRAW_ANNOTATION', id: draw.id, patch: { title: v } } as any);
                            setRenamingId(null);
                        }}
                        onCancelRename={() => setRenamingId(null)}
                        onColorPick={(c) => dispatch({ type: 'UPDATE_DRAW_ANNOTATION', id: draw.id, patch: { color: c } } as any)}
                        onDelete={() => dispatch({ type: 'REMOVE_DRAW_ANNOTATION', id: draw.id } as any)}
                        onContextMenu={(x, y) =>
                            setCtxMenu({
                                x,
                                y,
                                items: isInMultiSel && multiSel.size >= 2 ? multiCtxItems() : [
                                    { icon: <Edit3 size={13} />, label: 'Renommer', onClick: () => setRenamingId(draw.id) },
                                    {
                                        icon: draw.visible ? <EyeOff size={13} /> : <Eye size={13} />,
                                        label: draw.visible ? 'Masquer' : 'Afficher',
                                        onClick: () => dispatch({ type: 'TOGGLE_DRAW_VISIBILITY', id: draw.id } as any),
                                    },
                                    { separator: true },
                                    {
                                        icon: <Trash2 size={13} />,
                                        label: 'Supprimer',
                                        danger: true,
                                        onClick: () => dispatch({ type: 'REMOVE_DRAW_ANNOTATION', id: draw.id } as any),
                                    },
                                ],
                            })
                        }
                        detailSlot={
                            isExpanded && strokes.length === 1 ? (
                                <ChipSelector
                                    label="Épaisseur"
                                    value={strokes[0].strokeWidth <= 2 ? 2 : strokes[0].strokeWidth >= 6 ? 6 : 4}
                                    options={[
                                        { value: 2, label: '2 px' },
                                        { value: 4, label: '4 px' },
                                        { value: 6, label: '6 px' },
                                    ]}
                                    onChange={(val) =>
                                        dispatch({
                                            type: 'UPDATE_DRAW_STROKE',
                                            drawId: draw.id,
                                            strokeId: strokes[0].id,
                                            patch: { strokeWidth: val },
                                        } as any)
                                    }
                                />
                            ) : undefined
                        }
                        dragProps={dragProps}
                    />

                    {/* Child strokes indented 24px + vertical guide line (only when >1 element) */}
                    {isDrawExpanded && (
                        <div style={{ marginLeft: '24px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                        {strokes.map((stroke, sIdx) => {
                            const isSubSelected = isLayerOnlySelected && selectedSublayerId === stroke.id;
                            return (
                                <div
                                    key={stroke.id}
                                    role="option"
                                    aria-selected={isSubSelected}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dispatch({
                                            type: 'SET_SELECTED_SUBLAYER',
                                            layerId: draw.id,
                                            sublayerId: isSubSelected ? null : stroke.id,
                                        } as any);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        minHeight: isMobile ? '40px' : '34px',
                                        padding: '4px 12px 4px 8px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        background: isSubSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '999px',
                                            border: isSubSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                                            background: isSubSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                            color: stroke.color,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Pencil size={12} />
                                    </span>
                                    <span
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: '12px',
                                            fontWeight: isSubSelected ? 600 : 400,
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        Trait {sIdx + 1}
                                    </span>
                                    {isSubSelected && (
                                        <>
                                            <span className="tabular-nums" style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                                                {stroke.strokeWidth}px
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="Supprimer ce trait"
                                                title="Supprimer ce trait"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    dispatch({ type: 'REMOVE_DRAW_STROKE', drawId: draw.id, strokeId: stroke.id } as any);
                                                }}
                                                style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    background: 'rgba(239, 68, 68, 0.12)',
                                                    color: 'var(--semantic-red)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                        </div>
                    )}
                </div>
            );
        }

        if (item.kind === 'text') {
            const text = texts.find((t) => t.id === item.id);
            if (!text) return null;
            const textItems = text.texts || [];
            const hasMultiple = textItems.length > 1;
            const isTextExpanded = hasMultiple && expandedTextIds.has(text.id);
            const isLayerOnlySelected = isExpanded && !selectedSublayerId;

            return (
                <div key={item.id} style={{}}>
                    <LayerRow
                        rowRef={setRowRef(text.id)}
                        icon={<Type size={14} strokeWidth={2.2} />}
                        label={text.title}
                        rightText={`${textItems.length} texte${textItems.length !== 1 ? 's' : ''}`}
                        color={text.color}
                        defaultColor={DEFAULT_LAYER_COLORS.text}
                        visible={text.visible}
                        isSelected={isLayerOnlySelected || (isInMultiSel && multiSel.size < 2)}
                        isMultiSelected={isInMultiSel && multiSel.size >= 2}
                        isEditing={renamingId === text.id}
                        isMobile={isMobile}
                        chevron={
                            hasMultiple ? (
                                <button
                                    type="button"
                                    aria-label={isTextExpanded ? 'Replier les textes' : 'Déplier les textes'}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedTextIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(text.id)) next.delete(text.id);
                                            else next.add(text.id);
                                            return next;
                                        });
                                    }}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        padding: 0,
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#94A3B8',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {isTextExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                            ) : undefined
                        }
                        onSelect={(meta) => handleLayerClick(item, idx, meta, () => handleSelectRow(item))}
                        onToggleVisible={() => dispatch({ type: 'TOGGLE_TEXT_VISIBILITY', id: text.id } as any)}
                        onStartRename={() => setRenamingId(text.id)}
                        onConfirmRename={(v) => {
                            dispatch({ type: 'UPDATE_TEXT_ANNOTATION', id: text.id, patch: { title: v } } as any);
                            setRenamingId(null);
                        }}
                        onCancelRename={() => setRenamingId(null)}
                        onColorPick={(c) => dispatch({ type: 'UPDATE_TEXT_ANNOTATION', id: text.id, patch: { color: c } } as any)}
                        onDelete={() => dispatch({ type: 'REMOVE_TEXT_ANNOTATION', id: text.id } as any)}
                        onContextMenu={(x, y) =>
                            setCtxMenu({
                                x,
                                y,
                                items: isInMultiSel && multiSel.size >= 2 ? multiCtxItems() : [
                                    { icon: <Edit3 size={13} />, label: 'Renommer', onClick: () => setRenamingId(text.id) },
                                    {
                                        icon: text.visible ? <EyeOff size={13} /> : <Eye size={13} />,
                                        label: text.visible ? 'Masquer' : 'Afficher',
                                        onClick: () => dispatch({ type: 'TOGGLE_TEXT_VISIBILITY', id: text.id } as any),
                                    },
                                    { separator: true },
                                    {
                                        icon: <Trash2 size={13} />,
                                        label: 'Supprimer',
                                        danger: true,
                                        onClick: () => dispatch({ type: 'REMOVE_TEXT_ANNOTATION', id: text.id } as any),
                                    },
                                ],
                            })
                        }
                        detailSlot={
                            isExpanded && textItems.length === 1 ? (
                                <ChipSelector
                                    label="Taille"
                                    value={textItems[0].fontSize <= 13 ? 12 : textItems[0].fontSize >= 20 ? 22 : 16}
                                    options={[
                                        { value: 12, label: '12 px' },
                                        { value: 16, label: '16 px' },
                                        { value: 22, label: '22 px' },
                                    ]}
                                    onChange={(val) =>
                                        dispatch({
                                            type: 'UPDATE_TEXT_ITEM',
                                            textId: text.id,
                                            itemId: textItems[0].id,
                                            patch: { fontSize: val },
                                        } as any)
                                    }
                                />
                            ) : undefined
                        }
                        dragProps={dragProps}
                    />

                    {/* Child text items indented 24px + vertical guide line (only when >1 element) */}
                    {isTextExpanded && (
                        <div style={{ marginLeft: '24px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
                        {textItems.map((tItem, tIdx) => {
                            const isSubSelected = isLayerOnlySelected && selectedSublayerId === tItem.id;
                            return (
                                <div
                                    key={tItem.id}
                                    role="option"
                                    aria-selected={isSubSelected}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        dispatch({
                                            type: 'SET_SELECTED_SUBLAYER',
                                            layerId: text.id,
                                            sublayerId: isSubSelected ? null : tItem.id,
                                        } as any);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        minHeight: isMobile ? '40px' : '34px',
                                        padding: '4px 12px 4px 8px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        background: isSubSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <span
                                        aria-hidden="true"
                                        style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '999px',
                                            border: isSubSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                                            background: isSubSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                            color: tItem.color,
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Type size={12} />
                                    </span>
                                    <span
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: '12px',
                                            fontWeight: isSubSelected ? 600 : 400,
                                            color: 'var(--text-primary)',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {tItem.text || `Texte ${tIdx + 1}`}
                                    </span>
                                    {isSubSelected && (
                                        <>
                                            <span className="tabular-nums" style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                                                {tItem.fontSize}px
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="Supprimer ce texte"
                                                title="Supprimer ce texte"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    dispatch({ type: 'REMOVE_TEXT_ITEM', textId: text.id, itemId: tItem.id } as any);
                                                }}
                                                style={{
                                                    width: '24px',
                                                    height: '24px',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    background: 'rgba(239, 68, 68, 0.12)',
                                                    color: 'var(--semantic-red)',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Trash2 size={11} />
                                            </button>
                                        </>
                                    )}
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

    const isEmpty = order.length === 0;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                background: 'transparent',
                userSelect: 'none',
                fontSize: '12px',
                color: 'var(--text-primary)',
            }}
        >
            {/* Scrollable layer list */}
            <div
                role="listbox"
                aria-label="Liste des calques"
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {isEmpty ? (
                    <div
                        style={{
                            padding: '28px 16px',
                            textAlign: 'center',
                            color: '#94A3B8',
                            fontSize: '12px',
                            lineHeight: 1.5,
                        }}
                    >
                        Aucun calque sur la carte. Utilisez la barre d&apos;outils en bas pour créer un tracé, repère ou dessin.
                    </div>
                ) : (
                    <>
                        {order.map((item, idx) => {
                            const showPreviewBefore =
                                draggingIdx !== null &&
                                dropInsert === idx &&
                                draggingIdx > idx;
                            const showPreviewAfter =
                                draggingIdx !== null &&
                                dropInsert === idx + 1 &&
                                draggingIdx !== idx &&
                                draggingIdx !== idx + 1;
                            const draggedItem = draggingIdx !== null ? order[draggingIdx] : null;
                            const getLabel = (it: OrderItem) => {
                                if (it.kind === 'itin') return itineraries.find((x) => x.id === it.id)?.name ?? 'Tracé';
                                if (it.kind === 'point') return points.find((x) => x.id === it.id)?.title ?? 'Repère';
                                if (it.kind === 'area') return areas.find((x) => x.id === it.id)?.title ?? 'Zone';
                                if (it.kind === 'draw') return draws.find((x) => x.id === it.id)?.title ?? 'Dessin';
                                if (it.kind === 'text') return texts.find((x) => x.id === it.id)?.title ?? 'Texte';
                                return '';
                            };
                            return (
                                <React.Fragment key={item.id}>
                                    {showPreviewBefore && draggedItem && (
                                        <LayerPreviewRow
                                            item={draggedItem}
                                            label={getLabel(draggedItem)}
                                            onDrop={() => handleDrop(idx)}
                                        />
                                    )}
                                    {renderItem(item, idx)}
                                    {showPreviewAfter && draggedItem && (
                                        <LayerPreviewRow
                                            item={draggedItem}
                                            label={getLabel(draggedItem)}
                                            onDrop={() => handleDrop(idx + 1)}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {/* Bottom sentinel: allows dropping after the last item */}
                        {draggingIdx !== null && (() => {
                            return (
                                <>
                                    <div
                                        aria-hidden="true"
                                        style={{ flex: 1, minHeight: '40px' }}
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setDropInsert(order.length);
                                        }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            handleDrop(order.length);
                                        }}
                                    />
                                </>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Multi-selection summary bar */}
            {multiSel.size >= 2 && (
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 12px',
                        borderTop: '1px solid var(--border-subtle)',
                        background: 'rgba(255,255,255,0.04)',
                        flexShrink: 0,
                    }}
                >
                    <span style={{ flex: 1, fontSize: '12px', color: '#94A3B8', fontWeight: 500 }}>
                        {multiSel.size} calques sélectionnés
                    </span>
                    <button
                        type="button"
                        title="Masquer/Afficher la sélection"
                        aria-label="Basculer visibilité de la sélection"
                        onClick={() => order.filter((x) => multiSel.has(x.id)).forEach(toggleItemVisibility)}
                        style={{ padding: '4px 6px', border: 'none', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', color: '#94A3B8', cursor: 'pointer', display: 'inline-flex' }}
                    >
                        <Eye size={13} />
                    </button>
                    <button
                        type="button"
                        title={`Supprimer ${multiSel.size} calques`}
                        aria-label={`Supprimer ${multiSel.size} calques`}
                        onClick={() => {
                            const items = order.filter((x) => multiSel.has(x.id));
                            if (!window.confirm(`Supprimer ${items.length} calque${items.length > 1 ? 's' : ''} ?`)) return;
                            items.forEach(deleteItem);
                            setMultiSel(new Set());
                            dispatch({ type: 'SET_SELECTED_LAYER', id: null });
                        }}
                        style={{ padding: '4px 6px', border: 'none', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', color: 'var(--semantic-red)', cursor: 'pointer', display: 'inline-flex' }}
                    >
                        <Trash2 size={13} />
                    </button>
                    <button
                        type="button"
                        title="Désélectionner · Échap"
                        aria-label="Annuler la sélection"
                        onClick={() => setMultiSel(new Set())}
                        style={{ padding: '4px 6px', border: 'none', borderRadius: '6px', background: 'transparent', color: '#64748B', cursor: 'pointer', display: 'inline-flex' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Mobile sheet footer: 5 equal-width creation buttons (on desktop they align with Calques in bottom-right bar) */}
            {isMobile && (
                <div
                    style={{
                        padding: '8px 10px',
                        borderTop: '1px solid var(--border-subtle)',
                        flexShrink: 0,
                    }}
                >
                    <LayerAddButtons variant="sheet" onCreated={setRenamingId} />
                </div>
            )}

            {ctxMenu && <LayerContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={closeCtx} />}

            {copyToast &&
                createPortal(
                    <div
                        role="status"
                        className="tabular-nums"
                        style={{
                            position: 'fixed',
                            bottom: '24px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 9999,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: '12px',
                            boxShadow: 'var(--shadow-lg)',
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '12.5px',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <Check size={13} style={{ color: 'var(--semantic-green)', flexShrink: 0 }} aria-hidden="true" />
                        <span>{copyToast.text} copié</span>
                    </div>,
                    document.body
                )}
        </div>
    );
}

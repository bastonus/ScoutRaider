import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
    GripVertical, MapPin, ArrowLeftRight,
    ChevronDown, Copy, Trash2, Edit3,
    ArrowUp, ArrowDown, Footprints, Car, Compass,
    Building2, Loader2, X, Undo2, Check, Flag, Play, RotateCcw
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import { IGNClient } from '../../logic/IGNClient';
import { ElevationService } from '../../logic/ElevationService';
import { mapRef } from '../map/MapComponent';
import { Stage } from '../../logic/types';
import {
    SearchResult,
    searchIGNWithBias,
    parseCoords,
    formatDistanceFr,
    formatDurationFr,
    formatStageAddress,
} from '../../logic/geocoding';

type RoutingMode = 'direct' | 'pedestrian' | 'car';

const MODE_LABELS: Record<RoutingMode, string> = {
    direct: 'Hors piste',
    pedestrian: 'Sentier',
    car: 'Route',
};

const MODE_ICONS: Record<RoutingMode, React.ElementType> = {
    direct: Compass,
    pedestrian: Footprints,
    car: Car,
};

const MODE_HINTS: Record<RoutingMode, string> = {
    pedestrian: 'chemins et sentiers',
    car: 'routes et voies',
    direct: 'ligne droite',
};

function getLegDistanceMeters(leg: any): number {
    if (!leg) return 0;
    if (typeof leg.distance_m === 'number' && leg.distance_m > 0) return leg.distance_m;
    const coords = leg.geojson?.geometry?.coordinates;
    if (!coords || coords.length < 2) return 0;
    let dist = 0;
    const R = 6371e3;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lon1, lat1] = coords[i];
        const [lon2, lat2] = coords[i + 1];
        const p1 = (lat1 * Math.PI) / 180;
        const p2 = (lat2 * Math.PI) / 180;
        const dp = ((lat2 - lat1) * Math.PI) / 180;
        const dl = ((lon2 - lon1) * Math.PI) / 180;
        const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
        dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    return dist;
}

function getLegDurationSeconds(leg: any, distM: number): number {
    if (typeof leg?.duration_s === 'number' && leg.duration_s > 0) return leg.duration_s;
    if (typeof leg?.geojson?.properties?.duration === 'number' && leg.geojson.properties.duration > 0) {
        return leg.geojson.properties.duration;
    }
    const profile = leg?.profile || 'pedestrian';
    const speedKmh = profile === 'car' ? 50 : 4.5;
    return (distM / 1000 / speedKmh) * 3600;
}

function getMapCenterBias(): { lat: number; lon: number } | null {
    const map = mapRef.current;
    if (!map) return null;
    const c = map.getCenter();
    return { lat: c.lat, lon: c.lng };
}

function reRouteAdjacentLegs(
    stages: Stage[],
    routes: any[],
    smallRoads: boolean,
    dispatch: any,
    movedIdx: number,
    newLat: number,
    newLon: number
) {
    if (movedIdx > 0) {
        const prev = stages[movedIdx - 1];
        const prevProfile = routes[movedIdx - 1]?.profile || 'pedestrian';
        if (routes[movedIdx - 1]) dispatch({ type: 'REMOVE_ROUTE', id: routes[movedIdx - 1].id });
        backgroundEngine.enqueue('route_leg', 0, `job-${Date.now()}-prev`, {
            p1: [prev.coords[0], prev.coords[1]],
            p2: [newLat, newLon],
            profile: prevProfile,
            small_roads: smallRoads,
            insertIdx: movedIdx - 1,
        });
    }
    if (movedIdx < stages.length - 1) {
        const next = stages[movedIdx + 1];
        const nextProfile = routes[movedIdx]?.profile || 'pedestrian';
        if (routes[movedIdx]) dispatch({ type: 'REMOVE_ROUTE', id: routes[movedIdx].id });
        backgroundEngine.enqueue('route_leg', 0, `job-${Date.now()}-next`, {
            p1: [newLat, newLon],
            p2: [next.coords[0], next.coords[1]],
            profile: nextProfile,
            small_roads: smallRoads,
            insertIdx: movedIdx,
        });
    }
}

function SmartDropdown({
    results,
    isLoading,
    onSelect,
    anchorRef,
}: {
    results: SearchResult[];
    isLoading?: boolean;
    onSelect: (r: SearchResult) => void;
    anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
    const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);

    useEffect(() => {
        const update = () => {
            if (!anchorRef.current) return;
            const rect = anchorRef.current.getBoundingClientRect();
            const count = Math.max(1, results.length);
            const dropHeight = Math.min(count * 44, 180);
            const dropUp = window.innerHeight - rect.bottom < dropHeight && rect.top > window.innerHeight - rect.bottom;
            setPos({
                ...(dropUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
                left: rect.left,
                width: rect.width,
            });
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [results, isLoading, anchorRef]);

    if (!pos) return null;

    return createPortal(
        <div
            style={{
                position: 'fixed',
                ...(pos.top !== undefined ? { top: `${pos.top}px` } : { bottom: `${pos.bottom}px` }),
                left: `${pos.left}px`,
                width: `${pos.width}px`,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '10px',
                zIndex: 9999,
                boxShadow: 'var(--shadow-lg)',
                maxHeight: '180px',
                overflowY: 'auto',
            }}
        >
            {isLoading ? (
                <div
                    style={{
                        minHeight: '40px',
                        padding: '8px 10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12px',
                        color: '#CBD5E1',
                    }}
                >
                    <Loader2 size={13} className="spin" color="#64748B" />
                    <span>Recherche…</span>
                </div>
            ) : (
                results.slice(0, 3).map((r, i) => {
                    const Icon = r.kind === 'poi' ? Building2 : MapPin;
                    return (
                        <button
                            key={i}
                            type="button"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                onSelect(r);
                            }}
                            style={{
                                width: '100%',
                                textAlign: 'left',
                                minHeight: '40px',
                                padding: '6px 10px',
                                background: 'transparent',
                                border: 'none',
                                borderBottom: i < Math.min(results.length, 3) - 1 ? '1px solid var(--border-subtle)' : 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                            <Icon
                                size={13}
                                color={r.kind === 'poi' ? '#94A3B8' : '#64748B'}
                                style={{ flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                <span
                                    style={{
                                        fontSize: '12px',
                                        color: 'var(--text-primary)',
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                    }}
                                >
                                    {r.label}
                                </span>
                                {r.postcode && !r.label.includes(r.postcode) && (
                                    <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'var(--font-mono)' }}>
                                        {r.postcode}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })
            )}
        </div>,
        document.body
    );
}

// Track reverse-geocoding requests across re-renders so each (stageId, coords) is fetched at most once
const resolvedStageCoords = new Set<string>();

function ModePickerPopover({
    mode,
    onChangeMode,
    variant,
}: {
    mode: RoutingMode;
    onChangeMode: (mode: RoutingMode) => void;
    variant: 'icon' | 'chip';
}) {
    const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const portalPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!pickerPos) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!triggerRef.current?.contains(target) && !portalPickerRef.current?.contains(target)) {
                setPickerPos(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [pickerPos]);

    const currentMode: RoutingMode = mode || 'pedestrian';
    const ModeIcon = MODE_ICONS[currentMode];

    const togglePicker = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (pickerPos) {
            setPickerPos(null);
            return;
        }
        const rect = triggerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const estHeight = 132;
        const top =
            rect.bottom + estHeight > window.innerHeight
                ? Math.max(8, rect.top - estHeight - 4)
                : rect.bottom + 4;
        const left = Math.min(Math.max(8, rect.right - 184), window.innerWidth - 192);
        setPickerPos({ top, left });
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={togglePicker}
                onDoubleClick={(e) => e.stopPropagation()}
                aria-expanded={Boolean(pickerPos)}
                aria-label={`Mode de routage : ${MODE_LABELS[currentMode]}`}
                title={`Mode : ${MODE_LABELS[currentMode]}`}
                style={
                    variant === 'chip'
                        ? {
                              minHeight: '32px',
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: '1px solid var(--border-strong)',
                              background: 'rgba(255, 255, 255, 0.06)',
                              color: 'var(--text-primary)',
                              fontSize: '11.5px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              flexShrink: 0,
                          }
                        : {
                              minWidth: '32px',
                              minHeight: '32px',
                              padding: '0 6px',
                              borderRadius: '8px',
                              border: 'none',
                              background: 'transparent',
                              color: currentMode === 'pedestrian' ? '#94A3B8' : '#94A3B8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              flexShrink: 0,
                          }
                }
            >
                <ModeIcon size={14} aria-hidden="true" />
                {variant === 'chip' && (
                    <>
                        <span>{MODE_LABELS[currentMode]}</span>
                        <ChevronDown size={12} aria-hidden="true" style={{ color: '#94A3B8' }} />
                    </>
                )}
            </button>

            {pickerPos &&
                createPortal(
                    <div
                        ref={portalPickerRef}
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: `${pickerPos.top}px`,
                            left: `${pickerPos.left}px`,
                            width: '184px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: '10px',
                            boxShadow: 'var(--shadow-lg)',
                            padding: '4px',
                            zIndex: 9999,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                        }}
                    >
                        {(['pedestrian', 'car', 'direct'] as RoutingMode[]).map((id) => {
                            const Icon = MODE_ICONS[id];
                            const active = currentMode === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    className="sr-menu-item"
                                    onClick={() => {
                                        setPickerPos(null);
                                        if (!active) onChangeMode(id);
                                    }}
                                    style={{
                                        minHeight: '38px',
                                        fontSize: '12px',
                                        gap: '8px',
                                        padding: '4px 10px',
                                        justifyContent: 'flex-start',
                                        textAlign: 'left',
                                        background: active ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        color: 'var(--text-primary)',
                                        fontWeight: active ? 600 : 500,
                                        borderRadius: '7px',
                                    }}
                                >
                                    <Icon size={14} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                        <span>{MODE_LABELS[id]}</span>
                                        <span style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 400 }}>
                                            {MODE_HINTS[id]}
                                        </span>
                                    </div>
                                    {active && <Check size={14} color="#CBD5E1" style={{ flexShrink: 0 }} />}
                                </button>
                            );
                        })}
                    </div>,
                    document.body
                )}
        </>
    );
}

interface StageRowProps {
    stage: Stage;
    idx: number;
    total: number;
    isSelected: boolean;
    isMobile: boolean;
    isDragged: boolean;
    isNewFlash: boolean;
    hasSegmentBelow: boolean;
    legDist?: number;
    legDurationS?: number;
    legMode: RoutingMode;
    isLegComputing?: boolean;
    editTriggerCounter?: number;
    isMultiSelected?: boolean;
    onSelect: (meta: { ctrl: boolean; shift: boolean }) => void;
    onChangeMode: (mode: RoutingMode) => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: () => void;
    onDragEnd: (e: React.DragEvent) => void;
    onReorderDelta: (fromIdx: number, toIdx: number) => void;
    onStageDeleted: (label: string) => void;
    onCoordsCopied?: (coords: string) => void;
}

function StageRow({
    stage,
    idx,
    total,
    isSelected,
    isMobile,
    isDragged,
    isNewFlash,
    hasSegmentBelow,
    legDist,
    legDurationS,
    legMode,
    isLegComputing,
    editTriggerCounter,
    isMultiSelected,
    onSelect,
    onChangeMode,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
    onReorderDelta,
    onStageDeleted,
    onCoordsCopied,
}: StageRowProps) {
    const { state, dispatch } = useApp();
    const [isEditing, setIsEditing] = useState(false);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
    const [query, setQuery] = useState(stage.address || '');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isDraggingRow, setIsDraggingRow] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [copiedCoords, setCopiedCoords] = useState(false);
    const [isTruncated, setIsTruncated] = useState(false);
    const [swipeX, setSwipeX] = useState(0);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);
    const editBoxRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const titleSpanRef = useRef<HTMLSpanElement>(null);
    const portalMenuRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
    const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevEditTriggerRef = useRef(editTriggerCounter || 0);

    useEffect(() => {
        return () => {
            if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
            if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (editTriggerCounter && editTriggerCounter !== prevEditTriggerRef.current) {
            prevEditTriggerRef.current = editTriggerCounter;
            if (isSelected) {
                setIsEditing(true);
                setTimeout(() => {
                    inputRef.current?.focus();
                    inputRef.current?.select();
                }, 20);
            }
        }
    }, [editTriggerCounter, isSelected]);

    useEffect(() => {
        if (!isSelected) return;
        const timer = setTimeout(() => {
            wrapperRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }, 60);
        return () => clearTimeout(timer);
    }, [isSelected]);

    const coordsText = `${stage.coords[0].toFixed(4)}, ${stage.coords[1].toFixed(4)}`;
    const hasReadableAddress = Boolean(stage.address && !parseCoords(stage.address));

    // Staggered automatic reverse geocoding when stage has no address or only raw coordinates
    useEffect(() => {
        if (hasReadableAddress) return;
        const key = `${stage.id}:${stage.coords[0].toFixed(5)},${stage.coords[1].toFixed(5)}`;
        if (resolvedStageCoords.has(key)) return;

        let cancelled = false;
        const timer = setTimeout(() => {
            IGNClient.reverseGeocode(stage.coords[0], stage.coords[1]).then((addr) => {
                if (cancelled || !addr || parseCoords(addr)) return;
                resolvedStageCoords.add(key);
                dispatch({
                    type: 'MOVE_STAGE',
                    id: stage.id,
                    lat: stage.coords[0],
                    lon: stage.coords[1],
                    address: addr,
                });
            });
        }, Math.min((total - 1 - idx) * 120, 1500));
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [stage.id, stage.coords, idx, total, hasReadableAddress, dispatch]);

    useEffect(() => {
        if (!isEditing) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setIsEditing(false);
                setShowResults(false);
                setQuery(stage.address || '');
            }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
    }, [isEditing, stage.address]);

    useEffect(() => {
        if (!isEditing) {
            setQuery(stage.address || '');
        }
    }, [stage.address, isEditing]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const inRow = wrapperRef.current?.contains(target);
            const inMenu = portalMenuRef.current?.contains(target);
            if (!inRow && !inMenu) {
                setShowResults(false);
                setIsEditing(false);
                setMenuPos(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Edit autocomplete: show only at >= 3 chars, with loading state & top-3 address-first ranking
    useEffect(() => {
        if (!isEditing) return;
        const trimmed = query.trim();
        if (parseCoords(trimmed) || trimmed.length < 3) {
            setResults([]);
            setShowResults(false);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        setShowResults(true);
        const t = setTimeout(async () => {
            try {
                const res = await searchIGNWithBias(trimmed, getMapCenterBias(), 3);
                setResults(res);
                setShowResults(res.length > 0);
            } finally {
                setIsSearching(false);
            }
        }, 220);
        return () => clearTimeout(t);
    }, [query, isEditing]);

    const emitHighlight = (active: boolean) => {
        window.dispatchEvent(
            new CustomEvent('scoutraider:highlight-stage', { detail: { id: active ? stage.id : null } })
        );
    };

    const centerOnMap = () => {
        const map = mapRef.current;
        if (!map) return;
        map.flyTo([stage.coords[0], stage.coords[1]], Math.max(map.getZoom(), 14), { duration: 0.65 });
    };

    const computeClampedMenuPos = (preferredLeft: number, preferredTop: number, fallbackTop: number) => {
        const menuWidth = 200;
        const estHeight = 130;
        const top =
            preferredTop + estHeight > window.innerHeight
                ? Math.max(8, fallbackTop - estHeight)
                : preferredTop;
        const left = Math.min(Math.max(8, preferredLeft), window.innerWidth - menuWidth - 8);
        return { top, left };
    };

    const openContextMenu = (e: React.MouseEvent) => {
        if (isEditing) return;
        e.preventDefault();
        e.stopPropagation();
        setMenuPos(computeClampedMenuPos(e.clientX, e.clientY + 2, e.clientY - 2));
    };

    const handleSelect = (r: SearchResult) => {
        setQuery(r.label);
        setShowResults(false);
        setIsEditing(false);
        dispatch({ type: 'MOVE_STAGE', id: stage.id, lat: r.lat, lon: r.lon, address: r.label });
        reRouteAdjacentLegs(state.stages, state.routes, state.small_roads_only, dispatch, idx, r.lat, r.lon);
        mapRef.current?.flyTo([r.lat, r.lon], Math.max(mapRef.current.getZoom(), 14), { duration: 0.6 });
    };

    const handleCommit = () => {
        const coords = parseCoords(query);
        if (coords) {
            setShowResults(false);
            setIsEditing(false);
            dispatch({ type: 'MOVE_STAGE', id: stage.id, lat: coords.lat, lon: coords.lon, address: '' });
            reRouteAdjacentLegs(state.stages, state.routes, state.small_roads_only, dispatch, idx, coords.lat, coords.lon);
        } else if (results.length > 0) {
            handleSelect(results[0]);
        } else {
            setIsEditing(false);
            setShowResults(false);
        }
    };

    const handleDelete = () => {
        setMenuPos(null);
        emitHighlight(false);
        dispatch({ type: 'REMOVE_STAGE', id: stage.id });
        if (idx > 0 && idx < state.stages.length - 1) {
            const prev = state.stages[idx - 1];
            const next = state.stages[idx + 1];
            const bridgeProfile = state.routes[idx - 1]?.profile || state.routes[idx]?.profile || 'pedestrian';
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Reconnexion...' });
            backgroundEngine.enqueue('route_leg', 0, `job-bridge-${Date.now()}`, {
                p1: [prev.coords[0], prev.coords[1]],
                p2: [next.coords[0], next.coords[1]],
                profile: bridgeProfile,
                small_roads: state.small_roads_only,
                insertIdx: idx - 1,
            });
        }
        onStageDeleted(stage.label);
    };

    const handleCopyCoords = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(coordsText).catch(() => {});
        setCopiedCoords(true);
        onCoordsCopied?.(coordsText);
        setTimeout(() => setCopiedCoords(false), 1500);
    };

    const isFirst = idx === 0;
    const isLast = idx === total - 1 && total > 1;
    const dotColor = isFirst ? 'var(--semantic-green)' : isLast ? 'var(--semantic-red)' : '#94A3B8';
    const badgeBorderColor = isFirst
        ? 'var(--semantic-green)'
        : isLast
            ? 'var(--semantic-red)'
            : 'rgba(148, 163, 184, 0.45)';
    const parsedAddr = hasReadableAddress ? formatStageAddress(stage.address!) : { primary: `Étape ${stage.label}` };
    const shortTitle = parsedAddr.primary || `Étape ${stage.label}`;
    const fullTitle = parsedAddr.secondary ? `${parsedAddr.primary}, ${parsedAddr.secondary}` : parsedAddr.primary;
    const legSummaryText =
        hasSegmentBelow && legDist !== undefined
            ? isLegComputing
                ? '…'
                : formatDistanceFr(legDist)
            : '';

    return (
        <div
            ref={wrapperRef}
            className={isNewFlash ? 'sr-stage-flash' : undefined}
            style={{
                position: 'relative',
                flexShrink: 0,
                overflow: 'hidden',
                contentVisibility: isSelected ? 'visible' : 'auto',
                containIntrinsicSize: isMobile ? 'auto 48px' : 'auto 40px',
                borderBottom: '1px solid var(--border-subtle)',
                background: isSelected
                    ? 'rgba(255, 255, 255, 0.045)'
                    : isMultiSelected
                        ? 'rgba(255, 255, 255, 0.03)'
                        : isHovered
                        ? 'rgba(255, 255, 255, 0.025)'
                        : 'transparent',
                transition: 'background 150ms ease',
            }}
            onMouseEnter={() => {
                setIsHovered(true);
                emitHighlight(true);
                if (titleSpanRef.current) {
                    setIsTruncated(titleSpanRef.current.scrollWidth > titleSpanRef.current.clientWidth);
                }
            }}
            onMouseLeave={() => {
                setIsHovered(false);
                emitHighlight(false);
            }}
            onContextMenu={openContextMenu}
            onTouchStart={(e) => {
                if (isEditing || e.touches.length !== 1) return;
                const t = e.touches[0];
                const tx = t.clientX;
                const ty = t.clientY;
                if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = setTimeout(() => {
                    touchStartRef.current = null;
                    setMenuPos(computeClampedMenuPos(tx, ty + 2, ty - 2));
                }, 500);
                if (!isMobile) return;
                touchStartRef.current = { x: tx, y: ty, active: false };
            }}
            onTouchMove={(e) => {
                if (e.touches.length !== 1) return;
                if (longPressTimerRef.current && touchStartRef.current) {
                    const mdx = e.touches[0].clientX - touchStartRef.current.x;
                    const mdy = e.touches[0].clientY - touchStartRef.current.y;
                    if (Math.hypot(mdx, mdy) > 8) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                    }
                }
                if (!isMobile || !touchStartRef.current) return;
                const dx = e.touches[0].clientX - touchStartRef.current.x;
                const dy = e.touches[0].clientY - touchStartRef.current.y;
                if (!touchStartRef.current.active) {
                    if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4 && dx < 0) {
                        touchStartRef.current.active = true;
                    } else if (Math.abs(dy) > 10) {
                        touchStartRef.current = null;
                        return;
                    }
                }
                if (touchStartRef.current?.active) {
                    setSwipeX(Math.max(-110, Math.min(0, dx)));
                }
            }}
            onTouchEnd={() => {
                if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                }
                if (!isMobile || !touchStartRef.current) return;
                if (swipeX <= -72) {
                    setSwipeX(0);
                    touchStartRef.current = null;
                    handleDelete();
                } else {
                    setSwipeX(0);
                    touchStartRef.current = null;
                }
            }}
        >
            {isMobile && swipeX < -4 && (
                <div
                    aria-hidden="true"
                    style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(239, 68, 68, 0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        paddingRight: '16px',
                        color: 'var(--semantic-red)',
                        fontSize: '12px',
                        fontWeight: 600,
                        gap: '6px',
                        pointerEvents: 'none',
                    }}
                >
                    <Trash2 size={14} />
                    <span>Supprimer</span>
                </div>
            )}

            <div
                ref={rowRef}
                draggable={!isEditing}
                onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                    requestAnimationFrame(() => {
                        setIsDraggingRow(true);
                        onDragStart(e);
                    });
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    onDragOver(e);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onDrop();
                }}
                onDragEnd={(e) => {
                    setIsDraggingRow(false);
                    onDragEnd(e);
                }}
                onClick={(e) => {
                    if (isEditing || menuPos) return;
                    const ctrl = e.ctrlKey || e.metaKey;
                    const shift = e.shiftKey;
                    if (ctrl || shift) {
                        if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
                        onSelect({ ctrl, shift });
                        return;
                    }
                    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
                    clickTimerRef.current = setTimeout(() => {
                        clickTimerRef.current = null;
                        onSelect({ ctrl: false, shift: false });
                        centerOnMap();
                    }, 210);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (clickTimerRef.current) {
                        clearTimeout(clickTimerRef.current);
                        clickTimerRef.current = null;
                    }
                    setMenuPos(null);
                    setIsEditing(true);
                    setTimeout(() => {
                        inputRef.current?.focus();
                        inputRef.current?.select();
                    }, 20);
                }}
                    style={{
                        display: 'flex',
                        alignItems: isSelected ? 'flex-start' : 'center',
                        gap: '12px',
                        padding: isEditing ? '6px 12px' : isSelected ? '10px 12px 0 12px' : '4px 12px 4px 12px',
                        minHeight: isSelected ? undefined : isMobile ? '48px' : '40px',
                        background: isEditing ? 'rgba(255,255,255,0.04)' : 'transparent',
                        opacity: isDragged ? 0.25 : 1,
                        cursor: isEditing ? 'text' : isDraggingRow ? 'grabbing' : 'pointer',
                        transform: swipeX ? `translateX(${swipeX}px)` : undefined,
                        transition: swipeX === 0 ? 'transform 160ms ease' : undefined,
                    }}
                >
                    {/* Letter badge (green start, red end, neutral grey middle) / Drag Handle */}
                    <div
                        aria-label={`Réordonner l'étape ${stage.label}`}
                        title="Glisser pour réordonner"
                        style={{
                            width: '20px',
                            height: '20px',
                            marginTop: isEditing ? '4px' : isSelected ? '1px' : 0,
                            borderRadius: '6px',
                            border: !isMobile && !isEditing && (isHovered || isDraggingRow) ? 'none' : `1.5px solid ${badgeBorderColor}`,
                            background: 'transparent',
                            color: !isMobile && !isEditing && (isHovered || isDraggingRow) ? '#94A3B8' : dotColor,
                            fontWeight: 800,
                            fontSize: '10.5px',
                            fontFamily: 'var(--font-mono)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            cursor: isEditing ? 'default' : 'grab',
                            padding: 0,
                        }}
                    >
                        {!isMobile && !isEditing && (isHovered || isDraggingRow) ? <GripVertical size={15} /> : stage.label}
                    </div>

                {/* Title (one-line collapsed; full when selected/editing) */}
                <div
                    ref={editBoxRef}
                    style={{
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        gap: '2px',
                    }}
                >
                    {isEditing ? (
                        <>
                        <div
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
                                autoFocus
                                value={query}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCommit();
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsEditing(false);
                                        setShowResults(false);
                                        setQuery(stage.address || '');
                                    }
                                }}
                                placeholder={`Adresse ou ${coordsText}`}
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
                                aria-label="Annuler la modification"
                                title="Annuler"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsEditing(false);
                                    setShowResults(false);
                                    setQuery(stage.address || '');
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
                        <div
                            className="tabular-nums"
                            style={{
                                fontSize: '11px',
                                color: '#94A3B8',
                                fontFamily: 'var(--font-mono)',
                                lineHeight: 1.2,
                                paddingLeft: '6px',
                            }}
                        >
                            {coordsText}
                        </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', alignItems: isSelected ? 'flex-start' : 'center', gap: '6px', minWidth: 0 }}>
                                {isFirst && (
                                    <Play
                                        size={9}
                                        fill="currentColor"
                                        style={{ color: 'var(--semantic-green)', flexShrink: 0, marginTop: isSelected ? '4px' : 0 }}
                                        aria-hidden="true"
                                    />
                                )}
                                {isLast && (
                                    <Flag
                                        size={10}
                                        style={{ color: 'var(--semantic-red)', flexShrink: 0, marginTop: isSelected ? '3px' : 0 }}
                                        aria-hidden="true"
                                    />
                                )}
                                <span
                                    ref={titleSpanRef}
                                    style={{
                                        flex: 1,
                                        fontSize: '12.5px',
                                        fontWeight: isSelected ? 600 : 500,
                                        color: 'var(--text-primary)',
                                        ...(isSelected
                                            ? {
                                                  display: '-webkit-box',
                                                  WebkitLineClamp: 2,
                                                  WebkitBoxOrient: 'vertical' as const,
                                                  overflow: 'hidden',
                                                  whiteSpace: 'normal',
                                              }
                                            : {
                                                  whiteSpace: 'nowrap',
                                                  overflow: 'hidden',
                                                  textOverflow: 'ellipsis',
                                              }),
                                        lineHeight: 1.3,
                                        minWidth: 0,
                                    }}
                                    title={!isSelected && isTruncated ? fullTitle : undefined}
                                >
                                    {shortTitle}
                                </span>
                                {isHovered && (
                                    <button
                                        type="button"
                                        aria-label="Modifier l'étape"
                                        title="Modifier"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsEditing(true);
                                            setTimeout(() => {
                                                inputRef.current?.focus();
                                                inputRef.current?.select();
                                            }, 20);
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '0 2px',
                                            marginTop: isSelected ? '2px' : 0,
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
                            {isSelected && (parsedAddr.secondary || isHovered) && (
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
                                    {isHovered ? (
                                        <button
                                            type="button"
                                            onClick={handleCopyCoords}
                                            title="Copier les coordonnées"
                                            aria-label="Copier les coordonnées"
                                            className="tabular-nums"
                                            style={{
                                                padding: 0,
                                                background: 'transparent',
                                                border: 'none',
                                                fontSize: '11.5px',
                                                color: copiedCoords ? '#CBD5E1' : '#94A3B8',
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
                                            {copiedCoords ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
                                        </button>
                                    ) : (
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {parsedAddr.secondary}
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Right slot: leg dist · dur when expanded; passive mode icon + km + mobile grip when collapsed */}
                {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {isSelected ? (
                            hasSegmentBelow &&
                            legDist !== undefined && (
                                isLegComputing ? (
                                    <span
                                        className="tabular-nums"
                                        style={{
                                            whiteSpace: 'nowrap',
                                            fontSize: '11.5px',
                                            color: '#CBD5E1',
                                            fontWeight: 500,
                                        }}
                                    >
                                        Calcul…
                                    </span>
                                ) : (
                                    <div
                                        className="tabular-nums"
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'flex-end',
                                            gap: '2px',
                                            lineHeight: 1.3,
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        <span
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '5px',
                                                fontSize: '12px',
                                                color: '#CBD5E1',
                                                fontWeight: 500,
                                            }}
                                        >
                                            {legMode !== 'pedestrian' && (
                                                <span
                                                    title={`Mode : ${MODE_LABELS[legMode]}`}
                                                    aria-label={`Mode : ${MODE_LABELS[legMode]}`}
                                                    style={{
                                                        color: 'var(--text-secondary)',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                    }}
                                                >
                                                    {React.createElement(MODE_ICONS[legMode], { size: 13, 'aria-hidden': true })}
                                                </span>
                                            )}
                                            {formatDistanceFr(legDist)}
                                        </span>
                                        <span style={{ fontSize: '11.5px', color: '#94A3B8', fontWeight: 500 }}>
                                            {formatDurationFr(legDurationS || 0)}
                                        </span>
                                    </div>
                                )
                            )
                        ) : (
                            <>
                                {hasSegmentBelow && legMode !== 'pedestrian' && (
                                    <span
                                        title={`Mode : ${MODE_LABELS[legMode]}`}
                                        aria-label={`Mode : ${MODE_LABELS[legMode]}`}
                                        style={{
                                            color: 'var(--text-secondary)',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                        }}
                                    >
                                        {React.createElement(MODE_ICONS[legMode], { size: 13, 'aria-hidden': true })}
                                    </span>
                                )}
                                {legSummaryText && (
                                    <span
                                        className="tabular-nums"
                                        title="Distance du tronçon entrant"
                                        style={{
                                            whiteSpace: 'nowrap',
                                            fontSize: '12px',
                                            color: '#94A3B8',
                                            fontWeight: 500,
                                        }}
                                    >
                                        {legSummaryText}
                                    </span>
                                )}
                                {isMobile && (
                                    <span style={{ color: '#64748B', display: 'inline-flex' }} aria-hidden="true">
                                        <GripVertical size={15} />
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Animated 150ms expansion: strict 1-thing-per-line layout */}
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
                        {/* Full-width bottom controls row (spans under step badge): mode selector + Duplicate, Copy coords, gap, Delete */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                width: '100%',
                            }}
                        >
                            {hasSegmentBelow && legDist !== undefined && (
                                <div
                                    role="group"
                                    aria-label="Mode de routage"
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        alignItems: 'center',
                                        boxSizing: 'border-box',
                                        height: isMobile ? '36px' : '30px',
                                        padding: '2px',
                                        borderRadius: '7px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid var(--border-subtle)',
                                        gap: '2px',
                                    }}
                                >
                                    {(['pedestrian', 'car', 'direct'] as RoutingMode[]).map((id) => {
                                        const Icon = MODE_ICONS[id];
                                        const active = legMode === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                aria-pressed={active}
                                                aria-label={MODE_LABELS[id]}
                                                title={`${MODE_LABELS[id]} (${MODE_HINTS[id]})`}
                                                onClick={() => {
                                                    if (!active) onChangeMode(id);
                                                }}
                                                style={{
                                                    height: '100%',
                                                    padding: '0 6px',
                                                    borderRadius: '5px',
                                                    border: 'none',
                                                    background: active ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                                                    color: active ? '#ffffff' : '#94A3B8',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '5px',
                                                    fontSize: '11px',
                                                    fontWeight: active ? 600 : 500,
                                                    whiteSpace: 'nowrap',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Icon size={12} aria-hidden="true" />
                                                <span>{MODE_LABELS[id]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            <button
                                type="button"
                                aria-label="Supprimer l'étape"
                                title="Supprimer"
                                onClick={handleDelete}
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

            {/* Context Menu (right-click / long-press only): 3 entries */}
            {menuPos &&
                createPortal(
                    <div
                        ref={portalMenuRef}
                        role="menu"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: 'fixed',
                            top: `${menuPos.top}px`,
                            left: `${menuPos.left}px`,
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
                        <button
                            type="button"
                            className="sr-menu-item"
                            style={{ minHeight: '36px', fontSize: '12px', gap: '8px', padding: '0 10px', justifyContent: 'flex-start', textAlign: 'left' }}
                            onClick={() => {
                                setMenuPos(null);
                                setIsEditing(true);
                                setTimeout(() => {
                                    inputRef.current?.focus();
                                    inputRef.current?.select();
                                }, 20);
                            }}
                        >
                            <Edit3 size={13} /> Modifier le lieu
                        </button>
                        <button
                            type="button"
                            className="sr-menu-item"
                            style={{ minHeight: '36px', fontSize: '12px', gap: '8px', padding: '0 10px', justifyContent: 'flex-start', textAlign: 'left' }}
                            onClick={(e) => {
                                setMenuPos(null);
                                handleCopyCoords(e);
                            }}
                        >
                            <MapPin size={13} /> Copier les coordonnées
                        </button>
                        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 4px' }} />
                        <button
                            type="button"
                            className="sr-menu-item"
                            style={{
                                minHeight: '36px',
                                fontSize: '12px',
                                gap: '8px',
                                padding: '0 10px',
                                justifyContent: 'flex-start',
                                textAlign: 'left',
                                color: 'var(--semantic-danger)',
                            }}
                            onClick={handleDelete}
                        >
                            <Trash2 size={13} /> Supprimer
                        </button>
                    </div>,
                    document.body
                )}

            {showResults && (isSearching || results.length > 0) && (
                <SmartDropdown results={results} isLoading={isSearching} onSelect={handleSelect} anchorRef={editBoxRef} />
            )}
        </div>
    );
}

// ── Greyed Destination Preview Row ────────────────────────────────────────────
function StagePreviewRow({
    stage,
    onDrop,
}: {
    stage: { label: string; address?: string; coords: [number, number] };
    onDrop?: () => void;
}) {
    const parsed = stage.address && !parseCoords(stage.address) ? formatStageAddress(stage.address) : null;
    const title = parsed?.primary || `${stage.coords[0].toFixed(4)}, ${stage.coords[1].toFixed(4)}`;
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
                onDrop?.();
            }}
            style={{
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                gap: '12px',
                margin: '3px 6px 3px 4px',
                padding: '6px 8px 6px 8px',
                minHeight: '42px',
                borderRadius: '8px',
                background: 'rgba(148, 163, 184, 0.09)',
                border: '1px dashed rgba(148, 163, 184, 0.45)',
            }}
        >
            <div
                style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '6px',
                    border: '1.5px dashed rgba(148, 163, 184, 0.5)',
                    color: '#94A3B8',
                    fontWeight: 800,
                    fontSize: '10.5px',
                    fontFamily: 'var(--font-mono)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                }}
            >
                {stage.label}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: '#94A3B8',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}
                >
                    {title}
                </div>
                <div style={{ fontSize: '10.5px', color: 'rgba(148, 163, 184, 0.65)', fontFamily: 'var(--font-mono)' }}>
                    {stage.coords[0].toFixed(4)}, {stage.coords[1].toFixed(4)}
                </div>
            </div>
        </div>
    );
}

// ── Main RoutePanel ────────────────────────────────────────────────────────────
interface RoutePanelProps {
    embedded?: boolean;
    isMobile?: boolean;
    onClose?: () => void;
    onStageSelected?: () => void;
}

export default function RoutePanel({
    embedded = false,
    isMobile = false,
    onStageSelected,
}: RoutePanelProps) {
    const { state, dispatch } = useApp();
    const stages = state.stages;
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
    const [editTriggerCounter, setEditTriggerCounter] = useState(0);
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const [dragOverTargetIdx, setDragOverTargetIdx] = useState<number | null>(null);
    /** Multi-selection set for stages (stage ids). */
    const [multiStageSel, setMultiStageSel] = useState<Set<string>>(new Set());
    /** Anchor index for Shift-range selection (in displayIndices positions). */
    const lastStageSelDisplayPos = useRef<number | null>(null);
    const [ascentM, setAscentM] = useState<number | null>(null);
    const [flashStageId, setFlashStageId] = useState<string | null>(null);
    const [undoToast, setUndoToast] = useState<{ label: string; key: number } | null>(null);
    const [copyToast, setCopyToast] = useState<{ text: string; key: number } | null>(null);
    const prevStageIds = useRef<Set<string>>(new Set(stages.map((s) => s.id)));
    const scrollRef = useRef<HTMLDivElement>(null);
    const [canScrollUp, setCanScrollUp] = useState(false);
    const [canScrollDown, setCanScrollDown] = useState(false);

    // Track scroll visibility for Départ/Arrivée pills
    const updateScrollPills = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        const THRESHOLD = 24;
        setCanScrollUp(scrollTop > THRESHOLD);
        setCanScrollDown(scrollHeight - scrollTop - clientHeight > THRESHOLD);
    }, []);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        updateScrollPills();
        el.addEventListener('scroll', updateScrollPills, { passive: true });
        const ro = new ResizeObserver(updateScrollPills);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', updateScrollPills);
            ro.disconnect();
        };
    }, [updateScrollPills, stages.length]);

    // Clear selection if selected stage was removed
    useEffect(() => {
        if (selectedStageId && !stages.some((s) => s.id === selectedStageId)) {
            setSelectedStageId(null);
        }
    }, [stages, selectedStageId]);

    // Scroll to TOP on mount so latest step is immediately visible
    useEffect(() => {
        const scrollToTop = () => {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
        };
        scrollToTop();
        const raf = requestAnimationFrame(scrollToTop);
        return () => cancelAnimationFrame(raf);
    }, []);

    // Auto-scroll to top + slide/flash new row on stage add
    useEffect(() => {
        const prevIds = prevStageIds.current;
        const added = stages.find((s) => !prevIds.has(s.id));
        if (added && stages.length > prevIds.size) {
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
            setFlashStageId(added.id);
            const t = setTimeout(() => setFlashStageId(null), 850);
            prevStageIds.current = new Set(stages.map((s) => s.id));
            return () => clearTimeout(t);
        }
        prevStageIds.current = new Set(stages.map((s) => s.id));
    }, [stages]);

    useEffect(() => {
        if (!undoToast) return;
        const t = setTimeout(() => setUndoToast(null), 5000);
        return () => clearTimeout(t);
    }, [undoToast]);

    useEffect(() => {
        if (!copyToast) return;
        const t = setTimeout(() => setCopyToast(null), 2500);
        return () => clearTimeout(t);
    }, [copyToast]);

    const { totalDistM, totalDurationS, allCoords } = useMemo(() => {
        let d = 0;
        let dur = 0;
        const coords: [number, number][] = [];
        for (let i = 0; i < Math.max(0, stages.length - 1); i++) {
            const leg = state.routes[i];
            const legDist = getLegDistanceMeters(leg);
            d += legDist;
            dur += getLegDurationSeconds(leg, legDist);
            const c = leg?.geojson?.geometry?.coordinates;
            if (Array.isArray(c)) {
                for (const pt of c) {
                    if (Array.isArray(pt) && pt.length >= 2) coords.push([pt[1], pt[0]]);
                }
            }
        }
        return { totalDistM: d, totalDurationS: dur, allCoords: coords };
    }, [stages.length, state.routes]);

    useEffect(() => {
        if (allCoords.length < 2) {
            setAscentM(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            ElevationService.computeProfile(allCoords)
                .then((prof) => {
                    if (!cancelled && prof) setAscentM(Math.round(prof.ascend_m));
                })
                .catch(() => {});
        }, 400);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [allCoords]);

    const handleDropOnStage = (targetIdx: number) => {
        setDragOverTargetIdx(null);
        if (draggedIdx === null || draggedIdx === targetIdx) {
            setDraggedIdx(null);
            return;
        }
        performReorder(draggedIdx, targetIdx);
    };

    const handleSetLegProfile = (idx: number, newProfile: RoutingMode) => {
        const stageA = state.stages[idx];
        const stageB = state.stages[idx + 1];
        if (!stageA || !stageB) return;
        const currentRoute = state.routes[idx];
        if (currentRoute) dispatch({ type: 'REMOVE_ROUTE', id: currentRoute.id });

        dispatch({
            type: 'SET_LOADING',
            isLoading: true,
            text: newProfile === 'direct' ? 'Ligne droite…' : `Calcul (${MODE_LABELS[newProfile]})…`,
        });

        backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}`, {
            p1: [stageA.coords[0], stageA.coords[1]],
            p2: [stageB.coords[0], stageB.coords[1]],
            profile: newProfile,
            small_roads: state.small_roads_only,
            insertIdx: idx,
        });
    };

    const performReorder = (fromIdx: number, toIdx: number) => {
        const newStages = [...stages];
        const [moved] = newStages.splice(fromIdx, 1);
        newStages.splice(toIdx, 0, moved);
        dispatch({ type: 'REORDER_STAGES', stages: newStages });
        setDraggedIdx(null);

        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recalcul global…' });
        for (const route of state.routes) {
            if (route) dispatch({ type: 'REMOVE_ROUTE', id: route.id });
        }

        for (let i = 0; i < newStages.length - 1; i++) {
            backgroundEngine.enqueue('route_leg', 0, `job-reorder-${Date.now()}-${i}`, {
                p1: [newStages[i].coords[0], newStages[i].coords[1]],
                p2: [newStages[i + 1].coords[0], newStages[i + 1].coords[1]],
                profile: 'pedestrian',
                small_roads: state.small_roads_only,
                insertIdx: i,
            });
        }
    };

    const displayIndices = useMemo(() => {
        const arr: number[] = [];
        for (let i = stages.length - 1; i >= 0; i--) arr.push(i);
        return arr;
    }, [stages.length]);

    // Desktop keyboard navigation: ArrowUp/Down selects, Enter edits, Delete removes, Alt+ArrowUp/Down reorders
    useEffect(() => {
        if (isMobile || stages.length === 0) return;
        const onKeyDown = (e: KeyboardEvent) => {
            const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
            if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement as HTMLElement | null)?.isContentEditable) {
                return;
            }
            const curOrigIdx = selectedStageId ? stages.findIndex((s) => s.id === selectedStageId) : -1;

            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                if (curOrigIdx === -1) return;
                // In reversed display: ArrowUp moves toward Arrivée (+1), ArrowDown moves toward Départ (-1)
                const targetIdx = e.key === 'ArrowUp' ? curOrigIdx + 1 : curOrigIdx - 1;
                if (targetIdx >= 0 && targetIdx < stages.length) {
                    e.preventDefault();
                    performReorder(curOrigIdx, targetIdx);
                }
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                let nextOrigIdx: number;
                if (curOrigIdx === -1) {
                    nextOrigIdx = e.key === 'ArrowDown' ? stages.length - 1 : 0;
                } else {
                    const nextDispPos = displayIndices.indexOf(curOrigIdx) + (e.key === 'ArrowDown' ? 1 : -1);
                    if (nextDispPos < 0 || nextDispPos >= displayIndices.length) return;
                    nextOrigIdx = displayIndices[nextDispPos];
                }
                const targetStage = stages[nextOrigIdx];
                if (targetStage) {
                    setSelectedStageId(targetStage.id);
                    mapRef.current?.flyTo([targetStage.coords[0], targetStage.coords[1]], Math.max(mapRef.current.getZoom(), 14), { duration: 0.55 });
                }
                return;
            }

            if (e.key === 'Enter' && curOrigIdx !== -1) {
                e.preventDefault();
                setEditTriggerCounter((c) => c + 1);
                return;
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && curOrigIdx !== -1) {
                e.preventDefault();
                const targetStage = stages[curOrigIdx];
                dispatch({ type: 'REMOVE_STAGE', id: targetStage.id });
                if (curOrigIdx > 0 && curOrigIdx < stages.length - 1) {
                    const prev = stages[curOrigIdx - 1];
                    const next = stages[curOrigIdx + 1];
                    const bridgeProfile = state.routes[curOrigIdx - 1]?.profile || state.routes[curOrigIdx]?.profile || 'pedestrian';
                    dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Reconnexion...' });
                    backgroundEngine.enqueue('route_leg', 0, `job-bridge-${Date.now()}`, {
                        p1: [prev.coords[0], prev.coords[1]],
                        p2: [next.coords[0], next.coords[1]],
                        profile: bridgeProfile,
                        small_roads: state.small_roads_only,
                        insertIdx: curOrigIdx - 1,
                    });
                }
                setUndoToast({ label: targetStage.label, key: Date.now() });
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobile, stages, selectedStageId, displayIndices, dispatch, state.routes, state.small_roads_only]);

    // Escape → clear multi-selection; Delete → delete all selected stages
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (document.activeElement as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === 'Escape') {
                if (multiStageSel.size > 0) { e.preventDefault(); setMultiStageSel(new Set()); }
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && multiStageSel.size > 0) {
                e.preventDefault();
                const toDelete = stages.filter((s) => multiStageSel.has(s.id));
                if (toDelete.length === 0) return;
                if (!window.confirm(`Supprimer ${toDelete.length} étape${toDelete.length > 1 ? 's' : ''} ?`)) return;
                // Sort by index descending to avoid shifting issues
                toDelete.forEach((s) => dispatch({ type: 'REMOVE_STAGE', id: s.id }));
                setMultiStageSel(new Set());
                setSelectedStageId(null);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [multiStageSel, stages, dispatch]);

    return (
        <div
            style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                maxHeight: '100%',
                overflow: 'hidden',
                background: embedded ? 'transparent' : 'var(--bg-panel)',
                borderRight: embedded ? 'none' : '1px solid var(--bg-border)',
            }}
        >
            <style>{`
                @keyframes srStageSlideFlash {
                    0% {
                        opacity: 0.4;
                        transform: translateY(-8px);
                        background: rgba(59, 130, 246, 0.22);
                    }
                    35% {
                        opacity: 1;
                        transform: translateY(0);
                        background: rgba(59, 130, 246, 0.16);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0);
                        background: transparent;
                    }
                }
                .sr-stage-flash {
                    animation: srStageSlideFlash 800ms cubic-bezier(0.16, 1, 0.3, 1);
                }
            `}</style>

            {/* Reversed Feed Stage List with bottom fade */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div
                    ref={scrollRef}
                    onDragOver={(e) => {
                        if (draggedIdx !== null) {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                        }
                    }}
                    onDrop={(e) => {
                        if (draggedIdx !== null && dragOverTargetIdx !== null) {
                            e.preventDefault();
                            handleDropOnStage(dragOverTargetIdx);
                        }
                    }}
                    onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverTargetIdx(null);
                        }
                    }}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        paddingBottom: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {displayIndices.map((origIdx) => {
                        const stage = stages[origIdx];
                        const hasSegmentBelow = origIdx > 0;
                        const leg = hasSegmentBelow ? state.routes[origIdx - 1] : undefined;
                        const legDist = hasSegmentBelow ? getLegDistanceMeters(leg) : undefined;
                        const legDur =
                            hasSegmentBelow && legDist !== undefined
                                ? getLegDurationSeconds(leg, legDist)
                                : undefined;
                        const legMode = (leg?.profile as RoutingMode) || 'pedestrian';

                        const showPreviewBefore =
                            draggedIdx !== null &&
                            dragOverTargetIdx === origIdx &&
                            draggedIdx < dragOverTargetIdx;
                        const showPreviewAfter =
                            draggedIdx !== null &&
                            dragOverTargetIdx === origIdx &&
                            draggedIdx > dragOverTargetIdx;

                        return (
                            <React.Fragment key={stage.id}>
                                {showPreviewBefore && (
                                    <StagePreviewRow
                                        stage={stages[draggedIdx!]}
                                        onDrop={() => handleDropOnStage(origIdx)}
                                    />
                                )}
                                <StageRow
                                    stage={stage}
                                    idx={origIdx}
                                    total={stages.length}
                                    isSelected={selectedStageId === stage.id && multiStageSel.size === 0}
                                    isMultiSelected={multiStageSel.has(stage.id)}
                                    isMobile={isMobile}
                                    isDragged={draggedIdx === origIdx}
                                    isNewFlash={flashStageId === stage.id}
                                    hasSegmentBelow={hasSegmentBelow}
                                    legDist={legDist}
                                    legDurationS={legDur}
                                    legMode={legMode}
                                    isLegComputing={hasSegmentBelow && (!leg || !leg.geojson?.geometry)}
                                    editTriggerCounter={editTriggerCounter}
                                    onSelect={({ ctrl, shift }) => {
                                        const dispPos = displayIndices.indexOf(origIdx);
                                        if (ctrl) {
                                            setMultiStageSel((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(stage.id)) next.delete(stage.id);
                                                else next.add(stage.id);
                                                return next;
                                            });
                                            lastStageSelDisplayPos.current = dispPos;
                                            return;
                                        }
                                        if (shift && lastStageSelDisplayPos.current !== null) {
                                            const from = Math.min(lastStageSelDisplayPos.current, dispPos);
                                            const to = Math.max(lastStageSelDisplayPos.current, dispPos);
                                            setMultiStageSel(new Set(displayIndices.slice(from, to + 1).map((i) => stages[i].id)));
                                            return;
                                        }
                                        // Plain click
                                        setMultiStageSel(new Set());
                                        lastStageSelDisplayPos.current = dispPos;
                                        if (selectedStageId === stage.id) {
                                            setSelectedStageId(null);
                                        } else {
                                            setSelectedStageId(stage.id);
                                            onStageSelected?.();
                                        }
                                    }}
                                    onChangeMode={(newMode) => handleSetLegProfile(origIdx - 1, newMode)}
                                    onDragStart={() => {
                                        setDraggedIdx(origIdx);
                                        setDragOverTargetIdx(null);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        if (draggedIdx !== null) {
                                            setDragOverTargetIdx(origIdx === draggedIdx ? null : origIdx);
                                        }
                                    }}
                                    onDrop={() => handleDropOnStage(origIdx)}
                                    onDragEnd={() => {
                                        setDraggedIdx(null);
                                        setDragOverTargetIdx(null);
                                    }}
                                    onReorderDelta={performReorder}
                                    onStageDeleted={(label) => setUndoToast({ label, key: Date.now() })}
                                    onCoordsCopied={(text) => setCopyToast({ text, key: Date.now() })}
                                />
                                {showPreviewAfter && (
                                    <StagePreviewRow
                                        stage={stages[draggedIdx!]}
                                        onDrop={() => handleDropOnStage(origIdx)}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}

                    {stages.length === 0 && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '14px 12px',
                                color: '#CBD5E1',
                                fontSize: '12px',
                            }}
                        >
                            <MapPin size={15} style={{ opacity: 0.6, flexShrink: 0 }} />
                            <span>Cliquez sur la carte ou recherchez un lieu ci-dessus.</span>
                        </div>
                    )}
                </div>

                {/* Bottom edge fade for cut-off older steps */}
                {stages.length > 2 && (
                    <div
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            height: '22px',
                            pointerEvents: 'none',
                            background: 'linear-gradient(to bottom, transparent, var(--bg-elevated))',
                        }}
                    />
                )}

                {/* Scroll-hint pill: Arrivée (top of list = last stage) */}
                {canScrollUp && (
                    <button
                        type="button"
                        aria-label="Remonter vers l'arrivée"
                        onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                        style={{
                            position: 'absolute',
                            top: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-elevated)',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            zIndex: 10,
                        }}
                    >
                        <ArrowUp size={13} aria-hidden="true" />
                    </button>
                )}

                {/* Scroll-hint pill: Départ (bottom of list = first stage) */}
                {canScrollDown && (
                    <button
                        type="button"
                        aria-label="Descendre vers le départ"
                        onClick={() =>
                            scrollRef.current?.scrollTo({
                                top: scrollRef.current.scrollHeight,
                                behavior: 'smooth',
                            })
                        }
                        style={{
                            position: 'absolute',
                            bottom: '8px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '999px',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-elevated)',
                            color: '#94A3B8',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            zIndex: 10,
                        }}
                    >
                        <ArrowDown size={13} aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Multi-selection summary bar for stages */}
            {multiStageSel.size >= 2 && (
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
                        {multiStageSel.size} étapes sélectionnées
                    </span>
                    <button
                        type="button"
                        title={`Supprimer ${multiStageSel.size} étapes`}
                        aria-label={`Supprimer ${multiStageSel.size} étapes`}
                        onClick={() => {
                            const toDelete = stages.filter((s) => multiStageSel.has(s.id));
                            if (!window.confirm(`Supprimer ${toDelete.length} étape${toDelete.length > 1 ? 's' : ''} ?`)) return;
                            toDelete.forEach((s) => dispatch({ type: 'REMOVE_STAGE', id: s.id }));
                            setMultiStageSel(new Set());
                            setSelectedStageId(null);
                        }}
                        style={{ padding: '4px 6px', border: 'none', borderRadius: '6px', background: 'rgba(239,68,68,0.12)', color: 'var(--semantic-red)', cursor: 'pointer', display: 'inline-flex' }}
                    >
                        <Trash2 size={13} />
                    </button>
                    <button
                        type="button"
                        title="Désélectionner · Échap"
                        aria-label="Annuler la sélection"
                        onClick={() => setMultiStageSel(new Set())}
                        style={{ padding: '4px 6px', border: 'none', borderRadius: '6px', background: 'transparent', color: '#64748B', cursor: 'pointer', display: 'inline-flex' }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Sticky Receipt Summary Footer */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '6px 8px 6px 12px',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'rgba(255, 255, 255, 0.035)',
                    borderRadius: 0,
                    flexShrink: 0,
                    minHeight: '38px',
                }}
            >
                <div
                    className="tabular-nums"
                    style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        gap: '5px',
                        minWidth: 0,
                    }}
                >
                    <span>
                        {stages.length} étape{stages.length > 1 ? 's' : ''}
                    </span>
                    {totalDistM > 0 && (
                        <>
                            <span style={{ color: '#94A3B8' }}>·</span>
                            <span>{formatDistanceFr(totalDistM)}</span>
                        </>
                    )}
                    {totalDurationS > 0 && (
                        <>
                            <span style={{ color: '#94A3B8' }}>·</span>
                            <span style={{ color: '#CBD5E1' }}>{formatDurationFr(totalDurationS)}</span>
                        </>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {stages.length >= 2 && (
                        <button
                            type="button"
                            onClick={() => dispatch({ type: 'INVERT_ROUTE' })}
                            title="Inverser l'itinéraire (Ctrl+I)"
                            aria-label="Inverser l'itinéraire"
                            style={{
                                height: '30px',
                                padding: '0 8px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                cursor: 'pointer',
                                borderRadius: '7px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                            }}
                        >
                            <ArrowLeftRight size={13} aria-hidden="true" />
                            <span>Inverser</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Non-blocking Undo Delete Toast */}
            {undoToast &&
                createPortal(
                    <div
                        role="status"
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
                            gap: '12px',
                            fontSize: '12.5px',
                            color: 'var(--text-primary)',
                        }}
                    >
                        <span>Étape {undoToast.label} supprimée</span>
                        <button
                            type="button"
                            onClick={() => {
                                dispatch({ type: 'UNDO' });
                                setUndoToast(null);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-strong)',
                                background: 'rgba(255,255,255,0.06)',
                                color: 'var(--text-primary)',
                                fontWeight: 600,
                                fontSize: '12px',
                                cursor: 'pointer',
                            }}
                        >
                            <Undo2 size={13} />
                            Annuler
                        </button>
                    </div>,
                    document.body
                )}

            {/* Non-blocking Coordinates Copied Toast */}
            {copyToast &&
                !undoToast &&
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

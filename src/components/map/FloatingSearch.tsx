import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2, MapPin, Plus, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { mapRef } from './MapComponent';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { useRoutes, useUI } from '../../hooks';
import { MAP_LAYERS } from '../../logic/MapConfig';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import { SearchResult, searchIGNWithBias, parseCoords } from '../../logic/geocoding';
import RoutePanel from '../panels/RoutePanel';
import { startPanelDragSession } from '../../utils/panelDrag';

// ── Geolocation marker ─────────────────────────────────────────────────────────
let geoMarker: L.CircleMarker | null = null;

function placeGeoMarker(lat: number, lon: number) {
    const map = mapRef.current;
    if (!map) return;
    if (geoMarker) map.removeLayer(geoMarker);
    geoMarker = L.circleMarker([lat, lon], {
        radius: 8,
        color: 'var(--accent-default)',
        fillColor: 'var(--accent-default)',
        fillOpacity: 0.35,
        weight: 2.5,
    }).addTo(map);
    map.flyTo([lat, lon], 15, { duration: 1 });
}

type GeoState = 'idle' | 'loading' | 'done' | 'failed';

interface FloatingSearchProps {
    isSplitMode?: boolean;
    /** When true: component is inside the left column (not floating). */
    docked?: boolean;
    /** Called when the user clicks the dock button or drags to dock. */
    onDock?: () => void;
    /** Called when the user clicks the undock button or drags to undock. */
    onUndock?: () => void;
    /** Optional controlled height of the expanded body in floating desktop mode. */
    panelHeight?: number | null;
    /** Called when the user resizes or resets the floating desktop body height. */
    onPanelHeightChange?: (h: number | null) => void;
    /** Optional max height clamp (e.g. to avoid overlapping bottom-left Calques). */
    maxFloatingBodyHeight?: number | null;
    /** Called when desktop expanded state changes. */
    onExpandedChange?: (expanded: boolean) => void;
}

export default function FloatingSearch({
    isSplitMode = false,
    docked = false,
    onDock,
    onUndock,
    panelHeight: controlledPanelHeight,
    onPanelHeightChange,
    maxFloatingBodyHeight = null,
    onExpandedChange,
}: FloatingSearchProps) {
    const { state } = useApp();
    const { routes = [], stages = [], dispatch } = useRoutes();
    const { activeIgnLayer } = useUI();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isSatellite, setIsSatellite] = useState(false);
    const [geoState, setGeoState] = useState<GeoState>('idle');
    const [isRouteExpanded, setIsRouteExpanded] = useState(() => docked);
    const [itinCtxMenu, setItinCtxMenu] = useState<{ x: number; y: number } | null>(null);
    const itinCtxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!itinCtxMenu) return;
        const onDown = (e: PointerEvent) => {
            if (itinCtxRef.current && !itinCtxRef.current.contains(e.target as Node)) {
                setItinCtxMenu(null);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setItinCtxMenu(null);
        };
        document.addEventListener('pointerdown', onDown, true);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('keydown', onKey);
        };
    }, [itinCtxMenu]);
    const [internalPanelHeight, setInternalPanelHeight] = useState<number | null>(null);
    const panelHeight = controlledPanelHeight !== undefined ? controlledPanelHeight : internalPanelHeight;
    const setPanelHeight = useCallback((h: number | null) => {
        if (onPanelHeightChange) onPanelHeightChange(h);
        else setInternalPanelHeight(h);
    }, [onPanelHeightChange]);
    const [isResizing, setIsResizing] = useState(false);
    const expandedBodyRef = useRef<HTMLDivElement>(null);
    const [mobileSnap, setMobileSnap] = useState<'collapsed' | 'half' | 'full'>('collapsed');
    const [sheetDragHeight, setSheetDragHeight] = useState<number | null>(null);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const searchBarRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [dropdownRect, setDropdownRect] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const handleToggle = () => {
            if (window.innerWidth < 768) {
                setMobileSnap((prev) => (prev === 'collapsed' ? 'half' : 'collapsed'));
            } else {
                setIsRouteExpanded((prev) => !prev);
            }
        };
        window.addEventListener('scoutraider:toggle-route-panel', handleToggle);
        return () => window.removeEventListener('scoutraider:toggle-route-panel', handleToggle);
    }, []);

    // Desktop Esc collapses the route panel when not typing in an input (but not when docked)
    useEffect(() => {
        if (isMobile || !isRouteExpanded || docked) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            const tag = (document.activeElement as HTMLElement | null)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            setIsRouteExpanded(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobile, isRouteExpanded, docked]);

    // When docked, always keep route panel expanded
    useEffect(() => {
        if (docked) setIsRouteExpanded(true);
    }, [docked]);

    useEffect(() => {
        onExpandedChange?.(isRouteExpanded);
    }, [isRouteExpanded, onExpandedChange]);

    useEffect(() => {
        const layer = MAP_LAYERS[activeIgnLayer || 'PLAN.IGN'];
        const isSat = layer?.isSatellite || false;
        setIsSatellite(isSat);

        if (isSat) {
            localStorage.setItem('lastSatLayerId', activeIgnLayer);
        } else {
            localStorage.setItem('lastPlanLayerId', activeIgnLayer);
        }
    }, [activeIgnLayer]);

    const handleSatellite = () => {
        const layer = MAP_LAYERS[activeIgnLayer || 'PLAN.IGN'];
        const isSat = layer?.isSatellite || false;

        if (isSat) {
            const lastPlan = localStorage.getItem('lastPlanLayerId') || 'PLAN.IGN';
            dispatch({ type: 'SET_IGN_LAYER', layer: lastPlan });
        } else {
            const lastSat = localStorage.getItem('lastSatLayerId') || 'SAT.IGN';
            dispatch({ type: 'SET_IGN_LAYER', layer: lastSat });
        }
    };

    const handleGeolocate = useCallback(() => {
        if (geoState === 'loading') return;
        setGeoState('loading');
        if (!navigator.geolocation) {
            setGeoState('failed');
            setTimeout(() => setGeoState('idle'), 3000);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                placeGeoMarker(latitude, longitude);
                setGeoState('done');
                setTimeout(() => setGeoState('idle'), 4000);
            },
            () => {
                setGeoState('failed');
                setTimeout(() => setGeoState('idle'), 3000);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }, [geoState]);

    // Biased IGN autocompletion around current map center
    useEffect(() => {
        const trimmed = query.trim();
        if (!trimmed || trimmed.length < 2 || parseCoords(trimmed)) {
            setResults([]);
            setShowResults(isFocused);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            try {
                const center = mapRef.current?.getCenter();
                const r = await searchIGNWithBias(
                    trimmed,
                    center ? { lat: center.lat, lon: center.lng } : null
                );
                setResults(r);
                setShowResults(true);
            } finally {
                setIsSearching(false);
            }
        }, 220);
        return () => clearTimeout(searchTimeout.current);
    }, [query, isFocused]);

    useEffect(() => {
        const handleClickOutside = (e: PointerEvent) => {
            const target = e.target as Node;
            const inContainer = containerRef.current?.contains(target);
            const inDropdown = dropdownRef.current?.contains(target);
            if (!inContainer && !inDropdown) {
                setShowResults(false);
                setIsFocused(false);
                searchInputRef.current?.blur();
            }
        };
        document.addEventListener('pointerdown', handleClickOutside, true);
        return () => document.removeEventListener('pointerdown', handleClickOutside, true);
    }, []);

    useEffect(() => {
        if (!showResults || (!results.length && !isFocused)) {
            setDropdownRect(null);
            return;
        }
        const update = () => {
            const rect = searchBarRef.current?.getBoundingClientRect() || cardRef.current?.getBoundingClientRect();
            if (!rect) return;
            const openUpward = isMobile || rect.bottom + 200 > window.innerHeight;
            setDropdownRect(
                openUpward
                    ? { bottom: window.innerHeight - rect.top + 6, left: rect.left, width: rect.width }
                    : { top: rect.bottom + 6, left: rect.left, width: rect.width }
            );
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, [showResults, results.length, isFocused, isRouteExpanded, mobileSnap, isMobile, stages.length]);

    const addStageFromResult = useCallback(
        (r: SearchResult) => {
            const anchorIdx =
                state.anchor_stage_idx >= 0 && state.anchor_stage_idx < stages.length
                    ? state.anchor_stage_idx
                    : stages.length - 1;

            dispatch({ type: 'ADD_STAGE', lat: r.lat, lon: r.lon, label: '-', address: r.label });

            if (anchorIdx >= 0 && anchorIdx < stages.length) {
                const prev = stages[anchorIdx];
                dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul du tronçon…' });
                backgroundEngine.enqueue('route_leg', 0, `job-add-${Date.now()}`, {
                    p1: [prev.coords[0], prev.coords[1]],
                    p2: [r.lat, r.lon],
                    profile: 'pedestrian',
                    small_roads: state.small_roads_only,
                    insertIdx: anchorIdx,
                });
                if (anchorIdx < stages.length - 1) {
                    const next = stages[anchorIdx + 1];
                    if (routes[anchorIdx]) dispatch({ type: 'REMOVE_ROUTE', id: routes[anchorIdx].id });
                    backgroundEngine.enqueue('route_leg', 0, `job-add-next-${Date.now()}`, {
                        p1: [r.lat, r.lon],
                        p2: [next.coords[0], next.coords[1]],
                        profile: 'pedestrian',
                        small_roads: state.small_roads_only,
                        insertIdx: anchorIdx + 1,
                    });
                }
            }
            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
            mapRef.current?.flyTo([r.lat, r.lon], Math.max(mapRef.current.getZoom(), 14), { duration: 0.7 });
            setQuery('');
            setShowResults(false);
            setIsFocused(false);
        },
        [state.anchor_stage_idx, state.small_roads_only, stages, routes, dispatch]
    );

    const selectResult = (r: SearchResult) => {
        if (effectiveExpanded) {
            addStageFromResult(r);
        } else {
            setQuery(r.label);
            setShowResults(false);
            setIsFocused(false);
            mapRef.current?.flyTo([r.lat, r.lon], 15, { duration: 1 });
        }
    };

    const handlePickOnMap = () => {
        setShowResults(false);
        setIsFocused(false);
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
        dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Cliquez sur la carte pour placer une étape.',
            notifType: 'info',
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            setShowResults(false);
            setIsFocused(false);
            searchInputRef.current?.blur();
            return;
        }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const coords = parseCoords(query);
        if (coords) {
            selectResult({
                label: `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}`,
                lat: coords.lat,
                lon: coords.lon,
            });
        } else if (results.length > 0) {
            selectResult(results[0]);
        }
    };

    const geoIcon = () => {
        if (geoState === 'loading') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="spin"
                    style={{ transformOrigin: 'center' }}
                >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            );
        }
        if (geoState === 'failed') {
            return (
                <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="var(--semantic-danger)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M12 19v3" />
                    <path d="M12 2v3" />
                    <path d="M18.89 13.24a7 7 0 0 0-8.13-8.13" />
                    <path d="M19 12h3" />
                    <path d="M2 12h3" />
                    <path d="m2 2 20 20" />
                    <path d="M7.05 7.05a7 7 0 0 0 9.9 9.9" />
                </svg>
            );
        }
        return (
            <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <line x1="2" x2="5" y1="12" y2="12" />
                <line x1="19" x2="22" y1="12" y2="12" />
                <line x1="12" x2="12" y1="2" y2="5" />
                <line x1="12" x2="12" y1="19" y2="22" />
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        );
    };

    const toolbarStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: '3px',
        height: '40px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '14px',
        pointerEvents: 'all',
        flexShrink: 0,
    };

    const tbBtnStyle = (active = false): React.CSSProperties => ({
        width: '32px',
        height: '32px',
        border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
        background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
        borderRadius: '10px',
        cursor: 'pointer',
        color: active ? 'var(--text-primary)' : geoState === 'failed' ? 'var(--semantic-danger)' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 100ms ease',
    });

    // ── Long-press drag to dock (fires custom events picked up by MapWorkspace) ─
    const [isDraggingBar, setIsDraggingBar] = useState(false);
    // hover states for 6-dot drag hint on icons
    const [searchIconHover, setSearchIconHover] = useState(false);

    const handleBarPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
        if (docked) return;
        startPanelDragSession(e, 'etapes', {
            ignoreInput: true,
            onDragStateChange: setIsDraggingBar,
        });
    }, [docked]);

    const handleDockedHeaderPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
        if (!docked || isMobile) return;
        startPanelDragSession(e, 'etapes', {
            fromDocked: true,
            ignoreButton: true,
            onDragStateChange: setIsDraggingBar,
        });
    }, [docked, isMobile]);

    const hasStages = stages && stages.length > 0;
    const itineraries = state.itineraries || [];
    const activeItin = itineraries.find((it) => it.id === state.active_itinerary_id) || itineraries[itineraries.length - 1] || null;
    const noTraces = !activeItin;
    const showItinColorDot = Boolean(activeItin && activeItin.color.toLowerCase() !== '#2d8ceb');

    // Top search bar row (always stays at the top; Étapes toggle button switches icon between Route and ChevronUp)
    const effectiveExpanded = isMobile ? mobileSnap !== 'collapsed' : isRouteExpanded;

    // Desktop bottom drag-to-resize handle
    const handleDesktopResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startHeight = expandedBodyRef.current?.getBoundingClientRect().height || 260;
        setIsResizing(true);

        const onMove = (ev: PointerEvent) => {
            const maxH = Math.max(200, window.innerHeight - 104);
            const nextH = Math.round(Math.max(110, Math.min(maxH, startHeight + (ev.clientY - startY))));
            setPanelHeight(nextH);
        };
        const onUp = () => {
            setIsResizing(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, [setPanelHeight]);

    // Mobile bottom sheet drag handle (snaps between collapsed / half / full)
    const handleSheetDragStart = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!isMobile) return;
            e.preventDefault();
            e.stopPropagation();
            const startY = e.clientY;
            const vh = window.innerHeight;
            const halfPx = Math.round(vh * 0.5);
            const fullPx = Math.round(vh * 0.86);
            const collapsedPx = 56;
            const startH =
                mobileSnap === 'full' ? fullPx : mobileSnap === 'half' ? halfPx : collapsedPx;

            let latestH = startH;
            setSheetDragHeight(startH);

            const onMove = (ev: PointerEvent) => {
                latestH = Math.round(Math.max(collapsedPx, Math.min(fullPx, startH + (startY - ev.clientY))));
                setSheetDragHeight(latestH);
            };
            const onUp = () => {
                setSheetDragHeight(null);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                if (latestH < (collapsedPx + halfPx) / 2) {
                    setMobileSnap('collapsed');
                } else if (latestH < (halfPx + fullPx) / 2) {
                    setMobileSnap('half');
                } else {
                    setMobileSnap('full');
                }
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        },
        [isMobile, mobileSnap]
    );

    // ── Shared close-button style (same as LayerManagerPanel) ───────────────
    const closeBtnStyle: React.CSSProperties = {
        width: 28, height: 28, flexShrink: 0,
        border: 'none', borderRadius: 8,
        background: 'transparent', color: 'var(--text-dim)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, lineHeight: 1,
        transition: 'background 100ms, color 100ms',
    };

    const searchRow = (
        <>
        {/* Docked header: "Étapes · nom itinéraire · N [✕]" — draggable to move dock side or undock to map */}
        {docked && !isMobile && (
            <div
                onPointerDown={handleDockedHeaderPointerDown}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setItinCtxMenu({ x: e.clientX, y: e.clientY });
                }}
                onMouseEnter={() => setSearchIconHover(true)}
                onMouseLeave={() => setSearchIconHover(false)}
                title="Maintenir et glisser pour déplacer ou remettre sur la carte"
                style={{
                    display: 'flex', alignItems: 'center',
                    padding: '0 10px 0 14px', height: 40, flexShrink: 0,
                    borderBottom: '1px solid var(--border-subtle)',
                    gap: 8,
                    cursor: isDraggingBar ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    touchAction: 'none',
                }}
            >
                {searchIconHover && (
                    <svg width="9" height="12" viewBox="0 0 10 14" fill="var(--text-secondary)" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <circle cx="2.5" cy="2" r="1.3"/><circle cx="7.5" cy="2" r="1.3"/>
                        <circle cx="2.5" cy="7" r="1.3"/><circle cx="7.5" cy="7" r="1.3"/>
                        <circle cx="2.5" cy="12" r="1.3"/><circle cx="7.5" cy="12" r="1.3"/>
                    </svg>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em', flexShrink: 0 }}>
                    Étapes
                </span>
                {activeItin && (
                    <>
                        <span style={{ color: 'var(--border-strong)', fontSize: 11, flexShrink: 0 }}>·</span>
                        {activeItin.color && (
                            <span aria-hidden="true" style={{
                                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                                background: activeItin.visible !== false ? activeItin.color : 'transparent',
                                border: activeItin.visible !== false ? '1.5px solid transparent' : `1.5px solid ${activeItin.color}`,
                            }} />
                        )}
                        <span style={{
                            fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            flex: 1, minWidth: 0,
                        }}>
                            {activeItin.name}
                        </span>
                        {stages.length > 0 && (
                            <span className="tabular-nums" style={{
                                fontSize: '10.5px', fontWeight: 700,
                                padding: '1px 5px', borderRadius: '8px',
                                background: 'rgba(255,255,255,0.14)',
                                color: '#ffffff', lineHeight: 1.25,
                                fontFamily: 'var(--font-mono)', flexShrink: 0,
                            }}>
                                {stages.length}
                            </span>
                        )}
                    </>
                )}
                {onUndock && (
                    <button
                        type="button"
                        onClick={onUndock}
                        title="Fermer le panneau"
                        aria-label="Fermer le panneau Étapes"
                        style={{ ...closeBtnStyle, marginLeft: activeItin ? 0 : 'auto' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}
                    >
                        ✕
                    </button>
                )}
            </div>
        )}
        <div
            ref={searchBarRef}
            onPointerDown={!isMobile && !docked ? handleBarPointerDown : undefined}
            onMouseEnter={!isMobile && !docked ? () => setSearchIconHover(true) : undefined}
            onMouseLeave={!isMobile && !docked ? () => setSearchIconHover(false) : undefined}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: effectiveExpanded ? '12px' : '15px',
                padding: effectiveExpanded ? '0 4px 0 12px' : '0 4px 0 10px',
                height: '40px',
                flexShrink: 0,
                borderBottom: effectiveExpanded ? '1px solid var(--border-subtle)' : 'none',
                userSelect: 'none',
                cursor: !isMobile && !docked ? (isDraggingBar ? 'grabbing' : 'grab') : undefined,
                touchAction: 'none',
            }}
        >
            <style>{`.sr-search-input::placeholder { color: #CBD5E1; opacity: 0.85; }`}</style>

            {/* Left icon: 6-dots on hover (drag hint) or letter/spinner */}
            {effectiveExpanded ? (
                <div
                    aria-hidden="true"
                    title={!isMobile && !docked ? `Prochaine étape : ${String.fromCharCode(65 + stages.length)} · maintenir pour déplacer` : `Prochaine étape : ${String.fromCharCode(65 + stages.length)}`}
                    style={{
                        width: '20px', height: '20px', borderRadius: '6px',
                        border: (!isMobile && !docked && searchIconHover) ? 'none' : '1.5px solid var(--border-strong)',
                        color: 'var(--text-secondary)', fontWeight: 800,
                        fontSize: '10.5px', fontFamily: 'var(--font-mono)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        cursor: !isMobile && !docked ? (isDraggingBar ? 'grabbing' : 'grab') : undefined,
                        transition: 'border-color 120ms',
                    }}
                >
                    {isSearching ? (
                        <Loader2 size={12} className="spin" color="#64748B" />
                    ) : searchIconHover && !isMobile && !docked ? (
                        <svg width="11" height="13" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
                            <circle cx="2.5" cy="2"  r="1.3"/><circle cx="7.5" cy="2"  r="1.3"/>
                            <circle cx="2.5" cy="7"  r="1.3"/><circle cx="7.5" cy="7"  r="1.3"/>
                            <circle cx="2.5" cy="12" r="1.3"/><circle cx="7.5" cy="12" r="1.3"/>
                        </svg>
                    ) : (
                        String.fromCharCode(65 + stages.length)
                    )}
                </div>
            ) : isSearching ? (
                <Loader2 size={15} className="spin" color="#64748B" style={{ flexShrink: 0 }} />
            ) : (
                <>
                    {!isMobile && !docked && searchIconHover
                        ? <svg width="11" height="13" viewBox="0 0 10 14" fill="var(--text-secondary)" aria-hidden="true" style={{ flexShrink: 0 }}>
                            <circle cx="2.5" cy="2"  r="1.3"/><circle cx="7.5" cy="2"  r="1.3"/>
                            <circle cx="2.5" cy="7"  r="1.3"/><circle cx="7.5" cy="7"  r="1.3"/>
                            <circle cx="2.5" cy="12" r="1.3"/><circle cx="7.5" cy="12" r="1.3"/>
                          </svg>
                        : <Search size={15} color="var(--text-secondary)" strokeWidth={2} style={{ flexShrink: 0 }} />
                    }
                </>
            )}
            <input
                ref={searchInputRef}
                type="text"
                className="sr-search-input"
                aria-label={effectiveExpanded ? 'Ajouter une étape par lieu ou coordonnées' : 'Rechercher un lieu'}
                placeholder={effectiveExpanded ? 'Ajouter une étape…' : 'Rechercher un lieu…'}
                style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: '0 2px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-ui)',
                }}
                value={query}
                onChange={(e) => {
                    const val = e.target.value;
                    setQuery(val);
                    if (val.trim().length > 0 && noTraces) {
                        dispatch({ type: 'ADD_ITINERARY' });
                    }
                }}
                onFocus={() => {
                    setIsFocused(true);
                    setShowResults(true);
                }}
                onBlur={() => {
                    setTimeout(() => {
                        setIsFocused(false);
                        setShowResults(false);
                    }, 140);
                }}
                onKeyDown={handleKeyDown}
            />
            {query && (
                <button
                    type="button"
                    aria-label="Effacer la recherche"
                    onClick={() => {
                        setQuery('');
                        setResults([]);
                        searchInputRef.current?.focus();
                    }}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: '4px 6px',
                        lineHeight: 1,
                        fontSize: '16px',
                        flexShrink: 0,
                    }}
                >
                    ×
                </button>
            )}

            {/* Itinerary toggle button — hidden when docked (info shown in header instead) */}
            {!docked && (
            <button
                type="button"
                aria-expanded={effectiveExpanded}
                aria-label={
                    activeItin
                        ? `Étapes de ${activeItin.name}, ${stages.length} étape${stages.length > 1 ? 's' : ''}`
                        : 'Étapes'
                }
                onClick={() => {
                    if (isMobile) {
                        setMobileSnap((prev) => (prev === 'collapsed' ? 'half' : 'collapsed'));
                    } else {
                        setIsRouteExpanded((prev) => !prev);
                    }
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setItinCtxMenu({ x: e.clientX, y: e.clientY });
                }}
                title={activeItin ? `${activeItin.name} · clic droit pour changer d'itinéraire` : 'Étapes · clic droit pour créer un itinéraire'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    height: '32px',
                    padding: isMobile ? '0 8px' : '0 10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'transparent',
                    color: effectiveExpanded || hasStages
                        ? 'var(--text-primary)'
                        : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    flexShrink: 0,
                }}
            >
                {/* Icon */}
                {effectiveExpanded ? (
                    <ChevronUp size={15} strokeWidth={2.3} aria-hidden="true" />
                ) : activeItin ? (
                    <span
                        aria-hidden="true"
                        style={{
                            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                            background: activeItin.visible !== false ? activeItin.color : 'transparent',
                            border: activeItin.visible !== false
                                ? '1.5px solid transparent'
                                : `1.5px solid ${activeItin.color}`,
                            transition: 'background-color 150ms ease, border-color 150ms ease',
                        }}
                    />
                ) : (
                    <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
                )}
                <span
                    style={{
                        maxWidth: isMobile ? '84px' : '116px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}
                >
                    {activeItin ? activeItin.name : 'Étapes'}
                </span>
                {!noTraces && (
                    <span
                        className="tabular-nums"
                        style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: '8px',
                            background: effectiveExpanded ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.14)',
                            color: '#ffffff',
                            lineHeight: 1.25,
                            fontFamily: 'var(--font-mono)',
                            flexShrink: 0,
                        }}
                    >
                        {stages.length}
                    </span>
                )}
            </button>
            )}


        </div>
        </>
    );

    return (
        <div
            ref={containerRef}
            id="top-left-container"
            style={
                docked
                    ? {
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                          minHeight: 0,
                          pointerEvents: 'all',
                          overflow: 'hidden',
                      }
                    : isMobile
                      ? {
                            position: 'fixed',
                            left: '8px',
                            right: '8px',
                            bottom: '8px',
                            zIndex: 1200,
                            display: 'flex',
                            flexDirection: 'column',
                            pointerEvents: 'none',
                        }
                      : {
                            position: 'absolute',
                            top: '16px',
                            left: '16px',
                            zIndex: 1200,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            pointerEvents: 'none',
                            maxWidth: 'calc(100% - 32px)',
                        }
            }
        >
            <div
                style={{
                    display: 'flex',
                    gap: '8px',
                    pointerEvents: 'none',
                    alignItems: docked ? 'stretch' : 'flex-start',
                    width: '100%',
                    flex: docked ? 1 : undefined,
                    minHeight: docked ? 0 : undefined,
                }}
            >
                {/* Desktop: top-left floating panel | Mobile: 3-snap bottom sheet | Docked: fills column */}
                <div
                    ref={cardRef}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        background: 'var(--bg-elevated)',
                        border: docked ? 'none' : '1px solid var(--border-subtle)',
                        borderRadius: docked ? 0 : (isMobile ? '16px' : '14px'),
                        boxShadow: docked ? 'none' : (effectiveExpanded ? 'var(--shadow-lg)' : 'var(--shadow-md)'),
                        pointerEvents: 'all',
                        position: 'relative',
                        width: docked ? '100%' : (isMobile ? '100%' : 'var(--panel-width)'),
                        height: docked ? '100%' : undefined,
                        flex: (docked || isMobile) ? 1 : '0 0 auto',
                        minWidth: 0,
                        minHeight: docked ? 0 : undefined,
                        overflow: docked ? 'hidden' : 'visible',
                        ...(isMobile && !docked && (sheetDragHeight !== null || mobileSnap !== 'collapsed')
                            ? {
                                  height:
                                      sheetDragHeight !== null
                                          ? `${sheetDragHeight}px`
                                          : mobileSnap === 'full'
                                            ? '86dvh'
                                            : '50dvh',
                                  transition: sheetDragHeight === null ? 'height 200ms ease' : undefined,
                              }
                            : {}),
                    }}
                >
                    {/* Mobile-only real drag handle at top of bottom sheet */}
                    {isMobile && (
                        <div
                            role="separator"
                            aria-orientation="horizontal"
                            aria-label="Glisser pour redimensionner le panneau"
                            onPointerDown={handleSheetDragStart}
                            style={{
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'ns-resize',
                                touchAction: 'none',
                                flexShrink: 0,
                            }}
                        >
                            <div
                                style={{
                                    width: '36px',
                                    height: '4px',
                                    borderRadius: '999px',
                                    background: 'rgba(255, 255, 255, 0.25)',
                                }}
                            />
                        </div>
                    )}

                    {/* Search Bar stays pinned at the TOP */}
                    {searchRow}

                    {/* Expanded Stages Body: fills column when docked; fits content on floating desktop; fills sheet on mobile */}
                    {effectiveExpanded && (
                        <>
                            <div
                                ref={expandedBodyRef}
                                data-etapes-body="true"
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    ...(docked
                                        ? { flex: 1, minHeight: 0 }
                                        : isMobile
                                          ? { flex: 1, minHeight: 0 }
                                          : {
                                                height: panelHeight !== null ? `${panelHeight}px` : undefined,
                                                maxHeight: maxFloatingBodyHeight !== null
                                                    ? `${maxFloatingBodyHeight}px`
                                                    : panelHeight !== null ? 'calc(100dvh - 104px)' : '60dvh',
                                                minHeight: 0,
                                            }),
                                }}
                            >
                                <RoutePanel
                                    embedded={true}
                                    isMobile={isMobile}
                                    onClose={() => (isMobile ? setMobileSnap('collapsed') : setIsRouteExpanded(false))}
                                    onStageSelected={() => {
                                        if (isMobile) setMobileSnap('collapsed');
                                    }}
                                />
                            </div>
                            {/* Bottom resize grabber: only shown in floating desktop mode */}
                            {!isMobile && !docked && (
                                <div
                                    role="separator"
                                    aria-orientation="horizontal"
                                    aria-label="Redimensionner la liste des étapes"
                                    title="Glisser pour redimensionner (double-clic pour réinitialiser)"
                                    onPointerDown={handleDesktopResizeStart}
                                    onDoubleClick={() => setPanelHeight(null)}
                                    style={{
                                        height: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'ns-resize',
                                        touchAction: 'none',
                                        borderTop: '1px solid var(--border-subtle)',
                                        borderRadius: '0 0 13px 13px',
                                        background: isResizing
                                            ? 'rgba(255, 255, 255, 0.06)'
                                            : 'rgba(255, 255, 255, 0.025)',
                                        flexShrink: 0,
                                        userSelect: 'none',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '36px',
                                            height: '3px',
                                            borderRadius: '999px',
                                            background: isResizing
                                                ? 'rgba(255, 255, 255, 0.55)'
                                                : 'rgba(255, 255, 255, 0.24)',
                                            transition: 'background 150ms ease',
                                        }}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Autocomplete Dropdown via Portal (above and beyond the component, never clipped) */}
                    {showResults &&
                        (results.length > 0 || isFocused) &&
                        dropdownRect &&
                        createPortal(
                            <div
                                ref={dropdownRef}
                                onMouseDown={(e) => e.preventDefault()}
                                onPointerDown={(e) => e.preventDefault()}
                                style={{
                                    position: 'fixed',
                                    ...(dropdownRect.top !== undefined
                                        ? { top: `${dropdownRect.top}px` }
                                        : { bottom: `${dropdownRect.bottom}px` }),
                                    left: `${dropdownRect.left}px`,
                                    width: `${dropdownRect.width}px`,
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '12px',
                                    boxShadow: 'var(--shadow-lg)',
                                    maxHeight: `${
                                        dropdownRect.top !== undefined
                                            ? Math.max(160, Math.min(310, window.innerHeight - dropdownRect.top - 16))
                                            : Math.max(160, Math.min(280, window.innerHeight - (dropdownRect.bottom || 0) - 16))
                                    }px`,
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    overscrollBehavior: 'contain',
                                    zIndex: 9999,
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                            {results.map((r, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        width: '100%',
                                        minWidth: 0,
                                        borderBottom: '1px solid var(--border-subtle)',
                                    }}
                                >
                                    <button
                                        type="button"
                                        className="sr-menu-item"
                                        onClick={() => selectResult(r)}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            minHeight: '40px',
                                            padding: '6px 12px 6px 15px',
                                            fontSize: '12px',
                                            borderRadius: 0,
                                            display: 'flex',
                                            gap: '15px',
                                            alignItems: 'center',
                                            justifyContent: 'flex-start',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <MapPin
                                            size={14}
                                            color="#64748B"
                                            style={{ flexShrink: 0 }}
                                            aria-hidden="true"
                                        />
                                        <span
                                            style={{
                                                flex: 1,
                                                minWidth: 0,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            {r.label}
                                            {r.postcode && !r.label.includes(r.postcode) && (
                                                <span
                                                    className="tabular-nums"
                                                    style={{
                                                        color: '#CBD5E1',
                                                        marginLeft: '6px',
                                                        fontFamily: 'var(--font-mono)',
                                                        fontSize: '11px',
                                                    }}
                                                >
                                                    {r.postcode}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                    {!effectiveExpanded && (
                                        <button
                                            type="button"
                                            title="Ajouter comme étape"
                                            aria-label={`Ajouter ${r.label} comme étape`}
                                            onClick={() => {
                                                addStageFromResult(r);
                                                if (isMobile) setMobileSnap('half');
                                                else setIsRouteExpanded(true);
                                            }}
                                            style={{
                                                width: '40px',
                                                height: '40px',
                                                border: 'none',
                                                background: 'transparent',
                                                color: 'var(--text-secondary)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Plus size={15} />
                                        </button>
                                    )}
                                </div>
                            ))}

                            <button
                                type="button"
                                className="sr-menu-item"
                                onClick={handlePickOnMap}
                                style={{
                                    minHeight: '40px',
                                    padding: '6px 12px 6px 15px',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    borderRadius: 0,
                                    display: 'flex',
                                    gap: '15px',
                                    alignItems: 'center',
                                    justifyContent: 'flex-start',
                                    textAlign: 'left',
                                }}
                            >
                                <MapPin size={14} aria-hidden="true" />
                                Choisir sur la carte
                            </button>
                        </div>,
                        document.body
                    )}
                    {/* Itinerary picker context menu (right-click on itinerary button or docked header) */}
                    {itinCtxMenu && createPortal(
                        <div
                            ref={itinCtxRef}
                            role="menu"
                            aria-label="Choisir l'itinéraire actif"
                            style={{
                                position: 'fixed',
                                left: Math.max(8, Math.min(itinCtxMenu.x, window.innerWidth - 230)),
                                top: Math.max(8, Math.min(itinCtxMenu.y, window.innerHeight - Math.min(320, itineraries.length * 36 + 60))),
                                minWidth: 210,
                                maxWidth: 280,
                                maxHeight: 300,
                                overflowY: 'auto',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-strong)',
                                borderRadius: 11,
                                boxShadow: 'var(--shadow-lg)',
                                padding: 4,
                                zIndex: 10000,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                            }}
                        >
                            <div style={{
                                padding: '4px 8px 3px',
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.06em',
                                color: 'var(--text-dim)',
                            }}>
                                Itinéraire actif
                            </div>
                            {itineraries.map((it) => {
                                const isActive = it.id === activeItin?.id;
                                const stageCount = it.stages?.length || 0;
                                return (
                                    <button
                                        key={it.id}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={isActive}
                                        onClick={() => {
                                            dispatch({ type: 'SET_ACTIVE_ITINERARY', id: it.id });
                                            setItinCtxMenu(null);
                                        }}
                                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isActive ? 'rgba(255,255,255,0.05)' : 'transparent'; }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            width: '100%',
                                            padding: '6px 8px',
                                            border: 'none',
                                            borderRadius: 7,
                                            background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            fontSize: 12,
                                            fontWeight: isActive ? 600 : 500,
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                        }}
                                    >
                                        <span aria-hidden="true" style={{
                                            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                                            background: it.visible !== false ? it.color : 'transparent',
                                            border: it.visible !== false ? '1.5px solid transparent' : `1.5px solid ${it.color}`,
                                        }} />
                                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {it.name}
                                        </span>
                                        <span className="tabular-nums" style={{ fontSize: 10.5, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                                            {stageCount}
                                        </span>
                                        {isActive && <Check size={13} strokeWidth={2.5} style={{ flexShrink: 0, color: 'var(--text-primary)' }} />}
                                    </button>
                                );
                            })}
                            <div style={{ height: 1, background: 'var(--border-subtle)', margin: '2px 4px' }} />
                            <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                    dispatch({ type: 'ADD_ITINERARY' });
                                    setItinCtxMenu(null);
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 7,
                                    width: '100%',
                                    padding: '6px 8px',
                                    border: 'none',
                                    borderRadius: 7,
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                }}
                            >
                                <Plus size={13} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                                <span>Nouvel itinéraire</span>
                            </button>
                        </div>,
                        document.body
                    )}
                </div>

                {/* Satellite + Geolocate Pill — hidden when docked (shown in map zone via MapSatGeoBar) */}
                {!docked && <div style={toolbarStyle}>
                    <button
                        type="button"
                        onClick={handleSatellite}
                        style={tbBtnStyle(isSatellite)}
                        title={isSatellite ? 'Vue carte topographique' : 'Vue satellite'}
                        aria-label={isSatellite ? 'Vue carte topographique' : 'Vue satellite'}
                    >
                        <svg
                            viewBox="0 0 24 24"
                            width="17"
                            height="17"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z" />
                            <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845" />
                        </svg>
                    </button>

                    <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 1px' }} />

                    <button
                        type="button"
                        onClick={handleGeolocate}
                        style={{ ...tbBtnStyle(geoState === 'done'), ...(geoState === 'loading' ? { opacity: 0.7 } : {}) }}
                        title="Me localiser"
                        aria-label="Me localiser"
                    >
                        {geoIcon()}
                    </button>
                </div>}
            </div>
        </div>
    );
}

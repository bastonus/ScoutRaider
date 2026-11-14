import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Loader2, Route, ChevronUp, X } from 'lucide-react';
import { mapRef } from './MapComponent';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { MAP_LAYERS } from '../../logic/MapConfig';
import RoutePanel from '../panels/RoutePanel';

// ── Types ─────────────────────────────────────────────────────────────────────
interface SearchResult {
    label: string;
    postcode?: string;
    lat: number;
    lon: number;
}

// ── IGN Geocoding (Géoplateforme) ─────────────────────────────────────────────
async function searchIGN(query: string): Promise<SearchResult[]> {
    try {
        const url = `https://data.geopf.fr/geocodage/completion?text=${encodeURIComponent(query)}&maximumResponses=6&type=StreetAddress,PositionOfInterest`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).map((r: any) => ({
            label: r.fulltext || r.label || '',
            postcode: r.postcode || '',
            lat: parseFloat(r.y),
            lon: parseFloat(r.x),
        })).filter((r: SearchResult) => !isNaN(r.lat) && !isNaN(r.lon));
    } catch {
        return [];
    }
}

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
}

export default function FloatingSearch({ isSplitMode = false }: FloatingSearchProps) {
    const { state, dispatch } = useApp();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isSatellite, setIsSatellite] = useState(false);
    const [geoState, setGeoState] = useState<GeoState>('idle');
    const [isRouteExpanded, setIsRouteExpanded] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Listen to custom toggle event for route panel (e.g. from Ctrl+[ or menu shortcuts)
    useEffect(() => {
        const handleToggle = () => setIsRouteExpanded(prev => !prev);
        window.addEventListener('scoutraider:toggle-route-panel', handleToggle);
        return () => window.removeEventListener('scoutraider:toggle-route-panel', handleToggle);
    }, []);

    useEffect(() => {
        const layer = MAP_LAYERS[state.active_ign_layer || 'PLAN.IGN'];
        const isSat = layer?.isSatellite || false;
        setIsSatellite(isSat);
        
        if (isSat) {
            localStorage.setItem('lastSatLayerId', state.active_ign_layer);
        } else {
            localStorage.setItem('lastPlanLayerId', state.active_ign_layer);
        }
    }, [state.active_ign_layer]);

    const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSatellite = () => {
        const layer = MAP_LAYERS[state.active_ign_layer || 'PLAN.IGN'];
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

    useEffect(() => {
        if (!query.trim() || query.length < 3) {
            setResults([]);
            setShowResults(false);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(async () => {
            try {
                const r = await searchIGN(query);
                setResults(r);
                setShowResults(r.length > 0);
            } finally {
                setIsSearching(false);
            }
        }, 220);
        return () => clearTimeout(searchTimeout.current);
    }, [query]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectResult = (r: SearchResult) => {
        setQuery(r.label);
        setShowResults(false);
        mapRef.current?.flyTo([r.lat, r.lon], 15, { duration: 1 });
    };

    const totalDistanceKm = useMemo(() => {
        let total = 0;
        const R = 6371e3;
        for (const leg of state.routes) {
            if (!leg || !leg.geojson?.geometry) continue;
            const coords = leg.geojson.geometry.coordinates;
            if (!coords || coords.length < 2) continue;
            for (let i = 0; i < coords.length - 1; i++) {
                const [, lat1] = coords[i], [, lat2] = coords[i + 1];
                const [lon1] = coords[i], [lon2] = coords[i + 1];
                const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
                const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
                total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            }
        }
        return total > 0 ? (total / 1000).toFixed(1) : null;
    }, [state.routes]);

    const geoIcon = () => {
        if (geoState === 'loading') {
            return (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="spin" style={{ transformOrigin: 'center' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            );
        }
        if (geoState === 'failed') {
            return (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="var(--semantic-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19v3" /><path d="M12 2v3" />
                    <path d="M18.89 13.24a7 7 0 0 0-8.13-8.13" />
                    <path d="M19 12h3" /><path d="M2 12h3" />
                    <path d="m2 2 20 20" />
                    <path d="M7.05 7.05a7 7 0 0 0 9.9 9.9" />
                </svg>
            );
        }
        return (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        boxShadow: 'none',
        pointerEvents: 'all',
        flexShrink: 0,
    };

    const tbBtnStyle = (active = false): React.CSSProperties => ({
        width: '32px',
        height: '32px',
        border: active ? '1px solid var(--accent-default)' : '1px solid transparent',
        background: active ? 'var(--accent-default)' : 'transparent',
        borderRadius: '10px',
        cursor: 'pointer',
        color: active ? '#ffffff' : geoState === 'failed' ? 'var(--semantic-danger)' : 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 100ms ease',
        boxShadow: 'none',
    });

    const hasStages = state.stages && state.stages.length > 0;

    return (
        <>
            <style>{`
                @keyframes modularCardIn {
                    0% {
                        opacity: 0;
                        transform: translateY(-6px) scale(0.98);
                    }
                    100% {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
            `}</style>

            <div ref={containerRef} id="top-left-container" style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                right: isMobile ? '16px' : 'auto',
                zIndex: 1100,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'none',
                maxWidth: isMobile ? 'none' : '440px',
                width: isMobile ? 'auto' : (isRouteExpanded ? '380px' : 'auto'),
                transition: 'width 180ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                {/* ── TOP BAR (SEARCH + ITINÉRAIRE + SATELLITE/GEO) ── */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    pointerEvents: 'none',
                    alignItems: 'center',
                    width: '100%',
                }}>
                    {/* Unified Search + Itinéraire Island */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0 4px 0 10px',
                        height: '40px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: showResults ? '14px 14px 0 0' : '14px',
                        boxShadow: 'none',
                        transition: 'border-color 100ms ease',
                        pointerEvents: 'all',
                        position: 'relative',
                        flex: 1,
                        minWidth: 0,
                    }}>
                        {isSearching ? (
                            <Loader2 size={15} className="spin" color="var(--accent-default)" style={{ flexShrink: 0 }} />
                        ) : (
                            <Search size={15} color="var(--text-dim)" strokeWidth={2} style={{ flexShrink: 0 }} />
                        )}
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                width: '100%',
                                minWidth: '60px',
                                fontFamily: 'var(--font-ui)',
                            }}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onFocus={() => results.length > 0 && setShowResults(true)}
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => { setQuery(''); setShowResults(false); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--text-dim)',
                                    padding: '0 4px',
                                    lineHeight: 1,
                                    fontSize: '15px',
                                    flexShrink: 0,
                                }}
                            >
                                ×
                            </button>
                        )}

                        <div style={{ width: '1px', height: '20px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />

                        {/* BOUTON ITINÉRAIRE MODULAIRE DÉVELOPPANT */}
                        <button
                            type="button"
                            onClick={() => setIsRouteExpanded(prev => !prev)}
                            title={isRouteExpanded ? "Masquer les étapes de l'itinéraire" : "Ouvrir les étapes de l'itinéraire"}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                height: '32px',
                                padding: isMobile ? '0 8px' : '0 10px',
                                borderRadius: '10px',
                                border: isRouteExpanded ? '1px solid var(--accent-default)' : '1px solid transparent',
                                background: isRouteExpanded 
                                    ? 'var(--accent-default)' 
                                    : hasStages 
                                        ? 'rgba(110, 201, 126, 0.12)' 
                                        : 'transparent',
                                color: isRouteExpanded 
                                    ? '#ffffff' 
                                    : hasStages 
                                        ? 'var(--accent-default)' 
                                        : 'var(--text-dim)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                flexShrink: 0,
                                transition: 'all 120ms ease',
                            }}
                            onMouseEnter={e => {
                                if (!isRouteExpanded) {
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isRouteExpanded) {
                                    e.currentTarget.style.background = hasStages ? 'rgba(110, 201, 126, 0.12)' : 'transparent';
                                    e.currentTarget.style.color = hasStages ? 'var(--accent-default)' : 'var(--text-dim)';
                                }
                            }}
                        >
                            <Route size={16} strokeWidth={2.2} />
                            {!isMobile && <span>Étapes</span>}
                            {hasStages && (
                                <span style={{
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: '10px',
                                    background: isRouteExpanded ? 'rgba(255,255,255,0.25)' : 'var(--accent-default)',
                                    color: '#ffffff',
                                    lineHeight: 1.2,
                                    fontFamily: 'var(--font-mono)',
                                }}>
                                    {state.stages.length}
                                </span>
                            )}
                        </button>

                        {/* ── DROPDOWN RESULTS ── */}
                        {showResults && (
                            <div style={{
                                position: 'absolute',
                                top: '40px',
                                left: 0,
                                right: 0,
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                borderTop: 'none',
                                borderRadius: '0 0 14px 14px',
                                boxShadow: 'var(--shadow-lg)',
                                maxHeight: '220px',
                                overflowY: 'auto',
                                zIndex: 1200,
                                padding: '4px',
                            }}>
                                {results.map((r, i) => (
                                    <div
                                        key={i}
                                        onClick={() => selectResult(r)}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        style={{
                                            padding: '7px 10px',
                                            cursor: 'pointer',
                                            fontSize: '11.5px',
                                            color: 'var(--text-primary)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            gap: '8px',
                                            alignItems: 'flex-start',
                                            transition: 'background 100ms ease',
                                        }}
                                    >
                                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--accent-default)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                                            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {r.label}
                                            {r.postcode && <span style={{ color: 'var(--text-dim)', marginLeft: '6px', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>{r.postcode}</span>}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── SATELLITE + GEOLOCATE PILL ── */}
                    <div style={toolbarStyle}>
                        {/* Satellite */}
                        <button
                            type="button"
                            onClick={handleSatellite}
                            style={tbBtnStyle(isSatellite)}
                            title={isSatellite ? 'Vue carte topographique' : 'Vue satellite'}
                            onMouseEnter={e => {
                                if (!isSatellite) {
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isSatellite) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-dim)';
                                }
                            }}
                        >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z" />
                                <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845" />
                            </svg>
                        </button>

                        <div style={{ width: '1px', height: '22px', background: 'var(--border-subtle)', margin: '0 2px' }} />

                        {/* Geolocate */}
                        <button
                            type="button"
                            onClick={handleGeolocate}
                            style={{ ...tbBtnStyle(geoState === 'done'), ...(geoState === 'loading' ? { opacity: 0.7 } : {}) }}
                            title="Me localiser"
                            onMouseEnter={e => {
                                if (geoState !== 'done') {
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (geoState !== 'done') {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-dim)';
                                }
                            }}
                        >
                            {geoIcon()}
                        </button>
                    </div>
                </div>

                {/* ── EXPANDED MODULAR ROUTE PANEL (MAPS STYLE) ── */}
                {isRouteExpanded && (
                    <div style={{
                        pointerEvents: 'all',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        boxShadow: 'var(--shadow-lg)',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        width: isMobile ? '100%' : '380px',
                        maxHeight: isMobile ? 'calc(100dvh - 160px)' : '520px',
                        animation: 'modularCardIn 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                        {/* Header with Title, Stats & Close */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: 'rgba(255, 255, 255, 0.02)',
                            flexShrink: 0,
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: 'rgba(110, 201, 126, 0.14)',
                                    color: 'var(--accent-default)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <Route size={16} strokeWidth={2.2} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Itinéraire & Étapes
                                    </div>
                                    <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                                        {hasStages
                                            ? `${state.stages.length} étape${state.stages.length > 1 ? 's' : ''}${totalDistanceKm ? ` • ${totalDistanceKm} km` : ''}`
                                            : 'Aucune étape définie'}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsRouteExpanded(false)}
                                title="Replier le panneau d'itinéraire"
                                style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: 'transparent',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-dim)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 100ms ease',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = 'var(--bg-hover)';
                                    e.currentTarget.style.color = 'var(--text-primary)';
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = 'var(--text-dim)';
                                }}
                            >
                                <ChevronUp size={16} />
                            </button>
                        </div>

                        {/* RoutePanel Embedded Body */}
                        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <RoutePanel embedded={true} onClose={() => setIsRouteExpanded(false)} />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

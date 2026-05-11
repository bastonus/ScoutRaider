import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search } from 'lucide-react';
import { mapRef } from './MapComponent';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { MAP_LAYERS } from '../../logic/MapConfig';

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
        color: '#6ec97e',
        fillColor: '#6ec97e',
        fillOpacity: 0.35,
        weight: 2.5,
    }).addTo(map);
    map.flyTo([lat, lon], 15, { duration: 1 });
}

// ── Component ──────────────────────────────────────────────────────────────────
type GeoState = 'idle' | 'loading' | 'done' | 'failed';

interface FloatingSearchProps {
    isSplitMode?: boolean;
}

export default function FloatingSearch({ isSplitMode = false }: FloatingSearchProps) {
    const { state, dispatch } = useApp();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isSatellite, setIsSatellite] = useState(false);
    const [geoState, setGeoState] = useState<GeoState>('idle');

    useEffect(() => {
        const layer = MAP_LAYERS[state.active_ign_layer || 'PLAN.IGN'];
        const isSat = layer?.isSatellite || false;
        setIsSatellite(isSat);
        
        // Save current layer as last used for its type
        if (isSat) {
            localStorage.setItem('lastSatLayerId', state.active_ign_layer);
        } else {
            localStorage.setItem('lastPlanLayerId', state.active_ign_layer);
        }
    }, [state.active_ign_layer]);

    const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
    const containerRef = useRef<HTMLDivElement>(null);

    // ── Satellite toggle ────────────────────────────────────────────────────────
    const handleSatellite = () => {
        const layer = MAP_LAYERS[state.active_ign_layer || 'PLAN.IGN'];
        const isSat = layer?.isSatellite || false;
        
        if (isSat) {
            // Switch to last plan
            const lastPlan = localStorage.getItem('lastPlanLayerId') || 'PLAN.IGN';
            dispatch({ type: 'SET_IGN_LAYER', layer: lastPlan });
        } else {
            // Switch to last sat
            const lastSat = localStorage.getItem('lastSatLayerId') || 'SAT.IGN';
            dispatch({ type: 'SET_IGN_LAYER', layer: lastSat });
        }
    };

    // ── Geolocation ─────────────────────────────────────────────────────────────
    const handleGeolocate = useCallback(() => {
        if (geoState === 'loading') return;
        setGeoState('loading');
        if (!navigator.geolocation) { setGeoState('failed'); setTimeout(() => setGeoState('idle'), 3000); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                placeGeoMarker(pos.coords.latitude, pos.coords.longitude);
                setGeoState('done');
                setTimeout(() => setGeoState('idle'), 2000);
            },
            () => {
                setGeoState('failed');
                setTimeout(() => setGeoState('idle'), 3000);
            },
            { timeout: 8000 }
        );
    }, [geoState]);

    // ── Address search ──────────────────────────────────────────────────────────
    useEffect(() => {
        clearTimeout(searchTimeout.current);
        if (query.length < 3) { setResults([]); setShowResults(false); return; }
        searchTimeout.current = setTimeout(async () => {
            const r = await searchIGN(query);
            setResults(r);
            setShowResults(r.length > 0);
        }, 320);
        return () => clearTimeout(searchTimeout.current);
    }, [query]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectResult = (r: SearchResult) => {
        mapRef.current?.flyTo([r.lat, r.lon], 16, { duration: 0.8 });
        setQuery(r.label);
        setShowResults(false);
    };

    // ── Geo button icon ─────────────────────────────────────────────────────────
    const geoIcon = () => {
        if (geoState === 'loading') {
            return (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite', transformOrigin: 'center' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            );
        }
        if (geoState === 'failed') {
            return (
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19v3" /><path d="M12 2v3" />
                    <path d="M18.89 13.24a7 7 0 0 0-8.13-8.13" />
                    <path d="M19 12h3" /><path d="M2 12h3" />
                    <path d="m2 2 20 20" />
                    <path d="M7.05 7.05a7 7 0 0 0 9.9 9.9" />
                </svg>
            );
        }
        return (
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        display: 'flex', alignItems: 'center', gap: '2px', padding: '3px', height: '38px',
        background: 'rgba(14, 22, 17, 0.92)', backdropFilter: 'blur(14px) saturate(1.4)',
        border: '1px solid rgba(110, 201, 126, 0.08)', borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)', pointerEvents: 'all',
    };

    const tbBtnStyle = (active = false): React.CSSProperties => ({
        width: '32px', height: '32px', border: 'none',
        background: active ? 'var(--accent-default)' : 'transparent',
        borderRadius: '9px', cursor: 'pointer',
        color: active ? '#0a0f0c' : geoState === 'failed' ? '#ef4444' : 'var(--text-dim)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
    });

    return (
        <div ref={containerRef} id="top-left-container" style={{
            position: 'absolute', top: '16px', left: isSplitMode ? '16px' : '88px',
            zIndex: 1100, display: 'flex', gap: '12px', pointerEvents: 'none',
            alignItems: 'flex-start',
            transition: 'left 0.2s ease',
        }}>
            {/* ── SEARCH BAR ── */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: '0',
                pointerEvents: 'all', position: 'relative',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '0 12px', height: '38px',
                    background: 'rgba(14, 22, 17, 0.92)', backdropFilter: 'blur(14px) saturate(1.4)',
                    border: '1px solid rgba(110, 201, 126, 0.08)',
                    borderRadius: showResults ? '12px 12px 0 0' : '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
                }}>
                    <Search size={16} color="var(--text-dim)" strokeWidth={2} />
                    <input
                        type="text"
                        placeholder="Rechercher un lieu..."
                        style={{
                            background: 'transparent', border: 'none', outline: 'none',
                            color: 'var(--text-primary)', fontSize: '13px', width: '200px',
                        }}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => results.length > 0 && setShowResults(true)}
                    />
                    {query && (
                        <button type="button" onClick={() => { setQuery(''); setShowResults(false); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '0', lineHeight: 1, fontSize: '14px' }}>
                            ×
                        </button>
                    )}
                </div>

                {/* ── DROPDOWN RESULTS ── */}
                {showResults && (
                    <div style={{
                        position: 'absolute', top: '38px', left: 0, right: 0,
                        background: 'rgba(14, 22, 17, 0.97)', backdropFilter: 'blur(14px)',
                        border: '1px solid rgba(110, 201, 126, 0.08)', borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        maxHeight: '200px', overflowY: 'auto', zIndex: 1200,
                    }}>
                        {results.map((r, i) => (
                            <div
                                key={i}
                                onClick={() => selectResult(r)}
                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(110, 201, 126, 0.12)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                style={{
                                    padding: '8px 12px', cursor: 'pointer', fontSize: '12px',
                                    color: 'var(--text-primary)', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                                    transition: 'background 0.1s',
                                }}
                            >
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="var(--accent-default)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                                    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                                </svg>
                                <span style={{ flex: 1 }}>
                                    {r.label}
                                    {r.postcode && <span style={{ color: 'var(--text-dim)', marginLeft: '6px' }}>{r.postcode}</span>}
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
                    title={isSatellite ? 'Vue plan' : 'Vue satellite'}
                >
                    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z" />
                        <path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845" />
                    </svg>
                </button>

                <div style={{ width: '1px', height: '24px', background: 'rgba(110, 201, 126, 0.12)', margin: '0 4px' }} />

                {/* Geolocate */}
                <button
                    type="button"
                    onClick={handleGeolocate}
                    style={{ ...tbBtnStyle(geoState === 'done'), ...(geoState === 'loading' ? { opacity: 0.7 } : {}) }}
                    title="Me localiser"
                >
                    {geoIcon()}
                </button>
            </div>
        </div>
    );
}

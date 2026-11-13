/**
 * CarnetElevationBlock.tsx — Visual Elevation Profile Block for the Carnet de Route.
 * Displays D+, D-, min/max altitudes, Naismith march duration, and responsive SVG graph.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Clock, Mountain, RefreshCw, EyeOff } from 'lucide-react';
import { useApp } from '../../AppContext';
import { ElevationService, ElevationProfileResult } from '../../logic/ElevationService';

export default function CarnetElevationBlock() {
    const { state, dispatch } = useApp();
    const [profile, setProfile] = useState<ElevationProfileResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Extract all route coordinates in [lon, lat] format
    const allCoordsLonLat = useMemo(() => {
        const coords: [number, number][] = [];
        if (state.routes && state.routes.length > 0) {
            for (const r of state.routes) {
                if (!r) continue;
                const geom = r.geojson?.geometry || r.geojson;
                const pts = geom?.coordinates || [];
                for (const pt of pts) {
                    if (Array.isArray(pt) && pt.length >= 2) {
                        coords.push([pt[0], pt[1]]);
                    }
                }
            }
        }
        if (coords.length < 2 && state.polygonal_steps && state.polygonal_steps.length > 0) {
            for (const seg of state.polygonal_steps) {
                for (const pt of (seg.coords || [])) {
                    if (Array.isArray(pt) && pt.length >= 2) {
                        const lon = pt[0] > 35 && pt[0] < 55 ? pt[1] : pt[0];
                        const lat = pt[0] > 35 && pt[0] < 55 ? pt[0] : pt[1];
                        coords.push([lon, lat]);
                    }
                }
            }
        }
        return coords;
    }, [state.routes, state.polygonal_steps]);

    const stagesForProfile = useMemo(() => {
        return (state.stages || []).map(s => ({
            label: s.label,
            coords: s.coords // [lat, lon]
        }));
    }, [state.stages]);

    useEffect(() => {
        let active = true;
        if (!allCoordsLonLat || allCoordsLonLat.length < 2) {
            setProfile(null);
            return;
        }

        const fetchElevation = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await ElevationService.computeProfile(allCoordsLonLat, 'lonlat', stagesForProfile);
                if (active) {
                    setProfile(res);
                }
            } catch (err: any) {
                if (active) setError(err.message || 'Erreur altimétrie');
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchElevation();
        return () => { active = false; };
    }, [allCoordsLonLat, stagesForProfile]);

    if (state.carnet_include_elevation_profile === false) {
        return null;
    }

    if (!allCoordsLonLat || allCoordsLonLat.length < 2) {
        return null;
    }

    const accentCyan = '#06b6d4';
    const accentGreen = '#5cbd6e';
    const isSolution = state.carnet_view === 'solution';

    return (
        <div style={{
            margin: '16px 0 28px 0',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)',
            transition: 'border-color 0.2s',
        }}>
            {/* ── Header bar ───────────────────────────────────────────── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 18px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-dark)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '24px', height: '24px', borderRadius: 'var(--radius-xs)',
                        background: 'rgba(6, 182, 212, 0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: accentCyan
                    }}>
                        <Mountain size={14} />
                    </div>
                    <div>
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: accentCyan }}>
                            PROFIL ALTIMÉTRIQUE & TOPOGRAPHIE DU RAID
                        </span>
                        <span style={{ marginLeft: '8px', fontSize: '10px', color: 'var(--text-dim)' }}>
                            (IGN RGE Alti)
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: accentCyan }}>
                            <RefreshCw size={12} className="spin" />
                            <span>Calcul du relief...</span>
                        </div>
                    )}
                    <button
                        onClick={() => dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' })}
                        title="Masquer le profil altimétrique"
                        style={{
                            background: 'transparent', border: 'none',
                            color: 'var(--text-dim)', cursor: 'pointer',
                            padding: '4px', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center',
                            transition: 'color 0.15s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--semantic-danger)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                    >
                        <EyeOff size={14} />
                    </button>
                </div>
            </div>

            {/* ── Content area ─────────────────────────────────────────── */}
            <div style={{ padding: '16px 18px' }}>
                {error ? (
                    <div style={{ color: 'var(--semantic-danger)', fontSize: '12px', padding: '8px 0' }}>
                        ⚠️ Impossible de charger les données altimétriques : {error}
                    </div>
                ) : profile ? (
                    <div>
                        {/* Metrics summary badges */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '10px',
                            marginBottom: '16px'
                        }}>
                            {/* D+ Ascent */}
                            <div style={{
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 12px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <ArrowUpRight size={16} color={accentGreen} />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Dénivelé +
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        +{profile.ascend_m} m
                                    </div>
                                </div>
                            </div>

                            {/* D- Descent */}
                            <div style={{
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 12px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <ArrowDownRight size={16} color="#38bdf8" />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Dénivelé -
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        -{profile.descend_m} m
                                    </div>
                                </div>
                            </div>

                            {/* Altitude Range */}
                            <div style={{
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 12px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <Mountain size={16} color="#fbbf24" />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Alt. Min / Max
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        {profile.min_alt_m}m / {profile.max_alt_m}m
                                    </div>
                                </div>
                            </div>

                            {/* Estimated March Duration */}
                            <div style={{
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 12px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <Clock size={16} color="#c084fc" />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Temps scout estimé
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        {Math.floor(profile.estimated_duration_min / 60)}h {String(profile.estimated_duration_min % 60).padStart(2, '0')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive SVG Profile */}
                        <div
                            style={{
                                width: '100%',
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '12px 14px 6px 14px',
                            }}
                            dangerouslySetInnerHTML={{
                                __html: ElevationService.generateSvg(profile, {
                                    width: 760,
                                    height: 160,
                                    accentColor: isSolution ? '#f87171' : accentCyan,
                                    textColor: '#94a3b8',
                                    isDarkTheme: true
                                })
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-dim)', fontSize: '12px' }}>
                        Chargement de l'altimétrie IGN en cours...
                    </div>
                )}
            </div>
        </div>
    );
}

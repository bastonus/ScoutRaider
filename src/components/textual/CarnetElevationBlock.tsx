/**
 * CarnetElevationBlock.tsx — Visual Elevation Profile Block for the Carnet de Route.
 * Displays D+, D-, min/max altitudes, Naismith march duration, and responsive SVG graph.
 *
 * Intégré directement dans le flux du document SANS contours ni fonds isolants,
 * avec un switch discret dans la marge pour l'inclure ou le griser.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Mountain, ArrowUpRight, ArrowDownRight, Clock, RefreshCw } from 'lucide-react';
import { useCarnet, useRoutes } from '../../hooks';
import { ElevationService, ElevationProfileResult } from '../../logic/ElevationService';

export default function CarnetElevationBlock() {
    const { carnetIncludeElevationProfile, carnetView, dispatch } = useCarnet();
    const { routes, polygonalSteps, stages } = useRoutes();
    const [profile, setProfile] = useState<ElevationProfileResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isIncluded = carnetIncludeElevationProfile !== false;

    // Extract all route coordinates in [lon, lat] format
    const allCoordsLonLat = useMemo(() => {
        const coords: [number, number][] = [];
        if (routes && routes.length > 0) {
            for (const r of routes) {
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
        if (coords.length < 2 && polygonalSteps && polygonalSteps.length > 0) {
            for (const seg of polygonalSteps) {
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
    }, [routes, polygonalSteps]);

    const stagesForProfile = useMemo(() => {
        return (stages || []).map(s => ({
            label: s.label,
            coords: s.coords // [lat, lon]
        }));
    }, [stages]);

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

    if (!allCoordsLonLat || allCoordsLonLat.length < 2) {
        return null;
    }

    const accentCyan = '#06b6d4';
    const accentGreen = '#5cbd6e';
    const isSolution = carnetView === 'solution';

    return (
        <div style={{
            margin: '8px 0 28px 0',
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
            boxSizing: 'border-box',
            width: '100%',
        }}>
            {/* ── Contrôles discrets dans la marge (switch & chargement) sans stroke ni titre ── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '2px 0 6px 0',
                gap: '12px',
                flexWrap: 'wrap',
                marginBottom: '10px'
            }}>
                {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: accentCyan }}>
                        <RefreshCw size={12} className="spin" />
                        <span style={{ fontSize: '10.5px' }}>Calcul altimétrie...</span>
                    </div>
                )}

                {/* Switch discret */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={isIncluded}
                    onClick={() => dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' })}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 0',
                        userSelect: 'none'
                    }}
                    title={isIncluded ? "Masquer le profil altimétrique" : "Afficher le profil altimétrique"}
                >
                    <div style={{
                        width: '30px',
                        height: '16px',
                        borderRadius: '8px',
                        background: isIncluded ? 'var(--accent-default)' : 'var(--bg-hover)',
                        border: 'none',
                        position: 'relative',
                        transition: 'all 150ms ease',
                        flexShrink: 0
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '2px',
                            left: isIncluded ? '16px' : '2px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            background: isIncluded ? '#ffffff' : 'var(--text-dim)',
                            transition: 'all 150ms ease',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }} />
                    </div>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap'
                    }}>
                        Profil altimétrique
                    </span>
                </button>
            </div>

            {/* ── Contenu altimétrique sans fond isolant ni strokes ── */}
            <div style={{
                opacity: isIncluded ? 1 : 0.35,
                filter: isIncluded ? 'none' : 'grayscale(0.95)',
                transition: 'all 200ms ease'
            }}>
                {error ? (
                    <div style={{ color: 'var(--semantic-danger)', fontSize: '12px', padding: '6px 0' }}>
                        ⚠️ Impossible de charger les données altimétriques : {error}
                    </div>
                ) : profile ? (
                    <div>
                        {/* Metrics summary badges */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                            gap: '8px',
                            marginBottom: '12px'
                        }}>
                            {/* D+ Ascent */}
                            <div style={{
                                background: 'var(--bg-hover)',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                padding: '6px 10px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <ArrowUpRight size={15} color={accentGreen} />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Dénivelé +
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        +{profile.ascend_m} m
                                    </div>
                                </div>
                            </div>

                            {/* D- Descent */}
                            <div style={{
                                background: 'var(--bg-hover)',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                padding: '6px 10px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <ArrowDownRight size={15} color="#38bdf8" />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Dénivelé -
                                    </div>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        -{profile.descend_m} m
                                    </div>
                                </div>
                            </div>

                            {/* Altitude Range */}
                            <div style={{
                                background: 'var(--bg-hover)',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                padding: '6px 10px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <Mountain size={15} color="#fbbf24" />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Alt. Min / Max
                                    </div>
                                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        {profile.min_alt_m}m / {profile.max_alt_m}m
                                    </div>
                                </div>
                            </div>

                            {/* Estimated March Duration */}
                            <div style={{
                                background: 'var(--bg-hover)',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                padding: '6px 10px',
                                display: 'flex', alignItems: 'center', gap: '8px'
                            }}>
                                <Clock size={15} color="#c084fc" />
                                <div>
                                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                                        Temps scout
                                    </div>
                                    <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                                        {Math.floor(profile.estimated_duration_min / 60)}h {String(profile.estimated_duration_min % 60).padStart(2, '0')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Interactive SVG Profile */}
                        <div
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                padding: '4px 0',
                                overflowX: 'auto',
                                WebkitOverflowScrolling: 'touch',
                                boxSizing: 'border-box'
                            }}
                            dangerouslySetInnerHTML={{
                                __html: ElevationService.generateSvg(profile, {
                                    width: 760,
                                    height: 150,
                                    accentColor: isSolution ? '#f87171' : accentCyan,
                                    textColor: '#94a3b8',
                                    isDarkTheme: true
                                })
                            }}
                        />
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-dim)', fontSize: '12px' }}>
                        Chargement de l'altimétrie IGN en cours...
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * CarnetElevationBlock.tsx — Bloc de profil altimétrique épuré façon Notion.
 * Masqué par défaut ; activable depuis la barre d'actions discrète du titre.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { Mountain, RefreshCw, X } from 'lucide-react';
import { useCarnet, useRoutes } from '../../hooks';
import { ElevationService, ElevationProfileResult } from '../../logic/ElevationService';

export default function CarnetElevationBlock() {
    const { carnetIncludeElevationProfile, carnetView, dispatch } = useCarnet();
    const { routes, polygonalSteps, stages } = useRoutes();
    const [profile, setProfile] = useState<ElevationProfileResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hovered, setHovered] = useState(false);

    const isIncluded = carnetIncludeElevationProfile === true;

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
            coords: s.coords
        }));
    }, [stages]);

    useEffect(() => {
        let active = true;
        if (!isIncluded || !allCoordsLonLat || allCoordsLonLat.length < 2) {
            return;
        }

        const fetchElevation = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await ElevationService.computeProfile(allCoordsLonLat, 'lonlat', stagesForProfile);
                if (active) setProfile(res);
            } catch (err: any) {
                if (active) setError(err.message || 'Erreur altimétrie');
            } finally {
                if (active) setLoading(false);
            }
        };

        fetchElevation();
        return () => { active = false; };
    }, [isIncluded, allCoordsLonLat, stagesForProfile]);

    // Masqué par défaut ou si aucun tracé suffisant
    if (!isIncluded || !allCoordsLonLat || allCoordsLonLat.length < 2) {
        return null;
    }

    const accentColor = carnetView === 'solution' ? '#f87171' : '#60a5fa';

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                margin: '4px 0 20px 0',
                padding: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                boxSizing: 'border-box',
                width: '100%',
                position: 'relative',
            }}
        >
            {/* En-tête sobre : titre + métriques en ligne + bouton masquer au survol */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '10px',
                flexWrap: 'wrap',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Mountain size={14} color="var(--text-dim)" style={{ flexShrink: 0 }} />
                    <span style={{
                        fontSize: '12.5px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                    }}>
                        Profil altimétrique
                    </span>
                    {loading && <RefreshCw size={12} className="spin" color="var(--text-dim)" />}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {profile && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontVariantNumeric: 'tabular-nums',
                            color: 'var(--text-secondary)',
                            flexWrap: 'wrap',
                        }}>
                            <span>D+ <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>+{profile.ascend_m} m</strong></span>
                            <span>D− <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>−{profile.descend_m} m</strong></span>
                            <span>{profile.min_alt_m}–{profile.max_alt_m} m</span>
                            <span>{Math.floor(profile.estimated_duration_min / 60)}h{String(profile.estimated_duration_min % 60).padStart(2, '0')}</span>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' })}
                        title="Masquer le profil altimétrique"
                        aria-label="Masquer le profil altimétrique"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            borderRadius: '5px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            opacity: hovered ? 1 : 0,
                            transition: 'opacity 120ms ease, background 100ms ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                    >
                        <X size={13} />
                    </button>
                </div>
            </div>

            {error ? (
                <div style={{ color: 'var(--semantic-danger)', fontSize: '12px', padding: '4px 0' }}>
                    Impossible de charger les données altimétriques : {error}
                </div>
            ) : profile ? (
                <div
                    style={{
                        width: '100%',
                        overflowX: 'auto',
                        WebkitOverflowScrolling: 'touch',
                        boxSizing: 'border-box',
                    }}
                    dangerouslySetInnerHTML={{
                        __html: ElevationService.generateSvg(profile, {
                            width: 720,
                            height: 140,
                            accentColor,
                            textColor: '#94a3b8',
                            isDarkTheme: true,
                        })
                    }}
                />
            ) : (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                    Chargement de l'altimétrie…
                </div>
            )}
        </div>
    );
}

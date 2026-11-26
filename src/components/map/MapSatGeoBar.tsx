/**
 * MapSatGeoBar — Satellite toggle + Geolocate pill.
 *
 * Rendered in the map zone when FloatingSearch is docked (column open),
 * so the controls are always visible above the map regardless of dock state.
 */
import React, { useState, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { mapRef } from './MapComponent';
import { useUI } from '../../hooks';
import { MAP_LAYERS } from '../../logic/MapConfig';

type GeoState = 'idle' | 'loading' | 'done' | 'failed';

let geoMarkerSat: L.CircleMarker | null = null;

function placeMarker(lat: number, lon: number) {
    const map = mapRef.current;
    if (!map) return;
    if (geoMarkerSat) map.removeLayer(geoMarkerSat);
    geoMarkerSat = L.circleMarker([lat, lon], {
        radius: 8,
        color: 'var(--accent-default)',
        fillColor: 'var(--accent-default)',
        fillOpacity: 0.35,
        weight: 2.5,
    }).addTo(map);
    map.flyTo([lat, lon], 15, { duration: 1 });
}

export default function MapSatGeoBar({ style }: { style?: React.CSSProperties }) {
    const { activeIgnLayer, dispatch } = useUI();
    const [isSatellite, setIsSatellite] = useState(false);
    const [geoState, setGeoState] = useState<GeoState>('idle');

    useEffect(() => {
        const layer = MAP_LAYERS[activeIgnLayer || 'PLAN.IGN'];
        setIsSatellite(layer?.isSatellite || false);
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
            pos => {
                placeMarker(pos.coords.latitude, pos.coords.longitude);
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

    const tbBtnStyle = (active = false): React.CSSProperties => ({
        width: '32px',
        height: '32px',
        border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
        background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
        borderRadius: '10px',
        cursor: 'pointer',
        color: active
            ? 'var(--text-primary)'
            : geoState === 'failed'
              ? 'var(--semantic-danger)'
              : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 100ms ease',
    });

    const geoIcon = () => {
        if (geoState === 'loading') {
            return (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="spin" style={{ transformOrigin: 'center' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
            );
        }
        if (geoState === 'failed') {
            return (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
                    stroke="var(--semantic-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19v3" /><path d="M12 2v3" />
                    <path d="M18.89 13.24a7 7 0 0 0-8.13-8.13" />
                    <path d="M19 12h3" /><path d="M2 12h3" />
                    <path d="m2 2 20 20" />
                    <path d="M7.05 7.05a7 7 0 0 0 9.9 9.9" />
                </svg>
            );
        }
        return (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" x2="5" y1="12" y2="12" />
                <line x1="19" x2="22" y1="12" y2="12" />
                <line x1="12" x2="12" y1="2" y2="5" />
                <line x1="12" x2="12" y1="19" y2="22" />
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="3" />
            </svg>
        );
    };

    return (
        <div
            style={{
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
                ...style,
            }}
        >
            <button
                type="button"
                onClick={handleSatellite}
                style={tbBtnStyle(isSatellite)}
                title={isSatellite ? 'Vue carte topographique' : 'Vue satellite'}
                aria-label={isSatellite ? 'Vue carte topographique' : 'Vue satellite'}
            >
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        </div>
    );
}

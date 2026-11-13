/**
 * ElevationProfileBar.tsx — Retractable bottom bar showing an interactive elevation profile
 * with live scrubbing synced to a Leaflet cursor on the map (Komoot / Strava UX).
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mountain, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight, Clock, X } from 'lucide-react';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { ElevationService, ElevationProfileResult, ElevationPoint } from '../../logic/ElevationService';
import { mapRef } from './MapComponent';

export default function ElevationProfileBar() {
    const { state } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [profile, setProfile] = useState<ElevationProfileResult | null>(null);
    const [hoverPoint, setHoverPoint] = useState<ElevationPoint | null>(null);
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

    const scrubMarkerRef = useRef<L.CircleMarker | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

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
        return coords;
    }, [state.routes]);

    const stagesForProfile = useMemo(() => {
        return (state.stages || []).map(s => ({
            label: s.label,
            coords: s.coords
        }));
    }, [state.stages]);

    // Fetch / compute profile when route changes
    useEffect(() => {
        let active = true;
        if (!allCoordsLonLat || allCoordsLonLat.length < 2) {
            setProfile(null);
            return;
        }

        ElevationService.computeProfile(allCoordsLonLat, 'lonlat', stagesForProfile)
            .then(res => {
                if (active) setProfile(res);
            })
            .catch(() => {
                if (active) setProfile(null);
            });

        return () => { active = false; };
    }, [allCoordsLonLat, stagesForProfile]);

    // Update map marker when scrub hover changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (hoverPoint) {
            if (!scrubMarkerRef.current) {
                scrubMarkerRef.current = L.circleMarker([hoverPoint.lat, hoverPoint.lon], {
                    radius: 7,
                    fillColor: '#06b6d4',
                    fillOpacity: 1,
                    color: '#ffffff',
                    weight: 2.5,
                    pane: 'markerPane'
                }).addTo(map);
            } else {
                scrubMarkerRef.current.setLatLng([hoverPoint.lat, hoverPoint.lon]);
            }
        } else {
            if (scrubMarkerRef.current) {
                scrubMarkerRef.current.remove();
                scrubMarkerRef.current = null;
            }
        }

        return () => {
            if (scrubMarkerRef.current) {
                scrubMarkerRef.current.remove();
                scrubMarkerRef.current = null;
            }
        };
    }, [hoverPoint]);

    if (!profile || profile.points.length < 2) {
        return null;
    }

    const accentCyan = '#06b6d4';
    const accentGreen = '#5cbd6e';

    // Interactive SVG mouse move
    const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const padLeft = 45;
        const padRight = 20;
        const plotW = rect.width - padLeft - padRight;

        const relX = Math.max(0, Math.min(plotW, mouseX - padLeft));
        const targetDist = (relX / plotW) * profile.total_dist_m;

        // Find closest point by distance
        let closest = profile.points[0];
        let minDiff = Infinity;
        for (const pt of profile.points) {
            const diff = Math.abs(pt.distance_m - targetDist);
            if (diff < minDiff) {
                minDiff = diff;
                closest = pt;
            }
        }

        setHoverPoint(closest);
        setHoverPos({ x: mouseX, y: e.clientY - rect.top });
    };

    const handleSvgMouseLeave = () => {
        setHoverPoint(null);
        setHoverPos(null);
    };

    // Compact pill button when closed
    if (!isOpen) {
        return (
            <div style={{
                position: 'absolute',
                bottom: '28px',
                left: '28px',
                zIndex: 1050,
                pointerEvents: 'all'
            }}>
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '7px 14px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '20px',
                        boxShadow: 'var(--shadow-lg)',
                        color: 'var(--text-primary)',
                        fontSize: '12px', fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                >
                    <Mountain size={14} color={accentCyan} />
                    <span>D+ <b>{profile.ascend_m}m</b></span>
                    <span style={{ color: 'var(--text-dim)' }}>·</span>
                    <span>D- <b>{profile.descend_m}m</b></span>
                    <ChevronUp size={14} color="var(--text-dim)" />
                </button>
            </div>
        );
    }

    // Expanded bottom drawer with interactive SVG
    return (
        <div style={{
            position: 'absolute',
            bottom: '12px',
            left: '20px',
            right: '20px',
            zIndex: 1050,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-lg)',
            padding: '12px 18px 8px 18px',
            display: 'flex', flexDirection: 'column', gap: '6px',
            pointerEvents: 'all',
            animation: 'fadeInUp 0.15s ease-out'
        }}>
            {/* Header bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: accentCyan, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <Mountain size={14} />
                        <span>Profil Altimétrique</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-default)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <ArrowUpRight size={13} color={accentGreen} />
                            <b>+{profile.ascend_m} m</b>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <ArrowDownRight size={13} color="#38bdf8" />
                            <b>-{profile.descend_m} m</b>
                        </span>
                        <span style={{ color: 'var(--text-dim)' }}>
                            Alt: <b>{profile.min_alt_m}m</b> – <b>{profile.max_alt_m}m</b>
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#c084fc' }}>
                            <Clock size={12} />
                            <span>{Math.floor(profile.estimated_duration_min / 60)}h{String(profile.estimated_duration_min % 60).padStart(2, '0')}</span>
                        </span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={() => setIsOpen(false)}
                        title="Replier le profil"
                        style={{
                            background: 'transparent', border: 'none',
                            color: 'var(--text-dim)', cursor: 'pointer',
                            padding: '3px', borderRadius: '4px', display: 'flex', alignItems: 'center',
                            transition: 'color 0.15s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-dim)')}
                    >
                        <ChevronDown size={16} />
                    </button>
                </div>
            </div>

            {/* Interactive SVG Canvas */}
            <div style={{ position: 'relative', width: '100%', height: '120px', cursor: 'crosshair' }}>
                <svg
                    ref={svgRef}
                    onMouseMove={handleSvgMouseMove}
                    onMouseLeave={handleSvgMouseLeave}
                    viewBox="0 0 760 120"
                    preserveAspectRatio="none"
                    style={{ width: '100%', height: '100%', overflow: 'visible' }}
                    dangerouslySetInnerHTML={{
                        __html: ElevationService.generateSvg(profile, {
                            width: 760,
                            height: 120,
                            accentColor: accentCyan,
                            textColor: '#94a3b8',
                            isDarkTheme: true
                        })
                    }}
                />

                {/* Live hover scrubber vertical line & tooltip */}
                {hoverPoint && hoverPos && (
                    <div style={{
                        position: 'absolute',
                        left: `${hoverPos.x}px`,
                        top: 0,
                        bottom: 0,
                        width: '1px',
                        background: '#ffffff',
                        pointerEvents: 'none',
                        boxShadow: '0 0 6px rgba(6, 182, 212, 0.8)'
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: '-26px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: `1px solid ${accentCyan}`,
                            borderRadius: '6px',
                            padding: '2px 6px',
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#ffffff',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            gap: '6px'
                        }}>
                            <span>{hoverPoint.altitude_m} m</span>
                            <span style={{ color: 'var(--text-dim)' }}>|</span>
                            <span>{(hoverPoint.distance_m / 1000).toFixed(2)} km</span>
                            {hoverPoint.slope_pct !== undefined && (
                                <span style={{ color: hoverPoint.slope_pct > 0 ? '#34d399' : '#94a3b8' }}>
                                    {hoverPoint.slope_pct > 0 ? `+${hoverPoint.slope_pct}%` : `${hoverPoint.slope_pct}%`}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

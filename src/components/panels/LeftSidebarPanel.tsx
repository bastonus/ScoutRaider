import React from 'react';
import { Route, MapPin, Paintbrush, Layers } from 'lucide-react';
import { useApp } from '../../AppContext';
import RoutePanel from './RoutePanel';
import { calculatePolygonArea, formatArea } from '../../logic/GeoUtils';

function PolygonIcon({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 20 8 17 18 7 18 4 8 12 2" />
        </svg>
    );
}

function InfoCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '8px',
            padding: '10px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px'
        }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                {label}
            </div>
            <div style={{ fontSize: '13px', color: '#fff', fontWeight: 600 }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{sub}</div>}
        </div>
    );
}

export default function LeftSidebarPanel() {
    const { state } = useApp();
    const selectedId = state.selected_layer_id;

    const itineraries = state.itineraries || [];
    const areas = state.area_annotations || [];
    const points = state.point_annotations || [];
    const draws = (state as any).draw_annotations || [];

    const selectedItin = itineraries.find(i => i.id === selectedId);
    const selectedArea = areas.find(a => a.id === selectedId);
    const selectedPoint = points.find(p => p.id === selectedId);
    const selectedDraw = draws.find((d: any) => d.id === selectedId);

    // ── Header Data ─────────────────────────────────────────────────────────
    let title = 'Aucun calque sélectionné';
    let typeName = '';
    let color = 'var(--text-dim)';
    let Icon = <Layers size={14} />;

    if (selectedItin) {
        title = selectedItin.name;
        typeName = 'Itinéraire';
        color = selectedItin.color || '#2d8ceb';
        Icon = <Route size={14} />;
    } else if (selectedArea) {
        title = selectedArea.title;
        typeName = 'Zone';
        color = selectedArea.color || '#10b981';
        Icon = <PolygonIcon size={14} color={color} />;
    } else if (selectedPoint) {
        title = selectedPoint.title;
        typeName = 'Repère';
        color = selectedPoint.color || '#3b82f6';
        Icon = <MapPin size={14} />;
    } else if (selectedDraw) {
        title = selectedDraw.title;
        typeName = 'Dessin';
        color = selectedDraw.color || '#f59e0b';
        Icon = <Paintbrush size={14} />;
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            overflow: 'hidden', background: 'var(--bg-panel)',
            userSelect: 'none'
        }}>
            {/* ── Top Header: Always displays the title of the selected layer ── */}
            <div style={{
                padding: '12px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(0,0,0,0.22)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0
            }}>
                <div style={{
                    width: '10px', height: '10px', borderRadius: '3px',
                    background: color, flexShrink: 0
                }} />
                <span style={{ color, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    {Icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                        {title}
                    </div>
                </div>
                {typeName && (
                    <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                        borderRadius: '4px', background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'var(--text-dim)', textTransform: 'uppercase',
                        letterSpacing: '0.04em', flexShrink: 0
                    }}>
                        {typeName}
                    </span>
                )}
            </div>

            {/* ── Body: Content depending on selected layer type ── */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {selectedItin ? (
                    // Itinerary: full interactive route panel with stages & distances
                    <RoutePanel />
                ) : selectedArea ? (
                    // Area: sober informative view (surface, sommets, notes) — zero buttons/parameters
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <InfoCard
                            label="Superficie calculée"
                            value={selectedArea.formatted_area || (selectedArea.coords.length >= 3 ? formatArea(calculatePolygonArea(selectedArea.coords)) : 'En cours')}
                        />
                        <InfoCard
                            label="Sommets"
                            value={`${selectedArea.coords.length} sommet${selectedArea.coords.length > 1 ? 's' : ''}`}
                            sub={selectedArea.coords.length < 3 ? 'Zone non fermée' : 'Contour fermé'}
                        />
                        <InfoCard
                            label="Type de contour"
                            value={selectedArea.followRoads ? 'Suivi des sentiers (BRouter)' : 'Lignes droites'}
                        />
                        {selectedArea.text && (
                            <InfoCard
                                label="Notes / Description"
                                value={<span style={{ fontWeight: 400, fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>{selectedArea.text}</span>}
                            />
                        )}
                        <InfoCard
                            label="Visibilité"
                            value={selectedArea.visible ? 'Visible sur la carte' : 'Masquée'}
                        />
                    </div>
                ) : selectedPoint ? (
                    // Point: sober informative view (coordinates, notes) — zero buttons/parameters
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <InfoCard
                            label="Coordonnées GPS"
                            value={`${selectedPoint.coords[0].toFixed(5)}, ${selectedPoint.coords[1].toFixed(5)}`}
                        />
                        {selectedPoint.address && (
                            <InfoCard
                                label="Adresse / Lieu"
                                value={<span style={{ fontWeight: 500, fontSize: '12px', color: '#cbd5e1' }}>{selectedPoint.address}</span>}
                            />
                        )}
                        {selectedPoint.text && (
                            <InfoCard
                                label="Notes / Description"
                                value={<span style={{ fontWeight: 400, fontSize: '12px', lineHeight: 1.5, color: '#cbd5e1' }}>{selectedPoint.text}</span>}
                            />
                        )}
                        <InfoCard
                            label="Visibilité"
                            value={selectedPoint.visible ? 'Visible sur la carte' : 'Masqué'}
                        />
                    </div>
                ) : selectedDraw ? (
                    // Draw: sober informative view (strokes count, color) — zero buttons/parameters
                    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <InfoCard
                            label="Tracé libre"
                            value={`${selectedDraw.strokes?.length || 0} trait${(selectedDraw.strokes?.length || 0) > 1 ? 's' : ''}`}
                        />
                        <InfoCard
                            label="Épaisseur du trait"
                            value={`${selectedDraw.strokeWidth || 4} px`}
                        />
                        <InfoCard
                            label="Visibilité"
                            value={selectedDraw.visible ? 'Visible sur la carte' : 'Masqué'}
                        />
                    </div>
                ) : (
                    // No layer selected
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        padding: '32px 20px', textAlign: 'center',
                        color: 'var(--text-dim)', gap: '8px'
                    }}>
                        <Layers size={28} style={{ opacity: 0.25 }} />
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Aucun calque sélectionné
                        </div>
                        <p style={{ fontSize: '11px', lineHeight: 1.5, margin: 0, maxWidth: '200px' }}>
                            Sélectionnez un calque dans le panneau de droite ou cliquez dessus sur la carte.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

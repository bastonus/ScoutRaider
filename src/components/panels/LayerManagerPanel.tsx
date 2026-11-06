import React, { useState } from 'react';
import { Eye, EyeOff, Trash2, Route, MapPin, Maximize2, Trees, ChevronDown, ChevronRight, Edit2 } from 'lucide-react';
import { useApp } from '../../AppContext';
import { mapRef } from '../map/MapComponent';
import { calculatePolygonArea, formatArea, computeRoutedAreaBoundary } from '../../logic/GeoUtils';
import { PRESET_COLORS } from '../map/AnnotationModals';
import { Itinerary, PointAnnotation, AreaAnnotation } from '../../logic/types';

// ─── Polygon icon ───────────────────────────────────────────────────
function PolygonIcon({ color = 'currentColor', size = 13 }: { color?: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 20 8 17 18 7 18 4 8 12 2" />
        </svg>
    );
}

// ─── Layer row ───────────────────────────────────────────────────────
function LayerRow({
    icon, label, sublabel, color, visible, selected,
    onToggleVisible, onSelect, onDelete, children
}: {
    icon: React.ReactNode;
    label: string;
    sublabel?: string;
    color: string;
    visible: boolean;
    selected: boolean;
    onToggleVisible: () => void;
    onSelect: () => void;
    onDelete?: () => void;
    children?: React.ReactNode;
}) {
    return (
        <div>
            <div
                onClick={onSelect}
                style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '5px 8px 5px 10px',
                    background: selected ? 'rgba(45,140,235,0.14)' : 'transparent',
                    borderLeft: `2px solid ${selected ? '#2d8ceb' : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'transparent'; }}
            >
                {/* Eye toggle */}
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onToggleVisible(); }}
                    style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: visible ? color : 'rgba(255,255,255,0.2)', display: 'flex', flexShrink: 0 }}
                >
                    {visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>

                {/* Color dot */}
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: color, flexShrink: 0 }} />

                {/* Icon */}
                <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{icon}</span>

                {/* Label */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: selected ? '#fff' : 'var(--text-bright)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {label}
                    </div>
                    {sublabel && (
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '1px' }}>{sublabel}</div>
                    )}
                </div>

                {/* Delete */}
                {onDelete && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onDelete(); }}
                        style={{ background: 'transparent', border: 'none', padding: '2px', cursor: 'pointer', color: 'rgba(255,255,255,0.2)', display: 'flex', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                    >
                        <Trash2 size={12} />
                    </button>
                )}
            </div>

            {/* Expanded detail panel */}
            {selected && children && (
                <div style={{ padding: '8px 12px 10px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Section header ──────────────────────────────────────────────────
function SectionHeader({ label, count }: { label: string; count: number }) {
    return (
        <div style={{
            padding: '5px 10px 3px 10px',
            fontSize: '9px', fontWeight: 800, letterSpacing: '0.1em',
            textTransform: 'uppercase', color: 'var(--text-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
            <span>{label}</span>
            <span style={{ background: 'rgba(255,255,255,0.08)', padding: '0 4px', borderRadius: '3px' }}>{count}</span>
        </div>
    );
}

// ─── Main component ──────────────────────────────────────────────────
export default function LayerManagerPanel() {
    const { state, dispatch } = useApp();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [routingId, setRoutingId] = useState<string | null>(null);

    const itineraries = state.itineraries || [];
    const activeItinId = state.active_itinerary_id;
    const points = state.point_annotations || [];
    const areas = state.area_annotations || [];

    const flyTo = (coords: [number, number]) => {
        mapRef.current?.flyTo(coords, Math.max(mapRef.current.getZoom(), 15), { duration: 0.8 });
    };

    const fitBounds = (coords: [number, number][]) => {
        if (coords.length > 0) mapRef.current?.fitBounds(coords, { padding: [40, 40], maxZoom: 16 });
    };

    const handleFollowRoads = async (area: AreaAnnotation) => {
        const newFollow = !area.followRoads;
        if (!newFollow) {
            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { followRoads: false, routedCoords: undefined } });
            return;
        }
        setRoutingId(area.id);
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul du contour sur les sentiers...' });
        try {
            const routed = await computeRoutedAreaBoundary(area.coords, 'pedestrian');
            const m2 = calculatePolygonArea(routed);
            dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { followRoads: true, routedCoords: routed, area_m2: m2, formatted_area: formatArea(m2) } });
            dispatch({ type: 'ADD_NOTIFICATION', message: `Contour sur les sentiers (${formatArea(m2)})`, notifType: 'info' });
        } catch {
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Impossible de router les arêtes.', notifType: 'warning' });
        } finally {
            setRoutingId(null);
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    };

    const getItinKm = (itin: Itinerary) => {
        const routes = itin.id === activeItinId ? state.routes : (itin.routes || []);
        return routes.reduce((acc, r) => acc + (r?.distance_m || 0), 0) / 1000;
    };

    const toggleSelect = (id: string) => setSelectedId(prev => prev === id ? null : id);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)', userSelect: 'none', fontSize: '12px', color: 'var(--text-primary)' }}>

            {/* ── LAYER LIST (scrollable) ── */}
            <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* SECTION: Itinéraires */}
                {itineraries.length > 0 && (
                    <>
                        <SectionHeader label="Itinéraires" count={itineraries.length} />
                        {[...itineraries].reverse().map(itin => {
                            const isActive = itin.id === activeItinId;
                            const km = getItinKm(itin);
                            const stages = isActive ? state.stages.length : (itin.stages?.length || 0);
                            const isSelected = selectedId === itin.id;

                            return (
                                <LayerRow
                                    key={itin.id}
                                    icon={<Route size={12} />}
                                    label={itin.name}
                                    sublabel={`${km.toFixed(1)} km · ${stages} étape${stages !== 1 ? 's' : ''}`}
                                    color={itin.color}
                                    visible={itin.visible !== false}
                                    selected={isSelected}
                                    onToggleVisible={() => dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: itin.id })}
                                    onSelect={() => toggleSelect(itin.id)}
                                    onDelete={itineraries.length > 1 ? () => {
                                        if (window.confirm(`Supprimer "${itin.name}" ?`)) dispatch({ type: 'REMOVE_ITINERARY', id: itin.id });
                                    } : undefined}
                                >
                                    {/* Detail */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        {/* Rename */}
                                        <input type="text" value={itin.name}
                                            onChange={e => dispatch({ type: 'UPDATE_ITINERARY', id: itin.id, name: e.target.value })}
                                            placeholder="Nom de l'itinéraire..."
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', padding: '4px 7px', color: '#fff', fontSize: '11px', outline: 'none' }}
                                        />
                                        {/* Color */}
                                        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                            {PRESET_COLORS.map(c => (
                                                <div key={c.value} title={c.label}
                                                    onClick={() => dispatch({ type: 'UPDATE_ITINERARY', id: itin.id, color: c.value })}
                                                    style={{ width: '14px', height: '14px', borderRadius: '3px', background: c.value, cursor: 'pointer', boxShadow: itin.color === c.value ? '0 0 0 2px #fff' : 'none' }}
                                                />
                                            ))}
                                        </div>
                                        {/* Activate */}
                                        {!isActive && (
                                            <button type="button"
                                                onClick={() => dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id })}
                                                style={{ padding: '4px 10px', borderRadius: '5px', background: 'rgba(45,140,235,0.15)', border: '1px solid rgba(45,140,235,0.3)', color: '#60a5fa', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
                                                Activer pour édition
                                            </button>
                                        )}
                                        {isActive && (
                                            <span style={{ fontSize: '10px', color: '#60a5fa', fontWeight: 600 }}>✓ Itinéraire en cours d'édition</span>
                                        )}
                                    </div>
                                </LayerRow>
                            );
                        })}
                        <div style={{ height: '8px' }} />
                    </>
                )}

                {/* SECTION: Points */}
                {points.length > 0 && (
                    <>
                        <SectionHeader label="Points & Repères" count={points.length} />
                        {[...points].reverse().map(pt => {
                            const isSelected = selectedId === pt.id;
                            return (
                                <LayerRow
                                    key={pt.id}
                                    icon={<MapPin size={12} />}
                                    label={pt.title}
                                    sublabel={`${pt.coords[0].toFixed(4)}, ${pt.coords[1].toFixed(4)}`}
                                    color={pt.color}
                                    visible={pt.visible}
                                    selected={isSelected}
                                    onToggleVisible={() => dispatch({ type: 'TOGGLE_POINT_VISIBILITY', id: pt.id })}
                                    onSelect={() => toggleSelect(pt.id)}
                                    onDelete={() => dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: pt.id })}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        <input type="text" value={pt.title}
                                            onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { title: e.target.value } })}
                                            placeholder="Nom du repère..."
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', padding: '4px 7px', color: '#fff', fontSize: '11px', outline: 'none' }}
                                        />
                                        <textarea rows={2} value={pt.text || ''}
                                            onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { text: e.target.value } })}
                                            placeholder="Notes..."
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '4px 7px', color: '#cbd5e1', fontSize: '10px', outline: 'none', resize: 'vertical' }}
                                        />
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            {PRESET_COLORS.map(c => (
                                                <div key={c.value} title={c.label}
                                                    onClick={() => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { color: c.value } })}
                                                    style={{ width: '14px', height: '14px', borderRadius: '3px', background: c.value, cursor: 'pointer', boxShadow: pt.color === c.value ? '0 0 0 2px #fff' : 'none' }}
                                                />
                                            ))}
                                            <button type="button" onClick={() => flyTo(pt.coords)}
                                                style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                                                <Maximize2 size={11} /> Centrer
                                            </button>
                                        </div>
                                    </div>
                                </LayerRow>
                            );
                        })}
                        <div style={{ height: '8px' }} />
                    </>
                )}

                {/* SECTION: Zones */}
                {areas.length > 0 && (
                    <>
                        <SectionHeader label="Zones & Périmètres" count={areas.length} />
                        {[...areas].reverse().map(area => {
                            const isSelected = selectedId === area.id;
                            const isComplete = area.coords.length >= 3;
                            const surface = area.formatted_area || (isComplete ? formatArea(calculatePolygonArea(area.coords)) : '—');
                            const isRouting = routingId === area.id;

                            return (
                                <LayerRow
                                    key={area.id}
                                    icon={<PolygonIcon size={12} />}
                                    label={area.title}
                                    sublabel={isComplete ? surface : `${area.coords.length} sommet${area.coords.length > 1 ? 's' : ''} (en cours)`}
                                    color={area.color}
                                    visible={area.visible}
                                    selected={isSelected}
                                    onToggleVisible={() => dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: area.id })}
                                    onSelect={() => toggleSelect(area.id)}
                                    onDelete={() => dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id })}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                        {/* Name */}
                                        <input type="text" value={area.title}
                                            onChange={e => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { title: e.target.value } })}
                                            placeholder="Nom de la zone..."
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', padding: '4px 7px', color: '#fff', fontSize: '11px', outline: 'none' }}
                                        />
                                        {/* Notes */}
                                        <textarea rows={2} value={area.text || ''}
                                            onChange={e => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { text: e.target.value } })}
                                            placeholder="Consignes, règles de zone..."
                                            style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', padding: '4px 7px', color: '#cbd5e1', fontSize: '10px', outline: 'none', resize: 'vertical' }}
                                        />
                                        {/* Area stat + fit */}
                                        {isComplete && (
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#6ee7b7' }}>{surface}</span>
                                                <button type="button" onClick={() => fitBounds(area.coords)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
                                                    <Maximize2 size={11} /> Cadrer
                                                </button>
                                            </div>
                                        )}
                                        {/* BRouter follow roads */}
                                        {isComplete && (
                                            <button type="button" disabled={isRouting}
                                                onClick={() => handleFollowRoads(area)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                                                    padding: '5px', borderRadius: '5px',
                                                    background: area.followRoads ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.05)',
                                                    border: `1px solid ${area.followRoads ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                                                    color: area.followRoads ? '#6ee7b7' : 'var(--text-dim)',
                                                    fontSize: '10px', fontWeight: 600, cursor: isRouting ? 'wait' : 'pointer'
                                                }}>
                                                <Trees size={12} />
                                                {isRouting ? 'Calcul…' : (area.followRoads ? 'Sentiers actifs — cliquer pour désactiver' : 'Suivre les sentiers (BRouter)')}
                                            </button>
                                        )}
                                        {/* Colors */}
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            {PRESET_COLORS.map(c => (
                                                <div key={c.value} title={c.label}
                                                    onClick={() => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { color: c.value } })}
                                                    style={{ width: '14px', height: '14px', borderRadius: '3px', background: c.value, cursor: 'pointer', boxShadow: area.color === c.value ? '0 0 0 2px #fff' : 'none' }}
                                                />
                                            ))}
                                        </div>
                                        {/* Vertex list */}
                                        {area.coords.length > 0 && (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                                {area.coords.map((_, vIdx) => (
                                                    <span key={vIdx}
                                                        style={{ fontSize: '9px', background: 'rgba(255,255,255,0.07)', padding: '1px 5px', borderRadius: '3px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                        S{vIdx + 1}
                                                        {area.coords.length > 3 && (
                                                            <button type="button"
                                                                onClick={() => dispatch({ type: 'DELETE_AREA_VERTEX', areaId: area.id, vertexIdx: vIdx })}
                                                                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0, fontSize: '10px', lineHeight: 1 }}
                                                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
                                                            >×</button>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </LayerRow>
                            );
                        })}
                        <div style={{ height: '8px' }} />
                    </>
                )}

                {/* Empty state */}
                {itineraries.length === 0 && points.length === 0 && areas.length === 0 && (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '11px' }}>
                        Aucun calque.<br />
                        <span style={{ opacity: 0.6 }}>Utilisez les boutons ci-dessous pour créer.</span>
                    </div>
                )}
            </div>

            {/* ── BOTTOM TOOLBAR: Create new layer ── */}
            <div style={{
                borderTop: '1px solid rgba(255,255,255,0.08)',
                padding: '8px 10px',
                display: 'flex', gap: '6px',
                background: 'rgba(0,0,0,0.25)',
                flexShrink: 0
            }}>
                {/* + Itinéraire */}
                <button type="button"
                    onClick={() => {
                        dispatch({ type: 'ADD_ITINERARY' });
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouvel itinéraire créé.', notifType: 'info' });
                    }}
                    title="Créer un nouvel itinéraire"
                    style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                        padding: '7px 4px', borderRadius: '6px',
                        background: 'rgba(45,140,235,0.1)', border: '1px solid rgba(45,140,235,0.22)',
                        color: '#60a5fa', cursor: 'pointer', fontSize: '9px', fontWeight: 700
                    }}>
                    <Route size={15} />
                    Itinéraire
                </button>

                {/* + Point */}
                <button type="button"
                    onClick={() => {
                        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_point' });
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour placer un repère. Clic droit pour supprimer.', notifType: 'info' });
                    }}
                    title="Activer l'outil Point (cliquer sur la carte)"
                    style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                        padding: '7px 4px', borderRadius: '6px',
                        background: state.active_tool === 'annotate_point' ? '#3b82f6' : 'rgba(59,130,246,0.1)',
                        border: `1px solid ${state.active_tool === 'annotate_point' ? '#3b82f6' : 'rgba(59,130,246,0.22)'}`,
                        color: state.active_tool === 'annotate_point' ? '#fff' : '#60a5fa',
                        cursor: 'pointer', fontSize: '9px', fontWeight: 700
                    }}>
                    <MapPin size={15} />
                    Repère
                </button>

                {/* + Zone */}
                <button type="button"
                    onClick={() => {
                        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_area' });
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Cliquez sur la carte pour tracer les sommets. Double-cliquez ou cliquez "Terminer" pour valider.', notifType: 'info' });
                    }}
                    title="Activer l'outil Zone (tracer les sommets sur la carte)"
                    style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                        padding: '7px 4px', borderRadius: '6px',
                        background: state.active_tool === 'annotate_area' ? '#10b981' : 'rgba(16,185,129,0.1)',
                        border: `1px solid ${state.active_tool === 'annotate_area' ? '#10b981' : 'rgba(16,185,129,0.22)'}`,
                        color: state.active_tool === 'annotate_area' ? '#fff' : '#6ee7b7',
                        cursor: 'pointer', fontSize: '9px', fontWeight: 700
                    }}>
                    <PolygonIcon size={15} color={state.active_tool === 'annotate_area' ? '#fff' : '#6ee7b7'} />
                    Zone
                </button>
            </div>
        </div>
    );
}

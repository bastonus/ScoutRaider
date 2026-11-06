import React, { useState } from 'react';
import { 
    Layers, Plus, Eye, EyeOff, Copy, Trash2, Edit3, 
    MapPin, ChevronDown, ChevronRight, Check, Route,
    AlertTriangle, Shield, Compass, Navigation, Maximize2,
    Trees, Crosshair, Sparkles, FileText, CornerDownRight
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { mapRef } from '../map/MapComponent';
import { Itinerary, PointAnnotation, AreaAnnotation, AnnotationIcon } from '../../logic/types';
import { calculatePolygonArea, formatArea, computeRoutedAreaBoundary } from '../../logic/GeoUtils';
import { PRESET_COLORS } from '../map/AnnotationModals';

interface SectionProps {
    title: string;
    icon: React.ReactNode;
    count?: number;
    badge?: string;
    isOpen: boolean;
    onToggle: () => void;
    action?: React.ReactNode;
    children: React.ReactNode;
}

function AccordionSection({ title, icon, count, badge, isOpen, onToggle, action, children }: SectionProps) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            borderBottom: '1px solid rgba(110, 201, 126, 0.1)',
            background: isOpen ? 'rgba(0,0,0,0.1)' : 'transparent',
            transition: 'background 0.2s'
        }}>
            <div 
                onClick={onToggle}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px',
                    cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-primary)',
                    userSelect: 'none', transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    {isOpen ? <ChevronDown size={14} style={{ color: 'var(--accent-default)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />}
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {icon}
                        <span>{title}</span>
                    </span>
                    {count !== undefined && (
                        <span style={{
                            fontSize: '10px', color: 'var(--text-dim)',
                            background: 'rgba(255,255,255,0.06)', padding: '1px 5px',
                            borderRadius: '10px', fontWeight: 600
                        }}>
                            {count}
                        </span>
                    )}
                    {badge && (
                        <span style={{
                            fontSize: '9px', color: '#10b981',
                            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
                            padding: '1px 5px', borderRadius: '4px', fontWeight: 700
                        }}>
                            {badge}
                        </span>
                    )}
                </div>

                {action && (
                    <div onClick={e => e.stopPropagation()}>
                        {action}
                    </div>
                )}
            </div>

            {isOpen && (
                <div style={{ padding: '6px 12px 14px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

export default function LayerManagerPanel() {
    const { state, dispatch } = useApp();

    const [openItineraries, setOpenItineraries] = useState(true);
    const [openPoints, setOpenPoints] = useState(true);
    const [openAreas, setOpenAreas] = useState(true);
    const [openOverlays, setOpenOverlays] = useState(false);

    // Selected items for detail expanding
    const [editingItinId, setEditingItinId] = useState<string | null>(null);
    const [editingItinName, setEditingItinName] = useState('');
    const [colorPickerItinId, setColorPickerItinId] = useState<string | null>(null);

    const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
    const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
    const [routingAreaId, setRoutingAreaId] = useState<string | null>(null);

    const itineraries = state.itineraries || [];
    const activeItinId = state.active_itinerary_id;
    const points = state.point_annotations || [];
    const areas = state.area_annotations || [];

    const getItinDistanceKm = (itin: Itinerary) => {
        if (itin.id === activeItinId) {
            return state.routes.reduce((acc, r) => acc + (r?.distance_m || 0), 0) / 1000;
        }
        return (itin.routes || []).reduce((acc, r) => acc + (r?.distance_m || 0), 0) / 1000;
    };

    const flyToPoint = (coords: [number, number]) => {
        if (mapRef.current) {
            mapRef.current.flyTo(coords, Math.max(mapRef.current.getZoom(), 15), { duration: 0.8 });
        }
    };

    const fitToArea = (coords: [number, number][]) => {
        if (mapRef.current && coords.length > 0) {
            mapRef.current.fitBounds(coords, { padding: [40, 40], maxZoom: 16 });
        }
    };

    const handleCreateSecondRoute = () => {
        dispatch({
            type: 'ADD_ITINERARY',
            name: 'Itinéraire 2 (Bis / Variante)',
            color: '#f97316'
        });
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Itinéraire 2 créé et activé.', notifType: 'info' });
    };

    const handleDuplicateActive = () => {
        dispatch({
            type: 'ADD_ITINERARY',
            duplicateCurrent: true
        });
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Itinéraire dupliqué.', notifType: 'info' });
    };

    const handleSaveItinName = (id: string) => {
        if (editingItinName.trim()) {
            dispatch({ type: 'UPDATE_ITINERARY', id, name: editingItinName.trim() });
        }
        setEditingItinId(null);
    };

    // Toggle BRouter road/trail following for an area
    const handleToggleRoadFollow = async (area: AreaAnnotation) => {
        const newFollow = !area.followRoads;
        if (!newFollow) {
            dispatch({
                type: 'UPDATE_AREA_ANNOTATION',
                id: area.id,
                patch: { followRoads: false, routedCoords: undefined }
            });
            return;
        }

        setRoutingAreaId(area.id);
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Ajustement du contour sur les sentiers (BRouter)...' });

        try {
            const routed = await computeRoutedAreaBoundary(area.coords, 'pedestrian');
            const m2 = calculatePolygonArea(routed);
            dispatch({
                type: 'UPDATE_AREA_ANNOTATION',
                id: area.id,
                patch: {
                    followRoads: true,
                    routedCoords: routed,
                    area_m2: m2,
                    formatted_area: formatArea(m2)
                }
            });
            dispatch({ type: 'ADD_NOTIFICATION', message: `Arêtes ajustées sur les chemins (${formatArea(m2)})`, notifType: 'info' });
        } catch (e) {
            console.error('Failed to route area boundary:', e);
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Impossible de router toutes les arêtes.', notifType: 'warning' });
        } finally {
            setRoutingAreaId(null);
            dispatch({ type: 'SET_LOADING', isLoading: false });
        }
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            overflowY: 'auto', background: 'var(--bg-panel)', color: 'var(--text-primary)',
            fontSize: '12px', userSelect: 'none'
        }}>
            {/* Header / Subtitle Info Banner */}
            <div style={{
                padding: '8px 12px',
                background: 'rgba(110, 201, 126, 0.04)',
                borderBottom: '1px solid rgba(110, 201, 126, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                fontSize: '10px', color: 'var(--text-dim)'
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Layers size={13} style={{ color: 'var(--accent-default)' }} />
                    <span>Calques & Tracés du Raid</span>
                </span>
                <span style={{ color: 'var(--accent-default)', fontWeight: 600 }}>
                    Édition en temps réel
                </span>
            </div>

            {/* ─────────────────────────────────────────────────────────────
                ACCORDION 1: ITINÉRAIRES (MULTI-ROUTES)
            ───────────────────────────────────────────────────────────── */}
            <AccordionSection
                title="Itinéraires"
                icon={<Route size={13} style={{ color: '#2d8ceb' }} />}
                count={itineraries.length}
                isOpen={openItineraries}
                onToggle={() => setOpenItineraries(!openItineraries)}
                action={
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'ADD_ITINERARY' })}
                        title="Ajouter un nouvel itinéraire vierge"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            padding: '3px 8px', background: 'rgba(45, 140, 235, 0.14)',
                            border: '1px solid rgba(45, 140, 235, 0.3)', borderRadius: '6px',
                            color: '#60a5fa', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                            transition: 'all 0.15s'
                        }}
                    >
                        <Plus size={11} />
                        <span>Nouveau</span>
                    </button>
                }
            >
                {/* Promo / Quick CTA card if only 1 route */}
                {itineraries.length === 1 && (
                    <div style={{
                        padding: '10px 12px', borderRadius: '8px',
                        background: 'linear-gradient(135deg, rgba(45, 140, 235, 0.09) 0%, rgba(249, 115, 22, 0.09) 100%)',
                        border: '1px dashed rgba(110, 201, 126, 0.22)',
                        display: 'flex', flexDirection: 'column', gap: '7px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-bright)', fontWeight: 700 }}>
                                Deuxième itinéraire (Variante / Bis)
                            </span>
                            <span style={{ fontSize: '9px', color: '#f97316', fontWeight: 700, textTransform: 'uppercase' }}>
                                Multi-trace
                            </span>
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                            Tracez une variante, un plan d'échappatoire ou une alternative tout en gardant l'itinéraire principal affiché en repère sur la carte.
                        </div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                            <button
                                type="button"
                                onClick={handleCreateSecondRoute}
                                style={{
                                    flex: 1, padding: '6px 8px', borderRadius: '6px',
                                    background: 'rgba(249, 115, 22, 0.22)', border: '1px solid rgba(249, 115, 22, 0.45)',
                                    color: '#f97316', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                                }}
                            >
                                <Plus size={12} />
                                + 2e Itinéraire
                            </button>
                            <button
                                type="button"
                                onClick={handleDuplicateActive}
                                title="Copier les étapes actuelles pour créer une variante"
                                style={{
                                    padding: '6px 10px', borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                                    color: 'var(--text-bright)', fontSize: '10px', fontWeight: 600, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                <Copy size={12} />
                                Dupliquer
                            </button>
                        </div>
                    </div>
                )}

                {/* Itineraries List */}
                {itineraries.map(itin => {
                    const isActive = itin.id === activeItinId;
                    const distKm = getItinDistanceKm(itin);
                    const stageCount = isActive ? state.stages.length : (itin.stages?.length || 0);

                    return (
                        <div
                            key={itin.id}
                            style={{
                                padding: '8px 10px', borderRadius: '8px',
                                background: isActive ? 'rgba(45, 140, 235, 0.08)' : 'rgba(0,0,0,0.22)',
                                border: `1px solid ${isActive ? 'rgba(45, 140, 235, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                                display: 'flex', flexDirection: 'column', gap: '6px',
                                transition: 'all 0.15s'
                            }}
                        >
                            {/* Main row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Visibility eye */}
                                <button
                                    type="button"
                                    onClick={() => dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: itin.id })}
                                    title={itin.visible ? "Masquer sur la carte" : "Afficher sur la carte"}
                                    style={{
                                        background: 'transparent', border: 'none', padding: '2px',
                                        color: itin.visible ? itin.color : 'var(--text-dim)',
                                        cursor: 'pointer', display: 'flex', alignItems: 'center'
                                    }}
                                >
                                    {itin.visible ? <Eye size={14} /> : <EyeOff size={14} style={{ opacity: 0.4 }} />}
                                </button>

                                {/* Color swatch */}
                                <div
                                    title="Cliquer pour changer la couleur de tracé"
                                    onClick={() => setColorPickerItinId(colorPickerItinId === itin.id ? null : itin.id)}
                                    style={{
                                        width: '12px', height: '12px', borderRadius: '50%',
                                        background: itin.color, cursor: 'pointer', flexShrink: 0,
                                        boxShadow: `0 0 6px ${itin.color}88`,
                                        border: '1px solid rgba(255,255,255,0.4)'
                                    }}
                                />

                                {/* Name inline edit */}
                                {editingItinId === itin.id ? (
                                    <input
                                        type="text"
                                        autoFocus
                                        value={editingItinName}
                                        onChange={e => setEditingItinName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleSaveItinName(itin.id);
                                            if (e.key === 'Escape') setEditingItinId(null);
                                        }}
                                        onBlur={() => handleSaveItinName(itin.id)}
                                        style={{
                                            flex: 1, padding: '2px 6px', background: 'rgba(0,0,0,0.5)',
                                            border: '1px solid var(--accent-default)', borderRadius: '4px',
                                            color: '#fff', fontSize: '11px', fontWeight: 600, outline: 'none'
                                        }}
                                    />
                                ) : (
                                    <div
                                        style={{
                                            flex: 1, fontWeight: isActive ? 700 : 500,
                                            color: isActive ? '#fff' : 'var(--text-bright)',
                                            cursor: 'pointer', fontSize: '11px',
                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                        }}
                                        onClick={() => !isActive && dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id })}
                                        title={isActive ? "Itinéraire actif en cours d'édition" : "Cliquer pour passer sur cet itinéraire"}
                                    >
                                        {itin.name}
                                    </div>
                                )}

                                {/* Status / Action pill */}
                                {isActive ? (
                                    <span style={{
                                        padding: '2px 7px', borderRadius: '10px',
                                        background: 'rgba(45, 140, 235, 0.25)', border: '1px solid #2d8ceb',
                                        color: '#60a5fa', fontSize: '9px', fontWeight: 800, letterSpacing: '0.04em'
                                    }}>
                                        ACTIF
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id })}
                                        style={{
                                            padding: '2px 8px', borderRadius: '10px',
                                            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)',
                                            color: 'var(--text-bright)', fontSize: '9px', fontWeight: 600, cursor: 'pointer'
                                        }}
                                    >
                                        Éditer
                                    </button>
                                )}
                            </div>

                            {/* Color picker dropdown */}
                            {colorPickerItinId === itin.id && (
                                <div style={{
                                    padding: '6px 8px', background: 'rgba(0,0,0,0.6)', borderRadius: '6px',
                                    display: 'flex', gap: '6px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.08)'
                                }}>
                                    {PRESET_COLORS.map(c => (
                                        <div
                                            key={c.value}
                                            title={c.label}
                                            onClick={() => {
                                                dispatch({ type: 'UPDATE_ITINERARY', id: itin.id, color: c.value });
                                                setColorPickerItinId(null);
                                            }}
                                            style={{
                                                width: '14px', height: '14px', borderRadius: '50%',
                                                background: c.value, cursor: 'pointer',
                                                boxShadow: itin.color === c.value ? '0 0 0 2px #fff' : 'none',
                                                transition: 'transform 0.1s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Sub bar: Distance, stages count, actions */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                fontSize: '10px', color: 'var(--text-dim)', paddingLeft: '24px'
                            }}>
                                <span>{distKm.toFixed(1)} km · {stageCount} étape{stageCount > 1 ? 's' : ''}</span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    <button
                                        type="button"
                                        onClick={() => { setEditingItinId(itin.id); setEditingItinName(itin.name); }}
                                        title="Renommer l'itinéraire"
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                                    >
                                        <Edit3 size={11} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'DUPLICATE_ITINERARY', id: itin.id })}
                                        title="Dupliquer cet itinéraire"
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                                    >
                                        <Copy size={11} />
                                    </button>
                                    {itineraries.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (window.confirm(`Supprimer l'itinéraire "${itin.name}" ?`)) {
                                                    dispatch({ type: 'REMOVE_ITINERARY', id: itin.id });
                                                }
                                            }}
                                            title="Supprimer cet itinéraire"
                                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </AccordionSection>

            {/* ─────────────────────────────────────────────────────────────
                ACCORDION 2: REPÈRES & POINTS ANNOTÉS
            ───────────────────────────────────────────────────────────── */}
            <AccordionSection
                title="Points & Repères"
                icon={<MapPin size={13} style={{ color: '#3b82f6' }} />}
                count={points.length}
                isOpen={openPoints}
                onToggle={() => setOpenPoints(!openPoints)}
                action={
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_point' });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Outil Point actif : cliquez directement sur la carte pour poser un repère.', notifType: 'info' });
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            padding: '3px 8px',
                            background: state.active_tool === 'annotate_point' ? '#3b82f6' : 'rgba(59, 130, 246, 0.14)',
                            border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px',
                            color: state.active_tool === 'annotate_point' ? '#fff' : '#60a5fa',
                            fontSize: '10px', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        <Plus size={11} />
                        <span>Poser</span>
                    </button>
                }
            >
                {points.length === 0 ? (
                    <div style={{
                        fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center',
                        padding: '12px 8px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px'
                    }}>
                        Aucun point annoté.<br />
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>Cliquez sur "Poser" puis directement sur la carte.</span>
                    </div>
                ) : (
                    points.map(pt => {
                        const isSelected = selectedPointId === pt.id;

                        return (
                            <div
                                key={pt.id}
                                style={{
                                    padding: '7px 9px', borderRadius: '8px',
                                    background: isSelected ? 'rgba(59, 130, 246, 0.09)' : 'rgba(0,0,0,0.22)',
                                    border: `1px solid ${isSelected ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`,
                                    display: 'flex', flexDirection: 'column', gap: '5px',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    {/* Visibility */}
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'TOGGLE_POINT_VISIBILITY', id: pt.id })}
                                        title={pt.visible ? "Masquer ce point" : "Afficher ce point"}
                                        style={{ background: 'transparent', border: 'none', padding: 0, color: pt.visible ? pt.color : 'var(--text-dim)', cursor: 'pointer' }}
                                    >
                                        {pt.visible ? <Eye size={13} /> : <EyeOff size={13} style={{ opacity: 0.4 }} />}
                                    </button>

                                    {/* Point color dot */}
                                    <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: pt.color, flexShrink: 0, boxShadow: `0 0 5px ${pt.color}77` }} />

                                    {/* Inline Title */}
                                    <input
                                        type="text"
                                        value={pt.title}
                                        onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { title: e.target.value } })}
                                        onFocus={() => setSelectedPointId(pt.id)}
                                        style={{
                                            flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                                            color: '#fff', fontSize: '11px', fontWeight: 600, outline: 'none'
                                        }}
                                    />

                                    {/* Fly to point */}
                                    <button
                                        type="button"
                                        onClick={() => flyToPoint(pt.coords)}
                                        title="Centrer la carte sur ce repère"
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                                    >
                                        <Maximize2 size={12} />
                                    </button>

                                    {/* Delete point */}
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'REMOVE_POINT_ANNOTATION', id: pt.id })}
                                        title="Supprimer ce repère"
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                {/* Expanded details when clicked / focused */}
                                {isSelected && (
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', gap: '6px',
                                        paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                        <textarea
                                            rows={2}
                                            value={pt.text || ''}
                                            onChange={e => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { text: e.target.value } })}
                                            placeholder="Notes / consignes de campement, eau, observation..."
                                            style={{
                                                width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 7px',
                                                color: '#cbd5e1', fontSize: '10px', outline: 'none', resize: 'vertical'
                                            }}
                                        />

                                        {/* Color picker */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                {PRESET_COLORS.map(c => (
                                                    <div
                                                        key={c.value}
                                                        title={c.label}
                                                        onClick={() => dispatch({ type: 'UPDATE_POINT_ANNOTATION', id: pt.id, patch: { color: c.value } })}
                                                        style={{
                                                            width: '12px', height: '12px', borderRadius: '50%', background: c.value, cursor: 'pointer',
                                                            boxShadow: pt.color === c.value ? '0 0 0 2px #fff' : 'none'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
                                                {pt.coords[0].toFixed(5)}, {pt.coords[1].toFixed(5)}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </AccordionSection>

            {/* ─────────────────────────────────────────────────────────────
                ACCORDION 3: ZONES & PÉRIMÈTRES (AREAS)
            ───────────────────────────────────────────────────────────── */}
            <AccordionSection
                title="Zones & Périmètres"
                icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" /></svg>}
                count={areas.length}
                isOpen={openAreas}
                onToggle={() => setOpenAreas(!openAreas)}
                action={
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'annotate_area' });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Outil Zone actif : cliquez sur la carte pour tracer en direct.', notifType: 'info' });
                        }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            padding: '3px 8px',
                            background: state.active_tool === 'annotate_area' ? '#10b981' : 'rgba(16, 185, 129, 0.14)',
                            border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px',
                            color: state.active_tool === 'annotate_area' ? '#fff' : '#6ee7b7',
                            fontSize: '10px', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        <Plus size={11} />
                        <span>Tracer</span>
                    </button>
                }
            >
                {areas.length === 0 ? (
                    <div style={{
                        fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center',
                        padding: '12px 8px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px'
                    }}>
                        Aucune zone tracée.<br />
                        <span style={{ fontSize: '10px', opacity: 0.7 }}>Cliquez sur "Tracer" puis posez les sommets sur la carte.</span>
                    </div>
                ) : (
                    areas.map(area => {
                        const isComplete = area.coords.length >= 3;
                        const surface = area.formatted_area || formatArea(calculatePolygonArea(area.coords));
                        const isSelected = selectedAreaId === area.id;
                        const isRouting = routingAreaId === area.id;

                        return (
                            <div
                                key={area.id}
                                style={{
                                    padding: '7px 9px', borderRadius: '8px',
                                    background: isSelected ? 'rgba(16, 185, 129, 0.09)' : 'rgba(0,0,0,0.22)',
                                    border: `1px solid ${isSelected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.05)'}`,
                                    display: 'flex', flexDirection: 'column', gap: '5px',
                                    transition: 'all 0.15s'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                    {/* Visibility */}
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'TOGGLE_AREA_VISIBILITY', id: area.id })}
                                        title={area.visible ? "Masquer cette zone" : "Afficher cette zone"}
                                        style={{ background: 'transparent', border: 'none', padding: 0, color: area.visible ? area.color : 'var(--text-dim)', cursor: 'pointer' }}
                                    >
                                        {area.visible ? <Eye size={13} /> : <EyeOff size={13} style={{ opacity: 0.4 }} />}
                                    </button>

                                    {/* Area color swatch */}
                                    <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: area.color, flexShrink: 0, boxShadow: `0 0 5px ${area.color}77` }} />

                                    {/* Inline Title */}
                                    <input
                                        type="text"
                                        value={area.title}
                                        onChange={e => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { title: e.target.value } })}
                                        onFocus={() => setSelectedAreaId(area.id)}
                                        style={{
                                            flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                                            color: '#fff', fontSize: '11px', fontWeight: 600, outline: 'none'
                                        }}
                                    />

                                    {/* Calculated Area Badge */}
                                    {isComplete && (
                                        <span style={{
                                            padding: '1px 6px', borderRadius: '4px',
                                            background: 'rgba(16, 185, 129, 0.18)', color: '#6ee7b7',
                                            fontSize: '9px', fontWeight: 700, whiteSpace: 'nowrap'
                                        }}>
                                            {surface}
                                        </span>
                                    )}

                                    {/* Fit to area */}
                                    <button
                                        type="button"
                                        onClick={() => fitToArea(area.coords)}
                                        title="Centrer et encadrer la zone sur la carte"
                                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
                                    >
                                        <Maximize2 size={12} />
                                    </button>

                                    {/* Delete area */}
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'REMOVE_AREA_ANNOTATION', id: area.id })}
                                        title="Supprimer cette zone"
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>

                                {/* Expanded details when clicked */}
                                {isSelected && (
                                    <div style={{
                                        display: 'flex', flexDirection: 'column', gap: '6px',
                                        paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.06)'
                                    }}>
                                        {/* Notes input */}
                                        <textarea
                                            rows={2}
                                            value={area.text || ''}
                                            onChange={e => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { text: e.target.value } })}
                                            placeholder="Consignes, limites de bivouac, règles de zone..."
                                            style={{
                                                width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)',
                                                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '5px 7px',
                                                color: '#cbd5e1', fontSize: '10px', outline: 'none', resize: 'vertical'
                                            }}
                                        />

                                        {/* Follow roads / trails button (BRouter) */}
                                        <button
                                            type="button"
                                            disabled={isRouting}
                                            onClick={() => handleToggleRoadFollow(area)}
                                            style={{
                                                padding: '5px 8px', borderRadius: '6px',
                                                background: area.followRoads ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${area.followRoads ? '#10b981' : 'rgba(255,255,255,0.12)'}`,
                                                color: area.followRoads ? '#6ee7b7' : 'var(--text-bright)',
                                                fontSize: '10px', fontWeight: 600, cursor: isRouting ? 'wait' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
                                            }}
                                        >
                                            <Trees size={12} style={{ color: area.followRoads ? '#10b981' : 'inherit' }} />
                                            <span>{area.followRoads ? 'Arêtes sur sentiers (Actif)' : 'Suivre les sentiers (BRouter)'}</span>
                                        </button>

                                        {/* Color picker and vertices stats */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                {PRESET_COLORS.map(c => (
                                                    <div
                                                        key={c.value}
                                                        title={c.label}
                                                        onClick={() => dispatch({ type: 'UPDATE_AREA_ANNOTATION', id: area.id, patch: { color: c.value } })}
                                                        style={{
                                                            width: '12px', height: '12px', borderRadius: '50%', background: c.value, cursor: 'pointer',
                                                            boxShadow: area.color === c.value ? '0 0 0 2px #fff' : 'none'
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>
                                                {area.coords.length} sommets modifiables
                                            </span>
                                        </div>

                                        {/* Vertex list for precision deletion */}
                                        <div style={{
                                            display: 'flex', flexWrap: 'wrap', gap: '4px',
                                            maxHeight: '64px', overflowY: 'auto',
                                            padding: '4px', background: 'rgba(0,0,0,0.25)', borderRadius: '4px'
                                        }}>
                                            {area.coords.map((v, vIdx) => (
                                                <div
                                                    key={vIdx}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '3px',
                                                        fontSize: '9px', background: 'rgba(255,255,255,0.06)',
                                                        padding: '1px 5px', borderRadius: '3px', color: 'var(--text-dim)'
                                                    }}
                                                >
                                                    <span>S{vIdx + 1}</span>
                                                    {area.coords.length > 3 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => dispatch({ type: 'DELETE_AREA_VERTEX', areaId: area.id, vertexIdx: vIdx })}
                                                            title={`Supprimer le sommet #${vIdx + 1}`}
                                                            style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: 0, cursor: 'pointer', fontSize: '9px' }}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </AccordionSection>

            {/* ─────────────────────────────────────────────────────────────
                ACCORDION 4: FONDS & SURCOUCHES
            ───────────────────────────────────────────────────────────── */}
            <AccordionSection
                title="Fonds & Surcouches"
                icon={<Shield size={13} style={{ color: 'var(--text-dim)' }} />}
                isOpen={openOverlays}
                onToggle={() => setOpenOverlays(!openOverlays)}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', padding: '2px 0' }}>
                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <span style={{ color: 'var(--text-bright)' }}>Étapes du tracé (A, B, C...)</span>
                        <input
                            type="checkbox"
                            checked={state.show_stages_on_map}
                            onChange={() => dispatch({ type: 'TOGGLE_STAGES_ON_MAP' })}
                            style={{ accentColor: 'var(--accent-default)', cursor: 'pointer' }}
                        />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <span style={{ color: 'var(--text-bright)' }}>Points d'intérêt (POIs IGN/OSM)</span>
                        <input
                            type="checkbox"
                            checked={state.show_pois_on_map}
                            onChange={() => dispatch({ type: 'TOGGLE_POIS_ON_MAP' })}
                            style={{ accentColor: '#fbbf24', cursor: 'pointer' }}
                        />
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                        <span style={{ color: 'var(--text-bright)' }}>Avertissements & Dangers</span>
                        <input
                            type="checkbox"
                            checked={state.show_dangers_on_map}
                            onChange={() => dispatch({ type: 'TOGGLE_DANGERS_ON_MAP' })}
                            style={{ accentColor: '#ef4444', cursor: 'pointer' }}
                        />
                    </label>
                </div>
            </AccordionSection>
        </div>
    );
}

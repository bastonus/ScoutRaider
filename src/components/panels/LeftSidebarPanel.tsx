import React, { useState, useEffect, useRef } from 'react';
import { Route, Layers, Plus, Eye, EyeOff, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../../AppContext';
import RoutePanel from './RoutePanel';
import LayerManagerPanel from './LayerManagerPanel';

export default function LeftSidebarPanel() {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState<'stages' | 'layers'>('stages');
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const itineraries = state.itineraries || [];
    const activeItinId = state.active_itinerary_id;
    const activeItin = itineraries.find(it => it.id === activeItinId) || itineraries[0];

    const pointCount = (state.point_annotations || []).length;
    const areaCount = (state.area_annotations || []).length;
    const totalAnnotations = pointCount + areaCount;

    // Listen to global openLayerManager
    useEffect(() => {
        (window as any).__openLayerManager = () => setActiveTab('layers');
        (window as any).__openStagesManager = () => setActiveTab('stages');
        return () => {
            delete (window as any).__openLayerManager;
            delete (window as any).__openStagesManager;
        };
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleCreateSecondRoute = () => {
        setDropdownOpen(false);
        dispatch({
            type: 'ADD_ITINERARY',
            name: 'Itinéraire 2 (Bis / Variante)',
            color: '#f97316'
        });
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Itinéraire 2 créé et activé.', notifType: 'info' });
        setActiveTab('stages');
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            overflow: 'hidden', background: 'var(--bg-panel)'
        }}>
            {/* ── TOP ITINERARY SELECTOR BAR ── */}
            <div 
                ref={dropdownRef}
                style={{
                    position: 'relative',
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--bg-border)',
                    background: 'linear-gradient(180deg, rgba(20, 30, 24, 0.95) 0%, rgba(14, 22, 17, 0.95) 100%)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                }}
            >
                {/* Active Itinerary Dropdown Trigger */}
                <button
                    type="button"
                    onClick={() => setDropdownOpen(prev => !prev)}
                    title="Changer d'itinéraire ou en ajouter un"
                    style={{
                        flex: 1, minWidth: 0,
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 10px',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(110, 201, 126, 0.15)',
                        borderRadius: '8px',
                        color: 'var(--text-bright)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s, border-color 0.15s'
                    }}
                >
                    <div style={{
                        width: '10px', height: '10px', borderRadius: '50%',
                        background: activeItin?.color || '#2d8ceb', flexShrink: 0,
                        boxShadow: `0 0 8px ${activeItin?.color || '#2d8ceb'}88`
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                            fontSize: '11px', fontWeight: 700, color: '#fff',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                            {activeItin?.name || 'Itinéraire 1'}
                        </div>
                    </div>

                    <ChevronDown size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
                </button>

                {/* Visibility Toggle Eye */}
                {activeItin && (
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'TOGGLE_ITINERARY_VISIBILITY', id: activeItin.id })}
                        title={activeItin.visible ? "Masquer cet itinéraire" : "Afficher cet itinéraire"}
                        style={{
                            width: '30px', height: '30px', borderRadius: '8px',
                            background: activeItin.visible ? 'rgba(45,140,235,0.1)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${activeItin.visible ? 'rgba(45,140,235,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            color: activeItin.visible ? activeItin.color : 'var(--text-dim)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        {activeItin.visible ? <Eye size={15} /> : <EyeOff size={15} style={{ opacity: 0.5 }} />}
                    </button>
                )}

                {/* Quick Add Second Route (if only 1 exists) */}
                {itineraries.length === 1 && (
                    <button
                        type="button"
                        onClick={handleCreateSecondRoute}
                        title="Créer un 2ème itinéraire"
                        style={{
                            padding: '0 8px', height: '30px', borderRadius: '8px',
                            background: 'rgba(249, 115, 22, 0.15)',
                            border: '1px solid rgba(249, 115, 22, 0.35)',
                            color: '#f97316', fontSize: '11px', fontWeight: 700,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            flexShrink: 0
                        }}
                    >
                        <Plus size={13} />
                        <span>2e trace</span>
                    </button>
                )}

                {/* Dropdown Menu */}
                {dropdownOpen && (
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: '10px', right: '10px',
                        background: '#121c15', border: '1px solid rgba(110, 201, 126, 0.25)',
                        borderRadius: '10px', boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
                        zIndex: 9999, padding: '6px', display: 'flex', flexDirection: 'column', gap: '3px'
                    }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 8px', textTransform: 'uppercase' }}>
                            Itinéraires ({itineraries.length})
                        </div>

                        {itineraries.map(itin => {
                            const isSelected = itin.id === activeItinId;
                            return (
                                <div
                                    key={itin.id}
                                    onClick={() => {
                                        dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id });
                                        setDropdownOpen(false);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '7px 8px', borderRadius: '6px',
                                        background: isSelected ? 'rgba(45, 140, 235, 0.15)' : 'transparent',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: itin.color }} />
                                    <span style={{ flex: 1, fontSize: '12px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#fff' : 'var(--text-bright)' }}>
                                        {itin.name}
                                    </span>
                                    {isSelected && <Check size={14} style={{ color: '#2d8ceb' }} />}
                                </div>
                            );
                        })}

                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

                        <button
                            type="button"
                            onClick={() => {
                                setDropdownOpen(false);
                                dispatch({ type: 'ADD_ITINERARY' });
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '6px 8px', background: 'transparent', border: 'none',
                                color: 'var(--accent-default)', fontSize: '11px', fontWeight: 600,
                                cursor: 'pointer', borderRadius: '6px', textAlign: 'left'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(110,201,126,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Plus size={13} />
                            Ajouter un nouvel itinéraire
                        </button>
                    </div>
                )}
            </div>

            {/* ── TAB BAR ── */}
            <div style={{
                display: 'flex', borderBottom: '1px solid var(--bg-border)',
                background: 'rgba(0,0,0,0.25)', padding: '4px 8px', gap: '4px'
            }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('stages')}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '6px 8px', borderRadius: '6px', border: 'none',
                        background: activeTab === 'stages' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: activeTab === 'stages' ? '#fff' : 'var(--text-dim)',
                        fontWeight: activeTab === 'stages' ? 700 : 500,
                        fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                >
                    <Route size={14} style={{ color: activeTab === 'stages' ? 'var(--accent-default)' : 'inherit' }} />
                    <span>Étapes ({state.stages.length})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('layers')}
                    style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '6px 8px', borderRadius: '6px', border: 'none',
                        background: activeTab === 'layers' ? 'rgba(255,255,255,0.08)' : 'transparent',
                        color: activeTab === 'layers' ? '#fff' : 'var(--text-dim)',
                        fontWeight: activeTab === 'layers' ? 700 : 500,
                        fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s'
                    }}
                >
                    <Layers size={14} style={{ color: activeTab === 'layers' ? '#3b82f6' : 'inherit' }} />
                    <span>Calques</span>
                    {(itineraries.length > 1 || totalAnnotations > 0) && (
                        <span style={{
                            padding: '1px 5px', borderRadius: '8px',
                            background: activeTab === 'layers' ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                            color: '#fff', fontSize: '9px', fontWeight: 700
                        }}>
                            {itineraries.length + (totalAnnotations > 0 ? 1 : 0)}
                        </span>
                    )}
                </button>
            </div>

            {/* ── TAB CONTENT ── */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                {activeTab === 'stages' ? <RoutePanel /> : <LayerManagerPanel />}
            </div>
        </div>
    );
}

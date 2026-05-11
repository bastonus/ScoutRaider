import React, { useState, useMemo } from 'react';
import { Search, Map as MapIcon, ExternalLink, Key, Settings, Check, Lock, Star, Satellite } from 'lucide-react';
import { useApp } from '../../AppContext';
import { MAP_LAYERS, PROVIDERS } from '../../logic/MapConfig';

interface MapLibraryPanelProps {
    onSetRightSection?: (id: any) => void;
    onPreferencesOpen?: () => void;
}

export default function MapLibraryPanel({ onSetRightSection, onPreferencesOpen }: MapLibraryPanelProps) {
    const { state, dispatch } = useApp();
    const [searchTerm, setSearchTerm] = useState('');

    const activeLayerId = state.active_ign_layer || 'PLAN.IGN';

    const filteredLayers = useMemo(() => {
        return Object.entries(MAP_LAYERS).filter(([id, data]) => 
            id.toLowerCase().includes(searchTerm.toLowerCase()) || 
            data.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm]);

    const handleActivate = (id: string) => {
        const layer = MAP_LAYERS[id];
        const hasKey = layer.provider === 'IGN' ? !!state.ign_api_key : (layer.provider === 'Mapy.cz' ? !!state.mapy_api_key : true);

        if (layer.needsKey && !hasKey) {
            onPreferencesOpen?.();
            dispatch({ type: 'ADD_NOTIFICATION', message: `Une clé API ${layer.provider} est requise pour activer ce fond de carte.`, notifType: 'info' });
            return;
        }

        dispatch({ type: 'SET_IGN_LAYER', layer: id });
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            
            {/* ── SEARCH BAR (STICKY TOP) ─────────────────────────────────── */}
            <div style={{ 
                padding: '16px', 
                background: 'var(--bg-main)', 
                borderBottom: '1px solid var(--bg-border)',
                zIndex: 10,
                flexShrink: 0
            }}>
                <div className="search-bar" style={{ width: '100%', maxWidth: 'none', margin: 0 }}>
                    <Search size={16} color="rgba(255,255,255,0.4)" />
                    <input 
                        type="text" 
                        placeholder="Rechercher une carte..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', flex: 1 }}
                    />
                </div>
            </div>

            {/* ── GALLERY AREA (SCROLLABLE) ───────────────────────────────── */}
            <div style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '16px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '24px',
                background: 'rgba(0,0,0,0.15)'
            }}>
                {filteredLayers.map(([id, data]) => {
                    const isActive = activeLayerId === id;
                    const provider = PROVIDERS[data.provider];
                    
                    return (
                        <div 
                            key={id} 
                            onClick={() => handleActivate(id)}
                            style={{
                                background: isActive ? 'rgba(110, 201, 126, 0.04)' : 'rgba(255,255,255,0.02)',
                                borderRadius: '16px',
                                border: '1px solid',
                                borderColor: isActive ? 'var(--accent-default)' : 'rgba(255,255,255,0.08)',
                                overflow: 'hidden',
                                boxShadow: isActive ? '0 0 0 1px var(--accent-default), 0 8px 24px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.2)',
                                transition: 'all 0.3s ease',
                                flexShrink: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                cursor: 'pointer'
                            }}
                            onMouseEnter={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                                }
                            }}
                        >
                            {/* Card Image + Badges */}
                            <div style={{ width: '100%', height: '140px', minHeight: '140px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                                <img 
                                    src={data.preview || provider.preview || ''} 
                                    alt={id} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} 
                                />
                                
                                {/* Badges Overlay (ROW) */}
                                <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', zIndex: 5 }}>
                                    {data.needsKey && (
                                        <div style={{ 
                                            background: 'rgba(239, 68, 68, 0.95)', padding: '4px 8px', borderRadius: '8px', 
                                            display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(0,0,0,0.1)'
                                        }}>
                                            <Lock size={12} color="#fff" fill="#fff" fillOpacity={0.1} strokeWidth={2.5} />
                                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>Bloqué</span>
                                        </div>
                                    )}
                                    {data.isFavorite && (
                                        <div style={{ 
                                            background: 'rgba(251, 191, 36, 0.95)', padding: '4px 8px', borderRadius: '8px', 
                                            display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(0,0,0,0.1)'
                                        }}>
                                            <Star size={12} color="#000" fill="#000" strokeWidth={2.5} />
                                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#000', letterSpacing: '0.3px' }}>Favori</span>
                                        </div>
                                    )}
                                    {data.isSatellite && (
                                        <div style={{ 
                                            background: 'rgba(168, 85, 247, 0.95)', padding: '4px 8px', borderRadius: '8px', 
                                            display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                                            border: '1px solid rgba(0,0,0,0.1)'
                                        }}>
                                            <Satellite size={12} color="#fff" strokeWidth={2.5} />
                                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>Satellite</span>
                                        </div>
                                    )}
                                </div>

                                <div style={{ 
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    padding: '12px',
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                                    display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end'
                                }}>
                                    {provider.logo && (
                                        <img src={provider.logo} alt="Logo" style={{ maxHeight: '24px', maxWidth: '40%', filter: 'brightness(1.1) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                                    )}
                                </div>
                            </div>

                            {/* Card Content */}
                            <div style={{ padding: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>{id}</div>
                                            {isActive && (
                                                <div style={{ 
                                                    background: 'rgba(110, 201, 126, 0.2)', color: 'var(--accent-default)', 
                                                    padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 800,
                                                    border: '1px solid rgba(110, 201, 126, 0.3)', textTransform: 'uppercase'
                                                }}>Actif</div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--accent-default)', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px', letterSpacing: '0.5px' }}>{data.category}</div>
                                    </div>
                                    <a href={provider.website} target="_blank" onClick={e => e.stopPropagation()} style={{ color: 'rgba(255,255,255,0.2)', transition: 'color 0.2s', padding: '4px' }} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}>
                                        <ExternalLink size={14} />
                                    </a>
                                </div>
                                
                                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, margin: '8px 0 0' }}>
                                    {provider.description}
                                </p>

                                {/* Action Button (Only for Blocked maps) */}
                                {data.needsKey && !isActive && (
                                    <div 
                                        style={{
                                            width: '100%', padding: '10px',
                                            background: 'rgba(251, 191, 36, 0.1)', 
                                            border: '1px solid rgba(251, 191, 36, 0.2)',
                                            borderRadius: '10px', color: '#fbbf24', fontSize: '12px', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginTop: '16px', transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <Lock size={14} color="#fbbf24" fill="#fbbf24" fillOpacity={0.2} style={{ marginRight: '8px' }} />
                                        <span style={{ display: 'inline-block', lineHeight: '1.2' }}>
                                            Débloquer avec une clé 
                                            {provider.logo && (
                                                <img 
                                                    src={provider.logo} 
                                                    alt="Provider Logo" 
                                                    style={{ 
                                                        height: '1.1em', 
                                                        width: 'auto',
                                                        verticalAlign: 'text-bottom',
                                                        marginLeft: '6px',
                                                        filter: 'brightness(0) saturate(100%) invert(86%) sepia(23%) saturate(5801%) hue-rotate(345deg) brightness(101%) contrast(99%)' 
                                                    }} 
                                                />
                                            )}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { Layers, FileText, X, Maximize2, Minimize2 } from 'lucide-react';
import MapComponent from './MapComponent';
import FloatingSearch from './FloatingSearch';
import FloatingToolbar from './FloatingToolbar';
import InfoPills from './InfoPills';
import LegendOverlay from './LegendOverlay';
import LayerManagerPanel from '../panels/LayerManagerPanel';
import { useApp } from '../../AppContext';
import MetroTimeline from '../layout/MetroTimeline';
import type { ViewMode } from '../../App';

interface MapWorkspaceProps {
    isSplitMode?: boolean;
    onViewModeChange?: (mode: ViewMode) => void;
    onToggleSidebar?: (side: 'left' | 'right') => void;
}

export default function MapWorkspace({ isSplitMode = false, onViewModeChange, onToggleSidebar }: MapWorkspaceProps) {
    const { state, dispatch } = useApp();
    const activeTool = state.active_tool;
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [layersPanelOpen, setLayersPanelOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const setActiveTool = (tool: string) => dispatch({ type: 'SET_ACTIVE_TOOL', tool });

    const showMetro = activeTool === 'encodage';

    return (
        <div className="dock-panel-content no-padding" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <MapComponent />
            
            {showMetro && <MetroTimeline />}
            
            {!showMetro && <FloatingSearch isSplitMode={isSplitMode} />}

            {/* BOUTON HAUT DROITE ALIGNÉ AVEC LA RECHERCHE : MAXIMIZE / MINIMIZE (DESKTOP SEULEMENT) */}
            {onViewModeChange && !isMobile && (
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '3px 4px',
                    boxShadow: 'none',
                    zIndex: 1100,
                    pointerEvents: 'all',
                }}>
                    <button
                        type="button"
                        onClick={() => onViewModeChange(isSplitMode ? 'map' : 'split')}
                        title={isSplitMode ? "Agrandir la carte (Plein écran)" : "Réduire la carte (Mode partagé)"}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            border: 'none',
                            background: !isSplitMode ? 'var(--accent-transparent)' : 'transparent',
                            color: !isSplitMode ? 'var(--accent-hover)' : 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 120ms ease'
                        }}
                        onMouseEnter={e => {
                            if (isSplitMode) {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (isSplitMode) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }
                        }}
                    >
                        {!isSplitMode ? (
                            <Minimize2 size={16} strokeWidth={2.2} />
                        ) : (
                            <Maximize2 size={16} strokeWidth={2.2} />
                        )}
                    </button>
                </div>
            )}

            {/* PANNEAU DES CALQUES (BOTTOM SHEET SUR MOBILE, FENÊTRE FLOTTANTE SUR DESKTOP) */}
            {layersPanelOpen && (
                isMobile ? (
                    <>
                        <div
                            className="bottom-sheet-backdrop"
                            onClick={() => setLayersPanelOpen(false)}
                        />
                        <div
                            className="bottom-sheet-panel"
                            style={{
                                height: '70dvh',
                                maxHeight: '85dvh',
                                zIndex: 2600
                            }}
                        >
                            <div
                                className="bottom-sheet-handle-zone"
                                onClick={() => setLayersPanelOpen(false)}
                                role="button"
                                aria-label="Fermer le volet"
                            >
                                <div className="bottom-sheet-handle-bar" />
                            </div>
                            <div className="bottom-sheet-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '7px',
                                        background: 'var(--accent-transparent)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Layers size={14} color="var(--accent-default)" />
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                                        Calques & Tracé
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setLayersPanelOpen(false)}
                                    title="Fermer le volet des calques"
                                    style={{
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '7px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-dim)',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 120ms ease'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                                <LayerManagerPanel />
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{
                        position: 'absolute',
                        bottom: '62px',
                        right: '16px',
                        width: '330px',
                        maxWidth: '350px',
                        height: '440px',
                        maxHeight: 'calc(100vh - 150px)',
                        background: 'var(--bg-panel)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '16px',
                        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.1)',
                        zIndex: 1100,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderBottom: '1px solid var(--border-subtle)',
                            background: 'var(--bg-elevated)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{
                                    width: '22px',
                                    height: '22px',
                                    borderRadius: '6px',
                                    background: 'var(--accent-transparent)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Layers size={13} color="var(--accent-default)" />
                                </div>
                                <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
                                    Calques & Tracé
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setLayersPanelOpen(false)}
                                title="Fermer la bulle des calques"
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '6px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-dim)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 120ms ease'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                            <LayerManagerPanel />
                        </div>
                    </div>
                )
            )}

            {/* BOUTON FLOTTANT CALQUES (EN BAS À DROITE) */}
            <div style={{
                position: 'absolute',
                bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
                right: isMobile ? 'max(12px, env(safe-area-inset-right, 12px))' : 'max(16px, env(safe-area-inset-right, 16px))',
                zIndex: 1100,
                pointerEvents: 'all',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                boxShadow: 'var(--shadow-md)'
            }}>
                <button
                    type="button"
                    onClick={() => setLayersPanelOpen(prev => !prev)}
                    title="Afficher / Masquer les calques"
                    style={{
                        width: '34px',
                        height: '34px',
                        border: 'none',
                        background: layersPanelOpen ? 'var(--accent-transparent)' : 'transparent',
                        color: layersPanelOpen ? 'var(--accent-hover)' : 'var(--text-dim)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '10px',
                        transition: 'all 100ms ease'
                    }}
                    onMouseEnter={e => {
                        if (!layersPanelOpen) {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }
                    }}
                    onMouseLeave={e => {
                        if (!layersPanelOpen) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-dim)';
                        }
                    }}
                >
                    <Layers size={18} strokeWidth={2.2} />
                </button>
            </div>
            
            <InfoPills />
            
            <FloatingToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            
            {activeTool === 'encodage' && <LegendOverlay />}
        </div>
    );
}

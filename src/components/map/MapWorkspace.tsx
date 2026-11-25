import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers, Maximize2, Minimize2 } from 'lucide-react';
import MapComponent from './MapComponent';
import FloatingSearch from './FloatingSearch';
import FloatingToolbar from './FloatingToolbar';
import InfoPills from './InfoPills';
import LegendOverlay from './LegendOverlay';
import LayerManagerPanel, { LayerAddButtons } from '../panels/LayerManagerPanel';
import { useApp } from '../../AppContext';
import { useViewport } from '../../hooks';
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
    const { isMobile } = useViewport();
    const [layersPanelOpen, setLayersPanelOpen] = useState(false);
    const [layersPanelHeight, setLayersPanelHeight] = useState<number | null>(null);
    const [isResizingLayers, setIsResizingLayers] = useState(false);
    const layersPanelRef = useRef<HTMLDivElement>(null);

    const handleLayersResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        e.stopPropagation();
        const startY = e.clientY;
        const startH = layersPanelRef.current?.getBoundingClientRect().height || 260;
        setIsResizingLayers(true);

        const onMove = (ev: PointerEvent) => {
            const maxH = Math.max(200, window.innerHeight - 130);
            const nextH = Math.round(Math.max(150, Math.min(maxH, startH + (startY - ev.clientY))));
            setLayersPanelHeight(nextH);
        };
        const onUp = () => {
            setIsResizingLayers(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, []);

    const setActiveTool = (tool: string) => dispatch({ type: 'SET_ACTIVE_TOOL', tool });

    const showMetro = activeTool === 'encodage';

    const totalLayersCount =
        (state.itineraries?.length || 0) +
        (state.point_annotations?.length || 0) +
        (state.area_annotations?.length || 0) +
        (((state as any).draw_annotations as any[])?.length || 0) +
        (((state as any).text_annotations as any[])?.length || 0);

    useEffect(() => {
        if (!layersPanelOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                const tag = (document.activeElement as HTMLElement | null)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;
                setLayersPanelOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [layersPanelOpen]);

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
                        aria-label={isSplitMode ? "Agrandir la carte (Plein écran)" : "Réduire la carte (Mode partagé)"}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            border: 'none',
                            background: !isSplitMode ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
                            color: !isSplitMode ? 'var(--text-primary)' : 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 120ms ease'
                        }}
                    >
                        {!isSplitMode ? (
                            <Minimize2 size={16} strokeWidth={2.2} aria-hidden="true" />
                        ) : (
                            <Maximize2 size={16} strokeWidth={2.2} aria-hidden="true" />
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
                            id="layers-panel-dialog"
                            className="bottom-sheet-panel"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Calques"
                            style={{
                                maxHeight: '75dvh',
                                zIndex: 2600,
                                background: 'var(--bg-elevated)',
                            }}
                        >
                            <button
                                type="button"
                                className="bottom-sheet-handle-zone"
                                onClick={() => setLayersPanelOpen(false)}
                                aria-label="Replier le panneau des calques"
                                style={{ width: '100%', background: 'transparent', border: 'none' }}
                            >
                                <div className="bottom-sheet-handle-bar" />
                            </button>
                            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <LayerManagerPanel isMobile={true} onClose={() => setLayersPanelOpen(false)} />
                            </div>
                        </div>
                    </>
                ) : (
                    <div
                        ref={layersPanelRef}
                        id="layers-panel-dialog"
                        role="dialog"
                        aria-label="Calques"
                        style={{
                            position: 'absolute',
                            bottom: '64px',
                            right: '16px',
                            width: 'var(--panel-width)',
                            height: layersPanelHeight !== null ? `${layersPanelHeight}px` : undefined,
                            maxHeight: layersPanelHeight !== null ? 'calc(100dvh - 130px)' : '60dvh',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '14px',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 1200,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            pointerEvents: 'all',
                        }}
                    >
                        <div
                            role="separator"
                            aria-orientation="horizontal"
                            aria-label="Redimensionner le panneau des calques"
                            title="Glisser pour redimensionner (double-clic pour réinitialiser)"
                            onPointerDown={handleLayersResizeStart}
                            onDoubleClick={() => setLayersPanelHeight(null)}
                            style={{
                                height: '14px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'ns-resize',
                                touchAction: 'none',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: isResizingLayers ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.025)',
                                flexShrink: 0,
                                userSelect: 'none',
                            }}
                        >
                            <div
                                style={{
                                    width: '36px',
                                    height: '3px',
                                    borderRadius: '999px',
                                    background: isResizingLayers ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.24)',
                                    transition: 'background 150ms ease',
                                }}
                            />
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <LayerManagerPanel isMobile={false} onClose={() => setLayersPanelOpen(false)} />
                        </div>
                    </div>
                )
            )}

            {/* BOUTON FLOTTANT CALQUES + AJOUT DE CALQUES (EN BAS À DROITE) */}
            <div style={{
                position: 'absolute',
                bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
                right: isMobile ? 'max(12px, env(safe-area-inset-right, 12px))' : 'max(16px, env(safe-area-inset-right, 16px))',
                zIndex: 1200,
                pointerEvents: 'all',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                boxShadow: 'var(--shadow-md)'
            }}>
                {!isMobile && layersPanelOpen && (
                    <>
                        <LayerAddButtons variant="bar" />
                        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />
                    </>
                )}
                <button
                    type="button"
                    aria-expanded={layersPanelOpen}
                    aria-controls="layers-panel-dialog"
                    aria-label={layersPanelOpen ? 'Replier les calques' : 'Afficher les calques'}
                    onClick={() => setLayersPanelOpen(prev => !prev)}
                    title={layersPanelOpen ? 'Replier les calques' : 'Afficher les calques'}
                    style={{
                        height: '32px',
                        padding: isMobile ? '0 8px' : '0 10px',
                        border: 'none',
                        background: layersPanelOpen ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                        color: layersPanelOpen || totalLayersCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        transition: 'background 100ms ease, color 100ms ease'
                    }}
                >
                    <Layers size={15} strokeWidth={2.2} aria-hidden="true" />
                    {!isMobile && <span>Calques</span>}
                    {totalLayersCount > 0 && (
                        <span
                            className="tabular-nums"
                            style={{
                                fontSize: '10.5px',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '8px',
                                background: layersPanelOpen ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.14)',
                                color: '#ffffff',
                                lineHeight: 1.25,
                                fontFamily: 'var(--font-mono)',
                            }}
                        >
                            {totalLayersCount}
                        </span>
                    )}
                </button>
            </div>
            
            <InfoPills />
            
            {(!isMobile || !layersPanelOpen) && (
                <FloatingToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            )}
            
            {activeTool === 'encodage' && <LegendOverlay />}
        </div>
    );
}

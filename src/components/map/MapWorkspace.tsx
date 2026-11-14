import React, { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import MapComponent from './MapComponent';
import FloatingSearch from './FloatingSearch';
import FloatingToolbar from './FloatingToolbar';
import InfoPills from './InfoPills';
import ControlToolbar from './ControlToolbar';
import LegendOverlay from './LegendOverlay';
import { useApp } from '../../AppContext';
import MetroTimeline from '../layout/MetroTimeline';

interface MapWorkspaceProps {
    isSplitMode?: boolean;
    onToggleSidebar?: (side: 'left' | 'right') => void;
}

export default function MapWorkspace({ isSplitMode = false, onToggleSidebar }: MapWorkspaceProps) {
    const { state, dispatch } = useApp();
    const activeTool = state.active_tool;
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

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

            {/* BOUTON FLOTTANT DU VOLET CALQUES & CARTOGRAPHIE SUR MOBILE */}
            {isMobile && onToggleSidebar && (
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    pointerEvents: 'all'
                }}>
                    <button
                        onClick={() => onToggleSidebar('right')}
                        title="Calques & Cartographie"
                        style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '12px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-sm)',
                            color: 'var(--text-dim)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 100ms ease'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-elevated)';
                            e.currentTarget.style.color = 'var(--text-dim)';
                        }}
                    >
                        <Layers size={18} strokeWidth={2.1} />
                    </button>
                </div>
            )}
            
            <InfoPills />
            
            <FloatingToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            
            {!showMetro && <ControlToolbar />}
            
            {activeTool === 'encodage' && <LegendOverlay />}
        </div>
    );
}

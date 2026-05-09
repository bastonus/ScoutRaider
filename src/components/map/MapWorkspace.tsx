import React, { useState } from 'react';
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
}

export default function MapWorkspace({ isSplitMode = false }: MapWorkspaceProps) {
    const { state, dispatch } = useApp();
    const activeTool = state.active_tool;

    const setActiveTool = (tool: string) => dispatch({ type: 'SET_ACTIVE_TOOL', tool });

    const showMetro = activeTool === 'encodage';

    return (
        <div className="dock-panel-content no-padding" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <MapComponent />
            
            {showMetro && <MetroTimeline />}
            
            {!showMetro && <FloatingSearch isSplitMode={isSplitMode} />}
            
            <InfoPills />
            
            <FloatingToolbar activeTool={activeTool} onToolChange={setActiveTool} />
            
            {!showMetro && <ControlToolbar />}
            
            
            
            {activeTool === 'encodage' && <LegendOverlay />}
        </div>
    );
}

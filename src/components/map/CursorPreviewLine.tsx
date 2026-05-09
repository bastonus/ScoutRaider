import React from 'react';
import { Polyline } from 'react-leaflet';
import { useApp } from '../../AppContext';

export default function CursorPreviewLine({ cursorPos }: { cursorPos: [number, number] | null }) {
    const { state } = useApp();
    const lastStage = state.stages.length > 0 ? state.stages[state.stages.length - 1] : null;

    if (state.active_tool === 'route' && cursorPos && lastStage) {
        return (
            <Polyline 
                positions={[lastStage.coords as [number, number], cursorPos]} 
                color="var(--accent-default)" 
                dashArray="5, 10"
                weight={2}
                opacity={0.5}
            />
        );
    }
    
    return null;
}

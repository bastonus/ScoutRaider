import React from 'react';
import { Polyline } from 'react-leaflet';
import { useApp } from '../../AppContext';

export default function CursorPreviewLine({ cursorPos }: { cursorPos: [number, number] | null }) {
    const { state } = useApp();
    const stages = state.stages;
    const anchorIdx = state.anchor_stage_idx;

    // Anchor stage: the one the next click will connect FROM
    // If anchor_stage_idx is set and valid, use it; otherwise fall back to last stage
    const anchorStage = (anchorIdx >= 0 && anchorIdx < stages.length)
        ? stages[anchorIdx]
        : stages.length > 0 ? stages[stages.length - 1] : null;

    if ((state.active_tool === 'route' || state.active_tool === 'route_direct') && cursorPos && anchorStage && !(window as any).__isHoveringCompatible) {
        return (
            <Polyline 
                positions={[anchorStage.coords as [number, number], cursorPos]} 
                color="var(--accent-default)" 
                dashArray="5, 10"
                weight={2}
                opacity={0.5}
                interactive={false}
            />
        );
    }
    
    return null;
}

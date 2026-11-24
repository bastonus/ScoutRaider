import React from 'react';
import { Polyline } from 'react-leaflet';
import { useRoutes, useAnnotations, useUI } from '../../hooks';

export default function CursorPreviewLine({ cursorPos }: { cursorPos: [number, number] | null }) {
    const { stages, anchorStageIdx, activeItineraryId } = useRoutes();
    const { selectedLayerId } = useAnnotations();
    const { activeTool } = useUI();

    // Anchor stage: the one the next click will connect FROM
    // If anchorStageIdx is set and valid, use it; otherwise fall back to last stage
    const anchorStage = (anchorStageIdx >= 0 && anchorStageIdx < stages.length)
        ? stages[anchorStageIdx]
        : stages.length > 0 ? stages[stages.length - 1] : null;

    const isItinSelected = selectedLayerId === activeItineraryId;
    if (isItinSelected && (activeTool === 'route' || activeTool === 'route_direct') && cursorPos && anchorStage && !(window as any).__isHoveringCompatible) {
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

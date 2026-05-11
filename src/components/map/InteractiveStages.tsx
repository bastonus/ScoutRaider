import React, { useCallback, useEffect, useRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import { Stage } from '../../logic/types';

// ── Per-stage marker — isolated in React.memo so parent re-renders
// (e.g. setCursorPos on mousemove) don't unbind/rebind Leaflet event
// handlers mid-drag, which was interrupting the drag gesture. ──────
interface StageMarkerProps {
    stage: Stage;
    idx: number;
    total: number;
    isMovable: boolean;
    isAnchored: boolean;
    onDragEnd: (idx: number, lat: number, lon: number) => void;
    onRemove: (idx: number) => void;
    onAnchor: (idx: number) => void;
    onUnAnchor: () => void;
}

const StageMarker = React.memo(function StageMarker({
    stage, idx, total, isMovable, isAnchored,
    onDragEnd, onRemove, onAnchor, onUnAnchor,
}: StageMarkerProps) {
    const markerRef = useRef<any>(null);

    // Imperatively sync dragging.enable/disable when isMovable changes.
    // Using useEffect (not ref callback) avoids re-running on every parent render.
    useEffect(() => {
        if (!markerRef.current) return;
        if (isMovable) {
            markerRef.current.dragging?.enable();
        } else {
            markerRef.current.dragging?.disable();
        }
    }, [isMovable]);

    const isFirst = idx === 0;
    const isLast = idx === total - 1;
    const dotColor = isFirst ? 'var(--semantic-green)' : isLast ? 'var(--semantic-red)' : 'var(--accent-default)';
    const cursorStyle = isMovable ? 'grab' : 'pointer';

    const markerHtml = isAnchored
        ? `<div style="width:32px;height:32px;border-radius:8px;background:#fff;border:3px solid #2d8ceb;color:#2d8ceb;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(45,140,235,0.35),0 3px 8px rgba(0,0,0,0.5);font-family:'Inter',sans-serif;cursor:${cursorStyle};">${stage.label}</div>`
        : `<div style="width:28px;height:28px;border-radius:8px;background:#fff;border:2px solid ${dotColor};color:${dotColor};font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.5);font-family:'Inter',sans-serif;cursor:${cursorStyle};">${stage.label}</div>`;

    const icon = L.divIcon({
        className: 'custom-stage-marker',
        html: markerHtml,
        iconSize: isAnchored ? [32, 32] : [28, 28],
        iconAnchor: isAnchored ? [16, 16] : [14, 14],
    });

    // Stable handlers via useCallback — dependencies are primitive/stable
    // so they don't change on parent re-render caused by setCursorPos.
    const handleDragStart = useCallback(() => {
        // Ensure drag is active (safety net)
        if (markerRef.current?.dragging) markerRef.current.dragging.enable();
        // Block map click handler from firing at the drop position
        (window as any).__markerDragging = true;
    }, []);

    const handleDragEnd = useCallback((e: any) => {
        const pos = e.target.getLatLng();
        onDragEnd(idx, pos.lat, pos.lng);
        // Clear guard with a delay to ensure the map's residual click event is swallowed
        setTimeout(() => {
            (window as any).__markerDragging = false;
        }, 100);
    }, [idx, onDragEnd]);

    const handleClick = useCallback((e: any) => {
        L.DomEvent.stopPropagation(e.originalEvent);
        if (isAnchored) {
            onUnAnchor();
        } else {
            onAnchor(idx);
        }
    }, [idx, isAnchored, onAnchor, onUnAnchor]);

    const handleContextMenu = useCallback(() => {
        onRemove(idx);
    }, [idx, onRemove]);

    // Stable eventHandlers object — only changes when handlers change,
    // which only happens when their dependencies (primitives) change.
    const eventHandlers = React.useMemo(() => ({
        dragstart: handleDragStart,
        dragend: handleDragEnd,
        click: handleClick,
        contextmenu: handleContextMenu,
    }), [handleDragStart, handleDragEnd, handleClick, handleContextMenu]);

    return (
        <Marker
            ref={(ref: any) => { markerRef.current = ref; }}
            position={stage.coords as [number, number]}
            icon={icon}
            zIndexOffset={1000}
            draggable={isMovable}
            eventHandlers={eventHandlers}
        >
            <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>
                    {isMovable ? 'Glisser pour déplacer · Clic droit : supprimer' : 'Clic droit : supprimer'}
                </span>
            </Tooltip>
        </Marker>
    );
});

// ── Main component ────────────────────────────────────────────────────────────
export default function InteractiveStages() {
    const { state, dispatch } = useApp();
    const anchorIdx = state.anchor_stage_idx;

    // Failsafe: if the user releases the mouse anywhere, clear the drag guard
    useEffect(() => {
        const clear = () => { (window as any).__markerDragging = false; };
        window.addEventListener('mouseup', clear);
        return () => window.removeEventListener('mouseup', clear);
    }, []);

    const handleDragEnd = useCallback((idx: number, lat: number, lon: number) => {
        dispatch({ type: 'MOVE_STAGE', id: state.stages[idx].id, lat, lon });

        const stages = state.stages;
        const routes = state.routes;

        if (idx > 0) {
            const prevProfile = routes[idx - 1]?.profile || 'pedestrian';
            if (routes[idx - 1]) dispatch({ type: 'REMOVE_ROUTE', id: routes[idx - 1].id });
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recalcul des tronçons...' });
            backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-prev`, {
                p1: [stages[idx - 1].coords[0], stages[idx - 1].coords[1]],
                p2: [lat, lon],
                profile: prevProfile,
                small_roads: state.small_roads_only,
                insertIdx: idx - 1,
            });
        }
        if (idx < stages.length - 1) {
            const nextProfile = routes[idx]?.profile || 'pedestrian';
            if (routes[idx]) dispatch({ type: 'REMOVE_ROUTE', id: routes[idx].id });
            backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-next`, {
                p1: [lat, lon],
                p2: [stages[idx + 1].coords[0], stages[idx + 1].coords[1]],
                profile: nextProfile,
                small_roads: state.small_roads_only,
                insertIdx: idx,
            });
        }
    }, [state.stages, state.routes, state.small_roads_only, dispatch]);

    const handleRemove = useCallback((idx: number) => {
        const stages = state.stages;
        const routes = state.routes;
        const stage = stages[idx];
        dispatch({ type: 'REMOVE_STAGE', id: stage.id });

        if (idx > 0 && idx < stages.length - 1) {
            const bridgeProfile = routes[idx - 1]?.profile || routes[idx]?.profile || 'pedestrian';
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Reconnexion du tronçon...' });
            backgroundEngine.enqueue('route_leg', 0, `job-route-bridge-${Date.now()}`, {
                p1: [stages[idx - 1].coords[0], stages[idx - 1].coords[1]],
                p2: [stages[idx + 1].coords[0], stages[idx + 1].coords[1]],
                profile: bridgeProfile,
                small_roads: state.small_roads_only,
                insertIdx: idx - 1,
            });
        }
        if (anchorIdx >= idx) {
            dispatch({ type: 'SET_ANCHOR_STAGE', idx: -1 });
        }
    }, [state.stages, state.routes, state.small_roads_only, anchorIdx, dispatch]);

    const handleAnchor = useCallback((idx: number) => {
        dispatch({ type: 'SET_ANCHOR_STAGE', idx });
    }, [dispatch]);

    const handleUnAnchor = useCallback(() => {
        dispatch({ type: 'SET_ANCHOR_STAGE', idx: state.stages.length - 1 });
    }, [dispatch, state.stages.length]);

    const isMovable = state.active_tool === 'route' || state.active_tool === 'route_direct' || state.active_tool === 'node';

    return (
        <>
            {state.show_stages_on_map && state.stages.map((stage, idx) => (
                <StageMarker
                    key={stage.id}
                    stage={stage}
                    idx={idx}
                    total={state.stages.length}
                    isMovable={isMovable}
                    isAnchored={anchorIdx === idx}
                    onDragEnd={handleDragEnd}
                    onRemove={handleRemove}
                    onAnchor={handleAnchor}
                    onUnAnchor={handleUnAnchor}
                />
            ))}
        </>
    );
}

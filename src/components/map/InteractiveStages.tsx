import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';

export default function InteractiveStages() {
    const { state, dispatch } = useApp();
    const anchorIdx = state.anchor_stage_idx;

    const reRouteAdjacentLegs = (movedIdx: number, newLat: number, newLon: number) => {
        const stages = state.stages;

        if (movedIdx > 0) {
            const prevStage = stages[movedIdx - 1];
            if (state.routes[movedIdx - 1]) {
                dispatch({ type: 'REMOVE_ROUTE', id: state.routes[movedIdx - 1].id });
            }
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recalcul des tronçons...' });
            backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-prev`, {
                p1: [prevStage.coords[0], prevStage.coords[1]],
                p2: [newLat, newLon],
                profile: 'pedestrian',
                small_roads: state.small_roads_only,
                insertIdx: movedIdx - 1
            });
        }

        if (movedIdx < stages.length - 1) {
            const nextStage = stages[movedIdx + 1];
            if (state.routes[movedIdx]) {
                dispatch({ type: 'REMOVE_ROUTE', id: state.routes[movedIdx].id });
            }
            backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-next`, {
                p1: [newLat, newLon],
                p2: [nextStage.coords[0], nextStage.coords[1]],
                profile: 'pedestrian',
                small_roads: state.small_roads_only,
                insertIdx: movedIdx
            });
        }
    };

    const recalculateRouteLeg = (idx: number, newProfile: string) => {
        const stageA = state.stages[idx];
        const stageB = state.stages[idx + 1];
        if (!stageA || !stageB) return;

        dispatch({ type: 'REMOVE_ROUTE', id: state.routes[idx].id });
        dispatch({ type: 'SET_LOADING', isLoading: true, text: newProfile === 'direct' ? 'Ligne droite...' : 'Routage (BRouter)...' });
        backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}`, {
            p1: [stageA.coords[0], stageA.coords[1]],
            p2: [stageB.coords[0], stageB.coords[1]],
            profile: newProfile,
            small_roads: state.small_roads_only,
            insertIdx: idx
        });
    };

    return (
        <>
            {state.show_stages_on_map && state.stages.map((stage, idx) => {
                const isAnchored = anchorIdx === idx;
                const isMovable = state.active_tool === 'route' || state.active_tool === 'route_direct' || state.active_tool === 'node';

                const isFirst = idx === 0;
                const isLast = idx === state.stages.length - 1;
                const dotColor = isFirst ? 'var(--semantic-green)' : isLast ? 'var(--semantic-red)' : 'var(--accent-default)';

                const markerHtml = isAnchored
                    ? `<div style="width:32px;height:32px;border-radius:8px;background:#fff;border:3px solid #2d8ceb;color:#2d8ceb;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(45,140,235,0.35),0 3px 8px rgba(0,0,0,0.5);font-family:'Inter',sans-serif;">${stage.label}</div>`
                    : `<div style="width:28px;height:28px;border-radius:8px;background:#fff;border:2px solid ${dotColor};color:${dotColor};font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.5);font-family:'Inter',sans-serif;">${stage.label}</div>`;

                const icon = L.divIcon({
                    className: 'custom-stage-marker',
                    html: markerHtml,
                    iconSize: isAnchored ? [32, 32] : [28, 28],
                    iconAnchor: isAnchored ? [16, 16] : [14, 14]
                });
                return (
                    <Marker
                        key={stage.id}
                        position={stage.coords as [number, number]}
                        icon={icon}
                        zIndexOffset={1000}
                        draggable={isMovable}
                        eventHandlers={{
                            click: (e) => {
                                L.DomEvent.stopPropagation(e.originalEvent as any);
                                if (state.active_tool === 'route' || state.active_tool === 'route_direct') {
                                    if (anchorIdx === idx) {
                                        // Un-anchor → revert to last stage
                                        dispatch({ type: 'SET_ANCHOR_STAGE', idx: state.stages.length - 1 });
                                    } else {
                                        dispatch({ type: 'SET_ANCHOR_STAGE', idx });
                                    }
                                }
                            },
                            dragend: (e) => {
                                const marker = e.target;
                                const pos = marker.getLatLng();
                                dispatch({ type: 'MOVE_STAGE', id: stage.id, lat: pos.lat, lon: pos.lng });
                                reRouteAdjacentLegs(idx, pos.lat, pos.lng);
                            },
                            contextmenu: () => {
                                dispatch({ type: 'REMOVE_STAGE', id: stage.id });
                                if (idx > 0 && idx < state.stages.length - 1) {
                                    const prevStage = state.stages[idx - 1];
                                    const nextStage = state.stages[idx + 1];
                                    dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Reconnexion du tronçon...' });
                                    backgroundEngine.enqueue('route_leg', 0, `job-route-bridge-${Date.now()}`, {
                                        p1: [prevStage.coords[0], prevStage.coords[1]],
                                        p2: [nextStage.coords[0], nextStage.coords[1]],
                                        profile: 'pedestrian',
                                        small_roads: state.small_roads_only,
                                        insertIdx: idx - 1
                                    });
                                }
                                if (anchorIdx >= idx) {
                                    dispatch({ type: 'SET_ANCHOR_STAGE', idx: -1 });
                                }
                            }
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -10]} opacity={0.9}>
                            <span style={{ fontSize: '11px', fontWeight: 600 }}>Clic droit : supprimer</span>
                        </Tooltip>
                    </Marker>
                );
            })}
        </>
    );
}

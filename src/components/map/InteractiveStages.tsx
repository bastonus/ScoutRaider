import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';

export default function InteractiveStages() {
    const { state, dispatch } = useApp();
    const anchorIdx = state.anchor_stage_idx;

    const reRouteAdjacentLegs = (movedIdx: number, newLat: number, newLon: number) => {
        const stages = state.stages;

        // Re-route leg FROM previous stage TO moved stage
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

        // Re-route leg FROM moved stage TO next stage
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

    return (
        <>
            {state.stages.map((stage, idx) => {
                const isAnchored = anchorIdx === idx;
                const isMovable = state.active_tool === 'route' || state.active_tool === 'node';

                // Anchored stage: white ring + glow to indicate insertion point
                const markerHtml = isAnchored
                    ? `<div style="width:32px;height:32px;border-radius:50%;background:#fff;border:3px solid #2d8ceb;color:#2d8ceb;font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(45,140,235,0.35),0 3px 8px rgba(0,0,0,0.5);font-family:'Inter',sans-serif;">${stage.label}</div>`
                    : `<div style="width:28px;height:28px;border-radius:50%;background:#fff;border:3px solid var(--accent-default);color:var(--accent-default);font-weight:900;font-size:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.5);font-family:'Inter',sans-serif;">${stage.label}</div>`;

                const legacyIcon = L.divIcon({
                    className: 'custom-stage-marker',
                    html: markerHtml,
                    iconSize: isAnchored ? [32, 32] : [28, 28],
                    iconAnchor: isAnchored ? [16, 16] : [14, 14]
                });

                return (
                    <Marker
                        key={stage.id}
                        position={stage.coords as [number, number]}
                        icon={legacyIcon}
                        zIndexOffset={1000}
                        draggable={isMovable}
                        eventHandlers={{
                            click: () => {
                                // In route tool: toggle anchor on/off for this stage
                                if (state.active_tool === 'route') {
                                    if (anchorIdx === idx) {
                                        // Un-anchor: back to appending at end
                                        dispatch({ type: 'SET_ANCHOR_STAGE', idx: state.stages.length - 1 });
                                    } else {
                                        // Anchor on this stage: next map click inserts after it
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
                                // Right-click: delete stage
                                dispatch({ type: 'REMOVE_STAGE', id: stage.id });

                                // Bridge the gap if deleting a middle stage
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

                                // Reset anchor if the anchored stage was deleted
                                if (anchorIdx >= idx) {
                                    dispatch({ type: 'SET_ANCHOR_STAGE', idx: -1 });
                                }
                            }
                        }}
                    >
                        <Popup>
                            <div style={{ textAlign: 'center', minWidth: '100px' }}>
                                <strong>Étape {stage.label}</strong>
                                <br />
                                <span style={{ fontSize: '10px', color: '#666' }}>
                                    {stage.coords[0].toFixed(5)}, {stage.coords[1].toFixed(5)}
                                </span>
                                <br />
                                {state.active_tool === 'route' && (
                                    <span style={{ fontSize: '10px', color: '#2d8ceb' }}>
                                        {isAnchored ? '📌 Ancré — cliquez carte pour insérer après' : 'Clic pour ancrer ici'}
                                    </span>
                                )}
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
}

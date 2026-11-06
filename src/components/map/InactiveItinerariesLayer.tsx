import React from 'react';
import { Polyline, Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { Itinerary } from '../../logic/types';
import { layerPaneName } from '../../logic/LayerOrder';

export default function InactiveItinerariesLayer() {
    const { state, dispatch } = useApp();
    const itineraries = state.itineraries || [];
    const activeId = state.active_itinerary_id;
    const selectedId = state.selected_layer_id;

    const isRouteTool = ['route', 'route_direct', 'node', 'azimut'].includes(state.active_tool);
    // Active itinerary is focused ONLY if it is selected and tool is a route tool
    const isItinActiveAndSelected = selectedId === activeId;
    const hasFocusedItin = isRouteTool && isItinActiveAndSelected;

    // All visible itineraries that are not currently in active-editing mode
    // (If user selected an Area/Point/Draw or no layer, ALL itineraries are dashed!)
    const dashedItineraries = itineraries.filter(it => {
        if (it.visible === false) return false;
        if (it.id === activeId) {
            return !hasFocusedItin;
        }
        return true;
    });

    if (dashedItineraries.length === 0) return null;

    const handleSelectItin = (itinId: string, itinName: string) => {
        // Don't steal focus from annotation tools (draw, area, point)
        const annotationTools = ['annotate_point', 'annotate_area', 'annotate_area_routed', 'annotate_draw'];
        if (annotationTools.includes(state.active_tool)) return;
        dispatch({ type: 'SET_SELECTED_LAYER', id: itinId });
        dispatch({ type: 'ADD_NOTIFICATION', message: `Itinéraire actif : ${itinName}`, notifType: 'info' });
    };

    return (
        <>
            {dashedItineraries.map((itin: Itinerary) => {
                const color = itin.color || '#2d8ceb';
                const routes = (itin.id === activeId) ? state.routes : (itin.routes || []);
                const stages = (itin.id === activeId) ? state.stages : (itin.stages || []);

                // Collect polylines from routes
                const polylines = routes.map((r: any) => {
                    if (!r) return null;
                    const coords = r.geojson?.geometry?.coordinates || r.geojson?.coordinates || [];
                    return coords.map((c: any) => [c[1], c[0]] as [number, number]);
                }).filter((pts): pts is [number, number][] => Boolean(pts && pts.length > 1));

                // Fallback straight lines if no BRouter geometry yet but stages exist
                const fallbackLine: [number, number][] = polylines.length === 0 && stages.length >= 2
                    ? stages.map(s => s.coords as [number, number])
                    : [];

                return (
                    <React.Fragment key={`inactive-itin-${itin.id}`}>
                        {/* 1. BRouter routes (if any) */}
                        {polylines.map((positions, pIdx) => (
                            <React.Fragment key={`itin-${itin.id}-poly-${pIdx}`}>
                                {/* Wider hit-area stroke for clicking */}
                                <Polyline
                                    positions={positions}
                                    pane={layerPaneName(itin.id)}
                                    pathOptions={{ color: 'transparent', weight: 26, interactive: true } as any}
                                    eventHandlers={{
                                        click: (e) => {
                                            L.DomEvent.stopPropagation(e);
                                            handleSelectItin(itin.id, itin.name);
                                        }
                                    }}
                                >
                                    <Tooltip sticky>
                                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', padding: '2px 4px' }}>
                                            <span style={{ fontWeight: 700, color }}>{itin.name}</span>
                                            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>Clic : sélectionner cet itinéraire</div>
                                        </div>
                                    </Tooltip>
                                </Polyline>
                                
                                {/* Visible dashed route */}
                                <Polyline
                                    positions={positions}
                                    pane={layerPaneName(itin.id)}
                                    pathOptions={{
                                        color,
                                        weight: 5,
                                        opacity: 0.82,
                                        dashArray: '7, 6',
                                        interactive: false,
                                    } as any}
                                />
                            </React.Fragment>
                        ))}

                        {/* 2. Fallback straight line if routes are not yet computed */}
                        {fallbackLine.length >= 2 && (
                            <React.Fragment key={`itin-${itin.id}-fallback`}>
                                <Polyline
                                    positions={fallbackLine}
                                    pane={layerPaneName(itin.id)}
                                    pathOptions={{ color: 'transparent', weight: 26, interactive: true } as any}
                                    eventHandlers={{
                                        click: (e) => {
                                            L.DomEvent.stopPropagation(e);
                                            handleSelectItin(itin.id, itin.name);
                                        }
                                    }}
                                >
                                    <Tooltip sticky>
                                        <div style={{ fontSize: '11px', fontFamily: 'var(--font-ui)', padding: '2px 4px' }}>
                                            <span style={{ fontWeight: 700, color }}>{itin.name}</span>
                                            <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>Clic : sélectionner cet itinéraire</div>
                                        </div>
                                    </Tooltip>
                                </Polyline>
                                <Polyline
                                    positions={fallbackLine}
                                    pane={layerPaneName(itin.id)}
                                    pathOptions={{
                                        color,
                                        weight: 4,
                                        opacity: 0.75,
                                        dashArray: '7, 6',
                                        interactive: false,
                                    } as any}
                                />
                            </React.Fragment>
                        )}

                        {/* 3. Stage markers */}
                        {stages.map((stage, sIdx) => {
                            const isFirst = sIdx === 0;
                            const isLast = sIdx === stages.length - 1;
                            const badgeBorder = isFirst ? '#10b981' : isLast ? '#ef4444' : color;

                            const icon = L.divIcon({
                                className: 'inactive-stage-marker',
                                html: `
                                    <div style="
                                        width: 22px;
                                        height: 22px;
                                        border-radius: 6px;
                                        background: rgba(14, 22, 17, 0.95);
                                        border: 2px solid ${badgeBorder};
                                        color: ${color};
                                        font-weight: 800;
                                        font-size: 11px;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        box-shadow: 0 2px 6px rgba(0,0,0,0.6);
                                        font-family: 'Inter', sans-serif;
                                        cursor: pointer;
                                    ">
                                        ${stage.label}
                                    </div>
                                `,
                                iconSize: [22, 22],
                                iconAnchor: [11, 11]
                            });

                            return (
                                <Marker
                                    key={`itin-${itin.id}-stage-${stage.id || sIdx}`}
                                    position={stage.coords as [number, number]}
                                    icon={icon}
                                    pane={layerPaneName(itin.id)}
                                    zIndexOffset={500}
                                    eventHandlers={{
                                        click: (e) => {
                                            L.DomEvent.stopPropagation(e);
                                            handleSelectItin(itin.id, itin.name);
                                        }
                                    }}
                                >
                                    <Tooltip direction="top" offset={[0, -12]}>
                                        <div style={{ fontSize: '11px', fontWeight: 600 }}>
                                            <span style={{ color }}>{itin.name}</span> — Étape {stage.label}
                                            {stage.address ? <div style={{ fontSize: '9px', color: '#999' }}>{stage.address}</div> : null}
                                        </div>
                                    </Tooltip>
                                </Marker>
                            );
                        })}
                    </React.Fragment>
                );
            })}
        </>
    );
}

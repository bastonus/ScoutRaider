import React from 'react';
import { Polyline, Marker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { Itinerary } from '../../logic/types';

export default function InactiveItinerariesLayer() {
    const { state, dispatch } = useApp();
    const itineraries = state.itineraries || [];
    const activeId = state.active_itinerary_id;

    // Filter itineraries that are visible and NOT active
    const inactiveVisible = itineraries.filter(it => it.id !== activeId && it.visible);

    if (inactiveVisible.length === 0) return null;

    return (
        <>
            {inactiveVisible.map((itin: Itinerary) => {
                const color = itin.color || '#f97316';

                // Collect polylines from routes
                const polylines = (itin.routes || []).map((r: any) => {
                    if (!r) return null;
                    const coords = r.geojson?.geometry?.coordinates || r.geojson?.coordinates || [];
                    return coords.map((c: any) => [c[1], c[0]] as [number, number]);
                }).filter((pts): pts is [number, number][] => Boolean(pts && pts.length > 1));

                // Stages
                const stages = itin.stages || [];

                return (
                    <React.Fragment key={`itin-layer-${itin.id}`}>
                        {/* Route legs */}
                        {polylines.map((positions, pIdx) => (
                            <React.Fragment key={`itin-${itin.id}-poly-${pIdx}`}>
                                {/* Wider invisible stroke for easy clicking */}
                                <Polyline
                                    positions={positions}
                                    color="transparent"
                                    weight={24}
                                    interactive={true}
                                >
                                    <Tooltip sticky>
                                        <div style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', padding: '2px 4px' }}>
                                            <span style={{ fontWeight: 700, color }}>{itin.name}</span>
                                            <div style={{ fontSize: '10px', color: '#aaa' }}>Cliquer pour activer cet itinéraire</div>
                                        </div>
                                    </Tooltip>
                                    <Popup>
                                        <div style={{ padding: '6px', textAlign: 'center', minWidth: '160px' }}>
                                            <div style={{ fontWeight: 700, color, marginBottom: '6px' }}>{itin.name}</div>
                                            <button
                                                type="button"
                                                onClick={() => dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id })}
                                                style={{
                                                    background: color,
                                                    color: '#fff',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontWeight: 600,
                                                    fontSize: '11px',
                                                    width: '100%'
                                                }}
                                            >
                                                Éditer cet itinéraire
                                            </button>
                                        </div>
                                    </Popup>
                                </Polyline>
                                
                                {/* Visible route stroke */}
                                <Polyline
                                    positions={positions}
                                    color={color}
                                    weight={5}
                                    opacity={0.85}
                                    dashArray="7, 6"
                                    interactive={false}
                                />
                            </React.Fragment>
                        ))}

                        {/* Stage markers */}
                        {stages.map((stage, sIdx) => {
                            const isFirst = sIdx === 0;
                            const isLast = sIdx === stages.length - 1;
                            const badgeBorder = isFirst ? '#10b981' : isLast ? '#ef4444' : color;

                            const icon = L.divIcon({
                                className: 'inactive-stage-marker',
                                html: `
                                    <div style="
                                        width: 24px;
                                        height: 24px;
                                        border-radius: 6px;
                                        background: rgba(20, 26, 22, 0.92);
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
                                iconSize: [24, 24],
                                iconAnchor: [12, 12]
                            });

                            return (
                                <Marker
                                    key={`itin-${itin.id}-stage-${stage.id || sIdx}`}
                                    position={stage.coords as [number, number]}
                                    icon={icon}
                                    eventHandlers={{
                                        click: () => {
                                            dispatch({ type: 'SET_ACTIVE_ITINERARY', id: itin.id });
                                            dispatch({ type: 'ADD_NOTIFICATION', message: `Itinéraire actif : ${itin.name}`, notifType: 'info' });
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

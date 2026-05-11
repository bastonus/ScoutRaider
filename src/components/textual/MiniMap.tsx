/**
 * MiniMap.tsx — Carte miniature pour les modules IGN et Drapeaux.
 * Retient le zoom et la position via AppContext (PERSIST_MAP_STATE).
 */
import React, { useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useApp } from '../../AppContext';
import { MODULE_META } from '../../logic/ModuleRegistry';
import { MAP_LAYERS } from '../../logic/MapConfig';

interface MiniMapProps {
    stepId: string;
    moduleId: string;
    coords: [number, number][];
    initialPersist?: { zoom: number; center: [number, number]; bounds?: any };
}

function MapPersister({ stepId }: { stepId: string }) {
    const { dispatch } = useApp();
    useMapEvents({
        moveend: (e) => {
            const map = e.target;
            dispatch({
                type: 'PERSIST_MAP_STATE',
                stepId,
                zoom: map.getZoom(),
                center: [map.getCenter().lat, map.getCenter().lng],
                bounds: [
                    [map.getBounds().getSouthWest().lat, map.getBounds().getSouthWest().lng],
                    [map.getBounds().getNorthEast().lat, map.getBounds().getNorthEast().lng]
                ]
            });
        }
    });
    return null;
}

function MiniDynamicTileLayer() {
    const { state } = useApp();
    const layerId = state.active_ign_layer || 'PLAN.IGN';
    const layer = MAP_LAYERS[layerId] || MAP_LAYERS['PLAN.IGN'];
    
    // Inject API key if needed
    let finalUrl = layer.url;
    if (layerId.startsWith('MAPY_')) {
        finalUrl = finalUrl.replace('{key}', state.mapy_api_key || '');
    } else if (layer.category === 'IGN (Privé)') {
        finalUrl = finalUrl.replace('{key}', state.ign_api_key || '');
    }

    return (
        <TileLayer
            key={layerId + (state.mapy_api_key || '') + (state.ign_api_key || '')}
            url={finalUrl}
            maxZoom={layer.maxZoom}
        />
    );
}

export default function MiniMap({ stepId, moduleId, coords, initialPersist }: MiniMapProps) {
    if (coords.length < 2) return null;

    const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
    const color = MODULE_META[moduleId as keyof typeof MODULE_META]?.color || '#6b7280';
    
    // Si on a un état persisté, on l'utilise
    const center = initialPersist?.center || latLngs[0];
    const zoom = initialPersist?.zoom || 15;
    const bounds = initialPersist?.bounds ? L.latLngBounds(initialPersist.bounds) : L.latLngBounds(latLngs);

    return (
        <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--bg-border)', resize: 'vertical' }}>
            <MapContainer 
                center={initialPersist ? center : undefined} 
                zoom={initialPersist ? zoom : undefined}
                bounds={initialPersist ? undefined : bounds} 
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
            >
                <MiniDynamicTileLayer />
                <Polyline positions={latLngs} pathOptions={{ color, weight: 4, opacity: 0.9 }} />
                <MapPersister stepId={stepId} />
            </MapContainer>
        </div>
    );
}

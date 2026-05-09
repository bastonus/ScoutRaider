import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import ActiveRouteLayer from './ActiveRouteLayer';
import InteractiveStages from './InteractiveStages';
import CursorPreviewLine from './CursorPreviewLine';

// Fix default marker icons (leaflet bundling issue with Vite)
const DefaultIcon = L.icon({
    iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
    shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Global map ref accessible from sibling components
export const mapRef: { current: L.Map | null } = { current: null };

// ── Satellite layer URLs (IGN France) ────────────────────────────────────────
export const IGN_PLAN_URL =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile' +
    '&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png' +
    '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

export const IGN_SAT_URL =
    'https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile' +
    '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
    '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

// ── Inner component: captures map instance ───────────────────────────────────
function MapRefCapture() {
    const map = useMap();
    useEffect(() => {
        mapRef.current = map;
        return () => { mapRef.current = null; };
    }, [map]);
    return null;
}

// ── Inner component: handles container resize ────────────────────────────────
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize();
        });
        const container = map.getContainer();
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    }, [map]);
    return null;
}

// ── Satellite tile layer controlled externally ───────────────────────────────
export let satLayerRef: { current: L.TileLayer | null } = { current: null };
export let planLayerRef: { current: L.TileLayer | null } = { current: null };

function SatelliteLayer({ active }: { active: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (!satLayerRef.current) {
            satLayerRef.current = L.tileLayer(IGN_SAT_URL, { attribution: '&copy; IGN', maxZoom: 19 });
        }
        if (!planLayerRef.current) {
            // plan layer is already added by TileLayer JSX; just grab reference
        }
        if (active) {
            if (!map.hasLayer(satLayerRef.current)) satLayerRef.current.addTo(map);
        } else {
            if (map.hasLayer(satLayerRef.current)) map.removeLayer(satLayerRef.current);
        }
    }, [active, map]);
    return null;
}

// ── POI Layer ────────────────────────────────────────────────────────────────
import { Marker, Popup } from 'react-leaflet';

const customPoiIcon = new L.DivIcon({
    className: 'custom-poi-marker',
    html: `<div style="background-color: #fbbf24; width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 0 6px rgba(0,0,0,0.5);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
});

function PoiLayer() {
    const { state } = useApp();
    if (!state.show_pois_on_map) return null;

    // Collect all unique POIs from segment_pois
    const pois = new Map<string, any>();
    if (state.segment_pois) {
        Object.values(state.segment_pois).forEach(segmentPois => {
            segmentPois.forEach((poi: any) => {
                if (poi.lat && poi.lon) {
                    pois.set(poi.id, poi);
                }
            });
        });
    }

    return (
        <>
            {Array.from(pois.values()).map(poi => (
                <Marker key={poi.id} position={[poi.lat, poi.lon]} icon={customPoiIcon}>
                    <Popup className="poi-popup">
                        <div style={{ padding: '4px 8px', fontSize: '13px', fontWeight: 600, color: '#fbbf24', textAlign: 'center' }}>
                            {poi.name}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </>
    );
}

function MapEvents({ setCursorPos }: { setCursorPos: (pos: [number, number] | null) => void }) {
    const { state, dispatch } = useApp();
    const activeTool = state.active_tool;
    const stages = state.stages;
    const smallRoads = state.small_roads_only;

    useMapEvents({
        mousemove(e) {
            if (activeTool === 'route' && stages.length > 0) {
                setCursorPos([e.latlng.lat, e.latlng.lng]);
            } else {
                setCursorPos(null);
            }
        },
        mouseout() {
            setCursorPos(null);
        },
        click(e) {
            const lat = e.latlng.lat;
            const lon = e.latlng.lng;

            if (activeTool === 'route') {
                const anchorIdx = state.anchor_stage_idx;
                const nextLabel = String.fromCharCode(65 + stages.length);

                const anchorStage = anchorIdx >= 0 && anchorIdx < stages.length
                    ? stages[anchorIdx] : null;
                const nextOfAnchor = anchorIdx >= 0 && anchorIdx < stages.length - 1
                    ? stages[anchorIdx + 1] : null;

                dispatch({ type: 'ADD_STAGE', lat, lon, label: nextLabel });

                if (anchorStage && nextOfAnchor) {
                    if (state.routes[anchorIdx]) {
                        dispatch({ type: 'REMOVE_ROUTE', id: state.routes[anchorIdx].id });
                    }
                    dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Routage (BRouter)...' });
                    backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-a`, {
                        p1: [anchorStage.coords[0], anchorStage.coords[1]],
                        p2: [lat, lon],
                        profile: 'pedestrian',
                        small_roads: smallRoads,
                        insertIdx: anchorIdx
                    });
                    backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-b`, {
                        p1: [lat, lon],
                        p2: [nextOfAnchor.coords[0], nextOfAnchor.coords[1]],
                        profile: 'pedestrian',
                        small_roads: smallRoads,
                        insertIdx: anchorIdx + 1
                    });
                } else if (stages.length > 0) {
                    const lastStage = anchorStage || stages[stages.length - 1];
                    const jobId = `job-route-${Date.now()}`;
                    dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Routage (BRouter)...' });
                    backgroundEngine.enqueue('route_leg', 0, jobId, {
                        p1: [lastStage.coords[0], lastStage.coords[1]],
                        p2: [lat, lon],
                        profile: 'pedestrian',
                        small_roads: smallRoads,
                        insertIdx: stages.length - 1
                    });
                }
            } else if (activeTool === 'node') {
                console.log('Adding un nœud over', lat, lon);
            }
        }
    });
    return null;
}

export default function MapComponent() {
    const { state, dispatch } = useApp();
    const [cursorPos, setCursorPos] = React.useState<[number, number] | null>(null);
    const [isSatellite, setIsSatellite] = React.useState(false);
    const position: [number, number] = [48.8566, 2.3522];

    // Expose satellite toggle globally so FloatingSearch can call it
    useEffect(() => {
        (window as any).__mapToggleSatellite = () => setIsSatellite(prev => !prev);
        return () => { delete (window as any).__mapToggleSatellite; };
    }, []);

    const onMapDrop = (e: React.DragEvent) => {
        const moduleId = e.dataTransfer.getData('application/x-scoutraider-module') || e.dataTransfer.getData('text/plain');
        if (!moduleId) return;

        e.preventDefault();
        const map = (window as any).__leafletMap;
        if (!map) return;

        const dropPoint = map.mouseEventToContainerPoint(e.nativeEvent);
        let closestIdx = -1;
        let minPixelDist = Infinity;

        const steps = state.polygonal_steps;
        for (let i = 0; i < steps.length; i++) {
            const coords = steps[i].coords;
            if (coords.length < 2) continue;
            
            for (let j = 0; j < coords.length - 1; j++) {
                const pt1 = coords[j];
                const pt2 = coords[j+1];
                const a = map.latLngToContainerPoint([pt1[1], pt1[0]]);
                const b = map.latLngToContainerPoint([pt2[1], pt2[0]]);
                const p = dropPoint;
                
                const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
                let dist = 0;
                if (l2 === 0) {
                    dist = Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));
                } else {
                    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
                    dist = Math.sqrt(Math.pow(p.x - proj.x, 2) + Math.pow(p.y - proj.y, 2));
                }

                if (dist < minPixelDist) {
                    minPixelDist = dist;
                    closestIdx = i;
                }
            }
        }

        if (closestIdx !== -1 && minPixelDist < 50) {
            dispatch({ type: 'ASSIGN_MODULES_RANGE', startIdx: closestIdx, endIdx: closestIdx, moduleId });
        } else {
            dispatch({ type: 'ADD_NOTIFICATION', message: `Aucun tronçon suffisamment proche.`, notifType: 'warning' });
        }
    };

    return (
        <div 
            style={{ width: '100%', height: '100%', position: 'relative' }}
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }}
            onDragEnter={(e) => e.preventDefault()}
            onDrop={onMapDrop}
        >
            <MapContainer
                center={position}
                zoom={13}
                style={{ height: '100%', width: '100%', cursor: ['route', 'node', 'azimut'].includes(state.active_tool) ? 'crosshair' : 'grab' }}
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.ign.fr/">IGN</a>'
                    url={IGN_PLAN_URL}
                />
                <SatelliteLayer active={isSatellite} />
                <MapRefCapture />
                <MapResizer />
                <MapEvents setCursorPos={setCursorPos} />
                <PoiLayer />
                <ActiveRouteLayer />
                <CursorPreviewLine cursorPos={cursorPos} />
                <InteractiveStages />
            </MapContainer>
        </div>
    );
}

/**
 * MiniMap.tsx — Carte carrée redimensionnable pour le carnet de route (façon Image).
 * 
 * Spécifications :
 * - Dimensions canoniques pérennes (width & height en pixels enregistrés et respectés à l'export).
 * - Affichage homothétique sur petits écrans (transform: scale) : la carte conserve sa forme, son ratio
 *   et son emprise géographique de manière solidaire sans être découpée ni déformée.
 * - Format carré strict (borderRadius: 0), bordure nette et 4 points aux coins (handles).
 * - Échelle calibrée par défaut à 1:25 000 (Top 25 IGN standard).
 * - Désactivation du zoom molette intempestif (scrollWheelZoom={false}, Ctrl+molette pour zoomer).
 * - Synchronisation avec la barre d'encodage au hover de l'étape.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useApp } from '../../AppContext';
import { MODULE_META } from '../../logic/ModuleRegistry';
import { MAP_LAYERS } from '../../logic/MapConfig';

// ── Calculs cartographiques d'échelle (EPSG:3857 @ 96 DPI) ───────────────────
const SCALE_CONSTANT = 591657550.5;

export function calculateZoomForScale(scaleDenominator: number, lat: number): number {
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const z = Math.log2((SCALE_CONSTANT * cosLat) / scaleDenominator);
    return Math.round(z * 4) / 4;
}

export function calculateScaleForZoom(zoom: number, lat: number): number {
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    return Math.round((SCALE_CONSTANT * cosLat) / Math.pow(2, zoom));
}

// ── Types ───────────────────────────────────────────────────────────────────

interface MiniMapProps {
    stepId: string;
    moduleId: string;
    coords: [number, number][];
    initialPersist?: {
        zoom: number;
        center: [number, number];
        bounds?: [[number, number], [number, number]];
        height?: number;
        width?: number; // Largeur canonique en pixels
        widthPercent?: number;
        alignment?: 'left' | 'center' | 'right';
        scaleName?: string;
        layerId?: string;
        isLocked?: boolean;
    };
}

// ── Contrôleur de vue synchronisé avec le state ──────────────────────────────
function MapViewController({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        const currentCenter = map.getCenter();
        const currentZoom = map.getZoom();
        const latDiff = Math.abs(currentCenter.lat - center[0]);
        const lngDiff = Math.abs(currentCenter.lng - center[1]);
        const zoomDiff = Math.abs(currentZoom - zoom);
        if (latDiff > 0.0001 || lngDiff > 0.0001 || zoomDiff > 0.1) {
            map.setView(center, zoom, { animate: true });
        }
    }, [map, center, zoom]);
    return null;
}

// ── Persistance des mouvements utilisateur ──────────────────────────────────
function MapPersister({
    stepId,
    onStateChange
}: {
    stepId: string;
    onStateChange: (zoom: number, center: [number, number], bounds: [[number, number], [number, number]]) => void;
}) {
    useMapEvents({
        moveend: (e) => {
            const map = e.target;
            const center: [number, number] = [map.getCenter().lat, map.getCenter().lng];
            const bounds: [[number, number], [number, number]] = [
                [map.getBounds().getSouthWest().lat, map.getBounds().getSouthWest().lng],
                [map.getBounds().getNorthEast().lat, map.getBounds().getNorthEast().lng]
            ];
            onStateChange(map.getZoom(), center, bounds);
        }
    });
    return null;
}

// ── Redimensionnement ResizeObserver ─────────────────────────────────────────
function MapResizer() {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        const container = map.getContainer();
        const ro = new ResizeObserver(() => {
            map.invalidateSize({ debounceMoveend: true });
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, [map]);
    return null;
}

// ── Contrôle d'échelle métrique Leaflet ─────────────────────────────────────
function MapScaleControl() {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        const scale = L.control.scale({ imperial: false, metric: true, position: 'bottomleft' });
        scale.addTo(map);
        return () => {
            scale.remove();
        };
    }, [map]);
    return null;
}

// ── Verrouillage du déplacement (Pan Lock) ──────────────────────────────────
function MapLockController({ isLocked }: { isLocked: boolean }) {
    const map = useMap();
    useEffect(() => {
        if (!map) return;
        if (isLocked) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.doubleClickZoom.disable();
            map.boxZoom.disable();
            map.keyboard.disable();
        } else {
            map.dragging.enable();
            map.touchZoom.enable();
            map.doubleClickZoom.enable();
            map.boxZoom.enable();
            map.keyboard.enable();
        }
    }, [map, isLocked]);
    return null;
}

// ── Gestion de la molette contextuelle (Ctrl + Molette pour zoomer) ──────────
function MapWheelController() {
    const map = useMap();
    const [showCtrlHint, setShowCtrlHint] = useState(false);
    const hintTimerRef = useRef<any>(null);

    useEffect(() => {
        if (!map) return;
        const container = map.getContainer();
        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY;
                if (delta < 0) {
                    map.zoomIn(0.5);
                } else {
                    map.zoomOut(0.5);
                }
            } else {
                setShowCtrlHint(true);
                clearTimeout(hintTimerRef.current);
                hintTimerRef.current = setTimeout(() => setShowCtrlHint(false), 1400);
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
            clearTimeout(hintTimerRef.current);
        };
    }, [map]);

    if (!showCtrlHint) return null;

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.4)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 400,
            pointerEvents: 'none',
            fontSize: '11px',
            fontWeight: 600,
            backdropFilter: 'blur(2px)',
        }}>
            <span style={{
                background: 'rgba(15, 23, 42, 0.92)',
                padding: '6px 14px',
                borderRadius: '4px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <span>💡</span>
                <span>Maintenez <b>Ctrl</b> + molette pour zoomer la carte</span>
            </span>
        </div>
    );
}

// ── Tuiles cartographiques dynamiques ────────────────────────────────────────
function MiniDynamicTileLayer({ overrideLayerId }: { overrideLayerId?: string }) {
    const { state } = useApp();
    const layerId = overrideLayerId || state.active_ign_layer || 'PLAN.IGN';
    const layer = MAP_LAYERS[layerId] || MAP_LAYERS['PLAN.IGN'];

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
            attribution={layer.attribution}
        />
    );
}

// ── Pont impératif pour boutons de zoom locaux ───────────────────────────────
function MapControllerBridge({
    bridgeRef
}: {
    bridgeRef: React.MutableRefObject<{
        zoomIn: () => void;
        zoomOut: () => void;
    } | null>;
}) {
    const map = useMap();
    useEffect(() => {
        bridgeRef.current = {
            zoomIn: () => map.zoomIn(0.5),
            zoomOut: () => map.zoomOut(0.5),
        };
        return () => {
            bridgeRef.current = null;
        };
    }, [map, bridgeRef]);
    return null;
}

// ── COMPOSANT PRINCIPAL ─────────────────────────────────────────────────────

export default function MiniMap({ stepId, moduleId, coords, initialPersist }: MiniMapProps) {
    const { state, dispatch } = useApp();

    if (!coords || coords.length < 2) return null;

    const latLngs = useMemo(() => coords.map(c => [c[1], c[0]] as [number, number]), [coords]);
    const midPoint = latLngs[Math.floor(latLngs.length / 2)] || latLngs[0];
    const defaultBounds = useMemo(() => L.latLngBounds(latLngs), [latLngs]);
    const routeColor = MODULE_META[moduleId as keyof typeof MODULE_META]?.color || '#3b82f6';

    // ── Échelle et Zoom par défaut : 1:25 000 ──
    const zoom25k = useMemo(() => calculateZoomForScale(25000, midPoint[0]), [midPoint]);
    const zoom = initialPersist?.zoom !== undefined ? initialPersist.zoom : zoom25k;
    const center = initialPersist?.center || midPoint;

    // ── Dimensions canoniques réelles (pour l'affichage et l'export) ──
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [wrapperAvailableWidth, setWrapperAvailableWidth] = useState<number>(750);

    // Observe la largeur disponible réelle du conteneur parent
    useEffect(() => {
        if (!wrapperRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setWrapperAvailableWidth(Math.round(entry.contentRect.width));
                }
            }
        });
        ro.observe(wrapperRef.current);
        return () => ro.disconnect();
    }, []);

    // Largeur canonique désirée par l'utilisateur
    const canonicalWidth = useMemo(() => {
        if (initialPersist?.width) return initialPersist.width;
        if (initialPersist?.widthPercent && wrapperAvailableWidth > 0) {
            return Math.round((wrapperAvailableWidth * initialPersist.widthPercent) / 100);
        }
        return Math.min(wrapperAvailableWidth || 750, 720);
    }, [initialPersist?.width, initialPersist?.widthPercent, wrapperAvailableWidth]);

    const canonicalHeight = initialPersist?.height || 340;
    const alignment = initialPersist?.alignment || 'center';
    const isLocked = initialPersist?.isLocked || false;
    const layerId = initialPersist?.layerId || '';

    // ── Facteur d'échelle d'affichage homothétique sur petits écrans ──
    // Si la carte est plus large que l'espace disponible (ex: mobile, petit écran, split-view),
    // on réduit son échelle visuelle solidairement (scale) sans couper ni déformer la forme !
    const scaleFactor = useMemo(() => {
        if (wrapperAvailableWidth > 0 && canonicalWidth > wrapperAvailableWidth) {
            return Math.max(0.2, wrapperAvailableWidth / canonicalWidth);
        }
        return 1;
    }, [canonicalWidth, wrapperAvailableWidth]);

    // Dimensions visuelles réservées dans le document
    const displayWidth = Math.round(canonicalWidth * scaleFactor);
    const displayHeight = Math.round(canonicalHeight * scaleFactor);

    // ── Drag & Resize interactif ──
    const [isDragging, setIsDragging] = useState<'bottom' | 'right' | 'corner-br' | 'corner-bl' | 'corner-tr' | null>(null);
    const [dragLiveDimensions, setDragLiveDimensions] = useState<{ widthPx: number; heightPx: number } | null>(null);

    const mapBridgeRef = useRef<{ zoomIn: () => void; zoomOut: () => void } | null>(null);

    // Initialisation automatique de l'échelle 1:25 000 si non persistée
    useEffect(() => {
        if (!initialPersist?.scaleName || initialPersist?.zoom === undefined) {
            dispatch({
                type: 'PERSIST_MAP_STATE',
                stepId,
                scaleName: '1:25000',
                zoom: zoom25k,
                center: initialPersist?.center || midPoint,
                width: canonicalWidth,
                height: canonicalHeight,
            });
        }
    }, [initialPersist, zoom25k, midPoint, canonicalWidth, canonicalHeight, dispatch, stepId]);

    const handleMapMoved = useCallback((newZoom: number, newCenter: [number, number], newBounds: [[number, number], [number, number]]) => {
        dispatch({
            type: 'PERSIST_MAP_STATE',
            stepId,
            zoom: newZoom,
            center: newCenter,
            bounds: newBounds
        });
    }, [dispatch, stepId]);

    // ── Drag & Resize (adapté au scaleFactor pour un drag 1:1 parfait) ──
    const handleStartDrag = useCallback((type: 'bottom' | 'right' | 'corner-br' | 'corner-bl' | 'corner-tr', e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startW = canonicalWidth;
        const startH = canonicalHeight;
        const currentScale = scaleFactor || 1;

        setIsDragging(type);

        const onMouseMove = (moveEvent: MouseEvent) => {
            // Division par currentScale pour que le mouvement souris corresponde exactement aux pixels canoniques
            const deltaX = (moveEvent.clientX - startX) / currentScale;
            const deltaY = (moveEvent.clientY - startY) / currentScale;

            let newH = startH;
            let newW = startW;

            if (type === 'bottom' || type === 'corner-br' || type === 'corner-bl') {
                newH = Math.min(900, Math.max(160, Math.round(startH + deltaY)));
            }

            if (type === 'right' || type === 'corner-br' || type === 'corner-tr') {
                newW = Math.min(1200, Math.max(260, Math.round(startW + deltaX)));
            } else if (type === 'corner-bl') {
                newW = Math.min(1200, Math.max(260, Math.round(startW - deltaX)));
            }

            setDragLiveDimensions({ widthPx: newW, heightPx: newH });
        };

        const onMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setIsDragging(null);

            const deltaX = (upEvent.clientX - startX) / currentScale;
            const deltaY = (upEvent.clientY - startY) / currentScale;

            let finalH = startH;
            let finalW = startW;

            if (type === 'bottom' || type === 'corner-br' || type === 'corner-bl') {
                finalH = Math.min(900, Math.max(160, Math.round(startH + deltaY)));
            }

            if (type === 'right' || type === 'corner-br' || type === 'corner-tr') {
                finalW = Math.min(1200, Math.max(260, Math.round(startW + deltaX)));
            } else if (type === 'corner-bl') {
                finalW = Math.min(1200, Math.max(260, Math.round(startW - deltaX)));
            }

            setDragLiveDimensions(null);

            // Calcul du pourcentage relatif pour mémoire
            const parentW = wrapperAvailableWidth || 750;
            const pct = Math.min(100, Math.max(30, Math.round((finalW / parentW) * 100)));

            dispatch({
                type: 'PERSIST_MAP_STATE',
                stepId,
                width: finalW,
                height: finalH,
                widthPercent: pct
            });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }, [canonicalWidth, canonicalHeight, scaleFactor, wrapperAvailableWidth, dispatch, stepId]);

    // Style des 4 poignées aux coins
    const handleDotStyle: React.CSSProperties = {
        position: 'absolute',
        width: '9px',
        height: '9px',
        background: '#ffffff',
        border: '1.5px solid var(--accent-default)',
        borderRadius: 0,
        boxShadow: '0 1px 5px rgba(0,0,0,0.7)',
        zIndex: 50,
    };

    return (
        <div 
            ref={wrapperRef}
            style={{
                width: '100%',
                display: 'flex',
                justifyContent: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
                margin: '10px 0 14px 0',
                position: 'relative',
                zIndex: 2,
            }}
        >
            {/* ── Overlay global pendant le redimensionnement par drag ── */}
            {isDragging && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 99999,
                    cursor: (isDragging === 'bottom') ? 'ns-resize' : (isDragging === 'right') ? 'ew-resize' : 'nwse-resize',
                    userSelect: 'none',
                }} />
            )}

            {/* ── CONTENEUR VISUEL RÉSERVÉ DANS LE FLUX (s'adapte à l'échelle sur petit écran) ── */}
            <div
                style={{
                    width: `${displayWidth}px`,
                    height: `${displayHeight}px`,
                    position: 'relative',
                    maxWidth: '100%',
                    overflow: 'visible',
                }}
            >
                {/* ── BOÎTE CANONIQUE RÉELLE (mise à l'échelle homothétique solidaire) ── */}
                <div
                    style={{
                        width: `${canonicalWidth}px`,
                        height: `${canonicalHeight}px`,
                        position: 'absolute',
                        top: 0,
                        left: alignment === 'right' ? undefined : (alignment === 'center' ? '50%' : 0),
                        right: alignment === 'right' ? 0 : undefined,
                        transform: alignment === 'center'
                            ? `translateX(-50%) scale(${scaleFactor})`
                            : `scale(${scaleFactor})`,
                        transformOrigin: alignment === 'left' ? 'top left' : alignment === 'right' ? 'top right' : 'top center',
                        borderRadius: 0,
                        border: isDragging
                            ? '2px solid var(--accent-default)'
                            : '1.5px solid rgba(255, 255, 255, 0.22)',
                        boxShadow: isDragging
                            ? '0 0 0 1px var(--accent-default), 0 8px 24px rgba(0,0,0,0.45)'
                            : '0 2px 10px rgba(0,0,0,0.25)',
                        background: '#090d16',
                        overflow: 'visible',
                        boxSizing: 'border-box',
                    }}
                >
                    {/* ── Indicateur dimensionnel en direct ── */}
                    {isDragging && dragLiveDimensions && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 600,
                            background: 'rgba(15, 23, 42, 0.94)',
                            color: '#ffffff',
                            padding: '6px 14px',
                            border: '1px solid var(--accent-default)',
                            boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
                            fontSize: '11px',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            pointerEvents: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <span>📐</span>
                            <span>{dragLiveDimensions.widthPx} × {dragLiveDimensions.heightPx} px {scaleFactor < 1 ? `(Affichage: ${Math.round(scaleFactor * 100)}%)` : ''}</span>
                        </div>
                    )}

                    {/* ── CONTENEUR STRICTEMENT FERMÉ POUR LES TUILES LEAFLET ── */}
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        overflow: 'hidden',
                        borderRadius: 0,
                    }}>
                        <MapContainer
                            center={center}
                            zoom={zoom}
                            style={{ height: '100%', width: '100%', borderRadius: 0 }}
                            scrollWheelZoom={false}
                            zoomControl={false}
                            zoomSnap={0.25}
                        >
                            <MiniDynamicTileLayer overrideLayerId={layerId} />
                            
                            {/* Tracé de l'étape */}
                            <Polyline positions={latLngs} pathOptions={{ color: routeColor, weight: 4.5, opacity: 0.95 }} />
                            
                            {/* Point de départ (vert) */}
                            <CircleMarker
                                center={latLngs[0]}
                                radius={5}
                                pathOptions={{ fillColor: '#22c55e', fillOpacity: 1, color: '#ffffff', weight: 2 }}
                            />

                            {/* Point d'arrivée (rouge) */}
                            <CircleMarker
                                center={latLngs[latLngs.length - 1]}
                                radius={5}
                                pathOptions={{ fillColor: '#ef4444', fillOpacity: 1, color: '#ffffff', weight: 2 }}
                            />

                            <MapViewController center={center} zoom={zoom} />
                            <MapPersister stepId={stepId} onStateChange={handleMapMoved} />
                            <MapResizer />
                            <MapScaleControl />
                            <MapLockController isLocked={isLocked} />
                            <MapWheelController />
                            <MapControllerBridge bridgeRef={mapBridgeRef} />
                        </MapContainer>

                        {/* Discrets boutons Zoom + / - locaux en bas à droite */}
                        <div style={{
                            position: 'absolute',
                            bottom: '8px',
                            right: '8px',
                            zIndex: 400,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            background: 'rgba(15, 23, 42, 0.85)',
                            border: '1px solid rgba(255, 255, 255, 0.15)',
                            borderRadius: 0,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}>
                            <button
                                onClick={() => mapBridgeRef.current?.zoomIn()}
                                title="Zoom avant"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-dim)',
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <ZoomIn size={12} />
                            </button>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                            <button
                                onClick={() => mapBridgeRef.current?.zoomOut()}
                                title="Zoom arrière"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-dim)',
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <ZoomOut size={12} />
                            </button>
                        </div>
                    </div>

                    {/* ── LES 4 POINTS DE MANIPULATION AUX COINS ── */}
                    
                    {/* 1. Coin Haut-Gauche */}
                    <div
                        onMouseDown={(e) => handleStartDrag('corner-br', e)}
                        title="Redimensionner la carte"
                        style={{
                            ...handleDotStyle,
                            top: '-4.5px',
                            left: '-4.5px',
                            cursor: 'nwse-resize',
                        }}
                    />

                    {/* 2. Coin Haut-Droit */}
                    <div
                        onMouseDown={(e) => handleStartDrag('corner-tr', e)}
                        title="Redimensionner la carte"
                        style={{
                            ...handleDotStyle,
                            top: '-4.5px',
                            right: '-4.5px',
                            cursor: 'nesw-resize',
                        }}
                    />

                    {/* 3. Coin Bas-Gauche */}
                    <div
                        onMouseDown={(e) => handleStartDrag('corner-bl', e)}
                        title="Redimensionner la carte"
                        style={{
                            ...handleDotStyle,
                            bottom: '-4.5px',
                            left: '-4.5px',
                            cursor: 'nesw-resize',
                        }}
                    />

                    {/* 4. Coin Bas-Droit (Poignée principale largeur + hauteur) */}
                    <div
                        onMouseDown={(e) => handleStartDrag('corner-br', e)}
                        title="Glisser pour redimensionner largeur et hauteur"
                        style={{
                            ...handleDotStyle,
                            bottom: '-4.5px',
                            right: '-4.5px',
                            cursor: 'nwse-resize',
                            background: isDragging === 'corner-br' ? 'var(--accent-default)' : '#ffffff',
                        }}
                    />

                    {/* Poignée Médiane Bas (Hauteur) */}
                    <div
                        onMouseDown={(e) => handleStartDrag('bottom', e)}
                        title="Glisser verticalement pour ajuster la hauteur"
                        style={{
                            position: 'absolute',
                            bottom: '-4.5px',
                            left: 'calc(50% - 15px)',
                            width: '30px',
                            height: '7px',
                            background: '#ffffff',
                            border: '1.5px solid var(--accent-default)',
                            cursor: 'ns-resize',
                            zIndex: 50,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        }}
                    />

                    {/* Poignée Médiane Droite (Largeur) */}
                    <div
                        onMouseDown={(e) => handleStartDrag('right', e)}
                        title="Glisser horizontalement pour ajuster la largeur"
                        style={{
                            position: 'absolute',
                            right: '-4.5px',
                            top: 'calc(50% - 15px)',
                            width: '7px',
                            height: '30px',
                            background: '#ffffff',
                            border: '1.5px solid var(--accent-default)',
                            cursor: 'ew-resize',
                            zIndex: 50,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

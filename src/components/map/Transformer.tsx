/**
 * Transformer — vector bounding box & transform controls for drawing layers and strokes.
 * Inspired by react-konva <Transformer /> and tldraw.
 *
 * Provides:
 *  - Screen-space projected bounding box outline
 *  - 8 resize handles (4 corners + 4 edge midpoints)
 *  - Rotation stem line + top rotation knob
 *  - Drag body for translation
 *  - Floating selection badge with quick actions
 *  - 60 FPS real-time transform preview
 *  - Single-step commit on pointerup (compatible with Ctrl+Z / Ctrl+Y)
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Trash2 } from 'lucide-react';

export interface TransformerTarget {
    kind: 'stroke' | 'group';
    drawId: string;
    strokeId?: string;
    title: string;
    color: string;
    strokes: Array<{ id: string; points: [number, number][] }>;
}

interface TransformerProps {
    target: TransformerTarget | null;
    onUpdatePreview: (updatedStrokes: Array<{ id: string; points: [number, number][] }> | null) => void;
    onCommit: (updatedStrokes: Array<{ id: string; points: [number, number][] }>) => void;
    onDelete: () => void;
}

type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'rot' | 'body';

export default function Transformer({ target, onUpdatePreview, onCommit, onDelete }: TransformerProps) {
    const map = useMap();
    const [, forceUpdate] = useState(0);

    // Re-render when map moves or zooms so screen coordinates stay locked to map
    useEffect(() => {
        const onMapMove = () => forceUpdate(n => n + 1);
        map.on('move', onMapMove);
        map.on('zoom', onMapMove);
        map.on('resize', onMapMove);
        return () => {
            map.off('move', onMapMove);
            map.off('zoom', onMapMove);
            map.off('resize', onMapMove);
        };
    }, [map]);

    // Active drag interaction state
    const dragRef = useRef<{
        handle: HandleType;
        startScreen: { x: number; y: number };
        anchor: { x: number; y: number };
        center: { x: number; y: number };
        initialSpan: { x: number; y: number };
        initialScreenPoints: Array<Array<{ x: number; y: number }>>;
        latestTransformed: Array<{ id: string; points: [number, number][] }>;
    } | null>(null);

    // Compute bounding box in container coordinates
    const bounds = useMemo(() => {
        if (!target || target.strokes.length === 0) return null;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let count = 0;

        for (const s of target.strokes) {
            for (const pt of s.points) {
                const sp = map.latLngToContainerPoint([pt[0], pt[1]]);
                if (sp.x < minX) minX = sp.x;
                if (sp.x > maxX) maxX = sp.x;
                if (sp.y < minY) minY = sp.y;
                if (sp.y > maxY) maxY = sp.y;
                count++;
            }
        }

        if (count === 0 || minX === Infinity) return null;

        const pad = 8;
        const x = minX - pad;
        const y = minY - pad;
        const width = Math.max(maxX - minX + pad * 2, 20);
        const height = Math.max(maxY - minY + pad * 2, 20);
        const center = { x: x + width / 2, y: y + height / 2 };

        return { x, y, width, height, center };
    }, [target, map]);

    const handlePointerDown = useCallback((e: React.PointerEvent, handle: HandleType) => {
        if (!target || !bounds) return;
        e.preventDefault();
        e.stopPropagation();

        (window as any).__markerDragging = true;

        // Collect initial screen points for all target strokes
        const initialScreenPoints = target.strokes.map(s =>
            s.points.map(pt => {
                const p = map.latLngToContainerPoint([pt[0], pt[1]]);
                return { x: p.x, y: p.y };
            })
        );

        // Determine opposite anchor point for scaling
        let anchor = { ...bounds.center };
        switch (handle) {
            case 'se': anchor = { x: bounds.x, y: bounds.y }; break;
            case 'nw': anchor = { x: bounds.x + bounds.width, y: bounds.y + bounds.height }; break;
            case 'ne': anchor = { x: bounds.x, y: bounds.y + bounds.height }; break;
            case 'sw': anchor = { x: bounds.x + bounds.width, y: bounds.y }; break;
            case 'e':  anchor = { x: bounds.x, y: bounds.center.y }; break;
            case 'w':  anchor = { x: bounds.x + bounds.width, y: bounds.center.y }; break;
            case 's':  anchor = { x: bounds.center.x, y: bounds.y }; break;
            case 'n':  anchor = { x: bounds.center.x, y: bounds.y + bounds.height }; break;
        }

        const startScreen = { x: e.clientX, y: e.clientY };
        const initialSpan = {
            x: startScreen.x - anchor.x,
            y: startScreen.y - anchor.y,
        };

        dragRef.current = {
            handle,
            startScreen,
            anchor,
            center: { ...bounds.center },
            initialSpan,
            initialScreenPoints,
            latestTransformed: target.strokes,
        };

        const onPointerMove = (ev: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag) return;

            const curScreen = { x: ev.clientX, y: ev.clientY };
            let updated: Array<{ id: string; points: [number, number][] }> = [];

            if (drag.handle === 'body') {
                // ── Translation ──
                const dx = curScreen.x - drag.startScreen.x;
                const dy = curScreen.y - drag.startScreen.y;

                updated = target.strokes.map((stroke, sIdx) => {
                    const newPts = drag.initialScreenPoints[sIdx].map(sp => {
                        const nextSp = L.point(sp.x + dx, sp.y + dy);
                        const ll = map.containerPointToLatLng(nextSp);
                        return [ll.lat, ll.lng] as [number, number];
                    });
                    return { id: stroke.id, points: newPts };
                });
            } else if (drag.handle === 'rot') {
                // ── Rotation ──
                const startAngle = Math.atan2(drag.startScreen.y - drag.center.y, drag.startScreen.x - drag.center.x);
                const curAngle = Math.atan2(curScreen.y - drag.center.y, curScreen.x - drag.center.x);
                const deltaAngle = curAngle - startAngle;
                const cos = Math.cos(deltaAngle);
                const sin = Math.sin(deltaAngle);

                updated = target.strokes.map((stroke, sIdx) => {
                    const newPts = drag.initialScreenPoints[sIdx].map(sp => {
                        const rx = sp.x - drag.center.x;
                        const ry = sp.y - drag.center.y;
                        const rotX = drag.center.x + rx * cos - ry * sin;
                        const rotY = drag.center.y + rx * sin + ry * cos;
                        const ll = map.containerPointToLatLng(L.point(rotX, rotY));
                        return [ll.lat, ll.lng] as [number, number];
                    });
                    return { id: stroke.id, points: newPts };
                });
            } else {
                // ── Scaling / Resizing ──
                let scaleX = 1;
                let scaleY = 1;

                if (['nw', 'ne', 'se', 'sw', 'e', 'w'].includes(drag.handle)) {
                    const curSpanX = curScreen.x - drag.anchor.x;
                    scaleX = drag.initialSpan.x !== 0 ? curSpanX / drag.initialSpan.x : 1;
                    if (Math.abs(scaleX) < 0.05) scaleX = 0.05 * Math.sign(scaleX || 1);
                }

                if (['nw', 'ne', 'se', 'sw', 'n', 's'].includes(drag.handle)) {
                    const curSpanY = curScreen.y - drag.anchor.y;
                    scaleY = drag.initialSpan.y !== 0 ? curSpanY / drag.initialSpan.y : 1;
                    if (Math.abs(scaleY) < 0.05) scaleY = 0.05 * Math.sign(scaleY || 1);
                }

                updated = target.strokes.map((stroke, sIdx) => {
                    const newPts = drag.initialScreenPoints[sIdx].map(sp => {
                        const scaledX = drag.anchor.x + (sp.x - drag.anchor.x) * scaleX;
                        const scaledY = drag.anchor.y + (sp.y - drag.anchor.y) * scaleY;
                        const ll = map.containerPointToLatLng(L.point(scaledX, scaledY));
                        return [ll.lat, ll.lng] as [number, number];
                    });
                    return { id: stroke.id, points: newPts };
                });
            }

            drag.latestTransformed = updated;
            onUpdatePreview(updated);
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);

            const drag = dragRef.current;
            if (drag && drag.latestTransformed) {
                onCommit(drag.latestTransformed);
            }
            onUpdatePreview(null);
            dragRef.current = null;

            setTimeout(() => {
                (window as any).__markerDragging = false;
            }, 60);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [target, bounds, map, onUpdatePreview, onCommit]);

    if (!target || !bounds) return null;

    const { x, y, width, height, center } = bounds;
    const accent = '#2d8ceb';
    const rotY = y - 24;

    const handleSquare = (hx: number, hy: number, hType: HandleType, cursor: string) => (
        <rect
            key={hType}
            data-transformer-handle="true"
            x={hx - 4.5}
            y={hy - 4.5}
            width={9}
            height={9}
            rx={1.5}
            fill="#ffffff"
            stroke={accent}
            strokeWidth={1.5}
            style={{ cursor, pointerEvents: 'auto' }}
            onPointerDown={e => handlePointerDown(e, hType)}
        />
    );

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1200 }}>
            {/* SVG vector transformer layer */}
            <svg style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                {/* Bounding box outline */}
                <rect
                    data-transformer-handle="true"
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill="rgba(45, 140, 235, 0.04)"
                    stroke={accent}
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    style={{ cursor: 'move', pointerEvents: 'auto' }}
                    onPointerDown={e => handlePointerDown(e, 'body')}
                />

                {/* Rotation stem */}
                <line
                    x1={center.x}
                    y1={y}
                    x2={center.x}
                    y2={rotY}
                    stroke={accent}
                    strokeWidth={1.5}
                />

                {/* Rotation knob */}
                <circle
                    data-transformer-handle="true"
                    cx={center.x}
                    cy={rotY}
                    r={5}
                    fill="#ffffff"
                    stroke={accent}
                    strokeWidth={2}
                    style={{ cursor: 'crosshair', pointerEvents: 'auto' }}
                    onPointerDown={e => handlePointerDown(e, 'rot')}
                />

                {/* 8 resize handles */}
                {handleSquare(x, y, 'nw', 'nwse-resize')}
                {handleSquare(center.x, y, 'n', 'ns-resize')}
                {handleSquare(x + width, y, 'ne', 'nesw-resize')}
                {handleSquare(x + width, center.y, 'e', 'ew-resize')}
                {handleSquare(x + width, y + height, 'se', 'nwse-resize')}
                {handleSquare(center.x, y + height, 's', 'ns-resize')}
                {handleSquare(x, y + height, 'sw', 'nesw-resize')}
                {handleSquare(x, center.y, 'w', 'ew-resize')}
            </svg>

            {/* Tactical floating selection badge */}
            <div
                style={{
                    position: 'absolute',
                    left: center.x,
                    top: Math.max(y - 48, 10),
                    transform: 'translateX(-50%)',
                    background: 'rgba(10, 16, 12, 0.95)',
                    border: `1px solid rgba(45, 140, 235, 0.4)`,
                    borderRadius: '7px',
                    padding: '3px 8px 3px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#fff',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
                    pointerEvents: 'auto',
                    whiteSpace: 'nowrap',
                    userSelect: 'none',
                    backdropFilter: 'blur(10px)',
                }}
            >
                <div style={{ width: 8, height: 8, borderRadius: 2, background: target.color }} />
                <span>{target.title}</span>
                <span style={{ fontSize: '9px', color: 'var(--text-dim)', opacity: 0.7, padding: '1px 4px', background: 'rgba(255,255,255,0.08)', borderRadius: 3 }}>
                    Ctrl+T
                </span>
                <button
                    type="button"
                    onClick={onDelete}
                    title="Supprimer la sélection (Suppr)"
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(239, 68, 68, 0.8)',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        borderRadius: 3,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)'; }}
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );
}

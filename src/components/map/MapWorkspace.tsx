import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Layers, Maximize2, Minimize2, Search } from 'lucide-react';
import MapComponent from './MapComponent';
import FloatingSearch from './FloatingSearch';
import MapSatGeoBar from './MapSatGeoBar';
import FloatingToolbar from './FloatingToolbar';
import InfoPills from './InfoPills';
import LayerManagerPanel, { LayerAddButtons } from '../panels/LayerManagerPanel';
import { useApp } from '../../AppContext';
import { useViewport } from '../../hooks';
import { usePanelDock } from '../../hooks/usePanelDock';
import MetroTimeline from '../layout/MetroTimeline';
import type { ViewMode } from '../../App';
import { startPanelDragSession, type PanelDragEndDetail, type PanelDragStartDetail } from '../../utils/panelDrag';

interface MapWorkspaceProps {
    isSplitMode?: boolean;
    onViewModeChange?: (mode: ViewMode) => void;
    onToggleSidebar?: (side: 'left' | 'right') => void;
}

// ── 6-dot drag handle icon ───────────────────────────────────────────────────
const SixDots = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        <circle cx="2.5" cy="2.5" r="1.4"/>
        <circle cx="7.5" cy="2.5" r="1.4"/>
        <circle cx="2.5" cy="8"   r="1.4"/>
        <circle cx="7.5" cy="8"   r="1.4"/>
        <circle cx="2.5" cy="13.5" r="1.4"/>
        <circle cx="7.5" cy="13.5" r="1.4"/>
    </svg>
);

const badgeStyle: React.CSSProperties = {
    fontSize: '10.5px', fontWeight: 700,
    padding: '1px 5px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.14)', color: '#ffffff',
    lineHeight: 1.25, fontFamily: 'var(--font-mono)',
};

export default function MapWorkspace({ isSplitMode = false, onViewModeChange }: MapWorkspaceProps) {
    const { state, dispatch } = useApp();
    const activeTool = state.active_tool;
    const { isMobile } = useViewport();

    const {
        etapesDocked, calquesDocked, leftColOpen,
        etapesRightDocked, calquesRightDocked, rightColOpen,
        leftColWidth, rightColWidth, colSplitRatio,
        leftColOrder, rightColOrder, calquesFloatSide,
        setEtapesDocked, setCalquesDocked,
        setEtapesRightDocked, setCalquesRightDocked,
        setLeftColWidth, setRightColWidth, setColSplitRatio,
        setLeftColOrder, setRightColOrder, setCalquesFloatSide,
    } = usePanelDock();

    // ── Floating Calques & Étapes panel heights (coordinated when stacked on left) ─
    const [calquesOpen, setCalquesOpen] = useState(false);
    const [calquesHeight, setCalquesHeight] = useState<number | null>(null);
    const [etapesHeight, setEtapesHeight] = useState<number | null>(null);
    const [etapesExpanded, setEtapesExpanded] = useState(false);
    const [isResizingCalques, setIsResizingCalques] = useState(false);
    const calquesPanelRef = useRef<HTMLDivElement>(null);
    const calquesBarRef = useRef<HTMLDivElement>(null);
    const [calquesBarWidth, setCalquesBarWidth] = useState(0);
    const mapZoneRef = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<HTMLDivElement>(null);

    // ── Mobile layers bottom sheet ──────────────────────────────────────────
    const [mobileLayersOpen, setMobileLayersOpen] = useState(false);

    // ── Column resize drag ──────────────────────────────────────────────────
    const [isResizingLeftCol, setIsResizingLeftCol] = useState(false);
    const [isResizingRightCol, setIsResizingRightCol] = useState(false);
    const [isResizingColSplit, setIsResizingColSplit] = useState(false);
    const leftColRef = useRef<HTMLDivElement>(null);

    // ── Hover state for Calques button (6-dot transform) ────────────────────
    const [calquesBtnHover, setCalquesBtnHover] = useState(false);

    // ── Long-press drag + drop zones ────────────────────────────────────────
    const [draggingPanel, setDraggingPanel] = useState<'etapes' | 'calques' | null>(null);
    const [draggingFromDocked, setDraggingFromDocked] = useState(false);
    const [dropTarget, setDropTarget] = useState<'left' | 'right' | 'map' | 'float-left' | 'float-right' | null>(null);
    const [dropOrder, setDropOrder] = useState<'top' | 'bottom'>('bottom');
    const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
    const dropTargetRef = useRef<'left' | 'right' | 'map' | 'float-left' | 'float-right' | null>(null);
    const dropOrderRef = useRef<'top' | 'bottom'>('bottom');

    const setActiveTool = (tool: string) => dispatch({ type: 'SET_ACTIVE_TOOL', tool });
    const showMetro = false;
    const leftHasRealContent = (etapesDocked && !showMetro && draggingPanel !== 'etapes') || (calquesDocked && draggingPanel !== 'calques');
    const rightHasRealContent = (etapesRightDocked && !showMetro && draggingPanel !== 'etapes') || (calquesRightDocked && draggingPanel !== 'calques');

    // ── Custom-event bridge ─────────────────────────────────────────────────
    useEffect(() => {
        const onStart = (e: Event) => {
            const { panel, x, y, fromDocked } = (e as CustomEvent<PanelDragStartDetail>).detail;
            setDraggingPanel(panel);
            setDraggingFromDocked(Boolean(fromDocked));
            setGhostPos({ x, y });
        };
        const onEnd = (e: Event) => {
            const { panel, side } = (e as CustomEvent<PanelDragEndDetail>).detail;
            const target = side ?? dropTargetRef.current;
            const orderPos = dropOrderRef.current;
            const other: 'etapes' | 'calques' = panel === 'etapes' ? 'calques' : 'etapes';
            const nextOrder: ['etapes' | 'calques', 'etapes' | 'calques'] =
                orderPos === 'top' ? [panel, other] : [other, panel];

            setDraggingPanel(null);
            setDraggingFromDocked(false);
            setDropTarget(null);
            setGhostPos(null);
            dropTargetRef.current = null;
            if (target === 'left') {
                setLeftColOrder(nextOrder);
                if (panel === 'etapes') setEtapesDocked(true);
                else { setCalquesDocked(true); setCalquesOpen(false); }
            } else if (target === 'right') {
                setRightColOrder(nextOrder);
                if (panel === 'etapes') setEtapesRightDocked(true);
                else { setCalquesRightDocked(true); setCalquesOpen(false); }
            } else if (target === 'float-left') {
                setCalquesDocked(false);
                setCalquesRightDocked(false);
                setCalquesFloatSide('left');
            } else if (target === 'float-right') {
                setCalquesDocked(false);
                setCalquesRightDocked(false);
                setCalquesFloatSide('right');
            } else if (target === 'map') {
                if (panel === 'etapes') {
                    setEtapesDocked(false);
                    setEtapesRightDocked(false);
                } else {
                    setCalquesDocked(false);
                    setCalquesRightDocked(false);
                    setCalquesOpen(true);
                }
            }
        };
        window.addEventListener('sr:panel-drag-start', onStart);
        window.addEventListener('sr:panel-drag-end', onEnd);
        return () => {
            window.removeEventListener('sr:panel-drag-start', onStart);
            window.removeEventListener('sr:panel-drag-end', onEnd);
        };
    }, [setEtapesDocked, setCalquesDocked, setEtapesRightDocked, setCalquesRightDocked, setLeftColOrder, setRightColOrder, setCalquesFloatSide]);

    // Track pointer — ghost position + drop zone highlight (workspace-aware)
    useEffect(() => {
        if (!draggingPanel) return;
        const onMove = (e: PointerEvent) => {
            setGhostPos({ x: e.clientX, y: e.clientY });
            let t: 'left' | 'right' | 'map' | 'float-left' | 'float-right' | null = null;
            const wsRect = workspaceRef.current?.getBoundingClientRect();
            const wsLeft = wsRect?.left ?? 0;
            const wsRight = wsRect?.right ?? window.innerWidth;
            const wsTop = wsRect?.top ?? 0;
            const wsBottom = wsRect?.bottom ?? window.innerHeight;
            const realMapLeft = wsLeft + (leftHasRealContent ? leftColWidth : 0);
            const realMapRight = wsRight - (rightHasRealContent ? rightColWidth : 0);

            const inBottomLeftCorner = draggingPanel === 'calques'
                && e.clientX >= realMapLeft && e.clientX < realMapLeft + 200
                && e.clientY > wsBottom - 140;
            const inBottomRightCorner = draggingPanel === 'calques'
                && e.clientX <= realMapRight && e.clientX > realMapRight - 200
                && e.clientY > wsBottom - 140;

            const leftLimit = wsLeft + (
                dropTargetRef.current === 'left' && !leftHasRealContent
                    ? Math.max(120, leftColWidth)
                    : leftHasRealContent ? leftColWidth + 120 : 120
            );
            const rightLimit = wsRight - (
                dropTargetRef.current === 'right' && !rightHasRealContent
                    ? Math.max(120, rightColWidth)
                    : rightHasRealContent ? rightColWidth + 120 : 120
            );

            if (inBottomLeftCorner) {
                t = 'float-left';
            } else if (inBottomRightCorner) {
                t = 'float-right';
            } else if (e.clientX < leftLimit) {
                t = 'left';
            } else if (e.clientX > rightLimit) {
                t = 'right';
            } else if (draggingFromDocked && e.clientY >= wsTop && e.clientY <= wsBottom) {
                t = 'map';
            }

            const nextOrder: 'top' | 'bottom' = e.clientY < (wsTop + wsBottom) / 2 ? 'top' : 'bottom';
            dropOrderRef.current = nextOrder;
            setDropOrder(nextOrder);
            dropTargetRef.current = t;
            setDropTarget(t);
        };
        window.addEventListener('pointermove', onMove);
        return () => window.removeEventListener('pointermove', onMove);
    }, [draggingPanel, draggingFromDocked, leftHasRealContent, rightHasRealContent, leftColWidth, rightColWidth]);

    const totalLayersCount =
        (state.itineraries?.length || 0) +
        (state.point_annotations?.length || 0) +
        (state.area_annotations?.length || 0) +
        (((state as any).draw_annotations as any[])?.length || 0) +
        (((state as any).text_annotations as any[])?.length || 0);

    const MIN_ETAPES_BODY = 110;
    const MIN_CALQUES_PANEL = 120;
    const FLOAT_VERTICAL_OVERHEAD = 148; // top(16) + bar/grabber(56) + bottom(64) + gap(12)

    const getMapHeight = useCallback(() => {
        return mapZoneRef.current?.getBoundingClientRect().height || window.innerHeight;
    }, []);

    const handleEtapesHeightChange = useCallback((nextH: number | null) => {
        if (nextH === null) {
            setEtapesHeight(null);
            return;
        }
        const bothOnLeft = !isMobile && !etapesDocked && !etapesRightDocked && !showMetro && !calquesDocked && !calquesRightDocked && calquesOpen && calquesFloatSide === 'left';
        if (bothOnLeft) {
            const available = Math.max(MIN_ETAPES_BODY + MIN_CALQUES_PANEL, getMapHeight() - FLOAT_VERTICAL_OVERHEAD);
            const clamped = Math.round(Math.max(MIN_ETAPES_BODY, Math.min(available - MIN_CALQUES_PANEL, nextH)));
            setEtapesHeight(clamped);
            const curCalques = calquesHeight ?? (calquesPanelRef.current?.getBoundingClientRect().height || 260);
            if (clamped + curCalques > available) {
                setCalquesHeight(Math.round(Math.max(MIN_CALQUES_PANEL, available - clamped)));
            }
        } else {
            setEtapesHeight(nextH);
        }
    }, [isMobile, etapesDocked, etapesRightDocked, showMetro, calquesDocked, calquesRightDocked, calquesOpen, calquesFloatSide, calquesHeight, getMapHeight]);

    // ── Floating Calques top-grabber resize ─────────────────────────────────
    const handleCalquesResizeStart = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        const startY = e.clientY;
        const startH = calquesPanelRef.current?.getBoundingClientRect().height || 260;
        setIsResizingCalques(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const onMove = (ev: PointerEvent) => {
            const mapH = getMapHeight();
            const rawH = Math.round(Math.max(MIN_CALQUES_PANEL, Math.min(Math.max(200, mapH - 130), startH + (startY - ev.clientY))));
            const etapesFloatingExpanded = !isMobile && !etapesDocked && !etapesRightDocked && !showMetro && etapesExpanded && calquesFloatSide === 'left';
            if (etapesFloatingExpanded) {
                const available = Math.max(MIN_ETAPES_BODY + MIN_CALQUES_PANEL, mapH - FLOAT_VERTICAL_OVERHEAD);
                const clamped = Math.round(Math.max(MIN_CALQUES_PANEL, Math.min(available - MIN_ETAPES_BODY, rawH)));
                setCalquesHeight(clamped);
                const curEtapes = etapesHeight ?? (mapZoneRef.current?.querySelector('[data-etapes-body]')?.getBoundingClientRect().height || 260);
                if (curEtapes + clamped > available) {
                    setEtapesHeight(Math.round(Math.max(MIN_ETAPES_BODY, available - clamped)));
                }
            } else {
                setCalquesHeight(rawH);
            }
        };
        const onUp = () => {
            setIsResizingCalques(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, [isMobile, etapesDocked, etapesRightDocked, showMetro, etapesExpanded, calquesFloatSide, etapesHeight, getMapHeight]);

    // ── Long-press drag on Calques button (icon transforms to 6-dots on hover) ─
    const handleCalquesBtnPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        startPanelDragSession(e, 'calques');
    }, []);

    // ── Left column WIDTH resize ────────────────────────────────────────────
    const handleLeftColResizePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        const startX = e.clientX;
        const startW = leftColWidth;
        setIsResizingLeftCol(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const onMove = (ev: PointerEvent) => setLeftColWidth(startW + (ev.clientX - startX));
        const onUp = () => {
            setIsResizingLeftCol(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, [leftColWidth, setLeftColWidth]);

    // ── Right column WIDTH resize ───────────────────────────────────────────
    const handleRightColResizePointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        const startX = e.clientX;
        const startW = rightColWidth;
        setIsResizingRightCol(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const onMove = (ev: PointerEvent) => setRightColWidth(startW - (ev.clientX - startX));
        const onUp = () => {
            setIsResizingRightCol(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, [rightColWidth, setRightColWidth]);

    // ── Column SPLIT resize (between Étapes and Calques) ───────────────────
    const handleColSplitPointerDown = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        const startY = e.clientY;
        const startRatio = colSplitRatio;
        setIsResizingColSplit(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const onMove = (ev: PointerEvent) => {
            const colH = leftColRef.current?.getBoundingClientRect().height || 600;
            setColSplitRatio(startRatio + (ev.clientY - startY) / colH);
        };
        const onUp = () => {
            setIsResizingColSplit(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
    }, [colSplitRatio, setColSplitRatio]);

    // ── Derived layout flags ────────────────────────────────────────────────
    const showBothDocked = !isMobile && etapesDocked && calquesDocked;
    const anyFloating = !calquesDocked && !calquesRightDocked;

    useEffect(() => {
        const el = calquesBarRef.current;
        if (!el || isMobile || !anyFloating || !calquesOpen || draggingPanel === 'calques') {
            setCalquesBarWidth(0);
            return;
        }
        const update = () => setCalquesBarWidth(el.offsetWidth);
        update();
        if (typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [isMobile, anyFloating, calquesOpen, draggingPanel, calquesFloatSide]);

    const toolbarCenterOffset = !isMobile && anyFloating && calquesOpen && calquesBarWidth > 0
        ? (calquesFloatSide === 'left'
            ? Math.round((16 + calquesBarWidth) / 2)
            : -Math.round((16 + calquesBarWidth) / 2))
        : 0;
    const showLeftCol = !isMobile && (leftHasRealContent || (draggingPanel !== null && dropTarget === 'left'));
    const showRightCol = !isMobile && (rightHasRealContent || (draggingPanel !== null && dropTarget === 'right'));

    // ── Reusable docked column (renders real panels + live blue drop preview) ─
    const renderColumn = (side: 'left' | 'right') => {
        const isLeft = side === 'left';
        const esDocked = isLeft ? etapesDocked : etapesRightDocked;
        const caDocked = isLeft ? calquesDocked : calquesRightDocked;
        const savedOrder = isLeft ? leftColOrder : rightColOrder;
        const previewing = !isMobile && draggingPanel !== null && dropTarget === side;
        const previewEs = previewing && draggingPanel === 'etapes';
        const previewCa = previewing && draggingPanel === 'calques';
        const showEs = (esDocked && !showMetro && draggingPanel !== 'etapes') || previewEs;
        const showCa = (caDocked && draggingPanel !== 'calques') || previewCa;
        const colWidth = isLeft ? leftColWidth : rightColWidth;
        const setUndockEs = isLeft ? () => setEtapesDocked(false) : () => setEtapesRightDocked(false);
        const setUndockCa = isLeft ? () => setCalquesDocked(false) : () => setCalquesRightDocked(false);
        const bothDocked = !isMobile && esDocked && caDocked;
        const hasBothSlots = showEs && showCa;

        const effectiveOrder: ('etapes' | 'calques')[] = previewing && draggingPanel
            ? (dropOrder === 'top'
                ? [draggingPanel, draggingPanel === 'etapes' ? 'calques' : 'etapes']
                : [draggingPanel === 'etapes' ? 'calques' : 'etapes', draggingPanel])
            : savedOrder;

        const visibleOrder = effectiveOrder.filter(p => (p === 'etapes' ? showEs : showCa));

        const renderPreviewSlot = (panel: 'etapes' | 'calques', flexVal: number) => (
            <div key={`preview-${panel}`} style={{
                flex: flexVal,
                minHeight: 96,
                padding: 10,
                display: 'flex',
                alignItems: 'stretch',
                justifyContent: 'stretch',
                background: 'var(--bg-elevated)',
            }}>
                <div style={{
                    flex: 1,
                    borderRadius: 10,
                    border: '2px dashed rgba(59,130,246,0.85)',
                    background: 'rgba(59,130,246,0.18)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    color: 'rgb(96,165,250)',
                }}>
                    {panel === 'etapes' ? <Search size={20} strokeWidth={2} /> : <Layers size={20} strokeWidth={2} />}
                    <span style={{ fontSize: 12, fontWeight: 700 }}>
                        {panel === 'etapes' ? 'Étapes' : 'Calques'}
                    </span>
                </div>
            </div>
        );

        const renderSlot = (panel: 'etapes' | 'calques', flexVal: number) => {
            if (panel === 'etapes') {
                if (previewEs) return renderPreviewSlot('etapes', flexVal);
                return (
                    <div key="etapes" style={{ flex: flexVal, minHeight: 96, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <FloatingSearch docked={true} isSplitMode={isSplitMode} onUndock={setUndockEs} />
                    </div>
                );
            }
            if (previewCa) return renderPreviewSlot('calques', flexVal);
            return (
                <div key="calques" style={{ flex: flexVal, minHeight: 96, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <LayerManagerPanel docked={true} isMobile={false} onClose={setUndockCa} />
                </div>
            );
        };

        return (
            <div
                ref={isLeft ? leftColRef : undefined}
                style={{
                    width: `${colWidth}px`,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: isLeft ? '1px solid var(--border-subtle)' : undefined,
                    borderLeft: !isLeft ? '1px solid var(--border-subtle)' : undefined,
                    background: 'var(--bg-elevated)',
                    overflow: 'hidden',
                    transition: (isLeft ? isResizingLeftCol : isResizingRightCol) ? 'none' : 'width 200ms ease',
                    userSelect: isResizingLeftCol || isResizingRightCol || isResizingColSplit ? 'none' : undefined,
                }}
            >
                {visibleOrder.map((panel, idx) => {
                    const flexVal = hasBothSlots ? (idx === 0 ? colSplitRatio : 1 - colSplitRatio) : 1;
                    return (
                        <React.Fragment key={panel}>
                            {idx > 0 && (
                                <div
                                    role={bothDocked ? 'separator' : undefined}
                                    aria-orientation={bothDocked ? 'horizontal' : undefined}
                                    aria-label={bothDocked ? 'Redimensionner la répartition Étapes / Calques' : undefined}
                                    onPointerDown={bothDocked ? handleColSplitPointerDown : undefined}
                                    onDoubleClick={bothDocked ? () => setColSplitRatio(0.5) : undefined}
                                    style={{
                                        height: 10,
                                        cursor: bothDocked ? 'ns-resize' : 'default',
                                        flexShrink: 0,
                                        background: isResizingColSplit ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.35)',
                                        borderTop: '1px solid var(--border-strong)',
                                        borderBottom: '1px solid var(--border-strong)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        touchAction: 'none',
                                    }}
                                >
                                    <div style={{ width: 40, height: 3, borderRadius: 999, background: isResizingColSplit ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.42)' }} />
                                </div>
                            )}
                            {renderSlot(panel, flexVal)}
                        </React.Fragment>
                    );
                })}
            </div>
        );
    };

    return (
        <div ref={workspaceRef} style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>

            {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
            {showLeftCol && renderColumn('left')}

            {/* Left column resize handle */}
            {!isMobile && leftColOpen && (
                <div
                    role="separator" aria-orientation="vertical"
                    aria-label="Redimensionner la colonne gauche"
                    onPointerDown={handleLeftColResizePointerDown}
                    style={{ width: 5, cursor: 'col-resize', background: 'transparent', flexShrink: 0, zIndex: 10, marginLeft: -2, marginRight: -3, touchAction: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-strong)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                />
            )}

            {/* ── MAP ZONE ─────────────────────────────────────────────────── */}
            <div ref={mapZoneRef} style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden', cursor: draggingPanel ? 'grabbing' : undefined }}>
                <MapComponent attributionSide={!isMobile && anyFloating && calquesFloatSide === 'left' ? 'right' : 'left'} />
                {showMetro && <MetroTimeline />}

                {isMobile && !showMetro && <FloatingSearch isSplitMode={isSplitMode} />}

                {!isMobile && !etapesDocked && !etapesRightDocked && !showMetro && draggingPanel !== 'etapes' && (
                    <FloatingSearch
                        isSplitMode={isSplitMode}
                        onDock={() => setEtapesDocked(true)}
                        panelHeight={etapesHeight}
                        onPanelHeightChange={handleEtapesHeightChange}
                        onExpandedChange={setEtapesExpanded}
                        maxFloatingBodyHeight={
                            anyFloating && calquesOpen && calquesFloatSide === 'left'
                                ? Math.max(MIN_ETAPES_BODY, Math.floor(getMapHeight() - FLOAT_VERTICAL_OVERHEAD - (calquesHeight ?? Math.min(260, getMapHeight() * 0.42))))
                                : null
                        }
                    />
                )}

                {!isMobile && (etapesDocked || etapesRightDocked) && !showMetro && (
                    <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 1200 }}>
                        <MapSatGeoBar />
                    </div>
                )}

                {/* Maximize / Minimize */}
                {onViewModeChange && !isMobile && (
                    <div style={{
                        position: 'absolute', top: 16, right: 16, height: 40,
                        display: 'flex', alignItems: 'center',
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        borderRadius: 14, padding: '3px 4px', zIndex: 1100, pointerEvents: 'all',
                    }}>
                        <button
                            type="button"
                            onClick={() => onViewModeChange(isSplitMode ? 'map' : 'split')}
                            title={isSplitMode ? 'Agrandir la carte' : 'Réduire la carte'}
                            style={{ width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: !isSplitMode ? 'rgba(255,255,255,0.14)' : 'transparent', color: !isSplitMode ? 'var(--text-primary)' : 'var(--text-dim)', transition: 'all 120ms ease' }}
                        >
                            {!isSplitMode ? <Minimize2 size={16} strokeWidth={2.2} /> : <Maximize2 size={16} strokeWidth={2.2} />}
                        </button>
                    </div>
                )}

                {/* Floating Calques panel */}
                {!isMobile && anyFloating && calquesOpen && draggingPanel !== 'calques' && (
                    <div
                        ref={calquesPanelRef}
                        id="layers-panel-dialog"
                        role="dialog" aria-label="Calques"
                        style={{
                            position: 'absolute', bottom: 64,
                            ...(calquesFloatSide === 'left' ? { left: 16 } : { right: 16 }),
                            width: 'var(--panel-width)',
                            height: calquesHeight !== null ? `${calquesHeight}px` : undefined,
                            maxHeight: !etapesDocked && !etapesRightDocked && !showMetro && etapesExpanded && calquesFloatSide === 'left'
                                ? `${Math.max(MIN_CALQUES_PANEL, Math.floor(getMapHeight() - FLOAT_VERTICAL_OVERHEAD - (etapesHeight ?? Math.min(260, getMapHeight() * 0.42))))}px`
                                : calquesHeight !== null ? 'calc(100dvh - 130px)' : '60dvh',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 14, boxShadow: 'var(--shadow-lg)',
                            zIndex: 1200, display: 'flex', flexDirection: 'column',
                            overflow: 'hidden', pointerEvents: 'all',
                        }}
                    >
                        <div
                            role="separator" aria-orientation="horizontal"
                            aria-label="Redimensionner le panneau des calques"
                            title="Glisser pour redimensionner · double-clic pour réinitialiser"
                            onPointerDown={handleCalquesResizeStart}
                            onDoubleClick={() => setCalquesHeight(null)}
                            style={{
                                height: 14, flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'ns-resize', touchAction: 'none',
                                borderBottom: '1px solid var(--border-subtle)',
                                background: isResizingCalques ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.025)',
                            }}
                        >
                            <div style={{ width: 36, height: 3, borderRadius: 999, background: isResizingCalques ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.24)' }} />
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <LayerManagerPanel isMobile={false} onClose={() => setCalquesOpen(false)} />
                        </div>
                    </div>
                )}

                {/* Mobile layers bottom sheet */}
                {isMobile && mobileLayersOpen && (
                    <>
                        <div className="bottom-sheet-backdrop" onClick={() => setMobileLayersOpen(false)} />
                        <div id="layers-panel-dialog" className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Calques"
                            style={{ maxHeight: '75dvh', zIndex: 2600, background: 'var(--bg-elevated)' }}>
                            <button type="button" className="bottom-sheet-handle-zone" onClick={() => setMobileLayersOpen(false)}
                                aria-label="Replier le panneau des calques" style={{ width: '100%', background: 'transparent', border: 'none' }}>
                                <div className="bottom-sheet-handle-bar" />
                            </button>
                            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <LayerManagerPanel isMobile={true} onClose={() => setMobileLayersOpen(false)} />
                            </div>
                        </div>
                    </>
                )}

                {/* ── Calques bar (bottom-left or bottom-right) ────────────── */}
                {(isMobile || (anyFloating && draggingPanel !== 'calques')) && (
                    <div ref={calquesBarRef} style={{
                        position: 'absolute',
                        bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
                        ...(isMobile || calquesFloatSide === 'right'
                            ? { right: isMobile ? 'max(12px, env(safe-area-inset-right, 12px))' : 'max(16px, env(safe-area-inset-right, 16px))' }
                            : { left: 'max(16px, env(safe-area-inset-left, 16px))' }),
                        zIndex: 1200, pointerEvents: 'all',
                        display: 'flex', alignItems: 'center', gap: 4,
                        flexDirection: !isMobile && calquesFloatSide === 'left' ? 'row-reverse' : 'row',
                        padding: 4,
                        background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                        borderRadius: 14, boxShadow: 'var(--shadow-md)',
                    }}>
                        {!isMobile && calquesOpen && (
                            <>
                                <LayerAddButtons variant="bar" />
                                <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />
                            </>
                        )}

                        {/* Calques toggle — icon becomes 6-dots on hover (drag hint) */}
                        <button
                            type="button"
                            aria-expanded={isMobile ? mobileLayersOpen : calquesOpen}
                            aria-controls="layers-panel-dialog"
                            aria-label={(isMobile ? mobileLayersOpen : calquesOpen) ? 'Replier les calques' : 'Afficher les calques'}
                            onClick={() => isMobile ? setMobileLayersOpen(p => !p) : setCalquesOpen(p => !p)}
                            onPointerDown={!isMobile ? handleCalquesBtnPointerDown : undefined}
                            onMouseEnter={() => setCalquesBtnHover(true)}
                            onMouseLeave={() => setCalquesBtnHover(false)}
                            title={(isMobile ? mobileLayersOpen : calquesOpen) ? 'Replier les calques · maintenir pour déplacer' : 'Afficher les calques · maintenir pour déplacer'}
                            style={{
                                height: 32,
                                padding: isMobile ? '0 8px' : '0 10px',
                                border: 'none', borderRadius: 10,
                                background: (isMobile ? mobileLayersOpen : calquesOpen) ? 'rgba(255,255,255,0.12)' : 'transparent',
                                color: (isMobile ? mobileLayersOpen : calquesOpen) || totalLayersCount > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: !isMobile ? 'grab' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                fontSize: 12, fontWeight: 600,
                                transition: 'background 100ms, color 100ms',
                                userSelect: 'none',
                            }}
                        >
                            {/* Icon: 6-dots on hover (drag hint), Layers icon otherwise */}
                            {!isMobile && calquesBtnHover
                                ? <SixDots size={15} />
                                : <Layers size={15} strokeWidth={2.2} aria-hidden="true" />
                            }
                            {!isMobile && <span>Calques</span>}
                            {totalLayersCount > 0 && (
                                <span className="tabular-nums" style={{
                                    ...badgeStyle,
                                    background: (isMobile ? mobileLayersOpen : calquesOpen) ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.14)',
                                }}>
                                    {totalLayersCount}
                                </span>
                            )}
                        </button>
                    </div>
                )}

                {/* ── Ghost panel preview following cursor during drag (real component) ─ */}
                {draggingPanel && ghostPos && !isMobile && (
                    <div
                        style={{
                            position: 'fixed',
                            left: ghostPos.x - 150,
                            top: ghostPos.y - 20,
                            zIndex: 9999,
                            pointerEvents: 'none',
                            userSelect: 'none',
                            willChange: 'transform',
                            transform: 'rotate(-1.5deg) scale(0.95)',
                            opacity: 0.92,
                            transformOrigin: 'top center',
                        }}
                    >
                        <div style={{
                            width: 300,
                            height: 340,
                            maxHeight: '60dvh',
                            display: 'flex',
                            flexDirection: 'column',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 16,
                            boxShadow: '0 20px 48px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.3)',
                            overflow: 'hidden',
                            pointerEvents: 'none',
                        }}>
                            {draggingPanel === 'etapes' ? (
                                <FloatingSearch docked={true} isSplitMode={isSplitMode} />
                            ) : (
                                <LayerManagerPanel docked={true} isMobile={false} />
                            )}
                        </div>
                    </div>
                )}

                {/* ── Floating Calques corner preview pill (bottom-left / bottom-right) ─ */}
                {draggingPanel === 'calques' && (dropTarget === 'float-left' || dropTarget === 'float-right') && !isMobile && (
                    <div style={{
                        position: 'absolute',
                        bottom: 16,
                        ...(dropTarget === 'float-left' ? { left: 16 } : { right: 16 }),
                        zIndex: 9000,
                        pointerEvents: 'none',
                        height: 40,
                        padding: '0 14px',
                        borderRadius: 14,
                        border: '2px dashed rgba(59,130,246,0.9)',
                        background: 'rgba(59,130,246,0.22)',
                        color: 'rgb(96,165,250)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        fontWeight: 700,
                    }}>
                        <Layers size={15} strokeWidth={2.2} />
                        <span>Calques</span>
                    </div>
                )}

                {/* ── Map detach indicator when dragging a docked panel onto the map ─ */}
                {draggingPanel && draggingFromDocked && dropTarget === 'map' && !isMobile && (
                    <div style={{
                        position: 'absolute',
                        left: 16, right: 16, top: 16, bottom: 16,
                        zIndex: 8999, pointerEvents: 'none',
                        borderRadius: 14,
                        border: '2px dashed rgba(59,130,246,0.7)',
                        background: 'rgba(59,130,246,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 150ms, border-color 150ms',
                    }}>
                        <span style={{
                            padding: '6px 12px',
                            borderRadius: 999,
                            background: 'rgba(59,130,246,0.9)',
                            color: '#ffffff',
                            fontSize: 11, fontWeight: 600,
                            border: '1px solid rgba(255,255,255,0.12)',
                        }}>
                            Détacher sur la carte
                        </span>
                    </div>
                )}

                <InfoPills centerOffsetPx={toolbarCenterOffset} />

                {(!isMobile || !mobileLayersOpen) && (
                    <FloatingToolbar activeTool={activeTool} onToolChange={setActiveTool} centerOffsetPx={toolbarCenterOffset} />
                )}
            </div>

            {/* Right column resize handle */}
            {!isMobile && rightColOpen && (
                <div
                    role="separator" aria-orientation="vertical"
                    aria-label="Redimensionner la colonne droite"
                    onPointerDown={handleRightColResizePointerDown}
                    style={{ width: 5, cursor: 'col-resize', background: 'transparent', flexShrink: 0, zIndex: 10, marginRight: -2, marginLeft: -3, touchAction: 'none' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border-strong)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                />
            )}

            {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
            {showRightCol && renderColumn('right')}
        </div>
    );
}

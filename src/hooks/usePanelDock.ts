/**
 * usePanelDock — Column layout state for the map workspace.
 *
 * Étapes and Calques dock states are independent: each can be anchored
 * into the left or right column, or left floating.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { mapRef } from '../components/map/MapComponent';

const LS_KEY = 'sr-panel-dock-v4';

export type DockPanelKey = 'etapes' | 'calques';

interface DockState {
    etapesDocked: boolean;        // Étapes panel in left column
    calquesDocked: boolean;       // Calques panel in left column
    etapesRightDocked: boolean;   // Étapes panel in right column
    calquesRightDocked: boolean;  // Calques panel in right column
    leftColWidth: number;         // px, 240–480
    rightColWidth: number;        // px, 240–480
    colSplitRatio: number;        // 0.15–0.85
    leftColOrder: [DockPanelKey, DockPanelKey];
    rightColOrder: [DockPanelKey, DockPanelKey];
    calquesFloatSide: 'left' | 'right';
}

const DEFAULTS: DockState = {
    etapesDocked: false,
    calquesDocked: false,
    etapesRightDocked: false,
    calquesRightDocked: false,
    leftColWidth: 300,
    rightColWidth: 300,
    colSplitRatio: 0.5,
    leftColOrder: ['etapes', 'calques'],
    rightColOrder: ['etapes', 'calques'],
    calquesFloatSide: 'right',
};

function load(): DockState {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return DEFAULTS;
        return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
        return DEFAULTS;
    }
}

function save(s: DockState) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

function panByDelta(px: number) {
    const map = mapRef.current;
    if (!map || px === 0) return;
    map.panBy([px / 2, 0], { animate: false });
}

function invalidateMap() {
    const map = mapRef.current;
    if (map) map.invalidateSize({ animate: false });
}

export function usePanelDock() {
    const [dock, setDock] = useState<DockState>(load);
    const leftColOpen = dock.etapesDocked || dock.calquesDocked;
    const rightColOpen = dock.etapesRightDocked || dock.calquesRightDocked;
    const prevWidthRef = useRef(leftColOpen ? dock.leftColWidth : 0);

    useEffect(() => { save(dock); }, [dock]);

    // Invalidate + panBy after open/close or width change (200ms = CSS transition)
    useEffect(() => {
        const effective = leftColOpen ? dock.leftColWidth : 0;
        const delta = effective - prevWidthRef.current;
        prevWidthRef.current = effective;
        const t = setTimeout(() => {
            invalidateMap();
            if (delta !== 0) panByDelta(-delta / 2);
        }, 220);
        return () => clearTimeout(t);
    }, [leftColOpen, dock.leftColWidth]); // eslint-disable-line react-hooks/exhaustive-deps

    const setEtapesDocked = useCallback((v: boolean) => {
        setDock(d => ({ ...d, etapesDocked: v, ...(v ? { etapesRightDocked: false } : {}) }));
    }, []);

    const setCalquesDocked = useCallback((v: boolean) => {
        setDock(d => ({ ...d, calquesDocked: v, ...(v ? { calquesRightDocked: false } : {}) }));
    }, []);

    const setEtapesRightDocked = useCallback((v: boolean) => {
        setDock(d => ({ ...d, etapesRightDocked: v, ...(v ? { etapesDocked: false } : {}) }));
    }, []);

    const setCalquesRightDocked = useCallback((v: boolean) => {
        setDock(d => ({ ...d, calquesRightDocked: v, ...(v ? { calquesDocked: false } : {}) }));
    }, []);

    const setLeftColWidth = useCallback((w: number) => {
        setDock(d => ({ ...d, leftColWidth: Math.max(240, Math.min(480, w)) }));
    }, []);

    const setRightColWidth = useCallback((w: number) => {
        setDock(d => ({ ...d, rightColWidth: Math.max(240, Math.min(480, w)) }));
    }, []);

    const setColSplitRatio = useCallback((r: number) => {
        setDock(d => ({ ...d, colSplitRatio: Math.max(0.15, Math.min(0.85, r)) }));
    }, []);

    const setLeftColOrder = useCallback((order: [DockPanelKey, DockPanelKey]) => {
        setDock(d => ({ ...d, leftColOrder: order }));
    }, []);

    const setRightColOrder = useCallback((order: [DockPanelKey, DockPanelKey]) => {
        setDock(d => ({ ...d, rightColOrder: order }));
    }, []);

    const setCalquesFloatSide = useCallback((side: 'left' | 'right') => {
        setDock(d => ({ ...d, calquesFloatSide: side }));
    }, []);

    return {
        ...dock,
        leftColOpen,
        rightColOpen,
        setEtapesDocked,
        setCalquesDocked,
        setEtapesRightDocked,
        setCalquesRightDocked,
        setLeftColWidth,
        setRightColWidth,
        setColSplitRatio,
        setLeftColOrder,
        setRightColOrder,
        setCalquesFloatSide,
    };
}

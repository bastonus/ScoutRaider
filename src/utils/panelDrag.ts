import type React from 'react';

export type DragPanelKind = 'etapes' | 'calques';

export interface PanelDragStartDetail {
    panel: DragPanelKind;
    x: number;
    y: number;
    fromDocked?: boolean;
}

export interface PanelDragEndDetail {
    panel: DragPanelKind;
    side?: 'left' | 'right';
    fromDocked?: boolean;
}

/**
 * Starts a pointer drag session for docking/undocking a panel.
 * Enters drag mode either immediately on >= 8 px movement while held or after a 250 ms hold.
 */
export function startPanelDragSession(
    e: React.PointerEvent<HTMLElement>,
    panel: DragPanelKind,
    opts?: {
        fromDocked?: boolean;
        ignoreInput?: boolean;
        ignoreButton?: boolean;
        onDragStateChange?: (dragging: boolean) => void;
    },
): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement;
    if (opts?.ignoreInput && target.tagName === 'INPUT') return;
    if (opts?.ignoreButton && target.closest('button')) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const fromDocked = Boolean(opts?.fromDocked);
    let dragging = false;

    const startDrag = (x: number, y: number) => {
        if (dragging) return;
        dragging = true;
        clearTimeout(timer);
        opts?.onDragStateChange?.(true);
        window.dispatchEvent(new CustomEvent<PanelDragStartDetail>('sr:panel-drag-start', {
            detail: { panel, x, y, fromDocked },
        }));
    };

    const timer = setTimeout(() => startDrag(startX, startY), 250);

    const onMove = (ev: PointerEvent) => {
        if (!dragging && (Math.abs(ev.clientX - startX) > 8 || Math.abs(ev.clientY - startY) > 8)) {
            startDrag(ev.clientX, ev.clientY);
        }
    };

    const onUp = () => {
        clearTimeout(timer);
        opts?.onDragStateChange?.(false);
        if (dragging) {
            window.dispatchEvent(new CustomEvent<PanelDragEndDetail>('sr:panel-drag-end', {
                detail: { panel, fromDocked },
            }));
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
}

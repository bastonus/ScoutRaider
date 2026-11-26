import { useSyncExternalStore } from 'react';

export interface MapHoverHint {
    /** Standardized action(s) available for the current tool on the hovered object */
    action: string;
    /** Optional accent color for the leading status dot */
    accent?: string;
}

let currentHint: MapHoverHint | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

/** Update the smart pill hover hint without re-rendering the map. */
export function setMapHoverHint(hint: MapHoverHint | null): void {
    currentHint = hint;
    emit();
}

/** Clear the smart pill hover hint. */
export function clearMapHoverHint(): void {
    if (currentHint === null) return;
    currentHint = null;
    emit();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getSnapshot(): MapHoverHint | null {
    return currentHint;
}

/** Subscribe to the current map hover hint (re-renders only the consumer). */
export function useMapHoverHint(): MapHoverHint | null {
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

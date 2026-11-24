// src/logic/historyManager.ts - Undo / Redo history management for ScoutRaider
import type { AppState } from './types';

const MAX_HISTORY = 50;
let historyStack: AppState[] = [];
let redoStack: AppState[] = [];

/** Push a snapshot of the current state before a mutation */
export function pushHistory(state: AppState): void {
    // Strip transient UI fields to avoid bloating the stack
    const snap = { ...state, notifications: [], is_loading: false, loading_text: '' };
    historyStack.push(snap);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    redoStack = []; // any new action clears redo
}

/** Pop the previous state for UNDO */
export function popUndo(currentState: AppState): AppState | null {
    if (historyStack.length === 0) return null;
    const prev = historyStack.pop()!;
    redoStack.push({ ...currentState, notifications: [], is_loading: false, loading_text: '' });
    return { ...prev, is_loading: false, loading_text: '', notifications: currentState.notifications };
}

/** Pop the next state for REDO */
export function popRedo(currentState: AppState): AppState | null {
    if (redoStack.length === 0) return null;
    const next = redoStack.pop()!;
    historyStack.push({ ...currentState, notifications: [], is_loading: false, loading_text: '' });
    return { ...next, is_loading: false, loading_text: '', notifications: currentState.notifications };
}

/** Clear undo/redo stacks (e.g. on new project or load project) */
export function clearHistory(): void {
    historyStack = [];
    redoStack = [];
}

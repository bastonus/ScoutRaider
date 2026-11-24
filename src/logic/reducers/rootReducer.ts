// src/logic/reducers/rootReducer.ts - Composite Root Reducer for ScoutRaider
import type { AppState } from '../types';
import type { AppAction } from '../../AppContext';
import { routesReducer } from './routesReducer';
import { annotationsReducer } from './annotationsReducer';
import { carnetReducer } from './carnetReducer';
import { uiReducer } from './uiReducer';
import { syncActiveItinerary } from '../layerCleanup';

export function rootReducer(
    state: AppState,
    action: AppAction,
    getInitialState: () => AppState
): AppState {
    const nextState =
        routesReducer(state, action) ??
        annotationsReducer(state, action) ??
        carnetReducer(state, action) ??
        uiReducer(state, action, getInitialState) ??
        state;

    return syncActiveItinerary(nextState);
}

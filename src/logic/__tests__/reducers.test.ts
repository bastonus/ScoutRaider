import { describe, it, expect, beforeEach } from 'vitest';
import { routesReducer } from '../reducers/routesReducer';
import { annotationsReducer } from '../reducers/annotationsReducer';
import { carnetReducer } from '../reducers/carnetReducer';
import { uiReducer } from '../reducers/uiReducer';
import { rootReducer } from '../reducers/rootReducer';
import { getInitialAppState } from '../../AppContext';
import type { AppState } from '../types';

describe('Domain Reducers', () => {
    let baseState: AppState;

    beforeEach(() => {
        baseState = getInitialAppState();
    });

    describe('routesReducer', () => {
        it('handles SET_ANCHOR_STAGE', () => {
            const next = routesReducer(baseState, { type: 'SET_ANCHOR_STAGE', idx: 3 });
            expect(next).not.toBeNull();
            expect(next?.anchor_stage_idx).toBe(3);
        });

        it('handles ADD_STAGE', () => {
            const next = routesReducer(baseState, {
                type: 'ADD_STAGE',
                lat: 48.8566,
                lon: 2.3522,
                label: '-',
            });
            expect(next).not.toBeNull();
            expect(next?.stages.length).toBe(1);
            expect(next?.stages[0].label).toBe('A');
            expect(next?.stages[0].coords).toEqual([48.8566, 2.3522]);
        });

        it('handles REMOVE_STAGE', () => {
            const stateWithStage: AppState = {
                ...baseState,
                stages: [{ id: 's-1', coords: [48.85, 2.35], label: 'A' }],
            };
            const next = routesReducer(stateWithStage, { type: 'REMOVE_STAGE', id: 's-1' });
            expect(next).not.toBeNull();
            expect(next?.stages.length).toBe(0);
        });

        it('returns null for unhandled actions', () => {
            const next = routesReducer(baseState, { type: 'SET_MODE', mode: 'textual' });
            expect(next).toBeNull();
        });
    });

    describe('annotationsReducer', () => {
        it('handles ADD_POINT_ANNOTATION and REMOVE_POINT_ANNOTATION', () => {
            const addNext = annotationsReducer(baseState, {
                type: 'ADD_POINT_ANNOTATION',
                point: {
                    type: 'point',
                    layerId: 'layer-points',
                    title: 'Repère Test',
                    text: 'Détails',
                    coords: [48.85, 2.35],
                    color: '#ff0000',
                    icon: 'pin',
                    visible: true,
                },
            });
            expect(addNext).not.toBeNull();
            expect(addNext?.point_annotations.length).toBe(1);
            const pointId = addNext!.point_annotations[0].id;

            const removeNext = annotationsReducer(addNext!, {
                type: 'REMOVE_POINT_ANNOTATION',
                id: pointId,
            });
            expect(removeNext).not.toBeNull();
            expect(removeNext?.point_annotations.length).toBe(0);
        });
    });

    describe('carnetReducer', () => {
        it('handles SET_CARNET_VIEW', () => {
            const next = carnetReducer(baseState, { type: 'SET_CARNET_VIEW', view: 'solution' });
            expect(next).not.toBeNull();
            expect(next?.carnet_view).toBe('solution');
        });

        it('handles TOGGLE_GENERAL_MAP', () => {
            const prev = baseState.carnet_include_general_map;
            const next = carnetReducer(baseState, { type: 'TOGGLE_GENERAL_MAP' });
            expect(next).not.toBeNull();
            expect(next?.carnet_include_general_map).toBe(!prev);
        });
    });

    describe('uiReducer', () => {
        it('handles SET_MODE', () => {
            const next = uiReducer(baseState, { type: 'SET_MODE', mode: 'textual' }, getInitialAppState);
            expect(next).not.toBeNull();
            expect(next?.active_mode).toBe('textual');
        });

        it('handles ADD_NOTIFICATION and REMOVE_NOTIFICATION', () => {
            const addNext = uiReducer(baseState, {
                type: 'ADD_NOTIFICATION',
                message: 'Hello test',
                notifType: 'info',
            }, getInitialAppState);
            expect(addNext).not.toBeNull();
            expect(addNext?.notifications.length).toBe(1);
            const notifId = addNext!.notifications[0].id;

            const removeNext = uiReducer(addNext!, {
                type: 'REMOVE_NOTIFICATION',
                id: notifId,
            }, getInitialAppState);
            expect(removeNext).not.toBeNull();
            expect(removeNext?.notifications.length).toBe(0);
        });
    });

    describe('rootReducer', () => {
        it('coordinates actions and syncs active itinerary', () => {
            const next = rootReducer(baseState, {
                type: 'ADD_STAGE',
                lat: 48.8566,
                lon: 2.3522,
                label: '-',
            }, getInitialAppState);
            expect(next.stages.length).toBe(1);
            expect(next.itineraries.length).toBeGreaterThanOrEqual(1);
            expect(next.itineraries[0].stages.length).toBe(1);
        });
    });
});

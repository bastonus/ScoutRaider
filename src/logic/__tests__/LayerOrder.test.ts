import { describe, it, expect } from 'vitest';
import { computeLayerOrder } from '../LayerOrder';

describe('LayerOrder', () => {
    it('returns empty array when no layers exist', () => {
        const order = computeLayerOrder({
            itineraries: [],
            points: [],
            areas: [],
            draws: [],
        });
        expect(order).toEqual([]);
    });

    it('orders layers preserving default kinds and ids', () => {
        const order = computeLayerOrder({
            itineraries: [{ id: 'itin-1', name: 'Itin 1', color: '#000', visible: true, stages: [], routes: [], polygonal_steps: [], polygonal_legs: {}, carnet_steps: [] }],
            points: [{ id: 'pt-1', type: 'point', layerId: 'l1', title: 'P1', text: '', coords: [0, 0], color: '#f00', icon: 'pin', visible: true, createdAt: 1 }],
            areas: [],
            draws: [],
        });
        expect(order).toEqual([
            { kind: 'itin', id: 'itin-1' },
            { kind: 'point', id: 'pt-1' },
        ]);
    });

    it('honors savedOrder if present', () => {
        const savedOrder = [
            { kind: 'point' as const, id: 'pt-1' },
            { kind: 'itin' as const, id: 'itin-1' },
        ];
        const order = computeLayerOrder({
            itineraries: [{ id: 'itin-1', name: 'Itin 1', color: '#000', visible: true, stages: [], routes: [], polygonal_steps: [], polygonal_legs: {}, carnet_steps: [] }],
            points: [{ id: 'pt-1', type: 'point', layerId: 'l1', title: 'P1', text: '', coords: [0, 0], color: '#f00', icon: 'pin', visible: true, createdAt: 1 }],
            areas: [],
            draws: [],
            savedOrder,
        });
        expect(order).toEqual(savedOrder);
    });
});

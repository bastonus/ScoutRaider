import { describe, it, expect } from 'vitest';
import { calculatePolygonArea, calculatePathLength, calculatePathLengthLonLat, formatArea } from '../GeoUtils';

describe('GeoUtils', () => {
    describe('formatArea', () => {
        it('formats zero or invalid areas', () => {
            expect(formatArea(0)).toBe('0 m²');
            expect(formatArea(-50)).toBe('0 m²');
            expect(formatArea(NaN)).toBe('0 m²');
        });

        it('formats square meters (< 10 000 m²)', () => {
            expect(formatArea(500)).toBe('500 m²');
            expect(formatArea(9999)).toBe('9999 m²');
        });

        it('formats hectares (10 000 to 1 000 000 m²)', () => {
            expect(formatArea(10000)).toBe('1.00 ha');
            expect(formatArea(25000)).toBe('2.50 ha');
        });

        it('formats square kilometers (>= 1 000 000 m²)', () => {
            expect(formatArea(1000000)).toBe('1.00 km²');
            expect(formatArea(2500000)).toBe('2.50 km²');
        });
    });

    describe('calculatePathLength', () => {
        it('returns 0 for empty or single point coordinates', () => {
            expect(calculatePathLength([])).toBe(0);
            expect(calculatePathLength([[48.8566, 2.3522]])).toBe(0);
        });

        it('calculates distance between Paris and Lyon (~390-400 km)', () => {
            const paris: [number, number] = [48.8566, 2.3522];
            const lyon: [number, number] = [45.764, 4.8357];
            const dist = calculatePathLength([paris, lyon]);
            expect(dist).toBeGreaterThan(380000);
            expect(dist).toBeLessThan(410000);
        });
    });

    describe('calculatePathLengthLonLat', () => {
        it('correctly interprets [lon, lat] input format', () => {
            const parisLonLat: [number, number] = [2.3522, 48.8566];
            const lyonLonLat: [number, number] = [4.8357, 45.764];
            const dist = calculatePathLengthLonLat([parisLonLat, lyonLonLat]);
            expect(dist).toBeGreaterThan(380000);
            expect(dist).toBeLessThan(410000);
        });
    });

    describe('calculatePolygonArea', () => {
        it('returns 0 for less than 3 vertices', () => {
            expect(calculatePolygonArea([])).toBe(0);
            expect(calculatePolygonArea([[48.8566, 2.3522], [48.857, 2.353]])).toBe(0);
        });

        it('computes positive area for a valid polygon', () => {
            const square: [number, number][] = [
                [48.8566, 2.3522],
                [48.8566, 2.3622],
                [48.8666, 2.3622],
                [48.8666, 2.3522],
            ];
            const area = calculatePolygonArea(square);
            expect(area).toBeGreaterThan(100000);
        });
    });
});

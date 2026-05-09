/**
 * SpatialGrid.ts — O(1) overlap detection for route legs.
 * Ported from legacy/main.py _SpatialGrid class.
 *
 * Uses a grid-hash to convert O(n*m) point-to-point comparisons into O(n) lookups.
 */

export class SpatialGrid {
    private grid: Map<string, boolean>;
    private cellSize: number;

    constructor(cellSize: number = 0.0003) {
        this.grid = new Map();
        this.cellSize = cellSize;
    }

    private key(x: number, y: number): string {
        return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
    }

    /**
     * Insert a list of [lon, lat] points into the grid.
     */
    insertPoints(coords: [number, number][]): void {
        for (const p of coords) {
            this.grid.set(this.key(p[0], p[1]), true);
        }
    }

    /**
     * Count how many points in `coords` are within one cell of any inserted point.
     */
    countNearby(coords: [number, number][]): number {
        let count = 0;
        for (const p of coords) {
            const cx = Math.floor(p[0] / this.cellSize);
            const cy = Math.floor(p[1] / this.cellSize);
            let found = false;
            for (let dx = -1; dx <= 1 && !found; dx++) {
                for (let dy = -1; dy <= 1 && !found; dy++) {
                    if (this.grid.has(`${cx + dx},${cy + dy}`)) {
                        count++;
                        found = true;
                    }
                }
            }
        }
        return count;
    }

    clear(): void {
        this.grid.clear();
    }
}

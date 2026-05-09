/**
 * BackgroundEngine.ts — Concurrent priority scheduler.
 *
 * Priority (lower = started first):
 *   0  route_leg     — BRouter fetch                 concurrency: 2
 *   1  azimut_leg    — polygonalisation               concurrency: 1
 *   2  poi_search    — Overpass API                   concurrency: 3
 *   3  carnet_update — React dispatch / REBUILD_CARNET concurrency: 1
 *   4  encoding      — reserved                       concurrency: 1
 *
 * Key rules:
 * - Jobs are dispatched greedily by priority: we always fill higher-priority
 *   slots before even looking at lower-priority jobs.
 * - Per-type concurrency caps prevent API flooding.
 * - dedupKey collapses duplicate pending jobs (not already running ones).
 * - BRouter results are cached by endpoint hash — no re-routing unchanged legs.
 */

import { IGNClient } from './IGNClient';
import { PolygonalEngine } from './PolygonalEngine';
import { POIService } from './POIService';
import { Logger } from './Logger';
import type { BackgroundJob, JobType, JobPriority, PolySegment } from './types';

// ─── Concurrency limits per job type ──────────────────────────────────────────
const MAX_CONCURRENT: Record<JobType, number> = {
    route_leg:     2,   // two parallel BRouter calls
    azimut_leg:    1,   // sequential (full-route operation)
    poi_search:    1,   // sequential to prevent Overpass API 429 Too Many Requests
    carnet_update: 1,   // sequential (React state update)
    encoding:      1,
};

// ─── BRouter result cache ─────────────────────────────────────────────────────
const _routeCache = new Map<string, { coordinates: [number, number][]; alts: any[] | null }>();

function routeCacheKey(p1: [number, number], p2: [number, number]): string {
    return `${p1[0].toFixed(6)},${p1[1].toFixed(6)}-${p2[0].toFixed(6)},${p2[1].toFixed(6)}`;
}

export function clearRouteCache() { _routeCache.clear(); }
export function invalidateRouteCacheForLeg(p1: [number, number], p2: [number, number]) {
    _routeCache.delete(routeCacheKey(p1, p2));
}

// ─────────────────────────────────────────────────────────────────────────────

type JobHandler = (data: any) => Promise<any>;
type QueuedJob = BackgroundJob & { _dedupKey: string };

export class BackgroundEngine {
    private queue: QueuedJob[] = [];

    /** Currently-running jobs, per type */
    private running: Map<JobType, Set<string>> = new Map([
        ['route_leg',     new Set()],
        ['azimut_leg',    new Set()],
        ['poi_search',    new Set()],
        ['carnet_update', new Set()],
        ['encoding',      new Set()],
    ]);

    private handlers: Record<JobType, JobHandler>;
    private onJobFinished?: (jobId: string, type: JobType, result: any) => void;
    private onJobFailed?:   (jobId: string, type: JobType, error: any) => void;

    constructor() {
        this.handlers = {
            route_leg:     this.handleRouteLeg.bind(this),
            azimut_leg:    this.handleAzimutLeg.bind(this),
            poi_search:    this.handlePoiSearch.bind(this),
            carnet_update: this.handleCarnetUpdate.bind(this),
            encoding:      this.handleEncoding.bind(this),
        };
    }

    setListeners(
        onFinished: (jobId: string, type: JobType, result: any) => void,
        onFailed:   (jobId: string, type: JobType, error: any) => void
    ) {
        this.onJobFinished = onFinished;
        this.onJobFailed   = onFailed;
    }

    /**
     * Enqueue a job.
     * @param type      Job type
     * @param priority  0 = highest (route_leg), 4 = lowest
     * @param jobId     Unique ID
     * @param data      Payload
     * @param dedupKey  Collapse identical pending jobs
     */
    enqueue(type: JobType, priority: JobPriority, jobId: string, data: any, dedupKey?: string) {
        const key = dedupKey ?? jobId;

        // Drop any queued (not yet running) job with the same dedup key
        this.queue = this.queue.filter(j => j._dedupKey !== key);

        this.queue.push({ id: jobId, type, priority, data, _dedupKey: key });

        // Sort by priority (ascending), then by insertion order (stable)
        this.queue.sort((a, b) => a.priority - b.priority);

        this._logQueue(`enqueue ${type}(p=${priority}) key=${key}`);
        this._tick();
    }

    /** Flush pending (queued, not running) jobs of a given type. */
    clearByType(type: JobType) {
        const before = this.queue.length;
        this.queue = this.queue.filter(j => j.type !== type);
        if (this.queue.length < before)
            Logger.info(`[Queue] clearByType(${type}): removed ${before - this.queue.length}`);
    }

    clearQueue() { this.queue = []; }

    pendingCount(type?: JobType): number {
        if (!type) return this.queue.length;
        return this.queue.filter(j => j.type === type).length;
    }

    runningCount(type?: JobType): number {
        if (!type) {
            let total = 0;
            this.running.forEach(s => { total += s.size; });
            return total;
        }
        return this.running.get(type)?.size ?? 0;
    }

    // ─── Scheduler ─────────────────────────────────────────────────────────────

    /**
     * Greedy tick: start as many jobs as concurrency allows, always
     * filling higher-priority slots before lower-priority ones.
     */
    private _tick() {
        // Walk the queue in priority order (already sorted)
        for (const job of [...this.queue]) {
            const runSet = this.running.get(job.type)!;
            if (runSet.size >= MAX_CONCURRENT[job.type]) continue; // slot full for this type

            // Remove from queue and mark running
            this.queue = this.queue.filter(j => j !== job);
            runSet.add(job.id);

            this._run(job);
        }
    }

    private async _run(job: QueuedJob) {
        const t0 = performance.now();
        const label = `${job.type}(p=${job.priority}) id=${job.id}`;
        Logger.info(`[Queue] ▶ ${label}`);

        try {
            const handler = this.handlers[job.type];
            const result  = handler ? await handler(job.data) : undefined;
            const ms = (performance.now() - t0).toFixed(0);
            Logger.info(`[Queue] ✓ ${label}  ${ms}ms`);
            this.onJobFinished?.(job.id, job.type, result);
        } catch (e: any) {
            const ms = (performance.now() - t0).toFixed(0);
            Logger.warn(`[Queue] ✗ ${label}  ${ms}ms`, e?.message ?? e);
            this.onJobFailed?.(job.id, job.type, e?.message ?? String(e));
        } finally {
            this.running.get(job.type)?.delete(job.id);
            this._logQueue(`after ${job.type} done`);
            this._tick(); // a slot freed — start the next highest-priority job
        }
    }

    private _logQueue(ctx: string) {
        const running = [...this.running.entries()]
            .filter(([, s]) => s.size > 0)
            .map(([t, s]) => `${t}×${s.size}`)
            .join(' ');
        const pending = this.queue.map(j => `${j.type}(${j.priority})`).join(', ');
        Logger.info(`[Queue] ${ctx} | running=[${running || '—'}] queue=[${pending || '—'}]`);
    }

    // ─── Handlers ──────────────────────────────────────────────────────────────

    private async handleRouteLeg(data: {
        p1: [number, number];
        p2: [number, number];
        profile: string;
        small_roads: boolean;
        insertIdx?: number;
        legKey?: string;
    }) {
        const cacheKey = routeCacheKey(data.p1, data.p2);

        if (_routeCache.has(cacheKey)) {
            const cached = _routeCache.get(cacheKey)!;
            console.log(`[Queue] route_leg CACHE HIT  leg=${data.legKey ?? cacheKey}`);
            return { ...cached, insertIdx: data.insertIdx, legKey: data.legKey, fromCache: true };
        }

        const alts = await IGNClient.computeRouteAlternatives(
            data.p1, data.p2, data.profile, 1, data.small_roads
        );

        const entry = alts.length > 0
            ? { coordinates: alts[0].geometry.coordinates as [number,number][], alts }
            : { coordinates: [[data.p1[1], data.p1[0]], [data.p2[1], data.p2[0]]] as [number,number][], alts: null };

        _routeCache.set(cacheKey, entry);
        return { ...entry, insertIdx: data.insertIdx, legKey: data.legKey, fromCache: false };
    }

    private async handleAzimutLeg(data: {
        geojson: any;
        forceIntersections: boolean;
        settings: any;
        legKey?: string;
    }) {
        const s = data.settings || {};
        const pts = await PolygonalEngine.processTrajectoryData(
            data.geojson,
            s.tolerance     ?? 45,
            s.min_dist      ?? 80,
            s.allow_offroad ?? false,
            data.forceIntersections,
            s.masked_nodes  ?? [],
            s.forced_nodes  ?? []
        );
        return { segments: pts, legKey: data.legKey };
    }

    private async handlePoiSearch(data: {
        segments: PolySegment[];
        oldSegments?: PolySegment[];
        oldPois?: Record<string, any[]>;
        radiusM?: number;
        legKey?: string;
    }) {
        const segmentPois = await POIService.fetchPOIsPerSegment(
            data.segments,
            data.oldSegments,
            data.oldPois,
            data.radiusM ?? 80
        );
        return { segmentPois, legKey: data.legKey };
    }

    private async handleCarnetUpdate(data: { legKey?: string; [k: string]: any }) {
        // Pass-through: carnet rebuild is dispatched synchronously in the listener
        return { legKey: data.legKey };
    }

    private async handleEncoding(data: { text: string; moduleId: string; options?: any }) {
        return data;
    }
}

export const backgroundEngine = new BackgroundEngine();

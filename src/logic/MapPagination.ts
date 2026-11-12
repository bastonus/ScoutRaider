/**
 * MapPagination.ts — Multi-sheet map tiling and pagination at fixed scale (1:25 000, 1:10 000, 1:50 000)
 * Ported and strongly-typed from ScoutMap (paginate.js by FSGGB).
 * 
 * Computes the minimum number of A4 / A3 sheets to cover a hiking route without center emptiness,
 * with safety overlaps, neighboring arrows (↗ F2, ← F1), and assembly sheet.
 */

export interface PaginateOptions {
    lines: [number, number][][]; // Array of [lat, lon] lines
    scale: number;              // 10000, 25000, 50000
    paper: [number, number];    // [width_mm, height_mm] in portrait, e.g. [210, 297] for A4
    orient?: 'auto' | 'portrait' | 'landscape';
    mix?: boolean;              // allow mixing portrait and landscape to minimize sheets
    margin?: number;            // margin on sheet in mm (default: 8)
    overlap?: number;           // overlap between sheets in mm (default: 10)
    corridor?: number;          // corridor buffer around track in mm (default: 6)
    offsets?: number;
    starts?: number;
}

export interface PaginatedSheet {
    n: number;                  // 1-based sheet index
    orient: 'portrait' | 'landscape';
    wMm: number;
    hMm: number;
    sw: [number, number];       // [lat, lon] southwest corner
    ne: [number, number];       // [lat, lon] northeast corner
    center: [number, number];   // [lat, lon] center
    nb: Record<string, number[]>; // neighboring sheets: { 'N': [2], 'NE': [3], ... }
    rect: { x0: number; y0: number; W: number; H: number; orient: 'portrait' | 'landscape'; first: number };
}

export interface PaginationPlan {
    scale: number;
    pages: PaginatedSheet[];
    nPortrait: number;
    nLandscape: number;
    mixed: boolean;
    naiveSheets: number;        // how many sheets a standard rectangular grid would use
    savedSheets: number;        // sheets saved by path-following optimization
    summary: string;
}

const R = 6378137;
const RAD = Math.PI / 180;

function merc(p: [number, number]): [number, number] {
    const la = Math.max(-85, Math.min(85, p[0]));
    return [R * p[1] * RAD, R * Math.log(Math.tan(Math.PI / 4 + (la * RAD) / 2))];
}

function unmerc(x: number, y: number): [number, number] {
    return [((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / RAD), x / R / RAD];
}

function densify(P: [number, number][], step: number): [number, number][] {
    const out: [number, number][] = [];
    for (let i = 0; i < P.length; i++) {
        out.push(P[i]);
        if (i === P.length - 1) break;
        const dx = P[i + 1][0] - P[i][0];
        const dy = P[i + 1][1] - P[i][1];
        const d = Math.sqrt(dx * dx + dy * dy);
        const n = Math.floor(d / step);
        for (let k = 1; k <= n; k++) {
            out.push([P[i][0] + (dx * k) / (n + 1), P[i][1] + (dy * k) / (n + 1)]);
        }
    }
    return out;
}

function inside(p: [number, number], r: { x0: number; y0: number; W: number; H: number }, m: number): boolean {
    return p[0] - r.x0 >= m && r.x0 + r.W - p[0] >= m && p[1] - r.y0 >= m && r.y0 + r.H - p[1] >= m;
}

function marginOf(p: [number, number], r: { x0: number; y0: number; W: number; H: number }): number {
    return Math.min(p[0] - r.x0, r.x0 + r.W - p[0], p[1] - r.y0, r.y0 + r.H - p[1]);
}

function gridSelect(
    P: [number, number][],
    x0: number, y0: number,
    W: number, H: number,
    Sx: number, Sy: number,
    t: number
): { x0: number; y0: number; W: number; H: number; first: number }[] {
    const cells: Record<string, { i: number; j: number; pts: number[]; first: number }> = {};
    const margin = (p: [number, number], ci: number, cj: number) => {
        const cx = x0 + ci * Sx;
        const cy = y0 + cj * Sy;
        return Math.min(p[0] - cx, cx + W - p[0], p[1] - cy, cy + H - p[1]);
    };

    const cand = (p: [number, number]) => {
        const i0 = Math.ceil((p[0] - x0 - W) / Sx);
        const i1 = Math.floor((p[0] - x0) / Sx);
        const j0 = Math.ceil((p[1] - y0 - H) / Sy);
        const j1 = Math.floor((p[1] - y0) / Sy);
        const out: [number, number][] = [];
        for (let a = i0; a <= i1; a++) {
            for (let b = j0; b <= j1; b++) {
                out.push([a, b]);
            }
        }
        return out;
    };

    for (let k = 0; k < P.length; k++) {
        const p = P[k];
        let best: [number, number] | null = null;
        let bm = -Infinity;
        const cs = cand(p);
        for (let c = 0; c < cs.length; c++) {
            const m = margin(p, cs[c][0], cs[c][1]);
            if (m > bm) {
                bm = m;
                best = cs[c];
            }
        }
        if (!best) continue;
        const key = `${best[0]},${best[1]}`;
        if (!cells[key]) cells[key] = { i: best[0], j: best[1], pts: [], first: k };
        cells[key].pts.push(k);
    }

    const list = Object.keys(cells).map(q => cells[q]).sort((a, b) => a.pts.length - b.pts.length);
    const alive: Record<string, boolean> = {};
    list.forEach(c => { alive[`${c.i},${c.j}`] = true; });

    list.forEach(c => {
        const self = `${c.i},${c.j}`;
        let ok = true;
        for (let q = 0; q < c.pts.length && ok; q++) {
            const pp = P[c.pts[q]];
            const cs2 = cand(pp);
            let found = false;
            for (let r = 0; r < cs2.length; r++) {
                const kk = `${cs2[r][0]},${cs2[r][1]}`;
                if (kk !== self && alive[kk] && margin(pp, cs2[r][0], cs2[r][1]) >= t) {
                    found = true;
                    break;
                }
            }
            if (!found) ok = false;
        }
        if (ok && Object.keys(alive).length > 1) delete alive[self];
    });

    return list.filter(c => alive[`${c.i},${c.j}`]).map(c => ({
        x0: x0 + c.i * Sx,
        y0: y0 + c.j * Sy,
        W,
        H,
        first: c.first
    }));
}

function freeCover(
    P: [number, number][],
    dims: { orient: 'portrait' | 'landscape'; W: number; H: number }[],
    m: number,
    startIdx: number,
    dir: number
): { x0: number; y0: number; W: number; H: number; orient: 'portrait' | 'landscape'; first: number }[] {
    const N = P.length;
    const order = new Array<number>(N);
    const covered = new Array<boolean>(N);
    const pages: { x0: number; y0: number; W: number; H: number; orient: 'portrait' | 'landscape'; first: number }[] = [];

    for (let k = 0; k < N; k++) {
        order[k] = ((startIdx + dir * k) % N + N) % N;
        covered[k] = false;
    }

    let prevOr: string | null = null;
    for (let k = 0; k < N; k++) {
        const i = order[k];
        if (covered[i]) continue;
        let bestC: any = null;

        dims.forEach(d => {
            let minx = P[i][0];
            let maxx = minx;
            let miny = P[i][1];
            let maxy = miny;
            let last = k;

            for (let kk = k + 1; kk < N; kk++) {
                const pj = P[order[kk]];
                if (covered[order[kk]]) continue;
                const nx0 = Math.min(minx, pj[0]);
                const nx1 = Math.max(maxx, pj[0]);
                const ny0 = Math.min(miny, pj[1]);
                const ny1 = Math.max(maxy, pj[1]);
                if (nx1 - nx0 > d.W - 2 * m || ny1 - ny0 > d.H - 2 * m) break;
                minx = nx0; maxx = nx1; miny = ny0; maxy = ny1;
                last = kk;
            }
            const c = { d, last, minx, maxx, miny, maxy };
            if (!bestC || c.last > bestC.last || (c.last === bestC.last && d.orient === prevOr)) bestC = c;
        });

        const d = bestC.d;
        const sx = (d.W - 2 * m) - (bestC.maxx - bestC.minx);
        const sy = (d.H - 2 * m) - (bestC.maxy - bestC.miny);
        let bestR: any = null;
        let bestRun = -1;

        for (let a = 0; a <= 4; a++) {
            for (let b = 0; b <= 4; b++) {
                const r = { x0: bestC.minx - m - (sx * a) / 4, y0: bestC.miny - m - (sy * b) / 4, W: d.W, H: d.H, orient: d.orient };
                let run = 0;
                for (let kk2 = bestC.last + 1; kk2 < N && kk2 < bestC.last + 700; kk2++) {
                    const q = order[kk2];
                    if (covered[q] || inside(P[q], r, m)) run++;
                    else break;
                }
                if (run > bestRun) {
                    bestRun = run;
                    bestR = r;
                }
            }
        }
        bestR.first = k;
        pages.push(bestR);
        prevOr = d.orient;

        for (let j = 0; j < N; j++) {
            if (!covered[j] && inside(P[j], bestR, m)) covered[j] = true;
        }
    }

    // Eliminate redundant pages
    const cover = new Array<number>(N).fill(0);
    const sets = pages.map(pg => {
        const s: number[] = [];
        for (let z = 0; z < N; z++) {
            if (inside(P[z], pg, m)) {
                s.push(z);
                cover[z]++;
            }
        }
        return s;
    });

    const idxs = pages.map((_, ii) => ii).sort((a, b) => sets[a].length - sets[b].length);
    const dead: Record<number, boolean> = {};

    idxs.forEach(ii => {
        if (pages.length - Object.keys(dead).length <= 1) return;
        let only = false;
        sets[ii].forEach(z => {
            if (cover[z] === 1) only = true;
        });
        if (!only) {
            dead[ii] = true;
            sets[ii].forEach(z => { cover[z]--; });
        }
    });

    return pages.filter((_, ii) => !dead[ii]);
}

export class MapPagination {
    /**
     * Plan sheet coverage for an itinerary.
     */
    static plan(options: PaginateOptions): PaginationPlan | null {
        const lines = (options.lines || []).map(l => l.filter(p => p && isFinite(p[0]) && isFinite(p[1]))).filter(l => l.length > 0);
        if (!lines.length) return null;

        const pts = lines.flat();
        const L0 = lines.map(l => l.map(merc));
        const P0 = L0.flat();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        let lat0 = 0;

        P0.forEach(p => {
            minX = Math.min(minX, p[0]);
            maxX = Math.max(maxX, p[0]);
            minY = Math.min(minY, p[1]);
            maxY = Math.max(maxY, p[1]);
        });

        pts.forEach(p => { lat0 += p[0]; });
        lat0 /= pts.length;

        const k = 1 / Math.cos(lat0 * RAD);
        const mm = (options.scale / 1000) * k;

        const margin = options.margin ?? 8;
        const overlap = options.overlap ?? 10;
        const corridor = options.corridor ?? 6;
        const N = options.offsets ?? 6;
        const cm = corridor * mm;
        const O = overlap * mm;
        const mreq = Math.max(cm, O / 2);

        const dimsOf: Record<string, { orient: 'portrait' | 'landscape'; W: number; H: number; wMm: number; hMm: number }> = {};
        (['portrait', 'landscape'] as const).forEach(or => {
            const pw = (or === 'portrait' ? options.paper[0] : options.paper[1]) - 2 * margin;
            const ph = (or === 'portrait' ? options.paper[1] : options.paper[0]) - 2 * margin;
            if (pw > 10 && ph > 10 && pw * mm - O > 0 && ph * mm - O > 0) {
                dimsOf[or] = { orient: or, W: pw * mm, H: ph * mm, wMm: pw, hMm: ph };
            }
        });

        const cands: { kind: 'grid' | 'free'; key: string; rects: any[] }[] = [];

        // A. Regular grids
        Object.keys(dimsOf).forEach(or => {
            const d = dimsOf[or];
            const Sx = d.W - O;
            const Sy = d.H - O;
            const t = Math.min(cm, O / 2);
            const st = Math.max(8, Math.min(t / 4, Math.min(d.W, d.H) / 80));
            const P = L0.map(l => densify(l, st)).flat();
            let bestG: any = null;

            for (let a = 0; a < N; a++) {
                for (let b = 0; b < N; b++) {
                    const x0 = minX - cm - (a * Sx) / N;
                    const y0 = minY - cm - (b * Sy) / N;
                    const rects = gridSelect(P, x0, y0, d.W, d.H, Sx, Sy, t);
                    if (!bestG || rects.length < bestG.length) bestG = rects;
                }
            }
            cands.push({ kind: 'grid', key: or, rects: bestG.map((r: any) => { r.orient = or; return r; }) });
        });

        // B. Free path-following sheets
        const forced = options.orient === 'portrait' || options.orient === 'landscape';
        const allowed: ('portrait' | 'landscape')[] = forced ? [options.orient as 'portrait' | 'landscape'] : (Object.keys(dimsOf) as ('portrait' | 'landscape')[]);

        const free = (keyName: string, orients: ('portrait' | 'landscape')[]) => {
            const dims = orients.filter(x => dimsOf[x]).map(x => dimsOf[x]);
            if (!dims.length) return;
            const minDim = Math.min(...dims.map(d => Math.min(d.W, d.H)));
            const st = Math.max(8, Math.min(mreq / 3, minDim / 90));
            const P = L0.map(l => densify(l, st)).flat();
            let best: any = null;
            const K = options.starts ?? 40;

            for (let s = 0; s < K; s++) {
                [1, -1].forEach(dir => {
                    const pg = freeCover(P, dims, mreq, Math.floor((s * P.length) / K), dir);
                    if (!best || pg.length < best.length) best = pg;
                });
            }
            cands.push({ kind: 'free', key: keyName, rects: best });
        };

        allowed.forEach(x => { free(x, [x]); });
        if (options.mix !== false && !forced) free('mixed', allowed);

        // Pick best candidate
        const pool = cands.filter(c => (forced ? c.key === options.orient : true));
        pool.sort((a, b) => {
            if (a.rects.length !== b.rects.length) return a.rects.length - b.rects.length;
            const ra = (a.kind === 'grid' ? 0 : 1) + (a.key === 'mixed' ? 1 : 0);
            const rb = (b.kind === 'grid' ? 0 : 1) + (b.key === 'mixed' ? 1 : 0);
            if (ra !== rb) return ra - rb;
            return (a.key === 'landscape' ? 0 : 1) - (b.key === 'landscape' ? 0 : 1);
        });

        const win = pool[0];
        if (!win) return null;

        const rects = win.rects.slice().sort((a, b) => a.first - b.first);
        const pages: PaginatedSheet[] = rects.map((r, i) => {
            const sw = unmerc(r.x0, r.y0);
            const ne = unmerc(r.x0 + r.W, r.y0 + r.H);
            const ce = unmerc(r.x0 + r.W / 2, r.y0 + r.H / 2);
            const d = dimsOf[r.orient];
            return {
                n: i + 1,
                orient: r.orient,
                wMm: d.wMm,
                hMm: d.hMm,
                sw,
                ne,
                center: ce,
                nb: {},
                rect: r
            };
        });

        // Compute neighbor links (E, NE, N, NW, W, SW, S, SE)
        const DIRS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
        pages.forEach(p => {
            pages.forEach(q => {
                if (p === q) return;
                const a = p.rect;
                const b = q.rect;
                const ox = Math.min(a.x0 + a.W, b.x0 + b.W) - Math.max(a.x0, b.x0);
                const oy = Math.min(a.y0 + a.H, b.y0 + b.H) - Math.max(a.y0, b.y0);
                if (ox <= 0 || oy <= 0) return;

                const dx = (b.x0 + b.W / 2 - a.x0 - a.W / 2) / ((a.W + b.W) / 2);
                const dy = (b.y0 + b.H / 2 - a.y0 - a.H / 2) / ((a.H + b.H) / 2);
                let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
                if (ang < 0) ang += 360;
                const dir = DIRS[Math.floor(((ang + 22.5) % 360) / 45)];
                (p.nb[dir] = p.nb[dir] || []).push(q.n);
            });
        });

        const nP = pages.filter(p => p.orient === 'portrait').length;
        const nL = pages.length - nP;
        const dd = dimsOf.landscape || dimsOf.portrait;
        const naive = Math.ceil(Math.max(1, (maxX - minX + 2 * cm) / (dd.W - O))) * Math.ceil(Math.max(1, (maxY - minY + 2 * cm) / (dd.H - O)));

        return {
            scale: options.scale,
            pages,
            nPortrait: nP,
            nLandscape: nL,
            mixed: nP > 0 && nL > 0,
            naiveSheets: naive,
            savedSheets: Math.max(0, naive - pages.length),
            summary: `${pages.length} feuille${pages.length > 1 ? 's' : ''} au 1 : ${options.scale >= 1000 ? `${options.scale / 1000} 000` : options.scale} (${naive - pages.length > 0 ? `${naive - pages.length} feuilles économisées` : 'optimisé'})`
        };
    }

    /**
     * Generate an SVG diagram representing the sheet assembly overview and track coverage.
     */
    static generateAssemblySvg(
        plan: PaginationPlan,
        trackLines: [number, number][][],
        width: number = 720,
        height: number = 340
    ): string {
        if (!plan || plan.pages.length === 0) return '';
        const pad = 28;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        plan.pages.forEach(p => {
            const r = p.rect;
            if (r.x0 < minX) minX = r.x0;
            if (r.x0 + r.W > maxX) maxX = r.x0 + r.W;
            if (r.y0 < minY) minY = r.y0;
            if (r.y0 + r.H > maxY) maxY = r.y0 + r.H;
        });

        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        const scaleX = (width - 2 * pad) / spanX;
        const scaleY = (height - 2 * pad) / spanY;
        const scale = Math.min(scaleX, scaleY);

        const offsetX = pad + (width - 2 * pad - spanX * scale) / 2;
        const offsetY = pad + (height - 2 * pad - spanY * scale) / 2;

        const toSvg = (x: number, y: number): [number, number] => {
            return [
                offsetX + (x - minX) * scale,
                height - (offsetY + (y - minY) * scale)
            ];
        };

        let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">`;

        svg += `<defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.5"/>
            </pattern>
        </defs>`;
        svg += `<rect width="${width}" height="${height}" fill="url(#grid)" />`;

        // Draw sheets
        plan.pages.forEach(page => {
            const r = page.rect;
            const [x1, y1] = toSvg(r.x0, r.y0 + r.H);
            const sw = r.W * scale;
            const sh = r.H * scale;

            svg += `<g class="sheet-node">
                <rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${sw.toFixed(1)}" height="${sh.toFixed(1)}"
                      fill="rgba(14, 116, 144, 0.08)" stroke="#0284c7" stroke-width="2" rx="4" />
                <rect x="${(x1 + 4).toFixed(1)}" y="${(y1 + 4).toFixed(1)}" width="${Math.min(48, Math.max(28, sw - 8)).toFixed(1)}" height="20"
                      fill="#0284c7" rx="3" />
                <text x="${(x1 + 8).toFixed(1)}" y="${(y1 + 18).toFixed(1)}" font-size="11" font-weight="bold" fill="#ffffff">F${page.n}</text>
                <text x="${(x1 + sw / 2).toFixed(1)}" y="${(y1 + sh / 2).toFixed(1)}" font-size="15" font-weight="700" fill="#0369a1" text-anchor="middle" opacity="0.45">Feuille ${page.n}</text>
                <text x="${(x1 + sw - 6).toFixed(1)}" y="${(y1 + sh - 6).toFixed(1)}" font-size="9" fill="#64748b" text-anchor="end">${page.orient === 'landscape' ? 'Paysage' : 'Portrait'}</text>
            </g>`;
        });

        // Draw track
        trackLines.forEach(line => {
            if (line.length < 2) return;
            const pts = line.map(p => {
                const m = merc(p);
                const [sx, sy] = toSvg(m[0], m[1]);
                return `${sx.toFixed(1)},${sy.toFixed(1)}`;
            });

            svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#ea580c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`;

            const m0 = merc(line[0]);
            const [s0x, s0y] = toSvg(m0[0], m0[1]);
            svg += `<circle cx="${s0x.toFixed(1)}" cy="${s0y.toFixed(1)}" r="5" fill="#16a34a" stroke="#fff" stroke-width="1.5" />`;

            const mEnd = merc(line[line.length - 1]);
            const [sex, sey] = toSvg(mEnd[0], mEnd[1]);
            svg += `<circle cx="${sex.toFixed(1)}" cy="${sey.toFixed(1)}" r="5" fill="#dc2626" stroke="#fff" stroke-width="1.5" />`;
        });

        // Legend
        svg += `
        <g transform="translate(12, ${height - 22})">
            <rect width="210" height="18" fill="rgba(255,255,255,0.85)" rx="3" />
            <circle cx="10" cy="9" r="4" fill="#16a34a" />
            <text x="18" y="12" font-size="9" fill="#334155">Départ</text>
            <circle cx="65" cy="9" r="4" fill="#dc2626" />
            <text x="73" y="12" font-size="9" fill="#334155">Arrivée</text>
            <line x1="120" y1="9" x2="140" y2="9" stroke="#ea580c" stroke-width="2.5" />
            <text x="146" y="12" font-size="9" fill="#334155">Itinéraire</text>
        </g>`;

        svg += `</svg>`;
        return svg;
    }
}

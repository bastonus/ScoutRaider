export interface SearchResult {
    label: string;
    postcode?: string;
    city?: string;
    kind?: 'address' | 'poi';
    lat: number;
    lon: number;
}

/**
 * Autocomplete places via IGN Géoplateforme with optional geographic bias
 * around the current map center (`lonlat=lon,lat`), ranking exact addresses first.
 */
export async function searchIGNWithBias(
    query: string,
    center?: { lat: number; lon: number } | null,
    maxResults: number = 6
): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length < 3) return [];
    try {
        const params = new URLSearchParams({
            text: trimmed,
            maximumResponses: String(Math.max(maxResults * 2, 6)),
            type: 'StreetAddress,PositionOfInterest',
        });
        if (center && !Number.isNaN(center.lat) && !Number.isNaN(center.lon)) {
            params.set('lonlat', `${center.lon.toFixed(5)},${center.lat.toFixed(5)}`);
        }
        const res = await fetch(`https://data.geopf.fr/geocodage/completion?${params.toString()}`);
        if (!res.ok) return [];
        const data = await res.json();
        const mapped: SearchResult[] = (data.results || [])
            .map((r: any) => {
                const rawType = String(r.kind || r.type || r.classification || '').toLowerCase();
                const isAddress = rawType.includes('street') || rawType.includes('address') || Boolean(r.zipcode);
                return {
                    label: r.fulltext || r.label || '',
                    postcode: r.postcode || r.zipcode || '',
                    city: r.city || '',
                    kind: (isAddress && !rawType.includes('poi') && !rawType.includes('interest')) ? 'address' : 'poi',
                    lat: parseFloat(r.y),
                    lon: parseFloat(r.x),
                };
            })
            .filter((r: SearchResult) => !Number.isNaN(r.lat) && !Number.isNaN(r.lon));

        // Rank exact street/house addresses ahead of POIs (schools, universities, etc.)
        mapped.sort((a, b) => {
            if (a.kind === b.kind) return 0;
            return a.kind === 'address' ? -1 : 1;
        });

        return mapped.slice(0, maxResults);
    } catch {
        return [];
    }
}

/**
 * Parse raw coordinates such as "48.8566, 2.3522" or "48.8566 2.3522".
 */
export function parseCoords(raw: string): { lat: number; lon: number } | null {
    const s = raw.trim();
    const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!m) return null;
    const lat = parseFloat(m[1].replace(',', '.'));
    const lon = parseFloat(m[2].replace(',', '.'));
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
}

export function formatDistanceFr(meters: number): string {
    if (!Number.isFinite(meters) || meters <= 0) return '0 m';
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDurationFr(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';
    const totalMin = Math.max(1, Math.round(seconds / 60));
    if (totalMin < 60) return `${totalMin} min`;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/**
 * Split a full address string into a concise street/title line and postcode+city secondary line.
 */
export function formatStageAddress(raw: string): { primary: string; secondary?: string } {
    const normalized = raw.replace(/,(?=\S)/g, ', ').trim();
    if (!normalized) return { primary: '' };

    const parts = normalized
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

    if (parts.length <= 1) {
        const single = parts[0] || normalized;
        const m = single.match(/^(.+?)\s+(\d{4,5}\s+.+)$/);
        if (m) return { primary: m[1].trim(), secondary: m[2].trim() };
        return { primary: single };
    }

    const primary = parts[0];
    const rest = parts.slice(1);
    const postcodeCity = rest.find((p) => /^\d{4,5}\s+/.test(p));
    const secondary = postcodeCity || rest[0];
    return { primary, secondary };
}

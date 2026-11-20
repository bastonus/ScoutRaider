/**
 * Elevation Profile Module — Standard v2.0
 * Generates vector elevation charts for itinerary stages.
 */

export interface ElevationPoint {
  distance_m: number;
  elevation_m: number;
}

export function computeElevationStats(points: ElevationPoint[]) {
  if (!points || points.length === 0) {
    return { min_alt: 0, max_alt: 0, gain_d_plus: 0, loss_d_minus: 0 };
  }

  let minAlt = points[0].elevation_m;
  let maxAlt = points[0].elevation_m;
  let gain = 0;
  let loss = 0;

  for (let i = 1; i < points.length; i++) {
    const diff = points[i].elevation_m - points[i - 1].elevation_m;
    if (diff > 0) gain += diff;
    else loss += Math.abs(diff);

    if (points[i].elevation_m < minAlt) minAlt = points[i].elevation_m;
    if (points[i].elevation_m > maxAlt) maxAlt = points[i].elevation_m;
  }

  return {
    min_alt: Math.round(minAlt),
    max_alt: Math.round(maxAlt),
    gain_d_plus: Math.round(gain),
    loss_d_minus: Math.round(loss)
  };
}

export function renderElevationSVG(points: ElevationPoint[], width: number = 400, height: number = 100): string {
  if (!points || points.length < 2) {
    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="10" y="50" fill="#888">Profil non disponible</text></svg>`;
  }

  const stats = computeElevationStats(points);
  const totalDist = points[points.length - 1].distance_m || 1;
  const altSpan = Math.max(stats.max_alt - stats.min_alt, 10);

  const coords = points.map(p => {
    const x = (p.distance_m / totalDist) * (width - 40) + 20;
    const y = height - 20 - ((p.elevation_m - stats.min_alt) / altSpan) * (height - 40);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <polyline fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linejoin="round" points="${coords.join(' ')}" />
    <text x="20" y="15" font-size="11" fill="#64748b" font-family="sans-serif">+${stats.gain_d_plus}m D+ | Max ${stats.max_alt}m</text>
  </svg>`;
}

export default {
  id: 'profil_altimetrique',
  name: 'Profil Altimétrique & Dénivelé',
  capability: 'elevation_profile',
  transform: (points: ElevationPoint[]) => ({
    stats: computeElevationStats(points),
    svg: renderElevationSVG(points)
  })
};

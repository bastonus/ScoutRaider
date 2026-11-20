import { IPathProviderModule, ParsedTrack, TrackWaypoint } from '../routing_types';

export const loaderGeojsonModule: IPathProviderModule = {
  id: 'loader_geojson',
  name: 'Chargeur GeoJSON SIG',
  version: '2.0.0',
  supportedFormats: ['geojson', 'json'],
  requiresAuth: false,

  async parseTrack(fileContent: string | ArrayBuffer, filename?: string): Promise<ParsedTrack[]> {
    const text = typeof fileContent === 'string'
      ? fileContent
      : new TextDecoder('utf-8').decode(fileContent);

    const data = JSON.parse(text);
    const tracks: ParsedTrack[] = [];
    const waypoints: TrackWaypoint[] = [];

    const features = data.type === 'FeatureCollection'
      ? data.features
      : data.type === 'Feature'
        ? [data]
        : [{ type: 'Feature', geometry: data, properties: {} }];

    let featureIndex = 0;
    for (const feat of features) {
      const geom = feat.geometry;
      if (!geom) continue;

      if (geom.type === 'Point') {
        const coords = geom.coordinates;
        waypoints.push({
          lat: coords[1],
          lon: coords[0],
          ele: coords[2],
          name: feat.properties?.name || `Point ${waypoints.length + 1}`,
          desc: feat.properties?.description || ''
        });
      } else if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
        featureIndex++;
        const coordsList: [number, number, number?][] = geom.type === 'LineString'
          ? geom.coordinates
          : geom.coordinates.flat();

        tracks.push({
          id: `geojson_track_${Date.now()}_${featureIndex}`,
          name: feat.properties?.name || filename || `Itinéraire ${featureIndex}`,
          coordinates: coordsList,
          distanceMeters: 0,
          elevationGainMeters: 0,
          elevationLossMeters: 0,
          waypoints: []
        });
      }
    }

    if (tracks.length > 0 && waypoints.length > 0) {
      tracks[0].waypoints = waypoints;
    }

    return tracks;
  }
};

export default loaderGeojsonModule;

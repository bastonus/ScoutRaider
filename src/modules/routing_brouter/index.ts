import { IRoutingEngineModule, LatLonPoint, RoutingOptions, RouteResult } from '../routing_types';

export const routingBrouterModule: IRoutingEngineModule = {
  id: 'routing_brouter',
  name: 'Moteur BRouter Randonnée',
  version: '2.0.0',

  async computeRoute(
    origin: LatLonPoint,
    destination: LatLonPoint,
    options: RoutingOptions = {}
  ): Promise<RouteResult[]> {
    const profile = options.profile === 'trekking' ? 'trekking' : 'hiking-mountain';
    const params = new URLSearchParams({
      lonlats: `${origin.lon},${origin.lat}|${destination.lon},${destination.lat}`,
      profile: profile,
      alternativeidx: '0',
      format: 'geojson'
    });

    const endpoint = `https://brouter.de/brouter?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`BRouter error: HTTP ${response.status}`);
    }

    const geojson = await response.json();
    const feature = geojson.features?.[0];
    if (!feature || !feature.geometry?.coordinates) {
      return [];
    }

    const coords: [number, number][] = feature.geometry.coordinates.map((c: number[]) => [c[0], c[1]]);
    const dist = feature.properties?.['track-length'] ? parseFloat(feature.properties['track-length']) : 0;
    const gain = feature.properties?.['filtered-ascend'] ? parseFloat(feature.properties['filtered-ascend']) : 0;

    return [{
      coordinates: coords,
      distanceMeters: dist,
      elevationGainMeters: gain,
      dangerLevel: 'low',
      name: `BRouter (${profile})`,
      metadata: feature.properties || {}
    }];
  }
};

export default routingBrouterModule;

import { IRoutingEngineModule, LatLonPoint, RoutingOptions, RouteResult } from '../routing_types';

export const routingValhallaIgnModule: IRoutingEngineModule = {
  id: 'routing_valhalla_ign',
  name: 'Moteur Valhalla BD TOPO IGN',
  version: '2.0.0',

  async computeRoute(
    origin: LatLonPoint,
    destination: LatLonPoint,
    options: RoutingOptions = {}
  ): Promise<RouteResult[]> {
    const endpoint = 'https://data.geopf.fr/navigation/itineraire';
    const params = new URLSearchParams({
      resource: 'bdtopo-osrm',
      start: `${origin.lon},${origin.lat}`,
      end: `${destination.lon},${destination.lat}`,
      profile: 'pedestrian',
      optimization: 'shortest',
      geometryFormat: 'geojson'
    });

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`IGN Valhalla error: HTTP ${response.status}`);
    }

    const data = await response.json();
    const coords = data.geometry?.coordinates || [];
    const dist = data.distance || 0;

    return [{
      coordinates: coords,
      distanceMeters: dist,
      dangerLevel: 'low',
      name: 'IGN BD TOPO (Valhalla)',
      metadata: data
    }];
  }
};

export default routingValhallaIgnModule;

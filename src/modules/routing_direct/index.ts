import { IRoutingEngineModule, LatLonPoint, RoutingOptions, RouteResult } from '../routing_types';

function haversineDistanceMeters(p1: LatLonPoint, p2: LatLonPoint): number {
  const R = 6371e3;
  const phi1 = (p1.lat * Math.PI) / 180;
  const phi2 = (p2.lat * Math.PI) / 180;
  const deltaPhi = ((p2.lat - p1.lat) * Math.PI) / 180;
  const deltaLambda = ((p2.lon - p1.lon) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const routingDirectModule: IRoutingEngineModule = {
  id: 'routing_direct',
  name: 'Moteur Azimut Direct',
  version: '2.0.0',

  async computeRoute(
    origin: LatLonPoint,
    destination: LatLonPoint,
    _options: RoutingOptions = {}
  ): Promise<RouteResult[]> {
    const dist = haversineDistanceMeters(origin, destination);
    return [{
      coordinates: [
        [origin.lon, origin.lat],
        [destination.lon, destination.lat]
      ],
      distanceMeters: dist,
      dangerLevel: 'medium',
      name: 'Azimut direct (Vol d\'oiseau)',
      metadata: { direct_bearing_true: true }
    }];
  }
};

export default routingDirectModule;

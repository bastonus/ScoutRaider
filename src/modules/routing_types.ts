/**
 * ScoutRaider Module Standard — Routing & Path Provider Types (v2.0)
 * Formal interface contracts for Routing Engines and Path/Track Loaders.
 */

export interface LatLonPoint {
  lat: number;
  lon: number;
  ele?: number;
}

export interface RoutingOptions {
  profile?: 'pedestrian' | 'hiking' | 'trekking' | 'direct' | 'cycling';
  smallRoadsOnly?: boolean;
  maxAlternatives?: number;
  apiKey?: string;
  timeoutMs?: number;
}

export interface RouteResult {
  coordinates: [number, number][]; // [lon, lat]
  distanceMeters: number;
  elevationGainMeters?: number;
  elevationLossMeters?: number;
  dangerLevel?: 'low' | 'medium' | 'high';
  isFallback?: boolean;
  name?: string;
  metadata?: Record<string, any>;
}

export interface IRoutingEngineModule {
  id: string;
  name: string;
  version: string;
  computeRoute(
    origin: LatLonPoint,
    destination: LatLonPoint,
    options?: RoutingOptions
  ): Promise<RouteResult[]>;
}

export interface TrackWaypoint {
  lat: number;
  lon: number;
  ele?: number;
  name?: string;
  desc?: string;
  symbol?: string;
}

export interface ParsedTrack {
  id: string;
  name: string;
  coordinates: [number, number, number?][]; // [lon, lat, ele?]
  distanceMeters: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  waypoints: TrackWaypoint[];
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  metadata?: Record<string, any>;
}

export interface IPathProviderModule {
  id: string;
  name: string;
  version: string;
  supportedFormats: string[];
  requiresAuth: boolean;
  parseTrack(
    fileContent: string | ArrayBuffer,
    filename?: string
  ): Promise<ParsedTrack[]>;
}

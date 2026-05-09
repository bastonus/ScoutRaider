import requests
import json
import logging
import time
import re
import hashlib
from collections import OrderedDict

# ─────────────────────────────────────────────────────────
#  LRU CACHE with TTL  (no external dependency)
# ─────────────────────────────────────────────────────────

class _TTLCache:
    """Thread-safe-ish LRU dict with per-entry TTL."""

    def __init__(self, maxsize=200, ttl_seconds=300):
        self._store = OrderedDict()
        self._maxsize = maxsize
        self._ttl = ttl_seconds

    def _key(self, *args):
        raw = json.dumps(args, sort_keys=True)
        return hashlib.md5(raw.encode()).hexdigest()

    def get(self, *args):
        k = self._key(*args)
        item = self._store.get(k)
        if item is None:
            return None
        ts, val = item
        if time.time() - ts > self._ttl:
            self._store.pop(k, None)
            return None
        # Move to end (most-recently-used)
        self._store.move_to_end(k)
        return val

    def put(self, value, *args):
        k = self._key(*args)
        self._store[k] = (time.time(), value)
        self._store.move_to_end(k)
        while len(self._store) > self._maxsize:
            self._store.popitem(last=False)

    def clear(self):
        self._store.clear()


class IGNClient:
    """
    Python client for geocoding and routing using free, keyless APIs.
    Priority chain:
      1. BRouter Web (brouter.de) — Best for hiking/pedestrian, free, no key
      2. OSRM Demo Server — Good general-purpose, free, no key
      3. Straight line fallback

    Performance optimisations:
      - Persistent requests.Session (HTTP keep-alive / connection pooling)
      - LRU cache with TTL on route results
      - Retry with backoff on transient errors (504, timeout)
      - Structured error returns for UI feedback
    """

    BASE_GEOCODING = "https://api-adresse.data.gouv.fr/search/"

    def __init__(self, timeout=6, cache_ttl=300, cache_size=200):
        self.logger = logging.getLogger("IGNClient")
        self.timeout = timeout

        # Persistent HTTP session — reuses TCP connections (keep-alive)
        self._session = requests.Session()
        self._session.headers.update({
            "User-Agent": "ScoutItineraryGenerator/1.0",
            "Accept": "application/json",
        })

        # Route cache
        self._route_cache = _TTLCache(maxsize=cache_size, ttl_seconds=cache_ttl)
        self._geocode_cache = _TTLCache(maxsize=100, ttl_seconds=600)

    # ═══════════════════════════════════════════════════════
    #  GEOCODING
    # ═══════════════════════════════════════════════════════

    def search_address(self, query, limit=5):
        """
        Search for an address or POI via the French government geocoder.

        Returns a dict:
          {"results": [{"label": ..., "lat": ..., "lon": ...}, ...],
           "error": None | "query_too_short" | "timeout" | "network_error" | "parse_error"}

        For backward-compat, callers can also do `result["results"]` safely.
        """
        # ── Input validation ──────────────────────────────
        if not query:
            return {"results": [], "error": "query_too_short"}

        cleaned = re.sub(r'[^\w\s,.\'-àâäéèêëïîôùûüÿçœæ]', '', query, flags=re.UNICODE).strip()
        if len(cleaned) < 3:
            return {"results": [], "error": "query_too_short"}

        # ── Cache check ───────────────────────────────────
        cached = self._geocode_cache.get("geocode", cleaned, limit)
        if cached is not None:
            return {"results": cached, "error": None}

        params = {"q": cleaned, "limit": limit}

        # ── Request with retry ────────────────────────────
        last_error = None
        for attempt in range(2):  # 1 initial + 1 retry
            try:
                response = self._session.get(
                    self.BASE_GEOCODING, params=params, timeout=self.timeout
                )

                if response.status_code == 400:
                    self.logger.warning(f"Geocoding 400: bad request for '{cleaned}'")
                    return {"results": [], "error": "bad_request"}

                if response.status_code == 504:
                    self.logger.warning(f"Geocoding 504: gateway timeout (attempt {attempt+1})")
                    last_error = "timeout"
                    if attempt == 0:
                        time.sleep(1.0)  # Backoff before retry
                        continue
                    return {"results": [], "error": "timeout"}

                response.raise_for_status()
                data = response.json()

                results = []
                for feature in data.get("features", []):
                    props = feature.get("properties", {})
                    coords = feature.get("geometry", {}).get("coordinates", [0, 0])
                    results.append({
                        "label": props.get("label", "Inconnu"),
                        "city": props.get("city", props.get("municipality", "")),
                        "postcode": props.get("postcode", ""),
                        "lat": coords[1],
                        "lon": coords[0]
                    })

                # Cache successful results
                self._geocode_cache.put(results, "geocode", cleaned, limit)
                return {"results": results, "error": None}

            except requests.exceptions.Timeout:
                self.logger.warning(f"Geocoding timeout (attempt {attempt+1})")
                last_error = "timeout"
                if attempt == 0:
                    time.sleep(0.8)
                    continue

            except requests.exceptions.ConnectionError:
                self.logger.warning(f"Geocoding connection error (attempt {attempt+1})")
                last_error = "network_error"
                if attempt == 0:
                    time.sleep(0.5)
                    continue

            except requests.exceptions.RequestException as e:
                self.logger.warning(f"Geocoding API error: {e}")
                return {"results": [], "error": "network_error"}

            except Exception as e:
                self.logger.error(f"Geocoding parsing error: {e}")
                return {"results": [], "error": "parse_error"}

        return {"results": [], "error": last_error or "network_error"}

    # ═══════════════════════════════════════════════════════
    #  ROUTING
    # ═══════════════════════════════════════════════════════

    def compute_route(self, start_coords, end_coords, profile="pedestrian", **kwargs):
        """
        Calculate a route using free APIs. No API key required.
        start_coords / end_coords are [lat, lon].
        Returns GeoJSON Geometry (LineString) or None.
        """
        alts = self.compute_route_alternatives(start_coords, end_coords, profile, max_alts=1)
        return alts[0]["geometry"] if alts else None

    def compute_route_alternatives(self, start_coords, end_coords, profile="pedestrian",
                                    max_alts=3, small_roads_only=False):
        """
        Calculate multiple route alternatives.
        Returns List[dict] with 'geometry', 'label', and 'is_fallback' flag.

        Uses LRU cache; repeated identical calls return instantly.
        """
        start_lat, start_lon = start_coords[0], start_coords[1]
        end_lat, end_lon = end_coords[0], end_coords[1]

        # ── Cache check ───────────────────────────────────
        cache_key = (
            round(start_lat, 6), round(start_lon, 6),
            round(end_lat, 6), round(end_lon, 6),
            profile, max_alts, small_roads_only
        )
        cached = self._route_cache.get(*cache_key)
        if cached is not None:
            self.logger.debug("Route cache HIT")
            return cached

        results = []

        # ── French road types (OSM highway= tag) ──────────────────────
        # Autoroute      : highway=motorway       ← EXCLUDED when small_roads_only
        # Nationale      : highway=trunk           ← EXCLUDED when small_roads_only
        # Départementale : highway=primary         ← EXCLUDED when small_roads_only
        # Communale      : highway=secondary       ← EXCLUDED when small_roads_only
        # Voie communale : highway=tertiary        ← ACCEPTED
        # Rue résidentiel: highway=residential     ← ACCEPTED
        # Chemin agricole: highway=track            ← ACCEPTED (idéal scouts)
        # Sentier        : highway=path / footway  ← ACCEPTED (idéal scouts)
        # Piste cyclable : highway=cycleway        ← ACCEPTED
        # ──────────────────────────────────────────────────────────────

        if small_roads_only:
            # Strategy: BRouter "hiking" FIRST (absolute strictest profile for roads)
            # Its internal cost model forbids motorways and heavily penalizes nationales/départementales.
            try:
                # BRouter 'hiking' is extremely strict. We give it 0 alternatives if we just want the best path
                br_results = self._brouter_route(start_lon, start_lat, end_lon, end_lat, "hiking", max_alts)
                for r in br_results:
                    r["label"] += " (BRouter Strict)"
                    results.append(r)
            except Exception as e:
                self.logger.debug(f"BRouter hiking failed for small_roads: {e}")

            if not results:
                # Fallback to BRouter "trekking" (slightly less strict but still anti-car)
                try:
                    br_results = self._brouter_route(start_lon, start_lat, end_lon, end_lat, "trekking", max_alts)
                    for r in br_results:
                        r["label"] += " (BRouter Trekking)"
                        r["is_fallback"] = True
                        results.append(r)
                except Exception as e:
                    self.logger.debug(f"BRouter trekking failed: {e}")

            if not results:
                # Absolute last resort: OSRM foot (will take sidewalks on départementales if needed)
                try:
                    osrm_results = self._osrm_route(start_lon, start_lat, end_lon, end_lat, "foot", max_alts)
                    for r in osrm_results:
                        r["label"] += " (OSRM Secours)"
                        r["is_fallback"] = True
                        r["danger_level"] = "high"  # OSRM default fallback danger
                        results.append(r)
                except Exception as e:
                    self.logger.debug(f"OSRM foot failed for small_roads: {e}")
        else:
            # Normal mode: BRouter trekking first, then OSRM
            # --- Engine 1: BRouter Web ---
            try:
                profiles_to_try = ["trekking"] if profile == "pedestrian" else ["car-fast"]
                for p_name in profiles_to_try:
                    if len(results) >= max_alts:
                        break
                    br_results = self._brouter_route(start_lon, start_lat, end_lon, end_lat, p_name, max_alts - len(results))
                    results.extend(br_results)
            except Exception as e:
                self.logger.debug(f"BRouter alternatives failed: {e}")

            if not results:
                # --- Engine 2: OSRM ---
                try:
                    osrm_profile = "foot" if profile == "pedestrian" else "car"
                    osrm_results = self._osrm_route(start_lon, start_lat, end_lon, end_lat, osrm_profile, max_alts)
                    results.extend(osrm_results)
                except Exception as e:
                    self.logger.debug(f"OSRM alternatives failed: {e}")

        if results:
            self._route_cache.put(results, *cache_key)

        return results

    def _valhalla_route(self, start_lon, start_lat, end_lon, end_lat, max_alts):
        """Query Valhalla demo server, explicitly penalizing roads in favor of tracks.
        Valhalla allows dynamic pedestrian costing without needing custom profile files.
        """
        valhalla_url = "https://valhalla1.openstreetmap.de/route"
        payload = {
            "locations": [
                {"lat": start_lat, "lon": start_lon},
                {"lat": end_lat, "lon": end_lon}
            ],
            "costing": "pedestrian",
            "costing_options": {
                "pedestrian": {
                    "use_roads": 0.05,    # Strongly penalize roads
                    "use_tracks": 1.0,    # Favor paths and tracks
                    "use_hills": 0.5,
                    "walking_speed": 4.5
                }
            },
            "alternates": max_alts - 1 if max_alts > 1 else 0
        }
        
        results = []
        try:
            resp = self._session.post(valhalla_url, json=payload, timeout=self.timeout + 3)
            if resp.ok:
                data = resp.json()
                trip = data.get("trip", {})
                
                # Main route
                if "legs" in trip and trip["legs"]:
                    shape = trip["legs"][0].get("shape", "")
                    if shape:
                        coords = self._decode_polyline6(shape)
                        # Build GeoJSON LineString
                        geom = {"type": "LineString", "coordinates": coords}
                        dist_km = trip.get("summary", {}).get("length", 0)
                        results.append({"geometry": geom, "label": f"Alt 1 (Valhalla — petites routes, {dist_km:.1f} km)", "is_fallback": False})
                
                # Alternates
                for i, alt in enumerate(data.get("alternates", [])):
                    if "trip" in alt and "legs" in alt["trip"] and alt["trip"]["legs"]:
                        shape = alt["trip"]["legs"][0].get("shape", "")
                        if shape:
                            coords = self._decode_polyline6(shape)
                            geom = {"type": "LineString", "coordinates": coords}
                            dist_km = alt["trip"].get("summary", {}).get("length", 0)
                            results.append({"geometry": geom, "label": f"Alt {i+2} (Valhalla — petites routes, {dist_km:.1f} km)", "is_fallback": False})
                            
                    if len(results) >= max_alts:
                        break
            else:
                self.logger.debug(f"Valhalla returned {resp.status_code}")
        except Exception as e:
            self.logger.debug(f"Valhalla request failed: {e}")
            
        return results

    def _decode_polyline6(self, polyline_str):
        """Decode Valhalla polyline6 string into GeoJSON coordinates [[lon, lat], ...]."""
        precision = 6
        factor = 10 ** precision
        current_lat, current_lon = 0, 0
        coords = []
        i = 0
        length = len(polyline_str)
        
        while i < length:
            # Decode lat
            shift, result = 0, 0
            while True:
                byte = ord(polyline_str[i]) - 63
                i += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if not (byte >= 0x20):
                    break
            dlat = ~(result >> 1) if (result & 1) else (result >> 1)
            current_lat += dlat
            
            # Decode lon
            shift, result = 0, 0
            while True:
                byte = ord(polyline_str[i]) - 63
                i += 1
                result |= (byte & 0x1F) << shift
                shift += 5
                if not (byte >= 0x20):
                    break
            dlon = ~(result >> 1) if (result & 1) else (result >> 1)
            current_lon += dlon
            
            coords.append([current_lon / factor, current_lat / factor])
            
        return coords

    def _brouter_route(self, start_lon, start_lat, end_lon, end_lat, profile_name, max_alts):
        """Query BRouter web API for route alternatives."""
        brouter_url = "https://brouter.de/brouter"
        results = []
        for i in range(max_alts):
            params = {
                "lonlats": f"{start_lon},{start_lat}|{end_lon},{end_lat}",
                "profile": profile_name,
                "alternativeidx": i,
                "format": "geojson"
            }
            try:
                resp = self._session.get(brouter_url, params=params, timeout=self.timeout + 2)
                if resp.ok:
                    data = resp.json()
                    if data.get("features"):
                        geom = data["features"][0].get("geometry")
                        if geom and geom not in [r["geometry"] for r in results]:
                            # Parse danger level from BRouter WayTags
                            danger_level = None
                            danger_coord = None
                            try:
                                msgs = data["features"][0].get("properties", {}).get("messages", [])
                                if msgs and len(msgs) > 1:
                                    headers = msgs[0]
                                    way_tag_idx = headers.index("WayTags")
                                    lon_idx = headers.index("Longitude")
                                    lat_idx = headers.index("Latitude")
                                    dist_idx = headers.index("Distance")
                                    
                                    extreme_dist, high_dist, minor_dist = 0, 0, 0
                                    extreme_c, high_c, minor_c = None, None, None
                                    prev_d = 0
                                    has_motorway_cross = False

                                    for m in msgs[1:]:
                                        if len(m) > way_tag_idx and len(m) > lat_idx and len(m) > lon_idx and len(m) > dist_idx:
                                            t = m[way_tag_idx]
                                            lon = float(m[lon_idx]) / 1000000.0
                                            lat = float(m[lat_idx]) / 1000000.0
                                            try:
                                                d = float(m[dist_idx])
                                            except ValueError:
                                                d = prev_d
                                            delta = d - prev_d
                                            prev_d = d
                                            
                                            if "highway=motorway" in t:
                                                has_motorway_cross = True
                                                extreme_dist += delta
                                                if not extreme_c: extreme_c = [lon, lat]
                                            elif "highway=trunk" in t or "highway=primary" in t:
                                                high_dist += delta
                                                if not high_c: high_c = [lon, lat]
                                            elif "highway=secondary" in t or "highway=tertiary" in t:
                                                minor_dist += delta
                                                if not minor_c: minor_c = [lon, lat]
                                            
                                    if extreme_dist > 200:
                                        danger_level = "extreme"
                                        danger_coord = extreme_c
                                    elif high_dist > 200:
                                        danger_level = "high"
                                        danger_coord = high_c
                                    elif minor_dist > 300:
                                        danger_level = "minor"
                                        danger_coord = minor_c
                                    elif has_motorway_cross:
                                        danger_level = "motorway_cross"
                            except Exception as e:
                                self.logger.debug(f"Failed to parse BRouter WayTags: {e}")

                            results.append({
                                "geometry": geom,
                                "label": f"Alt {len(results)+1}",
                                "is_fallback": False,
                                "danger_level": danger_level,
                                "danger_coord": danger_coord
                            })
            except requests.exceptions.Timeout:
                self.logger.debug(f"BRouter timeout for alt {i}, profile {profile_name}")
                break
            except Exception as e:
                self.logger.debug(f"BRouter request error: {e}")
                break
            if len(results) >= max_alts:
                break
        return results

    def _osrm_route(self, start_lon, start_lat, end_lon, end_lat, osrm_profile, max_alts):
        """Query OSRM demo server for route alternatives."""
        osrm_url = (
            f"https://router.project-osrm.org/route/v1/{osrm_profile}/"
            f"{start_lon},{start_lat};{end_lon},{end_lat}"
        )
        params = {
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "true"
        }
        results = []
        resp = self._session.get(osrm_url, params=params, timeout=self.timeout + 2)
        if resp.ok:
            data = resp.json()
            for i, r in enumerate(data.get("routes", [])):
                geom = r.get("geometry")
                if geom and geom not in [res["geometry"] for res in results]:
                    results.append({"geometry": geom, "label": f"Alt {i+1} (OSRM)", "is_fallback": False})
                if len(results) >= max_alts:
                    break
        return results

    def clear_cache(self):
        """Invalidate all cached routes and geocoding results."""
        self._route_cache.clear()
        self._geocode_cache.clear()
        self.logger.info("Route + geocoding caches cleared")

"""
Route Engine — Pure backend logic for multi-route management.
No UI imports. Operates on plain dicts/lists.
"""
import uuid
import json
import copy
import math


# ── Factory ────────────────────────────────────────────

def create_route(name, geojson_geometry, color=None):
    """Create a new route dict from a GeoJSON Geometry (LineString).
    
    Args:
        name: Human-readable route name.
        geojson_geometry: A GeoJSON Geometry dict with type=LineString and coordinates.
        color: Optional hex color. Auto-assigned if None.
    
    Returns:
        A route dict ready to be stored in state_manager.
    """
    PALETTE = [
        "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
        "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
    ]
    route_id = f"route_{uuid.uuid4().hex[:8]}"
    
    coords = geojson_geometry.get("coordinates", [])
    
    return {
        "id": route_id,
        "name": name,
        "geojson": geojson_geometry,
        "color": color or PALETTE[hash(route_id) % len(PALETTE)],
        "visible": True,
        "locked": False,
        "order": 0
    }


def create_route_from_feature_collection(name, feature_collection, color=None):
    """Create a route from a GeoJSON FeatureCollection (e.g. imported file).
    Extracts the first LineString geometry found.
    """
    for feature in feature_collection.get("features", []):
        geom = feature.get("geometry", {})
        if geom.get("type") == "LineString":
            return create_route(name, geom, color)
        elif geom.get("type") == "MultiLineString":
            # Flatten to single LineString
            all_coords = []
            for line in geom.get("coordinates", []):
                all_coords.extend(line)
            flat_geom = {"type": "LineString", "coordinates": all_coords}
            return create_route(name, flat_geom, color)
    
    # Fallback: try to find any coordinates
    for feature in feature_collection.get("features", []):
        geom = feature.get("geometry", {})
        coords = geom.get("coordinates", [])
        if coords and isinstance(coords[0], list):
            return create_route(name, {"type": "LineString", "coordinates": coords}, color)
    
    return None


# ── Route Operations ────────────────────────────────────

def reverse_route(route):
    """Return a new route with reversed coordinate order."""
    new_route = copy.deepcopy(route)
    coords = new_route["geojson"].get("coordinates", [])
    new_route["geojson"]["coordinates"] = list(reversed(coords))
    new_route["name"] = route["name"] + " (reversed)"
    return new_route


def split_route(route, split_index):
    """Split a route into two at the given coordinate index.
    
    Returns:
        Tuple of (route_a, route_b) or None if index is invalid.
    """
    coords = route["geojson"].get("coordinates", [])
    if split_index <= 0 or split_index >= len(coords) - 1:
        return None
    
    coords_a = coords[:split_index + 1]
    coords_b = coords[split_index:]
    
    route_a = copy.deepcopy(route)
    route_a["id"] = f"route_{uuid.uuid4().hex[:8]}"
    route_a["name"] = route["name"] + " (part 1)"
    route_a["geojson"] = {"type": "LineString", "coordinates": coords_a}
    
    route_b = copy.deepcopy(route)
    route_b["id"] = f"route_{uuid.uuid4().hex[:8]}"
    route_b["name"] = route["name"] + " (part 2)"
    route_b["geojson"] = {"type": "LineString", "coordinates": coords_b}
    
    return route_a, route_b


def merge_routes(route_a, route_b):
    """Concatenate two routes into one. Second route's start connects to first route's end."""
    coords_a = route_a["geojson"].get("coordinates", [])
    coords_b = route_b["geojson"].get("coordinates", [])
    
    merged_coords = coords_a + coords_b[1:]  # Skip duplicate junction point
    
    merged = copy.deepcopy(route_a)
    merged["id"] = f"route_{uuid.uuid4().hex[:8]}"
    merged["name"] = f"{route_a['name']} + {route_b['name']}"
    merged["geojson"] = {"type": "LineString", "coordinates": merged_coords}
    
    return merged


def add_waypoint(route, lat, lon, after_index):
    """Insert a waypoint at [lon, lat] after the given coordinate index.
    
    Note: This is a simple coordinate insertion. For road-snapped 
    routing between the waypoint and its neighbors, the caller should
    use IGNClient.compute_route() to get the sub-segments and then
    splice them in.
    
    Returns:
        A new route with the waypoint inserted.
    """
    new_route = copy.deepcopy(route)
    coords = new_route["geojson"].get("coordinates", [])
    
    if after_index < 0 or after_index >= len(coords):
        return new_route
    
    # GeoJSON uses [lon, lat] order
    coords.insert(after_index + 1, [lon, lat])
    new_route["geojson"]["coordinates"] = coords
    
    return new_route


def remove_waypoint(route, index):
    """Remove a waypoint at the given coordinate index.
    Cannot remove first or last point.
    
    Returns:
        A new route with the waypoint removed.
    """
    new_route = copy.deepcopy(route)
    coords = new_route["geojson"].get("coordinates", [])
    
    if index <= 0 or index >= len(coords) - 1:
        return new_route
    
    coords.pop(index)
    new_route["geojson"]["coordinates"] = coords
    
    return new_route


def duplicate_route(route):
    """Create a copy of the route with a new ID."""
    new_route = copy.deepcopy(route)
    new_route["id"] = f"route_{uuid.uuid4().hex[:8]}"
    new_route["name"] = route["name"] + " (copy)"
    return new_route


# ── Chain / Link Operations ─────────────────────────────

def get_chained_geojson(routes, route_chain=None):
    """Merge all linked routes (or all visible routes) into one FeatureCollection.
    
    This is the entry point for the segmentation and export pipelines —
    they operate on this merged result.
    
    Args:
        routes: List of route dicts.
        route_chain: Ordered list of route IDs to include. If None, use all visible routes.
    
    Returns:
        A GeoJSON FeatureCollection with one Feature per route.
    """
    route_map = {r["id"]: r for r in routes}
    
    if route_chain:
        ordered = [route_map[rid] for rid in route_chain if rid in route_map]
    else:
        ordered = [r for r in routes if r.get("visible", True)]
    
    if not ordered:
        return {"type": "FeatureCollection", "features": []}
    
    # Merge all coordinates into a single LineString
    all_coords = []
    has_fallback = False
    max_danger = None
    
    danger_scores = {"extreme": 3, "high": 2, "minor": 1}
    
    for r in ordered:
        geojson = r.get("geojson", {})
        coords = geojson.get("coordinates", [])
        
        props = geojson.get("properties", {})
        if props.get("is_fallback"):
            has_fallback = True
            
        dl = props.get("danger_level")
        if dl:
            if not max_danger or danger_scores.get(dl, 0) > danger_scores.get(max_danger, 0):
                max_danger = dl
            
        if all_coords and coords:
            # Skip the first point if it's the same as the last
            if all_coords[-1] == coords[0]:
                coords = coords[1:]
        all_coords.extend(coords)
    
    merged_feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": all_coords
        },
        "properties": {
            "name": " → ".join(r["name"] for r in ordered),
            "route_count": len(ordered),
            "is_fallback": has_fallback,
            "danger_level": max_danger
        }
    }
    
    return {
        "type": "FeatureCollection",
        "features": [merged_feature]
    }


# ── Utility ──────────────────────────────────────────────

def compute_route_distance(route):
    """Calculate total distance in meters using Haversine."""
    coords = route["geojson"].get("coordinates", [])
    total = 0.0
    for i in range(len(coords) - 1):
        total += _haversine(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0])
    return round(total)


def _haversine(lat1, lon1, lat2, lon2):
    """Distance in meters between two GPS points."""
    R = 6371000
    p = math.pi / 180
    a = (0.5 - math.cos((lat2 - lat1) * p) / 2 +
         math.cos(lat1 * p) * math.cos(lat2 * p) *
         (1 - math.cos((lon2 - lon1) * p)) / 2)
    return 2 * R * math.asin(math.sqrt(a))

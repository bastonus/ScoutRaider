import json
import requests
from geographiclib.geodesic import Geodesic

def calculate_bearing(pt1, pt2):
    """
    Calculates the initial forward azimuth (bearing) from pt1 to pt2.
    
    Args:
        pt1 (list): First point [longitude, latitude].
        pt2 (list): Second point [longitude, latitude].
        
    Returns:
        float: Azimuth in degrees from 0 to 360.
    """
    res = Geodesic.WGS84.Inverse(pt1[1], pt1[0], pt2[1], pt2[0])
    azi = res['azi1']
    if azi < 0: azi += 360
    return azi

def calculate_distance(pt1, pt2):
    """
    Calculates the geodesic distance between two geographic coordinates.
    
    Args:
        pt1 (list): First point [longitude, latitude].
        pt2 (list): Second point [longitude, latitude].
        
    Returns:
        float: Distance in meters.
    """
    res = Geodesic.WGS84.Inverse(pt1[1], pt1[0], pt2[1], pt2[0])
    return res['s12']

def calculate_smart_bearing(points, start_idx, lookahead_meters=20):
    """Calculates bearing looking ahead 20m to avoid local curve noise."""
    if not points or start_idx >= len(points) - 1: return 0
    p_start = points[start_idx]
    acc = 0
    for i in range(start_idx, len(points) - 1):
        d = calculate_distance(points[i], points[i+1])
        acc += d
        if acc >= lookahead_meters:
            return calculate_bearing(p_start, points[i+1])
    return calculate_bearing(p_start, points[-1])

def get_all_points_from_geojson(geojson):
    if not geojson or not geojson.get("features"): return []
    feat = geojson["features"][0]
    return feat.get("geometry", {}).get("coordinates", [])

def get_intersections_from_overpass(all_points):
    if not all_points: return []
    lons = [p[0] for p in all_points]
    lats = [p[1] for p in all_points]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    
    pad = 0.002
    overpass_url = "http://overpass-api.de/api/interpreter"
    query = f"""
    [out:json][timeout:30];
    way["highway"]({min_lat-pad},{min_lon-pad},{max_lat+pad},{max_lon+pad});
    node(w);
    out body;
    """
    try:
        r = requests.post(overpass_url, data={'data': query}, timeout=30)
        data = r.json()
        node_counts = {}
        for element in data.get('elements', []):
            if element['type'] == 'way':
                for node_id in element.get('nodes', []):
                    node_counts[node_id] = node_counts.get(node_id, 0) + 1
        
        intersection_node_ids = {node_id for node_id, count in node_counts.items() if count > 1}
        intersection_coords = []
        for element in data.get('elements', []):
            if element['type'] == 'node' and element['id'] in intersection_node_ids:
                intersection_coords.append((element['lon'], element['lat']))
        return intersection_coords
    except:
        return []

def analyze_trajectory(data, forcer_carrefours=True):
    """
    Analyzes GeoJSON data to reconstruct sequential route points and detect intersection nodes.
    
    The algorithm performs two major steps:
    1. Geometry Recovery: If proper route instructions exist, it sequentially extracts points.
       If only raw LineStrings are available, it performs a 'greedy path assembly' to 
       chain discontinuous LineStrings by matching endpoints within a 50m tolerance.
    2. Intersection Detection: Detects nodes where paths cross or branch, prioritizing
       routing engine instructions. If unavailable, it queries OSM Overpass API to locate 
       nodes shared by multiple highway ways.
       
    Args:
        data (dict): The GeoJSON data.
        forcer_carrefours (bool): Whether to actively detect and mark intersections.
        
    Returns:
        tuple: (all_points list, carrefour_indices list, instr_count int)
    """
    all_points = []
    instr = data.get('geoportail:compute', {}).get('results', {}).get('routeInstructions', [])
    
    # 1. Geometry Recovery
    if instr:
        for i in instr:
            if 'geometry' in i and 'coordinates' in i['geometry']:
                coords = i['geometry']['coordinates']
                for p in coords:
                    if not all_points or calculate_distance(all_points[-1], p) > 0.1:
                        all_points.append(p)
    else:
        # Fallback to feature collection: Greedy path assembly
        line_feats = [f for f in data.get('features', []) if f.get('geometry', {}).get('type') == 'LineString']
        available_nodes = []
        for f in line_feats:
            available_nodes.append(f['geometry']['coordinates'])
            
        if not available_nodes: return [], set(), 0
        
        # Start with the first one (or the longest?)
        # For scout itineraries, the first one is often the start or a summary.
        all_points = list(available_nodes.pop(0))
        
        changed = True
        while changed and available_nodes:
            changed = False
            for i, coords in enumerate(available_nodes):
                # Try to append to end
                d_start = calculate_distance(all_points[-1], coords[0])
                d_end = calculate_distance(all_points[-1], coords[-1])
                
                if d_start < 50:
                    all_points.extend(coords[1:])
                    available_nodes.pop(i)
                    changed = True
                    break
                elif d_end < 50:
                    all_points.extend(reversed(coords[:-1]))
                    available_nodes.pop(i)
                    changed = True
                    break
                
                # Try to prepend to start
                d_start_prev = calculate_distance(all_points[0], coords[0])
                d_end_prev = calculate_distance(all_points[0], coords[-1])
                
                if d_end_prev < 50:
                    all_points = list(coords) + all_points[1:]
                    available_nodes.pop(i)
                    changed = True
                    break
                elif d_start_prev < 50:
                    all_points = list(reversed(coords)) + all_points[1:]
                    available_nodes.pop(i)
                    changed = True
                    break

    if len(all_points) < 2:
        return [], set(), 0

    # 2. Intersection Detection
    carrefour_indices = {0, len(all_points) - 1}
    if forcer_carrefours:
        if instr:
            for i in instr:
                c = i['geometry']['coordinates'][0]
                for idx, p in enumerate(all_points):
                    if abs(p[0]-c[0]) < 0.0005 and abs(p[1]-c[1]) < 0.0005:
                        if calculate_distance(p, c) < 10:
                            carrefour_indices.add(idx)
                            break
        else:
            osm_intersections = get_intersections_from_overpass(all_points)
            for osm_p in osm_intersections:
                for idx, p in enumerate(all_points):
                    if abs(p[0]-osm_p[0]) < 0.0005 and abs(p[1]-osm_p[1]) < 0.0005:
                        if calculate_distance(p, osm_p) < 10:
                            carrefour_indices.add(idx)
                            break
                            
    return all_points, list(carrefour_indices), len(instr)

def solve_polygonalisation(all_points, carrefour_indices, tolerance_angle=45, min_dist=80, hors_piste=False, forcer_carrefours=True, masked_nodes=None, forced_nodes=None):
    """
    Transforms a dense list of geographic points into larger abstracted segments (polygonalisation).
    
    The splitting logic determines when to break a segment based on several rules (priority descending):
    1. is_last: Always split at the very last point.
    2. forced_nodes: Always split if the user manually enforced a cut here.
    3. masked_nodes: Never split if the user manually suppressed a cut here.
    4. min_dist: Do not split if the accumulated distance since the last split is less than 80m.
    5. angular diff: Split if the path turns more than `tolerance_angle` degrees.
       If `forcer_carrefours` is true and we're at a detected intersection, split on milder turns (>15°).
       
    Args:
        all_points (list): Sequential line coordinates.
        carrefour_indices (list): Indices in all_points corresponding to intersections.
        tolerance_angle (int): Angle deviation required to trigger a split.
        min_dist (int): Minimum segment length in meters.
        hors_piste (bool): Replaces resulting geometry with a straight line between cuts.
        forcer_carrefours (bool): Treat intersections with higher sensitivity.
        masked_nodes/forced_nodes (list): User overrides for splitting.
        
    Returns:
        list: GeoJSON Feature array mapping the abstracted itinerary segments.
    """
    if not all_points: return []
    carrefour_set = set(carrefour_indices)
    masked_set = set(masked_nodes) if masked_nodes else set()
    forced_set = set(forced_nodes) if forced_nodes else set()
    
    final_features = []
    last_idx = 0
    current_dist = 0
    
    for i in range(1, len(all_points)):
        p_prev = all_points[i-1]
        p_curr = all_points[i]
        current_dist += calculate_distance(p_prev, p_curr)
        
        is_last = (i == len(all_points) - 1)
        do_split = False
        
        # Split Logic Priority: Final > Forced > Masked > Algorithm
        if is_last:
            do_split = True
        elif i in forced_set:
            # User manually forced this split
            do_split = True
        elif i in masked_set:
            # User manually suppressed this split - ignore others
            do_split = False
        elif current_dist < min_dist:
            # Too close to previous node
            do_split = False
        else:
            # Algorithm logic
            p_next = all_points[i+1]
            b1 = calculate_bearing(p_prev, p_curr)
            b2 = calculate_bearing(p_curr, p_next)
            
            diff = abs(b1 - b2)
            if diff > 180: diff = 360 - diff
            
            if i in carrefour_set and forcer_carrefours:
                # Intersection: only split if there is a real turn (> 15°)
                if diff > 15:
                    do_split = True
            elif diff > tolerance_angle:
                # Regular path turn
                do_split = True

        if do_split:
            p_start = all_points[last_idx]
            # Calculation: Smart Azimut (direction lookahead 20m)
            section_azi = calculate_smart_bearing(all_points, last_idx, lookahead_meters=20)
            
            geom_coords = all_points[last_idx : i+1]
            if hors_piste:
                geom_coords = [p_start, p_curr]
                
            final_features.append({
                "type": "Feature",
                "properties": {
                    "azimut": round(section_azi),
                    "metrage": round(current_dist),
                    "coords_intersection": p_start,
                    "start_idx": last_idx,
                    "point_idx": i # Index in all_points of the END of this segment
                },
                "geometry": {
                    "type": "LineString",
                    "coordinates": geom_coords
                }
            })
            last_idx = i
            current_dist = 0

    return final_features

def process_trajectory_data(data, tolerance_angle=45, hors_piste=False, forcer_carrefours=True, min_dist=80, masked_nodes=None, forced_nodes=None):
    """
    Unified entry point (Legacy support).
    """
    all_points, carrefour_indices, instr_count = analyze_trajectory(data, forcer_carrefours)
    return solve_polygonalisation(all_points, carrefour_indices, tolerance_angle, min_dist, hors_piste, forcer_carrefours, masked_nodes, forced_nodes)

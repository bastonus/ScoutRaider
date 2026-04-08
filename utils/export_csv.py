import csv
import math

def export_csv_file(state_manager, filepath, opts):
    steps = state_manager.get_state("polygonal_steps", [])
    
    manual_assigns = state_manager.get_state("custom_assignments", {})
    auto_assigns   = state_manager.get_state("auto_assignments", {})
    stages         = state_manager.get_state("stages", [])

    def _haversine_m(lat1, lon1, lat2, lon2):
        R = 6371000
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    sorted_stages = sorted(stages, key=lambda s: s.get("label", ""))
    stage_seg_indices = []
    
    for stage in sorted_stages:
        slat, slon = stage["lat"], stage["lon"]
        best_idx, best_d = 0, float("inf")
        for i, seg in enumerate(steps):
            coords = seg.get("coords", [])
            if not coords:
                coords = seg.get("properties", {}).get("coords_intersection", None)
                if coords:
                    node_lon, node_lat = coords[0], coords[1]
                else:
                    continue
            else:
                node_lon, node_lat = coords[0][0], coords[0][1]
            d = _haversine_m(slat, slon, node_lat, node_lon)
            if d < best_d:
                best_d, best_idx = d, i
        stage_seg_indices.append(best_idx)

    def _troncon_label(seg_idx):
        if not sorted_stages or len(sorted_stages) < 2:
            return ""
        for k in range(len(stage_seg_indices) - 1):
            lo = stage_seg_indices[k]
            hi = stage_seg_indices[k + 1]
            if lo > hi:
                lo, hi = hi, lo
            if lo <= seg_idx <= hi:
                lbl_a = sorted_stages[k].get("label", str(k))
                lbl_b = sorted_stages[k + 1].get("label", str(k + 1))
                return f"{lbl_a}\u2192{lbl_b}"
        if seg_idx < stage_seg_indices[0]:
            return f"?\u2192{sorted_stages[0].get('label', 'A')}"
        return f"{sorted_stages[-1].get('label', '?')}\u2192?"

    sep = ';' if "Point-virgule" in opts.get("separator", ";") else ','
    enc_opt = opts.get("encoding", "UTF-8 avec BOM")
    if "BOM" in enc_opt:
        enc = "utf-8-sig"
    elif "latin" in enc_opt.lower():
        enc = "latin-1"
    else:
        enc = "utf-8"

    with open(filepath, 'w', newline='', encoding=enc) as f:
        writer = csv.writer(f, delimiter=sep)
        writer.writerow([
            "N°", "Latitude", "Longitude",
            "Azimut (°)", "Métrage (m)",
            "Technique", "Tronçon"
        ])
        for i, seg in enumerate(steps):
            props    = seg.get("properties", {})
            coords   = seg.get("coords", [])
            azimut   = seg.get("azimut",   props.get("azimut",  ""))
            metrage  = seg.get("distance",  props.get("metrage", ""))

            if coords:
                node_lon, node_lat = coords[0][0], coords[0][1]
            else:
                ci = props.get("coords_intersection")
                if ci:
                    node_lon, node_lat = ci[0], ci[1]
                else:
                    node_lat = node_lon = ""

            technique = (manual_assigns.get(str(i)) or auto_assigns.get(str(i)) or "")
            troncon = _troncon_label(i)

            lat_str = f"{node_lat:.6f}".replace('.', ',') if isinstance(node_lat, float) else node_lat
            lon_str = f"{node_lon:.6f}".replace('.', ',') if isinstance(node_lon, float) else node_lon

            writer.writerow([
                i + 1, lat_str, lon_str,
                azimut, metrage,
                technique, troncon
            ])

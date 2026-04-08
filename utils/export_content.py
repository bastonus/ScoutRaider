"""
export_content.py — Shared content extractor for HTML/DOCX/ODT faithful export.

Extracts step content without a PDF canvas:
  - Map images (IGN tiles → PIL → PNG bytes)
  - Module text (clair + encoded via each module's encode function)
  - Gilwell diagrams as SVG strings
  - Annexe table data (Polybe, Vigenere, Morse, Maritime)
  - Font info and install instructions
  - Theme labels / step headers
"""

import os
import math
import base64
import importlib
from io import BytesIO

# ─── Project root (same as main_orchestrator.py) ────────────────────────────
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODULES_DIR  = os.path.join(PROJECT_ROOT, 'modules')

# ─── Font metadata per module ────────────────────────────────────────────────
MODULE_FONTS = {
    'morse':    {'name': 'Morse',    'file': os.path.join(MODULES_DIR, 'morse',    'assets', 'morse.ttf')},
    'maritime': {'name': 'Maritime', 'file': os.path.join(MODULES_DIR, 'maritime', 'assets', 'mari-01.ttf')},
    'templier': {'name': 'Templar',  'file': os.path.join(MODULES_DIR, 'templier', 'assets', 'templier.ttf')},
}

# ─── Modules that render a MAP instead of narrative text ───────────────────
MAP_MODULES = {'carte_ign', 'maritime', 'drapeaux'}
# Note: maritime draws narrative (no map), gilwell draws SVG diagram
VISUAL_MODULES = {'carte_ign', 'drapeaux', 'gilwell'}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAP IMAGE EXTRACTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _extract_map_image(all_points, flag_sequence=None, is_sol=False):
    """
    Build the same IGN tile map as draw_map_vector_on_pdf but return PIL Image.
    Returns (PIL.Image, meters_per_pixel_cropped_width, scale_m)
    """
    from PIL import Image, ImageDraw
    import utils.pdf_helpers as ph

    flag_pts = [f[2] for f in flag_sequence] if flag_sequence else []
    lons = [p[0] for p in all_points + flag_pts]
    lats = [p[1] for p in all_points + flag_pts]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)

    # Minimum geographic span (same as PDF helper)
    if max_lon - min_lon < 0.020:
        pad = (0.020 - (max_lon - min_lon)) / 2.0
        min_lon -= pad; max_lon += pad
    if max_lat - min_lat < 0.0135:
        pad = (0.0135 - (max_lat - min_lat)) / 2.0
        min_lat -= pad; max_lat += pad

    mid_lat = (min_lat + max_lat) / 2
    ZOOM = ph.ZOOM_LEVEL if hasattr(ph, 'ZOOM_LEVEL') else 15

    min_x, max_y = ph.lonlat_to_tile(min_lon - 0.0001, min_lat - 0.0001, ZOOM)
    max_x, min_y = ph.lonlat_to_tile(max_lon + 0.0001, max_lat + 0.0001, ZOOM)
    nx = max_x - min_x + 1
    ny = max_y - min_y + 1

    meters_per_pixel_eq = 40075016.686 / (2.0 ** ZOOM * 256)
    meters_per_pixel = meters_per_pixel_eq * math.cos(math.radians(mid_lat))

    # Assemble tile mosaic
    map_img = Image.new('RGB', (nx * 256, ny * 256))
    for tx in range(min_x, max_x + 1):
        for ty in range(min_y, max_y + 1):
            tile = ph.download_ign_tile(tx, ty, ZOOM)
            if tile:
                if tile.mode != 'RGB': tile = tile.convert('RGB')
                map_img.paste(tile, ((tx - min_x) * 256, (ty - min_y) * 256))

    # Project all points to pixel coordinates
    def lonlat_to_px(lon, lat):
        n = 2.0 ** ZOOM
        ax = (lon + 180.0) / 360.0 * n
        ay = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
        return (ax - min_x) * 256, (ay - min_y) * 256

    px_list = [lonlat_to_px(p[0], p[1]) for p in all_points + flag_pts]
    px_xs = [p[0] for p in px_list]
    px_ys = [p[1] for p in px_list]

    margin = 35
    px_min, px_max = min(px_xs), max(px_xs)
    py_min, py_max = min(px_ys), max(px_ys)

    TARGET = 400
    if px_max - px_min < TARGET:
        d = (TARGET - (px_max - px_min)) / 2; px_min -= d; px_max += d
    if py_max - py_min < TARGET:
        d = (TARGET - (py_max - py_min)) / 2; py_min -= d; py_max += d

    c_left  = max(0, int(px_min - margin))
    c_top   = max(0, int(py_min - margin))
    c_right = min(nx * 256, int(px_max + margin))
    c_bottom= min(ny * 256, int(py_max + margin))

    cropped = map_img.crop((c_left, c_top, c_right, c_bottom))
    wi, hi  = cropped.size
    draw    = ImageDraw.Draw(cropped)

    def get_img_pos(lon, lat):
        px, py = lonlat_to_px(lon, lat)
        return px - c_left, py - c_top

    # Draw route overlay (solution only)
    if is_sol and len(all_points) >= 2:
        pts_img = [get_img_pos(p[0], p[1]) for p in all_points]
        draw.line(pts_img, fill=(220, 30, 30), width=4)

    # Start/end markers
    if all_points:
        sx, sy = get_img_pos(all_points[0][0], all_points[0][1])
        draw.ellipse([sx-7, sy-7, sx+7, sy+7], fill=(50, 200, 50), outline=(0,0,0))
        ex, ey = get_img_pos(all_points[-1][0], all_points[-1][1])
        draw.ellipse([ex-7, ey-7, ex+7, ey+7], fill=(220, 30, 30), outline=(0,0,0))

    # Flag markers
    if flag_sequence:
        for c_name, c_rgb, (flon, flat), is_fake in flag_sequence:
            fx, fy = get_img_pos(flon, flat)
            r, g, b = int(c_rgb[0]*255), int(c_rgb[1]*255), int(c_rgb[2]*255)
            shape = (fx-8, fy-8, fx+8, fy+8)
            draw.ellipse(shape, fill=(r, g, b), outline=(0, 0, 0))

    # Scale bar
    cropped_width_m = (c_right - c_left) * meters_per_pixel
    scale_m = 1000
    for threshold, scale in [(50, 10), (100, 50), (500, 100), (1000, 500)]:
        if cropped_width_m < threshold:
            scale_m = scale; break
    else:
        scale_m = 1000

    return cropped


def _map_image_to_bytes(img):
    buf = BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


def _map_image_to_base64(img):
    return base64.b64encode(_map_image_to_bytes(img)).decode('ascii')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GILWELL SVG GENERATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _gilwell_svg(segments):
    """Generate a Gilwell azimut diagram as an SVG string."""
    W, H = 300, 400
    cx = W // 2
    margin = 30
    usable_h = H - 2 * margin

    # Simplify: merge close azimuths
    simplified = []
    for s in segments:
        az   = s.get('azimut', 0)
        dist = s.get('distance', 0)
        if simplified and abs(simplified[-1][0] - az) <= 10:
            simplified[-1] = (simplified[-1][0], simplified[-1][1] + dist)
        else:
            simplified.append((az, dist))

    if not simplified:
        return '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><text x="150" y="200" text-anchor="middle">Aucun segment</text></svg>'

    n = len(simplified)
    dy = usable_h / (n + 1)
    scale = 40  # px per unit x-displacement

    svg_lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" style="background:#fff;border:1px solid #ddd;">']
    # Nord vertical axis
    svg_lines.append(f'<line x1="{cx}" y1="{margin}" x2="{cx}" y2="{H - margin}" stroke="#999" stroke-width="1" stroke-dasharray="4,2"/>')
    svg_lines.append(f'<text x="{cx}" y="{margin - 6}" text-anchor="middle" font-size="11" fill="#666">NORD</text>')

    cur_x, cur_y = cx, margin
    for i, (az, dist) in enumerate(simplified):
        rad   = math.radians(az)
        dx    = math.sin(rad)
        end_x = int(cur_x + dx * scale)
        end_y = int(cur_y + dy)

        color = '#2d5a8e'
        svg_lines.append(f'<circle cx="{cur_x}" cy="{cur_y}" r="4" fill="{color}"/>')
        # Arrow line
        svg_lines.append(f'<line x1="{cur_x}" y1="{cur_y}" x2="{end_x}" y2="{end_y}" stroke="{color}" stroke-width="2" marker-end="url(#arrow)"/>')
        # Label
        lx = end_x + (8 if dx >= 0 else -8)
        anchor = 'start' if dx >= 0 else 'end'
        svg_lines.append(f'<text x="{lx}" y="{end_y - 4}" font-size="10" fill="#333" text-anchor="{anchor}">{int(az)}° — {int(dist)}m</text>')
        cur_x, cur_y = end_x, end_y

    svg_lines.append(f'<circle cx="{cur_x}" cy="{cur_y}" r="5" fill="#e74c3c"/>')
    svg_lines.append('<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#2d5a8e"/></marker></defs>')
    svg_lines.append('</svg>')
    return '\n'.join(svg_lines)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  ANNEXE TABLE DATA
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _morse_table():
    """Morse code reference table: {char: morse_symbol}"""
    MORSE = {
        'A':'.-','B':'-...','C':'-.-.','D':'-..','E':'.','F':'..-.','G':'--.','H':'....',
        'I':'..','J':'.---','K':'-.-','L':'.-..','M':'--','N':'-.','O':'---','P':'.--.',
        'Q':'--.-','R':'.-.','S':'...','T':'-','U':'..-','V':'...-','W':'.--','X':'-..-',
        'Y':'-.--','Z':'--..',
        '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....',
        '6':'-....','7':'--...','8':'---..','9':'----.',
    }
    return MORSE


def _polybe_grid():
    """6x6 Polybe grid: returns list of rows, each row is list of (cell_label, coord_label)"""
    GRID = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    rows = []
    for row in range(6):
        cells = []
        for col in range(6):
            idx = row * 6 + col
            if idx < len(GRID):
                cells.append((GRID[idx], f"{row+1}{col+1}"))
            else:
                cells.append(('', ''))
        rows.append(cells)
    return rows


def _vigenere_table(key):
    """Vigenere square: returns (key, 26x26 list)"""
    AB = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    table = []
    for i in range(26):
        table.append(list(AB[i:] + AB[:i]))
    return key, AB, table


def _maritime_nato():
    NATO = {
        'A':'Alpha','B':'Bravo','C':'Charlie','D':'Delta','E':'Echo',
        'F':'Foxtrot','G':'Golf','H':'Hotel','I':'India','J':'Juliett',
        'K':'Kilo','L':'Lima','M':'Mike','N':'November','O':'Oscar',
        'P':'Papa','Q':'Quebec','R':'Romeo','S':'Sierra','T':'Tango',
        'U':'Uniform','V':'Victor','W':'Whiskey','X':'X-ray','Y':'Yankee','Z':'Zulu',
        '0':'Nadazero','1':'Unaone','2':'Bissotwo','3':'Terrathree','4':'Kartefour',
        '5':'Pantafive','6':'Soxisix','7':'Setteseven','8':'Oktoeight','9':'Novenine',
    }
    return NATO


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MODULE MESSAGE EXTRACTION  (same pipeline as PDF)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _get_module_messages(mod_name, segments, is_sol):
    """
    Return list of {clair, encoded, type} for the given module and segments.
    Mirrors the PDF pipeline.
    """
    from utils.pdf_helpers import (
        generate_prohibition_text, get_nearest_poi,
        THEME_DATA, CURRENT_THEME,
    )

    msgs = []

    # Gilwell: diagram only, no text messages
    if mod_name == 'gilwell':
        return []

    # carte_ign / drapeaux: narrative will be separate from map
    # For carte_ign, no text — just the map
    if mod_name == 'carte_ign':
        return []

    # Drapeaux: generate narrated sequence
    if mod_name == 'drapeaux':
        try:
            mod = importlib.import_module('modules.drapeaux.module')
            flag_seq = mod.generate_flag_sequence(segments)
            theme_data = THEME_DATA.get(CURRENT_THEME, {})
            txt = mod.generate_thematic_drapeaux_narrative(flag_seq, theme_data)
            msgs.append({'clair': txt, 'encoded': txt, 'type': 'drapeaux'})
            if is_sol:
                trans = " | ".join([f"{f[0]}: {'PASSAGE' if not f[3] else 'PIEGE'}" for f in flag_seq])
                msgs.append({'clair': f"TRADUCTION : {trans}", 'encoded': "", 'type': 'clair'})
        except Exception as e:
            msgs.append({'clair': f"[Drapeaux error: {e}]", 'encoded': '', 'type': 'drapeaux'})
        return msgs

    # All other modules: get_nearest_poi → generate_prohibition_text → encode
    try:
        mod = importlib.import_module(f"modules.{mod_name}.module")
    except ImportError:
        mod = None

    encode_fn = None
    if mod:
        for attr in dir(mod):
            if attr.startswith('encode_'):
                encode_fn = getattr(mod, attr)
                break

    V_KEY = THEME_DATA.get(CURRENT_THEME, {}).get('vigenere_key', 'MOUSTACHE')

    for s in segments:
        az   = s.get('azimut',   s.get('properties', {}).get('azimut', 0))
        dist = s.get('distance', s.get('properties', {}).get('metrage', 0))
        poi  = get_nearest_poi(s['coords']) if (s.get('coords')) else None

        clair = generate_prohibition_text(dist, az, poi)

        if encode_fn is None or mod_name in ('texte_clair',):
            enc = clair
        else:
            try:
                if mod_name == 'vigenere':
                    enc = encode_fn(clair, V_KEY)
                elif mod_name == 'avocat':
                    enc = encode_fn(clair, 10)
                elif mod_name == 'cassis':
                    enc = encode_fn(clair, 21)
                else:
                    enc = encode_fn(clair)
            except Exception:
                enc = clair

        msgs.append({'clair': clair, 'encoded': enc, 'type': mod_name})

    return msgs


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  MAIN EXTRACTOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def extract_step_content(orchestrator, path_plan, is_sol=False):
    """
    Extract full content for all steps without a PDF canvas.

    Returns list of dicts:
    {
        step_num:    int,
        module:      str,
        label:       str,          # themed label ("Télégramme Morse", etc.)
        messages:    [{clair, encoded, type}],
        map_image:   PIL.Image | None,      # for carte_ign / drapeaux
        gilwell_svg: str | None,
        annexes:     [{type, data}],        # annexe table data
        font:        {name, file} | None,
        icon_path:   str | None,            # avocat.svg / blackcurrant.png
        vigenere_key: str | None,
        flag_sequence: list | None,         # for drapeaux (sol)
    }
    """
    import utils.pdf_helpers as ph

    results = []
    used_annexe_types = set()

    for step_num, (mod_name, s_idx, count) in enumerate(path_plan, 1):
        segments = orchestrator.segments[s_idx: s_idx + count]
        label = ph.get_theme_label(f'{mod_name}_label',
                  mod_name.replace('_', ' ').capitalize())

        step = {
            'step_num':     step_num,
            'module':       mod_name,
            'label':        label,
            'messages':     [],
            'map_image':    None,
            'gilwell_svg':  None,
            'annexes':      [],
            'font':         MODULE_FONTS.get(mod_name),
            'icon_path':    None,
            'vigenere_key': None,
            'flag_sequence': None,
        }

        # ── Icon asset (avocat / cassis)
        if mod_name == 'avocat':
            p = os.path.join(MODULES_DIR, 'avocat', 'assets', 'avocado.svg')
            if os.path.exists(p): step['icon_path'] = p
        elif mod_name == 'cassis':
            p = os.path.join(MODULES_DIR, 'cassis', 'assets', 'blackcurrant.png')
            if os.path.exists(p): step['icon_path'] = p

        # ── Map image (carte_ign, drapeaux)
        if mod_name in ('carte_ign', 'drapeaux', 'maritime'):
            all_pts = []
            for s in segments: all_pts.extend(s.get('coords', []))
            if all_pts:
                flag_seq = None
                if mod_name == 'drapeaux':
                    try:
                        dmod = importlib.import_module('modules.drapeaux.module')
                        flag_seq = dmod.generate_flag_sequence(segments)
                        step['flag_sequence'] = flag_seq
                    except Exception:
                        pass
                try:
                    step['map_image'] = _extract_map_image(all_pts, flag_seq, is_sol)
                except Exception as e:
                    step['map_image'] = None

        # ── Gilwell SVG
        if mod_name == 'gilwell':
            step['gilwell_svg'] = _gilwell_svg(segments)

        # ── Messages (text content)
        step['messages'] = _get_module_messages(mod_name, segments, is_sol)

        # ── Vigenere key
        if mod_name == 'vigenere':
            V_KEY = ph.THEME_DATA.get(ph.CURRENT_THEME, {}).get('vigenere_key', 'MOUSTACHE')
            step['vigenere_key'] = V_KEY

        # ── Annexes (generate once per type)
        if mod_name == 'polybe' and 'polybe' not in used_annexe_types:
            step['annexes'].append({'type': 'polybe', 'data': _polybe_grid()})
            used_annexe_types.add('polybe')
        elif mod_name == 'vigenere' and 'vigenere' not in used_annexe_types:
            V_KEY = ph.THEME_DATA.get(ph.CURRENT_THEME, {}).get('vigenere_key', 'MOUSTACHE')
            step['annexes'].append({'type': 'vigenere', 'data': _vigenere_table(V_KEY)})
            used_annexe_types.add('vigenere')
        elif mod_name == 'morse' and 'morse' not in used_annexe_types:
            step['annexes'].append({'type': 'morse', 'data': _morse_table()})
            used_annexe_types.add('morse')
        elif mod_name == 'maritime' and 'maritime' not in used_annexe_types:
            step['annexes'].append({'type': 'maritime', 'data': _maritime_nato()})
            used_annexe_types.add('maritime')

        results.append(step)

    return results

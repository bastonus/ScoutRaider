import json
import math
import random
import requests
import os
from io import BytesIO
from PIL import Image
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Path resolution
UTILS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(UTILS_DIR)

try:
    pdfmetrics.registerFont(TTFont('Templar', os.path.join(PROJECT_ROOT, 'modules/templier/assets/TemplarsCipherPlus.ttf')))
    pdfmetrics.registerFont(TTFont('Maritime', os.path.join(PROJECT_ROOT, 'modules/maritime/assets/mari-01.ttf')))
    pdfmetrics.registerFont(TTFont('Coolvetica', os.path.join(PROJECT_ROOT, 'assets/fonts/Coolvetica Rg.ttf')))
    pdfmetrics.registerFont(TTFont('Morse', os.path.join(PROJECT_ROOT, 'modules/morse/assets/morse.ttf')))
except: pass

SCALE_M_TO_PT = 0.113384
ZOOM_LEVEL = 15
IGN_LAYER = "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2"
GLOBAL_POIS = []
_USED_POI_CACHE = set()  # Tracks recently used POI descriptions to avoid repetition
TILE_CACHE = {}
CURRENT_THEME = "La Mafia"
THEME_DATA = {}

# themes.json is at the project root
themes_path = os.path.join(PROJECT_ROOT, 'themes.json')
if not os.path.exists(themes_path):
    # Fallback if it was actually moved to config/
    themes_path = os.path.join(PROJECT_ROOT, 'config', 'themes.json')

with open(themes_path, 'r', encoding='utf-8') as f:
    data = json.load(f)
    if '_help' in data: del data['_help']
    THEME_DATA = data

def set_global_pois(pois):
    global GLOBAL_POIS, _USED_POI_CACHE
    GLOBAL_POIS = pois
    _USED_POI_CACHE = set()  # Reset cache on each new export

def dist_m(p1, p2):
    # p1, p2 are (lon, lat)
    # Harmonisation avec Web Mercator (IGN Scan 25) : 40075016.686 / 360 = 111319.49
    dlon = (p1[0] - p2[0]) * 111319.49 * math.cos(math.radians(max(min(p1[1], 90), -90)))
    dlat = (p1[1] - p2[1]) * 111319.49
    return (dlon**2 + dlat**2)**0.5

def get_theme_label(key, default):
    # Try current theme
    labels = THEME_DATA.get(CURRENT_THEME, {}).get("labels", {})
    if key in labels: return labels[key]
    # Try Neutre
    labels_n = THEME_DATA.get("Neutre", {}).get("labels", {})
    if key in labels_n: return labels_n[key]
    return default

def fetch_all_pois(all_steps):
    if not all_steps: return []
    lons = [p for s in all_steps for p in (s['coords'][0][0], s['coords'][-1][0])]
    lats = [p for s in all_steps for p in (s['coords'][0][1], s['coords'][-1][1])]
    min_lon, max_lon = min(lons)-0.01, max(lons)+0.01
    min_lat, max_lat = min(lats)-0.01, max(lats)+0.01
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json][timeout:30];
    (
      node["amenity"~"church|place_of_worship|pub|bar|cafe|bank|police|hospital"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["shop"~"bakery|supermarket|butcher|alcohol"]({min_lat},{min_lon},{max_lat},{max_lon});
      node["historic"~"monument|castle|ruins"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["highway"~"primary|secondary|tertiary|unclassified|residential|service|path|track|footway"]["name"]({min_lat},{min_lon},{max_lat},{max_lon});
      way["highway"~"path|track"]["ref"~"GR"]({min_lat},{min_lon},{max_lat},{max_lon});
    );
    out center;
    """
    print(f"  Querying Overpass for POIs and Roads in area...")
    try:
        r = requests.post(overpass_url, data={'data': overpass_query}, timeout=30)
        data = r.json()
        print(f"  Found {len(data.get('elements', []))} POI/Road elements.")
        pois = []
        if 'elements' in data:
            for e in data['elements']:
                lat = e.get('lat', e.get('center', {}).get('lat'))
                lon = e.get('lon', e.get('center', {}).get('lon'))
                if lat and lon:
                    pois.append({'lat': lat, 'lon': lon, 'tags': e.get('tags', {}), 'type': e.get('type')})
        return pois
    except:
        return []

def fetch_local_roads(min_lon, min_lat, max_lon, max_lat):
    overpass_url = "http://overpass-api.de/api/interpreter"
    pad = 0.005
    overpass_query = f"""
    [out:json][timeout:25];
    way["highway"]({min_lat-pad},{min_lon-pad},{max_lat+pad},{max_lon+pad});
    out geom;
    """
    try:
        r = requests.post(overpass_url, data={'data': overpass_query}, timeout=30)
        data = r.json()
        points = []
        if 'elements' in data:
            for e in data['elements']:
                if 'geometry' in e:
                    for nd in e['geometry']:
                        points.append((nd['lon'], nd['lat']))
        return points
    except:
        return []

def reverse_geocode(lat, lon):
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
        r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 ScoutRaiderSuite'})
        data = r.json()
        addr = data.get('address', {})
        street = addr.get('road', addr.get('pedestrian', ''))
        city = addr.get('town', addr.get('village', addr.get('city', addr.get('municipality', ''))))
        return f"{street}, {city}" if street and city else (street or city or "Emplacement Inconnu")
    except:
        return "Localisation indisponible"

def get_nearest_poi(coords_list):
    global _USED_POI_CACHE
    if not coords_list or not GLOBAL_POIS: return None
    
    global_best = None
    global_best_dist = float('inf')
    global_best_street = ""
    
    # We sample every 5th point to optimize if the segment has many points
    sample_coords = coords_list[::5] if len(coords_list) > 20 else coords_list
    if coords_list[-1] not in sample_coords:
        sample_coords.append(coords_list[-1])
        
    for pt in sample_coords:
        if not pt or len(pt) < 2: continue
        lon, lat = pt[0], pt[1]
        
        best = None
        best_dist = float('inf')
        
        # 1. Find nearest amenity/shop/historic (within 150m)
        for poi in GLOBAL_POIS:
            if 'highway' in poi['tags']: continue
            dlat = (poi['lat'] - lat) * 111000
            dlon = (poi['lon'] - lon) * 111000 * math.cos(math.radians(lat))
            dist = math.sqrt(dlat**2 + dlon**2)
            if dist < 150 and dist < best_dist:
                best_dist = dist
                best = poi
                
        if best and best_dist < global_best_dist:
            global_best_dist = best_dist
            global_best = best
            
            # 2. Find nearest street for context for this specific POI
            best_road_dist = float('inf')
            street_name = ""
            for poi in GLOBAL_POIS:
                if 'highway' not in poi['tags']: continue
                dlat = (poi['lat'] - lat) * 111000
                dlon = (poi['lon'] - lon) * 111000 * math.cos(math.radians(lat))
                dist = math.sqrt(dlat**2 + dlon**2)
                if dist < 50 and dist < best_road_dist:
                    best_road_dist = dist
                    tags = poi['tags']
                    street_name = tags.get('name', tags.get('ref', ''))
            global_best_street = street_name

    if global_best:
        tags = global_best['tags']
        name = tags.get('name', '')
        poi_type = "un bâtiment"
        if 'amenity' in tags:
            v = tags['amenity']
            if v in ['pub', 'bar', 'cafe']: poi_type = "un speakeasy"
            elif v in ['church', 'place_of_worship']: poi_type = "la paroisse chuchotante"
            elif v == 'police': poi_type = "le repaire des poulets"
            elif v == 'bank': poi_type = "la banque"
            elif v == 'hospital': poi_type = "l'infirmerie"
        elif 'shop' in tags:
            v = tags['shop']
            if v == 'bakery': poi_type = "la boulangerie"
            elif v == 'alcohol': poi_type = "notre planque à gnôle"
        elif 'historic' in tags:
            poi_type = "un monument chargé d'histoire"
            
        full_desc = f"{poi_type}"
        if name: full_desc += f" {name}"       # No quotes around the name
        if global_best_street: full_desc += f", {global_best_street}"
        
        # Anti-repetition: if this exact description was already used, skip it
        if full_desc in _USED_POI_CACHE:
            return None
        _USED_POI_CACHE.add(full_desc)
        return full_desc
    return None

def get_turn_instruction(prev_azi, curr_azi):
    if prev_azi is None: return "Prenez"
    diff = (curr_azi - prev_azi + 180) % 360 - 180
    if abs(diff) < 20: return "Continuez tout droit"
    if 20 <= diff < 60: return "Obliquez légèrement à droite"
    if 60 <= diff < 120: return "Tournez à droite"
    if 120 <= diff < 160: return "Prenez brusquement à droite"
    if -60 < diff <= -20: return "Obliquez légèrement à gauche"
    if -120 < diff <= -60: return "Tournez à gauche"
    if -160 < diff <= -120: return "Prenez brusquement à gauche"
    if abs(diff) >= 160: return "Faites demi-tour"
    return "Suivez la route"

def get_road_at(lon, lat):
    if not GLOBAL_POIS: return ""
    best_dist = float('inf')
    road_name = ""
    for poi in GLOBAL_POIS:
        if 'highway' not in poi['tags']: continue
        d = dist_m((lon, lat), (poi['lon'], poi['lat']))
        if d < 50 and d < best_dist:
            best_dist = d
            tags = poi['tags']
            road_name = tags.get('name', tags.get('ref', ''))
    return road_name

def find_nearest_road_point(lon, lat, max_dist=300):
    if not GLOBAL_POIS: return None
    best_dist = float('inf')
    best_pt = None
    for poi in GLOBAL_POIS:
        if 'highway' not in poi.get('tags', {}): continue
        d = dist_m((lon, lat), (poi['lon'], poi['lat']))
        if d < best_dist and d <= max_dist:
            best_dist = d
            best_pt = (poi['lon'], poi['lat'])
    return best_pt

def get_poi_count(lon, lat, radius=300):
    if not GLOBAL_POIS: return 0
    count = 0
    for poi in GLOBAL_POIS:
        # Exclusion des routes du décompte de densité POI
        if 'highway' in poi['tags']: continue
        dlat = (poi['lat'] - lat) * 111000
        dlon = (poi['lon'] - lon) * 111000 * math.cos(math.radians(lat))
        dist = math.sqrt(dlat**2 + dlon**2)
        if dist < radius: count += 1
    return count

def format_direction(azimut):
    azimut = int(round(azimut))
    mode = random.choice(['deg', 'clock', 'rose'])
    if mode == 'deg':
        return random.choice([f"à l'azimut {azimut}°", f"au cap {azimut}°", f"vers les {azimut}°"])
    elif mode == 'clock':
        h = int(round(azimut / 30.0)) % 12
        if h == 0: h = 12
        return random.choice([f"vers {h}h", f"direction {h} heures", f"à {h}h"])
    else:
        points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"]
        idx = int(round(azimut / 22.5)) % 16
        pt = points[idx]
        return random.choice([f"vers le {pt}", f"cap au {pt}", f"plein {pt}"])

def generate_prohibition_text(distance, azimut, poi_str=None):
    theme_data = THEME_DATA.get(CURRENT_THEME, THEME_DATA.get("Neutre", {}))
    intros = theme_data.get('intros', [""])
    actions = theme_data.get('actions', ["marche"])
    poi_fmt = theme_data.get('poi', "passe devant {poi}, et")
    
    texte = f"{random.choice(intros)} "
    if poi_str:
        texte += poi_fmt.replace('{poi}', poi_str) + " "
    
    direction = format_direction(azimut)
    texte += f"{random.choice(actions)} {distance}m {direction}."
    return texte

def lonlat_to_tile(lon, lat, zoom):
    n = 2.0 ** zoom
    xtile = int((lon + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return xtile, ytile

def download_ign_tile(x, y, z):
    key = (x, y, z, IGN_LAYER)
    if key in TILE_CACHE: return TILE_CACHE[key]
    
    fmt = "image/jpeg" if ('MAPS' in IGN_LAYER or 'ORTHO' in IGN_LAYER) else "image/png"
    url = f"https://data.geopf.fr/wmts?LAYER={IGN_LAYER}&FORMAT={fmt}&SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
    headers = {'User-Agent': 'Mozilla/5.0 ScoutRaiderSuite'}
    for attempt in range(3):
        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code == 200:
                img = Image.open(BytesIO(r.content))
                # Composite RGBA onto white background to preserve text labels
                if img.mode == 'RGBA':
                    bg = Image.new('RGB', img.size, (255, 255, 255))
                    bg.paste(img, mask=img.split()[3])  # Use alpha channel as mask
                    img = bg
                elif img.mode != 'RGB':
                    img = img.convert('RGB')
                TILE_CACHE[key] = img
                return img
            elif r.status_code == 429: # Throttling
                import time
                time.sleep(1)
        except: pass
    # Return placeholder if fails after 3 tries to avoid infinite loop / hang
    return Image.new('RGB', (256, 256), (240, 240, 240))

def draw_step_header(c, step_num, element_type, is_solution, w_pdf, y_start):
    y = y_start - 20
    
    types_map = {
        'ign': get_theme_label('ign_label', 'Carte IGN'),
        'gilwell': get_theme_label('gilwell_label', 'Relevé Gilwell'),
        'morse': get_theme_label('morse_label', 'Télégramme Morse'),
        'templier': get_theme_label('templier_label', 'Signes des Templiers'),
        'cassis': get_theme_label('cassis_label', 'Message Parfumé'),
        'avocat': get_theme_label('avocat_label', 'Note Administrative'),
        'vigenere': get_theme_label('vigenere_label', 'Chiffre Mystérieux'),
        'clair': get_theme_label('clair_label', 'Message Clair'),
        'maritime': get_theme_label('maritime_label', 'Signaux Maritimes'),
        'polybe': get_theme_label('polybe_label', 'Carré de Polybe'),
        'drapeaux': get_theme_label('drapeaux_label', 'Fanions de signalisation')
    }
    suffix = types_map.get(element_type, element_type.upper())
    
    if is_solution and suffix:
        suffix += " (SOLUTION)"
        
    x = 50
    if step_num:
        label = str(step_num)
        c.setFillColorRGB(0.1, 0.1, 0.1)
        try: c.setFont("Coolvetica", 12 if len(label) > 3 else 16)
        except: c.setFont("Helvetica-Bold", 11 if len(label) > 3 else 14)
        
        tw = c.stringWidth(label)
        box_w = max(28, tw + 10)
        c.roundRect(x, y - 8, box_w, 28, 8, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.drawCentredString(x + box_w/2, y + 1, label)
        text_x = x + box_w + 10
    else:
        text_x = x
        
    if suffix:
        try:
            c.setFont("Coolvetica", 20)
        except:
            c.setFont("Helvetica-Bold", 18)
        if is_solution:
            c.setFillColorRGB(0.3, 0.3, 0.3)
        else:
            c.setFillColorRGB(0.1, 0.1, 0.1)
        c.drawString(text_x, y, suffix)
        
    icon_size = 35
    icon_x = w_pdf - x - icon_size
    icon_y = y - 5
    if element_type == 'avocat':
        icon_path = os.path.join(PROJECT_ROOT, "modules", "avocat", "assets", "avocado.svg")
        if os.path.exists(icon_path):
            try:
                from svglib.svglib import svg2rlg
                from reportlab.graphics import renderPDF
                drawing = svg2rlg(icon_path)
                if drawing:
                    scale = icon_size / max(drawing.width, drawing.height)
                    drawing.width, drawing.height = drawing.width * scale, drawing.height * scale
                    drawing.scale(scale, scale)
                    renderPDF.draw(drawing, c, icon_x, icon_y)
            except: pass
    elif element_type == 'cassis':
        icon_path = os.path.join(PROJECT_ROOT, "modules", "cassis", "assets", "blackcurrant.png")
        if os.path.exists(icon_path):
            c.drawImage(icon_path, icon_x, icon_y, width=icon_size, height=icon_size, mask='auto')

    y -= 15
    return y - 35 # Increased margin below header to prevent overlaps

def calc_narrative_height(c, messages, width_pdf, is_solution):
    if not messages: return 0
    m_type = messages[0].get('type', 'message')

    margin = 50
    rect_x = margin + 20
    rect_w = width_pdf - (2 * margin) - 20

    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle

    flowables = []
    total_text_h = 0
    
    for m in messages:
        is_templar = (m.get('type') == 'templier') and not is_solution
        is_maritime = (m.get('type') == 'maritime') and not is_solution
        is_morse = (m.get('type') == 'morse') and not is_solution
        
        font_name = "Courier"
        font_size = 11
        leading = 14
        
        if is_templar:
            font_name = "Templar"
            font_size = 20
            leading = font_size * 1.5
        elif is_maritime:
            font_name = "Maritime"
            font_size = 26
            leading = font_size * 1.5
        elif is_morse:
            font_name = "Morse"
            font_size = 12
            leading = font_size * 1.5
        elif m.get('type') == 'polybe':
            font_size = 11
            leading = font_size * 1.5
        elif m.get('type') in ['avocat', 'cassis', 'vigenere']:
            font_size = 11
            leading = font_size * 1.8
            
        if is_solution:
            leading = font_size + 4 
            
        style = ParagraphStyle(
            name=f'style_{m_type}',
            fontName=font_name,
            fontSize=font_size,
            leading=leading,
            textColor='#191919'
        )
        
        txt = m['clair'] if is_solution else m['encoded']
        txt = str(txt).replace('\n', '<br/>')
        
        p = Paragraph(txt, style)
        w, h = p.wrap(rect_w, 1000)
        flowables.append((p, w, h))
        total_text_h += h + 15
        
    return total_text_h

def draw_narrative_messages_on_pdf(c, messages, is_solution, width_pdf, y_start, h_limit=None, step_num=None):
    if not messages: return y_start
    m_type = messages[0].get('type', 'message')

    margin = 50
    rect_x = margin + 20
    rect_w = width_pdf - (2 * margin) - 20
    page_bottom = 60  # Minimum y before page break

    from reportlab.platypus import Paragraph
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.pagesizes import A4
    h_pdf = A4[1]

    # 1. Prepare all paragraphs and measure their heights
    flowables = []
    total_text_h = 0
    
    for m in messages:
        is_templar = (m.get('type') == 'templier') and not is_solution
        is_maritime = (m.get('type') == 'maritime') and not is_solution
        is_morse = (m.get('type') == 'morse') and not is_solution
        
        font_name = "Courier"
        font_size = 11
        leading = 14
        
        if is_templar:
            font_name = "Templar"
            font_size = 16 if h_limit else 20
            leading = font_size * 1.5
        elif is_maritime:
            font_name = "Maritime"
            font_size = 22 if h_limit else 26
            leading = font_size * 1.5
        elif is_morse:
            font_name = "Morse"
            font_size = 10 if h_limit else 12
            leading = font_size * 1.5
        elif m.get('type') == 'polybe':
            font_size = 10 if h_limit else 11
            leading = font_size * 1.5
        elif m.get('type') in ['avocat', 'cassis', 'vigenere']:
            font_size = 10 if h_limit else 11
            leading = font_size * 1.8
            
        if is_solution:
            leading = font_size + 4 
            
        style = ParagraphStyle(
            name=f'style_{m_type}',
            fontName=font_name,
            fontSize=font_size,
            leading=leading,
            textColor='#191919'
        )
        
        txt = m['clair'] if is_solution else m['encoded']
        txt = str(txt).replace('\n', '<br/>')
        
        p = Paragraph(txt, style)
        w, h = p.wrap(rect_w, 1000)  # Wrap against infinite virtual height bounds
        flowables.append((p, w, h))
        total_text_h += h + 15
        
    # Header consumes exactly 70 pts vertical space if present
    header_h = 70 if step_num is not None else 0
    total_req_h = header_h + total_text_h
    
    # 2. Quick check: does everything fit on the current page?
    if y_start - total_req_h < page_bottom:
        # Check if it would fit on a completely fresh page
        fresh_page_avail = (h_pdf - 60) - page_bottom
        if total_req_h <= fresh_page_avail:
            # It fits on a fresh page but not here → request page break
            return -1
        # Otherwise it's too large for ANY single page → we must paginate internally
        # (fall through to the drawing loop which handles auto-pagination)
        
    # 3. Draw the header (on current page)
    if step_num is not None:
        y = draw_step_header(c, step_num, m_type, is_solution, width_pdf, y_start)
    else:
        y = y_start
        
    # 4. Draw paragraphs one by one, auto-paginating when needed
    for p, w, h in flowables:
        if y - h < page_bottom:
            # Not enough room for this paragraph → page break
            c.showPage()
            y = h_pdf - 60
            
        y -= h
        p.drawOn(c, rect_x, y)
        y -= 15
        
    return y

def add_footer_and_page(c, w_pdf, num, base_name=""):
    c.setFont("Helvetica", 9)
    if base_name: c.drawString(40, 20, base_name.upper())
    c.drawString(w_pdf - 80, 20, f"Page {num}")
    c.showPage()

def draw_key_footer(c, w_pdf, y_start, key_str):
    y = y_start - 20
    c.setFont("Courier-Bold", 14)
    c.setStrokeColorRGB(0.4, 0.4, 0.4)
    c.setFillColorRGB(0.4, 0.4, 0.4)
    txt_w = c.stringWidth(key_str, "Courier-Bold", 14)
    tot_w = 20 + 10 + txt_w
    start_x = (w_pdf - tot_w) / 2
    c.setLineWidth(1.5)
    c.circle(start_x + 6, y + 6, 4)
    c.line(start_x + 10, y + 6, start_x + 22, y + 6)
    c.line(start_x + 16, y + 6, start_x + 16, y + 2)
    c.line(start_x + 20, y + 6, start_x + 20, y + 2)
    c.drawString(start_x + 30, y + 2, key_str)
    return y - 30

def draw_map_vector_on_pdf(c, all_points, map_type, w_pdf, y_start, p_data=None, is_sol=False, step_num=None):
    y = draw_step_header(c, step_num, map_type, is_sol, w_pdf, y_start)
    
    flag_pts = []
    if map_type == 'drapeaux' and p_data and 'flag_sequence' in p_data:
        flag_pts = [f[2] for f in p_data['flag_sequence']]
        
    lons = [p[0] for p in all_points + flag_pts]
    lats = [p[1] for p in all_points + flag_pts]
    min_lon, max_lon = min(lons), max(lons)
    min_lat, max_lat = min(lats), max(lats)
    
    # Enforce a minimum geographic span so short IGN segments still produce a macroscopic map
    # A minimum context of 1.5km (approx 6cm on paper at 1:25000)
    # 1.5km is ~0.0135 degrees lat and ~0.020 degrees lon (in Île-de-France)
    lon_span = max_lon - min_lon
    lat_span = max_lat - min_lat
    if lon_span < 0.020:
        pad = (0.020 - lon_span) / 2.0
        min_lon -= pad
        max_lon += pad
    if lat_span < 0.0135:
        pad = (0.0135 - lat_span) / 2.0
        min_lat -= pad
        max_lat += pad

    mid_lat = (min_lat+max_lat)/2
    
    min_x, max_y = lonlat_to_tile(min_lon-0.0001, min_lat-0.0001, ZOOM_LEVEL)
    max_x, min_y = lonlat_to_tile(max_lon+0.0001, max_lat+0.0001, ZOOM_LEVEL)
    nx, ny = max_x - min_x + 1, max_y - min_y + 1
    
    meters_per_pixel_eq = 40075016.686 / (2.0 ** ZOOM_LEVEL * 256)
    meters_per_pixel = meters_per_pixel_eq * math.cos(math.radians(mid_lat))
    
    map_img = Image.new('RGB', (nx * 256, ny * 256))
    total_t = nx * ny
    curr_t = 0
    for x in range(min_x, max_x + 1):
        for py in range(min_y, max_y + 1):
            curr_t += 1
            print(f"      - Tile {curr_t}/{total_t}...", end='\r')
            tile = download_ign_tile(x, py, ZOOM_LEVEL)
            map_img.paste(tile, ((x - min_x) * 256, (py - min_y) * 256))
    print(f"      - Tiles downloaded: {total_t} (Cache size: {len(TILE_CACHE)})")

    px_list, py_list = [], []
    for pt in all_points + flag_pts:
        lon, curr_lat = pt[0], pt[1]
        n = 2.0 ** ZOOM_LEVEL
        ax = (lon + 180.0) / 360.0 * n
        ay = (1.0 - math.asinh(math.tan(math.radians(curr_lat))) / math.pi) / 2.0 * n
        px_list.append((ax - min_x) * 256)
        py_list.append((ay - min_y) * 256)
        
    margin = 35
    px_min, px_max = min(px_list), max(px_list)
    py_min, py_max = min(py_list), max(py_list)
    
    target_pw = 400
    target_ph = 400
    if px_max - px_min < target_pw:
        diff = target_pw - (px_max - px_min)
        px_min -= diff / 2
        px_max += diff / 2
    if py_max - py_min < target_ph:
        diff = target_ph - (py_max - py_min)
        py_min -= diff / 2
        py_max += diff / 2
        
    c_left = max(0, int(px_min - margin))
    c_top = max(0, int(py_min - margin))
    c_right = min(nx*256, int(px_max + margin))
    c_bottom = min(ny*256, int(py_max + margin))
    
    map_img = map_img.crop((c_left, c_top, c_right, c_bottom))
    wi, hi = map_img.size
    aspect = hi / wi if wi != 0 else 1.0
    
    max_dw = w_pdf - 40
    max_dh = 450
    dw = max_dw
    dh = dw * aspect
    if dh > max_dh:
        dh = max_dh
        dw = dh / aspect
        
    print(f"    Drawing {map_type.capitalize()} map: {nx}x{ny} tiles cropped -> autoscaled to {dw:.1f}x{dh:.1f} pts")
            
    buf = BytesIO(); map_img.save(buf, format='PNG'); buf.seek(0)
    pdf_img = ImageReader(buf)
    
    draw_top = y
    draw_x = (w_pdf - dw)/2
    draw_y = draw_top - dh
    c.drawImage(pdf_img, draw_x, draw_y, width=dw, height=dh)
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1)
    c.rect(draw_x, draw_y, dw, dh)
    
    def get_pdf_pos(lon, lat):
        n = 2.0 ** ZOOM_LEVEL
        ax_pos = (lon + 180.0) / 360.0 * n
        ay_pos = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
        px = (ax_pos - min_x) * 256 - c_left
        py = (ay_pos - min_y) * 256 - c_top
        pdf_x = draw_x + (px / wi) * dw
        pdf_y = draw_y + dh - (py / hi) * dh
        return pdf_x, pdf_y

    start_pos = get_pdf_pos(all_points[0][0], all_points[0][1])

    if is_sol and (map_type == 'ign' or map_type == 'drapeaux'):
        c.setStrokeColorRGB(1, 0, 0)
        c.setLineJoin(1)
        if map_type == 'drapeaux':
            c.setLineWidth(2)
            c.setDash([6, 4], 0)
        else:
            c.setLineWidth(4)
            c.setDash([], 0)
            
        p = c.beginPath()
        p.moveTo(*start_pos)
        for pt in all_points[1:]: p.lineTo(*get_pdf_pos(pt[0], pt[1]))
        c.drawPath(p, fill=0, stroke=1)
        c.setDash([], 0)
        
    if map_type == 'ign':
        # Start marker (Green)
        c.setFillColorRGB(0, 1, 0)
        c.setStrokeColorRGB(0, 0, 0)
        c.setLineWidth(1)
        c.circle(start_pos[0], start_pos[1], 4, fill=1, stroke=1)
        
        # End marker (Red)
        end_pos = get_pdf_pos(all_points[-1][0], all_points[-1][1])
        c.setFillColorRGB(1, 0, 0)
        c.circle(end_pos[0], end_pos[1], 4, fill=1, stroke=1)

    if map_type == 'drapeaux' and p_data and 'flag_sequence' in p_data:
        for f_info in p_data['flag_sequence']:
            c_name, c_rgb, (flon, flat), is_fake = f_info
            px, py = get_pdf_pos(flon, flat)
            c.setFillColorRGB(*c_rgb)
            c.setStrokeColorRGB(0,0,0)
            c.circle(px, py, 6, fill=1, stroke=1)
    
    cropped_width_m = (c_right - c_left) * meters_per_pixel
    scale_m = 1000
    if cropped_width_m < 1000: scale_m = 500
    if cropped_width_m < 500: scale_m = 100
    if cropped_width_m < 100: scale_m = 50
    if cropped_width_m < 50: scale_m = 10
    
    scale_w = dw * (scale_m / cropped_width_m)
    bar_x = draw_x + dw - scale_w - 10
    bar_y = draw_y + 10
    c.setFillColorRGB(1, 1, 1)
    c.rect(bar_x - 5, bar_y - 2, scale_w + 10, 15, fill=1, stroke=1)
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(2)
    c.line(bar_x, bar_y + 2, bar_x + scale_w, bar_y + 2)
    c.line(bar_x, bar_y, bar_x, bar_y + 4)
    c.line(bar_x + scale_w, bar_y, bar_x + scale_w, bar_y + 4)
    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(bar_x + scale_w/2, bar_y + 5, f"{scale_m} m")
    return draw_y - 40

def draw_global_map_page(c, w_pdf, h_pdf, title, coords_list, line_color, is_poly=False):
    try: c.setFont("Coolvetica", 28)
    except: c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w_pdf/2, h_pdf - 40, title)
    
    all_points = []
    for seg in coords_list: all_points.extend(seg)
    lons = [pt[0] for pt in all_points]
    lats = [pt[1] for pt in all_points]
    
    min_lon, max_lon = min(lons)-0.005, max(lons)+0.005
    min_lat, max_lat = min(lats)-0.005, max(lats)+0.005
    
    width_m = (max_lon - min_lon) * 111000 * math.cos(math.radians((min_lat+max_lat)/2))
    if width_m < 2000: z = 16
    elif width_m < 5000: z = 15
    elif width_m < 10000: z = 14
    else: z = 13
    
    min_x, max_y = lonlat_to_tile(min_lon, min_lat, z)
    max_x, min_y = lonlat_to_tile(max_lon, max_lat, z)
    
    if (max_x - min_x) > 10 or (max_y - min_y) > 10:
        z -= 1; min_x, max_y = lonlat_to_tile(min_lon, min_lat, z); max_x, min_y = lonlat_to_tile(max_lon, max_lat, z)
        
    n_cols = max_x - min_x + 1
    n_rows = max_y - min_y + 1
    pix_w = n_cols * 256
    pix_h = n_rows * 256
    merged = Image.new('RGB', (pix_w, pix_h))
    
    for tx in range(min_x, max_x + 1):
        for ty in range(min_y, max_y + 1):
            tile = download_ign_tile(tx, ty, z)
            if tile:
                if tile.mode != 'RGB': tile = tile.convert('RGB')
                merged.paste(tile, ((tx - min_x)*256, (ty - min_y)*256))
                
    wi, hi = merged.size
    aspect = hi / wi
    dw = w_pdf - 40
    dh = dw * aspect
    if dh > (h_pdf - 120): dh = h_pdf - 120; dw = dh / aspect
        
    draw_x = (w_pdf - dw)/2; draw_y = h_pdf - 80 - dh
    
    buf = BytesIO(); merged.save(buf, format='PNG'); buf.seek(0); pdf_img = ImageReader(buf)
    c.drawImage(pdf_img, draw_x, draw_y, width=dw, height=dh, preserveAspectRatio=True)
    
    def get_pos(lon, lat):
        n = 2.0 ** z
        ax_pos = (lon + 180.0) / 360.0 * n
        ay_pos = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
        return draw_x + ((ax_pos - min_x) * 256 / wi) * dw, draw_y + dh - ((ay_pos - min_y) * 256 / hi) * dh
        
    # ONLY draw route if it's the solution or if not explicitly excluded
    # For participants, the resolved plan says: "pas de ligne rouge" or "invisible"
    is_solution = "Exact" in title or "Polygonal" in title or is_poly
    
    if is_solution:
        c.setStrokeColorRGB(*line_color)
        c.setLineWidth(3 if is_poly else 2)
        c.setDash() # Full lines
        for pts in coords_list:
            if not pts: continue
            # Draw segment
            path = c.beginPath()
            path.moveTo(*get_pos(pts[0][0], pts[0][1]))
            for pt in pts[1:]: path.lineTo(*get_pos(pt[0], pt[1]))
            c.drawPath(path, fill=0, stroke=1)
            
            # If polygonal, draw crosses at intersections (start of segment)
            if is_poly:
                px, py = get_pos(pts[0][0], pts[0][1])
                s = 4
                c.setLineWidth(1.5)
                c.line(px-s, py-s, px+s, py+s)
                c.line(px-s, py+s, px+s, py-s)
                c.setLineWidth(3 if is_poly else 2) # Reset to path line width
        
        # Last cross at the very end
        if is_poly and coords_list:
            last_pt = coords_list[-1][-1]
            px, py = get_pos(last_pt[0], last_pt[1])
            s = 4
            c.setLineWidth(1.5)
            c.line(px-s, py-s, px+s, py+s)
            c.line(px-s, py+s, px+s, py-s)
        
    c.setFont("Helvetica-Bold", 8)
    for poi in GLOBAL_POIS:
        if 'highway' in poi.get('tags', {}): continue
        lat, lon = poi['lat'], poi['lon']
        if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
            px, py = get_pos(lon, lat)
            c.setStrokeColorRGB(0.5, 0, 0.5)
            c.setFillColorRGB(0.8, 0, 0.8)
            c.circle(px, py, 3, fill=1)
            c.setFillColorRGB(0, 0, 0)
            c.drawString(px + 4, py - 3, poi.get('tags', {}).get('name', 'POI'))
            
    c.showPage()

def draw_colored_solution_map(c, w_pdf, h_pdf, page_plan):
    try: c.setFont("Coolvetica", 28)
    except: c.setFont("Helvetica-Bold", 24)
    c.drawCentredString(w_pdf/2, h_pdf - 40, "CARTE DES ÉTAPES ET TECHNIQUES")
    
    all_points = []
    for block in page_plan:
        for s in block['steps']: all_points.extend(s['coords'])
        
    lons = [pt[0] for pt in all_points]
    lats = [pt[1] for pt in all_points]
    min_lon, max_lon = min(lons)-0.005, max(lons)+0.005
    min_lat, max_lat = min(lats)-0.005, max(lats)+0.005
    
    z = 15
    min_x, max_y = lonlat_to_tile(min_lon, min_lat, z)
    max_x, min_y = lonlat_to_tile(max_lon, max_lat, z)
    
    n_cols = max_x - min_x + 1
    n_rows = max_y - min_y + 1
    merged = Image.new('RGB', (n_cols * 256, n_rows * 256))
    for tx in range(min_x, max_x + 1):
        for ty in range(min_y, max_y + 1):
            tile = download_ign_tile(tx, ty, z)
            if tile:
                if tile.mode != 'RGB': tile = tile.convert('RGB')
                merged.paste(tile, ((tx - min_x)*256, (ty - min_y)*256))
                
    wi, hi = merged.size; aspect = hi / wi
    dw = w_pdf - 40; dh = dw * aspect
    if dh > (h_pdf - 120): dh = h_pdf - 120; dw = dh / aspect
    draw_x = (w_pdf - dw)/2; draw_y = h_pdf - 80 - dh
    
    buf = BytesIO(); merged.save(buf, format='PNG'); buf.seek(0); pdf_img = ImageReader(buf)
    c.drawImage(pdf_img, draw_x, draw_y, width=dw, height=dh, preserveAspectRatio=True)
    
    def get_pos(lon, lat):
        n = 2.0 ** z
        ax_pos = (lon + 180.0) / 360.0 * n
        ay_pos = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
        return draw_x + ((ax_pos - min_x) * 256 / wi) * dw, draw_y + dh - ((ay_pos - min_y) * 256 / hi) * dh

    c.setLineWidth(4)
    c.setLineJoin(1)
    
    # Predefined color palette for segments
    colors_list = [
        (1,0,0), (0,0.8,0), (0,0,1), (0.8,0.8,0), (0.8,0,0.8), (0,0.8,0.8),
        (1,0.5,0), (0.5,0,1), (0.2,0.8,0.2), (0.8,0.4,0), (0.4,0.4,0.8), (0.1,0.1,0.1)
    ]
    
    for i, p in enumerate(page_plan):
        col = colors_list[i % len(colors_list)]
        c.setStrokeColorRGB(*col)
        c.setFillColorRGB(*col)
        c.setDash()
        
        # Draw all segments of this block
        first_pt = None
        for s in p['steps']:
            pts = s['coords']
            path = c.beginPath()
            path.moveTo(*get_pos(pts[0][0], pts[0][1]))
            for pt in pts[1:]: path.lineTo(*get_pos(pt[0], pt[1]))
            c.drawPath(path, fill=0, stroke=1)
            
            # Cross at each intersection (start of step)
            px, py = get_pos(pts[0][0], pts[0][1])
            s_size = 4
            c.setLineWidth(1.5)
            c.line(px-s_size, py-s_size, px+s_size, py+s_size)
            c.line(px-s_size, py+s_size, px+s_size, py-s_size)
            c.setLineWidth(4)
            
            if first_pt is None: first_pt = pts[0]
            
        # Last cross if it's the last block
        if i == len(page_plan) - 1:
            last_pt = page_plan[-1]['steps'][-1]['coords'][-1]
            px, py = get_pos(last_pt[0], last_pt[1])
            s_size = 4
            c.setLineWidth(1.5)
            c.line(px-s_size, py-s_size, px+s_size, py+s_size)
            c.line(px-s_size, py+s_size, px+s_size, py-s_size)
            
        # Label at start of block
        if first_pt:
            px, py = get_pos(first_pt[0], first_pt[1])
            c.circle(px, py, 4, fill=1)
            c.setFont("Helvetica-Bold", 10)
            label = f"#{i+1} : {p['type'].upper()}"
            
            # Smart label offset to avoid clusters
            ox, oy = 10, 5
            if i % 2 == 0: ox = -60; oy = -10
            
            # Shadow/Halo for readability
            c.setFillColorRGB(1,1,1)
            c.drawString(px + ox + 1, py + oy + 1, label)
            c.setFillColorRGB(*col)
            c.drawString(px + ox, py + oy, label)

    c.showPage()

def draw_data_ledger_page(c, w_pdf, h_pdf, steps, title="GRAND LIVRE DES ÉTAPES"):
    try: c.setFont("Coolvetica", 24)
    except: c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(w_pdf/2, h_pdf - 60, title)
    
    tot_dist = sum(s.get('distance', 0) for s in steps)
    nb = len(steps)
    avg = tot_dist / nb if nb > 0 else 0
    
    c.setFont("Helvetica-Oblique", 11)
    c.setFillColorRGB(0.2, 0.2, 0.2)
    stats = f"Statistiques -> Distance Totale : {tot_dist:.1f} m  |  Nombre de sections : {nb}  |  Moyenne/Section : {avg:.1f} m"
    c.drawCentredString(w_pdf/2, h_pdf - 65, stats)
    
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Courier", 10)
    y = h_pdf - 100
    col_x = [50, w_pdf/2 + 10]
    current_col = 0
    for i, s in enumerate(steps):
        if y < 50:
            c.showPage()
            try: c.setFont("Coolvetica", 16)
            except: c.setFont("Helvetica-Bold", 14)
            c.drawCentredString(w_pdf/2, h_pdf - 60, "LISTE EXHAUSTIVE (SUITE)")
            c.setFont("Courier", 10)
            y = h_pdf - 100
            current_col = 0
        txt = f"Etape {i+1:03d} : Azimut {int(round(s['azimut'])):03d}° | Distance {s['distance']:05.1f}m"
        c.drawString(col_x[current_col], y, txt)
        current_col += 1
        if current_col > 1:
            current_col = 0
            y -= 15
    c.showPage()


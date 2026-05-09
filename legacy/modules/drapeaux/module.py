import os
import math
import random
from utils.pdf_helpers import *

# Scout Colors
COLORS = [
    ('Vert', (0, 0.7, 0)),
    ('Rouge', (0.8, 0, 0)),
    ('Bleu', (0, 0, 0.8)),
    ('Jaune', (0.9, 0.9, 0)),
    ('Orange', (1.0, 0.5, 0)),
    ('Blanc', (0.9, 0.9, 0.9)),
    ('Noir', (0.1, 0.1, 0.1)),
    ('Violet', (0.6, 0, 0.6))
]

def get_offset_point(lon, lat, dist_m, bearing_deg):
    R = 6371000
    phi1 = math.radians(lat)
    L1 = math.radians(lon)
    brng = math.radians(bearing_deg)
    phi2 = math.asin(math.sin(phi1) * math.cos(dist_m/R) +
                     math.cos(phi1) * math.sin(dist_m/R) * math.cos(brng))
    L2 = L1 + math.atan2(math.sin(brng) * math.sin(dist_m/R) * math.cos(phi1),
                         math.cos(dist_m/R) - math.sin(phi1) * math.sin(phi2))
    return math.degrees(L2), math.degrees(phi2)

def generate_flag_sequence(segments):
    import utils.pdf_helpers as ph
    all_pts = []
    for s in segments: all_pts.extend(s['coords'])
    
    # 1. Real Flags
    sequence = [(COLORS[0][0], COLORS[0][1], all_pts[0], False)]
    available_colors = COLORS[1:].copy()
    random.shuffle(available_colors)
    
    # Intermediate Real (every ~200m for long stretches)
    current_cumul = 0
    for s in segments[:-1]:
        current_cumul += s.get('distance', 0)
        if current_cumul >= 200 and available_colors:
            col_name, col_rgb = available_colors.pop(0)
            sequence.append((col_name, col_rgb, s['coords'][-1], False))
            current_cumul = 0
            
    # End
    col_name, col_rgb = available_colors.pop(0) if available_colors else ('Rouge', (0.8,0,0))
    sequence.append((col_name, col_rgb, all_pts[-1], False))
        
    # 2. Fake Flags (at least 2) - Higher distance to avoid clustering
    fake_count = max(2, random.randint(2, 3))
    for _ in range(fake_count):
        if not available_colors: break
        seg = random.choice(segments)
        base_pt = random.choice(seg['coords'])
        
        # Larger offset: 120m to 250m to make it "orientation" and not just "nearby"
        dist = random.randint(120, 250)
        bearing = random.randint(0, 359)
        fake_pt = get_offset_point(base_pt[0], base_pt[1], dist, bearing)
        
        # IMPORTANT: Snap to road for realism
        snapped = ph.find_nearest_road_point(fake_pt[0], fake_pt[1], max_dist=150)
        if snapped:
            fake_pt = snapped
            
        col_name, col_rgb = available_colors.pop(0)
        idx = random.randint(1, len(sequence)-1)
        sequence.insert(idx, (col_name, col_rgb, fake_pt, True))
        
    return sequence

def generate_thematic_drapeaux_narrative(flag_sequence, theme_data):
    intros = theme_data.get('drapeaux_intros', ["Piste aux fanions."])
    real_actions = theme_data.get('drapeaux_real', ["Rejoignez le fanion {c}."])
    fake_actions = theme_data.get('drapeaux_fake', ["N'allez pas au {c}.", "Le {c} est un piège."])
    conclusions = theme_data.get('drapeaux_outro', ["Le dernier fanion cité est votre arrivée."])
    
    story = [random.choice(intros)]
    for i, (c_name, c_hex, coords, is_fake) in enumerate(flag_sequence):
        if is_fake:
            story.append(random.choice(fake_actions).replace("{c}", c_name))
        else:
            if i == 0:
                story.append(f"Le départ se situe au fanion {c_name}.")
            elif i == len([f for f in flag_sequence if not f[3]]) - 1: # Last real
                # Handled by conclusions usually or specific end
                pass
            else:
                story.append(random.choice(real_actions).replace("{c}", c_name))
    
    story.append(random.choice(conclusions))
    return " ".join(story)

def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    import utils.pdf_helpers as ph
    # 1. Header height (~50)
    # 2. Map height (450)
    # 3. Narrative height (dynamic)
    
    # Pre-generate narrative to check height
    flag_seq = generate_flag_sequence(segments)
    theme_data = {}
    try:
        from utils.pdf_helpers import THEME_DATA
        theme_data = THEME_DATA.get(config.get('theme', 'Neutre'), {})
    except: pass
    txt = generate_thematic_drapeaux_narrative(flag_seq, theme_data)
    
    all_pts = []
    for s in segments: all_pts.extend(s['coords'])
    
    msgs = [{'clair': txt, 'encoded': txt, 'type': 'drapeaux'}]
    if is_sol:
        trans = " | ".join([f"{f[0]}: {'PASSAGE' if not f[3] else 'PIEGE'}" for f in flag_seq])
        msgs.append({'clair': f"TRADUCTION : {trans}", 'encoded': "", 'type': 'clair'})

    # Pre-calculate total height
    # 50 (header) + 450 (map) + calc_narrative_height + 40 (margins)
    narr_h = ph.calc_narrative_height(c, msgs, w_pdf, is_sol)
    total_h = 50 + 450 + narr_h + 40
    
    if y_current - total_h < 60:
        return {"new_y": -1, "annexes": []}
    
    # Execution
    p = {'flag_sequence': flag_seq}
    new_y = draw_map_vector_on_pdf(c, all_pts, 'drapeaux', w_pdf, y_current, p_data=p, is_sol=is_sol, step_num=step_num)
    new_y = draw_narrative_messages_on_pdf(c, msgs, is_sol, w_pdf, new_y, step_num=None)
    
    return {"new_y": new_y, "annexes": []}

def evaluate(start_idx, segments, min_c, max_c):
    # On préfère prendre le maximum de segments possible pour ce module
    return True, max_c

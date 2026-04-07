import os
from utils.pdf_helpers import *


def encode_morse(text):
    text = text.lower()
    replacements = {'é':'e', 'è':'e', 'ê':'e', 'à':'a', 'â':'a', 'î':'i', 'ô':'o', 'û':'u', 'ç':'c'}
    for k, v in replacements.items(): text = text.replace(k, v)
    
    # "traduis un point par `"
    text = text.replace('.', '`')
    
    # "ajoute ` comme séparateur de chiffres"
    import re
    text = re.sub(r'\d+', lambda m: "`".join(list(m.group(0))), text)
    
    return "".join(c for c in text if c.isalnum() or c in ' `')



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    msgs_to_calc = []
    prev_azi = None
    for s in segments:
        poi_str = get_nearest_poi(s['coords'][0][0], s['coords'][0][1])
        clair = generate_prohibition_text(s.get('distance', s.get('properties', {}).get('metrage', 0)), s.get('azimut', s.get('properties', {}).get('azimut', 0)), poi_str)
        enc = encode_morse(clair)
        msgs_to_calc.append({'clair': clair, 'encoded': enc, 'type': 'morse'})
    
    new_y = draw_narrative_messages_on_pdf(c, msgs_to_calc, is_sol, w_pdf, y_current, step_num=step_num)
    if new_y == -1: return {"new_y": -1, "annexes": []}
    annexes = [os.path.join(os.path.dirname(__file__), "assets", "morse.ttf")]
    return {"new_y": new_y, "annexes": annexes}

def evaluate(start_idx, segments, min_c, max_c):
    return True, min_c


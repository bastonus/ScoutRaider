import os
from utils.pdf_helpers import *



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    msgs_to_calc = []
    
    for s in segments:
        poi_str = get_nearest_poi(s['coords'])
        clair = generate_prohibition_text(s.get('distance', s.get('properties', {}).get('metrage', 0)), s.get('azimut', s.get('properties', {}).get('azimut', 0)), poi_str)
        func = globals().get('lambda x: x', lambda x: x.upper())
        try:
            if 'maritime' == 'vigenere':
                enc = func(clair, V_KEY)
            elif 'maritime' == 'avocat':
                enc = func(clair, 10)
            elif 'maritime' == 'cassis':
                enc = func(clair, 21)
            else:
                enc = func(clair)
        except Exception as e:
            enc = clair.upper()
        msgs_to_calc.append({'clair': clair, 'encoded': enc, 'type': 'maritime'})
        
    req_h = calc_narrative_height(c, msgs_to_calc, w_pdf, is_sol) + 0
    if y_current - req_h < 80: return {"new_y": -1, "annexes": []}
    
    new_y = draw_narrative_messages_on_pdf(c, msgs_to_calc, is_sol, w_pdf, y_current, step_num=step_num)
    
    
    annexes = []
    
    
    return {"new_y": new_y, "annexes": annexes}

def draw_annexe(c, w_pdf, h_pdf, base_name, current_page, is_sol):
    import utils.pdf_helpers as ph
    try: c.setFont("Coolvetica", 24)
    except: c.setFont("Helvetica-Bold", 22)
    ann_t = ph.get_theme_label('annex_title', 'ANNEXE')
    mar_l = ph.get_theme_label('maritime_label', 'CODE MARITIME')
    c.drawCentredString(w_pdf/2, h_pdf - 80, f"{ann_t} : {mar_l}")
    
    nato = {
        'A': 'Alpha', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta', 'E': 'Echo',
        'F': 'Foxtrot', 'G': 'Golf', 'H': 'Hotel', 'I': 'India', 'J': 'Juliett',
        'K': 'Kilo', 'L': 'Lima', 'M': 'Mike', 'N': 'November', 'O': 'Oscar',
        'P': 'Papa', 'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
        'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray', 'Y': 'Yankee', 'Z': 'Zulu',
        '0': 'Nadazero', '1': 'Unaone', '2': 'Bissotwo', '3': 'Terrathree', '4': 'Kartefour', 
        '5': 'Pantafive', '6': 'Soxisix', '7': 'Setteseven', '8': 'Oktoeight', '9': 'Novenine'
    }
    items = list(nato.keys())
    cols = 4; rows = 9; col_w = w_pdf / cols; y_start = h_pdf - 150; row_h = 75
    
    for i, k in enumerate(items):
        col = i // rows
        row = i % rows
        x = col * col_w + col_w / 2
        y = y_start - row * row_h
        
        c.setFont("Maritime", 40)
        c.setFillColorRGB(0, 0, 0)
        c.drawCentredString(x - 30, y - 10, k)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(x + 10, y, k)
        c.setFont("Helvetica", 10)
        c.drawString(x + 10, y - 15, nato[k])
        
    ph.add_footer_and_page(c, w_pdf, current_page, base_name)
    return current_page + 1

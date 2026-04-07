import os
from utils.pdf_helpers import *


def encode_polybe(text):
    grid = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    res = []
    for c in text.upper():
        if c in grid:
            idx = grid.index(c)
            row = (idx // 6) + 1
            col = (idx % 6) + 1
            res.append(f"{row}{col}")
        elif c == ' ':
            res.append('/')
        elif c.isalpha(): pass # Shouldn't happen
    return ' '.join(res)



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    msgs_to_calc = []
    
    for s in segments:
        poi_str = get_nearest_poi(s['coords'][0][0], s['coords'][0][1])
        clair = generate_prohibition_text(s.get('distance', s.get('properties', {}).get('metrage', 0)), s.get('azimut', s.get('properties', {}).get('azimut', 0)), poi_str)
        func = globals().get('encode_polybe', lambda x: x.upper())
        try:
            if 'polybe' == 'vigenere':
                enc = func(clair, V_KEY)
            elif 'polybe' == 'avocat':
                enc = func(clair, 10)
            elif 'polybe' == 'cassis':
                enc = func(clair, 21)
            else:
                enc = func(clair)
        except Exception as e:
            enc = clair.upper()
        msgs_to_calc.append({'clair': clair, 'encoded': enc, 'type': 'polybe'})
        
    new_y = draw_narrative_messages_on_pdf(c, msgs_to_calc, is_sol, w_pdf, y_current, step_num=step_num)
    if new_y == -1: return {"new_y": -1, "annexes": []}
    
    
    annexes = []
    
    
    return {"new_y": new_y, "annexes": annexes}

def draw_annexe(c, w_pdf, h_pdf, base_name, current_page, is_sol):
    import utils.pdf_helpers as ph
    try: c.setFont("Coolvetica", 24)
    except: c.setFont("Helvetica-Bold", 22)
    ann_t = ph.get_theme_label('annex_title', 'ANNEXE')
    pol_l = ph.get_theme_label('polybe_label', 'CARRE DE POLYBE')
    c.drawCentredString(w_pdf/2, h_pdf - 80, f"{ann_t} : {pol_l}")
    
    grid = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    size = 40
    start_x = (w_pdf - (7 * size)) / 2 + size/2
    start_y = h_pdf - 180
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(1)
    
    c.setFont("Helvetica-Bold", 16)
    for i in range(6):
        c.drawCentredString(start_x + i*size + size/2, start_y + 5, str(i+1))
        c.drawCentredString(start_x - 15, start_y - i*size - size/2 - 8, str(i+1))
        
    c.setFont("Courier-Bold", 18)
    for row in range(6):
        for col in range(6):
            x = start_x + col*size + size/2
            y = start_y - row*size - size/2
            c.rect(x - size/2, y - size/2, size, size)
            idx = row * 6 + col
            c.drawCentredString(x, y - 12, grid[idx])
            
    c.setFont("Helvetica-Oblique", 11)
    c.drawCentredString(w_pdf/2, start_y - 6*size - 40, "Les coordonnées se lisent en : Ligne (1er chiffre) puis Colonne (2ème chiffre).")
    c.drawCentredString(w_pdf/2, start_y - 6*size - 60, "Exemple: 21 = G, 64 = 7, 53 = 0.")
    ph.add_footer_and_page(c, w_pdf, current_page, base_name)
    return current_page + 1


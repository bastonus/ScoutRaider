import os
from utils.pdf_helpers import *


def encode_vigenere(text, key="MOUSTACHE"):
    res = ""
    text = text.upper()
    k_idx = 0
    for c in text:
        if c.isalpha():
            shift = ord(key[k_idx % len(key)]) - 65
            res = res + chr((ord(c) - 65 + shift) % 26 + 65)
            k_idx += 1
        else: res += c
    return res



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    msgs_to_calc = []
    V_KEY = THEME_DATA.get(CURRENT_THEME, {}).get('vigenere_key', 'MOUSTACHE')
    for s in segments:
        poi_str = get_nearest_poi(s['coords'])
        clair = generate_prohibition_text(s.get('distance', s.get('properties', {}).get('metrage', 0)), s.get('azimut', s.get('properties', {}).get('azimut', 0)), poi_str)
        func = globals().get('encode_vigenere', lambda x: x.upper())
        try:
            if 'vigenere' == 'vigenere':
                enc = func(clair, V_KEY)
            elif 'vigenere' == 'avocat':
                enc = func(clair, 10)
            elif 'vigenere' == 'cassis':
                enc = func(clair, 21)
            else:
                enc = func(clair)
        except Exception as e:
            enc = clair.upper()
        msgs_to_calc.append({'clair': clair, 'encoded': enc, 'type': 'vigenere'})
        
    new_y = draw_narrative_messages_on_pdf(c, msgs_to_calc, is_sol, w_pdf, y_current, step_num=step_num)
    if new_y == -1: return {"new_y": -1, "annexes": []}
    
    if 'vigenere' == 'vigenere' and not is_sol:
        new_y = draw_key_footer(c, w_pdf, new_y, V_KEY)
    
    annexes = []
    
    
    return {"new_y": new_y, "annexes": annexes}

def draw_annexe(c, w_pdf, h_pdf, base_name, current_page, is_sol):
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors
    import utils.pdf_helpers as ph
    try: c.setFont("Coolvetica", 24)
    except: c.setFont("Helvetica-Bold", 20)
    ann_t = ph.get_theme_label('annex_title', 'ANNEXE')
    vig_l = ph.get_theme_label('vigenere_label', 'CARRE DE VIGENERE')
    c.drawCentredString(w_pdf/2, h_pdf - 80, f"{ann_t} : {vig_l}")
    c.setFont("Helvetica", 10)
    c.drawCentredString(w_pdf/2, h_pdf - 100, "Trouver la lettre de la clé en ligne, et la lettre du message clair en colonne pour obtenir la lettre codee.")
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    data = [[""] + list(alphabet)]
    for i in range(26):
        row = [alphabet[i]] + list(alphabet[i:] + alphabet[:i])
        data.append(row)
    col_w = (w_pdf - 60) / 27
    t = Table(data, colWidths=[col_w]*27, rowHeights=[20]*27)
    t.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('GRID', (0,0), (-1,-1), 0.5, colors.black),
        ('BACKGROUND', (0,0), (0,-1), colors.lightgrey),
        ('BACKGROUND', (0,0), (-1,0), colors.lightgrey),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold')
    ]))
    tw, th = t.wrap(w_pdf, h_pdf)
    t.drawOn(c, (w_pdf - tw)/2, h_pdf - 130 - th)
    ph.add_footer_and_page(c, w_pdf, current_page, base_name)
    return current_page + 1


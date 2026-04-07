import os
from utils.pdf_helpers import *


def encode_cesar(text, shift):
    res = ""
    for c in text.upper():
        if c.isalpha(): res += chr((ord(c) - 65 + shift) % 26 + 65)
        else: res += c
    return res



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    msgs_to_calc = []
    
    for s in segments:
        poi_str = get_nearest_poi(s['coords'][0][0], s['coords'][0][1])
        clair = generate_prohibition_text(s.get('distance', s.get('properties', {}).get('metrage', 0)), s.get('azimut', s.get('properties', {}).get('azimut', 0)), poi_str)
        func = globals().get('encode_cesar', lambda x: x.upper())
        try:
            if 'cassis' == 'vigenere':
                enc = func(clair, V_KEY)
            elif 'cassis' == 'avocat':
                enc = func(clair, 10)
            elif 'cassis' == 'cassis':
                enc = func(clair, 21)
            else:
                enc = func(clair)
        except Exception as e:
            enc = clair.upper()
        msgs_to_calc.append({'clair': clair, 'encoded': enc, 'type': 'cassis'})
        
    new_y = draw_narrative_messages_on_pdf(c, msgs_to_calc, is_sol, w_pdf, y_current, step_num=step_num)
    if new_y == -1: return {"new_y": -1, "annexes": []}
    
    
    return {"new_y": new_y, "annexes": []}

def evaluate(start_idx, segments, min_c, max_c):
    return True, min_c


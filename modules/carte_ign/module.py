import os
from utils.pdf_helpers import *



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    import utils.pdf_helpers as ph
    header_h = 50
    map_h = 450
    total_h = header_h + map_h + 30
    
    if y_current - total_h < 60: return {"new_y": -1, "annexes": []}
    
    all_pts = []
    for s in segments: all_pts.extend(s['coords'])
    new_y = draw_map_vector_on_pdf(c, all_pts, 'ign', w_pdf, y_current, is_sol=is_sol, step_num=step_num)
    return {"new_y": new_y, "annexes": []}

def evaluate(start_idx, segments, min_c, max_c):
    # On reste dans la plage suggérée par l'orchestrateur
    return True, min_c

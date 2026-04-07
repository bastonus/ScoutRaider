import os
from utils.pdf_helpers import *


def simplify_gilwell_segments(steps, tol=10):
    """Fusionne les segments consécutifs s'ils ont un azimut proche (<= tol degrés)."""
    if not steps: return []
    simp = []
    curr = steps[0].copy()
    for next_s in steps[1:]:
        diff = abs(curr['azimut'] - next_s['azimut']) % 360
        if diff > 180: diff = abs(diff - 360)
        
        if diff <= tol:
            curr['distance'] += next_s['distance']
            curr['coords'] = curr['coords'] + next_s['coords'][1:]
        else:
            simp.append(curr)
            curr = next_s.copy()
    simp.append(curr)
    return simp


def draw_gilwell_vector_on_pdf(c, fragment_steps, w_pdf, y_start, is_sol=False, step_num=None):
    y = draw_step_header(c, step_num, 'gilwell', is_sol, w_pdf, y_start)
    min_gap = 0.5
    positions = []
    current_y = 0
    for s in fragment_steps:
        angle = s.get('azimut', 0)
        distance = s.get('distance', 0)
        rad = math.radians(270 - angle)
        dx = -math.cos(rad) * 0.7
        dy = -math.sin(rad) * 0.7
        positions.append((current_y, dx, dy, angle, distance))
        current_y += abs(dy) + min_gap
        
    total_height = current_y + 0.5
    
    # Gilwell dynamically uses available height up to 400 pts max
    dh = min(400, y - 50)
    scale = dh / total_height # Scale in pts per unit
    dw = 4.0 * scale
        
    center_x = w_pdf / 2
    draw_top = y
    base_x = center_x
    base_y = draw_top - dh + (0.5 * scale)
    
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(2)
    def draw_arrow(cx, cy, trx, try_, color=(1,0,0)):
        c.setStrokeColorRGB(*color)
        c.setLineWidth(2)
        c.line(cx, cy, trx, try_)
        if trx == cx and try_ == cy: return
        angle = math.atan2(try_ - cy, trx - cx)
        head_len = 10
        c.line(trx, try_, trx - head_len * math.cos(angle - math.pi/6), try_ - head_len * math.sin(angle - math.pi/6))
        c.line(trx, try_, trx - head_len * math.cos(angle + math.pi/6), try_ - head_len * math.sin(angle + math.pi/6))
        
    c.setFont("Helvetica-Bold", 10)
    c.setFillColorRGB(0, 0, 0)
    c.drawCentredString(center_x, base_y + (total_height + 0.2) * scale, "NORD")
    draw_arrow(center_x, base_y - 0.2 * scale, center_x, base_y + total_height * scale, (0,0,0))
    
    for y_pos, dx, dy, angle, distance in positions:
        start_px = base_x
        start_py = base_y + y_pos * scale
        end_px = base_x + dx * scale
        end_py = base_y + (y_pos + dy) * scale
        c.setFillColorRGB(1, 0, 0)
        c.setStrokeColorRGB(1, 0, 0)
        c.circle(start_px, start_py, 3, fill=1, stroke=0)
        draw_arrow(start_px, start_py, end_px, end_py, (1,0,0))
        c.setFont("Helvetica-Bold", 10)
        text = f"{int(angle)}° | {distance}m"
        text_w = c.stringWidth(text, "Helvetica-Bold", 10)
        if dx < 0: c.drawString(end_px - text_w - 5, start_py + (dy * 0.5 * scale), text)
        else: c.drawString(end_px + 5, start_py + (dy * 0.5 * scale), text)
    return draw_top - dh - 40



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    import utils.pdf_helpers as ph
    # Pre-calc height more accurately to avoid extra page breaks
    # Header(40) + approx 50 pts per arrow + Margin(10)
    # Cap the height at 350 pts
    num_arrows = len(segments)
    total_req_h = 40 + min(350, num_arrows * 55) + 10
    
    if y_current - total_req_h < 60: 
        return {"new_y": -1, "annexes": []}
    
    new_y = draw_gilwell_vector_on_pdf(c, segments, w_pdf, y_current, is_sol=is_sol, step_num=step_num)
    return {"new_y": new_y, "annexes": []}

def evaluate(start_idx, segments, min_c, max_c):
    # Gilwell needs at least 2 segments
    if max_c < 2: return False, 0
    # On reste dans la plage suggérée par l'orchestrateur
    return True, max_c

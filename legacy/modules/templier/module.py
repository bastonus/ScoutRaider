import os
from utils.pdf_helpers import *



def generate(c, w_pdf, y_current, segments, config, categories, is_sol, step_num):
    msgs_to_calc = []
    
    for s in segments:
        poi_str = get_nearest_poi(s['coords'])
        clair = generate_prohibition_text(s.get('distance', s.get('properties', {}).get('metrage', 0)), s.get('azimut', s.get('properties', {}).get('azimut', 0)), poi_str)
        func = globals().get('lambda x: x', lambda x: x.upper())
        try:
            if 'templier' == 'vigenere':
                enc = func(clair, V_KEY)
            elif 'templier' == 'avocat':
                enc = func(clair, 10)
            elif 'templier' == 'cassis':
                enc = func(clair, 21)
            else:
                enc = func(clair)
        except Exception as e:
            enc = clair.upper()
        msgs_to_calc.append({'clair': clair, 'encoded': enc, 'type': 'templier'})
        
    new_y = draw_narrative_messages_on_pdf(c, msgs_to_calc, is_sol, w_pdf, y_current, step_num=step_num)
    if new_y == -1: return {"new_y": -1, "annexes": []}
    
    
    annexes = []
    annexes.append(os.path.join(os.path.dirname(__file__), "assets", "code templier.jpg"))
    
    return {"new_y": new_y, "annexes": annexes}

def draw_annexe(c, w_pdf, h_pdf, base_name, current_page, is_sol):
    import os
    import utils.pdf_helpers as ph
    from io import BytesIO
    from PIL import Image
    from reportlab.lib.utils import ImageReader
    
    try: c.setFont("Coolvetica", 24)
    except: c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(w_pdf/2, h_pdf - 80, "ANNEXE : CODE TEMPLIER")
    try:
        img_path = os.path.join(os.path.dirname(__file__), "assets", "code templier.jpg")
        if os.path.exists(img_path):
            annex_img = Image.open(img_path)
            if annex_img.mode != 'RGB': annex_img = annex_img.convert('RGB')
            buf = BytesIO(); annex_img.save(buf, format='JPEG'); buf.seek(0)
            pdf_img = ImageReader(buf)
            wi, hi = annex_img.size
            aspect = hi / wi
            dw = w_pdf - 100
            limit = h_pdf - 300
            dh = dw * aspect
            if dh > limit: 
                dh = limit; dw = dh / aspect
            draw_x = (w_pdf - dw)/2
            draw_y = h_pdf - 120 - dh
            c.drawImage(pdf_img, draw_x, draw_y, width=dw, height=dh, preserveAspectRatio=True)
            
            c.setFont("Helvetica-Oblique", 11)
            c.setFillColorRGB(0, 0, 0)
            l1 = "Les quatre premiers montrent comment le chiffre a été construit."
            l2 = "Le numéro V montre que 'passer par l'Octogone' signifiait 'se tenir sur la Croix'."
            c.drawCentredString(w_pdf/2, draw_y - 25, l1)
            c.drawCentredString(w_pdf/2, draw_y - 45, l2)
            c.setFont("Helvetica-Bold", 14)
            c.drawCentredString(w_pdf/2, draw_y - 75, "Traduction des chiffres (0-9) :")
            digits = "0 1 2 3 4 5 6 7 8 9"
            c.setFont("Courier-Bold", 20)
            c.drawCentredString(w_pdf/2, draw_y - 100, digits)
            c.setFont("Templar", 28)
            c.drawCentredString(w_pdf/2, draw_y - 135, digits)
    except Exception as e:
        print("Erreur ajout annexe templier:", e)
    ph.add_footer_and_page(c, w_pdf, current_page, base_name)
    return current_page + 1


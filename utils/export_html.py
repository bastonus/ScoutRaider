"""
export_html.py — Faithful HTML conversion of the PDF carnet.

Uses export_content.py to extract:
  - IGN map images (base64 inline PNG)
  - Gilwell SVG diagrams
  - Module-encoded text (Morse, Polybe, etc.)
  - Annexe tables
  - Themed step headers / footers
"""
import os
import base64
from utils.pdf_helpers import get_theme_label


# ─── Font @font-face helpers ────────────────────────────────────────────────

def _font_face_css(font_info):
    """Return @font-face CSS if the font file exists, else empty string."""
    if not font_info:
        return ''
    path = font_info['file']
    name = font_info['name']
    if not os.path.isfile(path):
        return ''
    # Encode font as base64 for fully self-contained HTML
    with open(path, 'rb') as f:
        data = base64.b64encode(f.read()).decode('ascii')
    ext = os.path.splitext(path)[1].lower().lstrip('.')
    fmt = {'ttf': 'truetype', 'otf': 'opentype', 'woff': 'woff', 'woff2': 'woff2'}.get(ext, 'truetype')
    return f"@font-face {{ font-family: '{name}'; src: url('data:font/{ext};base64,{data}') format('{fmt}'); }}\n"


# ─── Annexe HTML renderers ───────────────────────────────────────────────────

def _html_morse_annexe(data):
    rows = list(data.items())
    html = '<div class="annexe"><h3>TABLE MORSE</h3><div class="morse-grid">'
    for char, code in rows:
        html += f'<div class="morse-cell"><span class="mc">{char}</span><span class="ms">{code}</span></div>'
    html += '</div></div>'
    return html


def _html_polybe_annexe(grid_rows):
    html = '<div class="annexe"><h3>CARRÉ DE POLYBE</h3><table class="annexe-table"><tr><th></th>'
    for col in range(1, 7):
        html += f'<th>{col}</th>'
    html += '</tr>'
    for row_i, cells in enumerate(grid_rows):
        html += f'<tr><th>{row_i+1}</th>'
        for char, coord in cells:
            html += f'<td><b>{char}</b><br><small>{coord}</small></td>'
        html += '</tr>'
    html += '</table><p class="annexe-note">Lecture : Ligne (1er chiffre) puis Colonne (2ème chiffre). Ex: 21=G</p></div>'
    return html


def _html_vigenere_annexe(key, alphabet, table):
    html = f'<div class="annexe"><h3>CARRÉ DE VIGENÈRE — Clé : <code>{key}</code></h3>'
    html += '<div class="vig-scroll"><table class="annexe-table vig-table"><tr><th></th>'
    for c in alphabet:
        html += f'<th>{c}</th>'
    html += '</tr>'
    for i, row in enumerate(table):
        html += f'<tr><th>{alphabet[i]}</th>'
        for c in row:
            html += f'<td>{c}</td>'
        html += '</tr>'
    html += '</table></div></div>'
    return html


def _html_maritime_annexe(nato):
    html = '<div class="annexe"><h3>CODE MARITIME (NATO)</h3><div class="nato-grid">'
    for char, word in nato.items():
        html += f'<div class="nato-cell"><span class="nc">{char}</span><span class="nw">{word}</span></div>'
    html += '</div></div>'
    return html


# ─── Main render ─────────────────────────────────────────────────────────────

def _render_html(all_steps, theme_title, is_sol, font_faces_css, used_fonts):
    accent = "#b44a2b" if is_sol else "#2d5a8e"

    css = font_faces_css + f"""
    *{{box-sizing:border-box;margin:0;padding:0;}}
    body{{font-family:'Segoe UI',Tahoma,sans-serif;background:#f0f4f8;color:#1e293b;padding:32px 16px;line-height:1.6;}}
    .page-header{{text-align:center;margin-bottom:36px;border-bottom:3px solid {accent};padding-bottom:16px;}}
    h1{{font-size:24px;color:{accent};letter-spacing:2px;text-transform:uppercase;}}
    .subtitle{{color:#64748b;font-size:11px;margin-top:4px;}}
    .step{{background:#fff;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.08);margin-bottom:20px;overflow:hidden;}}
    .step-header{{background:{accent};color:#fff;padding:10px 14px;font-size:12px;font-weight:700;text-transform:uppercase;display:flex;align-items:center;gap:8px;}}
    .step-num{{background:rgba(255,255,255,.25);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;}}
    .step-icon{{height:22px;width:22px;object-fit:contain;margin-left:auto;}}
    .step-body{{padding:12px 14px;}}
    .map-img{{width:100%;max-width:600px;display:block;margin:0 auto 12px;border:1px solid #ddd;}}
    .gilwell-svg{{display:block;margin:0 auto 12px;}}
    .msg{{display:flex;gap:8px;padding:7px 0;border-bottom:1px solid #f1f5f9;align-items:flex-start;}}
    .msg:last-child{{border-bottom:none;}}
    .msg-num{{min-width:20px;height:20px;background:{accent};color:#fff;border-radius:50%;font-size:9px;font-weight:700;text-align:center;line-height:20px;flex-shrink:0;}}
    .encoded{{font-size:13px;font-weight:600;color:#1e293b;word-break:break-all;}}
    .clair-hint{{font-size:10px;color:#94a3b8;margin-top:2px;font-style:italic;}}
    .visual-msg{{font-size:12px;color:#475569;}}
    .font-note{{background:#fffbeb;border:1px solid #f59e0b;padding:8px 12px;font-size:11px;color:#92400e;margin-top:8px;border-radius:4px;}}
    .annexe{{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;margin-top:16px;}}
    .annexe h3{{font-size:11px;color:{accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;}}
    .morse-grid,.nato-grid{{display:flex;flex-wrap:wrap;gap:6px;}}
    .morse-cell,.nato-cell{{background:#fff;border:1px solid #e2e8f0;border-radius:4px;padding:4px 7px;text-align:center;min-width:44px;}}
    .mc,.nc{{display:block;font-size:14px;font-weight:700;color:{accent};}}
    .ms{{font-family:'Courier New',monospace;font-size:10px;color:#475569;}}
    .nw{{display:block;font-size:9px;color:#475569;}}
    .annexe-table{{border-collapse:collapse;font-size:10px;width:auto;margin:0 auto;}}
    .annexe-table th,.annexe-table td{{border:1px solid #e2e8f0;padding:3px 5px;text-align:center;}}
    .annexe-table th{{background:{accent};color:#fff;}}
    .annexe-note{{font-size:10px;color:#64748b;margin-top:6px;}}
    .vig-scroll{{overflow-x:auto;}}
    .vig-table td{{min-width:14px;padding:2px;font-size:8px;}}
    .page-footer{{text-align:center;margin-top:32px;color:#94a3b8;font-size:10px;border-top:1px solid #e2e8f0;padding-top:12px;}}
    """

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{theme_title}</title>
  <style>{css}</style>
</head>
<body>
  <div class="page-header">
    <h1>{theme_title}</h1>
    <div class="subtitle">{len(all_steps)} étapes · {'SOLUTION' if is_sol else 'PARTICIPANT'} · ScoutRaider Suite</div>
  </div>
"""

    for step in all_steps:
        html += f'  <div class="step">\n'
        # Header
        icon_html = ''
        if step.get('icon_path'):
            ext = os.path.splitext(step['icon_path'])[1].lower()
            if ext == '.svg':
                try:
                    with open(step['icon_path'], 'r', encoding='utf-8') as f:
                        svg_content = f.read()
                    icon_html = f'<span class="step-icon">{svg_content}</span>'
                except: pass
            elif ext == '.png':
                try:
                    with open(step['icon_path'], 'rb') as f:
                        b64 = base64.b64encode(f.read()).decode('ascii')
                    icon_html = f'<img class="step-icon" src="data:image/png;base64,{b64}" alt="">'
                except: pass

        html += f'    <div class="step-header"><div class="step-num">{step["step_num"]}</div>{step["label"]}{icon_html}</div>\n'
        html += '    <div class="step-body">\n'

        # Map image
        if step.get('map_image') is not None:
            import io
            buf = io.BytesIO()
            step['map_image'].save(buf, format='PNG')
            b64 = base64.b64encode(buf.getvalue()).decode('ascii')
            html += f'      <img class="map-img" src="data:image/png;base64,{b64}" alt="Carte IGN">\n'

        # Gilwell SVG
        if step.get('gilwell_svg'):
            html += f'      <div class="gilwell-svg">{step["gilwell_svg"]}</div>\n'

        # Font note
        font = step.get('font')
        if font and not is_sol:
            if not os.path.isfile(font['file']):
                html += f'      <div class="font-note">⚠ Police <b>{font["name"]}</b> non installée. Pour un rendu optimal, installez le fichier depuis : <code>modules/{step["module"]}/assets/</code></div>\n'

        # Messages
        for idx, msg in enumerate(step.get('messages', []), 1):
            is_encoded = (not is_sol
                          and msg['type'] not in ('clair', 'texte_clair', 'drapeaux', 'visual')
                          and msg['encoded'] != msg['clair'])

            font_style = ''
            if font and not is_sol and msg['type'] == step['module']:
                font_style = f'font-family: "{font["name"]}", "Courier New"; font-size: 15px;'

            html += '      <div class="msg">\n'
            html += f'        <div class="msg-num">{idx}</div>\n'
            if is_encoded:
                html += f'        <div>\n'
                html += f'          <div class="encoded" style="{font_style}">{msg["encoded"]}</div>\n'
                html += f'          <div class="clair-hint">{msg["clair"]}</div>\n'
                html += f'        </div>\n'
            else:
                html += f'        <div class="visual-msg">{msg["clair"]}</div>\n'
            html += '      </div>\n'

        # Annexes
        for annexe in step.get('annexes', []):
            atype = annexe['type']
            adata = annexe['data']
            if atype == 'morse':
                html += _html_morse_annexe(adata)
            elif atype == 'polybe':
                html += _html_polybe_annexe(adata)
            elif atype == 'vigenere':
                key, ab, table = adata
                html += _html_vigenere_annexe(key, ab, table)
            elif atype == 'maritime':
                html += _html_maritime_annexe(adata)

        html += '    </div>\n  </div>\n'

    base_name_display = get_theme_label('filename', 'Carnet')
    html += f'  <div class="page-footer">ScoutRaider Suite · {base_name_display} · {"SOLUTION" if is_sol else "Participant"}</div>\n'
    html += '</body>\n</html>'
    return html


def export_html(orchestrator, path_plan, output_dir=None, progress_callback=None, opts=None):
    if progress_callback: progress_callback("Récupération des POIs...", 20)

    import utils.pdf_helpers as ph
    ph.set_global_pois(ph.fetch_all_pois(orchestrator.segments))

    from utils.export_content import extract_step_content

    if progress_callback: progress_callback("Construction du contenu HTML...", 35)
    steps     = extract_step_content(orchestrator, path_plan, is_sol=False)
    sol_steps = extract_step_content(orchestrator, path_plan, is_sol=True)

    # Collect all unique fonts needed
    font_faces = ''
    seen_fonts = set()
    for s in steps:
        f = s.get('font')
        if f and f['name'] not in seen_fonts:
            font_faces += _font_face_css(f)
            seen_fonts.add(f['name'])

    title_part = get_theme_label('main_title', 'CARNET DE ROUTE')
    title_sol  = get_theme_label('soluce_title', 'SOLUCE — CHEFS')

    if progress_callback: progress_callback("Rendu HTML Participant...", 55)
    base_name = get_theme_label('filename', 'Carnet')
    out_path  = os.path.join(output_dir, f"{base_name}.html")
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(_render_html(steps, title_part, False, font_faces, seen_fonts))

    if progress_callback: progress_callback("Rendu HTML Solution...", 80)
    sol_path = os.path.join(output_dir, f"{base_name}_SOLUCE.html")
    with open(sol_path, 'w', encoding='utf-8') as f:
        f.write(_render_html(sol_steps, title_sol, True, font_faces, seen_fonts))

    if progress_callback: progress_callback("Export HTML terminé.", 100)
    return out_path, sol_path

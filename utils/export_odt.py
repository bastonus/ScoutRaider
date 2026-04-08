"""
export_odt.py — Faithful LibreOffice ODT conversion of the PDF carnet.

Uses export_content.py for maps, encoded text, and annexes.
"""
import os
from io import BytesIO
from odf.opendocument import OpenDocumentText
from odf.text import P, Span, TableOfContent
from odf.style import Style, TextProperties, ParagraphProperties
from odf.draw import Frame, Image as OdfImage
from odf.table import Table, TableColumn, TableRow, TableCell
from utils.pdf_helpers import get_theme_label


def _make_styles(doc, is_sol):
    accent = "#b44a2b" if is_sol else "#2d5a8e"

    for name, size, bold, italic, color, align, mt, mb, ml in [
        ("Title",     "22pt", "bold", "normal", accent,   "center", "0pt",  "8pt",  "0pt"),
        ("Subtitle",  "10pt", "normal","italic","#64748b","center", "0pt",  "14pt", "0pt"),
        ("StepHead",  "13pt", "bold", "normal", accent,   "left",   "10pt", "4pt",  "0pt"),
        ("Body",      "11pt", "normal","normal","#1e293b","left",   "0pt",  "3pt",  "0pt"),
        ("Encoded",   "11pt", "normal","normal","#1e293b","left",   "0pt",  "1pt",  "12pt"),
        ("ClairHint", "9pt", "normal","italic","#94a3b8","left",   "0pt",  "4pt",  "24pt"),
        ("Caption",   "9pt", "normal","italic","#64748b","center", "0pt",  "6pt",  "0pt"),
        ("Footer",    "9pt", "normal","normal","#94a3b8","center", "4pt",  "0pt",  "0pt"),
        ("AnnexHead", "11pt", "bold", "normal", accent,   "left",   "8pt",  "4pt",  "0pt"),
        ("FontNote",  "9pt", "normal","normal","#92400e","left",   "0pt",  "4pt",  "0pt"),
    ]:
        st = Style(name=name, family="paragraph")
        st.addElement(TextProperties(fontsize=size, fontweight=bold, fontstyle=italic, color=color))
        st.addElement(ParagraphProperties(textalign=align, margintop=mt, marginbottom=mb, marginleft=ml))
        doc.styles.addElement(st)

    # Bold span
    bst = Style(name="Bold", family="text")
    bst.addElement(TextProperties(fontweight="bold", color=accent))
    doc.styles.addElement(bst)

    # Mono span
    mst = Style(name="Mono", family="text")
    mst.addElement(TextProperties(fontname="Courier New", fontsize="11pt"))
    doc.styles.addElement(mst)


def _add_map_image_odt(doc, map_image, caption='Carte'):
    if not map_image:
        return
    try:
        buf = BytesIO()
        map_image.save(buf, format='PNG')
        img_bytes = buf.getvalue()
        img_name = f"map_{id(map_image)}.png"
        doc.addPicture(img_name, "image/png", img_bytes)

        img_elem = OdfImage(href=img_name, type="simple", show="embed", actuate="onLoad")
        frame = Frame(width="14cm", height="10cm", anchortype="paragraph")
        frame.addElement(img_elem)
        cap_p = P(stylename="Caption")
        cap_p.addElement(frame)
        doc.text.addElement(cap_p)

        cap_text = P(stylename="Caption", text=caption)
        doc.text.addElement(cap_text)
    except Exception as e:
        doc.text.addElement(P(stylename="Body", text=f"[Carte non disponible: {e}]"))


def render_odt(all_steps, is_sol=False):
    doc = OpenDocumentText()
    _make_styles(doc, is_sol)

    title_str = get_theme_label('soluce_title', 'SOLUCE — CHEFS') if is_sol else get_theme_label('main_title', 'CARNET DE ROUTE')
    doc.text.addElement(P(stylename="Title", text=title_str))
    doc.text.addElement(P(stylename="Subtitle",
        text=f"{len(all_steps)} étapes · {'SOLUTION' if is_sol else 'PARTICIPANT'} · ScoutRaider Suite"))

    for step in all_steps:
        # Step heading
        h = P(stylename="StepHead", text=f"Étape {step['step_num']} — {step['label']}")
        doc.text.addElement(h)

        # Map image
        if step.get('map_image') is not None:
            _add_map_image_odt(doc, step['map_image'], f"Carte – Étape {step['step_num']}")

        # Gilwell: SVG not supported natively in ODT via odfpy, show text fallback
        if step.get('gilwell_svg'):
            import re
            texts = re.findall(r'>(\d+°[^<]+)<', step['gilwell_svg'])
            gp = P(stylename="AnnexHead", text="Relevé Gilwell :")
            doc.text.addElement(gp)
            for t in texts:
                doc.text.addElement(P(stylename="Body", text=f"  • {t}"))

        # Font note
        font = step.get('font')
        if font and not is_sol:
            font_path = font.get('file', '')
            if not os.path.isfile(font_path):
                note = P(stylename="FontNote",
                    text=f"⚠ Police '{font['name']}' non installée. Installez le fichier depuis : modules/{step['module']}/assets/")
                doc.text.addElement(note)

        # Messages
        for idx, msg in enumerate(step.get('messages', []), 1):
            is_encoded = (not is_sol
                          and msg['type'] not in ('clair', 'texte_clair', 'drapeaux', 'visual')
                          and msg['encoded'] != msg['clair'])

            if is_encoded:
                enc_p = P(stylename="Encoded")
                enc_p.addElement(Span(stylename="Bold", text=f"{idx}. "))
                enc_p.addElement(Span(stylename="Mono", text=msg['encoded']))
                doc.text.addElement(enc_p)
                hint_p = P(stylename="ClairHint", text=f"   → {msg['clair']}")
                doc.text.addElement(hint_p)
            else:
                p = P(stylename="Body")
                p.addElement(Span(stylename="Bold", text=f"{idx}. "))
                p.addText(msg['clair'])
                doc.text.addElement(p)

        # Annexes
        for annexe in step.get('annexes', []):
            atype = annexe['type']
            adata = annexe['data']
            doc.text.addElement(P(stylename="AnnexHead", text={
                'polybe': 'CARRÉ DE POLYBE',
                'vigenere': f"CLÉ VIGENÈRE : {adata[0]}",
                'morse': 'TABLE MORSE',
                'maritime': 'CODE NATO MARITIME',
            }.get(atype, atype.upper())))

            if atype == 'polybe':
                table = Table()
                for row_cells in adata:
                    tr = TableRow()
                    for char, coord in row_cells:
                        tc = TableCell()
                        tc.addElement(P(text=f"{char} ({coord})"))
                        tr.addElement(tc)
                    table.addElement(tr)
                doc.text.addElement(table)
                doc.text.addElement(P(stylename="Body",
                    text="Lecture : Ligne (1er chiffre) puis Colonne (2ème chiffre). Ex: 21=G"))

            elif atype == 'morse':
                items = list(adata.items())
                table = Table()
                for i in range(0, len(items), 4):
                    tr = TableRow()
                    for char, code in items[i:i+4]:
                        tc = TableCell()
                        tc.addElement(P(text=f"{char} = {code}"))
                        tr.addElement(tc)
                    table.addElement(tr)
                doc.text.addElement(table)

            elif atype == 'maritime':
                items = list(adata.items())
                table = Table()
                for i in range(0, len(items), 3):
                    tr = TableRow()
                    for char, word in items[i:i+3]:
                        tc = TableCell()
                        tc.addElement(P(text=f"{char} = {word}"))
                        tr.addElement(tc)
                    table.addElement(tr)
                doc.text.addElement(table)

    doc.text.addElement(P(stylename="Footer",
        text=f"ScoutRaider Suite · {get_theme_label('filename', 'Carnet')} · {'SOLUTION' if is_sol else 'Participant'}"))

    return doc


def export_odt(orchestrator, path_plan, output_dir=None, progress_callback=None, opts=None):
    if progress_callback: progress_callback("Récupération des POIs...", 20)

    import utils.pdf_helpers as ph
    ph.set_global_pois(ph.fetch_all_pois(orchestrator.segments))

    from utils.export_content import extract_step_content

    if progress_callback: progress_callback("Construction du contenu ODT...", 35)
    steps     = extract_step_content(orchestrator, path_plan, is_sol=False)
    sol_steps = extract_step_content(orchestrator, path_plan, is_sol=True)

    base_name = get_theme_label('filename', 'Carnet')

    if progress_callback: progress_callback("Rendu ODT Participant...", 55)
    out_path  = os.path.join(output_dir, f"{base_name}.odt")
    render_odt(steps, False).save(out_path)

    if progress_callback: progress_callback("Rendu ODT Solution...", 80)
    sol_path  = os.path.join(output_dir, f"{base_name}_SOLUCE.odt")
    render_odt(sol_steps, True).save(sol_path)

    if progress_callback: progress_callback("Export ODT terminé.", 100)
    return out_path, sol_path

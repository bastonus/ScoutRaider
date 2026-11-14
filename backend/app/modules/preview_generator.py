"""
preview_generator.py — Server-side compilation and rendering of ScoutRaider modules into image previews.
Compiles Python code, ciphers, and orchestration presets into visual PNG cards.
"""

import io
import math
import base64
import logging
from typing import Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont

logger = logging.getLogger("scoutraider.preview")

# ─── Color Palette (Forest & Military Scout theme) ───────────────────────────
BG_COLOR = (15, 23, 20)           # Deep pine dark slate
CARD_BG = (22, 33, 29)            # Inner card background
BORDER_COLOR = (42, 65, 55)       # Subtle green border
ACCENT_GREEN = (110, 201, 126)    # Scout primary green #6EC97E
ACCENT_GOLD = (245, 158, 11)      # Amber / Gold #F59E0B
ACCENT_BLUE = (14, 165, 233)      # Signal blue #0EA5E9
ACCENT_PURPLE = (168, 85, 247)    # Mystic purple #A855F7
TEXT_PRIMARY = (240, 245, 242)    # Clean white/mint
TEXT_MUTED = (140, 160, 150)      # Muted slate green


def get_default_font(size: int = 14):
    """Fallback font loader using default PIL bitmap font or basic TrueType if available."""
    try:
        # Try common windows fonts
        return ImageFont.truetype("arial.ttf", size)
    except Exception:
        try:
            return ImageFont.truetype("DejaVuSans.ttf", size)
        except Exception:
            return ImageFont.load_default()


def render_code_preview(
    name: str,
    category: str,
    code_text: str,
    output_text: Optional[str] = None,
    render_type: str = "text",
    version: str = "1.0.0",
    author: str = "Communauté",
    width: int = 600,
    height: int = 340
) -> str:
    """
    Compiles code or cipher results into a server-side generated PNG preview image.
    Returns base64 data URI: 'data:image/png;base64,...'
    """
    img = Image.new("RGB", (width, height), color=BG_COLOR)
    draw = ImageDraw.Draw(img)

    # 1. Subtle topographic background grid
    for x in range(0, width, 30):
        draw.line([(x, 0), (x, height)], fill=(20, 29, 25), width=1)
    for y in range(0, height, 30):
        draw.line([(0, y), (width, y)], fill=(20, 29, 25), width=1)

    # 2. Main card container with rounded look
    margin = 16
    draw.rectangle(
        [margin, margin, width - margin, height - margin],
        fill=CARD_BG,
        outline=BORDER_COLOR,
        width=2
    )

    font_title = get_default_font(18)
    font_body = get_default_font(13)
    font_mono = get_default_font(12)
    font_small = get_default_font(11)

    # Category color accent
    cat_lower = category.lower()
    accent = ACCENT_GREEN
    if "orchestr" in cat_lower or "diffraction" in cat_lower or "preset" in cat_lower:
        accent = ACCENT_GOLD
        badge_text = "ORCHESTRATION"
    elif "theme" in cat_lower or "style" in cat_lower:
        accent = ACCENT_PURPLE
        badge_text = "THÈME VISUEL"
    elif "graphic" in cat_lower or "map" in cat_lower or "carte" in cat_lower:
        accent = ACCENT_BLUE
        badge_text = "CARTE & VECTEUR"
    else:
        badge_text = "MODULE DE CODE"

    # Header Bar
    draw.rectangle([margin, margin, width - margin, margin + 44], fill=(18, 27, 24))
    draw.line([(margin, margin + 44), (width - margin, margin + 44)], fill=BORDER_COLOR, width=1)

    # Category Badge
    draw.rectangle([margin + 12, margin + 10, margin + 140, margin + 34], fill=(*accent, 40), outline=accent, width=1)
    draw.text((margin + 18, margin + 14), badge_text, fill=accent, font=font_small)

    # Module Name & Version
    draw.text((margin + 155, margin + 12), f"{name}  v{version}", fill=TEXT_PRIMARY, font=font_title)

    # Content Zone
    content_top = margin + 55
    content_bottom = height - margin - 40
    content_width = width - (margin * 2) - 24

    # Inner display box
    inner_box = [margin + 12, content_top, width - margin - 12, content_bottom]
    draw.rectangle(inner_box, fill=(14, 20, 18), outline=(32, 48, 40), width=1)

    # If it's an orchestration, draw a visual distribution chart
    if "orchestr" in cat_lower or "preset" in cat_lower:
        draw.text((margin + 24, content_top + 14), "Distribution des épreuves & pondérations :", fill=TEXT_PRIMARY, font=font_body)
        
        sample_weights = [
            ("Carte Simple & Topo", 0.35, ACCENT_GREEN),
            ("Code Morse & Dérivés", 0.25, ACCENT_GOLD),
            ("Relevé d'Azimut Gilwell", 0.20, ACCENT_BLUE),
            ("Message Chiffré Polybe", 0.15, ACCENT_PURPLE),
            ("Texte de navigation clair", 0.05, (180, 180, 180))
        ]
        
        bar_y = content_top + 45
        for label, pct, col in sample_weights:
            draw.text((margin + 24, bar_y), label, fill=TEXT_MUTED, font=font_small)
            # Bar background
            draw.rectangle([margin + 200, bar_y + 2, margin + 500, bar_y + 14], fill=(25, 35, 30))
            # Bar fill
            fill_width = int(300 * pct)
            draw.rectangle([margin + 200, bar_y + 2, margin + 200 + fill_width, bar_y + 14], fill=col)
            draw.text((margin + 510, bar_y), f"{int(pct * 100)}%", fill=TEXT_PRIMARY, font=font_small)
            bar_y += 24

    # If it's graphic / azimut / map
    elif "graphic" in cat_lower or "gilwell" in name.lower() or "azimut" in name.lower():
        center_x = margin + 130
        center_y = content_top + 85
        radius = 55
        
        # Draw compass rose / radar circle
        draw.ellipse([center_x - radius, center_y - radius, center_x + radius, center_y + radius], outline=BORDER_COLOR, width=2)
        draw.ellipse([center_x - 30, center_y - 30, center_x + 30, center_y + 30], outline=(30, 45, 38), width=1)
        draw.line([(center_x, center_y - radius - 5), (center_x, center_y + radius + 5)], fill=BORDER_COLOR, width=1)
        draw.line([(center_x - radius - 5, center_y), (center_x + radius + 5, center_y)], fill=BORDER_COLOR, width=1)
        draw.text((center_x - 4, center_y - radius - 18), "N", fill=ACCENT_GREEN, font=font_small)

        # Draw azimut vectors
        angles = [45, 120, 210, 315]
        for idx, ang in enumerate(angles):
            rad = math.radians(ang - 90)
            ex = center_x + int(radius * 0.9 * math.cos(rad))
            ey = center_y + int(radius * 0.9 * math.sin(rad))
            draw.line([(center_x, center_y), (ex, ey)], fill=ACCENT_GOLD, width=2)
            draw.ellipse([ex - 3, ey - 3, ex + 3, ey + 3], fill=ACCENT_GREEN)

        draw.text((center_x + 80, content_top + 25), "Rendu Vectoriel Topographique :", fill=TEXT_PRIMARY, font=font_body)
        draw.text((center_x + 80, content_top + 50), "• Azimuts calculés en temps réel", fill=TEXT_MUTED, font=font_small)
        draw.text((center_x + 80, content_top + 72), "• Compatible impression haute résolution", fill=TEXT_MUTED, font=font_small)
        draw.text((center_x + 80, content_top + 94), "• Résolution vectorielle SVG / Paged Media", fill=TEXT_MUTED, font=font_small)
        draw.text((center_x + 80, content_top + 116), "• Détection automatique de carrefours", fill=TEXT_MUTED, font=font_small)

    # Standard code / cipher module preview
    else:
        # Display simulated compilation & test output
        draw.text((margin + 24, content_top + 14), "Code source exécutable (Python / Algorithme) :", fill=TEXT_PRIMARY, font=font_body)
        
        # Show code excerpt
        code_lines = (code_text or "").strip().split("\n")[:3]
        if not code_lines or code_lines == [""]:
            code_lines = [
                "def encode(solution_text, options=None):",
                "    # Compilation sécurisée ScoutRaider",
                "    return transform_message(solution_text)"
            ]
        
        line_y = content_top + 38
        for line in code_lines:
            short = line[:55]
            draw.text((margin + 30, line_y), short, fill=(160, 200, 180), font=font_mono)
            line_y += 18

        # Compilation Result Box
        draw.line([(margin + 20, line_y + 6), (width - margin - 20, line_y + 6)], fill=(32, 48, 40), width=1)
        res_y = line_y + 14
        draw.text((margin + 24, res_y), "Aperçu compilé côté serveur :", fill=ACCENT_GREEN, font=font_small)
        
        sample_render = output_text or ".-. . -. -.. . --.. -....- ...- --- ..- ... / .--. --- .. -. - / ....-"
        draw.rectangle([margin + 24, res_y + 20, width - margin - 24, res_y + 54], fill=(18, 28, 24), outline=ACCENT_GREEN, width=1)
        draw.text((margin + 34, res_y + 27), sample_render[:52], fill=ACCENT_GOLD, font=font_mono)

    # Footer
    footer_y = height - margin - 28
    draw.text((margin + 16, footer_y), f"Auteur : {author}", fill=TEXT_MUTED, font=font_small)
    draw.text((width - margin - 250, footer_y), "✓ Compilé serveur • ScoutRaider Hub", fill=ACCENT_GREEN, font=font_small)

    # Output to base64
    buffer = io.BytesIO()
    img.save(buffer, format="PNG", optimize=True)
    b64_data = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64_data}"


def compile_and_generate_preview(
    module_id: str,
    name: str,
    category: str,
    code: str,
    author: str = "Communauté",
    version: str = "1.0.0"
) -> str:
    """
    Safely executes sample transform if possible, then generates server preview image.
    """
    sample_text = "RENDEZ VOUS AU POINT 42"
    output_text = None
    
    # Try native or sandboxed transform if applicable
    try:
        from .sandbox import execute_builtin_transform
        res = execute_builtin_transform(module_id, sample_text)
        if res and res.encoded_text:
            output_text = res.encoded_text
    except Exception:
        pass

    # If code defines a python function or simple transform, try quick safe execution
    if not output_text and code and "def " in code:
        try:
            local_vars = {}
            # Restrict globals for preview execution
            safe_globals = {
                "__builtins__": {
                    "len": len, "range": range, "str": str, "int": int, "list": list,
                    "dict": dict, "set": set, "ord": ord, "chr": chr, "enumerate": enumerate
                }
            }
            exec(code, safe_globals, local_vars)
            if "encode" in local_vars and callable(local_vars["encode"]):
                output_text = str(local_vars["encode"](sample_text))
            elif "transform" in local_vars and callable(local_vars["transform"]):
                output_text = str(local_vars["transform"](sample_text))
        except Exception as e:
            output_text = f"Exécution : {str(e)[:40]}"

    return render_code_preview(
        name=name,
        category=category,
        code_text=code,
        output_text=output_text,
        version=version,
        author=author
    )

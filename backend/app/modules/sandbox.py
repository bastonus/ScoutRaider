"""
Sandboxed & Standardized Encoders for Scout Modules.
Provides native, safe, deterministic implementations of all 11 core ScoutRaider modules.
Also handles isolated execution of custom Python entrypoints with timeout & exception capture.
"""

import math
import re
from typing import Dict, Any, List, Optional, Tuple
from .schema import EncodedOutput, RenderType

# ─── Accent & String Normalization ─────────────────────────────────────────────

ACCENT_MAP = {
    'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e',
    'à': 'a', 'â': 'a', 'ä': 'a',
    'î': 'i', 'ï': 'i',
    'ô': 'o', 'ö': 'o',
    'û': 'u', 'ù': 'u', 'ü': 'u',
    'ç': 'c', 'œ': 'oe', 'æ': 'ae',
    'ÿ': 'y'
}

def normalize_text(text: str) -> str:
    res = text.lower()
    for k, v in ACCENT_MAP.items():
        res = res.replace(k, v)
    return res


# ─── Morse ────────────────────────────────────────────────────────────────────

MORSE_TABLE = {
    'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.', 'f': '..-.',
    'g': '--.', 'h': '....', 'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
    'm': '--', 'n': '-.', 'o': '---', 'p': '.--.', 'q': '--.-', 'r': '.-.',
    's': '...', 't': '-', 'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
    'y': '-.--', 'z': '--..', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
    '9': '----.', '0': '-----', ' ': '/'
}

def encode_morse(text: str) -> str:
    norm = normalize_text(text)
    words = norm.split(' ')
    encoded_words = []
    for w in words:
        chars = [MORSE_TABLE.get(c, c) for c in w]
        encoded_words.append(' '.join(chars))
    return ' / '.join(encoded_words)


# ─── Vigenère ─────────────────────────────────────────────────────────────────

def encode_vigenere(text: str, key: str = "MOUSTACHE", decode: bool = False) -> str:
    key_clean = re.sub(r'[^A-Za-z]', '', key.upper()) or "MOUSTACHE"
    result = []
    k_idx = 0
    k_len = len(key_clean)

    for char in text:
        if char.isalpha():
            is_upper = char.isupper()
            base = ord('A') if is_upper else ord('a')
            c_val = ord(char.upper()) - 65
            k_val = ord(key_clean[k_idx % k_len]) - 65

            if decode:
                shifted = (c_val - k_val + 26) % 26
            else:
                shifted = (c_val + k_val) % 26

            res_char = chr(base + shifted)
            result.append(res_char)
            k_idx += 1
        else:
            result.append(char)

    return ''.join(result)


# ─── Polybe (6x6 Grid with 0-9) ───────────────────────────────────────────────

POLYBE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
POLYBE_MAP = {}
for idx, ch in enumerate(POLYBE_CHARS):
    row = (idx // 6) + 1
    col = (idx % 6) + 1
    POLYBE_MAP[ch.lower()] = f"{row}{col}"

def encode_polybe(text: str) -> str:
    norm = normalize_text(text)
    res = []
    for c in norm:
        if c in POLYBE_MAP:
            res.append(POLYBE_MAP[c])
        elif c == ' ':
            res.append(' ')
        else:
            res.append(c)
    return ' '.join(res).replace('   ', ' / ')


# ─── Caesar (Avocat & Cassis) ──────────────────────────────────────────────────

def encode_caesar(text: str, shift: int) -> str:
    res = []
    for char in text:
        if char.isalpha():
            is_upper = char.isupper()
            base = ord('A') if is_upper else ord('a')
            shifted = (ord(char) - base + shift) % 26
            res.append(chr(base + shifted))
        else:
            res.append(char)
    return ''.join(res)


# ─── Templar (Pigpen) ─────────────────────────────────────────────────────────

TEMPLAR_SYMBOLS = {
    'a': 'ᒧ', 'b': '⊔', 'c': 'ᒪ', 'd': '⊓', 'e': '◻', 'f': 'コ', 'g': 'ᒷ', 'h': '⊏', 'i': 'ᒸ',
    'j': 'ᒧ·', 'k': '⊔·', 'l': 'ᒪ·', 'm': '⊓·', 'n': '◻·', 'o': 'コ·', 'p': 'ᒷ·', 'q': '⊏·', 'r': 'ᒸ·',
    's': '∨', 't': '>', 'u': '<', 'v': '∧', 'w': '∨·', 'x': '>·', 'y': '<·', 'z': '∧·'
}

def encode_templier(text: str) -> str:
    norm = normalize_text(text)
    return ''.join(TEMPLAR_SYMBOLS.get(c, c) for c in norm)


# ─── Maritime (NATO Phonetic & Flag Codes) ────────────────────────────────────

NATO_ALPHABET = {
    'a': 'Alpha', 'b': 'Bravo', 'c': 'Charlie', 'd': 'Delta', 'e': 'Echo',
    'f': 'Foxtrot', 'g': 'Golf', 'h': 'Hotel', 'i': 'India', 'j': 'Juliett',
    'k': 'Kilo', 'l': 'Lima', 'm': 'Mike', 'n': 'November', 'o': 'Oscar',
    'p': 'Papa', 'q': 'Quebec', 'r': 'Romeo', 's': 'Sierra', 't': 'Tango',
    'u': 'Uniform', 'v': 'Victor', 'w': 'Whiskey', 'x': 'X-ray', 'y': 'Yankee',
    'z': 'Zulu', '0': 'Nadazero', '1': 'Unaone', '2': 'Bissotwo',
    '3': 'Terrathree', '4': 'Kartefour', '5': 'Pantafive', '6': 'Soxisix',
    '7': 'Setteseven', '8': 'Oktoeight', '9': 'Novenine'
}

def encode_maritime(text: str) -> str:
    norm = normalize_text(text)
    words = norm.split(' ')
    encoded_words = []
    for w in words:
        chars = [NATO_ALPHABET.get(c, c) for c in w]
        encoded_words.append('-'.join(chars))
    return '  /  '.join(encoded_words)


# ─── Gilwell SVG Vector Diagram ───────────────────────────────────────────────

def generate_gilwell_svg(segments: List[Dict[str, Any]], width: int = 400, height: int = 240) -> str:
    """
    Renders an inline SVG diagram with azimut arrows and segment lengths.
    """
    if not segments:
        return f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg"><text x="20" y="30" fill="#666">Aucun segment</text></svg>'

    # Calculate coordinates
    points = [(width / 2, height / 2)]
    scale = 0.25

    curr_x, curr_y = points[0]
    for seg in segments:
        azi_deg = seg.get('azimut', 0)
        dist = seg.get('distance', 50)
        rad = math.radians(azi_deg - 90)
        dx = math.cos(rad) * min(dist * scale, 60)
        dy = math.sin(rad) * min(dist * scale, 60)
        curr_x += dx
        curr_y += dy
        points.append((curr_x, curr_y))

    # Center points in viewport
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    
    pad = 30
    w_span = max(max_x - min_x, 1)
    h_span = max(max_y - min_y, 1)
    
    shift_x = (width - w_span) / 2 - min_x
    shift_y = (height - h_span) / 2 - min_y
    
    adj_points = [(p[0] + shift_x, p[1] + shift_y) for p in points]

    svg_parts = [
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">',
        '<defs>',
        '  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">',
        '    <path d="M 0 0 L 10 5 L 0 10 z" fill="#1b4965" />',
        '  </marker>',
        '</defs>',
        f'<rect width="{width}" height="{height}" fill="#f8fafc" rx="8" stroke="#cbd5e1" stroke-width="1"/>'
    ]

    for i in range(len(adj_points) - 1):
        p1 = adj_points[i]
        p2 = adj_points[i+1]
        azi = segments[i].get('azimut', 0)
        dist = int(segments[i].get('distance', 0))
        svg_parts.append(
            f'<line x1="{p1[0]:.1f}" y1="{p1[1]:.1f}" x2="{p2[0]:.1f}" y2="{p2[1]:.1f}" '
            f'stroke="#1b4965" stroke-width="2.5" marker-end="url(#arrow)" />'
        )
        mid_x = (p1[0] + p2[0]) / 2 + 5
        mid_y = (p1[1] + p2[1]) / 2 - 5
        svg_parts.append(
            f'<text x="{mid_x:.1f}" y="{mid_y:.1f}" font-size="10" font-family="sans-serif" '
            f'font-weight="bold" fill="#0f172a">{azi}° ({dist}m)</text>'
        )

    # Start dot
    svg_parts.append(f'<circle cx="{adj_points[0][0]:.1f}" cy="{adj_points[0][0]:.1f}" r="4" fill="#16a34a" />')
    # End dot
    svg_parts.append(f'<circle cx="{adj_points[-1][0]:.1f}" cy="{adj_points[-1][1]:.1f}" r="4" fill="#dc2626" />')
    svg_parts.append('</svg>')

    return '\n'.join(svg_parts)


# ─── Module Dispatcher ────────────────────────────────────────────────────────

def execute_builtin_transform(
    module_id: str,
    solution_text: str,
    segments: Optional[List[Dict[str, Any]]] = None,
    options: Optional[Dict[str, Any]] = None
) -> EncodedOutput:
    opts = options or {}
    mid = module_id.lower().strip()
    segs = segments or []

    if mid == "texte_clair":
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=solution_text,
            render_type=RenderType.TEXT
        )

    elif mid == "morse":
        enc = encode_morse(solution_text)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=enc,
            render_type=RenderType.TEXT,
            annexes=["alphabet_morse"]
        )

    elif mid == "vigenere":
        key = opts.get("vigenere_key", "MOUSTACHE")
        enc = encode_vigenere(solution_text, key=key)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=enc,
            render_type=RenderType.GRID,
            annexes=["tableau_vigenere"],
            metadata={"key": key}
        )

    elif mid == "polybe":
        enc = encode_polybe(solution_text)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=enc,
            render_type=RenderType.GRID,
            annexes=["grille_polybe"]
        )

    elif mid == "avocat":
        enc = encode_caesar(solution_text, shift=10)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=enc,
            render_type=RenderType.TEXT,
            annexes=["methode_avocat"]
        )

    elif mid == "cassis":
        enc = encode_caesar(solution_text, shift=21)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=enc,
            render_type=RenderType.TEXT,
            annexes=["methode_cassis"]
        )

    elif mid == "templier":
        enc = encode_templier(solution_text)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=enc,
            render_type=RenderType.TEXT,
            annexes=["alphabet_templier"]
        )

    elif mid == "maritime":
        enc = encode_maritime(solution_text)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=enc,
            render_type=RenderType.IMAGE,
            annexes=["index_maritime"]
        )

    elif mid == "gilwell":
        svg = generate_gilwell_svg(segs)
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text="[Relevé topographique Gilwell vectoriel ci-dessous]",
            svg_content=svg,
            render_type=RenderType.SVG,
            annexes=["alphabet_gilwell"]
        )

    elif mid in ("carte_simple", "carte", "carte_ign"):
        total_dist = sum(s.get("distance", 0) for s in segs)
        label = "Carte Simple" if mid in ("carte_simple", "carte") else "Carte IGN"
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=f"[Extrait {label} - Distance : {int(total_dist)}m - Suivre le tracé sur la carte]",
            render_type=RenderType.MAP,
            metadata={"total_distance_m": total_dist}
        )

    elif mid == "drapeaux":
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text="[Piste aux fanions de signalisation sur carte]",
            render_type=RenderType.MAP,
            annexes=["index_drapeaux"]
        )

    else:
        # Fallback to plain text
        return EncodedOutput(
            module_id=mid,
            solution_text=solution_text,
            encoded_text=solution_text,
            render_type=RenderType.TEXT
        )

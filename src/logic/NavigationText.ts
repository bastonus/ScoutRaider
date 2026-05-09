/**
 * NavigationText.ts — Themed navigation instruction generator.
 * Ported from legacy/utils/pdf_helpers.py generate_prohibition_text().
 *
 * Called LIVE during editing (not deferred to export).
 */
import type { NavLanguage, ThemeData } from './types';

// ─── Direction conversion tables ──────────────────────────────────────────────

const CARDINAL_16: [number, string][] = [
    [0, 'Nord'], [22.5, 'Nord-Nord-Est'], [45, 'Nord-Est'], [67.5, 'Est-Nord-Est'],
    [90, 'Est'], [112.5, 'Est-Sud-Est'], [135, 'Sud-Est'], [157.5, 'Sud-Sud-Est'],
    [180, 'Sud'], [202.5, 'Sud-Sud-Ouest'], [225, 'Sud-Ouest'], [247.5, 'Ouest-Sud-Ouest'],
    [270, 'Ouest'], [292.5, 'Ouest-Nord-Ouest'], [315, 'Nord-Ouest'], [337.5, 'Nord-Nord-Ouest'],
];

const CLOCK_DIRS: Record<number, string> = {
    0: 'tout droit (12h)', 30: '1 heure', 60: '2 heures', 90: '3 heures',
    120: '4 heures', 150: '5 heures', 180: 'demi-tour (6h)',
    210: '7 heures', 240: '8 heures', 270: '9 heures',
    300: '10 heures', 330: '11 heures',
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function azimuthToCardinal(azimuth: number): string {
    const norm = ((azimuth % 360) + 360) % 360;
    let best = 'Nord';
    let bestDist = 360;
    for (const [angle, name] of CARDINAL_16) {
        let d = Math.abs(norm - angle);
        if (d > 180) d = 360 - d;
        if (d < bestDist) { bestDist = d; best = name; }
    }
    return best;
}

function azimuthToClock(azimuth: number): string {
    const norm = ((azimuth % 360) + 360) % 360;
    const snapped = Math.round(norm / 30) * 30 % 360;
    return CLOCK_DIRS[snapped] || `${Math.round(norm)}°`;
}

function azimuthToTurning(azimuth: number, prevAzimuth?: number): string {
    if (prevAzimuth === undefined) return `direction ${Math.round(azimuth)}°`;
    let diff = azimuth - prevAzimuth;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (Math.abs(diff) < 15) return 'continuez tout droit';
    if (diff > 0 && diff < 60) return 'tournez légèrement à droite';
    if (diff >= 60 && diff < 120) return 'tournez à droite';
    if (diff >= 120) return 'faites un demi-tour à droite';
    if (diff < 0 && diff > -60) return 'tournez légèrement à gauche';
    if (diff <= -60 && diff > -120) return 'tournez à gauche';
    return 'faites un demi-tour à gauche';
}

function formatDistance(m: number): string {
    if (m >= 1000) {
        const km = (m / 1000);
        return km === Math.floor(km) ? `${km} km` : `${km.toFixed(1)} km`;
    }
    return `${Math.round(m)} mètres`;
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Main generator ───────────────────────────────────────────────────────────

export class NavigationText {
    /**
     * Generate themed navigation instruction text for a segment.
     * Called live during editing — runs synchronously.
     */
    static generate(
        distanceM: number,
        azimuth: number,
        poiStr: string | null,
        theme: ThemeData | null,
        prevAzimuth?: number,
        style?: NavLanguage,
    ): string {
        const t = theme || {
            intros: ['Prochaine étape.'],
            actions: ['avancez de'],
            poi: 'Passez devant {poi}, et',
            vigenere_key: 'MOUSTACHE',
            drapeaux_intros: [],
            drapeaux_real: [],
            drapeaux_fake: [],
            drapeaux_outro: [],
        };

        // Pick a random style if none specified
        const chosenStyle: NavLanguage = style || pickRandom<NavLanguage>(
            ['Cardinaux', 'Horaire', 'Azimut', 'Tournant']
        );

        // Build direction string
        let directionStr: string;
        switch (chosenStyle) {
            case 'Cardinaux':
                directionStr = `en direction du ${azimuthToCardinal(azimuth)}`;
                break;
            case 'Horaire':
                directionStr = `direction ${azimuthToClock(azimuth)}`;
                break;
            case 'Azimut':
                directionStr = `au ${Math.round(azimuth)}°`;
                break;
            case 'Tournant':
                directionStr = azimuthToTurning(azimuth, prevAzimuth);
                break;
            default:
                directionStr = `au ${Math.round(azimuth)}°`;
        }

        const distStr = formatDistance(distanceM);

        // Assemble
        const intro = pickRandom(t.intros);
        const action = pickRandom(t.actions);

        let poiPart = '';
        if (poiStr) {
            poiPart = t.poi.replace('{poi}', poiStr) + ' ';
        }

        return `${intro} ${poiPart}${action} ${distStr} ${directionStr}.`;
    }

    /** Convert azimuth to cardinal for display in UI */
    static toCardinal(azimuth: number): string {
        return azimuthToCardinal(azimuth);
    }

    /** Convert azimuth to clock direction for display */
    static toClock(azimuth: number): string {
        return azimuthToClock(azimuth);
    }
}

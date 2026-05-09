/**
 * ThemeManager.ts — Theme loading and themed text generation.
 * Ported from legacy/config/themes.json + pdf_helpers.py theme functions.
 */
import type { ThemeData, ThemesFile } from './types';

const NEUTRAL_FALLBACK: ThemeData = {
    intros: ['Il est temps de se mettre en route.', 'Prochaine étape.', 'En avant.'],
    actions: ['avancez de', 'marchez sur', 'poursuivez sur'],
    poi: 'Passez devant {poi}, et',
    vigenere_key: 'MOUSTACHE',
    drapeaux_intros: ['Piste aux fanions.'],
    drapeaux_real: ['Allez au {c}.', 'Rejoignez le {c}.', 'Marchez vers le {c}.'],
    drapeaux_fake: ['Le {c} est un piège.', 'N\'allez pas au {c}.', 'Fuyez le {c}.'],
    drapeaux_outro: ['Le dernier fanion cité est votre arrivée.', 'Arrêtez-vous au dernier fanion.'],
    labels: {
        filename: 'Carnet_De_Raid',
        main_title: 'CARNET DE ROUTE',
        soluce_title: 'SOLUCE - CHEFS',
        start_point: 'Point de Départ',
        annex_title: 'ANNEXE',
        vigenere_label: 'Chiffre de Vigenère',
        morse_label: 'Télégramme Morse',
        templier_label: 'Croix des Templiers',
        polybe_label: 'Carré de Polybe',
        maritime_label: 'Signaux Maritimes',
        avocat_label: 'Affaire Classée',
        cassis_label: 'Secret de la Cave',
        clair_label: 'Message Clair',
        ign_label: 'Carte IGN',
        gilwell_label: 'Relevé Gilwell',
        drapeaux_label: 'Fanions de signalisation',
        global_map_brut: 'CARTE GLOBALE : TRACÉ BRUT EXACT',
        global_map_poly: 'CARTE GLOBALE : TRACÉ POLYGONAL (ÉTAPES)',
        ledger_title: 'GRAND LIVRE DES ÉTAPES (LOGISTIQUE)',
    },
};

export class ThemeManager {
    private themes: ThemesFile = {};
    private _currentThemeId: string = 'Neutre';
    private _loaded = false;

    get currentThemeId(): string { return this._currentThemeId; }
    get currentTheme(): ThemeData { return this.getTheme(this._currentThemeId); }
    get isLoaded(): boolean { return this._loaded; }

    async load(): Promise<void> {
        try {
            const res = await fetch('/config/themes.json');
            const raw = await res.json();
            // Strip _help key if present
            if (raw._help) delete raw._help;
            this.themes = raw;
            this._loaded = true;
        } catch (e) {
            console.error('Failed to load themes.json:', e);
            this.themes = { Neutre: NEUTRAL_FALLBACK };
            this._loaded = true;
        }
    }

    setTheme(themeId: string): void {
        this._currentThemeId = themeId;
    }

    getTheme(themeId?: string): ThemeData {
        const id = themeId || this._currentThemeId;
        return this.themes[id] || NEUTRAL_FALLBACK;
    }

    /** Get a themed label, falling back to Neutre then to the provided default */
    getLabel(key: string, fallback: string): string {
        const theme = this.getTheme();
        const neutralLabels = NEUTRAL_FALLBACK.labels || {};
        return theme.labels?.[key] || neutralLabels[key] || fallback;
    }

    /** Get the Vigenère key for the current theme */
    getVigenereKey(): string {
        return this.currentTheme.vigenere_key || 'MOUSTACHE';
    }

    /** Get all available theme IDs */
    getThemeIds(): string[] {
        return Object.keys(this.themes);
    }

    /** Get display info for all themes (for the theme selector panel) */
    getThemePreviews(): { id: string; name: string; icon?: string; preview?: string }[] {
        return Object.entries(this.themes).map(([id, data]) => ({
            id,
            name: id,
            icon: data.icon,
            preview: data.preview_image,
        }));
    }
}

// Singleton
export const themeManager = new ThemeManager();

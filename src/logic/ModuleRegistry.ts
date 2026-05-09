/**
 * ModuleRegistry.ts — Static registry of all encoding modules with metadata.
 * Consolidates manifests, constraints, and metadata from legacy config files.
 */
import type { ModuleId, ModuleManifest, ModuleCategory, CategoryConstraints, PolySegment, PresetOverrides } from './types';

// ─── Per-module manifests (from legacy/modules/*/manifest.json) ───────────────

const MODULE_MANIFESTS: Record<ModuleId, ModuleManifest> = {
    morse:       { category: 'crypted_message', type: 'written', description: 'Code Morse classique avec une typographie personnalisée et des délimiteurs.', rules_explanation: 'Codes écrits : Pour ne pas saturer l\'attention, évitez d\'enchaîner plus de 3 messages cryptés/écrits d\'affilée.' },
    vigenere:    { category: 'crypted_message', type: 'written', description: 'Chiffre de Vigenère — cryptage poly-alphabétique pour scouts confirmés.', rules_explanation: 'Vigenère : Technique très difficile, limitée à 1 seule occurrence par carnet pour ne pas décourager les participants.' },
    polybe:      { category: 'crypted_message', type: 'written', description: 'Carré de Polybe — substitution par coordonnées dans une grille 6×6.' },
    gilwell:     { category: 'graphic',         type: 'visual',  description: 'Relevé Gilwell — diagramme d\'azimuts vectoriel pour navigation avancée.' },
    avocat:      { category: 'crypted_message', type: 'written', description: 'Code Avocat — décalage alphabétique de type César (offset 10).' },
    drapeaux:    { category: 'graphic',         type: 'visual',  description: 'Fanions de signalisation — piste de fanions colorés vrais/faux sur la carte.' },
    maritime:    { category: 'graphic',         type: 'visual',  description: 'Pavillon Maritime — alphabet NATO phonétique avec signaux maritimes.' },
    cassis:      { category: 'crypted_message', type: 'written', description: 'Code Cassis — décalage alphabétique de type César (offset 21).' },
    templier:    { category: 'crypted_message', type: 'written', description: 'Croix des Templiers — chiffrement pigpen avec police personnalisée.' },
    texte_clair: { category: 'explicit_message',type: 'written', description: 'Message en clair — texte de navigation sans encodage.' },
    carte_ign:   { category: 'ign_map',         type: 'visual',  description: 'Carte IGN — extrait de carte avec points de départ/arrivée.' },
};

// ─── Category constraints (from legacy/config/constraints_categories.json) ────

const CATEGORY_CONSTRAINTS: Record<ModuleCategory, CategoryConstraints> = {
    crypted_message: {
        type: 'written',
        min_distance_m: 0,
        max_distance_m: null,
        max_azimuts: 2,
        forbidden_zones: ['high_poi_density'],
    },
    graphic: {
        type: 'visual',
        min_distance_m: 800,
        max_distance_m: 1600,
        max_azimuts: 6,
        forbidden_zones: ['high_poi_density'],
    },
    ign_map: {
        type: 'visual',
        min_distance_m: 400,
        max_distance_m: 1200,
        max_azimuts: null,
        forbidden_zones: ['high_poi_density', 'last_third_of_track'],
    },
    explicit_message: {
        type: 'written',
        max_azimuts: 1,
        priority: 'absolute_override',
        trigger: 'high_poi_density',
    },
};

// ─── Display metadata (colors, labels, default annexes) ───────────────────────

export const MODULE_META: Record<ModuleId, { label: string; color: string; defaultAnnexes: string[] }> = {
    morse:       { label: 'Morse',              color: '#ef4444', defaultAnnexes: ['alphabet_morse'] },
    vigenere:    { label: 'Vigenère',            color: '#8b5cf6', defaultAnnexes: ['tableau_vigenere'] },
    polybe:      { label: 'Carré de Polybe',     color: '#14b8a6', defaultAnnexes: ['grille_polybe'] },
    gilwell:     { label: 'Gilwell',             color: '#10b981', defaultAnnexes: ['alphabet_gilwell'] },
    avocat:      { label: 'Avocat',              color: '#f59e0b', defaultAnnexes: ['methode_avocat'] },
    drapeaux:    { label: 'Drapeaux',            color: '#06b6d4', defaultAnnexes: ['index_drapeaux'] },
    maritime:    { label: 'Pavillon Maritime',   color: '#0ea5e9', defaultAnnexes: [] },
    cassis:      { label: 'Cassis',              color: '#7c3aed', defaultAnnexes: [] },
    templier:    { label: 'Templier',            color: '#b45309', defaultAnnexes: [] },
    texte_clair: { label: 'Texte clair',         color: '#6b7280', defaultAnnexes: [] },
    carte_ign:   { label: 'Carte IGN',           color: '#16a34a', defaultAnnexes: [] },
};

// ─── All module IDs ───────────────────────────────────────────────────────────

export const ALL_MODULE_IDS: ModuleId[] = [
    'texte_clair', 'carte_ign', 'gilwell', 'drapeaux', 'morse',
    'templier', 'polybe', 'maritime', 'avocat', 'cassis', 'vigenere',
];

// ═════════════════════════════════════════════════════════════════════════════
//  ModuleRegistry — static methods
// ═════════════════════════════════════════════════════════════════════════════

export class ModuleRegistry {

    static getManifest(moduleId: ModuleId): ModuleManifest {
        return MODULE_MANIFESTS[moduleId];
    }

    static getMeta(moduleId: ModuleId) {
        return MODULE_META[moduleId];
    }

    static getCategory(moduleId: ModuleId): ModuleCategory {
        return MODULE_MANIFESTS[moduleId]?.category || 'crypted_message';
    }

    static getType(moduleId: ModuleId): 'visual' | 'written' {
        return MODULE_MANIFESTS[moduleId]?.type || 'written';
    }

    static getCategoryConstraints(moduleId: ModuleId): CategoryConstraints {
        const cat = this.getCategory(moduleId);
        return CATEGORY_CONSTRAINTS[cat] || CATEGORY_CONSTRAINTS.crypted_message;
    }

    /**
     * Evaluate whether a module can fit at startIdx over the segments.
     * Returns [canFit, segmentCount].
     * Ported from legacy main_orchestrator.py _evaluate_module().
     */
    static evaluate(
        moduleId: ModuleId,
        startIdx: number,
        segments: PolySegment[],
        overrides?: PresetOverrides,
        sessionHistory?: string[],
    ): [boolean, number] {
        const segmentsLeft = segments.length - startIdx;
        if (segmentsLeft === 0) return [false, 0];

        let catData = { ...this.getCategoryConstraints(moduleId) } as any;

        // Apply preset overrides
        if (overrides) {
            catData = { ...catData, ...overrides };
        }

        const minDist = catData.min_distance_m || 0;
        const maxDist = catData.max_distance_m || Infinity;
        const maxAzi = catData.max_azimuts;
        const maxOcc = catData.max_occurrences;

        // Check global occurrence limit
        if (maxOcc !== undefined && maxOcc !== null && sessionHistory) {
            const currentOcc = sessionHistory.filter(m => m === moduleId).length;
            if (currentOcc >= maxOcc) return [false, 0];
        }

        // Check forbidden zones
        const forbidden = catData.forbidden_zones || [];
        if (forbidden.includes('last_third_of_track') && startIdx >= segments.length * 2 / 3) {
            return [false, 0];
        }

        // Determine valid range of segments
        const validRange: number[] = [];
        let currDist = 0;
        for (let count = 1; count <= segmentsLeft; count++) {
            const seg = segments[startIdx + count - 1];
            currDist += seg.distance || 0;

            if (maxAzi && count > maxAzi) break;
            if (currDist > maxDist) break;

            if (currDist >= minDist) {
                validRange.push(count);
            }
        }

        if (!validRange.length) return [false, 0];
        return [true, validRange[0]];
    }

    /**
     * Get modules with weight > 0 for a given preset weights dict.
     */
    static getEnabledModules(weights: Record<string, number>): ModuleId[] {
        if (!Object.keys(weights).length) return [...ALL_MODULE_IDS];
        return ALL_MODULE_IDS.filter(m => (weights[m] || 0) > 0);
    }
}

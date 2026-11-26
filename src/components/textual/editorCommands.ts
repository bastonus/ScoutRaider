/**
 * editorCommands.ts — Registre unique de commandes pour l'éditeur style Notion.
 * Alimente :
 *  1. Le menu `/` (SlashCommandPalette) — groupé en Texte, Raid, Avancé
 *  2. La bulle de sélection (Transformer en ▾ & formatage)
 *  3. Le menu contextuel du bloc (⋮⋮ / clic droit)
 */
import type { ModuleId } from '../../logic/types';
import { ModuleManagementService } from '../../logic/ModuleManagementService';

export type CommandGroup = 'Texte' | 'Chiffrement' | 'Raid' | 'Avancé';

export interface EditorCommandDef {
    id: string;
    label: string;
    description: string;
    group: CommandGroup;
    shortcut?: string;
    keywords: string[];
    blockType: string;
    config?: { level?: number; cipher?: ModuleId };
    markdownPrefix?: string;
    /** Disponible dans "Transformer en ▾" */
    transformable?: boolean;
}

export const EDITOR_COMMANDS: EditorCommandDef[] = [
    // ── Groupe : Texte ────────────────────────────────────────────────────────
    {
        id: 'paragraph',
        label: 'Texte',
        description: 'Paragraphe simple',
        group: 'Texte',
        shortcut: 'p',
        keywords: ['para', 'texte', 'text', 'p'],
        blockType: 'paragraph',
        markdownPrefix: '',
        transformable: true,
    },
    {
        id: 'h1',
        label: 'Titre 1',
        description: 'Grand titre de section',
        group: 'Texte',
        shortcut: '#',
        keywords: ['titre', 'h1', 'heading', 'title', '#'],
        blockType: 'heading',
        config: { level: 1 },
        markdownPrefix: '# ',
        transformable: true,
    },
    {
        id: 'h2',
        label: 'Titre 2',
        description: 'Titre de sous-section',
        group: 'Texte',
        shortcut: '##',
        keywords: ['titre', 'h2', 'heading', '##'],
        blockType: 'heading',
        config: { level: 2 },
        markdownPrefix: '## ',
        transformable: true,
    },
    {
        id: 'h3',
        label: 'Titre 3',
        description: 'Petit titre',
        group: 'Texte',
        shortcut: '###',
        keywords: ['titre', 'h3', 'heading', '###'],
        blockType: 'heading',
        config: { level: 3 },
        markdownPrefix: '### ',
        transformable: true,
    },
    {
        id: 'bullet',
        label: 'Liste à puces',
        description: 'Liste simple à puces',
        group: 'Texte',
        shortcut: '-',
        keywords: ['liste', 'bullet', 'puce', '-', '*'],
        blockType: 'bullet_list',
        markdownPrefix: '- ',
        transformable: true,
    },
    {
        id: 'numbered',
        label: 'Liste numérotée',
        description: 'Liste ordonnée',
        group: 'Texte',
        shortcut: '1.',
        keywords: ['liste', 'number', 'numéro', '1.', 'ol'],
        blockType: 'numbered_list',
        markdownPrefix: '1. ',
        transformable: true,
    },
    {
        id: 'checklist',
        label: 'Liste de tâches',
        description: 'Cases à cocher',
        group: 'Texte',
        shortcut: '[]',
        keywords: ['todo', 'check', 'tâche', 'case', '[ ]'],
        blockType: 'check_list',
        markdownPrefix: '- [ ] ',
        transformable: true,
    },
    {
        id: 'quote',
        label: 'Citation',
        description: 'Mettre un passage en avant',
        group: 'Texte',
        shortcut: '>',
        keywords: ['quote', 'citation', '>', 'blockquote'],
        blockType: 'blockquote',
        markdownPrefix: '> ',
        transformable: true,
    },
    {
        id: 'code_generic',
        label: 'Code',
        description: 'Bloc de code brut',
        group: 'Texte',
        shortcut: '```',
        keywords: ['code', 'snippet', '```', 'programmation'],
        blockType: 'code_block',
        markdownPrefix: '```\n\n```',
    },
    {
        id: 'divider',
        label: 'Séparateur',
        description: 'Ligne horizontale fine',
        group: 'Texte',
        shortcut: '---',
        keywords: ['hr', 'ligne', 'séparateur', '---'],
        blockType: 'divider',
        markdownPrefix: '---',
    },
    {
        id: 'formula',
        label: 'Formule',
        description: 'Équation LaTeX',
        group: 'Texte',
        shortcut: '$$',
        keywords: ['latex', 'formule', 'math', '$', 'équation'],
        blockType: 'latex',
        markdownPrefix: '$$\n\n$$',
    },

    // ── Groupe : Raid ─────────────────────────────────────────────────────────
    {
        id: 'raid_step',
        label: 'Étape',
        description: 'En-tête ou repère d\'étape du raid',
        group: 'Raid',
        keywords: ['etape', 'étape', 'step', 'stage', 'raid'],
        blockType: 'raid_step',
    },
    {
        id: 'raid_map',
        label: 'Carte',
        description: 'Extrait cartographique de l\'étape',
        group: 'Raid',
        keywords: ['carte', 'map', 'ign', 'raid'],
        blockType: 'crypto_block',
        config: { cipher: 'carte_ign' },
    },
    {
        id: 'raid_guided',
        label: 'Texte guidé',
        description: 'Bloc d\'itinéraire guidé en clair',
        group: 'Raid',
        keywords: ['texte', 'guide', 'guidé', 'itinéraire', 'clair'],
        blockType: 'crypto_block',
        config: { cipher: 'texte_clair' },
        transformable: true,
    },
    {
        id: 'raid_elevation',
        label: 'Profil altimétrique',
        description: 'Courbe de dénivelé du parcours',
        group: 'Raid',
        keywords: ['profil', 'altimetrique', 'altimétrique', 'denivele', 'elevation'],
        blockType: 'raid_elevation',
    },
    {
        id: 'code_morse',
        label: 'Morse',
        description: 'Bloc encodé en code Morse',
        group: 'Chiffrement',
        keywords: ['morse', 'code', 'chiffre', 'encrypter', 'raid'],
        blockType: 'crypto_block',
        config: { cipher: 'morse' },
        transformable: true,
    },
    {
        id: 'code_vigenere',
        label: 'Vigenère',
        description: 'Chiffre polyalphabétique',
        group: 'Chiffrement',
        keywords: ['vigenere', 'vigenère', 'code', 'chiffre', 'encrypter'],
        blockType: 'crypto_block',
        config: { cipher: 'vigenere' },
        transformable: true,
    },
    {
        id: 'code_polybe',
        label: 'Carré de Polybe',
        description: 'Grille de substitution 6×6',
        group: 'Chiffrement',
        keywords: ['polybe', 'grille', 'code', 'chiffre', 'encrypter'],
        blockType: 'crypto_block',
        config: { cipher: 'polybe' },
        transformable: true,
    },
    {
        id: 'code_templier',
        label: 'Templier',
        description: 'Chiffre maçonnique / pigpen',
        group: 'Chiffrement',
        keywords: ['templier', 'pigpen', 'code', 'chiffre', 'encrypter'],
        blockType: 'crypto_block',
        config: { cipher: 'templier' },
        transformable: true,
    },
    {
        id: 'code_maritime',
        label: 'Pavillons maritimes',
        description: 'Alphabet des pavillons navals',
        group: 'Chiffrement',
        keywords: ['maritime', 'pavillon', 'drapeau', 'code', 'encrypter'],
        blockType: 'crypto_block',
        config: { cipher: 'maritime' },
        transformable: true,
    },
    {
        id: 'code_avocat',
        label: 'Avocat (A=K)',
        description: 'Décalage César +10',
        group: 'Chiffrement',
        keywords: ['avocat', 'cesar', 'césar', 'code', 'encrypter'],
        blockType: 'crypto_block',
        config: { cipher: 'avocat' },
        transformable: true,
    },
    {
        id: 'code_cassis',
        label: 'Cassis (K=6)',
        description: 'Décalage César K=6',
        group: 'Chiffrement',
        keywords: ['cassis', 'cesar', 'césar', 'code', 'encrypter'],
        blockType: 'crypto_block',
        config: { cipher: 'cassis' },
        transformable: true,
    },

    // ── Groupe : Avancé ───────────────────────────────────────────────────────
    {
        id: 'image',
        label: 'Image',
        description: 'Insérer une image',
        group: 'Avancé',
        keywords: ['img', 'image', 'photo', 'picture'],
        blockType: 'image',
        markdownPrefix: '![]()',
    },
    {
        id: 'file',
        label: 'Fichier',
        description: 'Joindre un fichier',
        group: 'Avancé',
        keywords: ['file', 'fichier', 'pièce', 'jointe'],
        blockType: 'file',
        markdownPrefix: '[Fichier]()',
    },
    {
        id: 'toc',
        label: 'Table des matières',
        description: 'Sommaire automatique',
        group: 'Avancé',
        keywords: ['toc', 'sommaire', 'table', 'matières'],
        blockType: 'toc',
        markdownPrefix: '[[TOC]]',
    },
    {
        id: 'annexe',
        label: 'Annexe de décodage',
        description: 'Table Morse, Polybe, etc.',
        group: 'Avancé',
        keywords: ['annexe', 'table', 'décodage', 'alphabet'],
        blockType: 'annexe',
    },
    {
        id: 'ref_step',
        label: 'Référer une étape',
        description: 'Lien vers une étape du carnet',
        group: 'Avancé',
        shortcut: '@',
        keywords: ['ref', 'référence', 'étape', 'step', '@'],
        blockType: 'ref_step',
    },
    {
        id: 'ref_poi',
        label: 'Référer un POI',
        description: 'Point d\'intérêt sur la carte',
        group: 'Avancé',
        keywords: ['poi', 'point', 'intérêt', 'repère'],
        blockType: 'ref_poi',
    },
];

export function getAllEditorCommands(): EditorCommandDef[] {
    const knownCiphers = new Set(
        EDITOR_COMMANDS
            .filter(c => c.blockType === 'crypto_block' && c.config?.cipher)
            .map(c => c.config!.cipher as string)
    );
    const dynamicCrypto: EditorCommandDef[] = [];
    try {
        const modules = ModuleManagementService.getAllModules();
        for (const m of modules) {
            if (
                m.resource_type === 'crypto_module' &&
                !['map_path', 'elevation_profile', 'map_overview'].includes(m.data_capability || '') &&
                !knownCiphers.has(m.id)
            ) {
                dynamicCrypto.push({
                    id: `code_${m.id}`,
                    label: m.name,
                    description: m.description || `Code avancé (${m.name})`,
                    group: 'Chiffrement',
                    keywords: ['code', 'chiffre', 'encrypter', 'avancé', m.id, m.name.toLowerCase()],
                    blockType: 'crypto_block',
                    config: { cipher: m.id as ModuleId },
                    transformable: true,
                });
            }
        }
    } catch {
        // Fallback silencieux hors navigateur
    }
    return [...EDITOR_COMMANDS, ...dynamicCrypto];
}

export function filterEditorCommands(query: string): EditorCommandDef[] {
    const all = getAllEditorCommands();
    const q = query.trim().toLowerCase().replace(/^\//, '');
    if (!q) return all;
    return all.filter(cmd =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.keywords.some(k => k.toLowerCase().includes(q)) ||
        cmd.id.toLowerCase().includes(q)
    );
}

export function getTransformableCommands(): EditorCommandDef[] {
    return getAllEditorCommands().filter(cmd => cmd.transformable);
}

export function getCryptoCommands(includeSpatialModules = false): EditorCommandDef[] {
    const textCommands = getAllEditorCommands().filter(cmd => cmd.group === 'Chiffrement');
    if (!includeSpatialModules) {
        return textCommands;
    }

    const seenCiphers = new Set<string>(
        textCommands.map(c => c.config?.cipher).filter(Boolean) as string[]
    );
    const extraCompatible: EditorCommandDef[] = [];

    // Texte clair pour retirer le chiffrement d'un bloc généré
    const guidedCmd = EDITOR_COMMANDS.find(c => c.config?.cipher === 'texte_clair');
    if (guidedCmd && !seenCiphers.has('texte_clair')) {
        extraCompatible.push({ ...guidedCmd, label: 'Texte clair (sans code)' });
        seenCiphers.add('texte_clair');
    }

    // Modules graphiques / carto intégrés compatibles avec une étape générée
    const builtinSpatial: Array<{ id: ModuleId; label: string; description: string }> = [
        { id: 'gilwell', label: 'Gilwell (piste)', description: 'Piste d\'azimuts graphique Gilwell' },
        { id: 'drapeaux', label: 'Drapeaux / Fanions', description: 'Piste de fanions sur carte' },
        { id: 'carte_ign', label: 'Carte IGN', description: 'Extrait cartographique IGN de l\'étape' },
    ];
    for (const s of builtinSpatial) {
        if (!seenCiphers.has(s.id)) {
            extraCompatible.push({
                id: `code_${s.id}`,
                label: s.label,
                description: s.description,
                group: 'Chiffrement',
                keywords: ['code', 'carte', 'visuel', s.id, s.label.toLowerCase()],
                blockType: 'crypto_block',
                config: { cipher: s.id },
                transformable: true,
            });
            seenCiphers.add(s.id);
        }
    }

    // Tous les modules compatibles synchronisés avec la marketplace
    try {
        const modules = ModuleManagementService.getAllModules();
        for (const m of modules) {
            if (
                m.resource_type === 'crypto_module' &&
                m.data_capability !== 'elevation_profile' &&
                !seenCiphers.has(m.id)
            ) {
                extraCompatible.push({
                    id: `code_${m.id}`,
                    label: m.name,
                    description: m.description || `Module compatible (${m.name})`,
                    group: 'Chiffrement',
                    keywords: ['code', 'marketplace', m.id, m.name.toLowerCase()],
                    blockType: 'crypto_block',
                    config: { cipher: m.id as ModuleId },
                    transformable: true,
                });
                seenCiphers.add(m.id);
            }
        }
    } catch {
        // Fallback silencieux hors navigateur
    }

    return [...textCommands, ...extraCompatible];
}

/**
 * Calcule les bornes [start, end] du mot autour d'un offset donné dans une chaîne.
 * Utilisé pour le double-clic intelligent lors de la transition vue encodée -> édition.
 */
export function getWordBounds(text: string, offset: number): [number, number] {
    if (!text) return [0, 0];
    const idx = Math.max(0, Math.min(offset, text.length - 1));
    const isWordChar = (ch: string) => /[\p{L}\p{N}_'-]/u.test(ch);
    let start = idx;
    let end = idx;
    if (!isWordChar(text[idx])) {
        while (start > 0 && !isWordChar(text[start - 1])) start--;
        if (start > 0) {
            start--;
        } else {
            while (end < text.length && !isWordChar(text[end])) end++;
            start = end;
        }
        end = start;
    }
    while (start > 0 && isWordChar(text[start - 1])) start--;
    while (end < text.length && isWordChar(text[end])) end++;
    return [start, end];
}

/**
 * Estime un offset de caractère proportionnel dans `text` à partir des coordonnées d'un clic
 * sur une zone (utile quand la vue encodée a une taille différente du texte clair édité).
 */
export function estimateOffsetFromClick(text: string, clientX: number, clientY: number, rect: DOMRect): number {
    if (!text) return 0;
    const relY = rect.height > 0 ? Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)) : 0;
    const relX = rect.width > 0 ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) : 0;
    // Si la zone fait plusieurs lignes, combiner Y (principal) et X ; sinon X suffit.
    const approxLines = Math.max(1, Math.round(rect.height / 24));
    const ratio = approxLines > 1
        ? Math.max(0, Math.min(1, (Math.floor(relY * approxLines) + relX) / approxLines))
        : relX;
    return Math.max(0, Math.min(text.length - 1, Math.round(ratio * (text.length - 1))));
}

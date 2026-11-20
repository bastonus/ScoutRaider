/**
 * UnifiedContextMenu.tsx — Menu contextuel unifié (trois points) pour tous les types de blocs
 * Style identique à la barre textuelle (toolbarSwapIn, bg-elevated, border-subtle, shadow-md)
 * Sur desktop : clic gauche sur les 3 points ouvre le menu
 * Pour blocs d'encodage : boutons contextuels selon le mode de chiffrement
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    MoreVertical, Edit2, Trash2, Code2, MessageSquarePlus,
    Copy, Check, ChevronDown, Lock, Unlock, Eye, EyeOff,
    MoveUp, MoveDown, Copy as DuplicateIcon, Link2, Flag, Info,
    Heading1, Heading2, Heading3, List, Quote, Image,
    FileText, Key, Sigma, Zap, Settings, Palette, MapPin, Globe,
    RotateCcw, Type, Grid, Hash, Minus, Circle, Waves
} from 'lucide-react';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import { CIPHER_FONTS, CIPHER_FONT_SIZES } from './MarkdownRenderer';
import type { ModuleId, CarnetStep } from '../../logic/types';
import { useApp } from '../../AppContext';

interface UnifiedContextMenuProps {
    /** Type de bloc pour adapter le menu */
    blockType: 'html' | 'code' | 'computed' | 'map' | 'annexe' | 'title' | 'generic';
    /** ID unique du bloc */
    blockId: string;
    /** Données du bloc (pour actions contextuelles) */
    blockData?: any;
    /** Modules de chiffrement disponibles */
    availableCiphers?: ModuleId[];
    /** Position d'ancrage (optionnel, calculé auto si non fourni) */
    anchorPosition?: { x: number; y: number };
    /** Ref de l'élément déclencheur (bouton 3 points) */
    triggerRef?: React.RefObject<HTMLButtonElement>;
    /** Callbacks d'actions */
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onConvertToCode?: (cipher: ModuleId) => void;
    onConvertToHtml?: () => void;
    onChangeCipher?: (cipher: ModuleId) => void;
    onChangeLanguage?: (lang: string) => void;
    onTogglePOI?: (poiId: string) => void;
    onToggleSolution?: () => void;
    onLockToggle?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onCopy?: () => void;
    onLinkReference?: () => void;
    onOpenFontSelector?: () => void;
    onOpenSettings?: () => void;
    /** État pour les éléments du menu */
    isLocked?: boolean;
    isSolutionView?: boolean;
    hasSolution?: boolean;
    navLanguage?: string;
    pois?: Array<{ id: string; name: string; selected: boolean }>;
    /** Si le bloc parent est survolé */
    isHovered?: boolean;
    /** Fermeture externe */
    onClose?: () => void;
}

type MenuSection = {
    title?: string;
    items: MenuItem[];
    dividerAfter?: boolean;
};

type MenuItem = {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    action: () => void;
    disabled?: boolean;
    dangerous?: boolean;
    shortcut?: string;
    submenu?: MenuSection;
    checked?: boolean;
    dividerAfter?: boolean;
};

// ─── Icônes spécifiques par module de chiffrement ──────────────────────────
const CIPHER_ICONS: Record<string, React.ReactNode> = {
    morse: <Waves size={14} />,
    vigenere: <Key size={14} />,
    polybe: <Grid size={14} />,
    templier: <Hash size={14} />,
    maritime: <Flag size={14} />,
    avocat: <RotateCcw size={14} />,
    cassis: <Minus size={14} />,
    texte_clair: <Type size={14} />,
};

const TEXTUAL_CIPHERS: ModuleId[] = ALL_MODULE_IDS.filter(id =>
    ['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis', 'texte_clair'].includes(id)
);

export default function UnifiedContextMenu({
    blockType,
    blockId,
    blockData,
    availableCiphers = [],
    anchorPosition,
    triggerRef,
    onEdit,
    onDelete,
    onDuplicate,
    onConvertToCode,
    onConvertToHtml,
    onChangeCipher,
    onChangeLanguage,
    onTogglePOI,
    onToggleSolution,
    onLockToggle,
    onMoveUp,
    onMoveDown,
    onCopy,
    onLinkReference,
    onOpenFontSelector,
    onOpenSettings,
    isLocked = false,
    isSolutionView = false,
    hasSolution = false,
    navLanguage,
    pois = [],
    isHovered = false,
    onClose
}: UnifiedContextMenuProps) {
    const { dispatch } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);

    // Déterminer le cipher actuel pour les blocs code
    const currentCipher = blockData?.moduleId as ModuleId | undefined;
    const cipherMeta = currentCipher ? MODULE_META[currentCipher] : null;
    const cipherColor = cipherMeta?.color || '#6b7280';
    const cipherFont = CIPHER_FONTS[currentCipher || ''] || 'monospace';
    const cipherFontSize = CIPHER_FONT_SIZES[currentCipher || ''] || '14px';

    // ─── Construction du menu selon le type de bloc ────────────────────────
    const menuSections = useMemo((): MenuSection[] => {
        const sections: MenuSection[] = [];
        const textualCiphers = TEXTUAL_CIPHERS;

        // Section 1: Actions principales (style toolbar)
        const primaryItems: MenuItem[] = [];

        if (onEdit) {
            primaryItems.push({
                id: 'edit',
                label: 'Éditer',
                description: 'Modifier le contenu (Double-clic)',
                icon: <Edit2 size={14} />,
                action: () => { onEdit(); setIsOpen(false); },
                shortcut: 'Entrée / Double-clic'
            });
        }

        if (onDuplicate) {
            primaryItems.push({
                id: 'duplicate',
                label: 'Dupliquer',
                description: 'Créer une copie de ce bloc',
                icon: <DuplicateIcon size={14} />,
                action: () => { onDuplicate(); setIsOpen(false); },
                shortcut: 'Ctrl+D'
            });
        }

        if (onMoveUp || onMoveDown) {
            if (onMoveUp) {
                primaryItems.push({
                    id: 'move_up',
                    label: 'Monter',
                    description: 'Déplacer le bloc vers le haut',
                    icon: <MoveUp size={14} />,
                    action: () => { onMoveUp(); setIsOpen(false); },
                    shortcut: 'Alt+↑'
                });
            }
            if (onMoveDown) {
                primaryItems.push({
                    id: 'move_down',
                    label: 'Descendre',
                    description: 'Déplacer le bloc vers le bas',
                    icon: <MoveDown size={14} />,
                    action: () => { onMoveDown(); setIsOpen(false); },
                    shortcut: 'Alt+↓'
                });
            }
        }

        if (onCopy) {
            primaryItems.push({
                id: 'copy',
                label: 'Copier',
                description: 'Copier le contenu dans le presse-papiers',
                icon: <Copy size={14} />,
                action: () => { onCopy(); setIsOpen(false); },
                shortcut: 'Ctrl+C'
            });
        }

        if (onLinkReference) {
            primaryItems.push({
                id: 'link_ref',
                label: 'Copier la référence',
                description: 'Insérer une référence vers ce bloc',
                icon: <Link2 size={14} />,
                action: () => { onLinkReference(); setIsOpen(false); },
                shortcut: 'Ctrl+Shift+C'
            });
        }

        if (primaryItems.length > 0) {
            sections.push({ title: 'Actions', items: primaryItems.filter(i => i.icon) });
        }

        // Section 2: Conversion de type (pour blocs manuels)
        if (blockType === 'html' || blockType === 'code' || blockType === 'title') {
            const convertItems: MenuItem[] = [];

            if (blockType === 'html' || blockType === 'title') {
                // Convertir en code chiffré
                if (textualCiphers.length > 0) {
                    convertItems.push({
                        id: 'convert_to_code',
                        label: 'Convertir en code chiffré',
                        description: 'Choisir un module de chiffrement',
                        icon: <Code2 size={14} />,
                        action: () => {},
                        submenu: {
                            title: 'Choisir le code',
                            items: textualCiphers.map(cipherId => {
                                const m = MODULE_META[cipherId];
                                return {
                                    id: `cipher_${cipherId}`,
                                    label: m?.label || cipherId,
                                    description: m?.description,
                                    icon: (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: m?.color || '#6b7280' }} />
                                            <span>{m?.label || cipherId}</span>
                                        </span>
                                    ),
                                    action: () => { onConvertToCode?.(cipherId as ModuleId); setIsOpen(false); setActiveSubmenu(null); }
                                };
                            })
                        }
                    });
                }
            }

            if (blockType === 'code' && onConvertToHtml) {
                convertItems.push({
                    id: 'convert_to_html',
                    label: 'Convertir en commentaire riche',
                    description: 'Passer en mode texte formaté (Markdown/HTML)',
                    icon: <MessageSquarePlus size={14} />,
                    action: () => { onConvertToHtml(); setIsOpen(false); }
                });
            }

            if (convertItems.length > 0) {
                sections.push({ title: 'Conversion', items: convertItems });
            }
        }

        // Section 3: CHANGEMENT DE CHIFFREMENT — Boutons contextuels selon le mode actuel
        if ((blockType === 'code' || blockType === 'computed') && textualCiphers.length > 0) {
            const cipherItems: MenuItem[] = [];

            // Bouton principal : changer de chiffrement (avec indicateur du mode actuel)
            cipherItems.push({
                id: 'change_cipher_main',
                label: currentCipher
                    ? `${MODULE_META[currentCipher]?.label || currentCipher}`
                    : 'Choisir le chiffrement',
                description: currentCipher ? `Mode actuel : ${MODULE_META[currentCipher]?.label || currentCipher}` : 'Aucun chiffrement sélectionné',
                icon: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: cipherColor,
                            boxShadow: '0 0 0 2px var(--bg-elevated)'
                        }} />
                        {CIPHER_ICONS[currentCipher || '']}
                    </span>
                ),
                action: () => setActiveSubmenu('cipher_picker'),
            });

            // Sous-menu : sélecteur de chiffrement avec aperçu
            if (textualCiphers.length > 0) {
                // On ajoute le sous-menu comme section séparée qui sera affichée via activeSubmenu
                sections.push({
                    title: 'Chiffrement',
                    items: [{
                        id: 'cipher_picker',
                        label: currentCipher
                            ? `${MODULE_META[currentCipher]?.label || currentCipher}`
                            : 'Choisir le chiffrement',
                        description: 'Cliquer pour changer de mode de chiffrement',
                        icon: (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: cipherColor,
                                    boxShadow: '0 0 0 2px var(--bg-elevated)'
                                }} />
                                {CIPHER_ICONS[currentCipher || '']}
                            </span>
                        ),
                        action: () => setActiveSubmenu('cipher_picker'),
                    }]
                });
            }
        }

        // Section 4: Options spécifiques au chiffrement ACTUEL
        if ((blockType === 'code' || blockType === 'computed') && currentCipher) {
            const cipherSpecificItems: MenuItem[] = [];

            // Pour chaque type de chiffrement, ajouter des options contextuelles
            switch (currentCipher) {
                case 'morse':
                    cipherSpecificItems.push(
                        {
                            id: 'morse_speed',
                            label: 'Vitesse Morse',
                            description: 'Ajuster la vitesse de lecture',
                            icon: <Waves size={14} />,
                            action: () => { /* TODO: ouvrir panel vitesse */ setIsOpen(false); }
                        },
                        {
                            id: 'morse_format',
                            label: 'Format points/traits',
                            description: 'Choisir • − ou . -',
                            icon: <Waves size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        }
                    );
                    break;
                case 'vigenere':
                    cipherSpecificItems.push(
                        {
                            id: 'vigenere_key',
                            label: 'Changer la clé',
                            description: 'Modifier la clé de chiffrement Vigenère',
                            icon: <Key size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        },
                        {
                            id: 'vigenere_table',
                            label: 'Voir la table',
                            description: 'Afficher le carré de Vigenère complet',
                            icon: <Grid size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        }
                    );
                    break;
                case 'polybe':
                    cipherSpecificItems.push(
                        {
                            id: 'polybe_grid',
                            label: 'Grille 5×5 ou 6×6',
                            description: 'Choisir la taille de la grille',
                            icon: <Grid size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        },
                        {
                            id: 'polybe_coords',
                            label: 'Format coordonnées',
                            description: '11-12 ou A1-B2',
                            icon: <Hash size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        }
                    );
                    break;
                case 'templier':
                    cipherSpecificItems.push(
                        {
                            id: 'templier_style',
                            label: 'Style de croix',
                            description: 'Choisir le variant pigpen',
                            icon: <Hash size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        }
                    );
                    break;
                case 'maritime':
                    cipherSpecificItems.push(
                        {
                            id: 'maritime_nato',
                            label: 'Alphabet NATO',
                            description: 'Alpha, Bravo, Charlie...',
                            icon: <Flag size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        },
                        {
                            id: 'maritime_flags',
                            label: 'Pavillons visuels',
                            description: 'Drapeaux de signalisation',
                            icon: <Flag size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        }
                    );
                    break;
                case 'avocat':
                case 'cassis':
                    cipherSpecificItems.push(
                        {
                            id: 'caesar_shift',
                            label: 'Valeur du décalage',
                            description: currentCipher === 'avocat' ? 'Décalage +10 (A=K)' : 'Décalage +6 (K=6)',
                            icon: <RotateCcw size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        }
                    );
                    break;
                case 'texte_clair':
                    cipherSpecificItems.push(
                        {
                            id: 'plain_format',
                            label: 'Mise en forme',
                            description: 'Gras, italique, listes...',
                            icon: <Type size={14} />,
                            action: () => { /* TODO */ setIsOpen(false); }
                        }
                    );
                    break;
            }

            if (cipherSpecificItems.length > 0) {
                sections.push({ title: `Options ${MODULE_META[currentCipher]?.label || currentCipher}`, items: cipherSpecificItems });
            }
        }

        // Section 5: Langage de guidage (pour blocs computed)
        if (blockType === 'computed' && (onChangeLanguage || navLanguage !== undefined)) {
            const languages = ['Aléatoire', 'Horaire', 'Cardinaux', 'Azimut', 'Tournant'];
            sections.push({
                title: 'Guidage',
                items: [{
                    id: 'nav_language',
                    label: navLanguage ? `Langage: ${navLanguage}` : 'Langage: Aléatoire',
                    description: 'Changer le style de guidage',
                    icon: <Globe size={14} />,
                    action: () => {},
                    submenu: {
                        title: 'Langage de guidage',
                        items: languages.map(lang => ({
                            id: `lang_${lang}`,
                            label: lang === 'Aléatoire' ? 'Aléatoire (mélange)' : lang,
                            icon: lang !== 'Aléatoire' && navLanguage === lang
                                ? <Check size={12} color="var(--accent-hover)" strokeWidth={2.5} />
                                : null,
                            action: () => { onChangeLanguage?.(lang === 'Aléatoire' ? '' : lang); setIsOpen(false); setActiveSubmenu(null); },
                            checked: navLanguage === lang || (!navLanguage && lang === 'Aléatoire')
                        }))
                    }
                }]
            });
        }

        // Section 6: POI (si disponibles)
        if (pois.length > 0 && onTogglePOI) {
            sections.push({
                title: 'Points d\'intérêt',
                items: pois.map(poi => ({
                    id: `poi_${poi.id}`,
                    label: poi.name,
                    icon: poi.selected ? <Check size={12} color="var(--semantic-orange)" strokeWidth={2.5} /> : <MapPin size={14} />,
                    action: () => { onTogglePOI(poi.id); },
                    checked: poi.selected
                }))
            });
        }

        // Section 7: Affichage solution/participant
        if (blockType === 'computed' && hasSolution && onToggleSolution) {
            sections.push({
                title: 'Affichage',
                items: [{
                    id: 'toggle_solution',
                    label: isSolutionView ? 'Mode participant (chiffré)' : 'Mode solution (clair)',
                    description: 'Basculer entre vue participant et vue organisateur',
                    icon: isSolutionView ? <EyeOff size={14} /> : <Eye size={14} />,
                    action: () => { onToggleSolution(); setIsOpen(false); },
                    shortcut: 'Ctrl+Shift+S'
                }]
            });
        }

        // Section 8: Verrouillage (pour cartes, blocs calculés)
        if ((blockType === 'map' || blockType === 'computed') && onLockToggle) {
            sections.push({
                title: 'Verrouillage',
                items: [{
                    id: 'toggle_lock',
                    label: isLocked ? 'Déverrouiller' : 'Verrouiller',
                    description: isLocked ? 'Autoriser les modifications automatiques' : 'Empêcher la régénération automatique',
                    icon: isLocked ? <Unlock size={14} /> : <Lock size={14} />,
                    action: () => { onLockToggle(); setIsOpen(false); },
                    checked: isLocked
                }]
            });
        }

        // Section 9: Polices (pour blocs HTML/rich text)
        if ((blockType === 'html' || blockType === 'title') && onOpenFontSelector) {
            sections.push({
                title: 'Apparence',
                items: [{
                    id: 'font_selector',
                    label: 'Choisir les polices',
                    description: 'Police de base, titres, code… par bloc',
                    icon: <Palette size={14} />,
                    action: () => { onOpenFontSelector(); setIsOpen(false); }
                }]
            });
        }

        // Section 10: Paramètres avancés
        const advancedItems: MenuItem[] = [];

        if (onOpenSettings) {
            advancedItems.push({
                id: 'settings',
                label: 'Paramètres avancés',
                description: 'Configuration détaillée du bloc',
                icon: <Settings size={14} />,
                action: () => { onOpenSettings(); setIsOpen(false); }
            });
        }

        if (blockType === 'computed') {
            advancedItems.push({
                id: 'info',
                label: 'Informations',
                description: 'Voir les détails techniques (segment, azimut, distance)',
                icon: <Info size={14} />,
                action: () => { /* TODO: ouvrir panel info */ setIsOpen(false); }
            });
        }

        if (advancedItems.length > 0) {
            sections.push({ title: 'Avancé', items: advancedItems });
        }

        // Section 11: Supprimer (toujours en dernier, dangereux)
        if (onDelete) {
            sections.push({
                items: [{
                    id: 'delete',
                    label: 'Supprimer',
                    description: 'Supprimer définitivement ce bloc',
                    icon: <Trash2 size={14} />,
                    action: () => { if (window.confirm('Supprimer ce bloc ?')) { onDelete(); setIsOpen(false); } },
                    dangerous: true,
                    shortcut: 'Suppr'
                }]
            });
        }

        return sections;
    }, [
        blockType, blockData, availableCiphers, onEdit, onDelete, onDuplicate,
        onConvertToCode, onConvertToHtml, onChangeCipher, onChangeLanguage,
        onTogglePOI, onToggleSolution, onLockToggle, onMoveUp, onMoveDown,
        onCopy, onLinkReference, onOpenFontSelector, onOpenSettings,
        isLocked, isSolutionView, hasSolution, navLanguage, pois,
        currentCipher, cipherMeta, cipherColor
    ]);

    // ─── Gestion ouverture/fermeture ──────────────────────────────────────
    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Empêcher le menu contextuel natif
        setIsOpen(!isOpen);
        setActiveSubmenu(null);
    };

    const closeMenu = () => {
        setIsOpen(false);
        setActiveSubmenu(null);
        onClose?.();
    };

    // Clic gauche sur les 3 points = ouvre le menu
    // Clic droit = menu natif du navigateur (on ne l'intercepte pas)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0) { // Clic gauche
            e.stopPropagation();
            e.preventDefault();
            toggleMenu(e);
        }
        // Clic droit (button === 2) : laisser le menu natif du navigateur
    };

    // Clic extérieur pour fermer
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                closeMenu();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // ─── Rendu ────────────────────────────────────────────────────────────
    const triggerButton = (
        <button
            ref={triggerButtonRef}
            type="button"
            onClick={toggleMenu}
            title="Options du bloc (clic pour ouvrir)"
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: '20px', height: '20px',
                border: 'none', background: isOpen ? 'var(--bg-hover)' : 'transparent',
                color: isOpen ? 'var(--accent-hover)' : 'var(--text-dim)',
                cursor: 'pointer', padding: 0,
                opacity: isOpen ? 1 : (isHovered ? 0.9 : 0.2),
                transition: 'opacity 150ms ease, color 120ms ease, background 120ms ease',
                borderRadius: '4px',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={e => {
                e.currentTarget.style.color = isOpen ? 'var(--accent-hover)' : 'var(--text-dim)';
                e.currentTarget.style.opacity = isOpen ? '1' : (isHovered ? '0.9' : '0.2');
            }}
        >
            <MoreVertical size={14} strokeWidth={2.2} />
        </button>
    );

    // Positionnement du menu
    let menuStyle: React.CSSProperties = {
        position: 'fixed',
        zIndex: 9999,
        pointerEvents: 'auto',
    };

    if (anchorPosition) {
        menuStyle.left = Math.max(12, Math.min(window.innerWidth - 300, anchorPosition.x));
        menuStyle.top = Math.max(12, Math.min(window.innerHeight - 420, anchorPosition.y));
    } else if (triggerButtonRef.current) {
        const rect = triggerButtonRef.current.getBoundingClientRect();
        let left = rect.right + 6;
        if (left + 280 > window.innerWidth) {
            left = Math.max(12, rect.left - 280);
        }
        let top = rect.top - 4;
        if (top + 420 > window.innerHeight) {
            top = Math.max(12, window.innerHeight - 430);
        }
        menuStyle.left = left;
        menuStyle.top = top;
    }

    // Rendu du menu (principal ou sous-menu)
    const renderMenu = (sections: MenuSection[], isSubmenu = false, parentId = '') => {
        if (activeSubmenu && !isSubmenu) {
            // Afficher le sous-menu actif
            if (activeSubmenu === 'cipher_picker') {
                return renderCipherPicker();
            }
            const section = sections.find(s => s.items.some(i => i.id === activeSubmenu));
            const item = section?.items.find(i => i.id === activeSubmenu);
            if (item?.submenu) {
                return renderMenu([item.submenu], true, activeSubmenu);
            }
        }

        return (
            <div
                ref={menuRef}
                style={menuStyle}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
            >
                <div style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '10px',
                    boxShadow: 'var(--shadow-lg)',
                    minWidth: '260px',
                    maxWidth: '340px',
                    maxHeight: '450px',
                    overflowY: 'auto',
                    animation: 'islandPopoverIn 120ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                    {isSubmenu && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
                            background: 'var(--bg-hover)'
                        }}>
                            <button
                                type="button"
                                onClick={() => setActiveSubmenu(null)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                            >
                                <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
                            </button>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {sections[0].title || 'Options'}
                            </span>
                        </div>
                    )}

                    {sections.map((section, si) => (
                        <React.Fragment key={si}>
                            {section.title && !isSubmenu && (
                                <div style={{ padding: '6px 12px 2px', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                    {section.title}
                                </div>
                            )}
                            {section.items.map((item, ii) => {
                                if (!item.icon && item.dividerAfter) {
                                    return <div key={`${parentId}_div_${ii}`} style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />;
                                }
                                return (
                                    <button
                                        key={`${parentId}_${item.id}`}
                                        type="button"
                                        onClick={item.action}
                                        disabled={item.disabled}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            width: '100%', padding: '8px 12px',
                                            border: 'none', background: 'transparent',
                                            color: item.dangerous ? '#ef4444' : (item.disabled ? 'var(--text-dim)' : 'var(--text-primary)'),
                                            fontSize: '12px', fontWeight: item.checked ? 600 : 400,
                                            textAlign: 'left', cursor: item.disabled ? 'not-allowed' : 'pointer',
                                            transition: 'background 80ms ease',
                                        }}
                                        onMouseEnter={e => { if (!item.disabled && !item.dangerous) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                        onMouseLeave={e => { if (!item.disabled) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', flexShrink: 0, color: item.dangerous ? '#ef4444' : 'var(--accent-hover)' }}>
                                            {item.icon}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                            {item.description && <span style={{ fontSize: '10px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</span>}
                                        </div>
                                        {item.shortcut && <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginLeft: '8px' }}>{item.shortcut}</span>}
                                        {item.checked && !item.submenu && <Check size={12} color="var(--accent-hover)" strokeWidth={2.5} />}
                                        {item.submenu && <ChevronDown size={12} color="var(--text-dim)" />}
                                    </button>
                                );
                            })}
                            {section.dividerAfter && <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />}
                        </React.Fragment>
                    ))}
                </div>
            </div>
        );
    };

    // ─── Rendu du sélecteur de chiffrement (sous-menu spécial) ─────────────
    const renderCipherPicker = () => (
        <div
            ref={menuRef}
            style={menuStyle}
            onMouseDown={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
        >
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '280px',
                maxWidth: '360px',
                maxHeight: '450px',
                overflowY: 'auto',
                animation: 'islandPopoverIn 120ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-hover)'
                }}>
                    <button
                        type="button"
                        onClick={() => setActiveSubmenu(null)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}
                    >
                        <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
                    </button>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Choisir le chiffrement
                    </span>
                    {currentCipher && (
                        <span style={{
                            marginLeft: 'auto',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: `${cipherColor}20`,
                            color: cipherColor,
                            fontWeight: 600,
                            fontFamily: cipherFont,
                            fontSize: cipherFontSize || '10px',
                        }}>
                            Actuel: {MODULE_META[currentCipher]?.label || currentCipher}
                        </span>
                    )}
                </div>

                <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '6px' }}>
                    {TEXTUAL_CIPHERS.map(cipherId => {
                        const m = MODULE_META[cipherId];
                        const isCurrent = cipherId === currentCipher;
                        const font = CIPHER_FONTS[cipherId] || 'monospace';
                        const size = CIPHER_FONT_SIZES[cipherId] || '14px';
                        const icon = CIPHER_ICONS[cipherId] || <Type size={14} />;

                        return (
                            <button
                                key={cipherId}
                                type="button"
                                onClick={() => {
                                    onChangeCipher?.(cipherId as ModuleId);
                                    setIsOpen(false);
                                    setActiveSubmenu(null);
                                }}
                                disabled={isCurrent}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                    padding: '10px', borderRadius: '8px',
                                    cursor: isCurrent ? 'not-allowed' : 'pointer',
                                    textAlign: 'left',
                                    border: `2px solid ${isCurrent ? m?.color || 'var(--accent-default)' : 'var(--border-subtle)'}`,
                                    background: isCurrent ? `${m?.color || 'var(--accent-default)'}15` : 'var(--bg-surface)',
                                    transition: 'all 0.12s ease',
                                    boxSizing: 'border-box',
                                    opacity: isCurrent ? 1 : 0.9,
                                }}
                                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{
                                            width: '10px', height: '10px', borderRadius: '50%',
                                            background: m?.color || '#6b7280',
                                            boxShadow: '0 0 0 2px var(--bg-elevated)'
                                        }} />
                                        <span style={{
                                            fontSize: '12px', fontWeight: 700,
                                            color: isCurrent ? m?.color || 'var(--accent-hover)' : 'var(--text-primary)'
                                        }}>
                                            {m?.label || cipherId}
                                        </span>
                                    </div>
                                    {isCurrent && <Check size={12} color={m?.color || 'var(--accent-hover)'} strokeWidth={2.8} />}
                                </div>
                                <div style={{
                                    color: 'var(--text-dim)', lineHeight: 1.2,
                                    fontFamily: font, fontSize: size,
                                }}>
                                    {m?.description || ''}
                                </div>
                                <div style={{
                                    marginTop: '6px', paddingTop: '6px',
                                    borderTop: '1px solid var(--border-subtle)',
                                    fontFamily: font, fontSize: size, color: m?.color || '#6b7280',
                                    width: '100%', textAlign: 'center'
                                }}>
                                    {/* Aperçu du chiffrement */}
                                    {getCipherPreview(cipherId)}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    // ─── Aperçu du chiffrement pour le sélecteur ──────────────────────────
    const getCipherPreview = (cipherId: string) => {
        const previews: Record<string, string> = {
            morse: '• − • −   − • −',
            vigenere: 'K P Q X',
            polybe: '34 25 11',
            templier: '⟐ ⟒ ⟑',
            maritime: '🏁 ⚓ 🚩',
            avocat: 'K L M N',
            cassis: 'Q R S T',
            texte_clair: 'Texte clair',
        };
        return previews[cipherId] || '';
    };

    return (
        <div
            className="unified-context-menu-wrapper"
            style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {triggerButton}
            {isOpen && renderMenu(menuSections)}
        </div>
    );
}

// Re-export pour utilisation dans d'autres composants
export { CIPHER_ICONS, CIPHER_FONTS, CIPHER_FONT_SIZES };
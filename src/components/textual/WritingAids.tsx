/**
 * WritingAids.tsx — Aides à l'écriture pour l'éditeur Markdown
 * - Auto-complétion markdown (**, *, _, ~, `, ```)
 * - Suggestions de commandes slash (/)
 * - Panel de codes de chiffrement quand on tape [morse], [code], etc.
 * - Raccourcis clavier
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Type, Code2, Hash, Heading1, Heading2, Heading3,
    List, Quote, Bold, Italic, Strikethrough, Underline,
    Link as LinkIcon, Image, Minus, CheckSquare,
    Zap, Lock, Key, ChevronRight, ChevronDown, X, Sigma
} from 'lucide-react';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import type { ModuleId } from '../../logic/types';

interface WritingAidsProps {
    /** Texte actuel dans l'éditeur */
    value: string;
    /** Position du curseur (index dans le texte) */
    cursorPosition: number;
    /** Callback quand on insère une suggestion */
    onInsert: (text: string, replaceRange?: { start: number; end: number }) => void;
    /** Callback pour fermer le panel */
    onClose?: () => void;
    /** Modules de chiffrement disponibles */
    availableCiphers?: ModuleId[];
    /** Éléments référençables (étapes, pages, POI, etc.) */
    references?: Array<{ id: string; label: string; type: string; icon: React.ReactNode }>;
}

interface Suggestion {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    insertText: string;
    /** Si true, replace la sélection au lieu d'insérer au curseur */
    replaceSelection?: boolean;
    /** Position du curseur après insertion (offset relatif à insertText) */
    cursorOffset?: number;
    category: 'markdown' | 'cipher' | 'slash' | 'reference' | 'shortcut';
    keywords: string[];
}

// ─── Aides Markdown de base ──────────────────────────────────────────────
const MARKDOWN_AIDS: Suggestion[] = [
    { id: 'bold', label: 'Gras', description: 'Texte en **gras**', icon: <Bold size={14} />, insertText: '******', cursorOffset: 2, category: 'markdown', keywords: ['bold', 'gras', '**', 'strong'] },
    { id: 'italic', label: 'Italique', description: 'Texte en *italique*', icon: <Italic size={14} />, insertText: '**', cursorOffset: 1, category: 'markdown', keywords: ['italic', 'italique', '*', 'em'] },
    { id: 'underline', label: 'Souligné', description: 'Texte <u>souligné</u> (HTML)', icon: <Underline size={14} />, insertText: '<u></u>', cursorOffset: 3, category: 'markdown', keywords: ['underline', 'souligné', 'u'] },
    { id: 'strikethrough', label: 'Barré', description: 'Texte ~~barré~~', icon: <Strikethrough size={14} />, insertText: '~~~~', cursorOffset: 2, category: 'markdown', keywords: ['strike', 'barré', '~~', 'del'] },
    { id: 'code_inline', label: 'Code inline', description: '`code` en ligne', icon: <Code2 size={14} />, insertText: '``', cursorOffset: 1, category: 'markdown', keywords: ['code', 'inline', '`', 'backtick'] },
    { id: 'code_block', label: 'Bloc de code', description: 'Bloc ```code``` multiligne', icon: <Type size={14} />, insertText: '\n```\n\n```\n', cursorOffset: 4, category: 'markdown', keywords: ['code', 'block', '```', 'snippet'] },
    { id: 'h1', label: 'Titre 1', description: '# Titre principal', icon: <Heading1 size={14} />, insertText: '# ', category: 'markdown', keywords: ['h1', 'titre', 'heading', '#'] },
    { id: 'h2', label: 'Titre 2', description: '## Titre de section', icon: <Heading2 size={14} />, insertText: '## ', category: 'markdown', keywords: ['h2', 'titre', '##'] },
    { id: 'h3', label: 'Titre 3', description: '### Sous-titre', icon: <Heading3 size={14} />, insertText: '### ', category: 'markdown', keywords: ['h3', 'titre', '###'] },
    { id: 'quote', label: 'Citation', description: '> Bloc de citation', icon: <Quote size={14} />, insertText: '> ', category: 'markdown', keywords: ['quote', 'citation', '>', 'blockquote'] },
    { id: 'bullet', label: 'Liste à puces', description: '- Élément de liste', icon: <List size={14} />, insertText: '- ', category: 'markdown', keywords: ['bullet', 'liste', 'puce', '-', 'ul'] },
    { id: 'numbered', label: 'Liste numérotée', description: '1. Élément numéroté', icon: <Hash size={14} />, insertText: '1. ', category: 'markdown', keywords: ['number', 'numéro', '1.', 'ol'] },
    { id: 'checklist', label: 'Liste de tâches', description: '- [ ] Tâche à faire', icon: <CheckSquare size={14} />, insertText: '- [ ] ', category: 'markdown', keywords: ['todo', 'check', 'tâche', '[ ]'] },
    { id: 'link', label: 'Lien', description: '[texte](url)', icon: <LinkIcon size={14} />, insertText: '[]()', cursorOffset: 1, category: 'markdown', keywords: ['link', 'lien', 'url', '[]'] },
    { id: 'image', label: 'Image', description: '![alt](url)', icon: <Image size={14} />, insertText: '![]()', cursorOffset: 2, category: 'markdown', keywords: ['image', 'img', 'photo', '![]'] },
    { id: 'hr', label: 'Séparateur', description: '--- ligne horizontale', icon: <Minus size={14} />, insertText: '\n---\n', category: 'markdown', keywords: ['hr', 'ligne', 'séparateur', '---'] },
    { id: 'latex_inline', label: 'Formule inline', description: '$E=mc^2$', icon: <Sigma size={14} />, insertText: '$$', cursorOffset: 1, category: 'markdown', keywords: ['latex', 'math', 'formule', '$'] },
    { id: 'latex_block', label: 'Formule bloc', description: '$$\\int x dx$$ (centrée)', icon: <Sigma size={14} />, insertText: '\n$$\n\n$$\n', cursorOffset: 4, category: 'markdown', keywords: ['latex', 'math', 'formule', '$$', 'block'] },
];

// ─── Raccourcis clavier ──────────────────────────────────────────────────
const KEYBOARD_SHORTCUTS: Array<{ keys: string; description: string; action: string }> = [
    { keys: 'Ctrl+B', description: 'Gras', action: '**texte**' },
    { keys: 'Ctrl+I', description: 'Italique', action: '*texte*' },
    { keys: 'Ctrl+Shift+X', description: 'Barré', action: '~~texte~~' },
    { keys: 'Ctrl+U', description: 'Souligné', action: '<u>texte</u>' },
    { keys: 'Ctrl+E', description: 'Code inline', action: '`code`' },
    { keys: 'Ctrl+Shift+C', description: 'Bloc de code', action: '```\ncode\n```' },
    { keys: 'Ctrl+K', description: 'Insérer lien', action: '[texte](url)' },
    { keys: 'Ctrl+Shift+K', description: 'Insérer image', action: '![alt](url)' },
    { keys: 'Ctrl+Shift+7', description: 'Liste à puces', action: '- item' },
    { keys: 'Ctrl+Shift+8', description: 'Liste numérotée', action: '1. item' },
    { keys: 'Ctrl+Shift+9', description: 'Liste de tâches', action: '- [ ] item' },
    { keys: 'Ctrl+>', description: 'Citation', action: '> citation' },
    { keys: 'Ctrl+/', description: 'Ouvrir commandes /', action: 'Palette slash' },
];

// ─── Détection du contexte pour suggestions automatiques ─────────────────
function getContextualSuggestions(
    value: string,
    cursorPosition: number,
    availableCiphers: ModuleId[] = [],
    references: WritingAidsProps['references'] = []
): Suggestion[] {
    const suggestions: Suggestion[] = [];
    const textBeforeCursor = value.slice(0, cursorPosition);
    const textAfterCursor = value.slice(cursorPosition);

    // 1. Détection commande slash /
    const slashMatch = textBeforeCursor.match(/\/([a-zà-ÿ0-9_-]*)$/i);
    if (slashMatch) {
        const query = slashMatch[1].toLowerCase();
        // Suggestions pour commandes slash
        const slashSuggestions: Suggestion[] = [
            { id: 'slash_h1', label: '/h1 ou /titre 1', description: 'Titre niveau 1', icon: <Heading1 size={14} />, insertText: '# ', category: 'slash', keywords: ['h1', 'titre', '1'] },
            { id: 'slash_h2', label: '/h2 ou /titre 2', description: 'Titre niveau 2', icon: <Heading2 size={14} />, insertText: '## ', category: 'slash', keywords: ['h2', 'titre', '2'] },
            { id: 'slash_h3', label: '/h3 ou /titre 3', description: 'Titre niveau 3', icon: <Heading3 size={14} />, insertText: '### ', category: 'slash', keywords: ['h3', 'titre', '3'] },
            { id: 'slash_code', label: '/code', description: 'Bloc de code', icon: <Code2 size={14} />, insertText: '\n```\n\n```\n', cursorOffset: 4, category: 'slash', keywords: ['code', 'block'] },
            { id: 'slash_quote', label: '/quote', description: 'Citation', icon: <Quote size={14} />, insertText: '> ', category: 'slash', keywords: ['quote', 'citation'] },
            { id: 'slash_list', label: '/list ou /liste', description: 'Liste à puces', icon: <List size={14} />, insertText: '- ', category: 'slash', keywords: ['list', 'liste', 'puce'] },
            { id: 'slash_check', label: '/check ou /todo', description: 'Liste de tâches', icon: <CheckSquare size={14} />, insertText: '- [ ] ', category: 'slash', keywords: ['check', 'todo', 'tâche'] },
            { id: 'slash_hr', label: '/hr ou /ligne', description: 'Séparateur horizontal', icon: <Minus size={14} />, insertText: '\n---\n', category: 'slash', keywords: ['hr', 'ligne', 'séparateur'] },
            { id: 'slash_latex', label: '/latex ou /math', description: 'Formule LaTeX', icon: <Sigma size={14} />, insertText: '$$', cursorOffset: 1, category: 'slash', keywords: ['latex', 'math', 'formule'] },
        ];

        // Ajouter les codes de chiffrement
        availableCiphers.forEach(cipherId => {
            const meta = MODULE_META[cipherId];
            if (meta && ['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis', 'texte_clair'].includes(cipherId)) {
                slashSuggestions.push({
                    id: `slash_cipher_${cipherId}`,
                    label: `/${cipherId} ou /${meta.label.toLowerCase()}`,
                    description: `Bloc chiffré ${meta.label} — ${meta.description}`,
                    icon: <Lock size={14} />,
                    insertText: `[${cipherId}]\n\n[/${cipherId}]`,
                    cursorOffset: cipherId.length + 2,
                    category: 'cipher',
                    keywords: [cipherId, meta.label.toLowerCase(), 'chiffre', 'code', 'encrypt']
                });
            }
        });

        // Ajouter les références
        references?.forEach(ref => {
            slashSuggestions.push({
                id: `slash_ref_${ref.id}`,
                label: `/${ref.type} ${ref.label}`,
                description: `Référence à ${ref.type}: ${ref.label}`,
                icon: ref.icon,
                insertText: `[@${ref.type}:${ref.id}]`,
                category: 'reference',
                keywords: [ref.type, ref.label.toLowerCase(), 'ref', 'référence']
            });
        });

        return slashSuggestions.filter(s =>
            s.label.toLowerCase().includes(query) ||
            s.keywords.some(k => k.toLowerCase().includes(query))
        );
    }

    // 2. Détection balise de chiffrement ouverte [morse → suggère [/morse]
    const openCipherMatch = textBeforeCursor.match(/\[(morse|templier|maritime|polybe|vigenere|avocat|cassis|code)\]$/i);
    if (openCipherMatch) {
        const cipher = openCipherMatch[1].toLowerCase();
        return [{
            id: `close_${cipher}`,
            label: `Fermer [/${cipher}]`,
            description: `Terminer le bloc ${cipher}`,
            icon: <Lock size={14} />,
            insertText: `[/${cipher}]`,
            category: 'cipher',
            keywords: [cipher, 'fermer', 'close', '/']
        }];
    }

    // 3. Détection début de balise [ → suggère les codes disponibles
    const bracketMatch = textBeforeCursor.match(/\[([a-z]*)$/i);
    if (bracketMatch && bracketMatch[1].length > 0) {
        const query = bracketMatch[1].toLowerCase();
        const cipherSuggestions = availableCiphers
            .filter(id => ['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis', 'code'].includes(id))
            .map(cipherId => {
                const meta = MODULE_META[cipherId];
                return {
                    id: `cipher_${cipherId}`,
                    label: `[${cipherId}]`,
                    description: `${meta?.label || cipherId} — ${meta?.description || ''}`,
                    icon: <Key size={14} />,
                    insertText: `[${cipherId}]`,
                    category: 'cipher' as const,
                    keywords: [cipherId, meta?.label?.toLowerCase() || '', 'chiffre', 'encrypt']
                };
            })
            .filter(s => s.label.toLowerCase().includes(query) || s.keywords.some(k => k.toLowerCase().includes(query)));

        if (cipherSuggestions.length > 0) return cipherSuggestions;
    }

    // 4. Détection markdown syntax non fermée (**, *, __, _, ~~, `)
    const markdownPatterns = [
        { pattern: /\*\*([^*]*)$/, closing: '**', label: 'Fermer **gras**', id: 'close_bold' },
        { pattern: /(?<!\*)\*([^*]*)$/, closing: '*', label: 'Fermer *italique*', id: 'close_italic' },
        { pattern: /__([^_]*)$/, closing: '__', label: 'Fermer __gras__', id: 'close_bold_alt' },
        { pattern: /(?<!_)_([^_]*)$/, closing: '_', label: 'Fermer _italique_', id: 'close_italic_alt' },
        { pattern: /~~([^~]*)$/, closing: '~~', label: 'Fermer ~~barré~~', id: 'close_strike' },
        { pattern: /`([^`]*)$/, closing: '`', label: 'Fermer `code`', id: 'close_code' },
    ];

    for (const { pattern, closing, label, id } of markdownPatterns) {
        const match = textBeforeCursor.match(pattern);
        if (match && !textAfterCursor.startsWith(closing)) {
            return [{
                id,
                label,
                description: `Insérer ${closing} pour fermer`,
                icon: <ChevronRight size={14} />,
                insertText: closing,
                category: 'markdown',
                keywords: [closing, 'fermer', 'close']
            }];
        }
    }

    // 5. Sur ligne vide au début → suggestions de démarrage
    const isLineStart = /^$|^\n$|^\n\s*$/.test(textBeforeCursor.trimEnd());
    if (isLineStart) {
        return MARKDOWN_AIDS.slice(0, 10); // Top 10
    }

    return [];
}

export default function WritingAids({
    value,
    cursorPosition,
    onInsert,
    onClose,
    availableCiphers = [],
    references = []
}: WritingAidsProps) {
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<{ x: number; y: number } | null>(null);

    // Calculer suggestions basées sur le contexte
    const contextualSuggestions = useMemo(() =>
        getContextualSuggestions(value, cursorPosition, availableCiphers, references),
    [value, cursorPosition, availableCiphers, references]);

    // Afficher si suggestions contextuelles ou si utilisateur demande (Ctrl+/)
    useEffect(() => {
        const hasContextual = contextualSuggestions.length > 0;
        setSuggestions(hasContextual ? contextualSuggestions : MARKDOWN_AIDS.slice(0, 8));
        setSelectedIndex(0);
        setIsVisible(hasContextual || false);
    }, [contextualSuggestions]);

    // Gestion clavier
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isVisible) {
            // Ctrl+/ pour ouvrir la palette
            if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setSuggestions(MARKDOWN_AIDS);
                setIsVisible(true);
                setSelectedIndex(0);
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            setIsVisible(false);
            onClose?.();
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const sel = suggestions[selectedIndex];
            if (sel) {
                onInsert(sel.insertText, sel.replaceSelection ? { start: cursorPosition - sel.insertText.length, end: cursorPosition } : undefined);
                // Ajuster le curseur si cursorOffset défini
                if (sel.cursorOffset !== undefined) {
                    // Le parent devra gérer le déplacement du curseur
                }
                if (sel.category !== 'markdown') {
                    setIsVisible(false);
                    onClose?.();
                }
            }
        }
    }, [isVisible, suggestions, selectedIndex, cursorPosition, onInsert, onClose]);

    // Clic extérieur pour fermer
    useEffect(() => {
        if (!isVisible) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsVisible(false);
                onClose?.();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isVisible, onClose]);

    if (!isVisible || suggestions.length === 0) return null;

    // Positionnement près du curseur (approximatif)
    // Dans la pratique, le parent devrait passer la position exacte
    const style: React.CSSProperties = {
        position: 'fixed',
        zIndex: 9999,
        left: triggerRef.current?.x || 20,
        top: triggerRef.current?.y || 20,
        pointerEvents: 'auto',
    };

    return (
        <div
            ref={containerRef}
            style={style}
            onMouseDown={e => e.stopPropagation()}
            onKeyDown={handleKeyDown}
        >
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '280px',
                maxWidth: '420px',
                maxHeight: '350px',
                overflow: 'hidden',
                animation: 'islandPopoverIn 120ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                {/* Header avec catégorie */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)',
                    textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                    <Zap size={12} color="var(--accent-hover)" />
                    <span>Aides à l'écriture</span>
                    {contextualSuggestions.length > 0 && (
                        <span style={{
                            marginLeft: 'auto', background: 'var(--accent-transparent)',
                            color: 'var(--accent-hover)', padding: '2px 6px', borderRadius: '4px',
                            fontSize: '10px'
                        }}>
                            Contextuel
                        </span>
                    )}
                </div>

                {/* Liste des suggestions */}
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {suggestions.map((sug, idx) => (
                        <button
                            key={sug.id}
                            type="button"
                            onClick={() => {
                                onInsert(sug.insertText, sug.replaceSelection ? { start: cursorPosition - sug.insertText.length, end: cursorPosition } : undefined);
                                if (sug.category !== 'markdown') { setIsVisible(false); onClose?.(); }
                            }}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                width: '100%', padding: '8px 12px',
                                border: 'none', background: idx === selectedIndex ? 'var(--accent-transparent)' : 'transparent',
                                color: 'var(--text-primary)', fontSize: '12.5px',
                                fontWeight: idx === selectedIndex ? 600 : 400,
                                textAlign: 'left', cursor: 'pointer',
                                transition: 'background 80ms ease',
                            }}
                        >
                            <span style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '22px', height: '22px', color: 'var(--accent-hover)', flexShrink: 0
                            }}>
                                {sug.icon}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {sug.label}
                                </div>
                                <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {sug.description}
                                </div>
                            </div>
                            {sug.cursorOffset !== undefined && (
                                <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                    →{sug.cursorOffset}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Footer raccourcis */}
                <div style={{
                    padding: '8px 12px', borderTop: '1px solid var(--border-subtle)',
                    fontSize: '10.5px', color: 'var(--text-dim)',
                    display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center'
                }}>
                    {KEYBOARD_SHORTCUTS.slice(0, 6).map((sc, i) => (
                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <kbd style={{
                                background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
                                borderRadius: '3px', padding: '1px 5px', fontFamily: 'var(--font-mono)', fontSize: '9px'
                            }}>
                                {sc.keys}
                            </kbd>
                            <span>{sc.description}</span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
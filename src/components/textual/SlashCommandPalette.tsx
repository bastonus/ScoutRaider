/**
 * SlashCommandPalette.tsx — Palette de commandes slash (/)
 * Permet de rechercher et insérer tout type de bloc, référence, ou action.
 * Inclut /h1, /titre 1, /code, /chiffre, etc.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    Search, X, Type, Code2, Hash, Heading1, Heading2, Heading3,
    List, Quote, Divide, Image, FileText, Lock, Unlock,
    Eye, Sparkles, Zap, Link, ChevronDown, ChevronUp,
    CheckSquare, MapPin, Sigma, ListTodo
} from 'lucide-react';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import type { ModuleId } from '../../logic/types';

interface SlashCommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onInsertBlock: (blockType: string, config?: any) => void;
    onSearchReference: (query: string) => void;
    anchorRef: React.RefObject<HTMLDivElement>;
    triggerPosition?: { x: number; y: number } | null;
}

export default function SlashCommandPalette({
    isOpen,
    onClose,
    onInsertBlock,
    onSearchReference,
    anchorRef,
    triggerPosition
}: SlashCommandPaletteProps) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showAll, setShowAll] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // ─── Commandes disponibles ──────────────────────────────────────────────
    const allCommands = useMemo(() => {
        const commands: Array<{
            id: string;
            label: string;
            description: string;
            icon: React.ReactNode;
            category: 'block' | 'heading' | 'media' | 'code' | 'reference' | 'action';
            keywords: string[];
            action: () => void;
        }> = [];

        // --- Titres / Headings ---
        commands.push(
            { id: 'h1', label: 'Titre 1', description: 'Grand titre principal', icon: <Heading1 size={14} />, category: 'heading', keywords: ['titre', 'h1', 'heading', 'title', '#'], action: () => onInsertBlock('heading', { level: 1 }) },
            { id: 'h2', label: 'Titre 2', description: 'Titre de section', icon: <Heading2 size={14} />, category: 'heading', keywords: ['titre', 'h2', 'heading', '##'], action: () => onInsertBlock('heading', { level: 2 }) },
            { id: 'h3', label: 'Titre 3', description: 'Sous-titre', icon: <Heading3 size={14} />, category: 'heading', keywords: ['titre', 'h3', 'heading', '###'], action: () => onInsertBlock('heading', { level: 3 }) },
        );

        // --- Blocs de base ---
        commands.push(
            { id: 'paragraph', label: 'Paragraphe', description: 'Texte normal', icon: <Type size={14} />, category: 'block', keywords: ['para', 'texte', 'text', 'p'], action: () => onInsertBlock('paragraph') },
            { id: 'bullet', label: 'Liste à puces', description: 'Liste non ordonnée', icon: <List size={14} />, category: 'block', keywords: ['liste', 'bullet', 'puce', '-', '*'], action: () => onInsertBlock('bullet_list') },
            { id: 'numbered', label: 'Liste numérotée', description: 'Liste ordonnée', icon: <List size={14} />, category: 'block', keywords: ['liste', 'number', 'numéro', '1.', 'ol'], action: () => onInsertBlock('numbered_list') },
            { id: 'checklist', label: 'Liste de tâches', description: 'Cases à cocher', icon: <CheckSquare size={14} />, category: 'block', keywords: ['todo', 'check', 'tâche', 'case', '[ ]'], action: () => onInsertBlock('check_list') },
            { id: 'quote', label: 'Citation', description: 'Bloc de citation', icon: <Quote size={14} />, category: 'block', keywords: ['quote', 'citation', '>', 'blockquote'], action: () => onInsertBlock('blockquote') },
            { id: 'divider', label: 'Séparateur', description: 'Ligne horizontale', icon: <Divide size={14} />, category: 'block', keywords: ['hr', 'ligne', 'séparateur', '---'], action: () => onInsertBlock('divider') },
        );

        // --- Médias ---
        commands.push(
            { id: 'image', label: 'Image', description: 'Insérer une image', icon: <Image size={14} />, category: 'media', keywords: ['img', 'image', 'photo', 'picture'], action: () => onInsertBlock('image') },
            { id: 'file', label: 'Fichier', description: 'Joindre un fichier', icon: <FileText size={14} />, category: 'media', keywords: ['file', 'fichier', 'pièce', 'jointe', 'attach'], action: () => onInsertBlock('file') },
        );

        // --- Blocs de code / chiffrement ---
        const textualModules = ALL_MODULE_IDS.filter(id =>
            ['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis', 'texte_clair'].includes(id)
        );

        textualModules.forEach(modId => {
            const meta = MODULE_META[modId];
            commands.push({
                id: `code_${modId}`,
                label: `Code ${meta?.label || modId}`,
                description: meta?.description || `Bloc chiffré ${meta?.label}`,
                icon: <Code2 size={14} />,
                category: 'code',
                keywords: ['code', 'chiffre', 'encrypt', 'cipher', modId, meta?.label?.toLowerCase() || ''],
                action: () => onInsertBlock('crypto_block', { cipher: modId as ModuleId })
            });
        });

        // Bloc code générique
        commands.push({
            id: 'code_generic',
            label: 'Bloc de code (générique)',
            description: 'Bloc de code avec coloration syntaxique',
            icon: <Code2 size={14} />,
            category: 'code',
            keywords: ['code', 'snippet', '```', 'programmation'],
            action: () => onInsertBlock('code_block')
        });

        // --- Références / Recherche ---
        commands.push(
            { id: 'ref_step', label: 'Référer une étape', description: 'Insérer une référence à une étape du carnet', icon: <Link size={14} />, category: 'reference', keywords: ['ref', 'référence', 'étape', 'step', '@'], action: () => onSearchReference('step:') },
            { id: 'ref_page', label: 'Référer une page', description: 'Insérer un lien vers une page', icon: <FileText size={14} />, category: 'reference', keywords: ['page', 'lien', 'link', '#'], action: () => onSearchReference('page:') },
            { id: 'ref_poi', label: 'Référer un POI', description: 'Insérer un point d\'intérêt', icon: <MapPin size={14} />, category: 'reference', keywords: ['poi', 'point', 'intérêt', 'repère'], action: () => onSearchReference('poi:') },
        );

        // --- Actions ---
        commands.push(
            { id: 'annexe', label: 'Insérer annexe', description: 'Table de décodage (Morse, Polybe, etc.)', icon: <Sparkles size={14} />, category: 'action', keywords: ['annexe', 'table', 'décodage', 'alphabet'], action: () => onInsertBlock('annexe') },
            { id: 'formula', label: 'Formule LaTeX', description: 'Insérer une formule mathématique', icon: <Sigma size={14} />, category: 'action', keywords: ['latex', 'formule', 'math', '$', 'équation'], action: () => onInsertBlock('latex') },
            { id: 'toc', label: 'Table des matières', description: 'Générer une table des matières', icon: <ListTodo size={14} />, category: 'action', keywords: ['toc', 'sommaire', 'table', 'matières'], action: () => onInsertBlock('toc') },
        );

        return commands;
    }, [onInsertBlock, onSearchReference]);

    // ─── Filtrage ──────────────────────────────────────────────────────────
    const filteredCommands = useMemo(() => {
        if (!query.trim()) {
            return showAll ? allCommands : allCommands.slice(0, 8);
        }
        const q = query.toLowerCase().replace(/^\//, '');
        return allCommands.filter(cmd =>
            cmd.label.toLowerCase().includes(q) ||
            cmd.description.toLowerCase().includes(q) ||
            cmd.keywords.some(k => k.toLowerCase().includes(q)) ||
            cmd.id.toLowerCase().includes(q)
        );
    }, [query, allCommands, showAll]);

    // ─── Gestion clavier ──────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].action();
                    onClose();
                }
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                setShowAll(true);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // ─── Focus input à l'ouverture ────────────────────────────────────────
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
            setSelectedIndex(0);
            setShowAll(false);
        }
    }, [isOpen]);

    // ─── Clic extérieur pour fermer ───────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, anchorRef, onClose]);

    if (!isOpen) return null;

    // Positionnement
    const style: React.CSSProperties = {
        position: 'fixed',
        zIndex: 9999,
        pointerEvents: 'auto',
    };
    if (triggerPosition) {
        style.left = triggerPosition.x;
        style.top = triggerPosition.y;
    } else if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        style.left = rect.left;
        style.top = rect.bottom + 4;
    }

    return (
        <div
            ref={anchorRef}
            style={style}
            onMouseDown={e => e.stopPropagation()}
        >
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-xl)',
                minWidth: '320px',
                maxWidth: '480px',
                maxHeight: '500px',
                overflow: 'hidden',
                animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                {/* Search input */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <Search size={16} color="var(--text-dim)" style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }} />
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Tapez / pour chercher… (ex: /h1, /code, /morse)"
                            style={{
                                width: '100%',
                                padding: '8px 10px 8px 36px',
                                background: 'var(--bg-base)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                fontFamily: 'var(--font-ui)',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Escape') onClose();
                            }}
                            autoComplete="off"
                            spellCheck={false}
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-dim)',
                                    cursor: 'pointer',
                                    padding: '2px',
                                }}
                                aria-label="Effacer"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Results list */}
                <div ref={listRef} style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {filteredCommands.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                            Aucune commande trouvée pour « {query} »
                        </div>
                    ) : (
                        <>
                            {filteredCommands.map((cmd, idx) => (
                                <button
                                    key={cmd.id}
                                    type="button"
                                    onClick={() => { cmd.action(); onClose(); }}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        width: '100%',
                                        padding: '10px 12px',
                                        border: 'none',
                                        background: idx === selectedIndex ? 'var(--accent-transparent)' : 'transparent',
                                        color: 'var(--text-primary)',
                                        fontSize: '13px',
                                        fontWeight: idx === selectedIndex ? 600 : 400,
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'background 80ms ease',
                                        boxSizing: 'border-box',
                                    }}
                                >
                                    <span style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '24px', height: '24px', color: 'var(--accent-hover)', flexShrink: 0
                                    }}>
                                        {cmd.icon}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cmd.label}
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {cmd.description}
                                        </div>
                                    </div>
                                    <span style={{
                                        fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)',
                                        textTransform: 'uppercase', letterSpacing: '0.05em',
                                        background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px'
                                    }}>
                                        {cmd.category}
                                    </span>
                                </button>
                            ))}

                            {!showAll && filteredCommands.length < allCommands.length && (
                                <button
                                    type="button"
                                    onClick={() => setShowAll(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '100%', padding: '8px 12px',
                                        border: 'none', background: 'transparent',
                                        color: 'var(--accent-hover)', fontSize: '12px',
                                        fontWeight: 600, cursor: 'pointer',
                                    }}
                                >
                                    <ChevronDown size={14} />
                                    <span>Afficher tout ({allCommands.length} commandes)</span>
                                </button>
                            )}
                            {showAll && (
                                <button
                                    type="button"
                                    onClick={() => setShowAll(false)}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '100%', padding: '8px 12px',
                                        border: 'none', background: 'transparent',
                                        color: 'var(--text-dim)', fontSize: '12px',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <ChevronUp size={14} />
                                    <span>Réduire</span>
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Footer hint */}
                <div style={{
                    padding: '8px 12px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '11px',
                    color: 'var(--text-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                    <kbd style={{
                        background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
                        borderRadius: '4px', padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: '10px'
                    }}>
                        ↑ ↓
                    </kbd>
                    <span>Naviguer</span>
                    <kbd style={{
                        background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
                        borderRadius: '4px', padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: '10px'
                    }}>
                        Entrée
                    </kbd>
                    <span>Sélectionner</span>
                    <kbd style={{
                        background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)',
                        borderRadius: '4px', padding: '1px 6px', fontFamily: 'var(--font-mono)', fontSize: '10px'
                    }}>
                        Échap
                    </kbd>
                    <span>Fermer</span>
                </div>
            </div>
        </div>
    );
}


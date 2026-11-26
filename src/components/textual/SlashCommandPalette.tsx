/**
 * SlashCommandPalette.tsx — Palette de commandes slash (/) style Notion/Antigravity.
 * - Flotte juste sous la ligne courante du curseur dans le textarea.
 * - Le textarea GARDE le focus et les frappes après "/" filtrent la liste via event.
 * - Pas de champ de recherche dans la palette : c'est la zone de texte qui est l'input.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    Type, Code2, Heading1, Heading2, Heading3,
    List, ListOrdered, Quote, Minus, Image, FileText,
    Sparkles, Link, CheckSquare, MapPin, Sigma, ListTodo,
    Flag, Map as MapIcon, Mountain, Compass, KeyRound
} from 'lucide-react';
import { filterEditorCommands, type EditorCommandDef } from './editorCommands';

function getCommandIcon(cmd: EditorCommandDef): React.ReactNode {
    switch (cmd.id) {
        case 'paragraph':      return <Type size={14} />;
        case 'h1':             return <Heading1 size={14} />;
        case 'h2':             return <Heading2 size={14} />;
        case 'h3':             return <Heading3 size={14} />;
        case 'bullet':         return <List size={14} />;
        case 'numbered':       return <ListOrdered size={14} />;
        case 'checklist':      return <CheckSquare size={14} />;
        case 'quote':          return <Quote size={14} />;
        case 'divider':        return <Minus size={14} />;
        case 'formula':        return <Sigma size={14} />;
        case 'code_generic':   return <Code2 size={14} />;
        case 'raid_step':      return <Flag size={14} />;
        case 'raid_map':       return <MapIcon size={14} />;
        case 'raid_guided':    return <Compass size={14} />;
        case 'raid_elevation': return <Mountain size={14} />;
        case 'image':          return <Image size={14} />;
        case 'file':           return <FileText size={14} />;
        case 'toc':            return <ListTodo size={14} />;
        case 'annexe':         return <Sparkles size={14} />;
        case 'ref_step':       return <Link size={14} />;
        case 'ref_poi':        return <MapPin size={14} />;
        default:
            if (cmd.group === 'Chiffrement') return <KeyRound size={14} />;
            return <Code2 size={14} />;
    }
}

interface SlashCommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onInsertBlock: (blockType: string, config?: any) => void;
    onSearchReference: (query: string) => void;
    anchorRef: React.RefObject<HTMLDivElement>;
    triggerPosition?: { x: number; y: number } | null;
    initialQuery?: string;
}

export default function SlashCommandPalette({
    isOpen,
    onClose,
    onInsertBlock,
    onSearchReference,
    anchorRef,
    triggerPosition,
    initialQuery = ''
}: SlashCommandPaletteProps) {
    const [query, setQuery] = useState(initialQuery);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

    useEffect(() => {
        if (isOpen) {
            window.dispatchEvent(new CustomEvent('textual:close-menus', { detail: { except: 'slash-palette' } }));
            setQuery(initialQuery);
            setSelectedIndex(0);
        }
    }, [isOpen, initialQuery]);

    // Écouter les mises à jour de la query envoyées par le textarea actif (frappe après "/")
    useEffect(() => {
        if (!isOpen) return;
        const onQueryUpdate = (e: Event) => {
            const { query: q } = (e as CustomEvent<{ query: string | null }>).detail;
            if (q === null) {
                // Le "/" a été effacé → fermer la palette
                onClose();
            } else {
                setQuery(q);
            }
        };
        window.addEventListener('textual:slash-query', onQueryUpdate);
        return () => window.removeEventListener('textual:slash-query', onQueryUpdate);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const onCloseOthers = (e: Event) => {
            if ((e as CustomEvent).detail?.except !== 'slash-palette') onClose();
        };
        window.addEventListener('textual:close-menus', onCloseOthers);
        return () => window.removeEventListener('textual:close-menus', onCloseOthers);
    }, [isOpen, onClose]);

    const GROUP_ORDER: Record<string, number> = { Chiffrement: 0, Raid: 1, Texte: 2, Avancé: 3 };
    const GROUP_LABELS: Record<string, string> = {
        Chiffrement: 'Chiffrement',
        Raid: 'Raid & Itinéraire',
        Texte: 'Texte',
        Avancé: 'Avancé',
    };

    const rawFiltered = useMemo(() => filterEditorCommands(query), [query]);

    const { orderedCommands, groupedCommands } = useMemo(() => {
        const sorted = [...rawFiltered].sort(
            (a, b) => (GROUP_ORDER[a.group] ?? 9) - (GROUP_ORDER[b.group] ?? 9)
        );
        const groups: Array<{
            name: string;
            label: string;
            items: Array<{ cmd: EditorCommandDef; flatIdx: number }>;
        }> = [];
        const groupMap = new Map<string, Array<{ cmd: EditorCommandDef; flatIdx: number }>>();

        sorted.forEach((cmd, idx) => {
            if (!groupMap.has(cmd.group)) {
                const arr: Array<{ cmd: EditorCommandDef; flatIdx: number }> = [];
                groupMap.set(cmd.group, arr);
                groups.push({ name: cmd.group, label: GROUP_LABELS[cmd.group] || cmd.group, items: arr });
            }
            groupMap.get(cmd.group)!.push({ cmd, flatIdx: idx });
        });

        return { orderedCommands: sorted, groupedCommands: groups };
    }, [rawFiltered]);

    const filteredCommands = orderedCommands;

    useEffect(() => { setSelectedIndex(0); }, [query]);

    useEffect(() => {
        const el = itemRefs.current.get(selectedIndex);
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const executeCommand = (cmd: EditorCommandDef) => {
        if (cmd.blockType === 'ref_step') {
            onSearchReference('step:');
        } else if (cmd.blockType === 'ref_poi') {
            onSearchReference('poi:');
        } else {
            onInsertBlock(cmd.blockType, cmd.config);
        }
        onClose();
    };

    // ─── Navigation clavier — le textarea garde le focus ────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(i => filteredCommands.length > 0 ? (i + 1) % filteredCommands.length : 0);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(i => filteredCommands.length > 0 ? (i - 1 + filteredCommands.length) % filteredCommands.length : 0);
                return;
            }
            if (e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex(i => filteredCommands.length > 0
                    ? e.shiftKey
                        ? (i - 1 + filteredCommands.length) % filteredCommands.length
                        : (i + 1) % filteredCommands.length
                    : 0);
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                if (filteredCommands[selectedIndex]) {
                    executeCommand(filteredCommands[selectedIndex]);
                }
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // ─── Fermeture au clic en dehors ─────────────────────────────────────────
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

    if (!isOpen || typeof document === 'undefined') return null;

    // ─── Positionnement : juste sous la ligne du curseur ─────────────────────
    const menuWidth = 290;
    const menuMaxHeight = 320;
    let left = 24;
    let top = 80;
    let flippedAbove = false;

    if (triggerPosition) {
        left = triggerPosition.x;
        top = triggerPosition.y;
    } else if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        left = rect.left;
        top = rect.bottom + 4;
    }

    if (typeof window !== 'undefined') {
        left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));
        if (top + menuMaxHeight > window.innerHeight - 12) {
            top = Math.max(8, top - menuMaxHeight - 8);
            flippedAbove = true;
        }
    }

    return createPortal(
        <div
            ref={anchorRef}
            role="menu"
            aria-label="Insérer un bloc"
            style={{ position: 'fixed', left, top, zIndex: 99999, pointerEvents: 'auto' }}
            // NE PAS voler le focus du textarea
            onMouseDown={e => e.preventDefault()}
        >
            <div style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                width: `${menuWidth}px`,
                maxHeight: `${menuMaxHeight}px`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transformOrigin: flippedAbove ? 'bottom left' : 'top left',
                animation: 'islandPopoverIn 110ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                {/* Liste filtrée — pas de champ de recherche ici, le textarea est l'input */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    overscrollBehavior: 'contain',
                    padding: '4px 4px',
                }}>
                    {filteredCommands.length === 0 ? (
                        <div style={{
                            padding: '14px 12px',
                            textAlign: 'center',
                            color: 'var(--text-dim)',
                            fontSize: '12.5px',
                        }}>
                            Aucun résultat
                        </div>
                    ) : (
                        groupedCommands.map((group, gIdx) => (
                            <div key={group.name} role="group" aria-label={group.label}
                                style={{ marginTop: gIdx > 0 ? '4px' : 0 }}>
                                <div style={{
                                    padding: '5px 10px 2px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em',
                                    color: group.name === 'Chiffrement'
                                        ? 'var(--accent-hover)'
                                        : 'var(--text-dim)',
                                }}>
                                    {group.label}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    {group.items.map(({ cmd, flatIdx }) => {
                                        const isSel = flatIdx === selectedIndex;
                                        return (
                                            <button
                                                key={cmd.id}
                                                role="menuitem"
                                                aria-selected={isSel}
                                                ref={el => { if (el) itemRefs.current.set(flatIdx, el); else itemRefs.current.delete(flatIdx); }}
                                                type="button"
                                                onClick={() => executeCommand(cmd)}
                                                onMouseEnter={() => setSelectedIndex(flatIdx)}
                                                onMouseDown={e => e.preventDefault()}
                                                title={cmd.description}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    width: '100%',
                                                    padding: '5px 8px',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    background: isSel ? 'var(--bg-hover)' : 'transparent',
                                                    color: isSel ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                    fontSize: '13px',
                                                    fontWeight: isSel ? 500 : 400,
                                                    textAlign: 'left',
                                                    cursor: 'pointer',
                                                    transition: 'background 40ms',
                                                    boxSizing: 'border-box',
                                                    outline: isSel ? '1.5px solid var(--accent-default)' : 'none',
                                                    outlineOffset: '-1.5px',
                                                }}
                                            >
                                                {/* Icône */}
                                                <span style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '22px', height: '22px', borderRadius: '5px',
                                                    flexShrink: 0,
                                                    background: 'var(--bg-surface)',
                                                    color: isSel && group.name === 'Chiffrement'
                                                        ? 'var(--accent-hover)'
                                                        : isSel ? 'var(--text-primary)' : 'var(--text-dim)',
                                                }}>
                                                    {getCommandIcon(cmd)}
                                                </span>
                                                {/* Label */}
                                                <span style={{
                                                    flex: 1, minWidth: 0,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                }}>
                                                    {cmd.label}
                                                </span>
                                                {/* Shortcut */}
                                                {cmd.shortcut && (
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontFamily: 'var(--font-mono)',
                                                        color: 'var(--text-dim)',
                                                        flexShrink: 0,
                                                        opacity: 0.65,
                                                    }}>
                                                        {cmd.shortcut}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pied minimaliste */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: '8px', padding: '3px 10px',
                    borderTop: '1px solid var(--border-subtle)',
                }}>
                    {([['↑↓', 'Naviguer'], ['↵', 'Choisir'], ['Échap', 'Fermer']] as [string, string][]).map(([key, label]) => (
                        <span key={key} style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            fontSize: '11px', color: 'var(--text-dim)',
                        }}>
                            <kbd style={{
                                fontFamily: 'var(--font-mono)', fontSize: '10px',
                                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                                borderRadius: '3px', padding: '1px 4px',
                            }}>{key}</kbd>
                            <span style={{ opacity: 0.5 }}>{label}</span>
                        </span>
                    ))}
                </div>
            </div>
        </div>,
        document.body
    );
}

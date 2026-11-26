/**
 * SelectionBubble.tsx — Menu contextuel affiché dès qu'un texte est sélectionné.
 * Ordre de priorité (inspiré de la capture Notion) :
 *  1. Code / Chiffrement (codes standards & avancés)
 *  2. Type de texte (Texte, Titre 1/2/3, Listes, Citation)
 *  3. Contrôles de mise en forme (Couleur, B, I, U, </>, Lien)
 */
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Bold, Italic, Underline, Code, Link, Type, Lock, ChevronRight,
    Compass, Palette, RefreshCw, Unlink, RotateCcw, SlidersHorizontal, AlignLeft, Check
} from 'lucide-react';
import { getTransformableCommands, getCryptoCommands, type EditorCommandDef } from './editorCommands';
import { themeManager } from '../../logic/ThemeManager';
import type { ModuleId, NavLanguage } from '../../logic/types';

export type InlineFormatAction = 'bold' | 'italic' | 'underline' | 'code' | 'link';

export interface SelectionBlockContext {
    isComputed?: boolean;
    moduleId?: ModuleId;
    isEdited?: boolean;
    textAlign?: 'left' | 'center' | 'right';
    navLanguage?: NavLanguage;
    themeId?: string;
    themeIds?: string[];
    onChangeTextAlign?: (align: 'left' | 'center' | 'right') => void;
    onChangeLanguage?: (lang: NavLanguage) => void;
    onChangeTheme?: (themeId: string) => void;
    onRegenerate?: () => void;
    onDetach?: () => void;
    onRestoreGenerated?: () => void;
    onOpenSettings?: () => void;
}

const NAV_LANGUAGE_OPTIONS: Array<{ id: NavLanguage; label: string }> = [
    { id: 'Horaire', label: 'Horaire' },
    { id: 'Cardinaux', label: 'Cardinaux' },
    { id: 'Azimut', label: 'Azimut' },
    { id: 'Tournant', label: 'Tournant' },
];

const TEXT_COLOR_PRESETS = [
    { id: 'default', label: 'Par défaut', color: 'var(--text-primary)' },
    { id: 'muted', label: 'Gris', color: '#a1a1aa' },
    { id: 'blue', label: 'Bleu', color: '#60a5fa' },
    { id: 'green', label: 'Vert', color: '#4ade80' },
    { id: 'amber', label: 'Ambre', color: '#fbbf24' },
    { id: 'red', label: 'Rouge', color: '#f87171' },
];

interface SelectionBubbleProps {
    visible: boolean;
    position: { x: number; y: number } | null;
    onFormat: (action: InlineFormatAction) => void;
    onApplyColor: (color: string) => void;
    onTransformBlock: (cmd: EditorCommandDef) => void;
    blockContext?: SelectionBlockContext;
    onClose?: () => void;
}

export default function SelectionBubble({
    visible,
    position,
    onFormat,
    onApplyColor,
    onTransformBlock,
    blockContext,
    onClose,
}: SelectionBubbleProps) {
    const [activeSubmenu, setActiveSubmenu] = useState<'crypto' | 'type' | 'color' | 'guidance' | 'theme' | 'align' | null>(null);
    const bubbleRef = useRef<HTMLDivElement>(null);

    const cryptoCommands = getCryptoCommands(Boolean(blockContext?.isComputed));
    const textTypeCommands = getTransformableCommands().filter(c => c.group === 'Texte');
    const availableThemeIds = blockContext?.themeIds && blockContext.themeIds.length > 0
        ? blockContext.themeIds
        : (() => {
            try { return themeManager.getThemeIds(); } catch { return ['Neutre']; }
        })();

    useEffect(() => {
        if (!visible) setActiveSubmenu(null);
    }, [visible]);

    useEffect(() => {
        if (!visible) return;
        window.dispatchEvent(new CustomEvent('textual:close-menus', { detail: { except: 'selection-bubble' } }));
        const onDocDown = (e: MouseEvent) => {
            if (e.button === 2) return;
            if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
                setActiveSubmenu(null);
                onClose?.();
            }
        };
        const onCloseOthers = (e: Event) => {
            if ((e as CustomEvent).detail?.except !== 'selection-bubble') {
                setActiveSubmenu(null);
                onClose?.();
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setActiveSubmenu(null);
                onClose?.();
            }
        };
        const raf = requestAnimationFrame(() => {
            document.addEventListener('mousedown', onDocDown);
        });
        window.addEventListener('textual:close-menus', onCloseOthers);
        document.addEventListener('keydown', onKey);
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener('mousedown', onDocDown);
            window.removeEventListener('textual:close-menus', onCloseOthers);
            document.removeEventListener('keydown', onKey);
        };
    }, [visible, onClose]);

    if (!visible || !position || typeof document === 'undefined') return null;

    const menuWidth = 236;
    const menuHeight = 160;
    let left = position.x;
    let top = position.y + 10;
    if (typeof window !== 'undefined') {
        left = Math.max(12, Math.min(left, window.innerWidth - menuWidth - 12));
        if (top + menuHeight > window.innerHeight - 12) {
            top = Math.max(12, position.y - menuHeight - 8);
        }
    }

    const rowBtnStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: '30px',
        padding: '0 8px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 80ms ease',
    };

    const formatBtnStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '30px',
        border: 'none',
        borderRadius: '6px',
        background: 'transparent',
        color: 'var(--text-primary)',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background 80ms ease',
    };

    const submenuStyle: React.CSSProperties = {
        position: 'absolute',
        left: left + menuWidth + 200 > (typeof window !== 'undefined' ? window.innerWidth : 1200) ? 'auto' : 'calc(100% + 6px)',
        right: left + menuWidth + 200 > (typeof window !== 'undefined' ? window.innerWidth : 1200) ? 'calc(100% + 6px)' : 'auto',
        top: 0,
        minWidth: '200px',
        maxHeight: '280px',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        padding: '5px',
        zIndex: 99999,
    };

    const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform);
    const mod = isMac ? '⌘' : 'Ctrl+';

    return createPortal(
        <div
            ref={bubbleRef}
            role="menu"
            aria-label="Actions sur le texte sélectionné"
            onMouseDown={(e) => e.preventDefault()} // Préserve la sélection
            style={{
                position: 'fixed',
                left,
                top,
                width: `${menuWidth}px`,
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                padding: '6px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                boxShadow: '0 10px 32px rgba(0, 0, 0, 0.5)',
                animation: 'islandPopoverIn 110ms cubic-bezier(0.16, 1, 0.3, 1)',
                boxSizing: 'border-box',
            }}
        >
            {/* 1. PRIORITÉ : Code ou autre (Chiffrement) */}
            <div style={{ position: 'relative' }}>
                <button
                    role="menuitem"
                    type="button"
                    onClick={() => setActiveSubmenu(s => (s === 'crypto' ? null : 'crypto'))}
                    style={{
                        ...rowBtnStyle,
                        background: activeSubmenu === 'crypto' ? 'var(--bg-hover)' : 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--accent-hover)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)')}
                    onMouseLeave={e => (e.currentTarget.style.background = activeSubmenu === 'crypto' ? 'var(--bg-hover)' : 'rgba(59, 130, 246, 0.1)')}
                >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Lock size={14} />
                        <span>Code / Chiffrement</span>
                    </span>
                    <ChevronRight size={14} color="var(--text-dim)" />
                </button>
                {activeSubmenu === 'crypto' && (
                    <div role="menu" aria-label="Choisir un code" style={submenuStyle}>
                        {cryptoCommands.map(cmd => {
                            const isCurrent = Boolean(blockContext?.moduleId && cmd.config?.cipher === blockContext.moduleId);
                            return (
                                <button
                                    key={cmd.id}
                                    role="menuitem"
                                    type="button"
                                    onClick={() => {
                                        onTransformBlock(cmd);
                                        setActiveSubmenu(null);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                                        padding: '6px 8px', border: 'none', borderRadius: '6px',
                                        background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                        color: isCurrent ? 'var(--accent-hover)' : 'var(--text-primary)',
                                        fontWeight: isCurrent ? 600 : 400,
                                        fontSize: '12.5px', textAlign: 'left', cursor: 'pointer',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = isCurrent ? 'rgba(59, 130, 246, 0.18)' : 'var(--bg-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent')}
                                >
                                    <span>{cmd.label}</span>
                                    {isCurrent && <Check size={13} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 2. TYPE DE TEXTE (uniquement pour les blocs texte libre) */}
            {!blockContext?.isComputed && (
            <div style={{ position: 'relative' }}>
                <button
                    role="menuitem"
                    type="button"
                    onClick={() => setActiveSubmenu(s => (s === 'type' ? null : 'type'))}
                    style={{
                        ...rowBtnStyle,
                        background: activeSubmenu === 'type' ? 'var(--bg-hover)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = activeSubmenu === 'type' ? 'var(--bg-hover)' : 'transparent')}
                >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <Type size={14} color="var(--text-secondary)" />
                        <span>Texte normal</span>
                    </span>
                    <ChevronRight size={14} color="var(--text-dim)" />
                </button>
                {activeSubmenu === 'type' && (
                    <div role="menu" aria-label="Type de texte" style={submenuStyle}>
                        {textTypeCommands.map(cmd => (
                            <button
                                key={cmd.id}
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                    onTransformBlock(cmd);
                                    setActiveSubmenu(null);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    width: '100%', padding: '6px 8px', border: 'none', borderRadius: '6px',
                                    background: 'transparent', color: 'var(--text-primary)',
                                    fontSize: '12.5px', textAlign: 'left', cursor: 'pointer',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <span>{cmd.label}</span>
                                {cmd.shortcut && (
                                    <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                                        {cmd.shortcut}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            )}

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

            {/* 3. CONTRÔLES DE MISE EN FORME : A, B, I, U, </>, Lien */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <button
                    type="button"
                    aria-label="Couleur du texte"
                    title="Couleur du texte"
                    onClick={() => setActiveSubmenu(s => (s === 'color' ? null : 'color'))}
                    style={{
                        ...formatBtnStyle,
                        background: activeSubmenu === 'color' ? 'var(--bg-hover)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = activeSubmenu === 'color' ? 'var(--bg-hover)' : 'transparent')}
                >
                    <span style={{ border: '1px solid var(--border-strong)', borderRadius: '4px', padding: '1px 5px', fontSize: '12px' }}>A</span>
                </button>

                <button
                    type="button"
                    aria-label="Gras"
                    title={`Gras (${mod}B)`}
                    onClick={() => onFormat('bold')}
                    style={formatBtnStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <Bold size={14} strokeWidth={2.5} />
                </button>

                <button
                    type="button"
                    aria-label="Italique"
                    title={`Italique (${mod}I)`}
                    onClick={() => onFormat('italic')}
                    style={formatBtnStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <Italic size={14} strokeWidth={2.4} />
                </button>

                <button
                    type="button"
                    aria-label="Souligné"
                    title={`Souligné (${mod}U)`}
                    onClick={() => onFormat('underline')}
                    style={formatBtnStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <Underline size={14} strokeWidth={2.4} />
                </button>

                <button
                    type="button"
                    aria-label="Code en ligne"
                    title={`Code (${mod}E)`}
                    onClick={() => onFormat('code')}
                    style={formatBtnStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <Code size={14} strokeWidth={2.2} />
                </button>

                <button
                    type="button"
                    aria-label="Lien"
                    title={`Lien (${mod}K)`}
                    onClick={() => onFormat('link')}
                    style={formatBtnStyle}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <Link size={14} strokeWidth={2.2} />
                </button>

                {activeSubmenu === 'color' && (
                    <div role="menu" aria-label="Couleur du texte" style={{ ...submenuStyle, top: 'calc(100% + 6px)', left: 0, right: 'auto', minWidth: '150px' }}>
                        {TEXT_COLOR_PRESETS.map(c => (
                            <button
                                key={c.id}
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                    onApplyColor(c.color);
                                    setActiveSubmenu(null);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    width: '100%', padding: '6px 8px', border: 'none',
                                    borderRadius: '6px', background: 'transparent',
                                    color: 'var(--text-primary)', fontSize: '12.5px',
                                    textAlign: 'left', cursor: 'pointer',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.color, border: '1px solid var(--border-subtle)' }} />
                                <span>{c.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. ACTIONS STANDARDISÉES SPÉCIFIQUES AU TYPE DE BLOC */}
            {blockContext && (
                blockContext.onChangeTextAlign ||
                blockContext.isComputed ||
                (blockContext.moduleId && blockContext.moduleId !== 'texte_clair' && blockContext.onOpenSettings)
            ) && (
                <>
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

                    {/* Alignement (blocs texte libre) */}
                    {blockContext.onChangeTextAlign && (
                        <div style={{ position: 'relative' }}>
                            <button
                                role="menuitem"
                                type="button"
                                onClick={() => setActiveSubmenu(s => (s === 'align' ? null : 'align'))}
                                style={{
                                    ...rowBtnStyle,
                                    background: activeSubmenu === 'align' ? 'var(--bg-hover)' : 'transparent',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = activeSubmenu === 'align' ? 'var(--bg-hover)' : 'transparent')}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <AlignLeft size={14} color="var(--text-secondary)" />
                                    <span>Alignement</span>
                                </span>
                                <ChevronRight size={14} color="var(--text-dim)" />
                            </button>
                            {activeSubmenu === 'align' && (
                                <div role="menu" aria-label="Alignement" style={{ ...submenuStyle, minWidth: '150px' }}>
                                    {([
                                        { id: 'left', label: 'Gauche' },
                                        { id: 'center', label: 'Centré' },
                                        { id: 'right', label: 'Droite' },
                                    ] as const).map(al => {
                                        const isCurrent = (blockContext.textAlign || 'left') === al.id;
                                        return (
                                            <button
                                                key={al.id}
                                                role="menuitem"
                                                type="button"
                                                onClick={() => {
                                                    blockContext.onChangeTextAlign?.(al.id);
                                                    setActiveSubmenu(null);
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    width: '100%', padding: '6px 8px', border: 'none', borderRadius: '6px',
                                                    background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                                    color: isCurrent ? 'var(--accent-hover)' : 'var(--text-primary)',
                                                    fontSize: '12.5px', textAlign: 'left', cursor: 'pointer',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent')}
                                            >
                                                <span>{al.label}</span>
                                                {isCurrent && <Check size={13} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Guidage (blocs générés) */}
                    {blockContext.isComputed && blockContext.onChangeLanguage && (
                        <div style={{ position: 'relative' }}>
                            <button
                                role="menuitem"
                                type="button"
                                onClick={() => setActiveSubmenu(s => (s === 'guidance' ? null : 'guidance'))}
                                style={{
                                    ...rowBtnStyle,
                                    background: activeSubmenu === 'guidance' ? 'var(--bg-hover)' : 'transparent',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = activeSubmenu === 'guidance' ? 'var(--bg-hover)' : 'transparent')}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <Compass size={14} color="var(--text-secondary)" />
                                    <span>Guidage</span>
                                </span>
                                <ChevronRight size={14} color="var(--text-dim)" />
                            </button>
                            {activeSubmenu === 'guidance' && (
                                <div role="menu" aria-label="Mode de guidage" style={{ ...submenuStyle, minWidth: '160px' }}>
                                    {NAV_LANGUAGE_OPTIONS.map(opt => {
                                        const isCurrent = blockContext.navLanguage === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                role="menuitem"
                                                type="button"
                                                onClick={() => {
                                                    blockContext.onChangeLanguage?.(opt.id);
                                                    setActiveSubmenu(null);
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    width: '100%', padding: '6px 8px', border: 'none', borderRadius: '6px',
                                                    background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                                    color: isCurrent ? 'var(--accent-hover)' : 'var(--text-primary)',
                                                    fontSize: '12.5px', textAlign: 'left', cursor: 'pointer',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent')}
                                            >
                                                <span>{opt.label}</span>
                                                {isCurrent && <Check size={13} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Thème narratif (blocs générés) */}
                    {blockContext.isComputed && blockContext.onChangeTheme && availableThemeIds.length > 0 && (
                        <div style={{ position: 'relative' }}>
                            <button
                                role="menuitem"
                                type="button"
                                onClick={() => setActiveSubmenu(s => (s === 'theme' ? null : 'theme'))}
                                style={{
                                    ...rowBtnStyle,
                                    background: activeSubmenu === 'theme' ? 'var(--bg-hover)' : 'transparent',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                onMouseLeave={e => (e.currentTarget.style.background = activeSubmenu === 'theme' ? 'var(--bg-hover)' : 'transparent')}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                    <Palette size={14} color="var(--text-secondary)" />
                                    <span>Thème</span>
                                </span>
                                <ChevronRight size={14} color="var(--text-dim)" />
                            </button>
                            {activeSubmenu === 'theme' && (
                                <div role="menu" aria-label="Thème des phrases générées" style={{ ...submenuStyle, minWidth: '170px' }}>
                                    {availableThemeIds.map(tId => {
                                        const isCurrent = blockContext.themeId === tId;
                                        return (
                                            <button
                                                key={tId}
                                                role="menuitem"
                                                type="button"
                                                onClick={() => {
                                                    blockContext.onChangeTheme?.(tId);
                                                    setActiveSubmenu(null);
                                                }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    width: '100%', padding: '6px 8px', border: 'none', borderRadius: '6px',
                                                    background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                                    color: isCurrent ? 'var(--accent-hover)' : 'var(--text-primary)',
                                                    fontSize: '12.5px', textAlign: 'left', cursor: 'pointer',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent')}
                                            >
                                                <span>{tId}</span>
                                                {isCurrent && <Check size={13} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions rapides propres au bloc (Régénérer, Détacher, Restaurer, Paramètres) */}
                    {blockContext.onRegenerate && (
                        <button
                            role="menuitem"
                            type="button"
                            onClick={() => { blockContext.onRegenerate?.(); onClose?.(); }}
                            style={rowBtnStyle}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={14} color="var(--text-secondary)" />
                                <span>Régénérer</span>
                            </span>
                        </button>
                    )}

                    {blockContext.onDetach && (
                        <button
                            role="menuitem"
                            type="button"
                            onClick={() => { blockContext.onDetach?.(); onClose?.(); }}
                            style={rowBtnStyle}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <Unlink size={14} color="var(--text-secondary)" />
                                <span>Détacher (bloc libre)</span>
                            </span>
                        </button>
                    )}

                    {blockContext.isEdited && blockContext.onRestoreGenerated && (
                        <button
                            role="menuitem"
                            type="button"
                            onClick={() => { blockContext.onRestoreGenerated?.(); onClose?.(); }}
                            style={{ ...rowBtnStyle, color: 'var(--accent-hover)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <RotateCcw size={14} />
                                <span>Restaurer le texte généré</span>
                            </span>
                        </button>
                    )}

                    {blockContext.moduleId && blockContext.moduleId !== 'texte_clair' && blockContext.onOpenSettings && (
                        <button
                            role="menuitem"
                            type="button"
                            onClick={() => { blockContext.onOpenSettings?.(); onClose?.(); }}
                            style={rowBtnStyle}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <SlidersHorizontal size={14} color="var(--text-secondary)" />
                                <span>Paramètres du code</span>
                            </span>
                        </button>
                    )}
                </>
            )}
        </div>,
        document.body
    );
}

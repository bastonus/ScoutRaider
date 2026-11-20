/**
 * TextualHeader.tsx — Barre d'outils flottante responsive.
 * Affiche tous les icônes côte à côte tant qu'ils rentrent.
 * Excédent → menu "≡" (MoreHorizontal).
 * Dropdowns (Cipher, Theme) : rendus DANS leur bouton parent → position absolute fiable.
 */
import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import {
    Check, ChevronDown, KeyRound, MoreHorizontal,
    AlertTriangle, ArrowRight, Lightbulb, Palette,
    Globe, Crosshair, Swords, Crown, Shield,
    Flame, Medal, Radio, Sparkles, Award,
    Bold, Italic, Underline, Code, Heading, List, ListOrdered, Quote, Undo2, Redo2,
    Type, Edit3, SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { themeManager } from '../../logic/ThemeManager';
import { ModuleLogic } from '../../logic/ModuleLogic';

const THEME_ACCENTS: Record<string, { color: string; Icon: React.ComponentType<any> }> = {
    'Neutre':                              { color: '#94a3b8', Icon: Globe },
    'La Mafia':                            { color: '#ef4444', Icon: Crosshair },
    'Les Vikings':                         { color: '#60a5fa', Icon: Swords },
    'Le Roi Soleil':                       { color: '#fbbf24', Icon: Crown },
    'La Chevalerie':                       { color: '#c084fc', Icon: Shield },
    'Les Gaulois':                         { color: '#34d399', Icon: Flame },
    'La Première Guerre mondiale (WW1)':   { color: '#a3a3a3', Icon: Medal },
    'La Seconde Guerre mondiale (WW2)':    { color: '#6b7280', Icon: Radio },
    'Le Seigneur des Anneaux (LOTR)':      { color: '#d97706', Icon: Sparkles },
    'Napoléon':                            { color: '#818cf8', Icon: Award },
};

export const CIPHER_FONT_OPTIONS = [
    { id: 'morse', label: 'Morse', tag: '[morse]', desc: 'Points & traits sonores', sample: 'MORSE', fontClass: 'font-morse', color: '#06b6d4' },
    { id: 'vigenere', label: 'Vigenère', tag: '[vigenere]', desc: 'Chiffre polyalphabétique', sample: 'VIGENÈRE', fontClass: 'font-vigenere', color: '#8b5cf6' },
    { id: 'avocat', label: 'Avocat', tag: '[avocat]', desc: 'Décalage César A=K', sample: 'AVOCAT', fontClass: 'font-avocat', color: '#f59e0b' },
    { id: 'cassis', label: 'Cassis', tag: '[cassis]', desc: 'Décalage César K=6', sample: 'CASSIS', fontClass: 'font-cassis', color: '#ec4899' },
    { id: 'polybe', label: 'Carré de Polybe', tag: '[polybe]', desc: 'Grille de substitution 6×6', sample: 'POLYBE', fontClass: 'font-polybe', color: '#10b981' },
    { id: 'templier', label: 'Templier', tag: '[templier]', desc: 'Chiffre maçonnique / pigpen', sample: 'TEMPLIER', fontClass: 'font-templier', color: '#ef4444' },
    { id: 'plain', label: 'Texte clair', tag: '[plain]', desc: 'Texte lisible en clair', sample: 'CLAIR', fontClass: 'font-plain', color: '#6b7280' },
    { id: 'maritime', label: 'Pavillons Maritimes', tag: '[maritime]', desc: 'Drapeaux navals', sample: 'NAVAL', fontClass: 'font-maritime', color: '#3b82f6' },
    { id: 'code', label: 'Monospace / Code', tag: '[code]', desc: 'Police à chasse fixe', sample: 'code', fontClass: 'font-mono-tag', color: '#a855f7' },
];

function getAccent(id: string) {
    return THEME_ACCENTS[id] || { color: '#94a3b8', Icon: Globe };
}

// ─── Mapping cipher → annexes ────────────────────────────────────────────────
const CIPHER_MODULE_MAP: Record<string, string> = {
    morse: 'morse',
    vigenere: 'vigenere',
    avocat: 'avocat',
    cassis: 'cassis',
    polybe: 'polybe',
    templier: 'templier',
    plain: 'texte_clair',
    maritime: 'maritime',
    code: 'texte_clair',
};

const CIPHER_TO_ANNEXE: Record<string, string | undefined> = {
    morse: 'alphabet_morse',
    vigenere: 'tableau_vigenere',
    avocat: 'methode_avocat',
    cassis: 'methode_avocat',
    polybe: 'grille_polybe',
    templier: 'code_templier',
    maritime: 'index_drapeaux',
    plain: undefined,
    code: undefined,
};

// ─── Helpers encode/decode via ModuleLogic ──────────────────────────────────
function applyCipher(text: string, cipherId: string): string {
    const moduleId = CIPHER_MODULE_MAP[cipherId] || 'texte_clair';

    // Pour Vigenère, on a besoin de la clé du thème actuel
    const options: { key?: string; offset?: number } = {};
    if (cipherId === 'vigenere') {
        const currentTheme = themeManager.currentTheme;
        options.key = currentTheme?.vigenere_key || 'MOUSTACHE';
    }

    // Détection auto encode/decode
    const looksEncoded = (() => {
        switch (cipherId) {
            case 'morse': return /^[.\-\s/]+$/.test(text.trim());
            case 'polybe': return /^([1-6][1-6]\s*)+$/.test(text.trim());
            case 'templier': return /[\u{1F700}-\u{1F719}\u{24EB}-\u{24F3}]/u.test(text);
            case 'maritime': return /🚩/.test(text);
            case 'vigenere':
            case 'avocat':
            case 'cassis': return /^[A-Z\s]+$/.test(text) && text.length > 3;
            default: return false;
        }
    })();

    if (looksEncoded && cipherId === 'vigenere') {
        return ModuleLogic.vigenere(text, options.key || 'MOUSTACHE', true);
    }
    return ModuleLogic.encode(moduleId, text, options);
}

function handleFormat(format: string, arg?: string) {
    const activeCK = (window as any).__activeCKEditor;
    if (activeCK && typeof activeCK.execute === 'function') {
        try {
            switch (format) {
                case 'undo': activeCK.execute('undo'); return;
                case 'redo': activeCK.execute('redo'); return;
                case 'bold': activeCK.execute('bold'); return;
                case 'italic': activeCK.execute('italic'); return;
                case 'underline': activeCK.execute('underline'); return;
                case 'code': activeCK.execute('code'); return;
                case 'list': activeCK.execute('bulletedList'); return;
                case 'list-ordered': activeCK.execute('numberedList'); return;
                case 'quote': activeCK.execute('blockQuote'); return;
                case 'h1': activeCK.execute('heading', { value: 'heading1' }); return;
                case 'h2': activeCK.execute('heading', { value: 'heading2' }); return;
                case 'cipher': {
                    const cipher = arg || 'morse';
                    const model = activeCK.model;
                    const selection = model.document.selection;
                    let selectedText = '';
                    for (const range of selection.getRanges()) {
                        for (const item of range.getItems()) {
                            if (item.data) selectedText += item.data;
                        }
                    }
                    const encoded = selectedText ? applyCipher(selectedText, cipher) : '';
                    const insertStr = selectedText ? `[${cipher}]${encoded}[/${cipher}]` : `[${cipher}]texte[/${cipher}]`;
                    model.change((writer: any) => {
                        model.insertContent(writer.createText(insertStr), selection);
                    });
                    return;
                }
            }
        } catch {}
    }

    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || (activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type === 'text'))) {
        const input = activeEl as HTMLTextAreaElement | HTMLInputElement;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const val = input.value;
        const selected = val.substring(start, end);
        let replacement = '';

        if (format === 'cipher') {
            const cipher = arg || 'morse';
            const encoded = selected ? applyCipher(selected, cipher) : '';
            replacement = `[${cipher}]${encoded || 'texte'}[/${cipher}]`;
        } else {
            switch (format) {
                case 'bold': replacement = `**${selected || 'texte'}**`; break;
                case 'italic': replacement = `*${selected || 'texte'}*`; break;
                case 'underline': replacement = `<u>${selected || 'texte'}</u>`; break;
                case 'code': replacement = `\`${selected || 'code'}\``; break;
                case 'quote': replacement = `\n> ${selected || 'citation'}\n`; break;
                case 'list': replacement = `\n- ${selected || 'élément'}\n`; break;
                case 'list-ordered': replacement = `\n1. ${selected || 'élément'}\n`; break;
                case 'h1': replacement = `\n# ${selected || 'Titre'}\n`; break;
                case 'h2': replacement = `\n## ${selected || 'Sous-titre'}\n`; break;
                case 'undo': document.execCommand('undo'); return;
                case 'redo': document.execCommand('redo'); return;
            }
        }

        input.setRangeText(replacement, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        return;
    }

    try {
        if (format === 'cipher') {
            const cipher = arg || 'morse';
            const sel = window.getSelection();
            const selectedText = sel ? sel.toString() : '';
            const encoded = selectedText ? applyCipher(selectedText, cipher) : '';
            document.execCommand('insertText', false, `[${cipher}]${encoded || 'texte'}[/${cipher}]`);
            return;
        }
        switch (format) {
            case 'bold': document.execCommand('bold', false); break;
            case 'italic': document.execCommand('italic', false); break;
            case 'underline': document.execCommand('underline', false); break;
            case 'list': document.execCommand('insertUnorderedList', false); break;
            case 'list-ordered': document.execCommand('insertOrderedList', false); break;
            case 'quote': document.execCommand('formatBlock', false, '<blockquote>'); break;
            case 'h1': document.execCommand('formatBlock', false, '<h1>'); break;
            case 'h2': document.execCommand('formatBlock', false, '<h2>'); break;
            case 'undo': document.execCommand('undo', false); break;
            case 'redo': document.execCommand('redo', false); break;
        }
    } catch {}
}

const DEFAULT_ITEM_WIDTHS: Record<string, number> = {
    undo: 35,
    redo: 35,
    bold: 35,
    italic: 35,
    underline: 35,
    code: 35,
    h1: 35,
    list: 35,
    'list-ordered': 35,
    quote: 35,
    cipher: 95,
    theme: 175,
};
const TOOLBAR_CONTAINER_PADDING = 12; // 2 * 4px padding + 2px bordure + marge
const OVERFLOW_BTN_RESERVED = 38;     // Bouton "..." (32px) + gap
const HYSTERESIS_BUFFER = 20;         // Marge tampon anti-battement : empêche tout clignotement / cycle infini au seuil

interface ToolbarItem {
    id: string;
    priority: number;
    minWidth: number;
    render: () => React.ReactNode;
}

interface TextualHeaderProps {
    onExport?: () => void;
}

export default function TextualHeader({ onExport }: TextualHeaderProps = {}) {
    const { state, dispatch } = useApp();

    // ─── Action combinée : cipher + annexe + solution view ──────────────────────
    const applyCipherWithExtras = useCallback((cipherId: string) => {
        // 1. Activer l'annexe correspondante
        const annexeId = CIPHER_TO_ANNEXE[cipherId];
        if (annexeId) {
            dispatch({ type: 'TOGGLE_ANNEXE', annexeId: annexeId as any });
        }
        // 2. Passer en vue solution (active les traductions au hover)
        dispatch({ type: 'SET_CARNET_VIEW', view: 'solution' });
        // 3. Appliquer le format cipher
        handleFormat('cipher', cipherId);
    }, [dispatch]);

    // ─── États UI ────────────────────────────────────────────────────────────
    const [cipherMenuOpen, setCipherMenuOpen] = useState(false);
    const [themePickerOpen, setThemePickerOpen] = useState(false);
    const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
    const [allThemeIds, setAllThemeIds] = useState<string[]>([]);
    const [selectedCipher, setSelectedCipher] = useState<string>('morse');

    // ─── Données ─────────────────────────────────────────────────────────────
    const currentAccent = getAccent(state.theme_id);
    const currentTheme = themeManager.getTheme(state.theme_id);
    const isSolution = state.carnet_view === 'solution';

    const errorItems = useMemo(() => {
        const items: { stepId: string; stepLabel: string; message: string; severity: 'error' | 'warning' }[] = [];
        for (const step of (state.carnet_steps || [])) {
            if (step.warnings && step.warnings.length > 0 && !step.isEdited) {
                for (const w of step.warnings) {
                    if (w.message) {
                        items.push({
                            stepId: step.id,
                            stepLabel: step.fromLabel || 'Étape',
                            message: w.message,
                            severity: w.severity === 'error' ? 'error' : 'warning'
                        });
                    }
                }
            }
        }
        return items;
    }, [state.carnet_steps]);

    useEffect(() => {
        (window as any).__textualErrors = { items: errorItems, hasErrors: errorItems.some(i => i.severity === 'error') };
        return () => { delete (window as any).__textualErrors; };
    }, [errorItems]);

    // ─── Styles inline constants (AVANT les helpers qui les utilisent) ────────
    const btnStyle: React.CSSProperties = {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '28px', height: '32px', borderRadius: '8px',
        border: 'none', background: 'transparent', color: 'var(--text-secondary)',
        cursor: 'pointer', transition: 'all 90ms ease', flexShrink: 0,
    };

    const cipherBadgeStyle: React.CSSProperties = {
        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
        color: 'var(--accent-hover)', background: 'rgba(37, 99, 235, 0.1)',
        border: '1px solid var(--border-subtle)', borderRadius: '4px',
        padding: '1px 5px', letterSpacing: '0.04em', marginLeft: '4px',
    };

    const dropdownStyle: React.CSSProperties = {
        position: 'absolute',
        top: 'calc(100% + 8px)',
        left: 0,
        zIndex: 1600,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-strong)',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-lg)',
        padding: '6px',
        minWidth: '220px',
        animation: 'popIn 140ms ease-out',
    };

    const dropdownHeaderStyle: React.CSSProperties = {
        fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)',
        padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em',
    };

    const dropdownItemStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
        padding: '6px 8px', borderRadius: '7px', border: 'none',
        background: 'transparent', color: 'var(--text-primary)', fontSize: '11.5px', fontWeight: 600,
        cursor: 'pointer', textAlign: 'left', transition: 'background 80ms',
    };

    // ─── Refs ────────────────────────────────────────────────────────────────
    const toolbarRef = useRef<HTMLDivElement>(null);
    const overflowBtnRef = useRef<HTMLButtonElement>(null);
    const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    // ─── Helpers rendu ──────────────────────────────────────────────────────
    const toolBtn = useCallback((format: string, title: string, icon: React.ReactNode) => (
        <button
            ref={(el) => { if (el) itemRefs.current.set(format, el); else itemRefs.current.delete(format); }}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); handleFormat(format); }}
            title={title}
            style={btnStyle}
        >
            {icon}
        </button>
    ), []);

    const cipherTrigger = useCallback((isOverflow = false) => (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
                ref={!isOverflow ? (el) => { if (el) itemRefs.current.set('cipher', el); else itemRefs.current.delete('cipher'); } : undefined}
                type="button"
                onClick={(e) => { e.stopPropagation(); setCipherMenuOpen(v => !v); setThemePickerOpen(false); }}
                title="Appliquer un codage cryptographique"
                style={{
                    ...btnStyle,
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    width: 'auto', padding: '0 10px',
                    border: cipherMenuOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                    background: cipherMenuOpen ? 'var(--bg-hover)' : 'transparent',
                    color: cipherMenuOpen ? 'var(--accent-hover)' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => { if (!cipherMenuOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!cipherMenuOpen) e.currentTarget.style.background = 'transparent'; }}
            >
                <Type size={13} strokeWidth={2.4} color="var(--accent-hover)" />
                <span style={cipherBadgeStyle}>
                    {CIPHER_FONT_OPTIONS.find(o => o.id === selectedCipher)?.tag || '[morse]'}
                </span>
                <ChevronDown size={10} style={{ opacity: 0.6, transform: cipherMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
            </button>

            {/* Dropdown CIPHER — position absolute dans ce wrapper relative */}
            {cipherMenuOpen && (
                <div style={dropdownStyle}>
                    <div style={dropdownHeaderStyle}>Choisir un codage cryptographique</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {CIPHER_FONT_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => { setSelectedCipher(opt.id); applyCipherWithExtras(opt.id); setCipherMenuOpen(false); }}
                                style={{
                                    ...dropdownItemStyle,
                                    background: selectedCipher === opt.id ? 'var(--accent-transparent)' : 'transparent',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = selectedCipher === opt.id ? 'var(--accent-transparent)' : 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                                    <div>
                                        <div>{opt.label}</div>
                                        <div style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 400 }}>{opt.tag}</div>
                                    </div>
                                </div>
                                <span className={opt.fontClass} style={{ color: opt.color, fontSize: '13px' }}>{opt.sample}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    ), [cipherMenuOpen, selectedCipher, applyCipherWithExtras]);

    const themeTrigger = useCallback((isOverflow = false) => (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button
                ref={!isOverflow ? (el) => { if (el) itemRefs.current.set('theme', el); else itemRefs.current.delete('theme'); } : undefined}
                type="button"
                onClick={(e) => { e.stopPropagation(); setThemePickerOpen(v => !v); setCipherMenuOpen(false); }}
                title={`Thème narratif : ${state.theme_id}`}
                style={{
                    ...btnStyle,
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    width: 'auto', padding: '0 9px',
                    border: themePickerOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                    background: themePickerOpen ? 'var(--bg-hover)' : 'transparent',
                    color: 'var(--text-primary)',
                    maxWidth: '180px', minWidth: 0, flexShrink: 1,
                    overflow: 'hidden',
                }}
                onMouseEnter={e => { if (!themePickerOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!themePickerOpen) e.currentTarget.style.background = 'transparent'; }}
            >
                <Palette size={13} color={currentAccent.color} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px', display: 'inline-block' }}>
                    {state.theme_id}
                </span>
                <ChevronDown size={11} style={{ opacity: 0.6, flexShrink: 0, transform: themePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
            </button>

            {/* Dropdown THEME — position absolute dans ce wrapper relative */}
            {themePickerOpen && (
                <div style={{ ...dropdownStyle, minWidth: '240px', maxHeight: '360px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '8px', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <KeyRound size={12} color="var(--accent-default)" />
                            <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontWeight: 600 }}>Clé Vigenère :</span>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', color: 'var(--accent-hover)', letterSpacing: '0.08em' }}>{currentTheme.vigenere_key || 'AUCUNE'}</span>
                    </div>
                    <div style={dropdownHeaderStyle}>Sélectionner un thème</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '360px', overflowY: 'auto' }}>
                        {allThemeIds.map(tId => {
                            const accent = getAccent(tId);
                            const isCurrent = tId === state.theme_id;
                            const IconComp = accent.Icon;
                            return (
                                <button
                                    key={tId}
                                    onClick={() => { dispatch({ type: 'SET_THEME', themeId: tId }); setThemePickerOpen(false); }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', border: 'none',
                                        background: isCurrent ? 'var(--bg-hover)' : 'transparent',
                                        color: isCurrent ? 'var(--text-primary)' : 'var(--text-default)',
                                        cursor: 'pointer', fontSize: '12px', fontWeight: isCurrent ? 700 : 400,
                                        textAlign: 'left', width: '100%', transition: 'all 80ms ease'
                                    }}
                                    onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                    onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', background: `${accent.color}20`, border: `1px solid ${accent.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconComp size={11} color={accent.color} /></div>
                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tId}</span>
                                    {isCurrent && <Check size={13} color="var(--accent-default)" strokeWidth={2.6} />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    ), [themePickerOpen, state.theme_id, currentAccent, currentTheme, allThemeIds]);

    // ─── Items barre (ordre de priorité croissante = masqués en premier) ────
    const toolbarItems = useMemo<ToolbarItem[]>(() => {
        const items: ToolbarItem[] = [
            { id: 'undo', priority: 0, minWidth: 35, render: () => toolBtn('undo', 'Annuler (Ctrl+Z)', <Undo2 size={13} strokeWidth={2.2} />) },
            { id: 'redo', priority: 0, minWidth: 35, render: () => toolBtn('redo', 'Rétablir (Ctrl+Y)', <Redo2 size={13} strokeWidth={2.2} />) },
            { id: 'bold', priority: 1, minWidth: 35, render: () => toolBtn('bold', 'Gras (Ctrl+B)', <Bold size={13} strokeWidth={2.4} />) },
            { id: 'italic', priority: 1, minWidth: 35, render: () => toolBtn('italic', 'Italique (Ctrl+I)', <Italic size={13} strokeWidth={2.4} />) },
            { id: 'underline', priority: 2, minWidth: 35, render: () => toolBtn('underline', 'Souligné (Ctrl+U)', <Underline size={13} strokeWidth={2.4} />) },
            { id: 'code', priority: 2, minWidth: 35, render: () => toolBtn('code', 'Code en ligne', <Code size={13} strokeWidth={2.2} />) },
            { id: 'h1', priority: 3, minWidth: 35, render: () => toolBtn('h1', 'Titre de section', <Heading size={13} strokeWidth={2.2} />) },
            { id: 'list', priority: 3, minWidth: 35, render: () => toolBtn('list', 'Liste à puces', <List size={13} strokeWidth={2.2} />) },
            { id: 'list-ordered', priority: 3, minWidth: 35, render: () => toolBtn('list-ordered', 'Liste numérotée', <ListOrdered size={13} strokeWidth={2.2} />) },
            { id: 'quote', priority: 3, minWidth: 35, render: () => toolBtn('quote', 'Citation', <Quote size={13} strokeWidth={2.2} />) },
            { id: 'cipher', priority: 4, minWidth: 95, render: () => cipherTrigger(false) },
            { id: 'theme', priority: 5, minWidth: 175, render: () => themeTrigger(false) },
        ];
        return items.sort((a, b) => a.priority - b.priority);
    }, [toolBtn, cipherTrigger, themeTrigger]);

    // ─── État visibleItems (initialisé avec tous les items pour éviter le flash) ────
    const [visibleItems, setVisibleItems] = useState<Set<string>>(() => new Set(['undo', 'redo', 'bold', 'italic', 'underline', 'code', 'h1', 'list', 'list-ordered', 'quote', 'cipher', 'theme']));
    const visibleItemsRef = useRef<Set<string>>(visibleItems);
    visibleItemsRef.current = visibleItems;

    // Cache persistant des largeurs réelles mesurées (ne retombe jamais à 0 quand masqué)
    const knownWidthsRef = useRef<Record<string, number>>({ ...DEFAULT_ITEM_WIDTHS });

    // ─── Items overflow (après visibleItems) ────────────────────────────────
    const isItemVisible = (id: string) => visibleItems.has(id);
    const overflowItems = toolbarItems.filter(item => !isItemVisible(item.id));

    // ─── Un seul dropdown principal ouvert à la fois ─────────────────────────────
    const openCipherMenu = useCallback(() => {
        setCipherMenuOpen(true);
        setThemePickerOpen(false);
    }, []);
    const openThemePicker = useCallback(() => {
        setThemePickerOpen(true);
        setCipherMenuOpen(false);
    }, []);

    const handleOverflowItem = useCallback((itemId: string) => {
        switch (itemId) {
            case 'undo': handleFormat('undo'); break;
            case 'redo': handleFormat('redo'); break;
            case 'bold': handleFormat('bold'); break;
            case 'italic': handleFormat('italic'); break;
            case 'underline': handleFormat('underline'); break;
            case 'code': handleFormat('code'); break;
            case 'h1': handleFormat('h1'); break;
            case 'list': handleFormat('list'); break;
            case 'list-ordered': handleFormat('list-ordered'); break;
            case 'quote': handleFormat('quote'); break;
            case 'cipher': openCipherMenu(); break;
            case 'theme': openThemePicker(); break;
        }
        setOverflowMenuOpen(false);
    }, [openCipherMenu, openThemePicker]);

    const overflowIcon = useCallback((id: string) => {
        switch (id) {
            case 'theme': return <Palette size={14} color={currentAccent.color} />;
            case 'cipher': return <Type size={14} color="var(--accent-hover)" />;
            case 'underline': return <Underline size={14} strokeWidth={2.4} />;
            case 'code': return <Code size={14} strokeWidth={2.2} />;
            case 'h1': return <Heading size={14} strokeWidth={2.2} />;
            case 'list': return <List size={14} strokeWidth={2.2} />;
            case 'list-ordered': return <ListOrdered size={14} strokeWidth={2.2} />;
            case 'quote': return <Quote size={14} strokeWidth={2.2} />;
            case 'undo': return <Undo2 size={14} strokeWidth={2.2} />;
            case 'redo': return <Redo2 size={14} strokeWidth={2.2} />;
            default: return <SlidersHorizontal size={14} />;
        }
    }, [currentAccent]);

    const overflowLabel = useCallback((id: string) => {
        switch (id) {
            case 'theme': return `Thème : ${state.theme_id}`;
            case 'cipher': return `Cryptographie : ${CIPHER_FONT_OPTIONS.find(o => o.id === selectedCipher)?.label}`;
            case 'underline': return 'Souligné';
            case 'code': return 'Code en ligne';
            case 'h1': return 'Titre';
            case 'list': return 'Liste à puces';
            case 'list-ordered': return 'Liste numérotée';
            case 'quote': return 'Citation';
            case 'undo': return 'Annuler';
            case 'redo': return 'Rétablir';
            default: return id;
        }
    }, [state.theme_id, selectedCipher]);

    // ─── Mesure dynamique anti-clignotement avec Hystérèse ─────────────────────
    const measureOverflow = useCallback(() => {
        const toolbar = toolbarRef.current;
        const parent = toolbar?.parentElement;
        if (!toolbar || !parent) return;

        // Mesure basée strictement sur la largeur du conteneur parent externe (insensible aux fluctuations de la toolbar)
        const parentRect = parent.getBoundingClientRect();
        const availableWidth = parentRect.width > 0 ? parentRect.width : parent.clientWidth;
        if (availableWidth <= 0) return;

        // Mettre à jour les dimensions réelles connues des éléments montés dans la barre
        for (const item of toolbarItems) {
            const el = itemRefs.current.get(item.id);
            if (el && el.offsetWidth > 0) {
                // Largeur du bouton + séparateur (5px) + gap flex (2px)
                const realW = el.offsetWidth + 7;
                if (realW > (knownWidthsRef.current[item.id] || 0)) {
                    knownWidthsRef.current[item.id] = realW;
                }
            }
        }

        // 1. Tester si l'intégralité des items rentre sans bouton overflow
        let totalAllWidth = TOOLBAR_CONTAINER_PADDING;
        for (const item of toolbarItems) {
            totalAllWidth += knownWidthsRef.current[item.id] || DEFAULT_ITEM_WIDTHS[item.id] || 35;
        }

        if (totalAllWidth <= availableWidth) {
            const allSet = new Set(toolbarItems.map(i => i.id));
            setVisibleItems(prev => {
                if (prev.size === allSet.size) {
                    let same = true;
                    for (const id of allSet) {
                        if (!prev.has(id)) { same = false; break; }
                    }
                    if (same) return prev;
                }
                return allSet;
            });
            return;
        }

        // 2. Si tout ne rentre pas, le bouton "..." overflow est requis
        const maxBudget = availableWidth - TOOLBAR_CONTAINER_PADDING - OVERFLOW_BTN_RESERVED;
        let usedWidth = 0;
        const nextVisible = new Set<string>();

        for (const item of toolbarItems) {
            const cost = knownWidthsRef.current[item.id] || DEFAULT_ITEM_WIDTHS[item.id] || 35;
            const wasVisible = visibleItemsRef.current.has(item.id);

            // RÈGLE D'HYSTÉRÈSE STRICTE ANTI-CLIGNOTEMENT :
            // Pour réintégrer un bouton masqué (wasVisible = false), on exige une marge tampon
            // supplémentaire de HYSTERESIS_BUFFER px.
            // S'il était déjà affiché, on le conserve tant qu'il ne dépasse pas le budget réel.
            // Cela rend mathématiquement impossible tout battement/oscillation infini.
            const neededSpace = wasVisible ? cost : cost + HYSTERESIS_BUFFER;

            if (usedWidth + neededSpace <= maxBudget) {
                nextVisible.add(item.id);
                usedWidth += cost;
            } else {
                // Dès qu'un item de cette priorité ne rentre plus, tous les suivants vont en overflow
                break;
            }
        }

        setVisibleItems(prev => {
            if (prev.size === nextVisible.size) {
                let same = true;
                for (const id of nextVisible) {
                    if (!prev.has(id)) { same = false; break; }
                }
                if (same) return prev; // Même état -> pas de re-render !
            }
            return nextVisible;
        });
    }, [toolbarItems]);

    // ResizeObserver attaché UNIQUEMENT au conteneur parent (jamais à la toolbar)
    useLayoutEffect(() => {
        const toolbar = toolbarRef.current;
        const parent = toolbar?.parentElement;
        if (!toolbar || !parent) return;

        let rafId: number | null = null;
        const scheduleMeasure = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                measureOverflow();
                rafId = null;
            });
        };

        const ro = new ResizeObserver(() => {
            scheduleMeasure();
        });

        // IMPORTANT : On observe seulement le parent externe
        ro.observe(parent);
        scheduleMeasure();

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            ro.disconnect();
        };
    }, [measureOverflow]);

    // Recalcul sécurisé après rendu si un libellé ou un élément est plus large qu'anticipé
    useLayoutEffect(() => {
        let hasLargerMeasure = false;
        for (const item of toolbarItems) {
            if (visibleItems.has(item.id)) {
                const el = itemRefs.current.get(item.id);
                if (el && el.offsetWidth > 0) {
                    const realW = el.offsetWidth + 7;
                    if (realW > (knownWidthsRef.current[item.id] || 0)) {
                        knownWidthsRef.current[item.id] = realW;
                        hasLargerMeasure = true;
                    }
                }
            }
        }
        if (hasLargerMeasure) {
            measureOverflow();
        }
    }, [visibleItems, toolbarItems, measureOverflow]);

    // ─── Fermeture menus au clic extérieur ──────────────────────────────────
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            // Ne ferme PAS si on clique dans un dropdown ouvert
            if (cipherMenuOpen && target?.closest?.('[style*="position: absolute"]')) return;
            if (themePickerOpen && target?.closest?.('[style*="position: absolute"]')) return;
            if (overflowMenuOpen && target?.closest?.('[style*="position: absolute"]')) return;
            setCipherMenuOpen(false);
            setThemePickerOpen(false);
            setOverflowMenuOpen(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [cipherMenuOpen, themePickerOpen, overflowMenuOpen]);

    // ─── Raccourci Alt+S ────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                dispatch({ type: 'SET_CARNET_VIEW', view: isSolution ? 'participant' : 'solution' });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch, isSolution]);

    useEffect(() => {
        const tryLoad = () => { if (themeManager.isLoaded) setAllThemeIds(themeManager.getThemeIds()); else setTimeout(tryLoad, 150); };
        tryLoad();
    }, []);

    // ─── RENDU ──────────────────────────────────────────────────────────────
    return (
        <>
            <style>{`
                @keyframes popIn {
                    0% { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            <div
                ref={toolbarRef}
                style={{
                    display: 'flex', alignItems: 'center', gap: '2px',
                    height: '40px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)', borderRadius: '14px',
                    padding: '3px 4px', boxShadow: 'var(--shadow-md)',
                    userSelect: 'none', position: 'relative',
                    boxSizing: 'border-box', pointerEvents: 'all',
                    maxWidth: '100%', flexShrink: 0,
                }}
            >
                {toolbarItems.map(item =>
                    isItemVisible(item.id) ? (
                        <span key={item.id} style={{ display: 'flex', alignItems: 'center' }}>
                            {item.render()}
                            {item.id !== toolbarItems[toolbarItems.length - 1]?.id &&
                             <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />
                            }
                        </span>
                    ) : null
                )}

                {overflowItems.length > 0 && (
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <button
                            ref={overflowBtnRef}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setOverflowMenuOpen(v => !v); }}
                            title={`${overflowItems.length} outil${overflowItems.length > 1 ? 's' : ''} supplémentaire${overflowItems.length > 1 ? 's' : ''}`}
                            style={{
                                ...btnStyle,
                                width: '32px', padding: '0',
                                border: overflowMenuOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                                background: overflowMenuOpen ? 'var(--bg-hover)' : 'transparent',
                                color: overflowMenuOpen ? 'var(--accent-hover)' : 'var(--text-secondary)',
                            }}
                            onMouseEnter={e => { if (!overflowMenuOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { if (!overflowMenuOpen) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <MoreHorizontal size={16} strokeWidth={2.2} />
                        </button>
                        {overflowMenuOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 1600,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                                borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '6px',
                                minWidth: '200px', animation: 'popIn 140ms ease-out',
                            }}>
                                <div style={dropdownHeaderStyle}>Outils supplémentaires</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {overflowItems.map(item => {
                                        // Pour cipher et theme : rendre le VRAI trigger (avec son dropdown, en mode overflow)
                                        if (item.id === 'cipher') return <div key="cipher">{cipherTrigger(true)}</div>;
                                        if (item.id === 'theme') return <div key="theme">{themeTrigger(true)}</div>;
                                        // Pour les autres : bouton simple
                                        return (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={(e) => { e.preventDefault(); handleOverflowItem(item.id); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '8px 10px', borderRadius: '7px', border: 'none',
                                                    background: 'transparent', color: 'var(--text-primary)',
                                                    fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                                                    textAlign: 'left', width: '100%', transition: 'background 80ms'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                {overflowIcon(item.id)}
                                                <span>{overflowLabel(item.id)}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
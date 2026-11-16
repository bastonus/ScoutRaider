/**
 * TextualHeader.tsx — Barre d'outils flottante supérieure alignée avec la barre de recherche des cartes (40px).
 * VRAIMENT RESPONSIVE : utilise ResizeObserver pour adapter les outils à la largeur RÉELLE du conteneur.
 *
 * Contient (de gauche à droite, avec regroupement progressif) :
 *  - [1. Historique] : Annuler, Rétablir (toujours visibles, ou dans menu Édition si ultra compact)
 *  - [2. Style base] : Gras, Italique (toujours visibles)
 *  - [3. Format avancé] : Souligné, Code, Titre, Listes, Citation → menu "Format" (SlidersHorizontal)
 *  - [4. Cryptographie] : Badge tag + menu Morse/Templiers/Maritime/Monospace
 *  - [5. Thème] : Palette + nom thème tronqué + menu thèmes
 *
 * Comportement responsive :
 *  - Largeur >= 720px : tous les outils principaux visibles
 *  - 520-720px : Format dans menu, Cryptographie badge seul
 *  - 420-520px : Historique dans menu Édition, Thème tronqué
 *  - < 420px : Ultra compact - tout dans menus
 */
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Check, ChevronDown, KeyRound,
    AlertTriangle, ArrowRight, Lightbulb, Palette,
    Globe, Crosshair, Swords, Crown, Shield,
    Flame, Medal, Radio, Sparkles, Award,
    Bold, Italic, Underline, Code, Heading, List, ListOrdered, Quote, Undo2, Redo2,
    Type, Edit3, SlidersHorizontal
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { themeManager } from '../../logic/ThemeManager';

const THEME_ACCENTS: Record<string, { color: string; Icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties; strokeWidth?: number }> }> = {
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
    { id: 'morse', label: 'Morse', tag: '[morse]', desc: 'Points & traits', sample: 'MORSE', fontClass: 'font-morse', color: '#06b6d4' },
    { id: 'templier', label: 'Croix des Templiers', tag: '[templier]', desc: 'Symboles maçonniques', sample: 'TEMPLIER', fontClass: 'font-templier', color: '#ef4444' },
    { id: 'maritime', label: 'Pavillons Maritimes', tag: '[maritime]', desc: 'Drapeaux navals', sample: 'NAVAL', fontClass: 'font-maritime', color: '#3b82f6' },
    { id: 'code', label: 'Monospace / Code', tag: '[code]', desc: 'Police à chasse fixe', sample: 'code', fontClass: 'font-mono-tag', color: '#a855f7' },
];

function getAccent(id: string) {
    return THEME_ACCENTS[id] || { color: '#94a3b8', Icon: Globe };
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
                    const insertStr = selectedText ? `[${cipher}]${selectedText}[/${cipher}]` : `[${cipher}]texte[/${cipher}]`;
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
            replacement = `[${cipher}]${selected || 'texte'}[/${cipher}]`;
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
            document.execCommand('insertText', false, `[${cipher}]${selectedText || 'texte'}[/${cipher}]`);
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

interface TextualHeaderProps {
    onExport?: () => void;
}

export default function TextualHeader({ onExport }: TextualHeaderProps = {}) {
    const { state, dispatch } = useApp();
    const [themePickerOpen, setThemePickerOpen] = useState(false);
    const [cipherMenuOpen, setCipherMenuOpen] = useState(false);
    const [formatMenuOpen, setFormatMenuOpen] = useState(false);
    const [editMenuOpen, setEditMenuOpen] = useState(false);
    const [allThemeIds, setAllThemeIds] = useState<string[]>([]);
    const [selectedCipher, setSelectedCipher] = useState<string>('morse');
    const [containerWidth, setContainerWidth] = useState<number>(720); // largeur par défaut

    const themePickerRef = useRef<HTMLDivElement>(null);
    const cipherMenuRef = useRef<HTMLDivElement>(null);
    const formatMenuRef = useRef<HTMLDivElement>(null);
    const editMenuRef = useRef<HTMLDivElement>(null);
    const toolbarRef = useRef<HTMLDivElement>(null);

    const currentAccent = getAccent(state.theme_id);
    const currentTheme = themeManager.getTheme(state.theme_id);
    const isSolution = state.carnet_view === 'solution';

    // Rassemblement erreurs pour le bouton bas-gauche (exposé via window pour TextualView)
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

    const hasErrors = errorItems.some(i => i.severity === 'error');

    // Exposer les données d'erreurs globalement pour la barre bas-gauche
    useEffect(() => {
        (window as any).__textualErrors = { items: errorItems, hasErrors };
        return () => { delete (window as any).__textualErrors; };
    }, [errorItems, hasErrors]);

    // ResizeObserver pour adapter la barre à la largeur RÉELLE du conteneur
    useEffect(() => {
        const el = toolbarRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        ro.observe(el);
        // Mesure initiale
        setContainerWidth(el.clientWidth);
        return () => ro.disconnect();
    }, []);

    // Breakpoints basés sur la largeur RÉELLE du conteneur (pas window.innerWidth)
    const showHistoryDirect = containerWidth >= 480;
    const showFormatDirect = containerWidth >= 720; // false = dans menu Format
    const showCipherLabel = containerWidth >= 560;  // false = badge seul
    const showThemeLabel = containerWidth >= 500;
    const isUltraCompact = containerWidth < 420;

    useEffect(() => {
        const tryLoad = () => {
            if (themeManager.isLoaded) {
                setAllThemeIds(themeManager.getThemeIds());
            } else {
                setTimeout(tryLoad, 150);
            }
        };
        tryLoad();
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (themePickerRef.current && !themePickerRef.current.contains(target)) setThemePickerOpen(false);
            if (cipherMenuRef.current && !cipherMenuRef.current.contains(target)) setCipherMenuOpen(false);
            if (formatMenuRef.current && !formatMenuRef.current.contains(target)) setFormatMenuOpen(false);
            if (editMenuRef.current && !editMenuRef.current.contains(target)) setEditMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Raccourci clavier Alt+S pour basculer les solutions (global, marche même si bouton masqué)
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

    const renderToolBtn = useCallback((format: string, title: string, icon: React.ReactNode, arg?: string) => (
        <button
            type="button"
            onMouseDown={(e) => {
                e.preventDefault();
                handleFormat(format, arg);
            }}
            title={title}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 90ms ease',
                flexShrink: 0
            }}
            onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-secondary)';
            }}
        >
            {icon}
        </button>
    ), []);

    return (
        <>
            <style>{`
                @keyframes islandPopoverInTopCentered {
                    0% { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.97); }
                    100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                }
                @keyframes islandPopoverInTopRight {
                    0% { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    100% { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>

            <div
                ref={toolbarRef}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    height: '40px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '3px 4px',
                    boxShadow: 'var(--shadow-md)',
                    userSelect: 'none',
                    position: 'relative',
                    boxSizing: 'border-box',
                    pointerEvents: 'all',
                    width: '100%', // prend toute la largeur du conteneur
                    maxWidth: '100%',
                    overflow: 'hidden',
                }}
            >
                {/* ═══ SECTION 1: HISTORIQUE (Annuler/Rétablir) ═══ */}
                {isUltraCompact ? (
                    <div style={{ position: 'relative' }} ref={editMenuRef}>
                        <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); setEditMenuOpen(v => !v); }}
                            title="Outils d'édition"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                height: '32px', padding: '0 7px', borderRadius: '8px',
                                border: editMenuOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                                background: editMenuOpen ? 'var(--bg-hover)' : 'transparent',
                                color: editMenuOpen ? 'var(--accent-hover)' : 'var(--text-secondary)',
                                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                transition: 'all 90ms ease', flexShrink: 0
                            }}
                        >
                            <Edit3 size={13} strokeWidth={2.2} />
                            <ChevronDown size={10} style={{ opacity: 0.6, transform: editMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                        </button>
                        {editMenuOpen && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 1600,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                                borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '6px',
                                minWidth: '190px', animation: 'islandPopoverInTopCentered 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                            }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Historique</div>
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('undo'); setEditMenuOpen(false); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer' }}><Undo2 size={12} /> <span>Annuler</span></button>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('redo'); setEditMenuOpen(false); }} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer' }}><Redo2 size={12} /> <span>Rétablir</span></button>
                                </div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Style de texte</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '6px' }}>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('bold'); setEditMenuOpen(false); }} title="Gras" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><Bold size={12} /></button>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('italic'); setEditMenuOpen(false); }} title="Italique" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><Italic size={12} /></button>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('underline'); setEditMenuOpen(false); }} title="Souligné" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><Underline size={12} /></button>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('code'); setEditMenuOpen(false); }} title="Code" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><Code size={12} /></button>
                                </div>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Structure</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('h1'); setEditMenuOpen(false); }} title="Titre" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><Heading size={12} /></button>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('list'); setEditMenuOpen(false); }} title="Puces" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><List size={12} /></button>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('list-ordered'); setEditMenuOpen(false); }} title="Numéroté" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><ListOrdered size={12} /></button>
                                    <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('quote'); setEditMenuOpen(false); }} title="Citation" style={{ padding: '6px', borderRadius: '7px', border: 'none', background: 'var(--bg-surface)', color: 'var(--text-primary)', display: 'flex', justifyContent: 'center', cursor: 'pointer' }}><Quote size={12} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {showHistoryDirect && (
                            <>
                                {renderToolBtn('undo', 'Annuler (Ctrl+Z)', <Undo2 size={13} strokeWidth={2.2} />)}
                                {renderToolBtn('redo', 'Rétablir (Ctrl+Y)', <Redo2 size={13} strokeWidth={2.2} />)}
                            </>
                        )}

                        <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />

                        {/* ═══ SECTION 2: STYLE BASE (Gras, Italique - TOUJOURS VISIBLES) ═══ */}
                        {renderToolBtn('bold', 'Gras (Ctrl+B)', <Bold size={13} strokeWidth={2.4} />)}
                        {renderToolBtn('italic', 'Italique (Ctrl+I)', <Italic size={13} strokeWidth={2.4} />)}

                        {/* ═══ SECTION 3: FORMAT AVANCÉ (menu si espace insuffisant) ═══ */}
                        {showFormatDirect ? (
                            <>
                                <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />
                                {renderToolBtn('underline', 'Souligné (Ctrl+U)', <Underline size={13} strokeWidth={2.4} />)}
                                {renderToolBtn('code', 'Code en ligne', <Code size={13} strokeWidth={2.2} />)}
                                <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />
                                {renderToolBtn('h1', 'Titre de section', <Heading size={13} strokeWidth={2.2} />)}
                                {renderToolBtn('list', 'Liste à puces', <List size={13} strokeWidth={2.2} />)}
                                {renderToolBtn('list-ordered', 'Liste numérotée', <ListOrdered size={13} strokeWidth={2.2} />)}
                                {renderToolBtn('quote', 'Citation', <Quote size={13} strokeWidth={2.2} />)}
                            </>
                        ) : (
                            <>
                                <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />
                                <div style={{ position: 'relative' }} ref={formatMenuRef}>
                                    <button
                                        type="button"
                                        onMouseDown={e => { e.preventDefault(); setFormatMenuOpen(v => !v); }}
                                        title="Formatage avancé : Souligné, Code, Titre, Listes, Citation"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                                            height: '32px', padding: '0 6px', borderRadius: '8px',
                                            border: formatMenuOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                                            background: formatMenuOpen ? 'var(--bg-hover)' : 'transparent',
                                            color: formatMenuOpen ? 'var(--accent-hover)' : 'var(--text-secondary)',
                                            cursor: 'pointer', transition: 'all 90ms ease', flexShrink: 0
                                        }}
                                    >
                                        <SlidersHorizontal size={12} strokeWidth={2.2} />
                                        <ChevronDown size={10} style={{ opacity: 0.6, transform: formatMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                                    </button>
                                    {formatMenuOpen && (
                                        <div style={{
                                            position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 1600,
                                            background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                                            borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '6px',
                                            minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '2px',
                                            animation: 'islandPopoverInTopCentered 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                        }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Style de texte</div>
                                            <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('underline'); setFormatMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '11.5px', cursor: 'pointer', textAlign: 'left' }}><Underline size={13} /> <span>Souligné (Ctrl+U)</span></button>
                                            <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('code'); setFormatMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '11.5px', cursor: 'pointer', textAlign: 'left' }}><Code size={13} /> <span>Code en ligne</span></button>
                                            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Structure</div>
                                            <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('h1'); setFormatMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '11.5px', cursor: 'pointer', textAlign: 'left' }}><Heading size={13} /> <span>Titre de section</span></button>
                                            <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('list'); setFormatMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '11.5px', cursor: 'pointer', textAlign: 'left' }}><List size={13} /> <span>Liste à puces</span></button>
                                            <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('list-ordered'); setFormatMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '11.5px', cursor: 'pointer', textAlign: 'left' }}><ListOrdered size={13} /> <span>Liste numérotée</span></button>
                                            <button type="button" onMouseDown={e => { e.preventDefault(); handleFormat('quote'); setFormatMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '7px', border: 'none', background: 'transparent', color: 'var(--text-primary)', fontSize: '11.5px', cursor: 'pointer', textAlign: 'left' }}><Quote size={13} /> <span>Citation</span></button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* ═══ SECTION 4: CRYPTOGRAPHIE ═══ */}
                        <div style={{ width: '1px', height: '20px', background: 'var(--border-default)', margin: '0 4px', flexShrink: 0 }} />
                        <div style={{ position: 'relative' }} ref={cipherMenuRef}>
                            <button
                                type="button"
                                onMouseDown={e => { e.preventDefault(); setCipherMenuOpen(v => !v); }}
                                title="Appliquer un codage cryptographique (Morse, Templiers, Maritime...)"
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                                    height: '32px', padding: showCipherLabel ? '0 8px' : '0 6px',
                                    borderRadius: '8px',
                                    border: cipherMenuOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                                    background: cipherMenuOpen ? 'var(--bg-hover)' : 'transparent',
                                    color: cipherMenuOpen ? 'var(--accent-hover)' : 'var(--text-secondary)',
                                    fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 90ms ease', flexShrink: 0
                                }}
                                onMouseEnter={e => { if (!cipherMenuOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (!cipherMenuOpen) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <Type size={13} strokeWidth={2.4} color="var(--accent-hover)" />
                                {showCipherLabel && (
                                    <span style={{
                                        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                                        color: 'var(--accent-hover)', background: 'rgba(37, 99, 235, 0.1)',
                                        border: '1px solid var(--border-subtle)', borderRadius: '4px',
                                        padding: '1px 5px', letterSpacing: '0.04em'
                                    }}>
                                        {CIPHER_FONT_OPTIONS.find(o => o.id === selectedCipher)?.tag || '[morse]'}
                                    </span>
                                )}
                                <ChevronDown size={10} style={{ opacity: 0.6, transform: cipherMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                            </button>
                            {cipherMenuOpen && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 1600,
                                    background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                                    borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '6px',
                                    minWidth: '220px', animation: 'islandPopoverInTopCentered 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Choisir un codage cryptographique</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {CIPHER_FONT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.id} type="button"
                                                onMouseDown={e => { e.preventDefault(); handleFormat('cipher', opt.id); setSelectedCipher(opt.id); setCipherMenuOpen(false); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                                                    padding: '6px 8px', borderRadius: '7px', border: 'none',
                                                    background: selectedCipher === opt.id ? 'var(--accent-transparent)' : 'transparent',
                                                    color: 'var(--text-primary)', fontSize: '11.5px', fontWeight: 600,
                                                    cursor: 'pointer', textAlign: 'left', transition: 'background 80ms'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = selectedCipher === opt.id ? 'var(--accent-transparent)' : 'transparent'}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color, flexShrink: 0 }} />
                                                    <div><div>{opt.label}</div><div style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 400 }}>{opt.tag}</div></div>
                                                </div>
                                                <span className={opt.fontClass} style={{ color: opt.color, fontSize: '13px' }}>{opt.sample}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ═══ SECTION 5: THÈME NARRATIF ═══ */}
                        <div style={{ width: '1px', height: '20px', background: 'var(--border-default)', margin: '0 4px', flexShrink: 0 }} />
                        <div style={{ position: 'relative', flexShrink: 1, minWidth: 0 }} ref={themePickerRef}>
                            <button
                                onClick={() => setThemePickerOpen(v => !v)}
                                title={`Thème narratif actif : ${state.theme_id}`}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    padding: isUltraCompact ? '0 7px' : '0 9px', height: '32px',
                                    borderRadius: '9px',
                                    border: themePickerOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                                    background: themePickerOpen ? 'var(--bg-hover)' : 'transparent',
                                    color: 'var(--text-primary)', fontSize: '11.5px', fontWeight: 500,
                                    cursor: 'pointer', transition: 'all 100ms ease',
                                    maxWidth: isUltraCompact ? '34px' : (showThemeLabel ? '160px' : '110px'),
                                    boxShadow: 'none',
                                }}
                                onMouseEnter={e => { if (!themePickerOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (!themePickerOpen) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <Palette size={13} color={currentAccent.color} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                                {showThemeLabel && !isUltraCompact && (
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px', display: 'inline-block' }}>
                                        {state.theme_id}
                                    </span>
                                )}
                                <ChevronDown size={11} style={{ opacity: 0.6, flexShrink: 0, transform: themePickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                            </button>
                            {themePickerOpen && (
                                <div style={{
                                    position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)', zIndex: 1500,
                                    background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                                    borderRadius: '12px', boxShadow: 'var(--shadow-lg)', padding: '6px',
                                    minWidth: '240px', maxHeight: '360px', overflowY: 'auto',
                                    animation: 'islandPopoverInTopCentered 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)', borderRadius: '8px', marginBottom: '6px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <KeyRound size={12} color="var(--accent-default)" />
                                            <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontWeight: 600 }}>Clé Vigenère :</span>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '11px', color: 'var(--accent-hover)', letterSpacing: '0.08em' }}>{currentTheme.vigenere_key || 'AUCUNE'}</span>
                                    </div>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sélectionner un thème</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {allThemeIds.map(tId => {
                                            const accent = getAccent(tId);
                                            const isCurrent = tId === state.theme_id;
                                            const IconComp = accent.Icon;
                                            return (
                                                <button
                                                    key={tId}
                                                    onClick={() => { dispatch({ type: 'SET_THEME', themeId: tId }); setThemePickerOpen(false); }}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', border: 'none', background: isCurrent ? 'var(--bg-hover)' : 'transparent', color: isCurrent ? 'var(--text-primary)' : 'var(--text-default)', cursor: 'pointer', fontSize: '12px', fontWeight: isCurrent ? 700 : 400, textAlign: 'left', width: '100%', transition: 'all 80ms ease' }}
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
                    </>
                )}
            </div>
        </>
    );
}
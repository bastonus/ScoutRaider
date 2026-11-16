/**
 * TextualHeader.tsx — Barre d'outils flottante VRAIMENT RESPONSIVE.
 * Affiche TOUS les icônes côte à côte tant qu'ils rentrent.
 * Ne regroupe dans le menu "Plus" (≡) que l'excédent qui déborde.
 *
 * Ordre de priorité (derniers à être masqués) :
 *  1. Undo/Redo (historique) — TOUJOURS visibles
 *  2. Bold/Italic (style base) — TOUJOURS visibles
 *  3. Underline/Code (style étendu)
 *  4. Heading/Lists/Quote (structure)
 *  5. Cipher (cryptographie)
 *  6. Theme (thème narratif) — premier à aller dans "Plus"
 *
 * Utilise ResizeObserver + mesure des largeurs réelles pour décider dynamiquement.
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

// ─── Types internes ──────────────────────────────────────────────────────────

interface ToolbarItem {
    id: string;
    priority: number; // plus bas = plus important (reste visible plus longtemps)
    render: (isInOverflow: boolean) => React.ReactNode;
    minWidth: number; // largeur approximative en px
}

interface TextualHeaderProps {
    onExport?: () => void;
}

// ─── Composant principal ────────────────────────────────────────────────────

export default function TextualHeader({ onExport }: TextualHeaderProps = {}) {
    const { state, dispatch } = useApp();
    const [themePickerOpen, setThemePickerOpen] = useState(false);
    const [cipherMenuOpen, setCipherMenuOpen] = useState(false);
    const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
    const [allThemeIds, setAllThemeIds] = useState<string[]>([]);
    const [selectedCipher, setSelectedCipher] = useState<string>('morse');

    const toolbarRef = useRef<HTMLDivElement>(null);
    const overflowRef = useRef<HTMLDivElement>(null);
    const themePickerRef = useRef<HTMLDivElement>(null);
    const cipherMenuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

    const currentAccent = getAccent(state.theme_id);
    const currentTheme = themeManager.getTheme(state.theme_id);
    const isSolution = state.carnet_view === 'solution';

    // Erreurs pour exposition globale
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

    // ─── Construction de la liste des items (ordre de priorité) ─────────────
    const toolbarItems = useMemo<ToolbarItem[]>(() => {
        const items: ToolbarItem[] = [
            // Priorité 0 : Historique — TOUJOURS visible
            { id: 'undo', priority: 0, minWidth: 32, render: () => renderToolBtn('undo', 'Annuler (Ctrl+Z)', <Undo2 size={13} strokeWidth={2.2} />) },
            { id: 'redo', priority: 0, minWidth: 32, render: () => renderToolBtn('redo', 'Rétablir (Ctrl+Y)', <Redo2 size={13} strokeWidth={2.2} />) },

            // Priorité 1 : Style base — TOUJOURS visible
            { id: 'bold', priority: 1, minWidth: 32, render: () => renderToolBtn('bold', 'Gras (Ctrl+B)', <Bold size={13} strokeWidth={2.4} />) },
            { id: 'italic', priority: 1, minWidth: 32, render: () => renderToolBtn('italic', 'Italique (Ctrl+I)', <Italic size={13} strokeWidth={2.4} />) },

            // Priorité 2 : Style étendu
            { id: 'underline', priority: 2, minWidth: 32, render: () => renderToolBtn('underline', 'Souligné (Ctrl+U)', <Underline size={13} strokeWidth={2.4} />) },
            { id: 'code', priority: 2, minWidth: 32, render: () => renderToolBtn('code', 'Code en ligne', <Code size={13} strokeWidth={2.2} />) },

            // Priorité 3 : Structure
            { id: 'h1', priority: 3, minWidth: 32, render: () => renderToolBtn('h1', 'Titre de section', <Heading size={13} strokeWidth={2.2} />) },
            { id: 'list', priority: 3, minWidth: 32, render: () => renderToolBtn('list', 'Liste à puces', <List size={13} strokeWidth={2.2} />) },
            { id: 'list-ordered', priority: 3, minWidth: 32, render: () => renderToolBtn('list-ordered', 'Liste numérotée', <ListOrdered size={13} strokeWidth={2.2} />) },
            { id: 'quote', priority: 3, minWidth: 32, render: () => renderToolBtn('quote', 'Citation', <Quote size={13} strokeWidth={2.2} />) },

            // Priorité 4 : Cryptographie
            {
                id: 'cipher',
                priority: 4,
                minWidth: 70, // icône + badge tag
                render: (inOverflow) => (
                    <div style={{ position: 'relative' }} ref={cipherMenuRef}>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setCipherMenuOpen(v => !v); }}
                            title="Appliquer un codage cryptographique (Morse, Templiers, Maritime...)"
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                height: '32px', padding: inOverflow ? '0 8px' : '0 10px',
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
                            {!inOverflow && (
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
                                            onClick={e => { e.preventDefault(); handleFormat('cipher', opt.id); setSelectedCipher(opt.id); setCipherMenuOpen(false); }}
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
                )
            },

            // Priorité 5 : Thème (premier à aller dans l'overflow)
            {
                id: 'theme',
                priority: 5,
                minWidth: 140, // icône + nom thème tronqué
                render: (inOverflow) => (
                    <div style={{ position: 'relative', flexShrink: inOverflow ? 0 : 1, minWidth: inOverflow ? 0 : 80 }} ref={themePickerRef}>
                        <button
                            onClick={() => setThemePickerOpen(v => !v)}
                            title={`Thème narratif actif : ${state.theme_id}`}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                padding: inOverflow ? '0 7px' : '0 9px', height: '32px',
                                borderRadius: '9px',
                                border: themePickerOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                                background: themePickerOpen ? 'var(--bg-hover)' : 'transparent',
                                color: 'var(--text-primary)', fontSize: '11.5px', fontWeight: 500,
                                cursor: 'pointer', transition: 'all 100ms ease',
                                maxWidth: inOverflow ? '34px' : '180px', minWidth: inOverflow ? '34px' : 0,
                                boxShadow: 'none', overflow: 'hidden',
                            }}
                            onMouseEnter={e => { if (!themePickerOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { if (!themePickerOpen) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <Palette size={13} color={currentAccent.color} strokeWidth={2.2} style={{ flexShrink: 0 }} />
                            {!inOverflow && (
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px', display: 'inline-block' }}>
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
                )
            },
        ];
        return items.sort((a, b) => a.priority - b.priority);
    }, [state.theme_id, currentAccent, currentTheme, isSolution, cipherMenuOpen, themePickerOpen, selectedCipher, allThemeIds]);

    // Handler pour les items du menu overflow
    const handleOverflowItem = useCallback((item: ToolbarItem) => {
        switch (item.id) {
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
            case 'cipher': setCipherMenuOpen(true); break; // ouvre le sous-menu
            case 'theme': setThemePickerOpen(true); break; // ouvre le sous-menu
        }
    }, []);

    // ─── Mesure dynamique de l'overflow ──────────────────────────────────────
    const [visibleItems, setVisibleItems] = useState<Set<string>>(new Set());
    const [containerWidth, setContainerWidth] = useState(800);

    useLayoutEffect(() => {
        const toolbar = toolbarRef.current;
        const overflowBtn = overflowRef.current;
        if (!toolbar) return;

        const measure = () => {
            const containerRect = toolbar.parentElement?.getBoundingClientRect();
            const availableWidth = containerRect ? containerRect.width - 32 : toolbar.clientWidth; // -32 pour padding/marges
            setContainerWidth(availableWidth);

            // Mesurer largeurs réelles de chaque item
            let usedWidth = 0;
            const gap = 2; // gap entre items
            const overflowBtnWidth = overflowBtn?.offsetWidth || 40; // bouton "≡"
            const visible = new Set<string>();

            for (const item of toolbarItems) {
                const el = itemRefs.current.get(item.id);
                const itemWidth = el?.offsetWidth || item.minWidth;
                const neededWidth = usedWidth === 0 ? itemWidth : usedWidth + gap + itemWidth;

                // Réserver place pour le bouton overflow s'il y a encore des items après
                const remainingItems = toolbarItems.filter(i => i.priority > item.priority || (i.priority === item.priority && i.id !== item.id));
                const willNeedOverflow = remainingItems.length > 0;
                const maxAllowed = availableWidth - (willNeedOverflow ? overflowBtnWidth + gap : 0);

                if (neededWidth <= maxAllowed) {
                    visible.add(item.id);
                    usedWidth = neededWidth;
                } else {
                    break; // les suivants (priorité inférieure) iront aussi dans l'overflow
                }
            }

            setVisibleItems(visible);
        };

        // Mesure initiale + ResizeObserver
        measure();
        const ro = new ResizeObserver(() => measure());
        ro.observe(toolbar);
        if (toolbar.parentElement) ro.observe(toolbar.parentElement);

        // Re-mesurer au prochain tick (après rendu)
        requestAnimationFrame(measure);

        return () => ro.disconnect();
    }, [toolbarItems]);

    // ─── Helpers ────────────────────────────────────────────────────────────

    const renderToolBtn = useCallback((format: string, title: string, icon: React.ReactNode, arg?: string) => {
        const refKey = format;
        return (
            <button
                key={refKey}
                ref={(el) => { if (el) itemRefs.current.set(refKey, el); else itemRefs.current.delete(refKey); }}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleFormat(format, arg); }}
                title={title}
                style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: '28px', height: '32px', borderRadius: '8px',
                    border: 'none', background: 'transparent', color: 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 90ms ease', flexShrink: 0
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
                {icon}
            </button>
        );
    }, []);

    const isItemVisible = (id: string) => visibleItems.has(id);
    const overflowItems = toolbarItems.filter(item => !isItemVisible(item.id));

    // ─── Effets divers ──────────────────────────────────────────────────────

    useEffect(() => {
        const tryLoad = () => {
            if (themeManager.isLoaded) setAllThemeIds(themeManager.getThemeIds());
            else setTimeout(tryLoad, 150);
        };
        tryLoad();
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (themePickerRef.current && !themePickerRef.current.contains(target)) setThemePickerOpen(false);
            if (cipherMenuRef.current && !cipherMenuRef.current.contains(target)) setCipherMenuOpen(false);
            if (overflowRef.current && !overflowRef.current.contains(target)) setOverflowMenuOpen(false);
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

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

    // ─── Rendu ──────────────────────────────────────────────────────────────

    return (
        <>
            <style>{`
                @keyframes islandPopoverInTopCentered {
                    0% { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.97); }
                    100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
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
                    // fit-content : largeur = somme items visibles
                }}
            >
                {/* Items visibles dans l'ordre de priorité */}
                {toolbarItems.map(item =>
                    isItemVisible(item.id) ? (
                        <span key={item.id} style={{ display: 'flex', alignItems: 'center' }}>
                            {item.render(false)}
                            {item.id !== toolbarItems[toolbarItems.length - 1]?.id &&
                             <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />
                            }
                        </span>
                    ) : null
                )}

                {/* Bouton overflow "≡" — seulement s'il y a des items masqués */}
                {overflowItems.length > 0 && (
                    <div style={{ position: 'relative' }} ref={overflowRef}>
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); setOverflowMenuOpen(v => !v); }}
                            title={`${overflowItems.length} outil${overflowItems.length > 1 ? 's' : ''} supplémentaire${overflowItems.length > 1 ? 's' : ''}`}
                            style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '32px', height: '32px', borderRadius: '8px',
                                border: overflowMenuOpen ? '1px solid var(--accent-default)' : '1px solid transparent',
                                background: overflowMenuOpen ? 'var(--bg-hover)' : 'transparent',
                                color: overflowMenuOpen ? 'var(--accent-hover)' : 'var(--text-secondary)',
                                cursor: 'pointer', transition: 'all 90ms ease', flexShrink: 0
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
                                minWidth: '200px', animation: 'islandPopoverInTopCentered 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                            }}>
                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                                    Outils supplémentaires
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {overflowItems.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={e => { e.preventDefault(); setOverflowMenuOpen(false); handleOverflowItem(item); }}
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
                                            {/* Icône indicative selon l'item */}
                                            {item.id === 'theme' && <Palette size={14} color={currentAccent.color} />}
                                            {item.id === 'cipher' && <Type size={14} color="var(--accent-hover)" />}
                                            {['underline','code','h1','list','list-ordered','quote'].includes(item.id) && <SlidersHorizontal size={14} />}
                                            {['undo','redo'].includes(item.id) && <Edit3 size={14} />}
                                            <span>{item.id === 'theme' ? `Thème : ${state.theme_id}` :
                                                  item.id === 'cipher' ? `Cryptographie : ${CIPHER_FONT_OPTIONS.find(o => o.id === selectedCipher)?.label}` :
                                                  item.id === 'underline' ? 'Souligné' :
                                                  item.id === 'code' ? 'Code en ligne' :
                                                  item.id === 'h1' ? 'Titre' :
                                                  item.id === 'list' ? 'Liste à puces' :
                                                  item.id === 'list-ordered' ? 'Liste numérotée' :
                                                  item.id === 'quote' ? 'Citation' :
                                                  item.id === 'undo' ? 'Annuler' : 'Rétablir'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
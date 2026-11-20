/**
 * FontSelector.tsx — Sélecteur de polices pour l'éditeur
 * Permet de choisir la police de base, des titres, et monospace
 * Par bloc ou globalement
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronDown, X, Check, Type, Heading1, Heading2, Heading3, Code2, Lock } from 'lucide-react';
import { FONT_PRESETS, CIPHER_FONTS } from './MarkdownRenderer';

interface FontSelectorProps {
    /** Configuration actuelle des polices */
    fontConfig: {
        baseFont?: string;
        headingFonts?: Record<number, string>;
        monoFont?: string;
    };
    /** Callback quand la config change */
    onChange: (config: FontSelectorProps['fontConfig']) => void;
    /** Titre du panel */
    title?: string;
    /** Mode compact pour inline */
    compact?: boolean;
    /** ID du bloc (pour contexte) */
    blockId?: string;
}

const DEFAULT_CONFIG = {
    baseFont: FONT_PRESETS.base[0].font,
    headingFonts: { 1: 'inherit', 2: 'inherit', 3: 'inherit' } as Record<number, string>,
    monoFont: FONT_PRESETS.mono[0].font,
};

export default function FontSelector({
    fontConfig = DEFAULT_CONFIG,
    onChange,
    title = 'Polices',
    compact = false,
    blockId
}: FontSelectorProps) {
    const [openCategory, setOpenCategory] = useState<'base' | 'heading' | 'mono' | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const mergedConfig = useMemo(() => ({
        baseFont: fontConfig.baseFont || DEFAULT_CONFIG.baseFont,
        headingFonts: { ...DEFAULT_CONFIG.headingFonts, ...fontConfig.headingFonts },
        monoFont: fontConfig.monoFont || DEFAULT_CONFIG.monoFont,
    }), [fontConfig]);

    // Clic extérieur pour fermer
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpenCategory(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFontChange = (category: 'base' | 'heading' | 'mono', levelOrFont: number | string) => {
        const newConfig = { ...mergedConfig };
        if (category === 'base') {
            newConfig.baseFont = levelOrFont as string;
        } else if (category === 'mono') {
            newConfig.monoFont = levelOrFont as string;
        } else {
            newConfig.headingFonts = { ...newConfig.headingFonts, [levelOrFont as number]: levelOrFont === 'inherit' ? 'inherit' : (FONT_PRESETS.heading.find(f => f.font === levelOrFont)?.font || levelOrFont as string) };
        }
        onChange(newConfig);
    };

    const getFontLabel = (font: string, presets: typeof FONT_PRESETS.base) => {
        const found = presets.find(f => f.font === font);
        return found?.label || font;
    };

    const getCurrentFont = (category: 'base' | 'heading' | 'mono', level?: number) => {
        if (category === 'base') return mergedConfig.baseFont;
        if (category === 'mono') return mergedConfig.monoFont;
        return (mergedConfig.headingFonts as Record<number, string>)[level!] || 'inherit';
    };

    const renderFontOptions = (category: 'base' | 'heading' | 'mono', level?: number) => {
        const presets = category === 'base' ? FONT_PRESETS.base :
                        category === 'heading' ? FONT_PRESETS.heading :
                        FONT_PRESETS.mono;
        const currentFont = getCurrentFont(category, level);

        return presets.map(preset => (
            <button
                key={preset.id}
                type="button"
                onClick={() => {
                    handleFontChange(category, level !== undefined ? level : preset.font);
                    setOpenCategory(null);
                }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    width: '100%', padding: '8px 10px',
                    border: 'none', background: preset.font === currentFont ? 'var(--accent-transparent)' : 'transparent',
                    color: 'var(--text-primary)', fontSize: '12px',
                    fontWeight: preset.font === currentFont ? 600 : 400,
                    textAlign: 'left', cursor: 'pointer',
                    fontFamily: preset.font, // Preview de la police
                    transition: 'background 80ms ease',
                }}
                onMouseEnter={e => { if (preset.font !== currentFont) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (preset.font !== currentFont) e.currentTarget.style.background = 'transparent'; }}
            >
                {preset.font === currentFont && <Check size={14} color="var(--accent-hover)" strokeWidth={2.5} style={{ flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{preset.label}</span>
            </button>
        ));
    };

    const CategoryButton = ({ category, label, icon, level }: { category: 'base' | 'heading' | 'mono'; label: string; icon: React.ReactNode; level?: number }) => {
        const isOpen = openCategory === category;
        const currentFont = getCurrentFont(category, level);
        const presets = category === 'base' ? FONT_PRESETS.base :
                        category === 'heading' ? FONT_PRESETS.heading :
                        FONT_PRESETS.mono;
        const currentPreset = presets.find(p => p.font === currentFont);

        return (
            <div style={{ position: 'relative' }}>
                <button
                    type="button"
                    onClick={() => setOpenCategory(isOpen ? null : category)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: compact ? '6px 8px' : '8px 10px',
                        borderRadius: '8px', border: `1px solid ${isOpen ? 'var(--accent-default)' : 'var(--border-subtle)'}`,
                        background: isOpen ? 'var(--bg-hover)' : 'transparent',
                        color: 'var(--text-primary)', fontSize: compact ? '11px' : '12px',
                        fontWeight: 500, cursor: 'pointer',
                        transition: 'all 100ms ease',
                        minWidth: compact ? '140px' : '180px',
                    }}
                    onMouseEnter={e => { if (!isOpen) e.currentTarget.style.borderColor = 'var(--accent-hover)'; }}
                    onMouseLeave={e => { if (!isOpen) e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                >
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', color: 'var(--accent-hover)' }}>
                        {icon}
                    </span>
                    <span style={{ flex: 1, textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: currentFont }}>
                        {currentPreset?.label || label}
                    </span>
                    <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease', color: 'var(--text-dim)' }} />
                </button>

                {isOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '10px',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '6px',
                        maxHeight: '280px',
                        overflowY: 'auto',
                        animation: 'islandPopoverIn 120ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}>
                        {category === 'heading' && level !== undefined ? (
                            <div style={{ padding: '4px 8px 6px', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Police pour H{level}
                            </div>
                        ) : null}
                        {renderFontOptions(category, level)}
                    </div>
                )}
            </div>
        );
    };

    if (compact) {
        return (
            <div ref={containerRef} className="font-selector-compact" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <CategoryButton category="base" label="Texte" icon={<Type size={12} />} />
                <CategoryButton category="heading" label="H1" icon={<Heading1 size={12} />} level={1} />
                <CategoryButton category="heading" label="H2" icon={<Heading2 size={12} />} level={2} />
                <CategoryButton category="heading" label="H3" icon={<Heading3 size={12} />} level={3} />
                <CategoryButton category="mono" label="Code" icon={<Code2 size={12} />} />
            </div>
        );
    }

    return (
        <div ref={containerRef} className="font-selector" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: compact ? '0' : '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Type size={16} color="var(--accent-hover)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</span>
                {blockId && <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Bloc: {blockId.slice(0, 12)}</span>}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <CategoryButton category="base" label="Police de base" icon={<Type size={14} />} />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <CategoryButton category="heading" label="H1" icon={<Heading1 size={14} />} level={1} />
                    <CategoryButton category="heading" label="H2" icon={<Heading2 size={14} />} level={2} />
                    <CategoryButton category="heading" label="H3" icon={<Heading3 size={14} />} level={3} />
                </div>
                <CategoryButton category="mono" label="Police monospace (code)" icon={<Code2 size={14} />} />
            </div>

            {/* Polices de chiffrement spéciales (info seulement) */}
            <details style={{ marginTop: '8px', padding: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={12} />
                    Polices de chiffrement (automatiques)
                </summary>
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px', fontSize: '10px' }}>
                    {Object.entries(CIPHER_FONTS).map(([cipher, font]) => (
                        <div key={cipher} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', background: 'var(--bg-base)', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-hover)', flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{cipher}</span>
                            <span style={{ flex: 1, color: 'var(--text-dim)', fontFamily: font, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Aperçu</span>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}
/**
 * MarkdownRenderer.tsx — Rendu Markdown complet avec support :
 * - HTML tags (balises personnalisées pour chiffrement)
 * - Formules LaTeX (KaTeX)
 * - Polices personnalisées par bloc
 * - Blocs de code chiffrés
 * - Aides à l'écriture (auto-complétion markdown)
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import DOMPurify from 'dompurify';
import { Waves, Key, Grid, Hash, Flag, RotateCcw, Minus, Type } from 'lucide-react';
import { ModuleLogic } from '../../logic/ModuleLogic';
import { MODULE_META } from '../../logic/ModuleRegistry';
import type { ModuleId } from '../../logic/types';

interface MarkdownRendererProps {
    content: string;
    /** Configuration des polices pour ce bloc */
    fontConfig?: {
        baseFont?: string;
        headingFonts?: Record<number, string>;
        monoFont?: string;
    };
    /** Modules de chiffrement actifs pour ce bloc */
    cipherModules?: string[];
    /** Mode affichage : 'participant' (chiffré) | 'solution' (clair) | 'edit' (édition) */
    viewMode?: 'participant' | 'solution' | 'edit';
    /** Callback quand le contenu change (mode edit) */
    onChange?: (newContent: string) => void;
    /** ID unique pour ce rendu */
    blockId?: string;
    /** Classe CSS additionnelle */
    className?: string;
    /** Styles CSS en ligne */
    style?: React.CSSProperties;
}

/**
 * Configuration des polices disponibles
 */
export const FONT_PRESETS = {
    base: [
        { id: 'system', label: 'Système', font: 'system-ui, sans-serif' },
        { id: 'inter', label: 'Inter', font: '"Inter", system-ui, sans-serif' },
        { id: 'roboto', label: 'Roboto', font: '"Roboto", system-ui, sans-serif' },
        { id: 'opensans', label: 'Open Sans', font: '"Open Sans", system-ui, sans-serif' },
        { id: 'lato', label: 'Lato', font: '"Lato", system-ui, sans-serif' },
        { id: 'merriweather', label: 'Merriweather', font: '"Merriweather", Georgia, serif' },
        { id: 'playfair', label: 'Playfair Display', font: '"Playfair Display", Georgia, serif' },
        { id: 'source-serif', label: 'Source Serif Pro', font: '"Source Serif Pro", Georgia, serif' },
        { id: 'cormorant', label: 'Cormorant Garamond', font: '"Cormorant Garamond", Georgia, serif' },
    ],
    heading: [
        { id: 'system', label: 'Héritée', font: 'inherit' },
        { id: 'inter', label: 'Inter', font: '"Inter", system-ui, sans-serif' },
        { id: 'roboto', label: 'Roboto', font: '"Roboto", system-ui, sans-serif' },
        { id: 'oswald', label: 'Oswald', font: '"Oswald", sans-serif' },
        { id: 'montserrat', label: 'Montserrat', font: '"Montserrat", sans-serif' },
        { id: 'poppins', label: 'Poppins', font: '"Poppins", sans-serif' },
        { id: 'playfair', label: 'Playfair Display', font: '"Playfair Display", Georgia, serif' },
        { id: 'merriweather', label: 'Merriweather', font: '"Merriweather", Georgia, serif' },
        { id: 'cormorant', label: 'Cormorant Garamond', font: '"Cormorant Garamond", Georgia, serif' },
        { id: 'cinzel', label: 'Cinzel', font: '"Cinzel", serif' },
    ],
    mono: [
        { id: 'system', label: 'Système', font: 'ui-monospace, SFMono-Regular, monospace' },
        { id: 'fira', label: 'Fira Code', font: '"Fira Code", "Courier New", monospace' },
        { id: 'jetbrains', label: 'JetBrains Mono', font: '"JetBrains Mono", monospace' },
        { id: 'source-code', label: 'Source Code Pro', font: '"Source Code Pro", monospace' },
        { id: 'ibm-plex', label: 'IBM Plex Mono', font: '"IBM Plex Mono", monospace' },
        { id: 'cascadia', label: 'Cascadia Code', font: '"Cascadia Code", monospace' },
    ],
};

// Polices de chiffrement spéciales
export const CIPHER_FONTS: Record<string, string> = {
    morse: '"Morse", "Courier New", monospace',
    polybe: '"Courier New", monospace',
    vigenere: '"Courier New", monospace',
    templier: '"TemplarsCipherPlus", "Times New Roman", serif',
    cassis: '"Kalam", cursive, sans-serif',
    avocat: '"Kalam", cursive, sans-serif',
    maritime: '"Maritime", "Courier New", monospace',
    gilwell: '"Inter", sans-serif',
    drapeaux: '"Inter", sans-serif',
};

// Tailles par défaut pour les polices de chiffrement
export const CIPHER_FONT_SIZES: Record<string, string> = {
    morse: '24px',
    templier: '28px',
    cassis: '16px',
    avocat: '16px',
    vigenere: '14px',
    polybe: '14px',
    maritime: '32px',
    default: '14px',
};

// Icônes pour chaque type de chiffrement (utilisées dans le gutter et menus)
export const CIPHER_ICONS: Record<string, React.ReactNode> = {
    morse: <Waves size={14} />,
    vigenere: <Key size={14} />,
    polybe: <Grid size={14} />,
    templier: <Hash size={14} />,
    maritime: <Flag size={14} />,
    avocat: <RotateCcw size={14} />,
    cassis: <Minus size={14} />,
    texte_clair: <Type size={14} />,
};

/**
 * Configure marked pour supporter nos extensions
 */
function configureMarked() {
    marked.use({
        gfm: true,
        breaks: true,
        // Extension pour LaTeX inline $...$ et block $$...$$
        extensions: [
            {
                name: 'katex',
                level: 'inline',
                start(src) { return src.indexOf('$'); },
                tokenizer(src, tokens) {
                    const match = src.match(/^\$([^$\n]+?)\$/);
                    if (match) {
                        return { type: 'katex_inline', raw: match[0], text: match[1] };
                    }
                    const blockMatch = src.match(/^\$\$([\s\S]*?)\$\$/);
                    if (blockMatch) {
                        return { type: 'katex_block', raw: blockMatch[0], text: blockMatch[1] };
                    }
                },
                renderer(token) {
                    if (token.type === 'katex_inline') {
                        try {
                            return katex.renderToString(token.text, { displayMode: false, throwOnError: false });
                        } catch { return `$${token.text}$`; }
                    }
                    if (token.type === 'katex_block') {
                        try {
                            return `<div class="katex-block">${katex.renderToString(token.text, { displayMode: true, throwOnError: false })}</div>`;
                        } catch { return `$$${token.text}$$`; }
                    }
                    return '';
                }
            }
        ]
    });
}

/**
 * Protège les balises de chiffrement personnalisées avant le parsing marked
 */
function protectCipherTags(raw: string, viewMode: 'participant' | 'solution' | 'edit' = 'participant'): { protected: string; placeholders: Map<string, string> } {
    const placeholders = new Map<string, string>();
    let protected_ = raw;
    let counter = 0;

    const cipherTags = ['morse', 'templier', 'maritime', 'polybe', 'vigenere', 'avocat', 'cassis', 'drapeaux'];

    cipherTags.forEach(tag => {
        const regex = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`, 'gi');
        protected_ = protected_.replace(regex, (_match, content) => {
            const placeholder = `__CIPHER_${tag}_${counter++}__`;
            let display = content;
            if (viewMode === 'participant') {
                try {
                    display = ModuleLogic.encode(tag, content);
                } catch {
                    display = content;
                }
            }
            placeholders.set(placeholder, `<span class="font-${tag} cipher-inline" data-cipher="${tag}" title="${escapeHtml(content)}">${escapeHtml(display)}</span>`);
            return placeholder;
        });

        // Supporter aussi les balises XML-style <tag>...</tag>
        const xmlRegex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
        protected_ = protected_.replace(xmlRegex, (_match, content) => {
            const placeholder = `__CIPHER_${tag}_${counter++}__`;
            let display = content;
            if (viewMode === 'participant') {
                try {
                    display = ModuleLogic.encode(tag, content);
                } catch {
                    display = content;
                }
            }
            placeholders.set(placeholder, `<span class="font-${tag} cipher-inline" data-cipher="${tag}" title="${escapeHtml(content)}">${escapeHtml(display)}</span>`);
            return placeholder;
        });
    });

    // Blocs de code ```
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    protected_ = protected_.replace(codeBlockRegex, (_match, lang, code) => {
        const placeholder = `__CODEBLOCK_${counter++}__`;
        const lowerLang = (lang || '').toLowerCase().trim();
        if (cipherTags.includes(lowerLang) || lowerLang === 'texte_clair') {
            const meta = MODULE_META[lowerLang as ModuleId];
            const color = meta?.color || '#6b7280';
            const label = meta?.label || lowerLang.toUpperCase();
            let bodyText = code.trim();
            if (viewMode === 'participant') {
                try {
                    bodyText = ModuleLogic.encode(lowerLang, bodyText);
                } catch {
                    bodyText = code.trim();
                }
            }
            placeholders.set(placeholder, `
                <div class="cipher-card cipher-card-${lowerLang}" data-cipher="${lowerLang}">
                    <div class="cipher-card-header">
                        <span class="cipher-dot" style="background: ${color};"></span>
                        <span class="cipher-title">${escapeHtml(label)}</span>
                    </div>
                    <div class="cipher-card-body font-${lowerLang}">${escapeHtml(bodyText)}</div>
                </div>
            `.trim());
        } else {
            placeholders.set(placeholder, `<pre class="code-block${lang ? ` language-${lang}` : ''}"><code>${escapeHtml(code)}</code></pre>`);
        }
        return placeholder;
    });

    // Protéger code inline `
    const inlineCodeRegex = /`([^`\n]+)`/g;
    protected_ = protected_.replace(inlineCodeRegex, (_match, code) => {
        const placeholder = `__INLINECODE_${counter++}__`;
        placeholders.set(placeholder, `<code class="inline-code">${escapeHtml(code)}</code>`);
        return placeholder;
    });

    return { protected: protected_, placeholders };
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Restaure les placeholders après le parsing marked
 */
function restorePlaceholders(html: string, placeholders: Map<string, string>): string {
    let result = html;
    placeholders.forEach((replacement, placeholder) => {
        result = result.replace(new RegExp(escapeRegExp(placeholder), 'g'), replacement);
    });
    return result;
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitize HTML pour la sécurité (DOMPurify)
 */
function sanitizeHtml(html: string): string {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
            'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'hr',
            'a', 'img', 'span', 'div',
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            'sub', 'sup', 'mark', 'del', 'ins',
            'details', 'summary'
        ],
        ALLOWED_ATTR: [
            'href', 'src', 'alt', 'title', 'class', 'id', 'style',
            'data-cipher', 'data-latex', 'target', 'rel'
        ],
        ALLOW_DATA_ATTR: true,
    });
}

/**
 * Génère les styles CSS dynamiques pour les polices
 */
function generateFontStyles(fontConfig?: MarkdownRendererProps['fontConfig']): string {
    if (!fontConfig) return '';

    let styles = '';

    // Police de base
    if (fontConfig.baseFont) {
        styles += `.markdown-renderer { font-family: ${fontConfig.baseFont} !important; }`;
    }

    // Polices des titres
    if (fontConfig.headingFonts) {
        Object.entries(fontConfig.headingFonts).forEach(([level, font]) => {
            if (font !== 'inherit') {
                styles += `.markdown-renderer h${level} { font-family: ${font} !important; }`;
            }
        });
    }

    // Police monospace
    if (fontConfig.monoFont) {
        styles += `.markdown-renderer code, .markdown-renderer pre, .markdown-renderer .font-mono-tag { font-family: ${fontConfig.monoFont} !important; }`;
    }

    // Polices de chiffrement
    Object.entries(CIPHER_FONTS).forEach(([cipher, font]) => {
        const size = CIPHER_FONT_SIZES[cipher] || CIPHER_FONT_SIZES.default;
        styles += `.markdown-renderer .font-${cipher} { font-family: ${font} !important; font-size: ${size} !important; }`;
    });

    return styles;
}

/**
 * Composant principal de rendu Markdown
 */
export default function MarkdownRenderer({
    content,
    fontConfig,
    cipherModules = [],
    viewMode = 'participant',
    onChange,
    blockId,
    className = '',
    style
}: MarkdownRendererProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [renderedHtml, setRenderedHtml] = useState<string>('');
    const [isEditing, setIsEditing] = useState(viewMode === 'edit');
    const [editContent, setEditContent] = useState(content);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Configuration marked au premier rendu
    useEffect(() => {
        configureMarked();
    }, []);

    // Rendu du Markdown → HTML
    useEffect(() => {
        if (!content) {
            setRenderedHtml('');
            return;
        }

        try {
            // 1. Protéger les balises spéciales
            const { protected: protectedContent, placeholders } = protectCipherTags(content, viewMode);

            // 2. Parser avec marked
            let html = marked.parse(protectedContent) as string;

            // 3. Restaurer les placeholders
            html = restorePlaceholders(html, placeholders);

            // 4. Sanitize
            html = sanitizeHtml(html);

            // 5. Post-traitement pour les classes cipher
            html = html.replace(/class="font-(\w+)"/g, (match, cipher) => {
                if (CIPHER_FONTS[cipher]) {
                    return `class="font-${cipher}" data-cipher="${cipher}"`;
                }
                return match;
            });

            setRenderedHtml(html);
        } catch (e) {
            console.error('Markdown render error:', e);
            setRenderedHtml(`<p class="render-error">Erreur de rendu: ${escapeHtml(String(e))}</p>`);
        }
    }, [content, cipherModules, viewMode]);

    // Styles dynamiques
    const fontStyles = useMemo(() => generateFontStyles(fontConfig), [fontConfig]);

    // Gestion édition
    const handleEdit = () => {
        setEditContent(content);
        setIsEditing(true);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleSave = () => {
        onChange?.(editContent);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditContent(content);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSave();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
        if (e.key === 'Tab') {
            e.preventDefault();
            const target = e.currentTarget as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const newContent = editContent.substring(0, start) + '  ' + editContent.substring(end);
            setEditContent(newContent);
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
                }
            }, 0);
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing, editContent]);

    // Double-clic pour éditer
    const handleDoubleClick = () => {
        if (viewMode !== 'edit' && onChange) {
            handleEdit();
        }
    };

    // Styles CSS par défaut pour le rendu markdown (injectés via <style>) - DOIT être avant le early return
    const defaultRenderStyles = useMemo(() => `
        .markdown-renderer {
            min-height: 24px;
            line-height: 1.7;
            color: var(--text-primary);
            font-size: 14px;
        }
        .markdown-renderer h1 { font-size: 2em; font-weight: 700; margin: 0.67em 0; }
        .markdown-renderer h2 { font-size: 1.5em; font-weight: 700; margin: 0.75em 0 0.5em; }
        .markdown-renderer h3 { font-size: 1.25em; font-weight: 600; margin: 0.83em 0 0.5em; }
        .markdown-renderer p { margin: 0.5em 0; }
        .markdown-renderer ul, .markdown-renderer ol { margin: 0.5em 0; padding-left: 1.5em; }
        .markdown-renderer li { margin: 0.25em 0; }
        .markdown-renderer blockquote { border-left: 3px solid var(--accent-default); padding-left: 1em; margin: 1em 0; color: var(--text-dim); font-style: italic; }
        .markdown-renderer code { background: rgba(255,255,255,0.08); padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
        .markdown-renderer pre { background: var(--bg-base); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 1em; overflow: auto; margin: 1em 0; }
        .markdown-renderer pre code { background: transparent; padding: 0; font-size: 0.85em; }
        .markdown-renderer hr { border: none; border-top: 1px solid var(--border-subtle); margin: 1.5em 0; }
        .markdown-renderer table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 13px; }
        .markdown-renderer th, .markdown-renderer td { border: 1px solid var(--border-subtle); padding: 6px 10px; text-align: left; }
        .markdown-renderer th { background: rgba(255,255,255,0.04); font-weight: 600; color: var(--text-primary); }
        .markdown-renderer .katex-block { margin: 1em 0; text-align: center; overflow: auto; }
        .markdown-renderer .katex { font-size: 1.1em !important; }
        .markdown-renderer .cipher-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; margin: 10px 0; overflow: hidden; }
        .markdown-renderer .cipher-card-header { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border-subtle); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-dim); }
        .markdown-renderer .cipher-card-body { padding: 10px 14px; line-height: 1.6; word-break: break-word; }
        .markdown-renderer .cipher-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .markdown-renderer .cipher-inline { padding: 2px 4px; border-radius: 4px; background: rgba(255,255,255,0.04); border-bottom: 1px dashed var(--border-strong); }
        .markdown-renderer .font-morse { font-family: "Morse", "Courier New", monospace; font-size: 1.2em; letter-spacing: 0.12em; display: inline-block; }
        .markdown-renderer .font-templier { font-family: "TemplarsCipherPlus", "Times New Roman", serif; font-size: 1.25em; letter-spacing: 0.08em; display: inline-block; }
        .markdown-renderer .font-maritime { font-family: "Maritime", "Courier New", monospace; font-size: 1.3em; letter-spacing: 0.08em; display: inline-block; }
        .markdown-renderer .font-polybe, .markdown-renderer .font-vigenere, .markdown-renderer .font-avocat, .markdown-renderer .font-cassis { font-family: "Courier New", monospace; }
        .markdown-renderer .font-code { font-family: var(--font-mono); background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 4px; }
        .markdown-renderer .render-error { color: var(--semantic-danger); font-size: 0.9em; font-style: italic; }
    `, []);

    if (isEditing) {
        return (
            <div className={`markdown-editor ${className}`} ref={containerRef} style={{ minHeight: '60px' }}>
                <style dangerouslySetInnerHTML={{ __html: fontStyles }} />
                <style dangerouslySetInnerHTML={{ __html: defaultRenderStyles }} />
                <div style={{
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    background: 'var(--bg-surface)', border: '1px solid var(--accent-default)',
                    borderRadius: '8px', padding: '12px'
                }}>
                    <textarea
                        ref={textareaRef}
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={handleSave}
                        placeholder="Écrivez en Markdown… (# titre, **gras**, *italique*, $latex$, ```code```, [morse]...[/morse])"
                        style={{
                            width: '100%', minHeight: '100px',
                            background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                            borderRadius: '6px', color: 'var(--text-primary)',
                            fontSize: '13px', fontFamily: 'var(--font-mono)', lineHeight: 1.6,
                            padding: '10px', resize: 'vertical', outline: 'none',
                            boxSizing: 'border-box', fontFeatureSettings: '"liga" 1'
                        }}
                        spellCheck={true}
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={handleCancel} style={{
                            padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)',
                            background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px'
                        }}>Annuler</button>
                        <button onClick={handleSave} style={{
                            padding: '6px 12px', borderRadius: '6px', border: 'none',
                            background: 'var(--accent-default)', color: 'var(--accent-primary-text)', cursor: 'pointer', fontSize: '12px', fontWeight: 600
                        }}>Valider</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`markdown-renderer ${className}`}
            ref={containerRef}
            onDoubleClick={handleDoubleClick}
            style={{ minHeight: '24px', ...style }}
        >
            <style dangerouslySetInnerHTML={{ __html: fontStyles }} />
            <style dangerouslySetInnerHTML={{ __html: defaultRenderStyles }} />
            <div
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                style={{ minHeight: '24px', display: 'block' }}
            />
        </div>
    );
}
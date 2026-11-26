/**
 * liveMarkdown.ts — Conversion bidirectionnelle Markdown inline + LaTeX <-> HTML
 * et transformation en direct (Live Preview) dès que ** **, * *, ` ` ou $ $ sont fermés.
 */
import katex from 'katex';
import { getWordBounds } from './editorCommands';

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
    return escapeHtml(str).replace(/"/g, '&quot;');
}

function renderLatexElementHtml(expr: string, displayMode: boolean): string {
    const rendered = katex.renderToString(expr, { displayMode, throwOnError: false });
    if (displayMode) {
        return `<span class="sr-katex-block" contenteditable="false" data-latex="${escapeAttr(expr)}" data-display="1" style="display:block;text-align:center;margin:6px 0;user-select:all">${rendered}</span>`;
    }
    return `<span class="sr-katex" contenteditable="false" data-latex="${escapeAttr(expr)}" data-display="0" style="display:inline-block;vertical-align:middle;padding:0 2px;user-select:all">${rendered}</span>`;
}

/**
 * Convertit du Markdown inline (**gras**, *italique*, <u>souligné</u>, `code`, [lien](url), $latex$, $$latex$$)
 * en HTML sûr pour un champ contentEditable.
 */
export function inlineMarkdownToHtml(md: string): string {
    if (!md) return '';
    // Protéger les blocs LaTeX ($$...$$ puis $...$) et <u>...</u> avant l'échappement
    const latexTokens: Array<{ expr: string; display: boolean }> = [];
    let safe = md.replace(/\$\$([\s\S]+?)\$\$/g, (_m, expr) => {
        const idx = latexTokens.length;
        latexTokens.push({ expr: expr.trim(), display: true });
        return `@@LATEX_TOKEN_${idx}@@`;
    });
    safe = safe.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_m, expr) => {
        const idx = latexTokens.length;
        latexTokens.push({ expr: expr.trim(), display: false });
        return `@@LATEX_TOKEN_${idx}@@`;
    });

    const uTokens: string[] = [];
    safe = safe.replace(/<u>([\s\S]*?)<\/u>/g, (_m, inner) => {
        const idx = uTokens.length;
        uTokens.push(inner);
        return `@@U_TOKEN_${idx}@@`;
    });

    safe = escapeHtml(safe);

    // Restaurer <u>...</u> avec contenu échappé
    safe = safe.replace(/@@U_TOKEN_(\d+)@@/g, (_m, idx) => {
        const inner = escapeHtml(uTokens[Number(idx)] ?? '');
        return `<u>${inner}</u>`;
    });

    // Liens [label](url)
    safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
        return `<a href="${url.replace(/"/g, '&quot;')}" style="color:var(--accent-hover);text-decoration:underline">${label}</a>`;
    });

    // Code inline `...`
    safe = safe.replace(/`([^`\n]+)`/g, (_m, code) => {
        return `<code style="font-family:var(--font-mono);font-size:0.9em;background:var(--bg-hover);padding:1px 5px;border-radius:4px">${code}</code>`;
    });

    // Gras **...**
    safe = safe.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');

    // Italique *...*
    safe = safe.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');

    // Restaurer LaTeX rendu avec KaTeX
    safe = safe.replace(/@@LATEX_TOKEN_(\d+)@@/g, (_m, idx) => {
        const tok = latexTokens[Number(idx)];
        return tok ? renderLatexElementHtml(tok.expr, tok.display) : '';
    });

    // Sauts de ligne
    safe = safe.replace(/\n/g, '<br>');

    return safe;
}

/**
 * Sérialise un nœud DOM contentEditable en Markdown inline propre.
 */
export function domToInlineMarkdown(root: HTMLElement): string {
    const serializeNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            return (node.textContent || '').replace(/\u00A0/g, ' ').replace(/\u200B/g, '');
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';

        const el = node as HTMLElement;
        const latexAttr = el.getAttribute('data-latex');
        if (latexAttr !== null) {
            return el.getAttribute('data-display') === '1' ? `$$${latexAttr}$$` : `$${latexAttr}$`;
        }

        const tag = el.tagName.toUpperCase();
        if (tag === 'BR') return '\n';

        const inner = Array.from(el.childNodes).map(serializeNode).join('');
        if (!inner && (tag === 'DIV' || tag === 'P')) return '\n';

        switch (tag) {
            case 'STRONG':
            case 'B':
                return inner ? `**${inner}**` : '';
            case 'EM':
            case 'I':
                return inner ? `*${inner}*` : '';
            case 'U':
                return inner ? `<u>${inner}</u>` : '';
            case 'CODE':
                return inner ? `\`${inner}\`` : '';
            case 'A': {
                const href = el.getAttribute('href') || 'https://';
                return `[${inner}](${href})`;
            }
            case 'DIV':
            case 'P':
                return el.previousSibling ? `\n${inner}` : inner;
            default:
                return inner;
        }
    };

    const raw = Array.from(root.childNodes).map(serializeNode).join('');
    return raw.replace(/\n$/, '');
}

/**
 * Détecte si l'utilisateur vient de fermer **texte**, *texte* ou `texte` dans un nœud texte
 * du contentEditable, et le transforme immédiatement en élément HTML formaté en gardant le curseur.
 */
export function applyAutoMarkdownInEditable(root: HTMLElement): boolean {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel || sel.rangeCount === 0) return false;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
        const textNode = node as Text;
        // Ne pas re-transformer à l'intérieur d'un <code> ou d'un bloc KaTeX
        if (textNode.parentElement?.closest('code, [data-latex]')) continue;
        const val = textNode.textContent || '';

        // 1. LaTeX en direct ($$...$$ puis $...$)
        const latexBlockMatch = val.match(/\$\$([^$\n]+)\$\$/);
        const latexInlineMatch = !latexBlockMatch ? val.match(/(^|[^\\])(\$[^$\n]+\$)(?!\$)/) : null;
        if (latexBlockMatch || latexInlineMatch) {
            const isBlock = Boolean(latexBlockMatch);
            const fullMatch = isBlock ? latexBlockMatch![0] : latexInlineMatch![2];
            const expr = (isBlock ? latexBlockMatch![1] : latexInlineMatch![2].slice(1, -1)).trim();
            if (expr) {
                const matchIndex = isBlock
                    ? (latexBlockMatch!.index ?? 0)
                    : (latexInlineMatch!.index ?? 0) + latexInlineMatch![1].length;
                const before = val.slice(0, matchIndex);
                const after = val.slice(matchIndex + fullMatch.length);
                const parent = textNode.parentNode;
                if (!parent) continue;

                const wrapper = document.createElement('span');
                wrapper.innerHTML = renderLatexElementHtml(expr, isBlock);
                const katexEl = wrapper.firstElementChild;
                if (!katexEl) continue;

                const afterNode = document.createTextNode(after || '\u200B');
                if (before) parent.insertBefore(document.createTextNode(before), textNode);
                parent.insertBefore(katexEl, textNode);
                parent.insertBefore(afterNode, textNode);
                parent.removeChild(textNode);

                const range = document.createRange();
                range.setStart(afterNode, after ? 0 : 1);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return true;
            }
        }

        const match =
            val.match(/\*\*([^*\n]+)\*\*/) ||
            val.match(/(?:^|[^*])(\*([^*\n]+)\*)(?:[^*]|$)/) ||
            val.match(/`([^`\n]+)`/);

        if (!match) continue;

        let fullMatch = match[0];
        let innerText = match[1];
        let matchIndex = match.index ?? 0;
        let tagName: 'strong' | 'em' | 'code' = 'strong';

        if (fullMatch.startsWith('**')) {
            tagName = 'strong';
        } else if (fullMatch.startsWith('`')) {
            tagName = 'code';
        } else {
            // Regex italique avec lookaround manuel : ajuster si un char précède/suit
            const starMatch = val.match(/(^|[^*])(\*([^*\n]+)\*)(?!\*)/);
            if (!starMatch) continue;
            tagName = 'em';
            matchIndex = (starMatch.index ?? 0) + starMatch[1].length;
            fullMatch = starMatch[2];
            innerText = starMatch[3];
        }

        const before = val.slice(0, matchIndex);
        const after = val.slice(matchIndex + fullMatch.length);

        const parent = textNode.parentNode;
        if (!parent) continue;

        const el = document.createElement(tagName);
        if (tagName === 'code') {
            el.style.fontFamily = 'var(--font-mono)';
            el.style.fontSize = '0.9em';
            el.style.background = 'var(--bg-hover)';
            el.style.padding = '1px 5px';
            el.style.borderRadius = '4px';
        }
        el.textContent = innerText;

        const afterNode = document.createTextNode(after || '\u200B');
        if (before) {
            parent.insertBefore(document.createTextNode(before), textNode);
        }
        parent.insertBefore(el, textNode);
        parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);

        // Placer le curseur juste après l'élément formaté (dans afterNode)
        const range = document.createRange();
        const caretOffset = after ? 0 : 1;
        range.setStart(afterNode, Math.min(caretOffset, afterNode.length));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
    }
    return false;
}

/**
 * Place le curseur ou sélectionne un mot / tout le contenu dans un élément contentEditable.
 */
export function selectInEditable(
    root: HTMLElement,
    mode: 'caret' | 'word' | 'all',
    charOffset?: number
): void {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    if (!sel) return;

    if (mode === 'all') {
        const range = document.createRange();
        range.selectNodeContents(root);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
    }

    const fullText = root.textContent || '';
    const targetOffset = charOffset !== undefined
        ? Math.max(0, Math.min(charOffset, fullText.length))
        : fullText.length;

    const [startOff, endOff] = mode === 'word'
        ? getWordBounds(fullText, targetOffset)
        : [targetOffset, targetOffset];

    const findPos = (offset: number): { node: Node; offset: number } => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let acc = 0;
        let lastNode: Node | null = null;
        let n: Node | null;
        while ((n = walker.nextNode())) {
            lastNode = n;
            const len = (n.textContent || '').length;
            if (acc + len >= offset) {
                return { node: n, offset: offset - acc };
            }
            acc += len;
        }
        if (lastNode) {
            return { node: lastNode, offset: (lastNode.textContent || '').length };
        }
        return { node: root, offset: 0 };
    };

    const startPos = findPos(startOff);
    const endPos = findPos(endOff);
    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);
    sel.removeAllRanges();
    sel.addRange(range);
}

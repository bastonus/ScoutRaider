/**
 * InlineEditor.tsx — Édition in-place façon Notion avec rendu Markdown en direct.
 * Dès que ** **, * * ou ` ` sont fermés (ou via B/I/U/Code/Lien), le texte se met en forme en direct.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useCarnet } from '../../hooks';
import SelectionBubble, { type InlineFormatAction, type SelectionBlockContext } from './SelectionBubble';
import { type EditorCommandDef, estimateOffsetFromClick } from './editorCommands';
import {
    inlineMarkdownToHtml,
    domToInlineMarkdown,
    applyAutoMarkdownInEditable,
    selectInEditable,
} from './liveMarkdown';

export type EditSelectionMode = 'caret' | 'word' | 'all';

interface InlineEditorProps {
    stepId: string;
    solutionText: string;
    moduleId: string;
    lineIdx?: number;
    initialSelectionMode?: EditSelectionMode;
    initialOffset?: number;
    preservedHeight?: number;
    initialContextMenuPos?: { x: number; y: number } | null;
    blockContext?: SelectionBlockContext;
    onClose: () => void;
    onEnterCreateBelow?: () => void;
}

export default function InlineEditor({
    stepId,
    solutionText,
    lineIdx,
    initialSelectionMode = 'caret',
    initialOffset,
    preservedHeight,
    initialContextMenuPos,
    blockContext,
    onClose,
    onEnterCreateBelow,
}: InlineEditorProps) {
    const { dispatch } = useCarnet();
    const [isEmpty, setIsEmpty] = useState(!solutionText);
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const skipBlurRef = useRef(false);
    const lastContextMenuAtRef = useRef(0);

    const handleSelectionUpdate = useCallback((e?: React.MouseEvent | React.SyntheticEvent) => {
        if (e && 'button' in e && e.button === 2) return;
        if (Date.now() - lastContextMenuAtRef.current < 350) return;
        const el = editorRef.current;
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (!el || !sel || sel.isCollapsed || !el.contains(sel.anchorNode)) {
            setBubbleVisible(false);
            return;
        }
        if (sel.toString().length === 0) {
            setBubbleVisible(false);
            return;
        }
        const range = sel.getRangeAt(0);
        const rangeRect = range.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const x = (e && 'clientX' in e && e.clientX) ? e.clientX : (rangeRect.left || elRect.left + Math.min(180, elRect.width / 3));
        const y = rangeRect.bottom || elRect.bottom;
        setBubblePos({ x, y });
        setBubbleVisible(true);
    }, []);

    const persistCurrentMarkdown = useCallback((el: HTMLElement) => {
        const md = domToInlineMarkdown(el);
        if (md.trim() && md.trim() !== solutionText.trim()) {
            dispatch({ type: 'EDIT_COMPUTED_TEXT', stepId, lineIdx, newSolutionText: md });
        }
        return md;
    }, [dispatch, stepId, lineIdx, solutionText]);

    const applyFormat = useCallback((action: InlineFormatAction) => {
        const el = editorRef.current;
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (!el || !sel) return;

        el.focus();
        if (action === 'bold' || action === 'italic' || action === 'underline') {
            document.execCommand(action, false);
        } else if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const selectedText = range.toString() || 'texte';
            if (action === 'code') {
                const codeEl = document.createElement('code');
                codeEl.style.fontFamily = 'var(--font-mono)';
                codeEl.style.fontSize = '0.9em';
                codeEl.style.background = 'var(--bg-hover)';
                codeEl.style.padding = '1px 5px';
                codeEl.style.borderRadius = '4px';
                codeEl.textContent = selectedText;
                range.deleteContents();
                range.insertNode(codeEl);
                const nextRange = document.createRange();
                nextRange.selectNodeContents(codeEl);
                sel.removeAllRanges();
                sel.addRange(nextRange);
            } else if (action === 'link') {
                const aEl = document.createElement('a');
                aEl.href = 'https://';
                aEl.style.color = 'var(--accent-hover)';
                aEl.style.textDecoration = 'underline';
                aEl.textContent = selectedText;
                range.deleteContents();
                range.insertNode(aEl);
                const nextRange = document.createRange();
                nextRange.selectNodeContents(aEl);
                sel.removeAllRanges();
                sel.addRange(nextRange);
            }
        }

        setIsEmpty((el.textContent || '').trim().length === 0);
        persistCurrentMarkdown(el);
        setBubbleVisible(false);
    }, [persistCurrentMarkdown]);

    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        el.innerHTML = inlineMarkdownToHtml(solutionText);
        setIsEmpty(!solutionText);
        el.focus();
        selectInEditable(el, initialSelectionMode, initialOffset);

        if (initialContextMenuPos) {
            setBubblePos(initialContextMenuPos);
            setBubbleVisible(true);
        } else if (initialSelectionMode === 'word' || initialSelectionMode === 'all') {
            const sel = window.getSelection();
            const elRect = el.getBoundingClientRect();
            const rangeRect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : elRect;
            if ((el.textContent || '').trim().length > 0) {
                setBubblePos({
                    x: rangeRect.left || elRect.left + Math.min(180, elRect.width / 3),
                    y: rangeRect.bottom || elRect.bottom,
                });
                setBubbleVisible(true);
            }
        }
    }, [solutionText, initialSelectionMode, initialOffset, initialContextMenuPos]);

    const handleValidate = () => {
        if (skipBlurRef.current) {
            skipBlurRef.current = false;
            return;
        }
        const el = editorRef.current;
        if (el) {
            persistCurrentMarkdown(el);
        }
        setBubbleVisible(false);
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); applyFormat('bold'); return; }
        if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); applyFormat('italic'); return; }
        if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); applyFormat('underline'); return; }
        if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); applyFormat('code'); return; }
        if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); applyFormat('link'); return; }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            skipBlurRef.current = true;
            if (editorRef.current) {
                persistCurrentMarkdown(editorRef.current);
            }
            setBubbleVisible(false);
            onClose();
            onEnterCreateBelow?.();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            skipBlurRef.current = true;
            setBubbleVisible(false);
            onClose();
        }
    };

    const handleInput = () => {
        const el = editorRef.current;
        if (!el) return;
        applyAutoMarkdownInEditable(el);
        setIsEmpty((el.textContent || '').trim().length === 0);
        setBubbleVisible(false);
    };

    return (
        <>
            <SelectionBubble
                visible={bubbleVisible}
                position={bubblePos}
                blockContext={blockContext}
                onClose={() => setBubbleVisible(false)}
                onFormat={applyFormat}
                onApplyColor={(color) => dispatch({ type: 'SET_STEP_STYLE', stepId, textColor: color })}
                onTransformBlock={(cmd: EditorCommandDef) => {
                    setBubbleVisible(false);
                    if (cmd.blockType === 'crypto_block' && cmd.config?.cipher) {
                        const el = editorRef.current;
                        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
                        if (el && sel && !sel.isCollapsed && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
                            const range = sel.getRangeAt(0);
                            const beforeRange = document.createRange();
                            beforeRange.selectNodeContents(el);
                            beforeRange.setEnd(range.startContainer, range.startOffset);
                            const afterRange = document.createRange();
                            afterRange.selectNodeContents(el);
                            afterRange.setStart(range.endContainer, range.endOffset);
                            const beforeText = beforeRange.toString();
                            const selectedText = range.toString();
                            const afterText = afterRange.toString();
                            if (selectedText.trim().length > 0 && (beforeText.trim().length > 0 || afterText.trim().length > 0)) {
                                skipBlurRef.current = true;
                                dispatch({
                                    type: 'ISOLATE_SELECTION_TO_BLOCK',
                                    stepId,
                                    lineIdx,
                                    beforeText,
                                    selectedText,
                                    afterText,
                                    targetType: 'code',
                                    moduleId: cmd.config.cipher,
                                });
                                onClose();
                                return;
                            }
                        }
                        dispatch({ type: 'MANUAL_MODULE_ASSIGNMENT', stepId, moduleId: cmd.config.cipher });
                    }
                }}
            />
            <div
                style={{
                    position: 'relative',
                    minHeight: preservedHeight ? `${preservedHeight}px` : undefined,
                    cursor: 'text',
                }}
                onMouseDown={(e) => {
                    const el = editorRef.current;
                    if (!el) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickedInsideEditor = e.target === el || el.contains(e.target as Node);

                    if (e.detail === 3) {
                        e.preventDefault();
                        el.focus();
                        selectInEditable(el, 'all');
                        setBubblePos({
                            x: e.clientX || rect.left + Math.min(180, rect.width / 3),
                            y: el.getBoundingClientRect().bottom,
                        });
                        setBubbleVisible(true);
                        return;
                    }
                    if (e.detail === 2 && !clickedInsideEditor) {
                        e.preventDefault();
                        el.focus();
                        const offset = estimateOffsetFromClick(el.textContent || '', e.clientX, e.clientY, rect);
                        selectInEditable(el, 'word', offset);
                        setBubblePos({
                            x: e.clientX || rect.left + Math.min(180, rect.width / 3),
                            y: el.getBoundingClientRect().bottom,
                        });
                        setBubbleVisible(true);
                        return;
                    }
                    if (e.detail === 1 && !clickedInsideEditor) {
                        e.preventDefault();
                        el.focus();
                        selectInEditable(el, 'caret');
                    }
                }}
            >
                {isEmpty && (
                    <span
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            color: 'var(--text-dim)',
                            fontSize: '15px',
                            fontFamily: 'var(--font-ui)',
                            lineHeight: 1.6,
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        Rédigez le texte de l'étape...
                    </span>
                )}
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    onInput={handleInput}
                    onMouseUp={handleSelectionUpdate}
                    onKeyUp={handleSelectionUpdate}
                    onDoubleClick={handleSelectionUpdate}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        lastContextMenuAtRef.current = Date.now();
                        setBubblePos({ x: e.clientX, y: e.clientY });
                        setBubbleVisible(true);
                    }}
                    onBlur={handleValidate}
                    onKeyDown={handleKeyDown}
                    style={{
                        width: '100%',
                        minHeight: '24px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 0,
                        color: 'var(--text-primary)',
                        caretColor: 'var(--text-primary)',
                        fontSize: '15px',
                        fontFamily: 'var(--font-ui)',
                        fontWeight: 400,
                        lineHeight: 1.6,
                        padding: 0,
                        margin: 0,
                        outline: 'none',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                    }}
                />
            </div>
        </>
    );
}

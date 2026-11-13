/**
 * InlineEditor.tsx — Mode édition Jupyter-style pour une phrase encodée.
 * Affiche le texte clair (solutionText) dans un textarea, avec bouton ✓ pour valider et ré-encoder.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { useApp } from '../../AppContext';

interface InlineEditorProps {
    stepId: string;
    solutionText: string;
    moduleId: string;
    lineIdx?: number;
    onClose: () => void;
}

export default function InlineEditor({ stepId, solutionText, moduleId, lineIdx, onClose }: InlineEditorProps) {
    const { dispatch } = useApp();
    const [text, setText] = useState(solutionText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
    }, []);

    const handleValidate = () => {
        if (text.trim() !== solutionText.trim()) {
            dispatch({ type: 'EDIT_COMPUTED_TEXT', stepId, lineIdx, newSolutionText: text });
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleValidate();
        }
        if (e.key === 'Escape') {
            onClose();
        }
    };

    return (
        <div style={{
            position: 'relative',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderLeft: '3px solid var(--accent-default)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            marginTop: '4px',
            boxShadow: 'var(--shadow-md)',
        }}>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '6px', letterSpacing: '0.05em', fontWeight: 600 }}>
                TEXTE CLAIR — Ctrl+Entrée pour valider
            </div>
            <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                    width: '100%',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-ui)',
                    lineHeight: 1.6,
                    padding: '8px',
                    resize: 'vertical',
                    minHeight: '60px',
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
                rows={Math.max(2, text.split('\n').length)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '8px' }}>
                <button
                    onClick={onClose}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'transparent', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xs)', color: 'var(--text-dim)',
                        cursor: 'pointer', padding: '4px 10px', fontSize: '11px',
                    }}
                >
                    <X size={12} /> Annuler
                </button>
                <button
                    onClick={handleValidate}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        background: 'var(--accent-default)', border: 'none',
                        borderRadius: 'var(--radius-xs)', color: '#fff',
                        cursor: 'pointer', padding: '4px 12px', fontSize: '11px', fontWeight: 700,
                    }}
                >
                    <Check size={12} /> Valider &amp; encoder
                </button>
            </div>
        </div>
    );
}

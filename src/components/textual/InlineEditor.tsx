/**
 * InlineEditor.tsx — Édition in-place épurée sans cadre ni boutons encombrants.
 * Uniquement le texte éditable avec une petite coche ronde sur le côté pour valider.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useApp } from '../../AppContext';

interface InlineEditorProps {
    stepId: string;
    solutionText: string;
    moduleId: string;
    lineIdx?: number;
    onClose: () => void;
}

export default function InlineEditor({ stepId, solutionText, lineIdx, onClose }: InlineEditorProps) {
    const { dispatch } = useApp();
    const [text, setText] = useState(solutionText);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
            // Auto resize height
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, []);

    const handleValidate = () => {
        if (text.trim() && text.trim() !== solutionText.trim()) {
            dispatch({ type: 'EDIT_COMPUTED_TEXT', stepId, lineIdx, newSolutionText: text });
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleValidate();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const target = e.currentTarget;
        target.style.height = 'auto';
        target.style.height = `${target.scrollHeight}px`;
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            position: 'relative',
            margin: '2px 0'
        }}>
            <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                rows={1}
                placeholder="Rédigez le texte de l'étape..."
                style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1.5px solid var(--accent-default)',
                    borderRadius: 0,
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontFamily: 'var(--font-ui)',
                    lineHeight: 1.5,
                    padding: '2px 4px',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                    overflow: 'hidden'
                }}
            />

            {/* Petite coche ronde discrète pour valider */}
            <button
                type="button"
                onClick={handleValidate}
                title="Valider la modification (Entrée)"
                style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'var(--semantic-success)',
                    border: 'none',
                    color: '#09090B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    transition: 'transform 100ms ease, opacity 100ms ease'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
                <Check size={13} strokeWidth={3} />
            </button>
        </div>
    );
}

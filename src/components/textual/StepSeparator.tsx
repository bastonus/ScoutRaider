import React, { useState } from 'react';
import { MessageSquarePlus, Code2 } from 'lucide-react';

interface StepSeparatorProps {
    index: number;
    afterStepId: string;
    onAddHtml: (afterStepId: string) => void;
    onAddCode: (afterStepId: string) => void;
}

export default function StepSeparator({ afterStepId, onAddHtml, onAddCode }: StepSeparatorProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            style={{
                display: 'flex',
                position: 'relative',
                height: '28px',
                margin: '2px 0',
                alignItems: 'center',
                zIndex: hovered ? 30 : 5
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Colonne de gauche alignée avec le rail de métro (48px) */}
            <div style={{
                width: '48px',
                flexShrink: 0,
                position: 'relative',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: '24px',
                    width: '3px',
                    transform: 'translateX(-50%)',
                    background: 'var(--border-subtle)',
                    zIndex: 1
                }} />
            </div>

            {/* Zone de contenu du séparateur */}
            <div style={{
                flex: 1,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
            }}>
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: '1px',
                    background: hovered ? 'var(--border-strong)' : 'rgba(255,255,255,0.03)',
                    transition: 'background 150ms ease',
                }} />

                <button
                    onClick={() => onAddHtml(afterStepId)}
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 9px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${hovered ? 'var(--border-strong)' : 'transparent'}`,
                        background: hovered ? 'var(--bg-elevated)' : 'transparent',
                        color: hovered ? 'var(--text-primary)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 600,
                        transition: 'all 150ms ease',
                        boxShadow: hovered ? 'var(--shadow-sm)' : 'none',
                        whiteSpace: 'nowrap',
                    }}
                    title="Insérer un commentaire ou consigne"
                >
                    <MessageSquarePlus size={11} strokeWidth={2.2} color={hovered ? 'var(--accent-hover)' : 'transparent'} />
                    {hovered && <span>Commentaire</span>}
                </button>

                <button
                    onClick={() => onAddCode(afterStepId)}
                    style={{
                        position: 'relative',
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '2px 9px',
                        borderRadius: 'var(--radius-pill)',
                        border: `1px solid ${hovered ? 'var(--border-strong)' : 'transparent'}`,
                        background: hovered ? 'var(--bg-elevated)' : 'transparent',
                        color: hovered ? 'var(--text-primary)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 600,
                        transition: 'all 150ms ease',
                        boxShadow: hovered ? 'var(--shadow-sm)' : 'none',
                        whiteSpace: 'nowrap',
                    }}
                    title="Insérer un bloc textuel chiffré"
                >
                    <Code2 size={11} strokeWidth={2.2} color={hovered ? 'var(--semantic-orange)' : 'transparent'} />
                    {hovered && <span>Bloc encodé</span>}
                </button>
            </div>
        </div>
    );
}

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
            style={{ display: 'flex', position: 'relative', height: '28px', margin: '0' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Margin area (80px) aligned with the timeline */}
            <div style={{ width: '80px', flexShrink: 0, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', background: 'var(--bg-border)', zIndex: 1 }} />
            </div>

            {/* Content area */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {/* Divider line */}
                <div style={{
                    position: 'absolute', left: 0, right: 0, top: '50%',
                    height: '1px',
                    background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                    transition: 'background 0.2s',
                }} />

                {/* Button: Add HTML comment */}
                <button
                    onClick={() => onAddHtml(afterStepId)}
                    style={{
                        position: 'relative', zIndex: 2,
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '12px',
                        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
                        background: hovered ? 'var(--bg-panel)' : 'transparent',
                        color: hovered ? 'var(--text-dim)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                        transition: 'all 0.15s ease',
                        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                        whiteSpace: 'nowrap',
                    }}
                    title="Ajouter un commentaire HTML riche"
                >
                    <MessageSquarePlus size={11} strokeWidth={2.5} />
                    {hovered && 'Commentaire'}
                </button>

                {/* Button: Add code block */}
                <button
                    onClick={() => onAddCode(afterStepId)}
                    style={{
                        position: 'relative', zIndex: 2,
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '12px',
                        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
                        background: hovered ? 'var(--bg-panel)' : 'transparent',
                        color: hovered ? 'var(--text-dim)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                        transition: 'all 0.15s ease',
                        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                        whiteSpace: 'nowrap',
                    }}
                    title="Ajouter un bloc de code encodé"
                >
                    <Code2 size={11} strokeWidth={2.5} />
                    {hovered && 'Bloc encodé'}
                </button>
            </div>
        </div>
    );
}

/**
 * StepInsertSeparator.tsx — Zone d'insertion discrète entre les blocs, façon Notion.
 * Au survol de l'interligne, révèle un léger repère et deux actions minimalistes (+ Texte, + Code).
 */
import React, { useState } from 'react';
import { Plus, Code2 } from 'lucide-react';

interface StepInsertSeparatorProps {
    afterStepId: string;
    anchorSegmentIdx?: number;
    onAddComment: (afterStepId: string, anchorSegmentIdx?: number) => void;
    onAddCode: (afterStepId: string, anchorSegmentIdx?: number) => void;
}

export default function StepInsertSeparator({
    afterStepId,
    anchorSegmentIdx,
    onAddComment,
    onAddCode
}: StepInsertSeparatorProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: 'relative',
                height: '16px',
                margin: '-6px 0',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '38px',
                zIndex: hovered ? 40 : 5,
            }}
        >
            {/* Ligne de repère très discrète */}
            <div
                style={{
                    position: 'absolute',
                    left: '38px',
                    right: '8px',
                    height: '1px',
                    background: 'var(--border-subtle)',
                    opacity: hovered ? 0.65 : 0,
                    transition: 'opacity 120ms ease',
                    pointerEvents: 'none',
                }}
            />

            {/* Actions compactes sans ombres ni bordures lourdes */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    padding: '0 4px',
                    background: 'var(--bg-base)',
                    borderRadius: '6px',
                    opacity: hovered ? 1 : 0,
                    pointerEvents: hovered ? 'auto' : 'none',
                    transition: 'opacity 120ms ease',
                }}
            >
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddComment(afterStepId, anchorSegmentIdx);
                    }}
                    title="Insérer un bloc texte"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        height: '22px',
                        padding: '0 7px',
                        borderRadius: '5px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        fontFamily: 'var(--font-ui)',
                        cursor: 'pointer',
                        transition: 'background 100ms ease, color 100ms ease',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-dim)';
                    }}
                >
                    <Plus size={12} strokeWidth={2.2} />
                    <span>Texte</span>
                </button>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddCode(afterStepId, anchorSegmentIdx);
                    }}
                    title="Insérer un message chiffré"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        height: '22px',
                        padding: '0 7px',
                        borderRadius: '5px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-dim)',
                        fontSize: '11.5px',
                        fontWeight: 500,
                        fontFamily: 'var(--font-ui)',
                        cursor: 'pointer',
                        transition: 'background 100ms ease, color 100ms ease',
                        whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--accent-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-dim)';
                    }}
                >
                    <Code2 size={12} strokeWidth={2.2} />
                    <span>Code</span>
                </button>
            </div>
        </div>
    );
}

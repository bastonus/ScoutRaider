/**
 * StepInsertSeparator.tsx — Séparateur au survol inspiré de Jupyter / Colab (ipynb).
 * Affiche au survol de l'interligne deux boutons discrets pour insérer soit un 'Commentaire' (MD/HTML),
 * soit un 'Code' (choix d'un module textuel de la marketplace).
 */
import React, { useState } from 'react';
import { MessageSquarePlus, Code2, Plus } from 'lucide-react';

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
                height: '22px',
                margin: '-11px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: hovered ? 40 : 5,
                transition: 'z-index 0s'
            }}
        >
            {/* Ligne séparatrice fine inspirée des carnets de note ipynb */}
            <div
                style={{
                    position: 'absolute',
                    left: '8px',
                    right: '8px',
                    height: '1px',
                    background: 'linear-gradient(90deg, transparent, var(--border-default) 15%, var(--border-default) 85%, transparent)',
                    opacity: hovered ? 1 : 0,
                    transition: 'opacity 140ms ease',
                    pointerEvents: 'none'
                }}
            />

            {/* Groupe de deux boutons centrés : + Commentaire et + Code */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 8px',
                    background: 'var(--bg-base)',
                    borderRadius: '9999px',
                    opacity: hovered ? 1 : 0,
                    transform: hovered ? 'scale(1)' : 'scale(0.92)',
                    pointerEvents: hovered ? 'auto' : 'none',
                    transition: 'all 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: hovered ? '0 2px 10px rgba(0,0,0,0.35)' : 'none'
                }}
            >
                {/* 1. Bouton + Commentaire */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddComment(afterStepId, anchorSegmentIdx);
                    }}
                    title="Insérer un bloc de commentaire libre (texte enrichi / markdown)"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '24px',
                        padding: '0 10px',
                        borderRadius: '9999px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-ui)',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-elevated)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                >
                    <Plus size={11} strokeWidth={2.6} style={{ color: 'var(--text-dim)' }} />
                    <MessageSquarePlus size={12} strokeWidth={2.2} />
                    <span>Commentaire</span>
                </button>

                {/* 2. Bouton + Code */}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onAddCode(afterStepId, anchorSegmentIdx);
                    }}
                    title="Insérer un message encodé avec un code de la marketplace"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '24px',
                        padding: '0 10px',
                        borderRadius: '9999px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-ui)',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                        whiteSpace: 'nowrap'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--bg-surface)';
                        e.currentTarget.style.color = 'var(--accent-hover)';
                        e.currentTarget.style.borderColor = 'var(--accent-default)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--bg-elevated)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    }}
                >
                    <Plus size={11} strokeWidth={2.6} style={{ color: 'var(--text-dim)' }} />
                    <Code2 size={12} strokeWidth={2.4} />
                    <span>Code</span>
                </button>
            </div>
        </div>
    );
}

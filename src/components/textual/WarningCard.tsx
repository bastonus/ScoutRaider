/**
 * WarningCard.tsx — Contextual IDE-style error card for step constraint violations.
 * Appears as a floating popover when hovering the lateral warning bar.
 */
import React from 'react';
import { AlertTriangle, XCircle, Info } from 'lucide-react';
import type { ConstraintWarning } from '../../logic/types';

interface WarningCardProps {
    warnings: ConstraintWarning[];
    /** Positioning anchor — 'right' of the warning bar */
    visible: boolean;
}

const SEVERITY_CONFIG = {
    error:   { icon: XCircle,        color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   label: 'Erreur' },
    warning: { icon: AlertTriangle,  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',  label: 'Avertissement' },
    info:    { icon: Info,           color: '#14b8a6', bg: 'rgba(20,184,166,0.08)',  label: 'Info' },
};

export default function WarningCard({ warnings, visible }: WarningCardProps) {
    if (!visible || warnings.length === 0) return null;

    return (
        <div style={{
            position: 'absolute',
            left: '20px',
            top: '0',
            zIndex: 500,
            width: '280px',
            background: 'var(--bg-dark, #1c1c20)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            animation: 'fadeInScale 0.15s ease-out',
            pointerEvents: 'all',
        }}>
            <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-dim, #888)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
            }}>
                {warnings.length} problème{warnings.length > 1 ? 's' : ''} détecté{warnings.length > 1 ? 's' : ''}
            </div>

            <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {warnings.map((w) => {
                    const cfg = SEVERITY_CONFIG[w.severity];
                    const Icon = cfg.icon;
                    return (
                        <div key={w.id} style={{
                            background: cfg.bg,
                            border: `1px solid ${cfg.color}30`,
                            borderRadius: '7px',
                            padding: '10px 12px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: w.detail ? '6px' : '0' }}>
                                <Icon size={13} color={cfg.color} strokeWidth={2.5} />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff' }}>
                                    {w.message}
                                </span>
                            </div>
                            {w.detail && (
                                <p style={{ fontSize: '11px', color: 'var(--text-dim, #888)', lineHeight: 1.5, margin: 0, paddingLeft: '21px' }}>
                                    {w.detail}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

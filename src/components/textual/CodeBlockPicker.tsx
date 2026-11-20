/**
 * CodeBlockPicker.tsx — Sélecteur de module textuel pour les blocs encodés manuels.
 * Affiche les modules textuels (écrits) de la marketplace avec aperçu en temps réel.
 */
import React, { useState, useMemo } from 'react';
import { Check, Code2, X, Sparkles } from 'lucide-react';
import { MODULE_META } from '../../logic/ModuleRegistry';
import type { ModuleId } from '../../logic/types';
import { ModuleLogic } from '../../logic/ModuleLogic';
import { themeManager } from '../../logic/ThemeManager';
import { useApp } from '../../AppContext';

const TEXTUAL_MODULES: { id: ModuleId; description: string }[] = [
    { id: 'morse', description: 'Points & traits sonores' },
    { id: 'vigenere', description: 'Chiffre polyalphabétique' },
    { id: 'avocat', description: 'Décalage César A=K' },
    { id: 'cassis', description: 'Décalage César K=6' },
    { id: 'polybe', description: 'Grille de substitution 6×6' },
    { id: 'templier', description: 'Chiffre maçonnique / pigpen' },
    { id: 'maritime', description: 'Pavillons & alphabet NATO' },
    { id: 'texte_clair', description: 'Texte lisible en clair' },
];

const MODULE_FONT: Record<string, string> = {
    morse: '"Morse", "Courier New", monospace',
    polybe: '"Courier New", monospace',
    vigenere: '"Courier New", monospace',
    templier: '"TemplarsCipherPlus", "Times New Roman", serif',
    cassis: '"Kalam", cursive, sans-serif',
    avocat: '"Kalam", cursive, sans-serif',
    maritime: '"Courier New", monospace',
    texte_clair: '"Segoe UI", sans-serif',
};

const MODULE_FONT_SIZE: Record<string, string> = {
    morse: '22px', templier: '26px', cassis: '15px', avocat: '15px',
    vigenere: '13px', polybe: '13px', maritime: '13px', default: '13px',
};

interface CodeBlockPickerProps {
    afterStepId: string;
    anchorSegmentIdx?: number;
    initialContent?: string;
    initialModuleId?: ModuleId;
    onClose: () => void;
}

export default function CodeBlockPicker({
    afterStepId,
    anchorSegmentIdx,
    initialContent = '',
    initialModuleId = 'morse',
    onClose
}: CodeBlockPickerProps) {
    const { state, dispatch } = useApp();
    const [selectedModule, setSelectedModule] = useState<ModuleId>(initialModuleId);
    const [content, setContent] = useState(initialContent);

    const theme = useMemo(() => themeManager.getTheme(state.theme_id), [state.theme_id]);
    const meta = MODULE_META[selectedModule];
    const accentColor = meta?.color || '#3b82f6';
    const font = MODULE_FONT[selectedModule] || MODULE_FONT.default;
    const fontSize = MODULE_FONT_SIZE[selectedModule] || MODULE_FONT_SIZE.default;

    const encodedPreview = useMemo(() => {
        if (!content.trim()) return '';
        try {
            return ModuleLogic.encode(selectedModule, content, { key: theme.vigenere_key });
        } catch {
            return content;
        }
    }, [selectedModule, content, theme.vigenere_key]);

    const handleInsert = () => {
        dispatch({
            type: 'INSERT_MANUAL_STEP_TYPED',
            afterStepId,
            anchorSegmentIdx,
            content,
            manualType: 'code',
            moduleId: selectedModule,
        });
        onClose();
    };

    return (
        <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '12px',
            padding: '16px 18px',
            margin: '12px 0',
            boxShadow: 'var(--shadow-md)',
            animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
            width: '100%',
            boxSizing: 'border-box'
        }}>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                        width: '24px', height: '24px', borderRadius: '6px',
                        background: `${accentColor}20`, border: `1px solid ${accentColor}50`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Code2 size={13} color={accentColor} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Nouveau bloc de code textuel
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                            Sélectionnez un code de la marketplace et saisissez votre texte
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    type="button"
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                    title="Fermer"
                >
                    <X size={15} />
                </button>
            </div>

            {/* Sélecteur de module sous forme de puces interactives */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '10.5px',
                fontWeight: 700,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '8px'
            }}>
                <span>Code textuel</span>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '6px',
                marginBottom: '14px'
            }}>
                {TEXTUAL_MODULES.map(({ id: modId, description }) => {
                    const modMeta = MODULE_META[modId];
                    const active = selectedModule === modId;
                    return (
                        <button
                            key={modId}
                            type="button"
                            onClick={() => setSelectedModule(modId)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                border: `1.5px solid ${active ? modMeta.color : 'var(--border-subtle)'}`,
                                background: active ? `${modMeta.color}15` : 'var(--bg-surface)',
                                transition: 'all 0.12s ease',
                                boxSizing: 'border-box'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: modMeta.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '11.5px', fontWeight: 700, color: active ? modMeta.color : 'var(--text-primary)' }}>
                                        {modMeta.label}
                                    </span>
                                </div>
                                {active && <Check size={11} color={modMeta.color} strokeWidth={2.8} />}
                            </div>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', lineHeight: 1.2 }}>
                                {description}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Zone de saisie du texte source */}
            <div style={{ position: 'relative', marginBottom: '10px' }}>
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    placeholder="Tapez ici le message en clair à encoder..."
                    autoFocus
                    style={{
                        width: '100%',
                        minHeight: '68px',
                        background: 'var(--bg-base)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontFamily: 'var(--font-ui)',
                        lineHeight: 1.5,
                        padding: '10px 12px',
                        resize: 'vertical',
                        outline: 'none',
                        boxSizing: 'border-box',
                        transition: 'border-color 0.15s ease'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = accentColor}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleInsert();
                        }
                        if (e.key === 'Escape') onClose();
                    }}
                />
            </div>

            {/* Aperçu en direct de l'encodage */}
            {encodedPreview && (
                <div style={{
                    marginBottom: '14px',
                    padding: '8px 12px',
                    background: `${accentColor}10`,
                    borderRadius: '8px',
                    border: `1px solid ${accentColor}30`,
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '10px',
                        fontWeight: 700,
                        color: accentColor,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '4px'
                    }}>
                        <Sparkles size={11} />
                        <span>Aperçu encodé ({meta.label})</span>
                    </div>
                    <div style={{
                        fontFamily: font,
                        fontSize: fontSize,
                        color: accentColor,
                        lineHeight: 1.5,
                        wordBreak: 'break-all'
                    }}>
                        {encodedPreview}
                    </div>
                </div>
            )}

            {/* Barre d'action inférieure */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: '6px 14px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        transition: 'all 0.12s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
                >
                    Annuler
                </button>
                <button
                    type="button"
                    onClick={handleInsert}
                    disabled={!content.trim()}
                    style={{
                        background: content.trim() ? accentColor : 'var(--bg-surface)',
                        border: 'none',
                        borderRadius: '6px',
                        color: content.trim() ? '#fff' : 'var(--text-dim)',
                        cursor: content.trim() ? 'pointer' : 'not-allowed',
                        padding: '6px 16px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        boxShadow: content.trim() ? `0 2px 8px ${accentColor}40` : 'none',
                        transition: 'all 0.12s ease'
                    }}
                >
                    Insérer le code ({meta.label})
                </button>
            </div>
        </div>
    );
}

/**
 * CodeBlockPicker.tsx — Sélecteur de module textuel pour les blocs encodés manuels.
 * Affiche uniquement les modules textuels (écrits), pas les graphiques.
 */
import React, { useState } from 'react';
import { Check, Code2, X } from 'lucide-react';
import { MODULE_META } from '../../logic/ModuleRegistry';
import type { ModuleId } from '../../logic/types';
import { useApp } from '../../AppContext';

const TEXTUAL_MODULES: ModuleId[] = ['texte_clair', 'morse', 'vigenere', 'polybe', 'avocat', 'cassis', 'templier'];

interface CodeBlockPickerProps {
    afterStepId: string;
    anchorSegmentIdx?: number;
    onClose: () => void;
}

export default function CodeBlockPicker({ afterStepId, anchorSegmentIdx, onClose }: CodeBlockPickerProps) {
    const { dispatch } = useApp();
    const [selectedModule, setSelectedModule] = useState<ModuleId>('texte_clair');
    const [content, setContent] = useState('');

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
            background: 'var(--bg-panel)',
            border: '1px solid var(--bg-border)',
            borderRadius: '10px',
            padding: '16px',
            margin: '8px 0 8px 88px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <Code2 size={14} />
                    Bloc de code encodé
                </div>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px' }}>
                    <X size={14} />
                </button>
            </div>

            {/* Textarea first — type content before choosing encoding */}
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Rédigez le contenu à encoder..."
                autoFocus
                style={{
                    width: '100%', minHeight: '72px',
                    background: 'var(--bg-base)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px',
                    fontFamily: '"Inter", sans-serif', lineHeight: 1.6,
                    padding: '8px', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                }}
                onKeyDown={e => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleInsert(); }
                    if (e.key === 'Escape') onClose();
                }}
            />

            {/* Module selector below */}
            <div style={{ margin: '10px 0 5px', fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Encodage
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
                {TEXTUAL_MODULES.map(modId => {
                    const meta = MODULE_META[modId];
                    const active = selectedModule === modId;
                    return (
                        <button
                            key={modId}
                            onClick={() => setSelectedModule(modId)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '3px 9px', borderRadius: '20px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                                border: `1px solid ${active ? meta.color : 'rgba(255,255,255,0.1)'}`,
                                background: active ? `${meta.color}20` : 'transparent',
                                color: active ? meta.color : 'var(--text-dim)',
                                transition: 'all 0.12s',
                            }}
                        >
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                            {meta.label}
                            {active && <Check size={10} />}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <button onClick={onClose} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-dim)', cursor: 'pointer', padding: '5px 12px', fontSize: '11px' }}>
                    Annuler
                </button>
                <button
                    onClick={handleInsert}
                    disabled={!content.trim()}
                    style={{
                        background: content.trim() ? 'var(--accent-default)' : 'rgba(255,255,255,0.05)',
                        border: 'none', borderRadius: '4px',
                        color: content.trim() ? '#fff' : 'var(--text-dim)',
                        cursor: content.trim() ? 'pointer' : 'default',
                        padding: '5px 14px', fontSize: '11px', fontWeight: 700,
                    }}
                >
                    Insérer le bloc
                </button>
            </div>
        </div>
    );
}

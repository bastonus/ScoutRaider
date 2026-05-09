/**
 * AnnexeToggle.tsx — Include/exclude module annexes within a step.
 * Renders a row of pill buttons, one per available annexe for the module.
 */
import React from 'react';
import { Paperclip, Check } from 'lucide-react';
import type { AnnexeId, ModuleId } from '../../logic/types';

const ANNEXE_LABELS: Record<AnnexeId, string> = {
    alphabet_morse:    'Alphabet Morse',
    grille_polybe:     'Grille Polybe',
    alphabet_gilwell:  'Alphabet Gilwell',
    tableau_vigenere:  'Table Vigenère',
    index_drapeaux:    'Index Drapeaux',
    methode_avocat:    'Méthode Avocat',
    code_templier:     'Code Templier',
};

// Map module → which annexes it can offer
const MODULE_ANNEXES: Partial<Record<ModuleId, AnnexeId[]>> = {
    morse:    ['alphabet_morse'],
    polybe:   ['grille_polybe'],
    gilwell:  ['alphabet_gilwell'],
    vigenere: ['tableau_vigenere'],
    drapeaux: ['index_drapeaux'],
    avocat:   ['methode_avocat'],
};

interface AnnexeToggleProps {
    moduleId: ModuleId;
    activeAnnexes: AnnexeId[];
    onToggle: (annexeId: AnnexeId) => void;
}

export default function AnnexeToggle({ moduleId, activeAnnexes, onToggle }: AnnexeToggleProps) {
    const available = MODULE_ANNEXES[moduleId] ?? [];
    if (available.length === 0) return null;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-dim, #888)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginRight: '4px' }}>
                <Paperclip size={11} />
                Annexes
            </div>
            {available.map((annexeId) => {
                const active = activeAnnexes.includes(annexeId);
                return (
                    <button
                        key={annexeId}
                        onClick={() => onToggle(annexeId)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            border: active ? '1px solid var(--accent-default)' : '1px solid rgba(255,255,255,0.12)',
                            background: active ? 'var(--accent-transparent)' : 'transparent',
                            color: active ? 'var(--accent-default)' : 'var(--text-dim)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                        title={active ? 'Exclure cette annexe' : 'Inclure cette annexe'}
                    >
                        {active && <Check size={10} strokeWidth={3} />}
                        {ANNEXE_LABELS[annexeId]}
                    </button>
                );
            })}
        </div>
    );
}

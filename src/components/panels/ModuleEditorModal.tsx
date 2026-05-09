import React from 'react';
import { X } from 'lucide-react';
import { MODULE_META } from '../../logic/ModuleRegistry';
import type { ModuleId } from '../../logic/types';

interface ModuleEditorModalProps {
  onClose: () => void;
  activeModuleId: string;
}

export default function ModuleEditorModal({ onClose, activeModuleId }: ModuleEditorModalProps) {
  const meta = MODULE_META[activeModuleId as ModuleId];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '450px', background: 'var(--bg-panel)',
        borderRadius: '12px', border: '1px solid var(--bg-border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `${meta?.color || '#333'}15`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
             <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: meta?.color || '#333' }} />
             <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Éditeur de Module : {meta?.label}</h2>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                <p style={{ margin: '0 0 10px 0' }}>L'édition avancée des modules d'épreuves n'est pas encore disponible dans cette version.</p>
                <p style={{ margin: '0 0 10px 0', color: 'var(--text-dim)' }}>Les modules définissent l'algorithme d'encodage (ex: Morse, Vigenère) et sont gérés en interne par le système.</p>
            </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          background: 'rgba(0,0,0,0.1)'
        }}>
          <button className="btn-primary" onClick={onClose}>Fermer</button>
        </div>

      </div>
    </div>
  );
}

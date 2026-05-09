import React, { useState, useEffect } from 'react';
import { themeManager } from '../../logic/ThemeManager';
import { X, Copy, Trash2, Save, Plus, Minus } from 'lucide-react';
import type { ThemeData } from '../../logic/types';

interface ThemeEditorModalProps {
  onClose: () => void;
  activeThemeId: string;
  onSelectTheme: (id: string) => void;
}

export default function ThemeEditorModal({ onClose, activeThemeId, onSelectTheme }: ThemeEditorModalProps) {
  const [localThemes, setLocalThemes] = useState<Record<string, ThemeData>>({});
  const [selectedId, setSelectedId] = useState<string>(activeThemeId);
  // Just distinguish standard from custom by a simple naming rule or assume all are editable
  // In our simple case, let's treat all themes as editable copies, but to mimic the legacy behaviour
  // we could just edit them directly in memory.

  useEffect(() => {
    // Load themes from manager
    const rawThemes = themeManager['themes'];
    setLocalThemes(JSON.parse(JSON.stringify(rawThemes || {})));
  }, []);

  const selectedData = localThemes[selectedId];

  const handleDuplicate = () => {
    if (!selectedData) return;
    const newId = `${selectedId} (Copie)`;
    setLocalThemes(prev => ({
        ...prev,
        [newId]: JSON.parse(JSON.stringify(selectedData))
    }));
    setSelectedId(newId);
  };

  const handleDelete = () => {
    if (!localThemes[selectedId]) return;
    if (Object.keys(localThemes).length <= 1) {
      alert("Vous ne pouvez pas supprimer le dernier thème.");
      return;
    }
    if (window.confirm('Voulez-vous supprimer ce thème ?')) {
        const nextThemes = { ...localThemes };
        delete nextThemes[selectedId];
        setLocalThemes(nextThemes);
        setSelectedId(Object.keys(nextThemes)[0]);
    }
  };

  const handleChange = (field: keyof ThemeData, val: any) => {
    if (!selectedData) return;
    setLocalThemes(prev => ({
        ...prev,
        [selectedId]: {
            ...prev[selectedId],
            [field]: val
        }
    }));
  };

  const handleArrayChange = (field: keyof ThemeData, index: number, val: string) => {
    if (!selectedData) return;
    const arr = [...(selectedData[field] as string[])];
    arr[index] = val;
    handleChange(field, arr);
  };

  const addArrayItem = (field: keyof ThemeData) => {
    if (!selectedData) return;
    const arr = [...(selectedData[field] as string[] || []), ''];
    handleChange(field, arr);
  };

  const removeArrayItem = (field: keyof ThemeData, index: number) => {
    if (!selectedData) return;
    const arr = [...(selectedData[field] as string[])];
    arr.splice(index, 1);
    handleChange(field, arr);
  };

  const handleSave = () => {
    themeManager['themes'] = localThemes;
    onSelectTheme(selectedId);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '750px', height: '600px',
        background: 'var(--bg-panel)',
        borderRadius: '12px', border: '1px solid var(--bg-border)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Éditeur de Thèmes</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          
          {/* Left Panel */}
          <div style={{
            width: '240px', borderRight: '1px solid var(--bg-border)',
            display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px',
            background: 'rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Thèmes Disponibles</div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {Object.keys(localThemes).map(id => (
                <button key={id} onClick={() => setSelectedId(id)} style={{
                  padding: '8px 10px', textAlign: 'left', borderRadius: '6px',
                  background: selectedId === id ? 'var(--accent-default)' : 'transparent',
                  color: selectedId === id ? '#fff' : 'var(--text-primary)',
                  fontSize: '12px', border: 'none', cursor: 'pointer',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {id}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={handleDuplicate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Copy size={14} /> Dupliquer
            </button>
          </div>

          {/* Right Panel */}
          <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
            {selectedData ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>NOM DU THÈME</label>
                    <input 
                      type="text" 
                      value={selectedId} 
                      onChange={e => {
                        const newId = e.target.value;
                        if (!newId || localThemes[newId]) return;
                        const next = { ...localThemes };
                        next[newId] = next[selectedId];
                        delete next[selectedId];
                        setLocalThemes(next);
                        setSelectedId(newId);
                      }}
                      style={{
                        padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>MOT-CLÉ VIGENÈRE</label>
                    <input 
                      type="text" 
                      value={selectedData.vigenere_key || ''} 
                      onChange={e => handleChange('vigenere_key', e.target.value.toUpperCase())}
                      style={{
                        padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', outline: 'none',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>PHRASE POI (utiliser {'{poi}'})</label>
                    <input 
                      type="text" 
                      value={selectedData.poi || ''} 
                      onChange={e => handleChange('poi', e.target.value)}
                      style={{
                        padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)', outline: 'none'
                      }}
                    />
                  </div>

                  {/* Intro Sentences */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>PHRASES D'ACCROCHE (INTROS)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(selectedData.intros || []).map((intro, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" value={intro} onChange={e => handleArrayChange('intros', idx, e.target.value)}
                                style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}
                            />
                            <button className="btn-icon" onClick={() => removeArrayItem('intros', idx)}><Minus size={14} /></button>
                        </div>
                      ))}
                      <button className="btn-secondary" onClick={() => addArrayItem('intros')} style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '4px 8px' }}>+ Ajouter une intro</button>
                    </div>
                  </div>

                  {/* Action Sentences */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>VERBES DE MOUVEMENT (ACTIONS)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(selectedData.actions || []).map((action, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                            <input 
                                type="text" value={action} onChange={e => handleArrayChange('actions', idx, e.target.value)}
                                style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-primary)' }}
                            />
                            <button className="btn-icon" onClick={() => removeArrayItem('actions', idx)}><Minus size={14} /></button>
                        </div>
                      ))}
                      <button className="btn-secondary" onClick={() => addArrayItem('actions')} style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '4px 8px' }}>+ Ajouter une action</button>
                    </div>
                  </div>
                  
                </>
            ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Sélectionnez un thème...</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.1)'
        }}>
          {selectedData ? (
            <button className="btn-discreet" style={{ color: '#ef4444' }} onClick={handleDelete}>
              <Trash2 size={14} style={{ marginRight: '6px' }} /> Supprimer
            </button>
          ) : <div />}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn-secondary" onClick={onClose}>Annuler</button>
            <button className="btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={14} /> Enregistrer
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

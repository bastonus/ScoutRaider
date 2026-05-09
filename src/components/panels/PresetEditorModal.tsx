import React, { useState, useEffect } from 'react';
import { presetsManager } from '../../logic/PresetsManager';
import { X, Copy, Trash2, Save } from 'lucide-react';
import type { PresetData } from '../../logic/types';

interface PresetEditorModalProps {
  onClose: () => void;
  activePresetId: string;
  onSelectPreset: (id: string) => void;
}

const ALL_MODULES = [
  { id: 'texte_clair', label: 'Texte Clair' },
  { id: 'morse', label: 'Morse' },
  { id: 'vigenere', label: 'Vigenère' },
  { id: 'carte_ign', label: 'Carte IGN' },
  { id: 'gilwell', label: 'Gilwell' },
  { id: 'drapeaux', label: 'Drapeaux' },
  { id: 'azimut_pur', label: 'Azimut Pur' },
  { id: 'polybe', label: 'Polybe' },
  { id: 'templier', label: 'Templier' },
  { id: 'maritime', label: 'Maritime' },
  { id: 'avocat', label: 'Avocat' },
  { id: 'cassis', label: 'Cassis' }
];

export default function PresetEditorModal({ onClose, activePresetId, onSelectPreset }: PresetEditorModalProps) {
  const [localCustom, setLocalCustom] = useState<Record<string, PresetData>>({});
  const [selectedId, setSelectedId] = useState<string>(activePresetId);
  const [selectedIsFactory, setSelectedIsFactory] = useState(false);

  useEffect(() => {
    // Load custom presets
    const rawData = presetsManager.toJSON();
    setLocalCustom(JSON.parse(JSON.stringify(rawData?.custom || {})));
  }, []);

  // Compute total weights to show percentages
  const getSelectedData = (): PresetData | null => {
    const rawData = presetsManager.toJSON();
    if (rawData?.factory?.[selectedId]) {
        return rawData.factory[selectedId];
    }
    if (localCustom[selectedId]) {
        return localCustom[selectedId];
    }
    return null;
  };

  const selectedData = getSelectedData();
  const isFactory = (() => {
    const rawData = presetsManager.toJSON();
    return !!rawData?.factory?.[selectedId];
  })();

  const handleDuplicate = () => {
    if (!selectedData) return;
    const newId = `custom_${Date.now()}`;
    const newName = `${selectedData.name || 'Copie'} (Copie)`;
    setLocalCustom(prev => ({
        ...prev,
        [newId]: { ...selectedData, name: newName }
    }));
    setSelectedId(newId);
  };

  const handleDelete = () => {
    if (isFactory || !localCustom[selectedId]) return;
    if (window.confirm('Voulez-vous supprimer cette présélection personnalisée ?')) {
        const nextCustom = { ...localCustom };
        delete nextCustom[selectedId];
        setLocalCustom(nextCustom);
        // Fallback to first factory
        const rawData = presetsManager.toJSON();
        setSelectedId(Object.keys(rawData?.factory || {})[0] || '');
    }
  };

  const handleWeightChange = (modId: string, val: number) => {
    if (isFactory || !localCustom[selectedId]) return;
    setLocalCustom(prev => ({
        ...prev,
        [selectedId]: {
            ...prev[selectedId],
            weights: {
                ...(prev[selectedId].weights || {}),
                [modId]: val
            }
        }
    }));
  };

  const handleSave = () => {
    const rawData = presetsManager.toJSON();
    rawData.custom = localCustom;
    // We don't have a save() method in PresetsManager yet, but we update the in-memory data.
    // In legacy it was presetsManager.save()
    onSelectPreset(selectedId);
    onClose();
  };

  const weights = selectedData?.weights || {};
  const totalWeight = Object.values(weights).reduce((a: number, b: any) => a + (b as number), 0) as number;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '650px', height: '500px',
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
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Éditeur de Présélections</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          
          {/* Left Panel */}
          <div style={{
            width: '220px', borderRight: '1px solid var(--bg-border)',
            display: 'flex', flexDirection: 'column', padding: '16px', gap: '12px',
            background: 'rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Bibliothèque</div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {/* Factory */}
              {Object.entries(presetsManager.toJSON()?.factory || {}).map(([id, data]: [string, any]) => (
                <button key={id} onClick={() => setSelectedId(id)} style={{
                  padding: '8px 10px', textAlign: 'left', borderRadius: '6px',
                  background: selectedId === id ? 'var(--accent-default)' : 'transparent',
                  color: selectedId === id ? '#fff' : 'var(--text-primary)',
                  fontSize: '12px', border: 'none', cursor: 'pointer'
                }}>
                  🔒 {data.name}
                </button>
              ))}
              {/* Custom */}
              {Object.entries(localCustom).map(([id, data]) => (
                <button key={id} onClick={() => setSelectedId(id)} style={{
                  padding: '8px 10px', textAlign: 'left', borderRadius: '6px',
                  background: selectedId === id ? 'var(--accent-default)' : 'transparent',
                  color: selectedId === id ? '#fff' : 'var(--text-primary)',
                  fontSize: '12px', border: 'none', cursor: 'pointer'
                }}>
                  ★ {data.name}
                </button>
              ))}
            </div>
            <button className="btn-secondary" onClick={handleDuplicate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Copy size={14} /> Dupliquer
            </button>
          </div>

          {/* Right Panel */}
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
            {selectedData ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Nom de la présélection</label>
                    <input 
                      type="text" 
                      value={selectedData.name || ''} 
                      readOnly={isFactory}
                      onChange={e => {
                        if (isFactory) return;
                        setLocalCustom(prev => ({
                          ...prev,
                          [selectedId]: { ...prev[selectedId], name: e.target.value }
                        }));
                      }}
                      style={{
                        padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)',
                        background: 'rgba(0,0,0,0.2)', color: isFactory ? 'var(--text-dim)' : 'var(--text-primary)',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>PRIORITÉ DES ÉPREUVES (POIDS)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ALL_MODULES.map(mod => {
                        const val = weights[mod.id] || 0;
                        const pct = totalWeight > 0 ? ((val / totalWeight) * 100).toFixed(1) : '0.0';
                        return (
                          <div key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '100px', fontSize: '12px' }}>{mod.label}</div>
                            <input 
                              type="number" 
                              min="0" step="5"
                              value={val}
                              readOnly={isFactory}
                              onChange={e => handleWeightChange(mod.id, parseInt(e.target.value) || 0)}
                              style={{
                                width: '70px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)',
                                background: 'rgba(0,0,0,0.2)', color: isFactory ? 'var(--text-dim)' : 'var(--text-primary)',
                              }}
                            />
                            <div style={{ width: '40px', fontSize: '11px', color: 'var(--text-dim)' }}>{pct}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
            ) : (
                <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Sélectionnez un preset...</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--bg-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,0,0,0.1)'
        }}>
          {!isFactory && selectedData ? (
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

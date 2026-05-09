import React, { useEffect, useState } from 'react';
import LibraryBase, { LibraryItem } from './LibraryBase';
import { Target, Zap, ShieldCheck } from 'lucide-react';
import { presetsManager } from '../../logic/PresetsManager';
import { useApp } from '../../AppContext';
import PresetEditorModal from './PresetEditorModal';

export default function DifficultyLibrary() {
  const { state, dispatch } = useApp();
  const [presets, setPresets] = useState<LibraryItem[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);

  const loadPresets = () => {
    const rawPresets = presetsManager.getAllPresets();
    const items: LibraryItem[] = rawPresets.map((p, i) => {
      const colors = ['#14b8a6', '#a855f7', '#f59e0b', '#0ea5e9', '#ec4899'];
      const icons = [<Target />, <ShieldCheck />, <Zap />];
      return {
        id: p.id,
        name: p.name,
        desc: p.isCustom ? 'Preset personnalisé.' : 'Preset par défaut.',
        icon: icons[i % icons.length],
        color: colors[i % colors.length]
      };
    });
    setPresets(items);
  };

  useEffect(() => {
    const tryLoad = () => {
      if (presetsManager.isLoaded) {
        loadPresets();
      } else {
        setTimeout(tryLoad, 150);
      }
    };
    tryLoad();
  }, []);

  const handleSelect = (item: LibraryItem) => {
    dispatch({ type: 'SET_PRESET', presetId: item.id });
  };

  return (
    <>
      <LibraryBase 
        title="Encodage Automatique" 
        items={presets} 
        addItemLabel="Nouveau Preset"
        activeItemId={state.active_preset_id}
        onItemClick={handleSelect}
        onEditClick={() => setEditorOpen(true)}
        onAddClick={() => setEditorOpen(true)}
      />
      {editorOpen && (
        <PresetEditorModal 
          activePresetId={state.active_preset_id}
          onClose={() => setEditorOpen(false)}
          onSelectPreset={(id) => {
            dispatch({ type: 'SET_PRESET', presetId: id });
            loadPresets();
          }}
        />
      )}
    </>
  );
}

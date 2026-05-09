import React, { useState } from 'react';
import LibraryBase, { LibraryItem } from './LibraryBase';
import { Radio, Code, Ghost, Shield, Anchor, Flag, MessageSquare, Map } from 'lucide-react';
import { ALL_MODULE_IDS, MODULE_META, ModuleRegistry } from '../../logic/ModuleRegistry';
import ModuleEditorModal from './ModuleEditorModal';

export default function LibraryPanel() {
  const [activeModule, setActiveModule] = useState<string | undefined>(ALL_MODULE_IDS[0]);
  const [editorOpen, setEditorOpen] = useState(false);

  // Map module IDs to LibraryItems
  const modules: LibraryItem[] = ALL_MODULE_IDS.map(mId => {
    const meta = MODULE_META[mId];
    const manifest = ModuleRegistry.getManifest(mId);
    
    // Choose icon based on category/type roughly
    let icon = <Code />;
    if (mId === 'morse') icon = <Radio />;
    if (mId === 'gilwell') icon = <Ghost />;
    if (mId === 'templier') icon = <Shield />;
    if (mId === 'maritime') icon = <Anchor />;
    if (mId === 'drapeaux') icon = <Flag />;
    if (mId === 'texte_clair') icon = <MessageSquare />;
    if (mId === 'carte_ign') icon = <Map />;

    return {
      id: mId,
      name: meta.label,
      desc: manifest?.description || 'Module d\'encodage.',
      icon,
      color: meta.color,
    };
  });

  return (
    <>
      <LibraryBase 
        title="Modules" 
        items={modules} 
        addItemLabel="Nouveau Module"
        activeItemId={activeModule}
        onItemClick={(item) => setActiveModule(item.id)}
        onEditClick={() => setEditorOpen(true)}
        onAddClick={() => setEditorOpen(true)}
        onDragStartItem={(e, item) => {
          e.dataTransfer.setData('application/x-scoutraider-module', item.id);
          e.dataTransfer.setData('text/plain', item.id);
          e.dataTransfer.effectAllowed = 'copy';
          (window as any).__draggingModuleId = item.id;
        }}
      />
      {editorOpen && (
        <ModuleEditorModal 
          activeModuleId={activeModule || ALL_MODULE_IDS[0]}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </>
  );
}

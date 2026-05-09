import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useApp } from '../../AppContext';
import { ALL_MODULE_IDS, MODULE_META } from '../../logic/ModuleRegistry';
import type { ModuleId } from '../../logic/types';
import { MODULE_DRAG_TYPE } from '../layout/MetroTimeline';

export default function LegendOverlay() {
  const { state } = useApp();
  const [showPicker, setShowPicker] = useState(false);
  
  // Find which modules are actually used in the current route
  const usedModuleIds = new Set<string>();
  if (state.polygonal_steps) {
    for (const seg of state.polygonal_steps) {
      if (seg.assigned_module && seg.assigned_module !== 'unassigned') {
        usedModuleIds.add(seg.assigned_module);
      }
    }
  }

  const activeModules = Array.from(usedModuleIds).map(id => ({
    id,
    name: MODULE_META[id as ModuleId]?.label || id,
    color: MODULE_META[id as ModuleId]?.color || '#6b7280'
  }));

  const availableModules = ALL_MODULE_IDS
    .filter(id => !usedModuleIds.has(id))
    .map(id => ({
      id,
      name: MODULE_META[id as ModuleId]?.label || id,
      color: MODULE_META[id as ModuleId]?.color || '#6b7280'
    }));

  const onDragStart = (e: React.DragEvent, moduleId: string) => {
    e.dataTransfer.setData(MODULE_DRAG_TYPE, moduleId);
    e.dataTransfer.setData('text/plain', moduleId);
    e.dataTransfer.effectAllowed = 'copy';
    (window as any).__draggingModuleId = moduleId;
  };

  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      left: '16px',
      zIndex: 1100,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* LEGEND BOX */}
      <div className="panel-glass" style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-lg)',
        width: '200px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>Légende</span>
          <button 
            className="btn-icon btn-sm" 
            style={{ width: '20px', height: '20px' }}
            onClick={() => setShowPicker(!showPicker)}
            title="Ajouter un code"
          >
            <Plus size={13} />
          </button>
        </div>

        {activeModules.length === 0 ? (
          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
            Aucun code assigné
          </div>
        ) : (
          activeModules.map(module => (
            <div 
              key={module.id} 
              draggable
              onDragStart={e => onDragStart(e, module.id)}
              title="Glisser pour assigner ce code à un tronçon"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#fff', cursor: 'grab', padding: '2px 0' }}
            >
              <div style={{ width: '22px', height: '5px', borderRadius: '2px', background: module.color, flexShrink: 0 }} />
              <span>{module.name}</span>
            </div>
          ))
        )}
      </div>

      {/* MODULE PICKER POPUP */}
      {showPicker && (
        <div className="panel panel-glass" style={{
          width: '220px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Disponibles</span>
            <button className="btn-icon" style={{ width: '20px', height: '20px' }} onClick={() => setShowPicker(false)}>
              <X size={12} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {availableModules.map(m => (
              <div 
                key={m.id} 
                draggable
                onDragStart={e => onDragStart(e, m.id)}
                title="Glisser pour assigner ce code à un tronçon"
                className="menu-item-hover"
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', 
                  background: 'var(--bg-dark)', borderRadius: '6px', cursor: 'grab',
                  transition: '0.2s'
                }}
              >
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: m.color }} />
                <span style={{ fontSize: '12px' }}>{m.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Search, Plus, Check, Edit2 } from 'lucide-react';

export interface LibraryItem {
  id: string;
  name: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

interface LibraryBaseProps {
  title: string;
  items: LibraryItem[];
  onItemClick?: (item: LibraryItem) => void;
  addItemLabel?: string;
  activeItemId?: string;
  onEditClick?: () => void;
  onAddClick?: () => void;
  onDragStartItem?: (e: React.DragEvent, item: LibraryItem) => void;
}

export default function LibraryBase({ title, items, onItemClick, addItemLabel = 'élément', activeItemId, onEditClick, onAddClick, onDragStartItem }: LibraryBaseProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const activeItem = items.find(i => i.id === activeItemId) || items[0];

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '12px 0' }}>

      {/* ── Active item summary card ─────────────────────────────── */}
      {activeItem && (
        <div style={{
          margin: '0 12px 12px',
          padding: '14px',
          borderRadius: '12px',
          background: `linear-gradient(135deg, ${activeItem.color}20, ${activeItem.color}05)`,
          border: `1px solid ${activeItem.color}30`,
          boxShadow: `0 0 20px ${activeItem.color}10`,
          flexShrink: 0,
          position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div style={{ 
                width: '32px', height: '32px', borderRadius: '8px', 
                background: `linear-gradient(135deg, ${activeItem.color}cc, ${activeItem.color})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
            }}>
                {React.cloneElement(activeItem.icon as React.ReactElement, { size: 18, strokeWidth: 2 })}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: activeItem.color, lineHeight: 1.2 }}>
                    {activeItem.name}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Actif
                </div>
            </div>
            
            {/* Edit button */}
            <button className="btn-icon" onClick={onEditClick} style={{ width: '28px', height: '28px', color: activeItem.color, background: 'rgba(255,255,255,0.05)' }}>
                <Edit2 size={14} />
            </button>
          </div>

          <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.5,
          }}>
              {activeItem.desc}
          </div>
        </div>
      )}

      {/* ── Separator / Search ─────────────────────────────────────────────── */}
      <div style={{ padding: '0 12px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Choisir un(e) {title.toLowerCase()}
            </div>
        </div>
        
        <div className="search-bar" style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.02)' }}>
            <Search size={13} strokeWidth={2.4} color="var(--text-dim)" />
            <input 
                type="text" 
                placeholder="Rechercher..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ fontSize: '11px' }}
            />
        </div>
      </div>

      {/* ── Item list ───────────────────────────────────────────── */}
      <div style={{
          padding: '0 12px 12px',
          display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
          {filteredItems.map(item => {
              const isActive = activeItemId === item.id;
              return (
                  <button
                      key={item.id}
                      draggable={!!onDragStartItem}
                      onDragStart={e => onDragStartItem?.(e, item)}
                      onClick={() => onItemClick?.(item)}
                      style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          width: '100%', padding: '9px 10px',
                          borderRadius: '8px', border: '1px solid',
                          borderColor: isActive ? `${item.color}50` : 'rgba(255,255,255,0.04)',
                          background: isActive ? `${item.color}14` : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                          if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                          }
                      }}
                      onMouseLeave={e => {
                          if (!isActive) {
                              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.04)';
                          }
                      }}
                  >
                      {/* Icon */}
                      <div style={{ 
                          width: '24px', height: '24px', borderRadius: '6px', 
                          background: isActive ? item.color : 'rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isActive ? '#000' : 'var(--text-primary)',
                          flexShrink: 0
                      }}>
                          {React.cloneElement(item.icon as React.ReactElement, { size: 14, strokeWidth: 2.5 })}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                              fontSize: '12px',
                              fontWeight: isActive ? 700 : 500,
                              color: isActive ? item.color : 'rgba(255,255,255,0.7)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              lineHeight: 1.3,
                          }}>
                              {item.name}
                          </div>
                      </div>

                      {/* Active check */}
                      {isActive && (
                          <Check size={13} color={item.color} strokeWidth={3} style={{ flexShrink: 0 }} />
                      )}
                  </button>
              );
          })}
          
          <button 
              onClick={onAddClick}
              style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  width: '100%', padding: '10px', marginTop: '4px',
                  borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                  transition: 'all 0.15s'
              }}
              onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
              }}
          >
              <Plus size={16} /> {addItemLabel}
          </button>
      </div>
    </div>
  );
}

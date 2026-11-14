import React from 'react';
import { X, Boxes } from 'lucide-react';
import UnifiedResourceHub from '../panels/UnifiedResourceHub';

export type SectionId = 'layers' | 'orchestration' | 'themes' | 'modules' | 'maps' | 'export' | 'hub';

interface RightSidebarProps {
  activeSection?: SectionId;
  onSectionChange?: (id: SectionId) => void;
  onPreferencesOpen?: () => void;
  onMarketplaceOpen?: () => void;
  onClose?: () => void;
  width: number | string;
}

export default function RightSidebar({ 
  width,
  onClose,
  onPreferencesOpen
}: RightSidebarProps) {
  const isFull = width === '100%' || width === 'auto';

  return (
    <div style={{ 
      width: typeof width === 'number' ? `${width}px` : width, 
      flexShrink: 0, 
      display: 'flex', 
      flexDirection: 'column', 
      borderLeft: isFull ? 'none' : '1px solid var(--border-subtle)',
      background: 'var(--bg-base)',
      height: '100%',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Sleek top header for the sidebar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-panel)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Boxes size={16} color="var(--accent-default)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', letterSpacing: '0.02em' }}>
            Marketplace & Ressources
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            title="Fermer le panneau (Ctrl+])"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 100ms ease'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-dim)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Main Unified Resource Hub content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <UnifiedResourceHub 
          isCompact={false} 
          onPreferencesOpen={onPreferencesOpen}
        />
      </div>
    </div>
  );
}

import React from 'react';
import { X, Boxes, Maximize2 } from 'lucide-react';
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
  onMarketplaceOpen,
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
          <Boxes size={16} color="var(--accent-hover)" aria-hidden="true" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Marketplace & Ressources
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {onMarketplaceOpen && (
            <button
              type="button"
              className="btn-icon"
              onClick={onMarketplaceOpen}
              title="Agrandir la Marketplace"
              aria-label="Agrandir la Marketplace en grand écran"
            >
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              className="btn-icon"
              onClick={onClose}
              title="Fermer le panneau (Ctrl+])"
              aria-label="Fermer le panneau"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Main Unified Resource Hub content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <UnifiedResourceHub 
          isCompact={!isFull}
          onPreferencesOpen={onPreferencesOpen}
        />
      </div>
    </div>
  );
}

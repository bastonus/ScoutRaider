import React from 'react';
import { X } from 'lucide-react';
import UnifiedResourceHub, { UnifiedCategory } from './UnifiedResourceHub';

interface MarketplaceModalProps {
  onClose: () => void;
  initialCategory?: string;
}

export default function MarketplaceModal({ onClose, initialCategory = 'all' }: MarketplaceModalProps) {
  const cat: UnifiedCategory = 
    initialCategory === 'maps' ? 'maps' :
    initialCategory === 'code' ? 'code' :
    initialCategory === 'orchestration' ? 'orchestration' :
    initialCategory === 'theme' ? 'theme' :
    initialCategory === 'my_library' ? 'my_library' : 'all';

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        padding: '20px'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: '1100px',
        height: '88vh',
        background: 'var(--bg-base)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '18px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Floating Close Button in top right */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '12px',
          zIndex: 100,
          pointerEvents: 'all'
        }}>
          <button
            onClick={onClose}
            title="Fermer (Échap)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 100ms ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-bright)';
              e.currentTarget.style.borderColor = 'var(--border-strong)';
              e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-dim)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.background = 'var(--bg-elevated)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Unified Resource Hub with floating bar aesthetic */}
        <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
          <UnifiedResourceHub
            initialCategory={cat}
            isCompact={false}
          />
        </div>
      </div>
    </div>
  );
}

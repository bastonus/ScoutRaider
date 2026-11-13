import React from 'react';

interface FloatingToolbarProps {
  activeTool: string;
  onToolChange: (toolId: string) => void;
}

// ── Shared island cell style ──────────────────────────────────────────────────
// Inner radius rule:
// Container: padding 4px, border-radius 14px (--radius-toolbar/--radius-sm).
// Inner buttons: 34px × 34px, border-radius 10px (14px - 4px = 10px).
const CELL: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '14px',
  padding: '4px',
  boxShadow: 'var(--shadow-lg)',
  pointerEvents: 'all' as const,
  flexShrink: 0,
};

export default function FloatingToolbar({ activeTool, onToolChange }: FloatingToolbarProps) {

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) return;
      const key = e.key.toLowerCase();
      switch (key) {
        case 'p': onToolChange('route'); break;
        case 'h': onToolChange('route_direct'); break;
        case 'n': onToolChange('node'); break;
        case 'a': onToolChange('azimut'); break;
        case 'e': onToolChange('encodage'); break;
        case 'r': onToolChange('annotate_point'); break;
        case 't': onToolChange('annotate_text'); break;
        case 'z': onToolChange('annotate_area'); break;
        case 'x': onToolChange('annotate_area_routed'); break;
        case 'b': onToolChange('annotate_draw'); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToolChange]);

  const btn = (id: string, icon: React.ReactNode, label: string) => {
    const isActive = activeTool === id;
    return (
      <button
        key={id}
        onClick={() => onToolChange(id)}
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          border: isActive ? '1px solid var(--accent-default)' : '1px solid transparent',
          background: isActive ? 'var(--accent-default)' : 'transparent',
          borderRadius: '10px',
          cursor: 'pointer',
          color: isActive ? '#ffffff' : 'var(--text-dim)',
          transition: 'all 100ms ease',
          boxShadow: 'none',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-dim)';
          }
        }}
      >
        {icon}
      </button>
    );
  };

  return (
    <div
      id="toolbar-container"
      style={{
        position: 'absolute',
        bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        pointerEvents: 'none',
        background: 'transparent',
        maxWidth: 'calc(100% - 20px)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        padding: '4px',
      }}
    >

      {/* ── Cellule 1 : Tracés ──────────────────────────────────────────────── */}
      <div style={CELL}>
        {/* Tracé pédestre */}
        {btn('route', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.97 9.304A8 8 0 0 0 2 10c0 4.69 4.887 9.562 7.022 11.468" />
            <path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
            <circle cx="10" cy="10" r="3" />
          </svg>
        ), 'Tracé pédestre BRouter (P)')}

        {/* Tracé hors piste */}
        {btn('route_direct', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10.586 5.414-5.172 5.172" />
            <path d="m18.586 13.414-5.172 5.172" />
            <path d="M6 12h12" />
            <circle cx="12" cy="20" r="2" />
            <circle cx="12" cy="4" r="2" />
            <circle cx="20" cy="12" r="2" />
            <circle cx="4" cy="12" r="2" />
          </svg>
        ), 'Tracé hors piste direct (H)')}
      </div>

      {/* ── Cellule 2 : Nœud + Azimut ──────────────────────────────────────── */}
      <div style={CELL}>
        {/* Nœud */}
        {btn('node', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/>
            <path d="M5 17A12 12 0 0 1 17 5"/>
            <circle cx="19" cy="5" r="2"/>
            <circle cx="5" cy="19" r="2"/>
          </svg>
        ), 'Édition des nœuds : ajouter, déplacer, supprimer (N)')}

        {/* Azimut */}
        {btn('azimut', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12.99 6.74 1.93 3.44" />
            <path d="M19.136 12a10 10 0 0 1-14.271 0" />
            <path d="m21 21-2.16-3.84" />
            <path d="m3 21 8.02-14.26" />
            <circle cx="12" cy="5" r="2" />
          </svg>
        ), "Ajuster l'azimut (A)")}
      </div>

      {/* ── Cellule 3 : Repère ──────────────────────────────────────────────── */}
      <div style={CELL}>
        {btn('annotate_point', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z" />
            <circle cx="12" cy="9" r="2.5" />
          </svg>
        ), 'Repère (R)')}
      </div>

      {/* ── Cellule 4 : Zones ───────────────────────────────────────────────── */}
      <div style={CELL}>
        {/* Zone libre — VectorPolygon icon */}
        {btn('annotate_area', (
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12.828 4.813 5.344 2.375"/>
            <path d="m15.769 18.153 3.461-8.306"/>
            <path d="m5.687 14.074 7.625 4.852"/>
            <path d="M9.772 5.579 5.228 11.42"/>
            <circle cx="11" cy="4" r="2"/>
            <circle cx="15" cy="20" r="2"/>
            <circle cx="20" cy="8" r="2"/>
            <circle cx="4" cy="13" r="2"/>
          </svg>
        ), 'Zone libre polygonale (Z)')}

        {/* Zone BRouter */}
        {btn('annotate_area_routed', (
          <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12.828 4.813 5.344 2.375"/>
            <path d="m15.769 18.153 3.461-8.306"/>
            <path d="m5.687 14.074 7.625 4.852"/>
            <path d="M9.772 5.579 5.228 11.42"/>
            <circle cx="11" cy="4" r="2"/>
            <circle cx="15" cy="20" r="2"/>
            <circle cx="20" cy="8" r="2"/>
            <circle cx="4" cy="13" r="2"/>
            <path d="M6 13 Q9 10 12 13 Q15 16 18 13" strokeWidth="1.5" strokeDasharray="2 1.5" opacity="0.85"/>
          </svg>
        ), 'Zone sur sentiers BRouter (X)')}

        {/* Pinceau libre (B) */}
        {btn('annotate_draw', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 22a1 1 0 0 1-1-1v-4l14-14 5 5L7 22z"/>
            <path d="M6 17 3 20"/>
            <path d="m16 7 1-1"/>
          </svg>
        ), 'Dessin libre au pinceau (B)')}

        {/* Texte libre (T) */}
        {btn('annotate_text', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        ), 'Texte libre sur carte (T)')}
      </div>

      {/* ── Cellule 5 : Encodage ────────────────────────────────────────────── */}
      <div style={CELL}>
        {btn('encodage', (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 8.5V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16.286a.71.71 0 0 0 1.212.502l2.202-2.202A2 2 0 0 1 6.828 19H10" />
            <path d="M20 15v-2a2 2 0 0 0-4 0v2" />
            <rect x="14" y="15" width="8" height="5" rx="1" />
          </svg>
        ), "Encodage cryptographique du raid (E)")}
      </div>

    </div>
  );
}

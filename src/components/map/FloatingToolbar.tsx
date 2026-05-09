import React, { useState } from 'react';

interface FloatingToolbarProps {
  activeTool: string;
  onToolChange: (toolId: string) => void;
}

export default function FloatingToolbar({ activeTool, onToolChange }: FloatingToolbarProps) {

  const renderTool = (id: string, icon: React.ReactNode, label: string) => (
    <button 
      key={id}
      onClick={() => onToolChange(id)}
      className={`tb-btn ${activeTool === id ? 'active' : ''}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        border: 'none',
        background: activeTool === id ? 'var(--accent-default)' : 'transparent',
        borderRadius: '9px',
        cursor: 'pointer',
        color: activeTool === id ? '#0a0f0c' : 'var(--text-dim)',
        transition: 'all 0.15s ease',
        boxShadow: activeTool === id ? '0 2px 8px var(--accent-glow)' : 'none',
        position: 'relative'
      }}
      title={label}
    >
      {icon}
    </button>
  );

  const Separator = () => (
    <div style={{ width: '1px', height: '24px', background: 'rgba(110, 201, 126, 0.12)', margin: '0 4px' }} />
  );

  return (
    <div id="toolbar-container" style={{
      position: 'absolute',
      bottom: '28px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1100,
      display: 'flex',
      gap: '12px',
      pointerEvents: 'none'
    }}>
      <div className="map-toolbar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        background: 'rgba(14, 22, 17, 0.92)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        border: '1px solid rgba(110, 201, 126, 0.08)',
        borderRadius: '14px',
        padding: '6px 8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 20px rgba(110, 201, 126, 0.04)',
        pointerEvents: 'all',
        height: 'auto'
      }}>
        {/* GROUPE 1 : ROUTE */}
        {renderTool('route', (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.97 9.304A8 8 0 0 0 2 10c0 4.69 4.887 9.562 7.022 11.468" />
            <path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
            <circle cx="10" cy="10" r="3" />
          </svg>
        ), "Tracer l'itinéraire")}

        <Separator />

        {/* GROUPE 2 : NODES & AZIMUT */}
        {renderTool('node', (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10.586 5.414-5.172 5.172" />
            <path d="m18.586 13.414-5.172 5.172" />
            <path d="M6 12h12" />
            <circle cx="12" cy="20" r="2" />
            <circle cx="12" cy="4" r="2" />
            <circle cx="20" cy="12" r="2" />
            <circle cx="4" cy="12" r="2" />
          </svg>
        ), "Déplacer un nœud")}

        {renderTool('azimut', (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12.99 6.74 1.93 3.44" />
            <path d="M19.136 12a10 10 0 0 1-14.271 0" />
            <path d="m21 21-2.16-3.84" />
            <path d="m3 21 8.02-14.26" />
            <circle cx="12" cy="5" r="2" />
          </svg>
        ), "Ajuster l'azimut")}

        <Separator />

        {/* GROUPE 3 : ENCODAGE */}
        {renderTool('encodage', (
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 8.5V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16.286a.71.71 0 0 0 1.212.502l2.202-2.202A2 2 0 0 1 6.828 19H10" />
            <path d="M20 15v-2a2 2 0 0 0-4 0v2" />
            <rect x="14" y="15" width="8" height="5" rx="1" />
          </svg>
        ), "Encodage d'itinéraire")}
      </div>
    </div>
  );
}

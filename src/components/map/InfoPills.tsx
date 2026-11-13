import React from 'react';
import { Ruler, Loader2 } from 'lucide-react';
import { useApp } from '../../AppContext';

export default function InfoPills() {
  const { state } = useApp();
  const totalDist = state.polygonal_steps.reduce((acc, seg) => acc + (seg.distance || 0), 0) / 1000;

  return (
    <div id="info-pills" style={{
      position: 'absolute',
      bottom: 'calc(max(16px, env(safe-area-inset-bottom, 16px)) + 52px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      gap: '8px',
      pointerEvents: 'none'
    }}>
      <div style={{
        padding: '6px 14px',
        borderRadius: 'var(--radius-pill)',
        fontSize: '11.5px',
        fontWeight: 600,
        color: 'var(--text-primary)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-md)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'all'
      }}>
        {state.is_loading ? (
            <>
                <Loader2 size={14} className="spin" color="var(--accent-default)" style={{ animation: 'spin 1s linear infinite' }} />
                <span>{state.loading_text || "Calculs en cours..."}</span>
            </>
        ) : (
            <>
                <Ruler size={14} color="var(--accent-default)" />
                <span style={{ fontFamily: 'var(--font-mono)' }}>{totalDist.toFixed(1)} km</span>
            </>
        )}
      </div>
    </div>
  );
}

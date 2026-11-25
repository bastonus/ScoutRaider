import React from 'react';
import { Ruler, Loader2 } from 'lucide-react';
import { useRoutes, useUI } from '../../hooks';
import { formatDistanceFr } from '../../logic/geocoding';

export default function InfoPills() {
  const { routes } = useRoutes();
  const { isLoading, loadingText } = useUI();
  const totalDistM = (routes || []).reduce((acc, r) => acc + (r?.distance_m || 0), 0);

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
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'all'
      }}>
        {isLoading ? (
            <>
                <Loader2 size={14} className="spin" color="#64748B" style={{ animation: 'spin 1s linear infinite' }} />
                <span>{loadingText || "Calculs en cours..."}</span>
            </>
        ) : (
            <>
                <Ruler size={14} color="#94A3B8" />
                <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>{formatDistanceFr(totalDistM)}</span>
            </>
        )}
      </div>
    </div>
  );
}

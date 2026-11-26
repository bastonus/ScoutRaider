import React from 'react';
import { Ruler, Loader2 } from 'lucide-react';
import { useRoutes, useUI } from '../../hooks';
import { formatDistanceFr } from '../../logic/geocoding';
import { useMapHoverHint } from './mapHoverHint';

export default function InfoPills({ centerOffsetPx = 0 }: { centerOffsetPx?: number }) {
  const { routes } = useRoutes();
  const { isLoading, loadingText } = useUI();
  const hoverHint = useMapHoverHint();
  const totalDistM = (routes || []).reduce((acc, r) => acc + (r?.distance_m || 0), 0);

  return (
    <div
      id="info-pills"
      style={{
        position: 'absolute',
        bottom: 'calc(max(16px, env(safe-area-inset-bottom, 16px)) + 52px)',
        left: centerOffsetPx ? `calc(50% + ${centerOffsetPx}px)` : '50%',
        transform: 'translateX(-50%)',
        transition: 'left 180ms ease',
        zIndex: 1000,
        display: 'flex',
        gap: '8px',
        pointerEvents: 'none',
        maxWidth: 'calc(100vw - 32px)',
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '6px 14px',
          borderRadius: 'var(--radius-pill)',
          fontSize: '11.5px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          background: 'var(--bg-elevated)',
          border: `1px solid ${hoverHint ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
          boxShadow: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'all',
          maxWidth: '100%',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          transition: 'border-color 150ms ease, background-color 150ms ease',
        }}
      >
        {hoverHint ? (
          <>
            <span
              aria-hidden="true"
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '9999px',
                background: hoverHint.accent || 'var(--accent-default)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: 'var(--text-primary)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {hoverHint.action}
            </span>
          </>
        ) : isLoading ? (
          <>
            <Loader2
              size={14}
              className="spin"
              color="var(--text-dim)"
              style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {loadingText || 'Calculs en cours...'}
            </span>
          </>
        ) : (
          <>
            <Ruler size={14} color="var(--text-dim)" style={{ flexShrink: 0 }} />
            <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)' }}>
              {formatDistanceFr(totalDistM)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

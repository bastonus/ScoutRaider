import React from 'react';
import { useRoutes, useUI, useViewport } from '../../hooks';
import { Loader2, Navigation } from 'lucide-react';

export default function MapHUD() {
    const { routes } = useRoutes();
    const { isLoading, loadingText } = useUI();
    const { isMobile } = useViewport();

    // Calc total distance from routes
    const totalDist = routes.reduce((acc, r) => acc + (r?.distance_m || 0), 0) / 1000;

    return (
        <div style={{
            position: 'absolute',
            top: isMobile ? '64px' : 'auto',
            bottom: isMobile ? 'auto' : 'max(16px, env(safe-area-inset-bottom, 16px))',
            left: isMobile ? '12px' : '16px',
            pointerEvents: 'none',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-start',
        }}>
            <div
                role={isLoading ? 'status' : undefined}
                style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    padding: isMobile ? '5px 11px' : '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: 'var(--shadow-md)',
                    pointerEvents: 'auto'
                }}
            >
                {isLoading ? (
                    <>
                        <Loader2 size={15} className="spin" aria-hidden="true" style={{ color: 'var(--accent-hover)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {loadingText || "Calculs en cours…"}
                        </span>
                    </>
                ) : (
                    <>
                        <Navigation size={14} aria-hidden="true" style={{ color: 'var(--text-dim)' }} />
                        <span className="tabular-nums" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-default)' }}>
                            {totalDist.toFixed(1)} km
                        </span>
                    </>
                )}
            </div>
        </div>
    );
}

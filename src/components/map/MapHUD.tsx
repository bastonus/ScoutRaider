import React, { useEffect, useState } from 'react';
import { useApp } from '../../AppContext';
import { Loader2, Navigation, AlertTriangle, AlertOctagon, Info } from 'lucide-react';

export default function MapHUD() {
    const { state } = useApp();

    // Calc total distance from routes
    const totalDist = state.routes.reduce((acc, r) => acc + (r?.distance_m || 0), 0) / 1000;

    return (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 1000,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '16px'
        }}>

            {/* Bottom Area: Loading / HUD Pill */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                    background: 'var(--bg-glass)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid var(--glass-border)',
                    padding: '6px 16px',
                    borderRadius: 'var(--radius-pill)',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                    pointerEvents: 'auto'
                }}>
                    {state.is_loading ? (
                        <>
                            <Loader2 size={16} className="spin" style={{ color: 'var(--semantic-green)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-bright)' }}>
                                {state.loading_text || "Calculs en cours..."}
                            </span>
                        </>
                    ) : (
                        <>
                            <Navigation size={16} style={{ color: 'var(--text-dim)' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)' }}>
                                Distance totale : {totalDist.toFixed(1)} km
                            </span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

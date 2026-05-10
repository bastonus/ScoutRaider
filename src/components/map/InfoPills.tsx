import React from 'react';
import { Ruler, Activity, Loader2 } from 'lucide-react';
import { useApp } from '../../AppContext';

export default function InfoPills() {
  const { state } = useApp();
  const totalDist = state.polygonal_steps.reduce((acc, seg) => acc + (seg.distance || 0), 0) / 1000;

  return (
    <div id="info-pills" style={{
      position: 'absolute',
      bottom: '88px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1000,
      display: 'flex',
      gap: '12px',
      pointerEvents: 'none'
    }}>
      <div className="panel-glass notification-pill" style={{
        padding: '8px 18px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: 600,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        pointerEvents: 'all'
      }}>
        {state.is_loading ? (
            <>
                <Loader2 size={16} className="spin" color="var(--semantic-green)" />
                <span>{state.loading_text || "Calculs en cours..."}</span>
            </>
        ) : (
            <>
                <Ruler size={16} color="var(--accent-default)" />
                <span>{totalDist.toFixed(1)} km</span>
            </>
        )}
      </div>
    </div>
  );
}

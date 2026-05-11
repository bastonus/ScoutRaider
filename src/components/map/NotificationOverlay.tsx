import React, { useEffect, useState } from 'react';
import { AlertTriangle, AlertOctagon, Info, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../AppContext';

export default function NotificationOverlay() {
  const { state, dispatch } = useApp();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const lastProcessedId = React.useRef<string | null>(null);

  // Timer to Auto-clear notifications visually
  useEffect(() => {
      const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
      return () => clearInterval(interval);
  }, []);

  useEffect(() => {
      if (state.notifications.length === 0) return;
      const latest = state.notifications[state.notifications.length - 1];
      if (latest.id !== lastProcessedId.current) {
          lastProcessedId.current = latest.id;
          if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
              new Notification('ScoutRaider', { body: latest.message });
          } else if (document.visibilityState === 'hidden' && Notification.permission !== 'denied') {
              Notification.requestPermission().then(permission => {
                  if (permission === 'granted') {
                      new Notification('ScoutRaider', { body: latest.message });
                  }
              });
          }
      }
  }, [state.notifications]);

  const activeNotifs = state.notifications.filter(n => n.expiresAt > currentTime);

  return (
    <div style={{
      position: 'absolute',
      top: '56px', // below menubar
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000000,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      alignItems: 'center',
      pointerEvents: 'none'
    }}>
      {activeNotifs.map(notif => {
        const isError = notif.type === 'error';
        const isWarn = notif.type === 'warning';
        const isInfo = notif.type === 'info';

        return (
          <div key={notif.id} className={isError || isWarn ? "panel-glass" : "notification-pill"} style={{
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            width: '320px',
            pointerEvents: 'all',
            background: isError ? 'rgba(50, 15, 15, 0.92)' : isWarn ? 'rgba(30, 20, 10, 0.92)' : 'var(--glass-bg)',
            borderColor: isError ? 'var(--semantic-red)' : isWarn ? 'var(--semantic-orange-bg)' : 'rgba(110, 201, 126, 0.08)',
            backdropFilter: 'blur(16px)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            color: '#fff',
            animation: 'slideDown 0.3s ease-out'
          }}>
            <div style={{ 
                padding: '6px', 
                borderRadius: '10px', 
                background: isError ? 'rgba(239, 68, 68, 0.2)' : isWarn ? 'var(--semantic-orange-bg)' : 'transparent', 
                flexShrink: 0 
            }}>
              {isError ? <AlertOctagon size={16} color="var(--semantic-red)" /> : 
               isWarn ? <AlertTriangle size={16} color="var(--semantic-orange)" strokeWidth={2.5} /> : 
               <Info size={16} color="var(--semantic-green)" />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '13px', color: '#fff', marginBottom: '2px' }}>
                {isError ? "Erreur" : isWarn ? "Vigilance" : "Information"}
              </div>
              <div style={{ fontSize: '11.5px', lineHeight: '1.4', color: 'var(--text-default)', opacity: 0.9 }}>
                {notif.message}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  );
}

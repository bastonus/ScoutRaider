import React, { useState } from 'react';
import { mapRef } from './MapComponent';
import HelpModal from './HelpModal';
import { useApp } from '../../AppContext';

export default function ControlToolbar() {
    const { state, dispatch } = useApp();
    const [helpOpen, setHelpOpen] = useState(false);

    const zoomIn = () => mapRef.current?.zoomIn();
    const zoomOut = () => mapRef.current?.zoomOut();

    const btnStyle: React.CSSProperties = {
        width: '32px', height: '32px',
        border: 'none', background: 'transparent',
        color: 'var(--text-dim)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: '9px', transition: 'background 0.15s, color 0.15s',
    };

    const pillStyle: React.CSSProperties = {
        display: 'flex', alignItems: 'center', padding: '3px',
        background: 'rgba(14, 22, 17, 0.92)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        border: '1px solid rgba(110, 201, 126, 0.08)',
        borderRadius: '12px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        pointerEvents: 'all',
    };

    return (
        <>
            <div id="bottom-right-container" style={{
                position: 'absolute', bottom: '28px', right: '28px',
                zIndex: 1100, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end',
            }}>
                {/* ZOOM PILL */}
                <div style={{ ...pillStyle, flexDirection: 'column', gap: '2px' }}>
                    <button
                        type="button"
                        onClick={zoomIn}
                        style={btnStyle}
                        title="Zoomer"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <div style={{ width: '24px', height: '1px', background: 'rgba(110, 201, 126, 0.12)', margin: '2px 4px' }} />
                    <button
                        type="button"
                        onClick={zoomOut}
                        style={btnStyle}
                        title="Dézoomer"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>

                {/* HELP PILL */}
                <div style={pillStyle}>
                    <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        style={btnStyle}
                        title="Aide — Guide du Raid"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                    >
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.5" />
                        </svg>
                    </button>
                </div>
            </div>

            <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        </>
    );
}

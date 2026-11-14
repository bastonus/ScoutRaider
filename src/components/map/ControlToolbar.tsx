import React, { useState } from 'react';
import { mapRef } from './MapComponent';
import HelpModal from './HelpModal';
import { useApp } from '../../AppContext';

export default function ControlToolbar() {
    const { state, dispatch } = useApp();
    const [helpOpen, setHelpOpen] = useState(false);
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;

    const zoomIn = () => mapRef.current?.zoomIn();
    const zoomOut = () => mapRef.current?.zoomOut();

    // Respect inner radius rule:
    // Container: padding 4px, border-radius 14px.
    // Inner buttons: 34px × 34px, border-radius 10px (14px - 4px = 10px).
    const btnStyle: React.CSSProperties = {
        width: '34px',
        height: '34px',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '10px',
        transition: 'all 100ms ease',
    };

    const pillStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        padding: '4px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '14px',
        boxShadow: 'var(--shadow-lg)',
        pointerEvents: 'all',
    };

    return (
        <>
            <div id="bottom-right-container" style={{
                position: 'absolute',
                bottom: isMobile 
                    ? 'calc(max(16px, env(safe-area-inset-bottom, 16px)) + 58px)' 
                    : 'max(16px, env(safe-area-inset-bottom, 16px))',
                right: 'max(12px, env(safe-area-inset-right, 12px))',
                zIndex: 1100,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                alignItems: 'flex-end',
            }}>
                {/* ZOOM PILL */}
                <div style={{ ...pillStyle, flexDirection: 'column', gap: '2px' }}>
                    <button
                        type="button"
                        onClick={zoomIn}
                        style={btnStyle}
                        title="Zoom avant (+)"
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-dim)';
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                    <div style={{ width: '22px', height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />
                    <button
                        type="button"
                        onClick={zoomOut}
                        style={btnStyle}
                        title="Zoom arrière (-)"
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-dim)';
                        }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>

                {/* HELP PILL */}
                <div style={pillStyle}>
                    <button
                        type="button"
                        onClick={() => setHelpOpen(true)}
                        style={btnStyle}
                        title="Aide — Guide du Raid"
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--text-dim)';
                        }}
                    >
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

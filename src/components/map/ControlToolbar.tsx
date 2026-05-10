import React, { useState } from 'react';
import { mapRef } from './MapComponent';
import HelpModal from './HelpModal';
import { useApp } from '../../AppContext';

export default function ControlToolbar() {
    const { state, dispatch } = useApp();
    const [helpOpen, setHelpOpen] = useState(false);

    const zoomIn = () => mapRef.current?.zoomIn();
    const zoomOut = () => mapRef.current?.zoomOut();
    const togglePois = () => dispatch({ type: 'TOGGLE_POIS_ON_MAP' });

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
                {/* VISIBILITY TOGGLES PILL (vertical) */}
                <div style={{ ...pillStyle, flexDirection: 'column', gap: '2px' }}>
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'TOGGLE_STAGES_ON_MAP' })}
                        style={{ ...btnStyle, color: state.show_stages_on_map ? '#2d8ceb' : 'var(--text-dim)', background: state.show_stages_on_map ? 'rgba(45,140,235,0.1)' : 'transparent' }}
                        title="Afficher/Masquer les étapes sur la carte"
                        onMouseEnter={e => { e.currentTarget.style.background = state.show_stages_on_map ? 'rgba(45,140,235,0.2)' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = state.show_stages_on_map ? '#2d8ceb' : 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = state.show_stages_on_map ? 'rgba(45,140,235,0.1)' : 'transparent'; e.currentTarget.style.color = state.show_stages_on_map ? '#2d8ceb' : 'var(--text-dim)'; }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </button>
                    <div style={{ width: '24px', height: '1px', background: 'rgba(110, 201, 126, 0.12)', margin: '2px 4px' }} />
                    <button
                        type="button"
                        onClick={togglePois}
                        style={{ ...btnStyle, color: state.show_pois_on_map ? '#fbbf24' : 'var(--text-dim)', background: state.show_pois_on_map ? 'rgba(251,191,36,0.1)' : 'transparent' }}
                        title="Afficher/Masquer les POIs sur la carte"
                        onMouseEnter={e => { e.currentTarget.style.background = state.show_pois_on_map ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = state.show_pois_on_map ? '#fbbf24' : 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = state.show_pois_on_map ? 'rgba(251,191,36,0.1)' : 'transparent'; e.currentTarget.style.color = state.show_pois_on_map ? '#fbbf24' : 'var(--text-dim)'; }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/>
                            <circle cx="12" cy="8" r="2"/>
                            <path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712"/>
                        </svg>
                    </button>
                    <div style={{ width: '24px', height: '1px', background: 'rgba(110, 201, 126, 0.12)', margin: '2px 4px' }} />
                    <button
                        type="button"
                        onClick={() => dispatch({ type: 'TOGGLE_DANGERS_ON_MAP' })}
                        style={{ ...btnStyle, color: state.show_dangers_on_map ? '#ef4444' : 'var(--text-dim)', background: state.show_dangers_on_map ? 'rgba(239,68,68,0.1)' : 'transparent' }}
                        title="Afficher/Masquer les dangers sur la carte"
                        onMouseEnter={e => { e.currentTarget.style.background = state.show_dangers_on_map ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = state.show_dangers_on_map ? '#ef4444' : 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = state.show_dangers_on_map ? 'rgba(239,68,68,0.1)' : 'transparent'; e.currentTarget.style.color = state.show_dangers_on_map ? '#ef4444' : 'var(--text-dim)'; }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                    </button>
                </div>

                {/* ZOOM PILL (vertical) */}
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

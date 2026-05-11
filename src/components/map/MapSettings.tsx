import React, { useState, useRef, useEffect } from 'react';
import { Layers, Settings, HelpCircle, ExternalLink, Key, Check, Info } from 'lucide-react';
import { useApp } from '../../AppContext';

const LAYERS = [
    { id: 'PLAN.IGN', name: 'IGN Plan (Gratuit)', provider: 'IGN' },
    { id: 'SAT.IGN', name: 'IGN Satellite (Gratuit)', provider: 'IGN' },
    { id: 'OSM', name: 'OpenStreetMap', provider: 'OSM' },
    { id: 'SCAN25', name: 'IGN Scan 25/100 (Clé requise)', provider: 'IGN' },
    { id: 'MAPY_OUTDOOR', name: 'Mapy.cz Outdoor (Clé requise)', provider: 'Mapy' },
    { id: 'MAPY_SAT', name: 'Mapy.cz Satellite (Clé requise)', provider: 'Mapy' },
];

export default function MapSettings() {
    const { state, dispatch } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLayerChange = (layerId: string) => {
        dispatch({ type: 'SET_IGN_LAYER', layer: layerId });
    };

    const handleKeyChange = (type: 'mapy' | 'ign', value: string) => {
        dispatch({
            type: 'SET_MAP_API_KEYS',
            mapyKey: type === 'mapy' ? value : undefined,
            ignKey: type === 'ign' ? value : undefined
        });
    };

    const panelStyle: React.CSSProperties = {
        position: 'absolute',
        top: '16px',
        right: '16px',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
    };

    const toggleBtnStyle: React.CSSProperties = {
        width: '38px',
        height: '38px',
        background: 'rgba(14, 22, 17, 0.92)',
        backdropFilter: 'blur(14px) saturate(1.4)',
        border: '1px solid rgba(110, 201, 126, 0.08)',
        borderRadius: '12px',
        color: isOpen ? 'var(--accent-default)' : 'var(--text-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        transition: 'all 0.2s',
    };

    const dropdownStyle: React.CSSProperties = {
        width: '320px',
        background: 'rgba(14, 22, 17, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(110, 201, 126, 0.15)',
        borderRadius: '16px',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.6)',
        padding: '16px',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        gap: '16px',
        animation: 'fadeInScale 0.2s ease-out',
    };

    return (
        <div ref={containerRef} style={panelStyle}>
            <button
                style={toggleBtnStyle}
                onClick={() => setIsOpen(!isOpen)}
                title="Paramètres de la carte"
            >
                <Layers size={20} />
            </button>

            <div style={dropdownStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Layers size={16} color="var(--accent-default)" />
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)' }}>Fonds de Carte</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                    {LAYERS.map(l => (
                        <div
                            key={l.id}
                            onClick={() => handleLayerChange(l.id)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                background: state.active_ign_layer === l.id ? 'rgba(110, 201, 126, 0.15)' : 'transparent',
                                border: '1px solid',
                                borderColor: state.active_ign_layer === l.id ? 'rgba(110, 201, 126, 0.3)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                transition: 'all 0.15s',
                            }}
                        >
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '12px', color: state.active_ign_layer === l.id ? 'var(--accent-default)' : 'var(--text-primary)', fontWeight: state.active_ign_layer === l.id ? 600 : 400 }}>
                                    {l.name}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-dim)', opacity: 0.7 }}>{l.provider}</span>
                            </div>
                            {state.active_ign_layer === l.id && <Check size={14} color="var(--accent-default)" />}
                        </div>
                    ))}
                </div>

                <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Key size={14} color="var(--text-dim)" />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)' }}>Clés API</span>
                        </div>
                        <button
                            onClick={() => setShowTutorial(!showTutorial)}
                            style={{
                                background: 'none', border: 'none', color: 'var(--accent-default)',
                                fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                        >
                            <HelpCircle size={12} />
                            Tuto
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '4px' }}>Mapy.cz API Key</label>
                            <input
                                type="password"
                                value={state.mapy_api_key || ''}
                                onChange={(e) => handleKeyChange('mapy', e.target.value)}
                                placeholder="votre_cle_mapy_cz"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '6px 10px',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '10px', color: 'var(--text-dim)', marginLeft: '4px' }}>IGN Hash (Scan 25)</label>
                            <input
                                type="password"
                                value={state.ign_api_key || ''}
                                onChange={(e) => handleKeyChange('ign', e.target.value)}
                                placeholder="votre_cle_ign_hash"
                                style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    padding: '6px 10px',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {showTutorial && (
                    <div style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: 'rgba(110, 201, 126, 0.05)',
                        border: '1px solid rgba(110, 201, 126, 0.15)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Info size={14} color="var(--accent-default)" />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-bright)' }}>Comment obtenir les clés ?</span>
                        </div>
                        
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', lineHeight: '1.4' }}>
                            <p style={{ marginBottom: '6px' }}>
                                <strong>Mapy.cz :</strong> Créez un compte sur <a href="https://developer.mapy.com" target="_blank" style={{ color: 'var(--accent-default)' }}>developer.mapy.com</a> et créez un projet pour obtenir une clé REST.
                            </p>
                            <p>
                                <strong>IGN Scan 25 :</strong> Créez un compte sur <a href="https://cartes.gouv.fr" target="_blank" style={{ color: 'var(--accent-default)' }}>cartes.gouv.fr</a>, rejoignez la communauté <em>Scan 25/100</em>, puis générez une clé <strong>HASH</strong> dans votre tableau de bord.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes fadeInScale {
                    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );
}

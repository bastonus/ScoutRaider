import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Layers, Key, HelpCircle, ExternalLink, Info, Check, ChevronUp, Map as MapIcon } from 'lucide-react';
import { useApp } from '../../AppContext';
import { MAP_LAYERS, PROVIDERS } from '../../logic/MapConfig';

// ── Component ──────────────────────────────────────────────────────────────────
interface MapSettingsModalProps {
    onClose: () => void;
}

export default function MapSettingsModal({ onClose }: MapSettingsModalProps) {
    const { state, dispatch } = useApp();
    const [activeTab, setActiveTab] = useState<'layers' | 'keys' | 'help'>('layers');
    const [isLayerSelectorOpen, setIsLayerSelectorOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    // Current layer info
    const currentLayerId = state.active_ign_layer || 'PLAN.IGN';
    const currentLayer = MAP_LAYERS[currentLayerId] || MAP_LAYERS['PLAN.IGN'];
    
    // Map category to provider metadata
    const providerKey = currentLayer.category.includes('IGN') ? 'IGN' : 
                       currentLayer.category.includes('Mapy') ? 'Mapy.cz' : 
                       currentLayer.category.includes('OSM') ? 'OSM' : 'IGN';
    
    const currentProvider = PROVIDERS[providerKey as keyof typeof PROVIDERS];

    // Group layers by category
    const layersByCategory = useMemo(() => {
        const groups: Record<string, string[]> = {};
        Object.keys(MAP_LAYERS).forEach(id => {
            const cat = MAP_LAYERS[id].category;
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(id);
        });
        return groups;
    }, []);

    // Close selector on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
                setIsLayerSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLayerChange = (id: string) => {
        dispatch({ type: 'SET_IGN_LAYER', layer: id });
        setIsLayerSelectorOpen(false);
    };

    const handleKeyChange = (type: 'mapy' | 'ign', value: string) => {
        dispatch({
            type: 'SET_MAP_API_KEYS',
            mapyKey: type === 'mapy' ? value : undefined,
            ignKey: type === 'ign' ? value : undefined
        });
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} onClick={onClose}>
            <div style={{
                width: '900px', height: '650px', background: '#0a0f0c', borderRadius: '20px',
                border: '1px solid rgba(110, 201, 126, 0.15)', boxShadow: '0 32px 80px rgba(0,0,0,0.95)',
                display: 'flex', overflow: 'hidden'
            }} onClick={e => e.stopPropagation()}>
                
                {/* ── SIDEBAR ── */}
                <div style={{ width: '220px', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', padding: '24px 0', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ padding: '0 24px', marginBottom: '32px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 900, color: 'var(--accent-default)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Configuration Carte</span>
                    </div>

                    {[
                        { id: 'layers', label: 'Fonds de carte', icon: <Layers size={18} /> },
                        { id: 'keys', label: 'Clés API', icon: <Key size={18} /> },
                        { id: 'help', label: 'Tutoriel & Aide', icon: <HelpCircle size={18} /> }
                    ].map(tab => (
                        <div
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px', cursor: 'pointer',
                                background: activeTab === tab.id ? 'rgba(110, 201, 126, 0.1)' : 'transparent',
                                borderLeft: `4px solid ${activeTab === tab.id ? 'var(--accent-default)' : 'transparent'}`,
                                color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.4)',
                                transition: 'all 0.2s', fontSize: '14px', fontWeight: activeTab === tab.id ? 700 : 500
                            }}
                        >
                            {tab.icon}
                            <span>{tab.label}</span>
                        </div>
                    ))}

                    <div style={{ flex: 1 }} />
                    
                    <button onClick={onClose} style={{ margin: '0 24px', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}>
                        Retour au projet
                    </button>
                </div>

                {/* ── CONTENT AREA ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', background: 'linear-gradient(135deg, rgba(14,22,17,1) 0%, rgba(10,15,12,1) 100%)' }}>
                    
                    {activeTab === 'layers' && (
                        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', height: '100%', gap: '28px', overflowY: 'hidden' }}>
                            {/* Provider Card with Preview Photo */}
                            <div style={{ 
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', 
                                borderRadius: '20px', padding: '24px', display: 'flex', gap: '28px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
                            }}>
                                <div style={{ width: '180px', height: '180px', background: '#fff', borderRadius: '14px', overflow: 'hidden', flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.3)', position: 'relative' }}>
                                    <img src={currentProvider.preview} alt="Aperçu" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px', background: 'rgba(255,255,255,0.95)', display: 'flex', justifyContent: 'center' }}>
                                        <img src={currentProvider.logo} alt={currentProvider.name} style={{ maxHeight: '24px', maxWidth: '80%', objectFit: 'contain' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#fff' }}>{currentProvider.name}</h2>
                                        <a href={currentProvider.website} target="_blank" style={{ color: 'var(--accent-default)', display: 'flex', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                                            <ExternalLink size={16} />
                                        </a>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.7' }}>{currentProvider.description}</p>
                                    
                                    <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                                        <div style={{ padding: '8px 16px', background: 'rgba(110, 201, 126, 0.1)', borderRadius: '10px', border: '1px solid rgba(110, 201, 126, 0.2)', fontSize: '12px', color: 'var(--accent-default)', fontWeight: 700 }}>
                                            Service WMTS Officiel
                                        </div>
                                        <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                                            Max Zoom: {currentLayer.maxZoom}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Specific Parameters Section */}
                            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
                                <div style={{ marginBottom: '14px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Détails techniques du flux</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase' }}>Layer ID</div>
                                        <div style={{ fontSize: '13px', color: '#fff', fontFamily: 'monospace', wordBreak: 'break-all' }}>{currentLayerId}</div>
                                    </div>
                                    <div style={{ padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: '6px', textTransform: 'uppercase' }}>Copyright & Attribution</div>
                                        <div style={{ fontSize: '13px', color: '#fff', lineHeight: '1.4' }}>{currentLayer.attribution}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Layer Selector at the Bottom */}
                            <div style={{ position: 'relative', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }} ref={selectorRef}>
                                <div style={{ marginBottom: '10px' }}>
                                    <span style={{ fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sélectionner un fond de carte</span>
                                </div>
                                <button 
                                    onClick={() => setIsLayerSelectorOpen(!isLayerSelectorOpen)}
                                    style={{
                                        width: '100%', height: '54px', background: 'rgba(110, 201, 126, 0.05)', 
                                        border: '1px solid rgba(110, 201, 126, 0.2)', borderRadius: '14px',
                                        padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        color: '#fff', cursor: 'pointer', transition: 'all 0.2s',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                        <MapIcon size={20} color="var(--accent-default)" />
                                        <span style={{ fontWeight: 700, fontSize: '15px' }}>{currentLayerId} <span style={{ opacity: 0.4, margin: '0 8px' }}>|</span> <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{currentLayer.category}</span></span>
                                    </div>
                                    <ChevronUp size={22} style={{ transform: isLayerSelectorOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                </button>

                                {isLayerSelectorOpen && (
                                    <div style={{
                                        position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '12px',
                                        maxHeight: '400px', overflowY: 'auto', background: '#111814',
                                        border: '1px solid rgba(110, 201, 126, 0.3)', borderRadius: '16px',
                                        boxShadow: '0 -16px 64px rgba(0,0,0,0.9)', padding: '10px',
                                        display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 100,
                                        animation: 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}>
                                        {Object.entries(layersByCategory).map(([cat, ids]) => (
                                            <div key={cat}>
                                                <div style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 900, color: 'var(--accent-default)', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.7, background: 'rgba(255,255,255,0.02)', borderRadius: '6px', margin: '4px 0' }}>{cat}</div>
                                                {ids.map(id => (
                                                    <div
                                                        key={id}
                                                        onClick={() => handleLayerChange(id)}
                                                        style={{
                                                            padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                            background: currentLayerId === id ? 'rgba(110, 201, 126, 0.15)' : 'transparent',
                                                            color: currentLayerId === id ? '#fff' : 'rgba(255,255,255,0.6)',
                                                            fontSize: '14px', transition: 'all 0.15s',
                                                            border: `1px solid ${currentLayerId === id ? 'rgba(110, 201, 126, 0.3)' : 'transparent'}`
                                                        }}
                                                        onMouseEnter={e => { if (currentLayerId !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                                        onMouseLeave={e => { if (currentLayerId !== id) e.currentTarget.style.background = 'transparent'; }}
                                                    >
                                                        <span style={{ fontWeight: currentLayerId === id ? 700 : 400 }}>{id}</span>
                                                        {currentLayerId === id && <Check size={16} color="var(--accent-default)" strokeWidth={3} />}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'keys' && (
                        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <Key size={24} color="var(--accent-default)" />
                                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#fff' }}>Gestion des Accès API</h2>
                            </div>
                            <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.7' }}>Certaines couches (Scan 25, Cassini, Mapy.cz) sont protégées par des clés personnelles. Vos clés sont stockées de manière sécurisée et locale dans votre navigateur.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Clé REST Mapy.cz</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="password" 
                                            value={state.mapy_api_key || ''} 
                                            onChange={e => handleKeyChange('mapy', e.target.value)}
                                            placeholder="votre_cle_api_mapy_cz"
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#fff', outline: 'none', fontSize: '14px', fontFamily: 'monospace' }}
                                        />
                                        <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: state.mapy_api_key ? 'var(--accent-default)' : 'rgba(255,255,255,0.2)' }}>
                                            {state.mapy_api_key ? <Check size={18} /> : <Key size={18} />}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                                        <Info size={14} />
                                        <span>Requis pour Outdoor, Winter et Satellite Mapy.cz.</span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <label style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Clé HASH IGN (Communautés)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input 
                                            type="password" 
                                            value={state.ign_api_key || ''} 
                                            onChange={e => handleKeyChange('ign', e.target.value)}
                                            placeholder="votre_cle_hash_ign"
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '14px 16px', color: '#fff', outline: 'none', fontSize: '14px', fontFamily: 'monospace' }}
                                        />
                                        <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: state.ign_api_key ? 'var(--accent-default)' : 'rgba(255,255,255,0.2)' }}>
                                            {state.ign_api_key ? <Check size={18} /> : <Key size={18} />}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                                        <Info size={14} />
                                        <span>Nécessaire pour Scan 25, Scan 50 et Cassini.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'help' && (
                        <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px', overflowY: 'auto' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <HelpCircle size={24} color="var(--accent-default)" />
                                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#fff' }}>Comment obtenir les accès ?</h2>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                                <section>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '28px', height: '28px', background: 'var(--accent-default)', color: '#000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>1</div>
                                        IGN (Cartes Scan 25/100)
                                    </h3>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.8' }}>
                                        1. Rendez-vous sur <a href="https://www.cartes.gouv.fr" target="_blank" style={{ color: 'var(--accent-default)', fontWeight: 700 }}>cartes.gouv.fr</a> et créez un compte.<br />
                                        2. Allez dans l'onglet <strong>Communautés</strong> et recherchez <em>"Scan 25 / 100"</em>.<br />
                                        3. Faites une demande pour rejoindre la communauté.<br />
                                        4. Une fois accepté, allez dans votre <strong>Tableau de Bord</strong>.<br />
                                        5. Copiez votre clé <strong>HASH</strong> et collez-la dans l'onglet "Clés API" de cette fenêtre.
                                    </div>
                                </section>

                                <section>
                                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ width: '28px', height: '28px', background: 'var(--accent-default)', color: '#000', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>2</div>
                                        Mapy.cz (Outdoor & Satellite)
                                    </h3>
                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '24px', fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.8' }}>
                                        1. Allez sur <a href="https://developer.mapy.com" target="_blank" style={{ color: 'var(--accent-default)', fontWeight: 700 }}>developer.mapy.com</a>.<br />
                                        2. Créez un compte Seznam (ou connectez-vous).<br />
                                        3. Créez un nouveau projet (ex: "ScoutRaider").<br />
                                        4. Générez une <strong>REST API Key</strong>.<br />
                                        5. Collez cette clé dans l'onglet "Clés API" ci-contre.
                                    </div>
                                </section>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}

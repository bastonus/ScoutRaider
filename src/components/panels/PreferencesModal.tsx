import React, { useState, useEffect } from 'react';
import { X, Key, HelpCircle, Map as MapIcon, ShieldCheck, ExternalLink, Settings } from 'lucide-react';
import { useApp } from '../../AppContext';

type PrefCategory = 'maps_api' | 'general';

interface CategoryDef {
    id: PrefCategory;
    label: string;
    icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
    { id: 'maps_api', label: 'Fonds de carte & API', icon: <MapIcon size={14} /> },
    { id: 'general',  label: 'Général', icon: <Settings size={14} /> },
];

interface PreferencesModalProps {
    onClose: () => void;
    initialCategory?: PrefCategory;
}

export default function PreferencesModal({ onClose, initialCategory = 'maps_api' }: PreferencesModalProps) {
    const { state, dispatch } = useApp();
    const [activeCategory, setActiveCategory] = useState<PrefCategory>(initialCategory);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const [ignKey, setIgnKey] = useState(state.ign_api_key || '');
    const [mapyKey, setMapyKey] = useState(state.mapy_api_key || '');

    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [onClose]);

    const handleSaveKeys = () => {
        dispatch({ type: 'SET_MAP_API_KEYS', ignKey, mapyKey });
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Configuration API enregistrée.', notifType: 'info' });
    };

    return (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: isMobile ? '100%' : '800px', 
                    maxWidth: isMobile ? '100vw' : '97vw', 
                    height: isMobile ? '100%' : '540px', 
                    maxHeight: isMobile ? '100dvh' : '96vh',
                    borderRadius: isMobile ? 0 : 'var(--radius-md)',
                    background: 'var(--bg-elevated)',
                    border: isMobile ? 'none' : '1px solid var(--border-subtle)',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                {/* ── Header ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '10px 14px' : '12px 18px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Préférences</span>
                        {!isMobile && <kbd style={{ fontSize: '9px', padding: '1px 5px' }}>Ctrl P</kbd>}
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
                    
                    {/* ── Categories ── */}
                    <div style={{ 
                        width: isMobile ? '100%' : '190px', 
                        flexShrink: 0, 
                        borderRight: isMobile ? 'none' : '1px solid var(--border-subtle)', 
                        borderBottom: isMobile ? '1px solid var(--border-subtle)' : 'none',
                        display: 'flex', 
                        flexDirection: isMobile ? 'row' : 'column', 
                        padding: isMobile ? '4px 8px' : '8px 0', 
                        overflowX: isMobile ? 'auto' : 'hidden',
                        overflowY: isMobile ? 'hidden' : 'auto', 
                        background: 'var(--bg-panel)' 
                    }}>
                        {!isMobile && <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-dim)', padding: '0 14px', marginBottom: '4px' }}>Catégories</div>}
                        {CATEGORIES.map(cat => (
                            <div
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: isMobile ? '8px 12px' : '8px 14px', 
                                    cursor: 'pointer',
                                    background: activeCategory === cat.id ? 'var(--bg-hover)' : 'transparent',
                                    color: activeCategory === cat.id ? 'var(--text-primary)' : 'var(--text-dim)',
                                    transition: 'all 100ms ease',
                                    borderRight: !isMobile && activeCategory === cat.id ? '2px solid var(--accent-default)' : '2px solid transparent',
                                    borderBottom: isMobile && activeCategory === cat.id ? '2px solid var(--accent-default)' : '2px solid transparent',
                                    borderRadius: isMobile ? '6px' : 0,
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {cat.icon}
                                <span style={{ fontSize: '12px', fontWeight: activeCategory === cat.id ? 600 : 400 }}>{cat.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── Content ── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: isMobile ? '16px' : '24px', overflowY: 'auto' }}>
                        
                        {activeCategory === 'maps_api' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Configuration des API Cartographiques</div>
                                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                                        Certains fonds de carte nécessitent des clés API personnelles pour fonctionner. 
                                        Ces clés sont enregistrées <span style={{ color: 'var(--accent-default)' }}>localement sur votre ordinateur</span> et ne sont jamais incluses dans les fichiers de projet (.srdoc).
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* IGN KEY */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Clé de Service IGN (GéoPlateforme)</label>
                                        <input 
                                            type="text" 
                                            name="scoutraider_ign_key"
                                            autoComplete="off"
                                            value={ignKey}
                                            onChange={(e) => setIgnKey(e.target.value)}
                                            placeholder="Votre clé HASH IGN..."
                                            style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px',
                                                padding: '10px 14px',
                                                color: '#fff',
                                                fontSize: '13px',
                                                outline: 'none',
                                                fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>

                                    {/* MAPY KEY */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>Clé API Mapy.cz</label>
                                        <input 
                                            type="text" 
                                            name="scoutraider_mapy_key"
                                            autoComplete="off"
                                            value={mapyKey}
                                            onChange={(e) => setMapyKey(e.target.value)}
                                            placeholder="Votre clé REST Mapy.cz..."
                                            style={{
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '6px',
                                                padding: '10px 14px',
                                                color: '#fff',
                                                fontSize: '13px',
                                                outline: 'none',
                                                fontFamily: 'monospace'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Tutorials */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-default)', textTransform: 'uppercase' }}>Tutoriels d'accès</div>
                                    
                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Cartes IGN (Scan 25 / 100)</span>
                                            <ExternalLink size={14} color="rgba(255,255,255,0.3)" cursor="pointer" onClick={() => window.open('https://cartes.gouv.fr', '_blank')} />
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                                            1. Créez un compte sur <a href="https://cartes.gouv.fr" target="_blank" style={{ color: 'var(--accent-default)' }}>cartes.gouv.fr</a>.<br/>
                                            2. Accédez à <a href="https://cartes.gouv.fr/rejoindre-des-communautes" target="_blank" style={{ color: 'var(--accent-default)' }}>Rejoindre des communautés</a>.<br/>
                                            3. Recherchez <span style={{ color: '#fff' }}>"scan 25/100"</span> et demandez l'accès.<br/>
                                            4. Une fois accepté, récupérez votre <span style={{ color: '#fff' }}>Clef de service</span> dans votre profil.
                                        </div>
                                    </div>

                                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Fonds Mapy.cz</span>
                                            <ExternalLink size={14} color="rgba(255,255,255,0.3)" cursor="pointer" onClick={() => window.open('https://developer.mapy.com/rest-api-mapy-cz/how-to-start/', '_blank')} />
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                                            1. Connectez-vous sur le <a href="https://developer.mapy.com" target="_blank" style={{ color: 'var(--accent-default)' }}>portail développeur</a>.<br/>
                                            2. Créez un projet et générez une <span style={{ color: '#fff' }}>API Key</span>.<br/>
                                            3. Cette clé débloque les fonds Outdoor, Winter et Sat.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeCategory === 'general' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Paramètres Généraux</div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Recherche automatique de mises à jour</div>
                                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Vérifie si une nouvelle version est disponible au lancement de l'application.</div>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            checked={state.auto_check_updates}
                                            onChange={(e) => dispatch({ type: 'SET_AUTO_CHECK_UPDATES', enabled: e.target.checked })}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-default)', cursor: 'pointer' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* ── Footer ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-panel)' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '0 12px', height: '30px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11.5px', fontWeight: 500 }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={() => { handleSaveKeys(); onClose(); }}
                        style={{
                            padding: '0 14px', height: '30px', background: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary-text)', cursor: 'pointer',
                            fontSize: '11.5px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-primary-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-primary)'}
                    >
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
}

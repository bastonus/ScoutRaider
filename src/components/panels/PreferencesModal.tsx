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
                    width: '860px', maxWidth: '97vw', height: '580px', maxHeight: '96vh',
                    background: '#0d0d14', borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                {/* ── Header ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>Préférences</span>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>Ctrl+P</span>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
                        <X size={16} />
                    </button>
                </div>

                {/* ── Body ── */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                    
                    {/* ── LEFT: Categories ── */}
                    <div style={{ width: '200px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', paddingTop: '10px', paddingBottom: '10px', overflowY: 'auto' }}>
                        <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 18px', marginBottom: '6px' }}>Catégories</div>
                        {CATEGORIES.map(cat => (
                            <div
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 18px', cursor: 'pointer',
                                    background: activeCategory === cat.id ? 'rgba(110, 201, 126, 0.08)' : 'transparent',
                                    color: activeCategory === cat.id ? 'var(--accent-default)' : 'rgba(255,255,255,0.5)',
                                    transition: 'all 0.15s',
                                    borderRight: activeCategory === cat.id ? '2px solid var(--accent-default)' : 'none'
                                }}
                            >
                                {cat.icon}
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{cat.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* ── RIGHT: Content ── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '24px', overflowY: 'auto' }}>
                        
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Paramètres Généraux</div>
                                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>D'autres réglages seront disponibles prochainement.</div>
                            </div>
                        )}

                    </div>
                </div>

                {/* ── Footer ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                    >
                        Annuler
                    </button>
                    <button
                        onClick={() => { handleSaveKeys(); onClose(); }}
                        style={{
                            padding: '8px 22px', background: 'var(--accent-default)',
                            border: 'none', borderRadius: '6px', color: '#0a0f0c', cursor: 'pointer',
                            fontSize: '12px', fontWeight: 700,
                            display: 'flex', alignItems: 'center', gap: '7px'
                        }}
                    >
                        Enregistrer les modifications
                    </button>
                </div>
            </div>
        </div>
    );
}

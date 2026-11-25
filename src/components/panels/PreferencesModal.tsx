import React, { useId, useState } from 'react';
import { Map as MapIcon, ExternalLink, Settings } from 'lucide-react';
import { useUI, useViewport } from '../../hooks';
import Modal from '../common/Modal';

type PrefCategory = 'maps_api' | 'general';

interface CategoryDef {
    id: PrefCategory;
    label: string;
    icon: React.ReactNode;
}

const CATEGORIES: CategoryDef[] = [
    { id: 'maps_api', label: 'Fonds de carte & API', icon: <MapIcon size={14} aria-hidden="true" /> },
    { id: 'general',  label: 'Général', icon: <Settings size={14} aria-hidden="true" /> },
];

interface PreferencesModalProps {
    onClose: () => void;
    initialCategory?: PrefCategory;
}

export default function PreferencesModal({ onClose, initialCategory = 'maps_api' }: PreferencesModalProps) {
    const { ignApiKey, mapyApiKey, autoCheckUpdates, dispatch } = useUI();
    const [activeCategory, setActiveCategory] = useState<PrefCategory>(initialCategory);
    const { isSmallMobile: isMobile } = useViewport();
    const ignInputId = useId();
    const mapyInputId = useId();
    const updatesCheckboxId = useId();

    const [ignKey, setIgnKey] = useState(ignApiKey || '');
    const [mapyKey, setMapyKey] = useState(mapyApiKey || '');

    const handleSaveKeys = () => {
        dispatch({ type: 'SET_MAP_API_KEYS', ignKey, mapyKey });
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Configuration API enregistrée.', notifType: 'info' });
    };

    return (
        <Modal
            title="Préférences"
            headerBadge={!isMobile ? <kbd style={{ fontSize: '9px', padding: '1px 5px' }}>Ctrl ,</kbd> : undefined}
            onClose={onClose}
            width="800px"
            maxWidth="97vw"
            height="540px"
            maxHeight="96dvh"
            fullScreenMobile
            isMobile={isMobile}
        >
                {/* ── Body ── */}
                <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>
                    
                    {/* ── Categories ── */}
                    <div
                        role="tablist"
                        aria-label="Catégories de préférences"
                        aria-orientation={isMobile ? 'horizontal' : 'vertical'}
                        style={{ 
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
                        }}
                    >
                        {!isMobile && <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--text-dim)', padding: '0 14px', marginBottom: '4px' }}>Catégories</div>}
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                role="tab"
                                aria-selected={activeCategory === cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: isMobile ? '8px 12px' : '8px 14px', 
                                    cursor: 'pointer',
                                    border: 'none',
                                    textAlign: 'start',
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
                            </button>
                        ))}
                    </div>

                    {/* ── Content ── */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: isMobile ? '16px' : '24px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
                        
                        {activeCategory === 'maps_api' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Configuration des API Cartographiques</h3>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.5 }}>
                                        Certains fonds de carte nécessitent des clés API personnelles pour fonctionner. 
                                        Ces clés sont enregistrées <span style={{ color: 'var(--accent-hover)' }}>localement sur votre ordinateur</span> et ne sont jamais incluses dans les fichiers de projet (.srdoc).
                                    </p>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {/* IGN KEY */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor={ignInputId} style={{ fontSize: '11px', color: 'var(--text-default)', fontWeight: 700 }}>Clé de Service IGN (GéoPlateforme)</label>
                                        <input 
                                            id={ignInputId}
                                            type="text" 
                                            name="scoutraider_ign_key"
                                            autoComplete="off"
                                            value={ignKey}
                                            onChange={(e) => setIgnKey(e.target.value)}
                                            placeholder="Votre clé HASH IGN..."
                                            style={{
                                                background: 'var(--bg-surface)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '6px',
                                                padding: '10px 14px',
                                                color: 'var(--text-primary)',
                                                fontSize: '13px',
                                                fontFamily: 'var(--font-mono)'
                                            }}
                                        />
                                    </div>

                                    {/* MAPY KEY */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <label htmlFor={mapyInputId} style={{ fontSize: '11px', color: 'var(--text-default)', fontWeight: 700 }}>Clé API Mapy.cz</label>
                                        <input 
                                            id={mapyInputId}
                                            type="text" 
                                            name="scoutraider_mapy_key"
                                            autoComplete="off"
                                            value={mapyKey}
                                            onChange={(e) => setMapyKey(e.target.value)}
                                            placeholder="Votre clé REST Mapy.cz..."
                                            style={{
                                                background: 'var(--bg-surface)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '6px',
                                                padding: '10px 14px',
                                                color: 'var(--text-primary)',
                                                fontSize: '13px',
                                                fontFamily: 'var(--font-mono)'
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Tutorials */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-hover)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tutoriels d'accès</div>
                                    
                                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Cartes IGN (Scan 25 / 100)</span>
                                            <a href="https://cartes.gouv.fr" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir cartes.gouv.fr dans un nouvel onglet" style={{ color: 'var(--text-dim)', display: 'inline-flex', padding: '4px' }}>
                                                <ExternalLink size={14} aria-hidden="true" />
                                            </a>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                                            1. Créez un compte sur <a href="https://cartes.gouv.fr" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-hover)' }}>cartes.gouv.fr</a>.<br/>
                                            2. Accédez à <a href="https://cartes.gouv.fr/rejoindre-des-communautes" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-hover)' }}>Rejoindre des communautés</a>.<br/>
                                            3. Recherchez <span style={{ color: 'var(--text-primary)' }}>"scan 25/100"</span> et demandez l'accès.<br/>
                                            4. Une fois accepté, récupérez votre <span style={{ color: 'var(--text-primary)' }}>Clef de service</span> dans votre profil.
                                        </div>
                                    </div>

                                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Fonds Mapy.cz</span>
                                            <a href="https://developer.mapy.com/rest-api-mapy-cz/how-to-start/" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir la documentation Mapy.cz dans un nouvel onglet" style={{ color: 'var(--text-dim)', display: 'inline-flex', padding: '4px' }}>
                                                <ExternalLink size={14} aria-hidden="true" />
                                            </a>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                                            1. Connectez-vous sur le <a href="https://developer.mapy.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-hover)' }}>portail développeur</a>.<br/>
                                            2. Créez un projet et générez une <span style={{ color: 'var(--text-primary)' }}>API Key</span>.<br/>
                                            3. Cette clé débloque les fonds Outdoor, Winter et Sat.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeCategory === 'general' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Paramètres Généraux</h3>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    <label htmlFor={updatesCheckboxId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', cursor: 'pointer', gap: '12px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Recherche automatique de mises à jour</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Vérifie si une nouvelle version est disponible au lancement de l'application.</div>
                                        </div>
                                        <input 
                                            id={updatesCheckboxId}
                                            type="checkbox" 
                                            checked={autoCheckUpdates}
                                            onChange={(e) => dispatch({ type: 'SET_AUTO_CHECK_UPDATES', enabled: e.target.checked })}
                                            style={{ width: '18px', height: '18px', accentColor: 'var(--accent-default)', cursor: 'pointer', flexShrink: 0 }}
                                        />
                                    </label>
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* ── Footer ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '10px 18px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-panel)' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ padding: '0 12px', height: '30px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11.5px', fontWeight: 500 }}
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        onClick={() => { handleSaveKeys(); onClose(); }}
                        style={{
                            padding: '0 14px', height: '30px', background: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary-text)', cursor: 'pointer',
                            fontSize: '11.5px', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '6px'
                        }}
                    >
                        Enregistrer
                    </button>
                </div>
        </Modal>
    );
}

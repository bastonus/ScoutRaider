/**
 * TextualHeader.tsx — Compact, logical, high-density toolbar for the Text Mode (Mode Textuel).
 *
 * Structure logique en 3 sections nettes :
 *  [1. Vue] : Participant | Solution (Segmented control)
 *  [2. Paramètres Carnet] : Thème (dropdown + clé vigenère) | Carte générale | Profil Alti | Annexes
 *  [3. Statut & Action] : Statut d'encodage (pastille compacte) | Bouton Exporter
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    Download, Map as MapIcon, Paperclip, Check,
    ChevronDown, Key, TrendingUp, Sparkles, BookOpen
} from 'lucide-react';
import type { AnnexeId } from '../../logic/types';
import { useApp } from '../../AppContext';
import { themeManager } from '../../logic/ThemeManager';

const ANNEXE_LABELS: Record<AnnexeId, string> = {
    alphabet_morse:    'Morse',
    grille_polybe:     'Polybe',
    alphabet_gilwell:  'Gilwell',
    tableau_vigenere:  'Vigènere',
    index_drapeaux:    'Drapeaux',
    methode_avocat:    'Avocat (A=K)',
    code_templier:     'Templier',
};

const THEME_ACCENTS: Record<string, { color: string; emoji: string }> = {
    'Neutre':                              { color: '#94a3b8', emoji: '🌍' },
    'La Mafia':                            { color: '#ef4444', emoji: '🔫' },
    'Les Vikings':                         { color: '#60a5fa', emoji: '⚔️' },
    'Le Roi Soleil':                       { color: '#fbbf24', emoji: '👑' },
    'La Chevalerie':                       { color: '#c084fc', emoji: '🛡️' },
    'Les Gaulois':                         { color: '#34d399', emoji: '🐗' },
    'La Première Guerre mondiale (WW1)':   { color: '#a3a3a3', emoji: '🪖' },
    'La Seconde Guerre mondiale (WW2)':    { color: '#6b7280', emoji: '📻' },
    'Le Seigneur des Anneaux (LOTR)':      { color: '#d97706', emoji: '💍' },
    'Napoléon':                            { color: '#818cf8', emoji: '🦅' },
};

function getAccent(id: string) {
    return THEME_ACCENTS[id] || { color: '#94a3b8', emoji: '🌍' };
}

interface TextualHeaderProps {
    onExport: () => void;
}

function Sep() {
    return <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px', flexShrink: 0 }} />;
}

export default function TextualHeader({ onExport }: TextualHeaderProps) {
    const { state, dispatch } = useApp();
    const [themePickerOpen, setThemePickerOpen] = useState(false);
    const [annexePickerOpen, setAnnexePickerOpen] = useState(false);
    const [allThemeIds, setAllThemeIds] = useState<string[]>([]);
    const themePickerRef = useRef<HTMLDivElement>(null);
    const annexePickerRef = useRef<HTMLDivElement>(null);

    const availableAnnexes = Object.keys(ANNEXE_LABELS) as AnnexeId[];
    const enabledAnnexesSet = new Set(state.enabled_annexes || []);
    const activeAnnexesCount = availableAnnexes.filter(a => enabledAnnexesSet.has(a)).length;
    const includeGeneralMap: boolean = state.carnet_include_general_map;
    const includeElevationProfile: boolean = state.carnet_include_elevation_profile ?? true;

    const currentAccent = getAccent(state.theme_id);
    const currentTheme = themeManager.getTheme(state.theme_id);

    const computedSteps = (state.carnet_steps || []).filter((s: any) => !s.isManual);
    const encodedSteps = computedSteps.filter((s: any) => s.moduleId !== 'texte_clair');
    const hasEncoding = encodedSteps.length > 0;
    const totalSteps = computedSteps.length;

    useEffect(() => {
        const tryLoad = () => {
            if (themeManager.isLoaded) {
                setAllThemeIds(themeManager.getThemeIds());
            } else {
                setTimeout(tryLoad, 150);
            }
        };
        tryLoad();
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
                setThemePickerOpen(false);
            }
            if (annexePickerRef.current && !annexePickerRef.current.contains(e.target as Node)) {
                setAnnexePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Compact item styling
    const itemBtnStyle = (active: boolean): React.CSSProperties => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '0 8px',
        height: '24px',
        borderRadius: 'var(--radius-xs)',
        border: `1px solid ${active ? 'var(--accent-default)' : 'transparent'}`,
        background: active ? 'var(--accent-transparent)' : 'transparent',
        color: active ? 'var(--accent-default)' : 'var(--text-dim)',
        fontSize: '11px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 100ms ease',
        userSelect: 'none',
        whiteSpace: 'nowrap',
    });

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            width: '100%',
            overflow: 'visible',
            userSelect: 'none',
            position: 'relative',
        }}>
            {/* ═══ SECTION 1 (GAUCHE): MODE DE CARNET (PARTICIPANT / SOLUTION) ═══ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <div style={{
                    display: 'flex',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-pill)',
                    padding: '2px',
                    gap: '2px',
                    alignItems: 'center'
                }}>
                    <button
                        onClick={() => dispatch({ type: 'SET_CARNET_VIEW', view: 'participant' })}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '0 8px',
                            height: '22px',
                            borderRadius: 'var(--radius-pill)',
                            border: 'none',
                            background: (state.carnet_view || 'participant') === 'participant' ? 'var(--accent-default)' : 'transparent',
                            color: (state.carnet_view || 'participant') === 'participant' ? '#ffffff' : 'var(--text-dim)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 100ms ease'
                        }}
                        title="Vue Participant (énoncés seuls sans corrigés)"
                    >
                        <span>Participant</span>
                    </button>
                    <button
                        onClick={() => dispatch({ type: 'SET_CARNET_VIEW', view: 'solution' })}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '0 8px',
                            height: '22px',
                            borderRadius: 'var(--radius-pill)',
                            border: 'none',
                            background: state.carnet_view === 'solution' ? 'var(--semantic-orange)' : 'transparent',
                            color: state.carnet_view === 'solution' ? '#ffffff' : 'var(--text-dim)',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 100ms ease'
                        }}
                        title="Vue Solution (avec corrigés décodés et coordonnées réelles)"
                    >
                        <span>Solution</span>
                    </button>
                    <kbd style={{ fontSize: '8.5px', padding: '0 3px', height: '14px', borderRadius: '3px', margin: '0 2px' }} title="Raccourci : Alt+S">Alt S</kbd>
                </div>
            </div>

            {/* ═══ SECTION 2 (CENTRE): OPTIONS & CONTENU DU CARNET ═══ */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 4px',
                flexShrink: 0
            }}>
                {/* Sélecteur de Thème Narratif */}
                <div style={{ position: 'relative' }} ref={themePickerRef}>
                    <button
                        onClick={() => setThemePickerOpen(v => !v)}
                        title={`Thème narratif : ${state.theme_id}`}
                        style={{
                            ...itemBtnStyle(themePickerOpen),
                            padding: '0 6px',
                            color: 'var(--text-primary)',
                            maxWidth: '150px'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={e => {
                            if (!themePickerOpen) e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <span style={{ fontSize: '11px' }}>{currentAccent.emoji}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {state.theme_id}
                        </span>
                        <ChevronDown size={11} style={{ opacity: 0.6 }} />
                    </button>

                    {themePickerOpen && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            left: 0,
                            zIndex: 950,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: 'var(--shadow-md)',
                            padding: '4px',
                            minWidth: '220px',
                            maxHeight: '340px',
                            overflowY: 'auto'
                        }}>
                            {/* Clé Vigenère */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 8px',
                                borderBottom: '1px solid var(--border-subtle)',
                                marginBottom: '4px'
                            }}>
                                <span style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Key size={10} /> Clé :
                                </span>
                                <code style={{
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    color: 'var(--accent-hover)',
                                    fontFamily: 'var(--font-mono)',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    padding: '1px 5px',
                                    borderRadius: '3px'
                                }}>
                                    {currentTheme.vigenere_key}
                                </code>
                            </div>

                            {allThemeIds.map(id => {
                                const isActive = state.theme_id === id;
                                const acc = getAccent(id);
                                return (
                                    <div
                                        key={id}
                                        onClick={() => {
                                            dispatch({ type: 'SET_THEME', themeId: id });
                                            setThemePickerOpen(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '5px 8px',
                                            borderRadius: 'var(--radius-xs)',
                                            background: isActive ? 'var(--bg-hover)' : 'transparent',
                                            color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                                            fontSize: '11.5px',
                                            fontWeight: isActive ? 600 : 400,
                                            cursor: 'pointer'
                                        }}
                                        onMouseEnter={e => {
                                            if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                                        }}
                                        onMouseLeave={e => {
                                            if (!isActive) e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ fontSize: '12px' }}>{acc.emoji}</span>
                                            <span>{id}</span>
                                        </div>
                                        {isActive && <Check size={11} color="var(--accent-default)" strokeWidth={2.5} />}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <Sep />

                {/* Carte Générale */}
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_GENERAL_MAP' })}
                    style={itemBtnStyle(includeGeneralMap)}
                    title="Inclure la vue cartographique générale au début du carnet (Ctrl+Shift+M)"
                    onMouseEnter={e => {
                        if (!includeGeneralMap) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={e => {
                        if (!includeGeneralMap) e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <MapIcon size={12} />
                    <span>Carte</span>
                </button>

                {/* Profil Alti */}
                <button
                    onClick={() => dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' })}
                    style={itemBtnStyle(includeElevationProfile)}
                    title="Afficher le profil altimétrique (dénivelé) dans le carnet (Ctrl+Shift+A)"
                    onMouseEnter={e => {
                        if (!includeElevationProfile) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={e => {
                        if (!includeElevationProfile) e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <TrendingUp size={12} />
                    <span>Profil Alti</span>
                </button>

                {/* Annexes */}
                <div style={{ position: 'relative' }} ref={annexePickerRef}>
                    <button
                        onClick={() => setAnnexePickerOpen(v => !v)}
                        style={itemBtnStyle(activeAnnexesCount > 0)}
                        title="Sélectionner les annexes documentaires"
                        onMouseEnter={e => {
                            if (!activeAnnexesCount) e.currentTarget.style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={e => {
                            if (!activeAnnexesCount) e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <Paperclip size={12} />
                        <span>Annexes</span>
                        {activeAnnexesCount > 0 && (
                            <span style={{
                                width: '15px',
                                height: '15px',
                                borderRadius: '50%',
                                background: 'var(--accent-default)',
                                color: '#ffffff',
                                fontSize: '9px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: 'var(--font-mono)'
                            }}>
                                {activeAnnexesCount}
                            </span>
                        )}
                    </button>

                    {annexePickerOpen && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            zIndex: 950,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            boxShadow: 'var(--shadow-md)',
                            padding: '6px',
                            minWidth: '200px'
                        }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', padding: '2px 6px 4px' }}>
                                Annexes jointes au carnet
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {availableAnnexes.map(annexeId => {
                                    const isActive = enabledAnnexesSet.has(annexeId);
                                    return (
                                        <div
                                            key={annexeId}
                                            onClick={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId })}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '4px 6px',
                                                borderRadius: 'var(--radius-xs)',
                                                background: isActive ? 'var(--accent-transparent)' : 'transparent',
                                                color: isActive ? 'var(--accent-default)' : 'var(--text-dim)',
                                                fontSize: '11px',
                                                fontWeight: isActive ? 600 : 400,
                                                cursor: 'pointer'
                                            }}
                                            onMouseEnter={e => {
                                                if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                                            }}
                                            onMouseLeave={e => {
                                                if (!isActive) e.currentTarget.style.background = 'transparent';
                                            }}
                                        >
                                            <div style={{
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '2px',
                                                border: `1px solid ${isActive ? 'var(--accent-default)' : 'var(--border-strong)'}`,
                                                background: isActive ? 'var(--accent-default)' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {isActive && <Check size={9} strokeWidth={3} color="#ffffff" />}
                                            </div>
                                            <span>{ANNEXE_LABELS[annexeId]}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ SECTION 3 (DROITE): ÉTAT DE COMPILATION & ACTION EXPORTER ═══ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {/* Statut d'encodage compact */}
                {totalSteps > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        color: 'var(--text-dim)',
                        background: 'transparent',
                        padding: '0 4px',
                    }}>
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: hasEncoding ? 'var(--semantic-success)' : 'var(--text-dim)',
                        }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px' }}>
                            {totalSteps} étape{totalSteps > 1 ? 's' : ''}
                        </span>
                    </div>
                )}

                {/* Bouton Exporter standardisé */}
                <button
                    onClick={onExport}
                    title="Exporter le carnet (Ctrl+E)"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '26px',
                        padding: '0 10px',
                        borderRadius: 'var(--radius-main)',
                        border: '1px solid var(--accent-primary)',
                        background: 'var(--accent-primary)',
                        color: 'var(--accent-primary-text)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 100ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-primary-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-primary)'}
                >
                    <Download size={12} strokeWidth={2} />
                    <span>Exporter</span>
                    <kbd style={{
                        fontSize: '8.5px',
                        padding: '0 3px',
                        height: '14px',
                        borderRadius: '2px',
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: '#ffffff',
                        border: 'none'
                    }}>
                        Ctrl E
                    </kbd>
                </button>
            </div>
        </div>
    );
}

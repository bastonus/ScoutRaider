/**
 * TextualHeader.tsx — Header bar for the Text Mode (Mode Textuel).
 * Premium redesign: glassmorphism pill, segmented controls, animated status dots.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    Download, Map as MapIcon, Paperclip, Check,
    ChevronDown, Key,
} from 'lucide-react';
import type { AnnexeId } from '../../logic/types';
import { useApp } from '../../AppContext';
import { themeManager } from '../../logic/ThemeManager';

const ANNEXE_LABELS: Record<AnnexeId, string> = {
    alphabet_morse:    'Alphabet Morse',
    grille_polybe:     'Grille Polybe',
    alphabet_gilwell:  'Alphabet Gilwell',
    tableau_vigenere:  'Table Vigènere',
    index_drapeaux:    'Index Drapeaux',
    methode_avocat:    'Méthode Avocat',
    code_templier:     'Code Templier',
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

// ── Props ─────────────────────────────────────────────────────────────────────

interface TextualHeaderProps {
    onExport: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Separator() {
    return (
        <div style={{
            width: '1px', height: '20px', flexShrink: 0,
            background: 'rgba(255,255,255,0.07)',
            margin: '0 2px',
        }} />
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TextualHeader({
    onExport,
}: TextualHeaderProps) {
    const { state, dispatch } = useApp();
    const [themePickerOpen, setThemePickerOpen] = useState(false);
    const [annexePickerOpen, setAnnexePickerOpen] = useState(false);
    const [allThemeIds, setAllThemeIds] = useState<string[]>([]);
    const themePickerRef = useRef<HTMLDivElement>(null);
    const annexePickerRef = useRef<HTMLDivElement>(null);

    const availableAnnexes = Object.keys(ANNEXE_LABELS) as AnnexeId[];
    const enabledAnnexesSet = new Set(state.enabled_annexes || []);
    const activeCount = availableAnnexes.filter(a => enabledAnnexesSet.has(a)).length;
    const includeGeneralMap: boolean = state.carnet_include_general_map;

    const currentAccent = getAccent(state.theme_id);
    const currentTheme = themeManager.getTheme(state.theme_id);

    const computedSteps = (state.carnet_steps || []).filter((s: any) => !s.isManual);
    const encodedSteps = computedSteps.filter((s: any) => s.moduleId !== 'texte_clair');
    const hasEncoding = encodedSteps.length > 0;
    const totalSteps = computedSteps.length;


    // Load theme list
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

    // Close picker on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
                setThemePickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Shared pill style ───────────────────────────────────────────────
    const pillBtn = (active = false, accentColor?: string): React.CSSProperties => ({
        display: 'flex', alignItems: 'center', gap: '6px',
        padding: '5px 12px', borderRadius: '20px', border: '1px solid',
        borderColor: active
            ? `${accentColor || 'var(--accent-default)'}50`
            : 'rgba(255,255,255,0.08)',
        background: active
            ? `${accentColor || 'var(--accent-default)'}12`
            : 'rgba(255,255,255,0.04)',
        color: active ? (accentColor || 'var(--accent-default)') : 'rgba(255,255,255,0.45)',
        fontSize: '11px', fontWeight: 600, cursor: 'pointer',
        transition: 'all 0.15s ease', flexShrink: 0,
        lineHeight: 1,
    });

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flexShrink: 0,
        }}>

            {/* ── THEME PICKER ─────────────────────────────────────────────── */}
            <div style={{ position: 'relative', flexShrink: 0 }} ref={themePickerRef}>
                <button
                    onClick={() => setThemePickerOpen(v => !v)}
                    title={`Thème : ${state.theme_id}`}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 10px 5px 8px',
                        borderRadius: '20px', border: '1px solid',
                        borderColor: themePickerOpen
                            ? `${currentAccent.color}55`
                            : `${currentAccent.color}28`,
                        background: themePickerOpen
                            ? `${currentAccent.color}15`
                            : `${currentAccent.color}09`,
                        color: currentAccent.color,
                        fontSize: '11px', fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.15s',
                        maxWidth: '160px',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = `${currentAccent.color}55`)}
                    onMouseLeave={e => {
                        if (!themePickerOpen)
                            e.currentTarget.style.borderColor = `${currentAccent.color}28`;
                    }}
                >
                    <span style={{ fontSize: '13px', lineHeight: 1 }}>{currentAccent.emoji}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {state.theme_id}
                    </span>
                    <ChevronDown
                        size={11} strokeWidth={2.5}
                        style={{
                            opacity: 0.7, flexShrink: 0,
                            transform: themePickerOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                        }}
                    />
                </button>

                {themePickerOpen && (
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                        zIndex: 950,
                        background: 'rgba(14,18,16,0.98)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: '14px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
                        padding: '6px',
                        minWidth: '230px', maxWidth: '270px',
                        maxHeight: '380px', overflowY: 'auto',
                        animation: 'fadeInScale 0.15s ease-out',
                    }}>
                        {/* Vigenère key */}
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 10px 10px',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            marginBottom: '4px',
                        }}>
                            <Key size={10} color="rgba(255,255,255,0.3)" />
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
                                Clé Vigenère :
                            </span>
                            <code style={{
                                fontSize: '11px', fontWeight: 700, color: currentAccent.color,
                                fontFamily: '"Courier New", monospace', letterSpacing: '0.1em',
                                background: 'rgba(255,255,255,0.06)',
                                padding: '1px 6px', borderRadius: '4px',
                            }}>
                                {currentTheme.vigenere_key}
                            </code>
                        </div>

                        {allThemeIds.map(id => {
                            const isActive = state.theme_id === id;
                            const acc = getAccent(id);
                            return (
                                <button
                                    key={id}
                                    onClick={() => {
                                        dispatch({ type: 'SET_THEME', themeId: id });
                                        setThemePickerOpen(false);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        width: '100%', padding: '7px 10px',
                                        borderRadius: '8px', border: 'none',
                                        background: isActive ? `${acc.color}14` : 'transparent',
                                        color: isActive ? acc.color : 'rgba(255,255,255,0.6)',
                                        fontSize: '12px', fontWeight: isActive ? 700 : 500,
                                        cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }}
                                >
                                    <span style={{ fontSize: '14px', lineHeight: 1 }}>{acc.emoji}</span>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {id}
                                    </span>
                                    {isActive && <Check size={11} color={acc.color} strokeWidth={3} />}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <Separator />

            {/* ── AUTO-ENCODING STATUS ─────────────────────────────────── */}
            {totalSteps > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '4px 11px', borderRadius: '20px', flexShrink: 0,
                    border: `1px solid ${hasEncoding ? 'rgba(16,185,129,0.22)' : 'rgba(255,255,255,0.07)'}`,
                    background: hasEncoding ? 'rgba(16,185,129,0.07)' : 'rgba(255,255,255,0.03)',
                }}>
                    <div style={{
                        width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                        background: hasEncoding ? '#10b981' : 'rgba(255,255,255,0.2)',
                        boxShadow: hasEncoding ? '0 0 7px #10b981aa' : 'none',
                    }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: hasEncoding ? '#10b981' : 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
                        {hasEncoding ? 'Encodage auto' : 'Texte clair'}
                    </span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', paddingLeft: '4px', borderLeft: '1px solid rgba(255,255,255,0.1)', marginLeft: '2px', whiteSpace: 'nowrap' }}>
                        {totalSteps} étape{totalSteps > 1 ? 's' : ''}
                    </span>
                </div>
            )}

            <Separator />

            {/* ── CARTE GÉNÉRALE ────────────────────────────────────────── */}
            <button
                onClick={() => dispatch({ type: 'TOGGLE_GENERAL_MAP' })}
                style={pillBtn(includeGeneralMap, 'var(--accent-default)')}
                title="Inclure la carte générale dans l'export"
                onMouseEnter={e => { if (!includeGeneralMap) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
                onMouseLeave={e => { if (!includeGeneralMap) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}
            >
                <MapIcon size={12} />
                Carte générale
            </button>

            {/* ── ANNEXES ──────────────────────────────────────────────── */}
            <div style={{ position: 'relative', flexShrink: 0 }} ref={annexePickerRef}>
                <button
                    onClick={() => setAnnexePickerOpen(v => !v)}
                    style={pillBtn(activeCount > 0, '#10b981')}
                    title="Gérer les annexes globales"
                    onMouseEnter={e => { if (!activeCount) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'; }}
                    onMouseLeave={e => { if (!activeCount) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'; }}
                >
                    <Paperclip size={12} />
                    Annexes
                    {activeCount > 0 && (
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '16px', height: '16px', borderRadius: '50%',
                            background: '#10b981', color: '#000',
                            fontSize: '9px', fontWeight: 800, marginLeft: '2px', flexShrink: 0,
                        }}>
                            {activeCount}
                        </span>
                    )}
                </button>

                {annexePickerOpen && (
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                        zIndex: 950,
                        background: 'rgba(14,18,16,0.98)',
                        border: '1px solid rgba(255,255,255,0.09)',
                        borderRadius: '14px',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
                        padding: '10px', minWidth: '230px',
                        animation: 'fadeInScale 0.15s ease-out',
                    }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px', padding: '0 4px' }}>
                            Annexes globales
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {availableAnnexes.map(annexeId => {
                                const isActive = enabledAnnexesSet.has(annexeId);
                                return (
                                    <button
                                        key={annexeId}
                                        onClick={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId })}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            width: '100%', padding: '7px 10px', borderRadius: '8px',
                                            border: `1px solid ${isActive ? 'rgba(16,185,129,0.25)' : 'transparent'}`,
                                            background: isActive ? 'rgba(16,185,129,0.09)' : 'rgba(255,255,255,0.02)',
                                            color: isActive ? '#10b981' : 'rgba(255,255,255,0.55)',
                                            fontSize: '11px', fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s',
                                        }}
                                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
                                    >
                                        <div style={{
                                            width: '14px', height: '14px', borderRadius: '4px', flexShrink: 0,
                                            border: `1.5px solid ${isActive ? '#10b981' : 'rgba(255,255,255,0.15)'}`,
                                            background: isActive ? 'rgba(16,185,129,0.2)' : 'transparent',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s',
                                        }}>
                                            {isActive && <Check size={9} strokeWidth={3} color="#10b981" />}
                                        </div>
                                        {ANNEXE_LABELS[annexeId]}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: '10px', padding: '8px 4px 2px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>
                            Jointes automatiquement à la fin du carnet exporté.
                        </div>
                    </div>
                )}
            </div>

            <Separator />

            {/* ── EXPORT BUTTON ──────────────────────────────────────────── */}
            <button
                onClick={onExport}
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '20px', border: 'none',
                    background: 'linear-gradient(135deg, #1a7a3d 0%, #10b981 100%)',
                    color: '#fff', fontSize: '11px', fontWeight: 700,
                    cursor: 'pointer', flexShrink: 0,
                    boxShadow: '0 2px 12px rgba(16,185,129,0.35)',
                    transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 18px rgba(16,185,129,0.55)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(16,185,129,0.35)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
            >
                <Download size={13} strokeWidth={2.5} />
                Exporter
            </button>
        </div>
    );
}

/**
 * ThemePanel.tsx — Rich visual theme selector.
 * Displays all themes from themes.json as interactive cards with:
 *  - Thematic emoji + color accent
 *  - Vigenère key badge
 *  - Example intro phrase
 *  - Active state
 */
import React, { useEffect, useState } from 'react';
import { Key, Check, Edit2, Plus, Palette } from 'lucide-react';
import { themeManager } from '../../logic/ThemeManager';
import { useApp } from '../../AppContext';
import type { ThemeData } from '../../logic/types';
import ThemeEditorModal from './ThemeEditorModal';

// ── Component ─────────────────────────────────────────────────────────────────

export default function ThemePanel() {
    const { state, dispatch } = useApp();
    const [themes, setThemes] = useState<{ id: string; data: ThemeData }[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [editorOpen, setEditorOpen] = useState(false);

    const loadThemes = () => {
        const ids = themeManager.getThemeIds();
        setThemes(ids.map(id => ({ id, data: themeManager.getTheme(id) })));
    };
    useEffect(() => {
        const tryLoad = () => {
            if (themeManager.isLoaded) {
                loadThemes();
                setLoaded(true);
            } else {
                setTimeout(tryLoad, 150);
            }
        };
        tryLoad();
    }, []);

    const activeData = themeManager.getTheme(state.theme_id);
    const accentColor = 'rgba(255,255,255,0.8)';
    const bgColor = 'rgba(255,255,255,0.05)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* ── Active theme summary card ─────────────────────────────── */}
            <div style={{
                margin: '12px 12px 8px',
                padding: '14px',
                borderRadius: '12px',
                background: bgColor,
                border: `1px solid rgba(255,255,255,0.1)`,
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Palette size={20} color={accentColor} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: accentColor, lineHeight: 1.2 }}>
                            {state.theme_id}
                        </div>
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Thème actif
                        </div>
                    </div>
                    {/* Edit button */}
                    <button className="btn-icon" onClick={() => setEditorOpen(true)} style={{ width: '28px', height: '28px', color: accentColor, background: 'rgba(255,255,255,0.05)' }}>
                        <Edit2 size={14} />
                    </button>
                </div>

                {/* Vigenère key */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <Key size={10} color="rgba(255,255,255,0.3)" />
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                        Clé Vigenère :
                    </span>
                    <code style={{
                        fontSize: '11px', fontWeight: 700,
                        color: accentColor,
                        fontFamily: '"Courier New", monospace',
                        background: 'rgba(255,255,255,0.06)',
                        padding: '1px 8px', borderRadius: '4px',
                        letterSpacing: '0.12em',
                    }}>
                        {activeData.vigenere_key}
                    </code>
                </div>

                {/* Example intro phrase */}
                {activeData.intros?.length > 0 && (
                    <div style={{
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.45)',
                        fontStyle: 'italic',
                        lineHeight: 1.5,
                        borderLeft: `2px solid rgba(255,255,255,0.2)`,
                        paddingLeft: '8px',
                    }}>
                        "{activeData.intros[0]}"
                    </div>
                )}
            </div>

            {/* ── Separator ─────────────────────────────────────────────── */}
            <div style={{ padding: '0 12px 6px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Choisir un thème
                </div>
            </div>

            {/* ── Theme list ───────────────────────────────────────────── */}
            <div style={{
                padding: '0 12px 12px',
                display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
                {!loaded ? (
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px', padding: '8px 4px', fontStyle: 'italic' }}>
                        Chargement des thèmes…
                    </div>
                ) : themes.map(({ id, data }) => {
                    const isActive = state.theme_id === id;
                    return (
                        <button
                            key={id}
                            onClick={() => dispatch({ type: 'SET_THEME', themeId: id })}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                width: '100%', padding: '9px 10px',
                                borderRadius: '8px', border: '1px solid',
                                borderColor: isActive ? `rgba(255,255,255,0.2)` : 'rgba(255,255,255,0.04)',
                                background: isActive ? `rgba(255,255,255,0.08)` : 'rgba(255,255,255,0.02)',
                                cursor: 'pointer', textAlign: 'left',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!isActive) {
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.04)';
                                }
                            }}
                        >
                            {/* Icon */}
                            <div style={{ 
                                width: '24px', height: '24px', borderRadius: '6px', 
                                background: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.1)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: isActive ? '#000' : 'var(--text-primary)',
                                flexShrink: 0
                            }}>
                                <Palette size={14} strokeWidth={2.5} />
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: '12px',
                                    fontWeight: isActive ? 700 : 500,
                                    color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    lineHeight: 1.3,
                                }}>
                                    {id}
                                </div>
                                <div style={{
                                    fontSize: '10px',
                                    color: 'rgba(255,255,255,0.28)',
                                    fontFamily: '"Courier New", monospace',
                                    letterSpacing: '0.08em',
                                }}>
                                    {data.vigenere_key}
                                </div>
                            </div>

                            {/* Active check */}
                            {isActive && (
                                <Check size={13} color={'rgba(255,255,255,0.8)'} strokeWidth={3} style={{ flexShrink: 0 }} />
                            )}
                        </button>
                    );
                })}
                
                <button 
                    onClick={() => setEditorOpen(true)}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        width: '100%', padding: '10px', marginTop: '4px',
                        borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)',
                        background: 'transparent', color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                        transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
                        (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                    }}
                >
                    <Plus size={16} /> Nouveau Thème
                </button>
            </div>

            {editorOpen && (
                <ThemeEditorModal 
                    activeThemeId={state.theme_id}
                    onClose={() => setEditorOpen(false)}
                    onSelectTheme={(id) => {
                        dispatch({ type: 'SET_THEME', themeId: id });
                        loadThemes();
                    }}
                />
            )}
        </div>
    );
}

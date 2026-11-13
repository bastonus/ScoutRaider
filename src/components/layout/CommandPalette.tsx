import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Search, 
    Map, 
    FileText, 
    Columns, 
    Download, 
    Settings, 
    Navigation, 
    ArrowLeftRight, 
    Mountain, 
    Eye, 
    EyeOff, 
    Hash, 
    Compass, 
    Layers, 
    Sparkles, 
    AlertTriangle 
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { MODULE_META } from '../../logic/ModuleRegistry';
import type { ViewMode } from '../../App';

export interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    onViewModeChange: (mode: ViewMode) => void;
    onExport: () => void;
    onPreferencesOpen: () => void;
}

interface CommandItem {
    id: string;
    label: string;
    category: 'Vues' | 'Actions Rapides' | 'Étapes du Raid' | 'Modules d\'Enigme';
    icon: React.ReactNode;
    shortcut?: string;
    keywords?: string;
    perform: () => void;
}

export default function CommandPalette({
    isOpen,
    onClose,
    onViewModeChange,
    onExport,
    onPreferencesOpen,
}: CommandPaletteProps) {
    const { state, dispatch } = useApp();
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 30);
        }
    }, [isOpen]);

    // Construct command list
    const commands: CommandItem[] = useMemo(() => {
        const items: CommandItem[] = [];

        // ─── 1. Vues ───
        items.push({
            id: 'view_map',
            label: 'Afficher la Vue Carte Topographique',
            category: 'Vues',
            icon: <Map size={16} color="#3b82f6" />,
            shortcut: 'Ctrl+1',
            keywords: 'carte map carto plein ecran ign',
            perform: () => onViewModeChange('map'),
        });
        items.push({
            id: 'view_text',
            label: 'Afficher la Vue Carnet Textuel',
            category: 'Vues',
            icon: <FileText size={16} color="#10b981" />,
            shortcut: 'Ctrl+2',
            keywords: 'carnet texte enigmes solution participant',
            perform: () => onViewModeChange('text'),
        });
        items.push({
            id: 'view_split',
            label: 'Afficher la Vue Scindée (Carte + Carnet côte à côte)',
            category: 'Vues',
            icon: <Columns size={16} color="#8b5cf6" />,
            shortcut: 'Ctrl+3',
            keywords: 'scindee split dual side by side deux',
            perform: () => onViewModeChange('split'),
        });

        // ─── 2. Actions Rapides ───
        items.push({
            id: 'action_export',
            label: 'Exporter le Carnet de Route (PDF, DOCX, HTML, CSV)',
            category: 'Actions Rapides',
            icon: <Download size={16} color="#ef4444" />,
            shortcut: 'Ctrl+E',
            keywords: 'export imprimer telecharger print docx weasyprint',
            perform: onExport,
        });
        items.push({
            id: 'action_prefs',
            label: 'Ouvrir les Préférences de l\'Application',
            category: 'Actions Rapides',
            icon: <Settings size={16} color="#64748b" />,
            shortcut: 'Ctrl+P',
            keywords: 'options preferences reglages configuration api cles',
            perform: onPreferencesOpen,
        });
        items.push({
            id: 'action_toggle_carnet_view',
            label: (state.carnet_view || 'participant') === 'participant' ? 'Passer en Vue Solution (avec corrigés)' : 'Passer en Vue Participant (sans solutions)',
            category: 'Actions Rapides',
            icon: <Sparkles size={16} color="#eab308" />,
            shortcut: 'Alt+S',
            keywords: 'solution participant reponses enigmes carnet',
            perform: () => dispatch({ type: 'SET_CARNET_VIEW', view: (state.carnet_view || 'participant') === 'participant' ? 'solution' : 'participant' }),
        });
        items.push({
            id: 'action_reverse_route',
            label: 'Inverser le sens du parcours (Départ ⇄ Arrivée)',
            category: 'Actions Rapides',
            icon: <ArrowLeftRight size={16} color="#f59e0b" />,
            shortcut: 'Ctrl+I',
            keywords: 'inverser sens retour swap demi tour',
            perform: () => dispatch({ type: 'INVERT_ROUTE' }),
        });
        items.push({
            id: 'action_toggle_elevation',
            label: `Profil Altimétrique dans le Carnet : ${state.carnet_include_elevation_profile ? 'Désactiver' : 'Activer'}`,
            category: 'Actions Rapides',
            icon: <Mountain size={16} color="#06b6d4" />,
            shortcut: 'Ctrl+Shift+A',
            keywords: 'alti denivele d+ d- courbe elevation',
            perform: () => dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' }),
        });
        items.push({
            id: 'action_toggle_general_map',
            label: `Carte générale dans le Carnet : ${state.carnet_include_general_map ? 'Masquer' : 'Inclure'}`,
            category: 'Actions Rapides',
            icon: <Map size={16} color="#10b981" />,
            shortcut: 'Ctrl+Shift+M',
            keywords: 'carte generale vue ensemble carnet export',
            perform: () => dispatch({ type: 'TOGGLE_GENERAL_MAP' }),
        });
        items.push({
            id: 'action_toggle_pois',
            label: `${state.show_pois_on_map ? 'Masquer' : 'Afficher'} les points remarquables (POI IGN)`,
            category: 'Actions Rapides',
            icon: state.show_pois_on_map ? <EyeOff size={16} color="#a855f7" /> : <Eye size={16} color="#a855f7" />,
            shortcut: 'Ctrl+Shift+P',
            keywords: 'pois monuments calvaires fontaines',
            perform: () => dispatch({ type: 'TOGGLE_POIS_ON_MAP' }),
        });
        items.push({
            id: 'action_toggle_dangers',
            label: `${state.show_dangers_on_map ? 'Masquer' : 'Afficher'} les zones de danger et grands axes`,
            category: 'Actions Rapides',
            icon: <AlertTriangle size={16} color="#f97316" />,
            shortcut: 'Ctrl+Shift+D',
            keywords: 'danger autoroute route nationale securite',
            perform: () => dispatch({ type: 'TOGGLE_DANGERS_ON_MAP' }),
        });

        // ─── 3. Étapes du Raid ───
        (state.stages || []).forEach((st, idx) => {
            items.push({
                id: `stage_${st.id}`,
                label: `Étape ${st.label} ${st.address ? `— ${st.address}` : `[${st.coords[0].toFixed(4)}, ${st.coords[1].toFixed(4)}]`}`,
                category: 'Étapes du Raid',
                icon: <Navigation size={16} color="#22c55e" />,
                keywords: `etape ${st.label} ${st.address || ''} waypoint balise`,
                perform: () => {
                    dispatch({ type: 'SET_ANCHOR_STAGE', idx });
                    onViewModeChange('map');
                },
            });
        });

        // ─── 4. Modules d'Enigme ───
        Object.entries(MODULE_META).forEach(([id, meta]) => {
            items.push({
                id: `module_${id}`,
                label: `Module d'énigme : ${meta.label}`,
                category: 'Modules d\'Enigme',
                icon: <Sparkles size={16} color="#eab308" />,
                keywords: `${meta.label} chiffre cryptographie`,
                perform: () => {
                    // Switch to text mode to edit or view module
                    onViewModeChange('text');
                },
            });
        });

        return items;
    }, [state, onViewModeChange, onExport, onPreferencesOpen, dispatch]);

    // Filtering
    const filteredCommands = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter(cmd => {
            return (
                cmd.label.toLowerCase().includes(q) ||
                cmd.category.toLowerCase().includes(q) ||
                (cmd.keywords && cmd.keywords.toLowerCase().includes(q))
            );
        });
    }, [commands, search]);

    // Reset index on search change
    useEffect(() => {
        setSelectedIndex(0);
    }, [search]);

    // Keydown handlers
    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = filteredCommands[selectedIndex];
                if (cmd) {
                    cmd.perform();
                    onClose();
                }
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // Scroll active item into view
    useEffect(() => {
        if (listRef.current) {
            const activeEl = listRef.current.querySelector('[data-selected="true"]');
            if (activeEl) {
                activeEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999999,
                background: 'rgba(0, 0, 0, 0.72)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: '12vh',
            }}
            onClick={onClose}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    width: '600px',
                    maxWidth: '92vw',
                    maxHeight: '70vh',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
                {/* Search Bar */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                    }}
                >
                    <Search size={16} color="var(--text-dim)" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher une action, une étape ou un module..."
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            fontSize: '13px',
                            fontWeight: 400,
                            fontFamily: 'var(--font-ui)',
                        }}
                    />
                    <kbd style={{ fontSize: '9px', padding: '1px 5px' }}>
                        ESC
                    </kbd>
                </div>

                {/* Commands List */}
                <div
                    ref={listRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                    }}
                >
                    {filteredCommands.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                            Aucune commande ne correspond à « {search} »
                        </div>
                    ) : (
                        filteredCommands.map((cmd, idx) => {
                            const isSelected = idx === selectedIndex;
                            const showCategoryHeader =
                                idx === 0 || cmd.category !== filteredCommands[idx - 1].category;

                            return (
                                <React.Fragment key={cmd.id}>
                                    {showCategoryHeader && (
                                        <div
                                            style={{
                                                fontSize: '11px',
                                                fontWeight: 500,
                                                color: 'var(--text-dim)',
                                                letterSpacing: '0.02em',
                                                padding: '6px 8px 3px 8px',
                                                marginTop: idx === 0 ? '0' : '4px',
                                            }}
                                        >
                                            {cmd.category}
                                        </div>
                                    )}
                                    <div
                                        data-selected={isSelected ? 'true' : 'false'}
                                        onClick={() => {
                                            cmd.perform();
                                            onClose();
                                        }}
                                        onMouseEnter={() => setSelectedIndex(idx)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '7px 10px',
                                            borderRadius: 'var(--radius-xs)',
                                            background: isSelected
                                                ? 'var(--bg-hover)'
                                                : 'transparent',
                                            border: isSelected
                                                ? '1px solid var(--border-strong)'
                                                : '1px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'all 100ms ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {cmd.icon}
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: '12.5px',
                                                    fontWeight: isSelected ? 500 : 400,
                                                    color: isSelected ? 'var(--text-primary)' : 'var(--text-default)',
                                                }}
                                            >
                                                {cmd.label}
                                            </span>
                                        </div>
                                        {cmd.shortcut && (
                                            <kbd style={{ fontSize: '9px', padding: '1px 5px' }}>
                                                {cmd.shortcut}
                                            </kbd>
                                        )}
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                </div>

                {/* Footer Tips */}
                <div
                    style={{
                        padding: '6px 14px',
                        borderTop: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'var(--text-dim)',
                    }}
                >
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <span>↑↓ naviguer</span>
                        <span>↵ valider</span>
                        <span>Échap fermer</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>ScoutRaider</span>
                </div>
            </div>
        </div>
    );
}

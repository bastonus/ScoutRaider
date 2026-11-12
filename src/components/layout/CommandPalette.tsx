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
            keywords: 'carte map carto plein ecran ign',
            perform: () => onViewModeChange('map'),
        });
        items.push({
            id: 'view_text',
            label: 'Afficher la Vue Carnet Textuel',
            category: 'Vues',
            icon: <FileText size={16} color="#10b981" />,
            keywords: 'carnet texte enigmes solution participant',
            perform: () => onViewModeChange('text'),
        });
        items.push({
            id: 'view_split',
            label: 'Afficher la Vue Scindée (Carte + Carnet côte à côte)',
            category: 'Vues',
            icon: <Columns size={16} color="#8b5cf6" />,
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
            id: 'action_toggle_elevation',
            label: `Profil Altimétrique dans le Carnet : ${state.carnet_include_elevation_profile ? 'Désactiver' : 'Activer'}`,
            category: 'Actions Rapides',
            icon: <Mountain size={16} color="#06b6d4" />,
            keywords: 'alti denivele d+ d- courbe elevation',
            perform: () => dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' }),
        });
        items.push({
            id: 'action_reverse_route',
            label: 'Inverser le sens du parcours (Départ ⇄ Arrivée)',
            category: 'Actions Rapides',
            icon: <ArrowLeftRight size={16} color="#f59e0b" />,
            keywords: 'inverser sens retour swap demi tour',
            perform: () => dispatch({ type: 'REVERSE_ACTIVE_ROUTE' }),
        });
        items.push({
            id: 'action_toggle_pois',
            label: `${state.show_pois_on_map ? 'Masquer' : 'Afficher'} les points remarquables (POI IGN)`,
            category: 'Actions Rapides',
            icon: state.show_pois_on_map ? <EyeOff size={16} color="#a855f7" /> : <Eye size={16} color="#a855f7" />,
            keywords: 'pois monuments calvaires fontaines',
            perform: () => dispatch({ type: 'TOGGLE_SHOW_POIS_ON_MAP' }),
        });
        items.push({
            id: 'action_toggle_dangers',
            label: `${state.show_dangers_on_map ? 'Masquer' : 'Afficher'} les zones de danger et grands axes`,
            category: 'Actions Rapides',
            icon: <AlertTriangle size={16} color="#f97316" />,
            keywords: 'danger autoroute route nationale securite',
            perform: () => dispatch({ type: 'TOGGLE_SHOW_DANGERS_ON_MAP' }),
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
                    dispatch({ type: 'SET_ANCHOR_STAGE', index: idx });
                    onViewModeChange('map');
                },
            });
        });

        // ─── 4. Modules d'Enigme ───
        Object.entries(MODULE_META).forEach(([id, meta]) => {
            items.push({
                id: `module_${id}`,
                label: `Module d'énigme : ${meta.label} (${meta.family})`,
                category: 'Modules d\'Enigme',
                icon: <Sparkles size={16} color="#eab308" />,
                keywords: `${meta.label} ${meta.family} ${meta.code || ''} chiffre cryptographie`,
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
                    width: '640px',
                    maxWidth: '92vw',
                    maxHeight: '70vh',
                    background: '#0d130e',
                    border: '1px solid rgba(110, 201, 126, 0.25)',
                    borderRadius: '12px',
                    boxShadow: '0 24px 70px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(110, 201, 126, 0.1)',
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
                        gap: '12px',
                        padding: '14px 18px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                >
                    <Search size={18} color="var(--accent-default, #6ec97e)" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher une action, une étape ou un module... (Entrée pour valider)"
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: 500,
                        }}
                    />
                    <span
                        style={{
                            fontSize: '10px',
                            color: 'rgba(255, 255, 255, 0.4)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            fontWeight: 600,
                        }}
                    >
                        ESC
                    </span>
                </div>

                {/* Commands List */}
                <div
                    ref={listRef}
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '8px 6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                    }}
                >
                    {filteredCommands.length === 0 ? (
                        <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                            Aucune commande ou étape ne correspond à « {search} »
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
                                                fontSize: '10px',
                                                fontWeight: 700,
                                                color: 'rgba(110, 201, 126, 0.7)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em',
                                                padding: '8px 12px 4px 12px',
                                                marginTop: idx === 0 ? '0' : '6px',
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
                                            padding: '9px 12px',
                                            borderRadius: '6px',
                                            background: isSelected
                                                ? 'rgba(110, 201, 126, 0.14)'
                                                : 'transparent',
                                            border: isSelected
                                                ? '1px solid rgba(110, 201, 126, 0.28)'
                                                : '1px solid transparent',
                                            cursor: 'pointer',
                                            transition: 'background 0.1s',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                {cmd.icon}
                                            </div>
                                            <span
                                                style={{
                                                    fontSize: '13px',
                                                    fontWeight: isSelected ? 600 : 400,
                                                    color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
                                                }}
                                            >
                                                {cmd.label}
                                            </span>
                                        </div>
                                        {cmd.shortcut && (
                                            <span
                                                style={{
                                                    fontSize: '10px',
                                                    color: 'rgba(255, 255, 255, 0.45)',
                                                    background: 'rgba(255, 255, 255, 0.06)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {cmd.shortcut}
                                            </span>
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
                        padding: '8px 16px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '11px',
                        color: 'rgba(255, 255, 255, 0.35)',
                    }}
                >
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <span>↑↓ pour naviguer</span>
                        <span>↵ pour exécuter</span>
                        <span>Échap pour quitter</span>
                    </div>
                    <span>ScoutRaider Suite</span>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Bell, 
    Settings, 
    Maximize2, 
    Minus, 
    X, 
    PanelLeft, 
    PanelRight,
    PanelBottom,
    Map as MapIcon,
    Type,
    Columns,
    Cloud,
    CloudOff,
    Loader2,
    User,
    LogOut,
    FolderOpen,
    Search,
    Share2,
    Copy,
    Eye,
    Globe,
    Lock,
    Menu,
    ChevronDown,
    ChevronRight,
    Sparkles,
    Store
} from 'lucide-react';
import FleurDeLysLogo from './FleurDeLysLogo';
import AICopilotModal from '../panels/AICopilotModal';
import { useApp } from '../../AppContext';
import { useAuth } from '../../AuthContext';
import { StateManager } from '../../logic/StateManager';
import type { ViewMode, SectionId } from '../../App';

interface MenuBarProps {
    onSearch?: (query: string) => void;
    onToggleSidebar?: (side: 'left' | 'right') => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    onExport?: () => void;
    onPreferencesOpen?: () => void;
    onSetRightSection?: (id: SectionId) => void;
    onOpenCommandPalette?: () => void;
    onOpenMarketplace?: () => void;
}

export default function MenuBar({ onToggleSidebar, viewMode = 'map', onViewModeChange, onExport, onPreferencesOpen, onSetRightSection, onOpenCommandPalette, onOpenMarketplace }: MenuBarProps) {
    const { state, dispatch } = useApp();
    const { 
        user, 
        isGuest, 
        isAuthenticated, 
        cloudSyncStatus, 
        cloudProjectId,
        currentProjectRole,
        setAuthModalOpen, 
        setProjectsModalOpen, 
        setShareModalOpen,
        makeEditableCopy,
        saveToCloudNow, 
        logout 
    } = useAuth();

    const navigate = useNavigate();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [showNotifHistory, setShowNotifHistory] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded'>('idle');
    const [updateProgress, setUpdateProgress] = useState(0);
    const [updateInfo, setUpdateInfo] = useState<any>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const measureSpanRef = useRef<HTMLSpanElement>(null);

    const [titleInput, setTitleInput] = useState(state.document_title || 'Document sans titre');
    const [titleWidth, setTitleWidth] = useState(180);

    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
    const [isTablet, setIsTablet] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [expandedMobileMenu, setExpandedMobileMenu] = useState<string | null>(null);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiModalTab, setAiModalTab] = useState<'narrative' | 'riddles' | 'safety' | 'mcp' | 'config'>('narrative');

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
            setIsTablet(window.innerWidth < 1024);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        setTitleInput(state.document_title || 'Document sans titre');
    }, [state.document_title]);

    useEffect(() => {
        if (measureSpanRef.current) {
            const w = measureSpanRef.current.offsetWidth;
            setTitleWidth(Math.max(140, Math.min(360, w + 16)));
        }
    }, [titleInput]);

    const handleCommitTitle = useCallback(() => {
        const clean = titleInput.trim() || 'Document sans titre';
        setTitleInput(clean);
        if (clean !== state.document_title) {
            dispatch({ type: 'SET_DOCUMENT_TITLE', title: clean });
        }
    }, [titleInput, state.document_title, dispatch]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
                setShowNotifHistory(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isManualCheck = useRef(false);

    useEffect(() => {
        const electron = (window as any).electronAPI;
        if (!electron) return;

        // Listen for native Electron menu actions (shortcuts triggered from native menu)
        const unsubMenu = electron.onMenuAction((action: string) => {
            if (action === 'new') menus['Fichier'][0].action();
            else if (action === 'open') menus['Fichier'][1].action();
            else if (action === 'save') menus['Fichier'][3].action();
            else if (action === 'save-as') menus['Fichier'][4].action();
            else if (action === 'undo') dispatch({ type: 'UNDO' });
            else if (action === 'redo') dispatch({ type: 'REDO' });
        });

        const unsubUC = electron.onUpdateChecking(() => {
            setUpdateStatus('checking');
        });

        const unsubUA = electron.onUpdateAvailable((info: any) => {
            isManualCheck.current = false;
            setUpdateStatus('available');
            setUpdateInfo(info);
        });

        const unsubUNA = electron.onUpdateNotAvailable(() => {
            if (isManualCheck.current) {
                dispatch({ type: 'ADD_NOTIFICATION', message: 'ScoutRaider est à jour !', notifType: 'info' });
                isManualCheck.current = false;
            }
            setUpdateStatus('idle');
        });

        const unsubUE = electron.onUpdateError((err: string) => {
            if (isManualCheck.current) {
                if (err === 'DEV_MODE') {
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Mises à jour indisponibles en mode développement.', notifType: 'info' });
                } else {
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Erreur lors de la recherche de mises à jour.', notifType: 'error' });
                }
                isManualCheck.current = false;
            }
            setUpdateStatus('idle');
        });

        const unsubUP = electron.onUpdateProgress((progress: any) => {
            setUpdateStatus('downloading');
            setUpdateProgress(Math.round(progress.percent || 0));
        });

        const unsubUD = electron.onUpdateDownloaded(() => {
            setUpdateStatus('downloaded');
        });

        // Trigger auto-check if enabled
        if (state.auto_check_updates) {
            setTimeout(() => {
                electron.checkForUpdates();
            }, 3000);
        }

        return () => {
            unsubMenu();
            unsubUC();
            unsubUA();
            unsubUNA();
            unsubUE();
            unsubUP();
            unsubUD();
        };
    }, [dispatch]);

    // Global keyboard shortcuts (for browser dev or when native menu misses it)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'e':
                        e.preventDefault();
                        onExport?.();
                        break;
                    case 'i':
                        e.preventDefault();
                        setAiModalOpen(true);
                        break;
                    case 's':
                        e.preventDefault();
                        if (e.shiftKey) menus['Fichier'][4].action(); // Save as
                        else menus['Fichier'][3].action(); // Save
                        break;
                    case 'n':
                        e.preventDefault();
                        menus['Fichier'][0].action(); // New
                        break;
                    case 'o':
                        e.preventDefault();
                        menus['Fichier'][1].action(); // Open
                        break;
                    case 'z':
                        e.preventDefault();
                        if (e.shiftKey) dispatch({ type: 'REDO' });
                        else dispatch({ type: 'UNDO' });
                        break;
                    case 'y':
                        e.preventDefault();
                        dispatch({ type: 'REDO' });
                        break;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [dispatch, state]);

    const toggleMenu = (menuName: string) => {
        setOpenMenu(prev => prev === menuName ? null : menuName);
    };

    const handleAction = (action: () => void) => {
        action();
        setOpenMenu(null);
    };

    const menus: Record<string, any[]> = {
        'Fichier': [
            { label: 'Nouveau Projet', shortcut: 'Ctrl+N', action: () => {
                dispatch({ type: 'NEW_PROJECT' });
                dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouveau projet créé.', notifType: 'info' });
            }},
            { label: 'Ouvrir Projet...', shortcut: 'Ctrl+O', action: async () => {
                const loaded = await StateManager.loadProject();
                if (loaded) {
                    dispatch({ type: 'LOAD_PROJECT', state: loaded });
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet chargé.', notifType: 'info' });
                }
            }},
            { label: 'Importer Projet...', action: async () => {
                const loaded = await StateManager.loadProject();
                if (loaded) {
                    dispatch({ type: 'LOAD_PROJECT', state: loaded });
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet importé.', notifType: 'info' });
                }
            }},
            { divider: true },
            { label: 'Enregistrer', shortcut: 'Ctrl+S', action: async () => {
                dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Enregistrement...' });
                const res = await StateManager.saveProject(state, state.current_filepath || undefined);
                dispatch({ type: 'SET_LOADING', isLoading: false });
                if (res) {
                    if (typeof res === 'object' && res.filepath) {
                        dispatch({ type: 'SET_CURRENT_FILEPATH', filepath: res.filepath });
                    }
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet enregistré.', notifType: 'info' });
                }
            }},
            { label: 'Enregistrer sous...', shortcut: 'Ctrl+Shift+S', action: async () => {
                dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Enregistrement...' });
                const res = await StateManager.saveProject(state, undefined);
                dispatch({ type: 'SET_LOADING', isLoading: false });
                if (res) {
                    if (typeof res === 'object' && res.filepath) {
                        dispatch({ type: 'SET_CURRENT_FILEPATH', filepath: res.filepath });
                    }
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet enregistré sous un nouveau nom.', notifType: 'info' });
                }
            }},
            { divider: true },
            { label: 'Espace Documents (Cloud)...', action: () => {
                if (isGuest) setAuthModalOpen(true);
                else setProjectsModalOpen(true);
            }},
            { label: 'Partager le document...', action: () => {
                if (isGuest) setAuthModalOpen(true);
                else setShareModalOpen(true);
            }},
            { label: 'Créer une copie modifiable', action: () => {
                makeEditableCopy();
            }},
            { label: 'Synchroniser avec le cloud', action: () => {
                if (isGuest) setAuthModalOpen(true);
                else saveToCloudNow();
            }},
            { divider: true },
            { label: 'Exporter...', shortcut: 'Ctrl+E', action: () => onExport?.() },
        ],
        'Édition': [
            { label: 'Annuler', shortcut: 'Ctrl+Z', action: () => dispatch({ type: 'UNDO' }) },
            { label: 'Rétablir', shortcut: 'Ctrl+Y', action: () => dispatch({ type: 'REDO' }) },
        ],
        'Vue': [
            {
                label: `${state.show_stages_on_map ? '✓' : '  '} Étapes sur la carte`,
                action: () => dispatch({ type: 'TOGGLE_STAGES_ON_MAP' })
            },
            {
                label: `${state.show_pois_on_map ? '✓' : '  '} Points d'intérêt (POI)`,
                action: () => dispatch({ type: 'TOGGLE_POIS_ON_MAP' })
            },
            {
                label: `${state.show_dangers_on_map ? '✓' : '  '} Coloration danger des tracés`,
                action: () => dispatch({ type: 'TOGGLE_DANGERS_ON_MAP' })
            },
            { divider: true },
            {
                label: `${state.show_azimuth_arrows ? '✓' : '  '} Flèches d'azimut`,
                action: () => dispatch({ type: 'TOGGLE_AZIMUTH_ARROWS' })
            },
            { divider: true },
            { label: 'Carte seule', shortcut: 'Alt+1', action: () => onViewModeChange?.('map') },
            { label: 'Texte seul', shortcut: 'Alt+2', action: () => onViewModeChange?.('text') },
            { label: 'Vue côte à côte', shortcut: 'Alt+3', action: () => onViewModeChange?.('split') },
        ],
        'IA & MCP': [
            { label: 'Ouvrir le Copilote de Raid...', shortcut: 'Ctrl+I', action: () => { setAiModalTab('narrative'); setAiModalOpen(true); } },
            { label: 'Scénariser le raid (thème & récits)...', action: () => { setAiModalTab('narrative'); setAiModalOpen(true); } },
            { label: 'Créer des énigmes codées...', action: () => { setAiModalTab('riddles'); setAiModalOpen(true); } },
            { label: 'Auditer la sécurité topographique...', action: () => { setAiModalTab('safety'); setAiModalOpen(true); } },
            { divider: true },
            { label: 'Connecteurs & Serveur MCP...', action: () => { setAiModalTab('mcp'); setAiModalOpen(true); } },
            { label: 'Configuration Fournisseurs IA...', action: () => { setAiModalTab('config'); setAiModalOpen(true); } },
        ],
        'Marketplace': [
            { label: 'Ouvrir la Marketplace...', shortcut: 'Ctrl+M', action: () => onOpenMarketplace?.() },
            { label: 'Codes & Énigmes communautaires...', action: () => onOpenMarketplace?.() },
            { label: 'Orchestrations & Presets partagés...', action: () => onOpenMarketplace?.() },
            { label: 'Thèmes & Feuilles de style...', action: () => onOpenMarketplace?.() },
            { divider: true },
            { label: 'Ma Bibliothèque synchronisée...', action: () => onOpenMarketplace?.() },
        ],
        'Aide': [
            { label: 'Vérifier les mises à jour...', action: async () => {
                if ((window as any).electronAPI) {
                    isManualCheck.current = true;
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Recherche de mises à jour...', notifType: 'info' });
                    try {
                        const result = await (window as any).electronAPI.checkForUpdates();
                        if (result && result.error) {
                            // Error is already handled by the onUpdateError listener, 
                            // but we can add extra logic here if needed.
                        }
                    } catch (e) {
                        console.error("Check for updates failed", e);
                    }
                } else {
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Indisponible dans le navigateur.', notifType: 'warning' });
                }
            }},
            { label: 'Console de développement', shortcut: 'F12', action: () => {
                if ((window as any).electronAPI) {
                    (window as any).electronAPI.toggleDevTools();
                } else {
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Indisponible dans le navigateur.', notifType: 'warning' });
                }
            }},
            { divider: true },
            { label: 'Guide du Raid', shortcut: 'F1', action: () => {
                window.open('https://github.com/bastonus/ScoutRaider/wiki', '_blank');
            }},
            { label: 'Suggestions & Feedback', action: () => {
                window.open('https://github.com/bastonus/ScoutRaider/issues/new', '_blank');
            }},
            { divider: true },
            { label: 'À propos', action: async () => {
                let version = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : 'v0.3.3-beta';
                if ((window as any).electronAPI) {
                    try {
                        version = `v${await (window as any).electronAPI.getAppVersion()}`;
                    } catch {}
                }
                dispatch({ type: 'ADD_NOTIFICATION', message: `ScoutRaider Suite ${version}`, notifType: 'info' });
            }},
        ]
    };

    const handleWindowControl = (action: string) => {
        (window as any).electronAPI?.windowControl(action);
    };

    return (
        <header className="menu-bar" style={{
            height: '54px',
            userSelect: 'none',
            background: 'var(--bg-dark)',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            justifyContent: 'space-between',
            zIndex: 2000,
        } as React.CSSProperties & { WebkitAppRegion: string }}>
{/* @ts-ignore WebkitAppRegion is Electron-specific */}
            {/* LEFT: LOGO + GOOGLE DOCS STYLE TITLE ENCART & MENUS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', WebkitAppRegion: 'no-drag' } as any} ref={menuRef}>
                <div 
                    title="Retour à l'accueil"
                    onClick={() => navigate('/projects')}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        flexShrink: 0,
                        borderRadius: '6px',
                        padding: '2px',
                        transition: 'background 0.15s',
                    }}
                >
                    <FleurDeLysLogo size={30} style={{ 
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))',
                        borderRadius: '6px'
                    }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1px' }}>
                    {/* Top Row: Google Docs style Document Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                            ref={measureSpanRef}
                            style={{
                                position: 'absolute',
                                visibility: 'hidden',
                                height: 0,
                                overflow: 'hidden',
                                whiteSpace: 'pre',
                                fontSize: '15px',
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                pointerEvents: 'none'
                            }}
                        >
                            {titleInput || 'Document sans titre'}
                        </span>

                        <input
                            type="text"
                            value={titleInput}
                            onChange={(e) => setTitleInput(e.target.value)}
                            onBlur={handleCommitTitle}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                    setTitleInput(state.document_title || 'Document sans titre');
                                    e.currentTarget.blur();
                                }
                            }}
                            title="Renommer le document"
                            placeholder="Document sans titre"
                            style={{
                                width: `${titleWidth}px`,
                                height: '22px',
                                background: 'transparent',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                color: '#ffffff',
                                fontSize: '15px',
                                fontWeight: 600,
                                lineHeight: '20px',
                                padding: '1px 6px',
                                outline: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                textOverflow: 'ellipsis',
                            }}
                            onMouseEnter={(e) => {
                                if (document.activeElement !== e.currentTarget) {
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.22)';
                                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (document.activeElement !== e.currentTarget) {
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }
                            }}
                            onFocusCapture={(e) => {
                                e.currentTarget.style.borderColor = 'var(--accent-default)';
                                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.35)';
                                e.currentTarget.style.boxShadow = '0 0 0 2px rgba(110, 201, 126, 0.18)';
                                e.currentTarget.style.cursor = 'text';
                            }}
                            onBlurCapture={(e) => {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.boxShadow = 'none';
                                e.currentTarget.style.cursor = 'pointer';
                            }}
                        />

                        {/* Save status icon (Google Docs cloud status) */}
                        <div 
                            onClick={() => {
                                if (isGuest) setAuthModalOpen(true);
                                else setProjectsModalOpen(true);
                            }}
                            title={
                                isGuest 
                                    ? "Mode Invité : les modifications ne sont pas sauvegardées sur le serveur. Cliquez pour vous connecter."
                                    : cloudSyncStatus === 'saving'
                                    ? "Enregistrement automatique dans le cloud..."
                                    : cloudSyncStatus === 'error'
                                    ? "Erreur de synchronisation cloud. Cliquez pour réessayer."
                                    : "Toutes les modifications sont enregistrées dans le cloud PostgreSQL."
                            }
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                                color: isGuest 
                                    ? 'rgba(255, 255, 255, 0.35)' 
                                    : cloudSyncStatus === 'error' 
                                    ? '#ef4444' 
                                    : cloudSyncStatus === 'saving'
                                    ? '#60a5fa'
                                    : 'var(--accent-default)',
                                opacity: 0.85,
                                padding: '2px 4px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            {isGuest ? (
                                <CloudOff size={13} />
                            ) : cloudSyncStatus === 'saving' ? (
                                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                            ) : cloudSyncStatus === 'error' ? (
                                <CloudOff size={13} />
                            ) : (
                                <Cloud size={13} />
                            )}
                        </div>
                    </div>

                    {/* Bottom Row: Menus on Desktop OR Menu Trigger on Mobile */}
                    {isMobile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <button
                                onClick={() => setMobileMenuOpen(true)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    color: 'var(--text-primary)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                }}
                            >
                                <Menu size={13} color="var(--accent-default)" />
                                <span>Menu</span>
                            </button>
                        </div>
                    ) : (
                        <nav style={{ display: 'flex', gap: '2px', fontSize: '11.5px', fontWeight: 500, color: 'var(--text-dim)', marginLeft: '-4px' }}>
                        {Object.entries(menus).map(([name, items]) => (
                            <div key={name} style={{ position: 'relative' }}>
                                <span 
                                    className="menu-btn" 
                                    onClick={() => toggleMenu(name)}
                                    onMouseEnter={() => openMenu && setOpenMenu(name)}
                                    style={{ 
                                        padding: '4px 10px', 
                                        borderRadius: '4px', 
                                        cursor: 'pointer',
                                        background: openMenu === name ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                                        color: openMenu === name ? 'var(--text-primary)' : 'var(--text-dim)'
                                    }}
                                >
                                    {name}
                                </span>
                                
                                {openMenu === name && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '4px',
                                        background: 'var(--bg-panel)',
                                        border: '1px solid var(--bg-border)',
                                        borderRadius: '6px',
                                        boxShadow: 'var(--shadow-glass)',
                                        minWidth: '220px',
                                        padding: '4px 0',
                                        zIndex: 3000
                                    }}>
                                        {items.map((item, idx) =>
                                            (item as any).divider ? (
                                                <div key={idx} style={{ height: '1px', background: 'var(--bg-border)', margin: '4px 0' }} />
                                            ) : (
                                                <div 
                                                    key={idx}
                                                    className="menu-item-hover"
                                                    onClick={() => handleAction((item as any).action as () => void)}
                                                    style={{
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        padding: '6px 16px',
                                                        cursor: 'pointer',
                                                        color: 'var(--text-primary)',
                                                        fontSize: '12px',
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    <span>{(item as any).label}</span>
                                                    {(item as any).shortcut && <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{(item as any).shortcut}</span>}
                                                </div>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>
                    )}
                </div>
            </div>

            {/* CENTER: View Mode Toggle & Command Palette (Hidden on Mobile < 768px) */}
            {!isMobile && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isTablet ? '6px' : '10px', WebkitAppRegion: 'drag' } as any}>
                    {/* View Mode Switcher */}
                    <div style={{
                        display: 'flex',
                        background: 'var(--bg-surface)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '3px',
                        border: '1px solid var(--border-subtle)',
                        WebkitAppRegion: 'no-drag',
                        gap: '3px'
                    } as any}>
                        <button
                            onClick={() => onViewModeChange?.('map')}
                            style={getViewBtnStyle(viewMode === 'map', false)}
                            title="Vue Carte Topographique (Ctrl+1)"
                        >
                            <MapIcon size={13} />
                            {!isTablet && <span>Carte</span>}
                            {!isTablet && <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '2px', padding: '0 3px', borderRadius: '2px', background: 'var(--bg-surface)', fontFamily: 'var(--font-mono)' }}>Ctrl+1</span>}
                        </button>
                        <button
                            onClick={() => onViewModeChange?.('text')}
                            style={getViewBtnStyle(viewMode === 'text', false)}
                            title="Vue Carnet Textuel (Ctrl+2)"
                        >
                            <Type size={13} />
                            {!isTablet && <span>Texte</span>}
                            {!isTablet && <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '2px', padding: '0 3px', borderRadius: '2px', background: 'var(--bg-surface)', fontFamily: 'var(--font-mono)' }}>Ctrl+2</span>}
                        </button>
                        <button
                            onClick={() => onViewModeChange?.(viewMode === 'split' ? 'map' : 'split')}
                            style={getViewBtnStyle(viewMode === 'split', false)}
                            title="Vue scindée Carte + Texte (Ctrl+3)"
                        >
                            <Columns size={13} />
                            {!isTablet && <span>Side-by-side</span>}
                            {!isTablet && <span style={{ fontSize: '9px', opacity: 0.6, marginLeft: '2px', padding: '0 3px', borderRadius: '2px', background: 'var(--bg-surface)', fontFamily: 'var(--font-mono)' }}>Ctrl+3</span>}
                        </button>
                    </div>

                    {/* Quick Command Trigger */}
                    {!isTablet && (
                        <button
                            onClick={onOpenCommandPalette}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '0 10px',
                                height: '28px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 'var(--radius-pill)',
                                color: 'var(--text-dim)',
                                fontSize: '11px',
                                fontWeight: 400,
                                cursor: 'pointer',
                                transition: 'all 100ms ease',
                                WebkitAppRegion: 'no-drag',
                            } as any}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--border-strong)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }}
                            title="Ouvrir la palette de commandes (Ctrl+K)"
                        >
                            <Search size={12} color="var(--text-dim)" />
                            <span>Commandes</span>
                            <kbd style={{ fontSize: '9px', padding: '0 4px', height: '16px', borderRadius: '4px' }}>Ctrl K</kbd>
                        </button>
                    )}

                    {/* AI Copilot & MCP Trigger */}
                    {!isTablet && (
                        <button
                            onClick={() => { setAiModalTab('narrative'); setAiModalOpen(true); }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '0 10px',
                                height: '28px',
                                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.1) 100%)',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                borderRadius: 'var(--radius-pill)',
                                color: '#34d399',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 100ms ease',
                                WebkitAppRegion: 'no-drag',
                            } as any}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = '#10b981';
                                e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                                e.currentTarget.style.color = '#34d399';
                            }}
                            title="Copilote IA & Hub MCP (Ctrl+I)"
                        >
                            <Sparkles size={12} color="#10b981" />
                            <span>IA & MCP</span>
                        </button>
                    )}
                </div>
            )}

            {/* RIGHT: CONTROLS & WINDOWS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isTablet ? '4px' : '8px', WebkitAppRegion: 'no-drag' } as any}>
                
                {/* READ-ONLY VIEWER BADGE */}
                {currentProjectRole === 'viewer' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#fca5a5',
                        fontSize: '11px',
                        fontWeight: 600
                    }}>
                        <Eye size={13} />
                        {!isTablet && <span>Lecture seule</span>}
                        <button
                            onClick={makeEditableCopy}
                            title="Créer une copie modifiable enregistrée dans votre compte"
                            style={{
                                background: '#2e7d47',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 'var(--radius-pill)',
                                padding: '2px 8px',
                                fontSize: '10px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                marginLeft: '4px'
                            }}
                        >
                            Créer une copie
                        </button>
                    </div>
                )}

                {/* MARKETPLACE BUTTON (Desktop & Tablet) */}
                {!isMobile && (
                    <button
                        onClick={onOpenMarketplace}
                        title="Marketplace : codes, énigmes, orchestrations & communauté"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: 'rgba(110, 201, 126, 0.12)',
                            border: '1px solid rgba(110, 201, 126, 0.3)',
                            borderRadius: 'var(--radius-main)',
                            padding: isTablet ? '0 8px' : '0 12px',
                            height: '28px',
                            color: '#6EC97E',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 100ms ease'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(110, 201, 126, 0.22)';
                            e.currentTarget.style.borderColor = '#6EC97E';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(110, 201, 126, 0.12)';
                            e.currentTarget.style.borderColor = 'rgba(110, 201, 126, 0.3)';
                        }}
                    >
                        <Store size={13} color="#6EC97E" />
                        {!isTablet && <span>Marketplace</span>}
                    </button>
                )}

                {/* ESPACE DOCUMENTS BUTTON (Desktop & Tablet) */}
                {!isMobile && (
                    <button
                        onClick={() => {
                            if (isGuest) setAuthModalOpen(true);
                            else setProjectsModalOpen(true);
                        }}
                        title="Ouvrir l'Espace Documents Cloud"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-main)',
                            padding: isTablet ? '0 8px' : '0 12px',
                            height: '28px',
                            color: 'var(--text-primary)',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 100ms ease'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-strong)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-surface)';
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        }}
                    >
                        <FolderOpen size={13} color="var(--text-dim)" />
                        {!isTablet && <span>Documents</span>}
                    </button>
                )}

                {/* SHARE BUTTON (Desktop & Tablet) */}
                {!isMobile && (
                    <button
                        onClick={() => {
                            if (isGuest) setAuthModalOpen(true);
                            else setShareModalOpen(true);
                        }}
                        title="Partager ce document"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-main)',
                            padding: isTablet ? '0 8px' : '0 12px',
                            height: '28px',
                            color: 'var(--text-primary)',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 100ms ease'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.background = 'var(--bg-hover)';
                            e.currentTarget.style.borderColor = 'var(--border-strong)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.background = 'var(--bg-surface)';
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        }}
                    >
                        <Share2 size={13} color="var(--text-dim)" />
                        {!isTablet && <span>Partager</span>}
                    </button>
                )}

                {/* EXPORT BUTTON — ALWAYS VISIBLE & TOUCH-FRIENDLY ON MOBILE */}
                {isMobile && (
                    <button
                        onClick={onExport}
                        title="Exporter le carnet de raid"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            background: 'var(--accent-default)',
                            border: '1px solid var(--accent-default)',
                            borderRadius: 'var(--radius-xs)',
                            padding: '0 10px',
                            height: '28px',
                            color: '#ffffff',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0
                        }}
                    >
                        <Download size={13} strokeWidth={2.5} />
                        <span>Export</span>
                    </button>
                )}

                {/* USER PROFILE AVATAR CIRCLE */}
                <div style={{ position: 'relative' }} ref={userMenuRef}>
                    {!isGuest && user ? (
                        <button
                            onClick={() => setUserMenuOpen(prev => !prev)}
                            title={`Connecté : ${user.username} (PostgreSQL synchronisé)`}
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                padding: 0,
                                color: 'var(--text-primary)',
                                transition: 'all 100ms ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--border-strong)';
                                e.currentTarget.style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                e.currentTarget.style.background = 'var(--bg-surface)';
                            }}
                        >
                            <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                                {user.username ? user.username.charAt(0) : <User size={13} />}
                            </span>
                            {/* Status indicator dot */}
                            <span style={{
                                position: 'absolute',
                                bottom: '-1px',
                                right: '-1px',
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: cloudSyncStatus === 'saving' ? '#60A5FA' : cloudSyncStatus === 'error' ? 'var(--semantic-danger)' : 'var(--semantic-success)',
                                border: '1.5px solid var(--bg-dark)'
                            }} />
                        </button>
                    ) : (
                        <button
                            onClick={() => setAuthModalOpen(true)}
                            title="Connexion au compte (Actuellement en mode Invité)"
                            style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                padding: 0,
                                color: 'var(--text-dim)',
                                transition: 'all 100ms ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = 'var(--border-strong)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                                e.currentTarget.style.background = 'var(--bg-hover)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                                e.currentTarget.style.color = 'var(--text-dim)';
                                e.currentTarget.style.background = 'var(--bg-surface)';
                            }}
                        >
                            <User size={13} />
                            {/* Amber guest dot */}
                            <span style={{
                                position: 'absolute',
                                bottom: '-1px',
                                right: '-1px',
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: 'var(--semantic-warning)',
                                border: '1.5px solid var(--bg-dark)'
                            }} />
                        </button>
                    )}

                    {/* User dropdown menu */}
                    {userMenuOpen && !isGuest && user && (
                        <div style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            right: 0,
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: 'var(--shadow-lg)',
                            minWidth: '200px',
                            padding: '4px 0',
                            zIndex: 3500
                        }}>
                            <div style={{ padding: '6px 12px 8px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-dim)' }}>
                                Connecté : <strong style={{ color: 'var(--text-primary)' }}>{user.username}</strong>
                            </div>
                            <div
                                className="menu-item-hover"
                                onClick={() => {
                                    setProjectsModalOpen(true);
                                    setUserMenuOpen(false);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
                            >
                                <FolderOpen size={13} color="var(--text-dim)" />
                                <span>Mes documents cloud</span>
                            </div>
                            <div
                                className="menu-item-hover"
                                onClick={() => {
                                    saveToCloudNow();
                                    setUserMenuOpen(false);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)' }}
                            >
                                <Cloud size={13} color="var(--text-dim)" />
                                <span>Enregistrer maintenant</span>
                            </div>
                            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                            <div
                                className="menu-item-hover"
                                onClick={() => {
                                    logout();
                                    setUserMenuOpen(false);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: 'var(--semantic-danger)' }}
                            >
                                <LogOut size={13} />
                                <span>Se déconnecter</span>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* UPDATE STATUS PILL */}
                {updateStatus !== 'idle' && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(110, 201, 126, 0.1)',
                        border: '1px solid rgba(110, 201, 126, 0.2)',
                        marginRight: '8px'
                    }}>
                        {updateStatus === 'checking' && (
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Recherche...</span>
                        )}
                        {updateStatus === 'available' && (
                            <span style={{ fontSize: '11px', color: 'var(--accent-default)', fontWeight: 700 }}>Mise à jour disponible</span>
                        )}
                        {updateStatus === 'downloading' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '60px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                    <div style={{ width: `${updateProgress}%`, height: '100%', background: 'var(--accent-default)', transition: 'width 0.3s' }} />
                                </div>
                                <span style={{ fontSize: '10px', color: 'var(--accent-default)', fontWeight: 800 }}>{updateProgress}%</span>
                            </div>
                        )}
                        {updateStatus === 'downloaded' && (
                            <button 
                                onClick={() => (window as any).electronAPI?.quitAndInstall()}
                                style={{
                                    background: 'var(--accent-default)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    padding: '2px 10px',
                                    fontSize: '10.5px',
                                    fontWeight: 800,
                                    color: '#0a100d',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                Redémarrer pour mettre à jour
                            </button>
                        )}
                    </div>
                )}

                {/* SIDEBAR TOGGLES */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: '4px', paddingRight: '10px', borderRight: '1px solid var(--bg-border)' }}>
                    <button 
                        className="btn-icon btn-sm" 
                        onClick={() => onToggleSidebar?.('left')}
                        title="Basculer la barre latérale gauche"
                    >
                        <PanelLeft size={17} strokeWidth={2.2} />
                    </button>
                    <button 
                        className="btn-icon btn-sm" 
                        onClick={() => onToggleSidebar?.('right')}
                        title="Basculer la barre latérale droite"
                    >
                        <PanelRight size={17} strokeWidth={2.2} />
                    </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', position: 'relative' }}>
                    <button 
                        className="btn-icon btn-sm" 
                        title="Préférences (Ctrl+P)"
                        onClick={onPreferencesOpen}
                    >
                        <Settings size={17} strokeWidth={2.2} />
                    </button>

                    <button 
                        className="btn-icon btn-sm" 
                        title="Historique des notifications"
                        onClick={() => {
                            setShowNotifHistory(!showNotifHistory);
                            setOpenMenu(null);
                        }}
                    >
                        <Bell size={17} strokeWidth={2.2} />
                        {state.notifications.length > 0 && (
                            <div style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', background: 'var(--semantic-red)', borderRadius: '50%' }} />
                        )}
                    </button>
                    
                    {showNotifHistory && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '8px',
                            width: '320px', maxHeight: '400px', overflowY: 'auto',
                            background: 'var(--bg-panel)', border: '1px solid var(--bg-border)',
                            borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-glass)',
                            zIndex: 3000, display: 'flex', flexDirection: 'column'
                        }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                Historique des Notifications
                            </div>
                            {state.notifications.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px' }}>
                                    Aucune notification.
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {[...state.notifications].reverse().map(notif => (
                                        <div key={notif.id} style={{
                                            padding: '12px 16px', borderBottom: '1px solid var(--glass-border)',
                                            display: 'flex', gap: '12px', alignItems: 'flex-start',
                                            background: notif.type === 'error' ? 'rgba(239, 68, 68, 0.05)' : notif.type === 'warning' ? 'rgba(212, 145, 74, 0.05)' : 'transparent'
                                        }}>
                                            <div style={{ color: notif.type === 'error' ? 'var(--semantic-red)' : notif.type === 'warning' ? 'var(--semantic-orange)' : 'var(--semantic-green)', marginTop: '2px' }}>
                                                •
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                                                    {notif.message}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {(window as any).electronAPI && (
                    <>
                        <div style={{ width: '1px', height: '16px', background: 'var(--bg-border)', margin: '0 4px' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <button onClick={() => handleWindowControl('minimize')} className="btn-icon btn-sm win-control" style={{ color: 'var(--text-primary)' }}><Minus size={16} /></button>
                            <button onClick={() => handleWindowControl('maximize')} className="btn-icon btn-sm win-control" style={{ color: 'var(--text-primary)' }}><Maximize2 size={13} /></button>
                            <button onClick={() => handleWindowControl('close')} className="btn-icon btn-sm win-control hover-red" style={{ color: 'var(--text-primary)' }}><X size={16} /></button>
                        </div>
                    </>
                )}
            </div>

            {/* MOBILE MENU DRAWER / BOTTOM SHEET */}
            {isMobile && mobileMenuOpen && (
                <>
                    <div 
                        className="bottom-sheet-backdrop" 
                        onClick={() => {
                            setMobileMenuOpen(false);
                            setExpandedMobileMenu(null);
                        }} 
                    />
                    <div className="bottom-sheet-panel" style={{ height: '70dvh', zIndex: 3500 }}>
                        <div className="bottom-sheet-handle-bar" />
                        <div className="bottom-sheet-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                <Menu size={16} color="var(--accent-default)" />
                                <span>Menu Principal</span>
                            </div>
                            <button
                                onClick={() => {
                                    setMobileMenuOpen(false);
                                    setExpandedMobileMenu(null);
                                }}
                                aria-label="Fermer le menu"
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px' }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px' }}>
                            {Object.entries(menus).map(([name, items]) => {
                                const isExp = expandedMobileMenu === name;
                                return (
                                    <div key={name} style={{ borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                                        <div
                                            onClick={() => setExpandedMobileMenu(isExp ? null : name)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '12px 6px',
                                                cursor: 'pointer',
                                                color: isExp ? 'var(--accent-default)' : 'var(--text-primary)',
                                                fontSize: '13.5px',
                                                fontWeight: 600
                                            }}
                                        >
                                            <span>{name}</span>
                                            {isExp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </div>
                                        {isExp && (
                                            <div style={{ padding: '0 6px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                {items.map((item, idx) =>
                                                    (item as any).divider ? (
                                                        <div key={idx} style={{ height: '1px', background: 'var(--border-subtle)', margin: '6px 0' }} />
                                                    ) : (
                                                        <div
                                                            key={idx}
                                                            className="menu-item-hover"
                                                            onClick={() => {
                                                                handleAction((item as any).action as () => void);
                                                                setMobileMenuOpen(false);
                                                                setExpandedMobileMenu(null);
                                                            }}
                                                            style={{
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                padding: '10px 12px',
                                                                borderRadius: 'var(--radius-xs)',
                                                                cursor: 'pointer',
                                                                color: 'var(--text-primary)',
                                                                fontSize: '13px'
                                                            }}
                                                        >
                                                            <span>{(item as any).label}</span>
                                                            {(item as any).shortcut && <span style={{ color: 'var(--text-dim)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>{(item as any).shortcut}</span>}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* AI Copilot & MCP Hub Modal */}
            <AICopilotModal
                isOpen={aiModalOpen}
                onClose={() => setAiModalOpen(false)}
                initialTab={aiModalTab}
            />
        </header>
    );
}

function getViewBtnStyle(active: boolean, isCompact = false): React.CSSProperties {
    return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '5px',
        padding: isCompact ? '4px 8px' : '4px 10px',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${active ? 'var(--accent-default)' : 'transparent'}`,
        background: active ? 'var(--accent-default)' : 'transparent',
        color: active ? '#ffffff' : 'var(--text-dim)',
        fontSize: '11px',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 100ms ease',
        boxShadow: active ? '0 2px 8px rgba(37, 99, 235, 0.35)' : 'none',
    };
}

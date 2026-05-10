import React, { useState, useRef, useEffect, useCallback } from 'react';
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
    Columns
} from 'lucide-react';
import FleurDeLysLogo from './FleurDeLysLogo';
import { useApp } from '../../AppContext';
import type { ViewMode } from '../../App';

interface MenuBarProps {
    onSearch?: (query: string) => void;
    onToggleSidebar?: (side: 'left' | 'right') => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
}

export default function MenuBar({ onToggleSidebar, viewMode = 'map', onViewModeChange }: MenuBarProps) {
    const { state, dispatch } = useApp();
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const [showNotifHistory, setShowNotifHistory] = useState(false);
    const [updateModal, setUpdateModal] = useState<{ show: boolean, info?: any, downloading?: boolean, downloaded?: boolean, checking?: boolean } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
                setShowNotifHistory(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const electron = (window as any).electronAPI;
        if (!electron) return;

        electron.onUpdateAvailable((info: any) => {
            setUpdateModal({ show: true, info, downloading: false, downloaded: false });
        });

        electron.onUpdateNotAvailable(() => {
            setUpdateModal(prev => prev?.checking ? null : prev);
            if (updateModal?.checking) {
                dispatch({ type: 'ADD_NOTIFICATION', message: 'ScoutRaider est à jour !', notifType: 'info' });
            }
        });

        electron.onUpdateError((err: string) => {
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Erreur de mise à jour', notifType: 'error' });
            setUpdateModal(null);
        });

        electron.onUpdateDownloaded(() => {
            setUpdateModal(prev => prev ? { ...prev, downloading: false, downloaded: true } : null);
        });

        // Listen for native Electron menu actions (shortcuts triggered from native menu)
        electron.onMenuAction((action: string) => {
            if (action === 'new') menus['Fichier'][0].action();
            else if (action === 'open') menus['Fichier'][1].action();
            else if (action === 'save') menus['Fichier'][3].action();
            else if (action === 'undo') dispatch({ type: 'UNDO' });
            else if (action === 'redo') dispatch({ type: 'REDO' });
        });
    }, [dispatch]);

    // Global keyboard shortcuts (for browser dev or when native menu misses it)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
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
            { label: 'Ouvrir Projet...', shortcut: 'Ctrl+O', action: () => {
                if ((window as any).electronAPI) {
                    (window as any).electronAPI.openScoutproj().then((res: any) => {
                        if (res && res.state) {
                            dispatch({ type: 'LOAD_PROJECT', state: JSON.parse(res.state) });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet chargé avec succès.', notifType: 'info' });
                        }
                    });
                } else {
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Indisponible dans le navigateur.', notifType: 'warning' });
                }
            }},
            { divider: true },
            { label: 'Enregistrer', shortcut: 'Ctrl+S', action: () => {
                if ((window as any).electronAPI) {
                    (window as any).electronAPI.saveScoutproj(JSON.stringify(state), '').then((res: any) => {
                        if (res) dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet enregistré.', notifType: 'info' });
                    });
                } else {
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Indisponible dans le navigateur.', notifType: 'warning' });
                }
            }},
            { label: 'Enregistrer sous...', shortcut: 'Ctrl+Shift+S', action: () => {
                if ((window as any).electronAPI) {
                    (window as any).electronAPI.saveScoutproj(JSON.stringify(state), '').then((res: any) => {
                        if (res) dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet enregistré.', notifType: 'info' });
                    });
                } else {
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Indisponible dans le navigateur.', notifType: 'warning' });
                }
            }},
            { divider: true },
            { label: 'Exporter en PDF', shortcut: 'Ctrl+E', action: () => {
                dispatch({ type: 'ADD_NOTIFICATION', message: 'Veuillez utiliser l\'onglet Exporter.', notifType: 'info' });
            }},
        ],
        'Édition': [
            { label: 'Annuler', shortcut: 'Ctrl+Z', action: () => dispatch({ type: 'UNDO' }) },
            { label: 'Rétablir', shortcut: 'Ctrl+Y', action: () => dispatch({ type: 'REDO' }) },
        ],
        'Aide': [
            { label: 'Vérifier les mises à jour...', action: () => {
                if ((window as any).electronAPI) {
                    setUpdateModal({ show: false, checking: true });
                    (window as any).electronAPI.checkForUpdates();
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
                window.open('https://github.com/bastonus/ScoutRaider-Suite/wiki', '_blank');
            }},
            { label: 'Suggestions & Feedback', action: () => {
                window.open('https://github.com/bastonus/ScoutRaider-Suite/issues/new', '_blank');
            }},
            { divider: true },
            { label: 'À propos', action: () => {
                dispatch({ type: 'ADD_NOTIFICATION', message: 'ScoutRaider Suite v0.3.0', notifType: 'info' });
            }},
        ]
    };

    const handleWindowControl = (action: string) => {
        (window as any).electronAPI?.windowControl(action);
    };

    return (
        <header className="menu-bar" style={{
            height: '42px',
            background: 'var(--bg-dark)',
            borderBottom: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 16px',
            justifyContent: 'space-between',
            zIndex: 2000,
        } as React.CSSProperties & { WebkitAppRegion: string }}>
{/* @ts-ignore WebkitAppRegion is Electron-specific */}
            {/* LEFT: LOGO + MENUS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', WebkitAppRegion: 'no-drag' } as any} ref={menuRef}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FleurDeLysLogo size={26} style={{ 
                        filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))',
                        borderRadius: '6px'
                    }} />
                    <span style={{ 
                        fontWeight: 800, 
                        fontSize: '12.5px', 
                        letterSpacing: '0.1em', 
                        color: '#ffffff',
                    }}>SCOUTRAIDER</span>
                </div>
                
                <nav style={{ display: 'flex', gap: '4px', fontSize: '11.5px', fontWeight: 600, color: 'var(--text-dim)', marginLeft: '8px' }}>
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
            </div>

            {/* CENTER: View Mode Toggle */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', WebkitAppRegion: 'drag' } as any}>
                <div style={{
                    display: 'flex',
                    background: 'rgba(110, 201, 126, 0.06)',
                    borderRadius: '20px',
                    padding: '2px',
                    border: '1px solid rgba(110, 201, 126, 0.1)',
                    WebkitAppRegion: 'no-drag',
                    gap: '1px'
                } as any}>
                    <button
                        onClick={() => onViewModeChange?.('map')}
                        style={getViewBtnStyle(viewMode === 'map')}
                        title="Vue Carte"
                    >
                        <MapIcon size={13} />
                        Carte
                    </button>
                    <button
                        onClick={() => onViewModeChange?.('text')}
                        style={getViewBtnStyle(viewMode === 'text')}
                        title="Vue Texte"
                    >
                        <Type size={13} />
                        Texte
                    </button>
                    <button
                        onClick={() => onViewModeChange?.(viewMode === 'split' ? 'map' : 'split')}
                        style={{
                            ...getViewBtnStyle(viewMode === 'split'),
                            borderRadius: '18px',
                        }}
                        title="Vue côte à côte"
                    >
                        <Columns size={13} />
                        Side-by-side
                    </button>
                </div>
            </div>

            {/* RIGHT: CONTROLS & WINDOWS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', WebkitAppRegion: 'no-drag' } as any}>
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

            {/* UPDATE MODAL OVERLAY */}
            {updateModal?.show && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px',
                        border: '1px solid var(--accent-default)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        maxWidth: '400px', width: '100%', textAlign: 'center'
                    }}>
                        <h2 style={{ color: '#fff', marginBottom: '12px', fontSize: '18px' }}>Mise à jour disponible</h2>
                        <p style={{ color: 'var(--text-dim)', marginBottom: '24px', fontSize: '14px', lineHeight: 1.5 }}>
                            Une nouvelle version de ScoutRaider est disponible au téléchargement ({updateModal.info?.version || 'Github'}).
                        </p>
                        
                        {updateModal.downloading && (
                            <div style={{ color: 'var(--semantic-green)', marginBottom: '20px', fontWeight: 600 }}>
                                Téléchargement en cours...
                            </div>
                        )}

                        {updateModal.downloaded && (
                            <div style={{ color: 'var(--semantic-green)', marginBottom: '20px', fontWeight: 600 }}>
                                Téléchargement terminé ! L'application va redémarrer.
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            {updateModal.downloaded ? (
                                <button onClick={() => (window as any).electronAPI?.quitAndInstall()} style={{ padding: '8px 16px', background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}>
                                    Installer & Redémarrer
                                </button>
                            ) : (
                                <>
                                    <button disabled={updateModal.downloading} onClick={() => setUpdateModal(null)} style={{ padding: '8px 16px', background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--bg-border)', borderRadius: '6px', cursor: 'pointer' }}>
                                        Plus tard
                                    </button>
                                    <button disabled={updateModal.downloading} onClick={() => {
                                        setUpdateModal({ ...updateModal, downloading: true });
                                        (window as any).electronAPI?.downloadUpdate();
                                    }} style={{ padding: '8px 16px', background: 'var(--accent-default)', color: '#fff', border: 'none', borderRadius: '6px', cursor: updateModal.downloading ? 'default' : 'pointer', fontWeight: 700, opacity: updateModal.downloading ? 0.7 : 1 }}>
                                        Télécharger
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

function getViewBtnStyle(active: boolean): React.CSSProperties {
    return {
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
        padding: '4px 12px',
        borderRadius: '18px',
        border: 'none',
        background: active ? 'var(--accent-default)' : 'transparent',
        color: active ? '#0a0f0c' : 'var(--text-dim)',
        fontSize: '11px',
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
        letterSpacing: '0.02em',
    };
}

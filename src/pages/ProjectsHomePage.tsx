/**
 * ProjectsHomePage.tsx — Page d'accueil des projets ScoutRaider.
 * Route: /projects (nécessite d'être connecté ou invité)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { CloudAuthService, type CloudProjectSummary } from '../logic/CloudAuthService';
import FleurDeLysLogo from '../components/layout/FleurDeLysLogo';
import { version } from '../../package.json';
import {
    Search,
    Plus,
    LogOut,
    FolderOpen,
    RefreshCw,
    Share2,
    Copy,
    Trash2,
    Clock,
    User,
    Globe,
    Lock,
    ChevronDown,
    FileText,
    Loader2,
    Eye,
} from 'lucide-react';

type TabFilter = 'all' | 'mine' | 'shared';

function getGreeting(username: string): string {
    const hour = new Date().getHours();
    const name = username || 'Scout';
    if (hour < 6) return `Bonne nuit, ${name} 🌙`;
    if (hour < 12) return `Bonjour, ${name} 👋`;
    if (hour < 18) return `Bon après-midi, ${name} 👋`;
    return `Bonsoir, ${name} 👋`;
}

function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const diffD = Math.floor(diffH / 24);

    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 2) return 'Hier';
    if (diffD < 7) return `Il y a ${diffD} jours`;
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: diffD > 365 ? 'numeric' : undefined });
}

export default function ProjectsHomePage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isGuest, isLoading, isAuthenticated, logout } = useAuth();

    const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabFilter>('all');
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const loadingRef = useRef(false);

    // Load projects from cloud — silently refreshes without showing spinner if already has data
    const loadProjects = useCallback(async (silent = false) => {
        if (isGuest || !isAuthenticated) return;
        if (loadingRef.current) return; // prevent concurrent fetches
        loadingRef.current = true;
        if (!silent) setLoadingProjects(true);
        setError(null);
        try {
            const list = await CloudAuthService.listProjects();
            setProjects(list);
        } catch (e: any) {
            setError(e.message || 'Impossible de charger les projets.');
        } finally {
            setLoadingProjects(false);
            loadingRef.current = false;
        }
    }, [isGuest, isAuthenticated]);

    // Initial load when auth resolves
    useEffect(() => {
        if (!isLoading) loadProjects();
    }, [isLoading, loadProjects]);

    // Refresh when window regains focus (user comes back from editor tab)
    useEffect(() => {
        const onFocus = () => { if (!isLoading && isAuthenticated && !isGuest) loadProjects(true); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, [isLoading, isAuthenticated, isGuest, loadProjects]);

    // Refresh when page becomes visible (browser tab switch)
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && !isLoading && isAuthenticated && !isGuest) {
                loadProjects(true);
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [isLoading, isAuthenticated, isGuest, loadProjects]);

    // Refresh each time the user navigates back to /projects (location.key changes per visit)
    const prevLocationKey = useRef(location.key);
    useEffect(() => {
        if (location.key !== prevLocationKey.current) {
            prevLocationKey.current = location.key;
            if (!isLoading && isAuthenticated && !isGuest) loadProjects(true);
        }
    }, [location.key, isLoading, isAuthenticated, isGuest, loadProjects]);

    // Filter projects
    const filteredProjects = projects.filter(p => {
        const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
        const matchTab =
            tab === 'all' ||
            (tab === 'mine' && p.is_owner) ||
            (tab === 'shared' && !p.is_owner);
        return matchSearch && matchTab;
    });

    const handleNewProject = () => {
        // Navigate directly to editor — the editor will start with a blank state
        // and auto-save to cloud when the user makes their first edit
        navigate('/d/new');
    };

    const handleOpen = (p: CloudProjectSummary) => {
        const id = p.share_token || p.id;
        navigate(`/d/${id}`);
    };

    const handleCopyLink = (p: CloudProjectSummary) => {
        const id = p.share_token || p.id;
        const url = `${window.location.origin}${window.location.pathname}#/d/${id}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopiedId(p.id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const handleDelete = async (p: CloudProjectSummary) => {
        if (!window.confirm(`Supprimer "${p.title}" ? Cette action est irréversible.`)) return;
        try {
            await CloudAuthService.deleteProject(p.id);
            setProjects(prev => prev.filter(x => x.id !== p.id));
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const handleGuestLogin = () => navigate('/login');

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <div style={s.page}>

            {/* ── Top-right session button ── */}
            <div style={s.sessionCorner}>
                {isGuest ? (
                    <button style={s.sessionBtn} onClick={handleGuestLogin}>
                        <User size={14} />
                        <span>Connexion</span>
                    </button>
                ) : (
                    <div style={{ position: 'relative' }}>
                        <button style={s.sessionBtn} onClick={() => setUserMenuOpen(o => !o)}>
                            <span style={s.avatarInitial}>{(user?.username || '?')[0].toUpperCase()}</span>
                            <span style={s.sessionUser}>{user?.username || ''}</span>
                            <ChevronDown size={12} style={{ color: '#52525B' }} />
                        </button>
                        {userMenuOpen && (
                            <div style={s.userDropdown} onClick={e => e.stopPropagation()}>
                                <button style={s.dropdownItem} onClick={handleLogout}>
                                    <LogOut size={14} /> Déconnexion
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Click-away for user menu */}
            {userMenuOpen && (
                <div style={s.overlay} onClick={() => setUserMenuOpen(false)} />
            )}

            {/* ── Hero wordmark ── */}
            <div style={s.hero}>
                <div style={s.heroLogo}>
                    <FleurDeLysLogo size={64} color="#6EC97E" />
                </div>
                <h1 style={s.heroTitle}>
                    <span style={s.heroScout}>Scout</span><span style={s.heroRaider}>Raider</span>
                    <span style={s.heroVersion}>v{version}</span>
                </h1>
                <p style={s.heroSub}>Suite de cartographie tactique</p>

                {/* Search + new project row */}
                <div style={s.heroRow}>
                    <div style={s.heroSearch}>
                        <Search size={16} style={s.heroSearchIcon} />
                        <input
                            style={s.heroSearchInput}
                            type="text"
                            placeholder="Rechercher un projet…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                        {!isGuest && (
                            <button
                                style={s.heroRefresh}
                                onClick={() => loadProjects(false)}
                                title="Actualiser"
                                disabled={loadingProjects}
                            >
                                <RefreshCw size={14} style={loadingProjects ? { animation: 'spin 0.8s linear infinite' } : {}} />
                            </button>
                        )}
                    </div>
                    <button style={s.newBtn} onClick={handleNewProject}>
                        <Plus size={15} />
                        <span>Nouveau projet</span>
                    </button>
                </div>
            </div>

            {/* ── Main content ── */}
            <main style={s.main}>

                {/* Tabs row */}
                {!isGuest && (
                <div style={s.toolRow}>
                    <div style={s.tabRow}>
                        {(['all', 'mine', 'shared'] as TabFilter[]).map(t => (
                            <button
                                key={t}
                                style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
                                onClick={() => setTab(t)}
                            >
                                {t === 'all' ? 'Tous' : t === 'mine' ? 'Mes projets' : 'Partagés'}
                                {t !== 'all' && (
                                    <span style={s.tabCount}>
                                        {t === 'mine'
                                            ? projects.filter(p => p.is_owner).length
                                            : projects.filter(p => !p.is_owner).length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                )}

                {/* Error */}
                {error && (
                    <div style={s.errorBox}>
                        ⚠ {error}
                        <button style={s.errorClose} onClick={() => setError(null)}>✕</button>
                    </div>
                )}

                {/* Loading */}
                {loadingProjects && (
                    <div style={s.loadingRow}>
                        <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite', color: '#2563EB' }} />
                        <span style={{ color: '#52525B', fontSize: '13px' }}>Chargement…</span>
                    </div>
                )}

                {/* Guest state */}
                {isGuest && !loadingProjects && (
                    <div style={s.emptyState}>
                        <FolderOpen size={36} style={{ color: '#3F3F46', marginBottom: '12px' }} />
                        <p style={s.emptyTitle}>Mode invité</p>
                        <p style={s.emptyHint}>Connectez-vous pour accéder à vos projets cloud et activer la synchronisation.</p>
                        <button style={s.newBtn} onClick={handleGuestLogin}>
                            <User size={14} /> Se connecter
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!isGuest && !loadingProjects && filteredProjects.length === 0 && (
                    <div style={s.emptyState}>
                        <FileText size={36} style={{ color: '#3F3F46', marginBottom: '12px' }} />
                        <p style={s.emptyTitle}>
                            {search ? `Aucun résultat pour "${search}"` : 'Aucun projet pour le moment'}
                        </p>
                        {!search && (
                            <p style={s.emptyHint}>Créez votre premier projet pour commencer.</p>
                        )}
                    </div>
                )}

                {/* Project grid */}
                {!isGuest && !loadingProjects && filteredProjects.length > 0 && (
                    <div style={s.grid}>
                        {filteredProjects.map(p => (
                            <ProjectCard
                                key={p.id}
                                project={p}
                                onOpen={() => handleOpen(p)}
                                onShare={() => navigate(`/d/${p.share_token || p.id}`)}
                                onCopyLink={() => handleCopyLink(p)}
                                onDelete={() => handleDelete(p)}
                                copied={copiedId === p.id}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* CSS */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                .project-card:hover { transform: translateY(-1px); border-color: #3F3F46 !important; }
                .action-btn:hover { background: #27272A !important; color: #FAFAFA !important; }
                .delete-btn:hover { background: rgba(239,68,68,0.1) !important; color: #FCA5A5 !important; }
                .fab-btn:hover { transform: scale(1.06) !important; box-shadow: 0 8px 24px rgba(37,99,235,0.4) !important; }
            `}</style>
        </div>
    );
}

/* ── ProjectCard ─────────────────────────────────────────────────────── */
interface CardProps {
    project: CloudProjectSummary;
    onOpen: () => void;
    onShare: () => void;
    onCopyLink: () => void;
    onDelete: () => void;
    copied: boolean;
}

function ProjectCard({ project: p, onOpen, onCopyLink, onDelete, copied }: CardProps) {
    return (
        <div
            className="project-card"
            style={s.card}
            onClick={onOpen}
        >
            {/* Card preview */}
            <div style={s.cardPreview}>
                <FileText size={32} style={{ color: '#3F3F46' }} />
            </div>

            {/* Card body */}
            <div style={s.cardBody}>
                <div style={s.cardTop}>
                    <span style={s.cardTitle} title={p.title}>{p.title}</span>
                    <div style={s.badgeRow}>
                        {p.is_public
                            ? <span style={{ ...s.badge, ...s.badgePublic }}><Globe size={10} /> Public</span>
                            : <span style={{ ...s.badge, ...s.badgePrivate }}><Lock size={10} /> Privé</span>
                        }
                        {p.role && p.role !== 'owner' && (
                            <span style={{ ...s.badge, ...s.badgeRole }}>
                                {p.role === 'editor' ? '✏ Éditeur' : <><Eye size={10} /> Lecteur</>}
                            </span>
                        )}
                        {p.is_owner && (
                            <span style={{ ...s.badge, ...s.badgeOwner }}>Propriétaire</span>
                        )}
                    </div>
                </div>

                {!p.is_owner && p.owner_username && (
                    <p style={s.ownerLine}>
                        <User size={11} style={{ marginRight: '4px' }} />
                        {p.owner_username}
                    </p>
                )}

                <div style={s.cardFooter}>
                    <span style={s.dateText}>
                        <Clock size={11} style={{ marginRight: '4px' }} />
                        {formatRelativeDate(p.updated_at)}
                    </span>

                    <div style={s.actionRow} onClick={e => e.stopPropagation()}>
                        <button
                            className="action-btn"
                            style={s.actionBtn}
                            title={copied ? 'Lien copié !' : 'Copier le lien'}
                            onClick={onCopyLink}
                        >
                            {copied ? '✓' : <Copy size={13} />}
                        </button>
                        {p.is_owner && (
                            <button
                                className="delete-btn action-btn"
                                style={s.actionBtn}
                                title="Supprimer"
                                onClick={onDelete}
                            >
                                <Trash2 size={13} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Styles ───────────────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#09090B',
        color: '#FAFAFA',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        display: 'flex',
        flexDirection: 'column',
    },

    // ── Session corner (top-right) ──
    sessionCorner: {
        position: 'fixed',
        top: '20px',
        right: '24px',
        zIndex: 200,
    },
    sessionBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        background: '#1C1C21',
        border: '1px solid #27272A',
        borderRadius: '10px',
        padding: '7px 13px',
        color: '#A1A1AA',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 120ms ease',
    },
    sessionUser: {
        color: '#D4D4D8',
        maxWidth: '120px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    } as React.CSSProperties,

    // ── Hero ──
    hero: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '72px',
        paddingBottom: '48px',
        paddingLeft: '24px',
        paddingRight: '24px',
        gap: '0px',
    },
    heroLogo: {
        marginBottom: '16px',
        opacity: 0.9,
    },
    heroTitle: {
        margin: 0,
        fontSize: 'clamp(48px, 10vw, 80px)',
        fontWeight: 800,
        letterSpacing: '-3px',
        lineHeight: 1,
        marginBottom: '10px',
        position: 'relative' as const,
        display: 'inline-block',
    },
    heroScout: {
        color: '#3F3F46',
    },
    heroRaider: {
        color: '#6EC97E',
    },
    heroVersion: {
        position: 'absolute' as const,
        left: '100%',
        bottom: '8px',
        marginLeft: '8px',
        fontSize: '13px',
        fontWeight: 500,
        color: '#3F3F46',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap' as const,
    },
    heroSub: {
        margin: '0 0 28px',
        fontSize: '13px',
        color: '#3F3F46',
        letterSpacing: '0.5px',
        textTransform: 'uppercase' as const,
        fontWeight: 500,
    },
    heroRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        maxWidth: '600px',
    },
    heroSearch: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        flex: 1,
        background: 'transparent',
        border: '1px solid #27272A',
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 120ms ease',
        height: '38px',
    } as React.CSSProperties,
    heroSearchIcon: {
        position: 'absolute',
        left: '12px',
        color: '#3F3F46',
        pointerEvents: 'none',
        flexShrink: 0,
    } as React.CSSProperties,
    heroSearchInput: {
        flex: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        padding: '0 40px 0 36px',
        color: '#A1A1AA',
        fontSize: '13px',
        fontFamily: 'inherit',
        height: '100%',
    },
    heroRefresh: {
        background: 'transparent',
        border: 'none',
        borderLeft: '1px solid #27272A',
        color: '#3F3F46',
        cursor: 'pointer',
        padding: '0 10px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        transition: 'color 120ms ease',
        flexShrink: 0,
    } as React.CSSProperties,

    // ── Main ──
    main: {
        maxWidth: '1200px',
        width: '100%',
        margin: '0 auto',
        padding: '0 24px 80px',
        flex: 1,
    },
    toolRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap' as const,
    },
    tabRow: {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap' as const,
    },
    tabBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: '1px solid #27272A',
        color: '#52525B',
        borderRadius: '8px',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        fontFamily: 'inherit',
    },
    tabBtnActive: {
        background: '#1C1C21',
        border: '1px solid #3F3F46',
        color: '#FAFAFA',
        fontWeight: 600,
    },
    tabCount: {
        background: '#27272A',
        color: '#71717A',
        fontSize: '10px',
        fontWeight: 700,
        borderRadius: '20px',
        padding: '1px 6px',
        fontFamily: "'JetBrains Mono', monospace",
    },
    newBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: '#2563EB',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '10px',
        padding: '0 16px',
        height: '38px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
        transition: 'background 120ms ease',
        fontFamily: 'inherit',
    },

    // ── Feedback ──
    errorBox: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        borderRadius: '10px',
        padding: '10px 14px',
        color: '#FCA5A5',
        fontSize: '13px',
        marginBottom: '20px',
    },
    errorClose: {
        background: 'none',
        border: 'none',
        color: '#FCA5A5',
        cursor: 'pointer',
        fontSize: '14px',
        padding: '0 4px',
    },
    loadingRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '60px 0',
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        textAlign: 'center',
        gap: '8px',
    },
    emptyTitle: {
        fontSize: '15px',
        fontWeight: 600,
        color: '#52525B',
        margin: 0,
    },
    emptyHint: {
        fontSize: '13px',
        color: '#3F3F46',
        marginBottom: '16px',
        maxWidth: '360px',
    },

    // ── Grid & cards ──
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '10px',
        animation: 'fadeIn 0.2s ease',
    },
    card: {
        background: '#121215',
        border: '1px solid #27272A',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s, border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
    },
    cardPreview: {
        height: '64px',
        background: '#1C1C21',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid #27272A',
    },
    cardBody: {
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flex: 1,
    },
    cardTop: {
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
    },
    cardTitle: {
        fontSize: '13px',
        fontWeight: 600,
        color: '#FAFAFA',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
    },
    badgeRow: {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize: '10px',
        fontWeight: 600,
        borderRadius: '4px',
        padding: '2px 6px',
    },
    badgePublic: {
        background: 'rgba(110,201,126,0.08)',
        color: '#6EC97E',
    },
    badgePrivate: {
        background: '#1C1C21',
        color: '#52525B',
    },
    badgeRole: {
        background: 'rgba(99,102,241,0.1)',
        color: '#A5B4FC',
    },
    badgeOwner: {
        background: 'rgba(245,158,11,0.08)',
        color: '#FCD34D',
    },
    ownerLine: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '11px',
        color: '#52525B',
        margin: 0,
    },
    cardFooter: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '4px',
        gap: '8px',
    },
    dateText: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '10px',
        color: '#3F3F46',
        gap: '3px',
        fontFamily: "'JetBrains Mono', monospace",
    },
    actionRow: {
        display: 'flex',
        gap: '3px',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: '#52525B',
        cursor: 'pointer',
        padding: '5px',
        borderRadius: '5px',
        transition: 'background 120ms ease, color 120ms ease',
        fontSize: '12px',
        minWidth: '24px',
        height: '24px',
    },

    // ── Misc ──
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 99,
    },
    userDropdown: {
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        background: '#1C1C21',
        border: '1px solid #27272A',
        borderRadius: '12px',
        padding: '4px',
        minWidth: '160px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
        animation: 'fadeIn 0.15s ease',
        zIndex: 300,
    },
    dropdownItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        background: 'transparent',
        border: 'none',
        color: '#A1A1AA',
        fontSize: '13px',
        padding: '8px 10px',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
    },
    avatarInitial: {
        fontSize: '11px',
        fontWeight: 700,
        color: '#6EC97E',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'rgba(110,201,126,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    } as React.CSSProperties,
    fab: {
        position: 'fixed',
        bottom: '28px',
        right: '28px',
        width: '52px',
        height: '52px',
        borderRadius: '50%',
        background: '#2563EB',
        border: 'none',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(37,99,235,0.35)',
        transition: 'transform 0.15s, box-shadow 0.15s',
        zIndex: 200,
        fontSize: '0',
    },
};

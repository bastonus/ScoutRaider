/**
 * ProjectsHomePage.tsx — Page d'accueil des projets ScoutRaider.
 * Route: /projects (nécessite d'être connecté ou invité)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { CloudAuthService, type CloudProjectSummary } from '../logic/CloudAuthService';
import FleurDeLysLogo from '../components/layout/FleurDeLysLogo';
import {
    Search,
    Plus,
    LogOut,
    FolderOpen,
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
    const { user, isGuest, isLoading, isAuthenticated, logout } = useAuth();

    const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabFilter>('all');
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Load projects from cloud
    const loadProjects = useCallback(async () => {
        if (isGuest || !isAuthenticated) return;
        setLoadingProjects(true);
        setError(null);
        try {
            const list = await CloudAuthService.listProjects();
            setProjects(list);
        } catch (e: any) {
            setError(e.message || 'Impossible de charger les projets.');
        } finally {
            setLoadingProjects(false);
        }
    }, [isGuest, isAuthenticated]);

    useEffect(() => {
        if (!isLoading) loadProjects();
    }, [isLoading, loadProjects]);

    // Filter projects
    const filteredProjects = projects.filter(p => {
        const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
        const matchTab =
            tab === 'all' ||
            (tab === 'mine' && p.is_owner) ||
            (tab === 'shared' && !p.is_owner);
        return matchSearch && matchTab;
    });

    const handleNewProject = async () => {
        setCreating(true);
        const title = `Nouveau projet ${new Date().toLocaleDateString('fr-FR')}`;
        try {
            const saved = await CloudAuthService.saveProject(title, { document_title: title } as any, null);
            navigate(`/d/${saved.id}`);
        } catch (e: any) {
            setError(e.message);
            setCreating(false);
        }
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
            {/* ── Top bar ── */}
            <header style={s.topBar}>
                <div style={s.topBarInner}>
                    {/* Logo */}
                    <div style={s.logoArea}>
                        <div style={s.logoIconWrap}>
                            <FleurDeLysLogo size={28} color="#6EC97E" />
                        </div>
                        <span style={s.logoText}>ScoutRaider</span>
                    </div>

                    {/* Search */}
                    <div style={s.searchWrap}>
                        <Search size={16} style={s.searchIcon} />
                        <input
                            style={s.searchInput}
                            type="text"
                            placeholder="Rechercher un projet…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* User menu */}
                    <div style={s.userArea} onClick={() => setUserMenuOpen(o => !o)}>
                        <div style={s.avatar}>
                            {isGuest
                                ? <User size={16} color="rgba(232,245,235,0.6)" />
                                : <span style={s.avatarInitial}>{(user?.username || '?')[0].toUpperCase()}</span>
                            }
                        </div>
                        <span style={s.userName}>
                            {isGuest ? 'Invité' : (user?.username || '')}
                        </span>
                        <ChevronDown size={14} style={{ color: 'rgba(232,245,235,0.4)' }} />

                        {userMenuOpen && (
                            <div style={s.userDropdown} onClick={e => e.stopPropagation()}>
                                {isGuest ? (
                                    <button style={s.dropdownItem} onClick={handleGuestLogin}>
                                        <User size={14} /> Se connecter
                                    </button>
                                ) : (
                                    <button style={s.dropdownItem} onClick={handleLogout}>
                                        <LogOut size={14} /> Déconnexion
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* ── Main content ── */}
            <main style={s.main}>
                {/* Greeting + new btn */}
                <div style={s.greetingRow}>
                    <div>
                        <h2 style={s.greeting}>
                            {isGuest
                                ? 'Bienvenue, Invité 👋'
                                : getGreeting(user?.username || '')}
                        </h2>
                        {isGuest && (
                            <p style={s.guestHint}>
                                <button style={s.guestLoginLink} onClick={handleGuestLogin}>
                                    Connectez-vous
                                </button>{' '}
                                pour accéder à vos projets cloud.
                            </p>
                        )}
                    </div>
                    {!isGuest && (
                        <button
                            style={{ ...s.newBtn, opacity: creating ? 0.7 : 1 }}
                            onClick={handleNewProject}
                            disabled={creating}
                        >
                            {creating
                                ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                                : <Plus size={16} />}
                            <span>Nouveau projet</span>
                        </button>
                    )}
                </div>

                {/* Tabs */}
                {!isGuest && (
                    <div style={s.tabRow}>
                        {(['all', 'mine', 'shared'] as TabFilter[]).map(t => (
                            <button
                                key={t}
                                style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
                                onClick={() => setTab(t)}
                            >
                                {t === 'all' ? 'Tous' : t === 'mine' ? 'Mes documents' : 'Partagés avec moi'}
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
                        <Loader2 size={22} style={{ animation: 'spin 0.8s linear infinite', color: '#6EC97E' }} />
                        <span style={{ color: 'rgba(232,245,235,0.4)', fontSize: '14px' }}>Chargement…</span>
                    </div>
                )}

                {/* Guest placeholder */}
                {isGuest && !loadingProjects && (
                    <div style={s.emptyState}>
                        <FolderOpen size={48} style={{ color: 'rgba(110,201,126,0.3)', marginBottom: '12px' }} />
                        <p style={s.emptyTitle}>Aucun projet cloud disponible</p>
                        <p style={s.emptyHint}>Connectez-vous pour accéder à vos projets.</p>
                        <button style={s.newBtn} onClick={handleGuestLogin}>
                            <User size={16} /> Se connecter
                        </button>
                    </div>
                )}

                {/* Empty state */}
                {!isGuest && !loadingProjects && filteredProjects.length === 0 && (
                    <div style={s.emptyState}>
                        <FileText size={48} style={{ color: 'rgba(110,201,126,0.3)', marginBottom: '12px' }} />
                        <p style={s.emptyTitle}>
                            {search ? `Aucun résultat pour "${search}"` : 'Aucun projet pour le moment'}
                        </p>
                        {!search && (
                            <p style={s.emptyHint}>Créez votre premier projet pour commencer.</p>
                        )}
                        {!search && (
                            <button style={s.newBtn} onClick={handleNewProject}>
                                <Plus size={16} /> Nouveau projet
                            </button>
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

            {/* Click-away for user menu */}
            {userMenuOpen && (
                <div style={s.overlay} onClick={() => setUserMenuOpen(false)} />
            )}

            {/* CSS for animations */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                .project-card:hover { transform: translateY(-2px); border-color: rgba(110,201,126,0.35) !important; }
                .action-btn:hover { background: rgba(110,201,126,0.12) !important; color: #6EC97E !important; }
                .delete-btn:hover { background: rgba(239,68,68,0.12) !important; color: #fca5a5 !important; }
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
                <FileText size={32} style={{ color: 'rgba(110,201,126,0.4)' }} />
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
        background: '#0d1511',
        color: '#e8f5eb',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
    },
    topBar: {
        background: '#141E18',
        borderBottom: '1px solid rgba(110,201,126,0.12)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
    },
    topBarInner: {
        maxWidth: '1280px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 24px',
    },
    logoArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
    },
    logoIconWrap: {
        width: '36px',
        height: '36px',
        background: 'rgba(110,201,126,0.1)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(110,201,126,0.18)',
    },
    logoText: {
        fontWeight: 700,
        fontSize: '18px',
        color: '#e8f5eb',
        letterSpacing: '-0.3px',
    },
    searchWrap: {
        flex: 1,
        maxWidth: '480px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
    },
    searchIcon: {
        position: 'absolute',
        left: '12px',
        color: 'rgba(232,245,235,0.35)',
        pointerEvents: 'none',
    } as any,
    searchInput: {
        width: '100%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(110,201,126,0.15)',
        borderRadius: '8px',
        padding: '9px 12px 9px 36px',
        color: '#e8f5eb',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
    },
    userArea: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        cursor: 'pointer',
        padding: '6px 10px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(110,201,126,0.12)',
        position: 'relative',
        flexShrink: 0,
        userSelect: 'none',
    },
    avatar: {
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: 'rgba(110,201,126,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(110,201,126,0.25)',
    },
    avatarInitial: {
        fontSize: '13px',
        fontWeight: 700,
        color: '#6EC97E',
    },
    userName: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'rgba(232,245,235,0.8)',
        maxWidth: '120px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    userDropdown: {
        position: 'absolute',
        top: 'calc(100% + 6px)',
        right: 0,
        background: '#1a2820',
        border: '1px solid rgba(110,201,126,0.2)',
        borderRadius: '10px',
        padding: '6px',
        minWidth: '160px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        animation: 'fadeIn 0.15s ease',
        zIndex: 200,
    },
    dropdownItem: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        background: 'transparent',
        border: 'none',
        color: 'rgba(232,245,235,0.75)',
        fontSize: '13px',
        padding: '8px 10px',
        borderRadius: '6px',
        cursor: 'pointer',
        textAlign: 'left',
    },
    overlay: {
        position: 'fixed',
        inset: 0,
        zIndex: 99,
    },
    main: {
        maxWidth: '1280px',
        width: '100%',
        margin: '0 auto',
        padding: '32px 24px',
        flex: 1,
    },
    greetingRow: {
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '16px',
        marginBottom: '28px',
        flexWrap: 'wrap',
    },
    greeting: {
        margin: 0,
        fontSize: 'clamp(20px, 4vw, 28px)',
        fontWeight: 700,
        color: '#e8f5eb',
        letterSpacing: '-0.3px',
    },
    guestHint: {
        margin: '6px 0 0',
        fontSize: '14px',
        color: 'rgba(232,245,235,0.4)',
    },
    guestLoginLink: {
        background: 'none',
        border: 'none',
        color: '#6EC97E',
        cursor: 'pointer',
        fontSize: '14px',
        padding: 0,
        textDecoration: 'underline',
    },
    newBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'linear-gradient(135deg, #6EC97E, #4da85e)',
        color: '#0d1511',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 20px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        flexShrink: 0,
        boxShadow: '0 4px 16px rgba(110,201,126,0.25)',
        transition: 'opacity 0.15s, transform 0.1s',
    },
    tabRow: {
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        flexWrap: 'wrap',
    },
    tabBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: '1px solid rgba(110,201,126,0.12)',
        color: 'rgba(232,245,235,0.5)',
        borderRadius: '8px',
        padding: '7px 16px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    tabBtnActive: {
        background: 'rgba(110,201,126,0.1)',
        border: '1px solid rgba(110,201,126,0.3)',
        color: '#6EC97E',
    },
    tabCount: {
        background: 'rgba(110,201,126,0.15)',
        color: '#6EC97E',
        fontSize: '11px',
        fontWeight: 700,
        borderRadius: '20px',
        padding: '1px 7px',
    },
    errorBox: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: '8px',
        padding: '10px 14px',
        color: '#fca5a5',
        fontSize: '13px',
        marginBottom: '20px',
    },
    errorClose: {
        background: 'none',
        border: 'none',
        color: '#fca5a5',
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
        padding: '80px 24px',
        textAlign: 'center',
        gap: '8px',
    },
    emptyTitle: {
        fontSize: '18px',
        fontWeight: 600,
        color: 'rgba(232,245,235,0.6)',
        margin: 0,
    },
    emptyHint: {
        fontSize: '14px',
        color: 'rgba(232,245,235,0.3)',
        marginBottom: '16px',
    },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '16px',
        animation: 'fadeIn 0.2s ease',
    },
    card: {
        background: '#141E18',
        border: '1px solid rgba(110,201,126,0.15)',
        borderRadius: '12px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.15s, border-color 0.15s',
        display: 'flex',
        flexDirection: 'column',
    },
    cardPreview: {
        height: '80px',
        background: 'rgba(110,201,126,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1px solid rgba(110,201,126,0.08)',
    },
    cardBody: {
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flex: 1,
    },
    cardTop: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    cardTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#e8f5eb',
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
        background: 'rgba(110,201,126,0.12)',
        color: '#6EC97E',
    },
    badgePrivate: {
        background: 'rgba(255,255,255,0.05)',
        color: 'rgba(232,245,235,0.4)',
    },
    badgeRole: {
        background: 'rgba(99,102,241,0.15)',
        color: '#a5b4fc',
    },
    badgeOwner: {
        background: 'rgba(245,158,11,0.12)',
        color: '#fcd34d',
    },
    ownerLine: {
        display: 'flex',
        alignItems: 'center',
        fontSize: '11px',
        color: 'rgba(232,245,235,0.4)',
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
        fontSize: '11px',
        color: 'rgba(232,245,235,0.3)',
        gap: '3px',
    },
    actionRow: {
        display: 'flex',
        gap: '4px',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        color: 'rgba(232,245,235,0.4)',
        cursor: 'pointer',
        padding: '5px',
        borderRadius: '5px',
        transition: 'background 0.12s, color 0.12s',
        fontSize: '12px',
        minWidth: '24px',
        height: '24px',
    },
};

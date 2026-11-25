/**
 * ProjectsHomePage.tsx — Page d'accueil des projets ScoutRaider.
 * Route: /projects (nécessite d'être connecté ou invité)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { CloudAuthService, type CloudProjectSummary } from '../logic/CloudAuthService';
import ShareModal from '../components/panels/ShareModal';
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
    Boxes,
    Code,
    Compass,
    BookmarkCheck,
    Download,
    Settings,
    Tag,
    Check,
    Sliders,
    Sparkles,
    Cloud,
    CloudUpload,
    ExternalLink
} from 'lucide-react';
import { ModuleManagementService, ManagedModule } from '../logic/ModuleManagementService';
import ModuleEditorModal from '../components/panels/ModuleEditorModal';
import ConfirmDialog from '../components/common/ConfirmDialog';

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
    const { user, isGuest, isLoading, isAuthenticated, logout, newProject } = useAuth();

    const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabFilter>('all');
    const [search, setSearch] = useState('');
    const [creating, setCreating] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [shareTarget, setShareTarget] = useState<CloudProjectSummary | null>(null);
    const loadingRef = useRef(false);

    // ── Module Management State ──
    const [activeSection, setActiveSection] = useState<'projects' | 'modules'>('projects');
    const [moduleSearch, setModuleSearch] = useState('');
    const [moduleFilter, setModuleFilter] = useState<'all' | 'private' | 'public' | 'library' | 'crypto' | 'routing'>('all');
    const [modulesList, setModulesList] = useState<ManagedModule[]>(() => ModuleManagementService.getAllModules());
    const [moduleEditorOpen, setModuleEditorOpen] = useState(false);
    const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

    const refreshModules = useCallback(() => {
        setModulesList(ModuleManagementService.getAllModules());
    }, []);

    const handleToggleModulePublic = (modId: string) => {
        ModuleManagementService.togglePublicStatus(modId);
        refreshModules();
    };

    const handleToggleModuleLibrary = (modId: string) => {
        ModuleManagementService.toggleLibraryActive(modId);
        refreshModules();
    };

    const [confirmState, setConfirmState] = useState<{
        title: string;
        message: string;
        confirmLabel: string;
        onConfirm: () => void;
    } | null>(null);

    const handleDeleteModule = (modId: string) => {
        const mod = modulesList.find(m => m.id === modId);
        setConfirmState({
            title: `Supprimer « ${mod?.name || modId} » ?`,
            message: 'Ce module personnalisé sera définitivement supprimé de votre espace local.',
            confirmLabel: 'Supprimer le module',
            onConfirm: () => {
                ModuleManagementService.deleteCustomModule(modId);
                refreshModules();
                setConfirmState(null);
            },
        });
    };

    const [s3Toast, setS3Toast] = useState<{ message: string; isError?: boolean } | null>(null);

    const handlePublishModuleS3 = async (modId: string) => {
        const mod = modulesList.find(m => m.id === modId);
        if (!mod) return;
        setS3Toast({ message: `Téléversement du module ${mod.name} vers Garage S3...` });
        const res = await ModuleManagementService.publishModuleToS3(mod);
        if (res.success) {
            setS3Toast({ message: `✓ Module ${mod.name} enregistré et publié sur S3 Garage (${res.s3_url})` });
            refreshModules();
        } else {
            setS3Toast({ message: `❌ Échec publication S3: ${res.error}`, isError: true });
        }
        setTimeout(() => setS3Toast(null), 4000);
    };

    const filteredModules = useMemo(() => {
        return modulesList.filter(m => {
            if (moduleFilter === 'private' && m.is_public) return false;
            if (moduleFilter === 'public' && !m.is_public) return false;
            if (moduleFilter === 'library' && !ModuleManagementService.isInLibrary(m.id)) return false;
            if (moduleFilter === 'crypto' && m.resource_type !== 'crypto_module') return false;
            if (moduleFilter === 'routing' && m.resource_type !== 'routing_engine' && m.resource_type !== 'path_provider') return false;

            if (moduleSearch.trim()) {
                const q = moduleSearch.toLowerCase();
                const matchName = m.name.toLowerCase().includes(q);
                const matchId = m.id.toLowerCase().includes(q);
                const matchDesc = m.description.toLowerCase().includes(q);
                const matchCap = (m.data_capability || '').toLowerCase().includes(q);
                const matchTag = (m.tags || []).some(t => t.toLowerCase().includes(q));
                if (!matchName && !matchId && !matchDesc && !matchCap && !matchTag) return false;
            }
            return true;
        });
    }, [modulesList, moduleFilter, moduleSearch]);

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
        newProject();
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

    const handleDelete = (p: CloudProjectSummary) => {
        setConfirmState({
            title: `Supprimer « ${p.title} » ?`,
            message: 'Ce projet et son contenu cloud seront définitivement supprimés. Cette action est irréversible.',
            confirmLabel: 'Supprimer le projet',
            onConfirm: async () => {
                setConfirmState(null);
                try {
                    await CloudAuthService.deleteProject(p.id);
                    setProjects(prev => prev.filter(x => x.id !== p.id));
                } catch (e: any) {
                    setError(e.message);
                }
            },
        });
    };

    const handleLogout = () => {
        logout();
        navigate('/login', { replace: true });
    };

    const handleGuestLogin = () => navigate('/login');

    // ── Render ───────────────────────────────────────────────────────────
    return (
        <div style={s.page}>
            {/* Click-away for user menu */}
            {userMenuOpen && (
                <div style={s.overlay} onClick={() => setUserMenuOpen(false)} />
            )}

            {/* ── Top Navigation Bar (Left-aligned brand, right-aligned Marketplace + Session) ── */}
            <header style={{
                height: '56px',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-dark)',
                padding: '0 clamp(16px, 3vw, 32px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                position: 'sticky',
                top: 0,
                zIndex: 100,
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <FleurDeLysLogo size={26} color="var(--accent-primary)" />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                        ScoutRaider
                    </span>
                    <span className="tabular-nums" style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--text-dim)',
                        fontFamily: 'var(--font-mono)',
                        padding: '1px 6px',
                        borderRadius: '6px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        v{version}
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                        type="button"
                        className="sr-btn-secondary"
                        onClick={() => navigate('/marketplace')}
                        title="Ouvrir la Marketplace (cartes, modules, trames et thèmes)"
                    >
                        <Boxes size={14} color="var(--text-dim)" aria-hidden="true" />
                        <span>Marketplace</span>
                    </button>

                    {isGuest ? (
                        <button type="button" className="sr-btn-secondary" onClick={handleGuestLogin}>
                            <User size={14} aria-hidden="true" />
                            <span>Connexion</span>
                        </button>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                className="sr-btn-secondary"
                                onClick={() => setUserMenuOpen(o => !o)}
                                aria-expanded={userMenuOpen}
                                aria-haspopup="menu"
                                style={{ padding: '0 10px 0 6px' }}
                            >
                                <span style={s.avatarInitial}>{(user?.username || '?')[0].toUpperCase()}</span>
                                <span style={s.sessionUser}>{user?.username || ''}</span>
                                <ChevronDown size={12} color="var(--text-dim)" aria-hidden="true" />
                            </button>
                            {userMenuOpen && (
                                <div role="menu" style={s.userDropdown} onClick={e => e.stopPropagation()}>
                                    <button type="button" role="menuitem" style={s.dropdownItem} onClick={handleLogout}>
                                        <LogOut size={14} aria-hidden="true" /> Déconnexion
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </header>

            {/* ── Main Workspace (Left-aligned, Grid-based) ── */}
            <main style={{
                maxWidth: '1360px',
                width: '100%',
                margin: '0 auto',
                padding: 'clamp(20px, 3vw, 32px) clamp(16px, 3vw, 32px) 64px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
            }}>
                {/* Workspace Title & Primary Action */}
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <h1 style={{ margin: 0, fontSize: 'clamp(20px, 2.5vw, 24px)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                            Raids & Carnets
                        </h1>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-dim)' }}>
                            {isGuest
                                ? 'Mode invité — connectez-vous pour synchroniser vos carnets dans le cloud.'
                                : getGreeting(user?.username || '')}
                        </p>
                    </div>

                    <button
                        type="button"
                        className="sr-btn-primary sr-pressable"
                        onClick={handleNewProject}
                        style={{ height: '36px', padding: '0 16px', fontSize: '12.5px' }}
                    >
                        <Plus size={15} aria-hidden="true" />
                        <span>Nouveau projet</span>
                    </button>
                </div>

                {/* Filter Tabs & Search Row */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    paddingBottom: '12px',
                    borderBottom: '1px solid var(--border-subtle)',
                }}>
                    {!isGuest ? (
                        <div role="tablist" aria-label="Filtrer les projets" style={s.tabRow}>
                            {(['all', 'mine', 'shared'] as TabFilter[]).map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === t}
                                    style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
                                    onClick={() => setTab(t)}
                                >
                                    <span>{t === 'all' ? 'Tous' : t === 'mine' ? 'Mes projets' : 'Partagés'}</span>
                                    <span className="tabular-nums" style={s.tabCount}>
                                        {t === 'all'
                                            ? projects.length
                                            : t === 'mine'
                                            ? projects.filter(p => p.is_owner).length
                                            : projects.filter(p => !p.is_owner).length}
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : <div />}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 240px', maxWidth: '360px', marginLeft: 'auto' }}>
                        <div style={{ ...s.heroSearch, height: '34px' }}>
                            <Search size={14} style={s.heroSearchIcon} aria-hidden="true" />
                            <input
                                style={s.heroSearchInput}
                                type="text"
                                aria-label="Rechercher un projet ou raid"
                                placeholder="Rechercher un projet…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                            {!isGuest && (
                                <button
                                    type="button"
                                    style={s.heroRefresh}
                                    onClick={() => loadProjects(false)}
                                    title="Actualiser les projets"
                                    aria-label="Actualiser les projets"
                                    disabled={loadingProjects}
                                >
                                    <RefreshCw size={13} className={loadingProjects ? "spin" : ""} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div role="alert" style={s.errorBox}>
                        <span>{error}</span>
                        <button type="button" aria-label="Fermer l'erreur" style={s.errorClose} onClick={() => setError(null)}>✕</button>
                    </div>
                )}

                {/* Loading */}
                {loadingProjects && (
                    <div role="status" style={s.loadingRow}>
                        <Loader2 size={18} className="spin" style={{ color: 'var(--accent-primary)' }} aria-hidden="true" />
                        <span style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Chargement des projets…</span>
                    </div>
                )}

                {/* Guest state */}
                {isGuest && !loadingProjects && (
                    <div style={{
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: '12px',
                        padding: '32px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '10px',
                        background: 'var(--bg-surface)',
                    }}>
                        <FolderOpen size={24} color="var(--text-dim)" aria-hidden="true" />
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Espace cloud non connecté
                        </div>
                        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-dim)', maxWidth: '460px', lineHeight: 1.5 }}>
                            Connectez-vous pour retrouver vos raids enregistrés ou créez un nouveau projet local dès maintenant.
                        </p>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                            <button type="button" className="sr-btn-primary" onClick={handleGuestLogin}>
                                <User size={14} aria-hidden="true" /> Se connecter
                            </button>
                            <button type="button" className="sr-btn-secondary" onClick={handleNewProject}>
                                <Plus size={14} aria-hidden="true" /> Créer en local
                            </button>
                        </div>
                    </div>
                )}

                {/* Empty state */}
                {!isGuest && !loadingProjects && filteredProjects.length === 0 && (
                    <div style={{
                        border: '1px dashed var(--border-subtle)',
                        borderRadius: '12px',
                        padding: '32px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '10px',
                        background: 'var(--bg-surface)',
                    }}>
                        <FileText size={24} color="var(--text-dim)" aria-hidden="true" />
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {search ? `Aucun résultat pour « ${search} »` : 'Aucun carnet de raid pour le moment'}
                        </div>
                        <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-dim)', maxWidth: '420px', lineHeight: 1.5 }}>
                            {search
                                ? 'Essayez un autre mot-clé ou réinitialisez la recherche.'
                                : 'Créez votre premier itinéraire pour tracer votre parcours et générer le carnet.'}
                        </p>
                        {search ? (
                            <button type="button" className="sr-btn-secondary" onClick={() => setSearch('')}>
                                Effacer la recherche
                            </button>
                        ) : (
                            <button type="button" className="sr-btn-primary" onClick={handleNewProject}>
                                <Plus size={14} aria-hidden="true" /> Nouveau projet
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
                                onShare={() => setShareTarget(p)}
                                onCopyLink={() => handleCopyLink(p)}
                                onDelete={() => handleDelete(p)}
                                copied={copiedId === p.id}
                            />
                        ))}
                    </div>
                )}
                {/* Share Modal */}
                {shareTarget && (
                    <ShareModal
                        projectId={shareTarget.id}
                        projectTitle={shareTarget.title}
                        onClose={() => {
                            setShareTarget(null);
                            loadProjects(true);
                        }}
                    />
                )}

                {/* Module Editor Modal */}
                {moduleEditorOpen && (
                    <ModuleEditorModal
                        activeModuleId={editingModuleId}
                        onClose={() => setModuleEditorOpen(false)}
                        onSaved={() => {
                            refreshModules();
                            setModuleEditorOpen(false);
                        }}
                    />
                )}
                {/* Confirmation Dialog */}
                {confirmState && (
                    <ConfirmDialog
                        title={confirmState.title}
                        message={confirmState.message}
                        confirmLabel={confirmState.confirmLabel}
                        onConfirm={confirmState.onConfirm}
                        onCancel={() => setConfirmState(null)}
                    />
                )}
            </main>

            {/* CSS */}
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
                @media (hover: hover) {
                    .project-card:hover { border-color: #3F3F46 !important; }
                    .action-btn:hover { background: #27272A !important; color: #FAFAFA !important; }
                    .delete-btn:hover { background: rgba(239,68,68,0.12) !important; color: #FCA5A5 !important; }
                }
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
        <article className="sr-card">
            {/* Card preview + open action */}
            <button
                type="button"
                onClick={onOpen}
                aria-label={`Ouvrir le projet ${p.title}`}
                style={{
                    ...s.cardPreview,
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid #27272A',
                    cursor: 'pointer',
                    padding: 0,
                }}
            >
                <FileText size={32} aria-hidden="true" style={{ color: 'var(--text-dim)' }} />
            </button>

            {/* Card body */}
            <div style={s.cardBody}>
                <div style={s.cardTop}>
                    <button
                        type="button"
                        onClick={onOpen}
                        style={{
                            ...s.cardTitle,
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            textAlign: 'start',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            width: '100%',
                        }}
                        title={p.title}
                    >
                        {p.title}
                    </button>
                    <div style={s.badgeRow}>
                        {p.is_public
                            ? <span style={{ ...s.badge, ...s.badgePublic }}><Globe size={10} aria-hidden="true" /> Public</span>
                            : <span style={{ ...s.badge, ...s.badgePrivate }}><Lock size={10} aria-hidden="true" /> Privé</span>
                        }
                        {p.role && p.role !== 'owner' && (
                            <span style={{ ...s.badge, ...s.badgeRole }}>
                                {p.role === 'editor' ? 'Éditeur' : <><Eye size={10} aria-hidden="true" /> Lecteur</>}
                            </span>
                        )}
                        {p.is_owner && (
                            <span style={{ ...s.badge, ...s.badgeOwner }}>Propriétaire</span>
                        )}
                    </div>
                </div>

                {!p.is_owner && p.owner_username && (
                    <p style={s.ownerLine}>
                        <User size={11} aria-hidden="true" style={{ marginRight: '4px' }} />
                        {p.owner_username}
                    </p>
                )}

                <div style={s.cardFooter}>
                    <span className="tabular-nums" style={s.dateText}>
                        <Clock size={11} aria-hidden="true" style={{ marginRight: '4px' }} />
                        {formatRelativeDate(p.updated_at)}
                    </span>

                    <div style={s.actionRow}>
                        <button
                            type="button"
                            className="action-btn"
                            style={s.actionBtn}
                            title={copied ? 'Lien copié' : 'Copier le lien de partage'}
                            aria-label={copied ? 'Lien copié' : `Copier le lien de ${p.title}`}
                            onClick={onCopyLink}
                        >
                            {copied ? <Check size={13} aria-hidden="true" style={{ color: 'var(--semantic-green)' }} /> : <Copy size={13} aria-hidden="true" />}
                        </button>
                        {p.is_owner && (
                            <button
                                type="button"
                                className="delete-btn action-btn"
                                style={s.actionBtn}
                                title="Supprimer le projet"
                                aria-label={`Supprimer ${p.title}`}
                                onClick={onDelete}
                            >
                                <Trash2 size={13} aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}

/* ── ManagedModuleCard (Hub v2 Standard) ─────────────────────────────────── */
interface ManagedModuleCardProps {
    module: ManagedModule;
    onEdit: () => void;
    onTogglePublic: () => void;
    onToggleLibrary: () => void;
    onExport: () => void;
    onPublishS3?: () => void;
    onDelete?: () => void;
}

function ManagedModuleCard({
    module: m,
    onEdit,
    onTogglePublic,
    onToggleLibrary,
    onExport,
    onPublishS3,
    onDelete,
}: ManagedModuleCardProps) {
    const inLib = ModuleManagementService.isInLibrary(m.id);
    const color = m.color || '#3b82f6';

    return (
        <div
            className="project-card"
            style={{
                ...s.card,
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '200px',
                background: '#12131A',
                border: '1px solid #27272A',
                borderRadius: '14px',
                transition: 'all 0.15s ease'
            }}
        >
            <div>
                {/* Header: Icon, Name, Version, Public/Private badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: `${color}18`, border: `1px solid ${color}35`,
                            color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {m.resource_type === 'routing_engine' ? <Compass size={17} /> :
                             m.resource_type === 'path_provider' ? <FileText size={17} /> :
                             <Code size={17} />}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: 700, color: '#f4f4f5' }}>{m.name}</h3>
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#71717a' }}>v{m.version}</span>
                            </div>
                            <span style={{ fontSize: '11px', color: '#a1a1aa', fontFamily: 'monospace' }}>{m.id}</span>
                        </div>
                    </div>

                    {/* Toggle Public / Private */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onTogglePublic(); }}
                        title={m.is_public ? 'Module Public (cliquer pour rendre privé)' : 'Module Privé (cliquer pour rendre public)'}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '3px 8px', borderRadius: '6px', cursor: 'pointer',
                            fontSize: '11px', fontWeight: 600, border: 'none',
                            background: m.is_public ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: m.is_public ? '#34d399' : '#fbbf24',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {m.is_public ? <Globe size={11} /> : <Lock size={11} />}
                        <span>{m.is_public ? 'Public' : 'Privé'}</span>
                    </button>
                </div>

                {/* Capability & Type Tags */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '12px 0 10px', alignItems: 'center' }}>
                    {m.data_capability && (
                        <span style={{
                            fontSize: '10.5px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                            background: 'rgba(255, 255, 255, 0.05)', color: '#93c5fd',
                            border: '1px solid rgba(255, 255, 255, 0.08)'
                        }}>
                            {m.data_capability}
                        </span>
                    )}
                    <span style={{
                        fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.03)', color: '#a1a1aa',
                        border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                        {m.resource_type}
                    </span>
                    {m.is_builtin && (
                        <span style={{
                            fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.08)', color: '#6ee7b7'
                        }}>
                            Socle Standard
                        </span>
                    )}
                    {m.s3_url && (
                        <a
                            href={m.s3_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Télécharger le package S3: ${m.s3_url}`}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '6px',
                                background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.25)', textDecoration: 'none'
                            }}
                        >
                            <Cloud size={10} />
                            <span>S3 Garage</span>
                            <ExternalLink size={9} />
                        </a>
                    )}
                </div>

                {/* Description */}
                <p style={{
                    margin: '0', fontSize: '12px', color: '#9ca3af', lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                }}>
                    {m.description}
                </p>
            </div>

            {/* Footer: Library status toggle + Action buttons */}
            <div style={{
                marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
            }}>
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleLibrary(); }}
                    title={inLib ? 'Actif dans votre carnet de route (cliquer pour désactiver)' : 'Désactivé (cliquer pour inclure)'}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600,
                        background: inLib ? 'var(--accent-transparent)' : 'var(--bg-surface)',
                        border: inLib ? '1px solid var(--accent-default)' : '1px solid var(--border-subtle)',
                        color: inLib ? 'var(--accent-hover)' : 'var(--text-dim)'
                    }}
                >
                    <BookmarkCheck size={13} strokeWidth={inLib ? 2.5 : 1.8} />
                    <span>{inLib ? 'Dans la bibliothèque' : 'Inactif'}</span>
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                        onClick={(e) => { e.stopPropagation(); onExport(); }}
                        title="Exporter le manifeste JSON"
                        style={{
                            width: '30px', height: '30px', borderRadius: '7px', border: '1px solid #27272a',
                            background: '#18181b', color: '#a1a1aa', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                    >
                        <Download size={13} />
                    </button>
                    {onPublishS3 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPublishS3(); }}
                            title={m.s3_url ? `Republier/Mettre à jour sur S3 Garage (${m.s3_url})` : 'Enregistrer et publier sur le bucket S3 Garage'}
                            style={{
                                width: '30px', height: '30px', borderRadius: '7px',
                                border: m.s3_url ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid #27272a',
                                background: m.s3_url ? 'rgba(56, 189, 248, 0.12)' : '#18181b',
                                color: m.s3_url ? '#38bdf8' : '#a1a1aa',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <CloudUpload size={13} />
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        title="Modifier et configurer"
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            padding: '5px 11px', borderRadius: '7px', border: '1px solid #3f3f46',
                            background: '#27272a', color: '#f4f4f5', cursor: 'pointer',
                            fontSize: '11.5px', fontWeight: 600
                        }}
                    >
                        <span>Gérer</span>
                    </button>
                    {onDelete && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(); }}
                            title="Supprimer ce module personnalisé"
                            style={{
                                width: '30px', height: '30px', borderRadius: '7px', border: '1px solid rgba(239,68,68,0.3)',
                                background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
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
        paddingTop: 'clamp(48px, 8vw, 72px)',
        paddingBottom: 'clamp(28px, 5vw, 48px)',
        paddingLeft: 'clamp(16px, 4vw, 24px)',
        paddingRight: 'clamp(16px, 4vw, 24px)',
        gap: '0px',
    },
    heroLogo: {
        marginBottom: '16px',
        opacity: 0.95,
    },
    heroTitle: {
        margin: 0,
        fontSize: 'clamp(36px, 9vw, 72px)',
        fontWeight: 800,
        letterSpacing: '-0.03em',
        lineHeight: 1.05,
        marginBottom: '10px',
        position: 'relative' as const,
        display: 'inline-block',
    },
    heroScout: {
        color: 'var(--text-primary)',
    },
    heroRaider: {
        color: 'var(--accent-hover)',
    },
    heroVersion: {
        position: 'absolute' as const,
        left: '100%',
        bottom: '8px',
        marginLeft: '8px',
        fontSize: '12px',
        fontWeight: 500,
        color: 'var(--text-dim)',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap' as const,
    },
    heroSub: {
        margin: '0 0 24px',
        fontSize: '12px',
        color: 'var(--text-dim)',
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        fontWeight: 500,
        textAlign: 'center',
    },
    heroRow: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap' as const,
        gap: '8px',
        width: '100%',
        maxWidth: '600px',
    },
    heroSearch: {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        flex: '1 1 240px',
        minWidth: 0,
        background: 'var(--bg-surface)',
        border: '1px solid #27272A',
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 120ms ease',
        height: '38px',
    } as React.CSSProperties,
    heroSearchIcon: {
        position: 'absolute',
        left: '12px',
        color: 'var(--text-dim)',
        pointerEvents: 'none',
        flexShrink: 0,
    } as React.CSSProperties,
    heroSearchInput: {
        flex: 1,
        minWidth: 0,
        background: 'transparent',
        border: 'none',
        padding: '0 40px 0 36px',
        color: 'var(--text-primary)',
        fontSize: '13px',
        fontFamily: 'inherit',
        height: '100%',
    },
    heroRefresh: {
        background: 'transparent',
        border: 'none',
        borderLeft: '1px solid #27272A',
        color: 'var(--text-dim)',
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
        padding: '0 clamp(16px, 3vw, 24px) 80px',
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
        boxShadow: 'none',
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
        gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 275px), 1fr))',
        gridAutoRows: 'max-content',
        gap: 'clamp(12px, 1.5vw, 16px)',
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
        background: 'var(--accent-transparent)',
        color: 'var(--accent-hover)',
    },
    badgePrivate: {
        background: '#1C1C21',
        color: 'var(--text-dim)',
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
        color: 'var(--text-dim)',
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
        fontSize: '10.5px',
        color: 'var(--text-dim)',
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
        color: 'var(--text-dim)',
        cursor: 'pointer',
        padding: '5px',
        borderRadius: '5px',
        transition: 'background 120ms ease, color 120ms ease',
        fontSize: '12px',
        minWidth: '28px',
        height: '28px',
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
        color: 'var(--accent-hover)',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: 'var(--accent-transparent)',
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

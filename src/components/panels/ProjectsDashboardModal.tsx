import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, FolderOpen, Plus, Search, Calendar, User, Trash2, 
    Share2, Link, Check, RefreshCw, FileText, Globe, Lock,
    Clock, ShieldCheck, Eye, Edit3
} from 'lucide-react';
import { CloudAuthService, type CloudProjectSummary } from '../../logic/CloudAuthService';
import { useAuth } from '../../AuthContext';
import { useApp } from '../../AppContext';
import { StateManager } from '../../logic/StateManager';
import ShareModal from './ShareModal';

interface ProjectsDashboardModalProps {
    onClose: () => void;
}

type TabType = 'all' | 'owned' | 'shared';

export default function ProjectsDashboardModal({ onClose }: ProjectsDashboardModalProps) {
    const { user, loadFromCloud, cloudProjectId } = useAuth();
    const { dispatch } = useApp();

    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [shareModalTarget, setShareModalTarget] = useState<{ id: string; title: string } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchProjects = async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await CloudAuthService.listProjects();
            setProjects(list);
        } catch (err: any) {
            setError(err.message || 'Impossible de charger la liste des documents.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            // Tab filter
            if (activeTab === 'owned' && !p.is_owner) return false;
            if (activeTab === 'shared' && p.is_owner) return false;

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = (p.title || '').toLowerCase().includes(q);
                const ownerMatch = (p.owner_username || '').toLowerCase().includes(q);
                return titleMatch || ownerMatch;
            }
            return true;
        });
    }, [projects, activeTab, searchQuery]);

    const handleOpen = async (project: CloudProjectSummary) => {
        await loadFromCloud(project.id);
        onClose();
    };

    const handleNewDocument = () => {
        const freshState = StateManager.getInitialState();
        freshState.document_title = 'Document sans titre';
        dispatch({ type: 'LOAD_PROJECT', state: freshState });
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouveau document vierge créé.', notifType: 'info' });
        onClose();
    };

    const handleDelete = async (project: CloudProjectSummary, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Supprimer définitivement le document « ${project.title} » ?`)) {
            return;
        }
        try {
            await CloudAuthService.deleteProject(project.id);
            setProjects(prev => prev.filter(p => p.id !== project.id));
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Document supprimé.', notifType: 'info' });
        } catch (err: any) {
            dispatch({ type: 'ADD_NOTIFICATION', message: err.message || 'Erreur de suppression.', notifType: 'error' });
        }
    };

    const handleCopyPermalink = (project: CloudProjectSummary, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!project.share_token) return;
        const base = typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file:')
            ? window.location.origin
            : 'https://scoutraider.silverhorse.fr';
        const url = `${base}/?doc=${project.share_token}`;
        navigator.clipboard.writeText(url);
        setCopiedId(project.id);
        setTimeout(() => setCopiedId(null), 2500);
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Lien copié dans le presse-papier !', notifType: 'info' });
    };

    const formatDate = (isoString?: string) => {
        if (!isoString) return 'Récemment';
        try {
            const d = new Date(isoString);
            return d.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return isoString;
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 0 : '24px'
        }}>
            <div style={{
                background: 'var(--bg-elevated)',
                border: isMobile ? 'none' : '1px solid var(--border-subtle)',
                borderRadius: isMobile ? 0 : 'var(--radius-md)',
                width: '100%',
                maxWidth: isMobile ? '100vw' : '960px',
                height: isMobile ? '100dvh' : '85vh',
                maxHeight: isMobile ? '100dvh' : '800px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
                color: 'var(--text-default)',
                fontFamily: 'var(--font-ui)'
            }}>
                {/* Header Documents Workspace */}
                <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    background: 'var(--bg-panel)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-primary)'
                        }}>
                            <FileText size={18} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                                Documents ScoutRaider
                            </h2>
                            <p style={{ margin: '1px 0 0', fontSize: '11px', color: 'var(--text-dim)' }}>
                                Raids, parcours cartographiques et documents partagés
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={handleNewDocument}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'var(--accent-primary)',
                                color: 'var(--accent-primary-text)',
                                border: '1px solid var(--accent-primary)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '0 12px',
                                height: '28px',
                                fontSize: '12px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 100ms ease'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-primary-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-primary)'}
                        >
                            <Plus size={14} />
                            Nouveau document
                        </button>

                        <button
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-dim)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Sub-header Controls: Search + Tabs */}
                <div style={{
                    padding: '10px 20px',
                    borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    background: 'var(--bg-dark)'
                }}>
                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px',
                        gap: '2px'
                    }}>
                        <button
                            onClick={() => setActiveTab('all')}
                            style={{
                                background: activeTab === 'all' ? 'var(--bg-elevated)' : 'transparent',
                                color: activeTab === 'all' ? 'var(--text-primary)' : 'var(--text-dim)',
                                border: `1px solid ${activeTab === 'all' ? 'var(--border-subtle)' : 'transparent'}`,
                                borderRadius: 'var(--radius-xs)',
                                padding: '3px 10px',
                                fontSize: '11.5px',
                                fontWeight: activeTab === 'all' ? 600 : 400,
                                cursor: 'pointer',
                                boxShadow: activeTab === 'all' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 100ms ease'
                            }}
                        >
                            Tous ({projects.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('owned')}
                            style={{
                                background: activeTab === 'owned' ? 'var(--bg-elevated)' : 'transparent',
                                color: activeTab === 'owned' ? 'var(--text-primary)' : 'var(--text-dim)',
                                border: `1px solid ${activeTab === 'owned' ? 'var(--border-subtle)' : 'transparent'}`,
                                borderRadius: 'var(--radius-xs)',
                                padding: '3px 10px',
                                fontSize: '11.5px',
                                fontWeight: activeTab === 'owned' ? 600 : 400,
                                cursor: 'pointer',
                                boxShadow: activeTab === 'owned' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 100ms ease'
                            }}
                        >
                            Mes documents ({projects.filter(p => p.is_owner).length})
                        </button>
                        <button
                            onClick={() => setActiveTab('shared')}
                            style={{
                                background: activeTab === 'shared' ? 'var(--bg-elevated)' : 'transparent',
                                color: activeTab === 'shared' ? 'var(--text-primary)' : 'var(--text-dim)',
                                border: `1px solid ${activeTab === 'shared' ? 'var(--border-subtle)' : 'transparent'}`,
                                borderRadius: 'var(--radius-xs)',
                                padding: '3px 10px',
                                fontSize: '11.5px',
                                fontWeight: activeTab === 'shared' ? 600 : 400,
                                cursor: 'pointer',
                                boxShadow: activeTab === 'shared' ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 100ms ease'
                            }}
                        >
                            Partagés ({projects.filter(p => !p.is_owner).length})
                        </button>
                    </div>

                    {/* Search & Refresh */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '0 8px',
                            height: '28px',
                            width: '220px'
                        }}>
                            <Search size={13} color="var(--text-dim)" style={{ marginRight: '6px' }} />
                            <input
                                type="text"
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: 'var(--text-primary)',
                                    fontSize: '11.5px',
                                    width: '100%'
                                }}
                            />
                        </div>

                        <button
                            onClick={fetchProjects}
                            title="Actualiser"
                            style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-dim)',
                                borderRadius: 'var(--radius-sm)',
                                width: '28px',
                                height: '28px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 100ms ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--text-primary)';
                                e.currentTarget.style.borderColor = 'var(--border-strong)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--text-dim)';
                                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            }}
                        >
                            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Body / Document Grid */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: isMobile ? '14px' : '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                }}>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#8BA594' }}>
                            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px', display: 'block' }} />
                            Chargement de vos documents...
                        </div>
                    ) : error ? (
                        <div style={{
                            padding: '16px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            borderRadius: '10px',
                            color: '#FCA5A5',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '60px 0',
                            color: '#8BA594'
                        }}>
                            <FileText size={48} strokeWidth={1.2} style={{ marginBottom: '16px', opacity: 0.5 }} />
                            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#D0DDD5', margin: '0 0 6px' }}>
                                {searchQuery ? 'Aucun document correspondant' : 'Aucun document dans cet espace'}
                            </h3>
                            <p style={{ fontSize: '13px', margin: '0 0 20px', maxWidth: '380px', textAlign: 'center' }}>
                                {searchQuery 
                                    ? `Aucun document ne contient « ${searchQuery} ». Essayez un autre terme.`
                                    : 'Créez un nouveau document ou commencez à enregistrer vos étapes de raid pour les retrouver ici.'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={handleNewDocument}
                                    style={{
                                        background: '#238636',
                                        color: '#FFF',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '10px 20px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    <Plus size={16} />
                                    Créer mon premier document
                                </button>
                            )}
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))',
                            gap: '14px'
                        }}>
                            {filteredProjects.map((p) => {
                                const isCurrent = cloudProjectId === p.id;
                                const isCopied = copiedId === p.id;

                                return (
                                    <div
                                        key={p.id}
                                        onClick={() => handleOpen(p)}
                                        style={{
                                            background: isCurrent ? '#192C20' : '#111A14',
                                            border: `1px solid ${isCurrent ? '#386B49' : '#1F2E25'}`,
                                            borderRadius: '12px',
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            cursor: 'pointer',
                                            transition: 'all 0.18s ease',
                                            position: 'relative'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#47835B';
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = isCurrent ? '#386B49' : '#1F2E25';
                                            e.currentTarget.style.transform = 'none';
                                        }}
                                    >
                                        <div>
                                            {/* Card Top: Status & Role */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        fontSize: '11px',
                                                        fontWeight: 600,
                                                        padding: '2px 8px',
                                                        borderRadius: '12px',
                                                        background: p.role === 'owner' ? 'rgba(110, 201, 126, 0.16)' : p.role === 'editor' ? 'rgba(59, 130, 246, 0.16)' : 'rgba(156, 163, 175, 0.16)',
                                                        color: p.role === 'owner' ? '#6EC97E' : p.role === 'editor' ? '#60A5FA' : '#9CA3AF'
                                                    }}>
                                                        {p.role === 'owner' ? 'Propriétaire' : p.role === 'editor' ? 'Éditeur' : 'Lecteur'}
                                                    </span>

                                                    {p.is_public && (
                                                        <span title="Accessible via lien public" style={{ color: '#60A5FA', display: 'flex', alignItems: 'center' }}>
                                                            <Globe size={13} />
                                                        </span>
                                                    )}
                                                </div>

                                                {isCurrent && (
                                                    <span style={{ fontSize: '11px', color: '#6EC97E', fontWeight: 600 }}>
                                                        Ouvert
                                                    </span>
                                                )}
                                            </div>

                                            {/* Card Title */}
                                            <h4 style={{
                                                fontSize: '15px',
                                                fontWeight: 600,
                                                color: '#F0F6F2',
                                                margin: '0 0 8px',
                                                lineHeight: 1.3,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                            }}>
                                                {p.title || 'Document sans titre'}
                                            </h4>

                                            {/* Author */}
                                            {!p.is_owner && p.owner_username && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8BA594', marginBottom: '6px' }}>
                                                    <User size={13} />
                                                    <span>Par {p.owner_username}</span>
                                                </div>
                                            )}

                                            {/* Modified Time */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6A8072', marginBottom: '14px' }}>
                                                <Clock size={13} />
                                                <span>Modifié {formatDate(p.updated_at)}</span>
                                            </div>
                                        </div>

                                        {/* Card Actions Footer */}
                                        <div style={{
                                            borderTop: '1px solid #1C2B22',
                                            paddingTop: '10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpen(p);
                                                }}
                                                style={{
                                                    background: '#1A2C21',
                                                    color: '#6EC97E',
                                                    border: '1px solid #284433',
                                                    borderRadius: '6px',
                                                    padding: '4px 12px',
                                                    fontSize: '12px',
                                                    fontWeight: 500,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Ouvrir
                                            </button>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {/* Share button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShareModalTarget({ id: p.id, title: p.title });
                                                    }}
                                                    title="Partager le document"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#8BA594',
                                                        cursor: 'pointer',
                                                        padding: '6px',
                                                        borderRadius: '6px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = '#FFF'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = '#8BA594'}
                                                >
                                                    <Share2 size={16} />
                                                </button>

                                                {/* Copy link button */}
                                                <button
                                                    onClick={(e) => handleCopyPermalink(p, e)}
                                                    title="Copier le lien d'accès"
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: isCopied ? '#6EC97E' : '#8BA594',
                                                        cursor: 'pointer',
                                                        padding: '6px',
                                                        borderRadius: '6px'
                                                    }}
                                                    onMouseEnter={(e) => !isCopied && (e.currentTarget.style.color = '#FFF')}
                                                    onMouseLeave={(e) => !isCopied && (e.currentTarget.style.color = '#8BA594')}
                                                >
                                                    {isCopied ? <Check size={16} /> : <Link size={16} />}
                                                </button>

                                                {/* Delete button (owner only) */}
                                                {p.is_owner && (
                                                    <button
                                                        onClick={(e) => handleDelete(p, e)}
                                                        title="Supprimer ce document"
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#EF4444',
                                                            cursor: 'pointer',
                                                            padding: '6px',
                                                            borderRadius: '6px'
                                                        }}
                                                        onMouseEnter={(e) => e.currentTarget.style.color = '#F87171'}
                                                        onMouseLeave={(e) => e.currentTarget.style.color = '#EF4444'}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '14px 24px',
                    borderTop: '1px solid #1F2E25',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#101813',
                    fontSize: '12px',
                    color: '#6A8072'
                }}>
                    <div>
                        Connecté en tant que <span style={{ color: '#E0E8E3', fontWeight: 500 }}>{user?.username}</span>
                    </div>

                    <button
                        onClick={onClose}
                        style={{
                            background: '#1A2920',
                            color: '#E0E8E3',
                            border: '1px solid #2A3F32',
                            borderRadius: '6px',
                            padding: '6px 16px',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        Fermer
                    </button>
                </div>
            </div>

            {/* Sub-modal: Share */}
            {shareModalTarget && (
                <ShareModal
                    projectId={shareModalTarget.id}
                    projectTitle={shareModalTarget.title}
                    onClose={() => setShareModalTarget(null)}
                />
            )}
        </div>
    );
}

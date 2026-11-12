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
            padding: '24px'
        }}>
            <div style={{
                background: '#131D17',
                border: '1px solid #283D30',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '960px',
                height: '85vh',
                maxHeight: '800px',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 30px 60px rgba(0,0,0,0.7)',
                overflow: 'hidden',
                color: '#E0E8E3',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                {/* Header Google Drive / Docs Workspace */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid #203126',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    background: '#16231C'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'rgba(110, 201, 126, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#6EC97E'
                        }}>
                            <FileText size={22} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#F0F6F2' }}>
                                Espace Documents ScoutRaider
                            </h2>
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#8BA594' }}>
                                Accédez à tous vos raids, cartes et documents partagés
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                            onClick={handleNewDocument}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: '#238636',
                                color: '#FFF',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(35, 134, 54, 0.3)'
                            }}
                        >
                            <Plus size={16} />
                            Nouveau document
                        </button>

                        <button
                            onClick={onClose}
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
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Sub-header Controls: Search + Tabs */}
                <div style={{
                    padding: '14px 24px',
                    borderBottom: '1px solid #1F2E25',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px',
                    flexWrap: 'wrap',
                    background: '#121A15'
                }}>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onClick={() => setActiveTab('all')}
                            style={{
                                background: activeTab === 'all' ? '#1E3327' : 'transparent',
                                color: activeTab === 'all' ? '#6EC97E' : '#8BA594',
                                border: `1px solid ${activeTab === 'all' ? '#2E7D47' : 'transparent'}`,
                                borderRadius: '7px',
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            Tous ({projects.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('owned')}
                            style={{
                                background: activeTab === 'owned' ? '#1E3327' : 'transparent',
                                color: activeTab === 'owned' ? '#6EC97E' : '#8BA594',
                                border: `1px solid ${activeTab === 'owned' ? '#2E7D47' : 'transparent'}`,
                                borderRadius: '7px',
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            Mes documents ({projects.filter(p => p.is_owner).length})
                        </button>
                        <button
                            onClick={() => setActiveTab('shared')}
                            style={{
                                background: activeTab === 'shared' ? '#1E3327' : 'transparent',
                                color: activeTab === 'shared' ? '#6EC97E' : '#8BA594',
                                border: `1px solid ${activeTab === 'shared' ? '#2E7D47' : 'transparent'}`,
                                borderRadius: '7px',
                                padding: '6px 14px',
                                fontSize: '13px',
                                fontWeight: 500,
                                cursor: 'pointer'
                            }}
                        >
                            Partagés avec moi ({projects.filter(p => !p.is_owner).length})
                        </button>
                    </div>

                    {/* Search & Refresh */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            background: '#0E1611',
                            border: '1px solid #24382B',
                            borderRadius: '8px',
                            padding: '0 10px',
                            width: '240px'
                        }}>
                            <Search size={15} color="#6A8072" style={{ marginRight: '6px' }} />
                            <input
                                type="text"
                                placeholder="Rechercher par titre, auteur..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    color: '#E0E8E3',
                                    fontSize: '12px',
                                    padding: '7px 0',
                                    width: '100%'
                                }}
                            />
                        </div>

                        <button
                            onClick={fetchProjects}
                            title="Actualiser"
                            style={{
                                background: '#16231C',
                                border: '1px solid #24382B',
                                color: '#8BA594',
                                borderRadius: '8px',
                                padding: '7px 10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#6EC97E'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#8BA594'}
                        >
                            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Body / Document Grid */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '24px',
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
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '16px'
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

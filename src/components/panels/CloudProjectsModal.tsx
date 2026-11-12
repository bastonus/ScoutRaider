/**
 * CloudProjectsModal.tsx — Drawer/Modal to list, open and delete user projects from Coolify PostgreSQL DB.
 */

import React, { useEffect, useState } from 'react';
import { X, Cloud, FolderOpen, Trash2, Plus, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { CloudAuthService, type CloudProjectSummary } from '../../logic/CloudAuthService';
import { useApp } from '../../AppContext';

export default function CloudProjectsModal({ onClose }: { onClose: () => void }) {
    const { user, loadFromCloud, saveToCloudNow } = useAuth();
    const { dispatch } = useApp();

    const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjects = async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await CloudAuthService.listProjects();
            setProjects(list);
        } catch (e: any) {
            setError(e.message || 'Impossible de récupérer vos projets.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm('Voulez-vous vraiment supprimer ce projet du cloud ?')) return;

        try {
            const ok = await CloudAuthService.deleteProject(id);
            if (ok) {
                setProjects(prev => prev.filter(p => p.id !== id));
                dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet supprimé du cloud.', notifType: 'info' });
            }
        } catch (err: any) {
            alert('Erreur lors de la suppression.');
        }
    };

    const handleCreateNew = () => {
        dispatch({ type: 'NEW_PROJECT' });
        onClose();
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouveau projet initialisé.', notifType: 'info' });
    };

    return (
        <div 
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(8px)',
                padding: '20px'
            }}
            onClick={onClose}
        >
            <div 
                onClick={e => e.stopPropagation()}
                style={{
                    width: '100%',
                    maxWidth: '560px',
                    maxHeight: '80vh',
                    background: '#0d1310',
                    border: '1px solid rgba(110, 201, 126, 0.2)',
                    borderRadius: '16px',
                    boxShadow: '0 30px 80px rgba(0,0,0,0.85)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Cloud size={18} color="var(--accent-default)" />
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                            Mes projets dans le cloud
                        </span>
                        {user && (
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '12px' }}>
                                {user.username}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                            onClick={fetchProjects}
                            title="Actualiser"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <RefreshCw size={15} />
                        </button>
                        <button 
                            onClick={onClose}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Subheader action */}
                <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                        Sauvegardés automatiquement sur votre serveur Coolify PostgreSQL.
                    </div>
                    <button
                        onClick={handleCreateNew}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: 'rgba(110, 201, 126, 0.15)',
                            border: '1px solid rgba(110, 201, 126, 0.25)',
                            color: 'var(--accent-default)',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={14} />
                        Nouveau projet
                    </button>
                </div>

                {/* Project List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {loading && (
                        <div style={{ padding: '30px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                            Chargement des projets...
                        </div>
                    )}

                    {!loading && error && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#fca5a5', fontSize: '12px' }}>
                            {error}
                        </div>
                    )}

                    {!loading && !error && projects.length === 0 && (
                        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <Cloud size={32} opacity={0.3} />
                            <div style={{ fontSize: '13px', fontWeight: 600 }}>Aucun projet dans le cloud</div>
                            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', maxWidth: '300px' }}>
                                Vos modifications actuelles seront automatiquement synchronisées dès que vous commencez à travailler.
                            </div>
                        </div>
                    )}

                    {!loading && projects.map(proj => (
                        <div
                            key={proj.id}
                            onClick={() => loadFromCloud(proj.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                                e.currentTarget.style.borderColor = 'rgba(110, 201, 126, 0.3)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <FolderOpen size={18} color="var(--accent-default)" />
                                <div>
                                    <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#fff' }}>
                                        {proj.title || 'Document sans titre'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                                        <Clock size={11} />
                                        Modifié le {new Date(proj.updated_at).toLocaleDateString('fr-FR', {
                                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={e => handleDelete(proj.id, e)}
                                title="Supprimer ce projet"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(239, 68, 68, 0.6)',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '6px',
                                    transition: 'color 0.15s ease'
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                onMouseLeave={e => e.currentTarget.style.color = 'rgba(239, 68, 68, 0.6)'}
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

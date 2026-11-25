/**
 * CloudProjectsModal.tsx — Drawer/Modal to list, open and delete user projects from Coolify PostgreSQL DB.
 */

import React, { useEffect, useState } from 'react';
import { Cloud, FolderOpen, Trash2, Plus, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import { CloudAuthService, type CloudProjectSummary } from '../../logic/CloudAuthService';
import { useUI } from '../../hooks';
import Modal from '../common/Modal';
import ConfirmDialog from '../common/ConfirmDialog';

export default function CloudProjectsModal({ onClose }: { onClose: () => void }) {
    const { user, loadFromCloud, saveToCloudNow } = useAuth();
    const { dispatch } = useUI();

    const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPendingDeleteId(id);
    };

    const confirmDelete = async () => {
        if (!pendingDeleteId) return;
        const id = pendingDeleteId;
        setPendingDeleteId(null);
        try {
            const ok = await CloudAuthService.deleteProject(id);
            if (ok) {
                setProjects(prev => prev.filter(p => p.id !== id));
                dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet supprimé du cloud.', notifType: 'info' });
            }
        } catch {
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Erreur lors de la suppression du projet.', notifType: 'error' });
        }
    };

    const handleCreateNew = () => {
        dispatch({ type: 'NEW_PROJECT' });
        onClose();
        dispatch({ type: 'ADD_NOTIFICATION', message: 'Nouveau projet initialisé.', notifType: 'info' });
    };

    return (
        <>
        <Modal
            title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <Cloud size={16} color="var(--accent-hover)" aria-hidden="true" />
                    Mes Projets Cloud
                </span>
            }
            onClose={onClose}
            maxWidth="560px"
            maxHeight="80dvh"
        >
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                {/* Subheader action */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-dim)' }}>
                        <span>Sauvegardés sur votre serveur PostgreSQL.</span>
                        {user && (
                            <span style={{ fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '2px 8px', borderRadius: '12px' }}>
                                {user.username}
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={fetchProjects}
                        title="Actualiser"
                        aria-label="Actualiser la liste des projets"
                        style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-xs)',
                            color: 'var(--text-dim)',
                            cursor: 'pointer',
                            padding: '5px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <RefreshCw size={14} aria-hidden="true" />
                    </button>
                    <button
                        type="button"
                        onClick={handleCreateNew}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: 'var(--accent-primary)',
                            border: '1px solid var(--accent-primary)',
                            color: '#FFFFFF',
                            borderRadius: 'var(--radius-xs)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <Plus size={14} aria-hidden="true" />
                        Nouveau projet
                    </button>
                </div>

                {/* Project List */}
                <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                                type="button"
                                onClick={e => handleDelete(proj.id, e)}
                                title="Supprimer ce projet"
                                aria-label={`Supprimer ${proj.title}`}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--semantic-danger)',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '6px',
                                }}
                            >
                                <Trash2 size={15} aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </Modal>
        {pendingDeleteId && (
            <ConfirmDialog
                title="Supprimer ce projet du cloud ?"
                message="Ce projet sera définitivement supprimé de votre espace cloud. Cette action est irréversible."
                confirmLabel="Supprimer le projet"
                onConfirm={confirmDelete}
                onCancel={() => setPendingDeleteId(null)}
            />
        )}
        </>
    );
}

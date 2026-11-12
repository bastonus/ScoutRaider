import React, { useState, useEffect } from 'react';
import { X, UserPlus, Link, Copy, Check, Users, Shield, Globe, Lock, Trash2, ShieldCheck, Eye, Edit3 } from 'lucide-react';
import { CloudAuthService, type ProjectSharingDetails } from '../../logic/CloudAuthService';
import { useAuth } from '../../AuthContext';
import { useApp } from '../../AppContext';

interface ShareModalProps {
    projectId?: string | null;
    projectTitle?: string;
    onClose: () => void;
}

export default function ShareModal({ projectId: propProjectId, projectTitle: propProjectTitle, onClose }: ShareModalProps) {
    const { cloudProjectId, user } = useAuth();
    const { state, dispatch } = useApp();

    const activeProjectId = propProjectId || cloudProjectId;
    const documentTitle = propProjectTitle || state.document_title || 'Document sans titre';

    const [loading, setLoading] = useState(true);
    const [sharingDetails, setSharingDetails] = useState<ProjectSharingDetails | null>(null);
    const [inviteInput, setInviteInput] = useState('');
    const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
    const [submittingInvite, setSubmittingInvite] = useState(false);
    const [copied, setCopied] = useState(false);
    const [updatingGeneralAccess, setUpdatingGeneralAccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const loadDetails = async () => {
        if (!activeProjectId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setErrorMsg(null);
        try {
            const details = await CloudAuthService.getSharingDetails(activeProjectId);
            setSharingDetails(details);
        } catch (err: any) {
            setErrorMsg(err.message || 'Impossible de charger les partages.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDetails();
    }, [activeProjectId]);

    const getShareUrl = () => {
        if (!sharingDetails?.share_token) return '';
        const base = typeof window !== 'undefined' && window.location.origin && !window.location.origin.startsWith('file:')
            ? window.location.origin
            : 'https://scoutraider.silverhorse.fr';
        return `${base}/?doc=${sharingDetails.share_token}`;
    };

    const handleCopyLink = async () => {
        const url = getShareUrl();
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Lien du document copié dans le presse-papier !', notifType: 'info' });
        } catch {
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Erreur lors de la copie du lien.', notifType: 'error' });
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteInput.trim() || !activeProjectId) return;
        setSubmittingInvite(true);
        setErrorMsg(null);
        try {
            await CloudAuthService.inviteCollaborator(activeProjectId, inviteInput.trim(), inviteRole);
            setInviteInput('');
            await loadDetails();
            dispatch({ type: 'ADD_NOTIFICATION', message: `Invitation envoyée avec succès (${inviteRole === 'editor' ? 'Éditeur' : 'Lecteur'}).`, notifType: 'info' });
        } catch (err: any) {
            setErrorMsg(err.message || 'Impossible d\'ajouter ce collaborateur.');
        } finally {
            setSubmittingInvite(false);
        }
    };

    const handleRemoveCollaborator = async (collaboratorUserId: string, username: string) => {
        if (!activeProjectId) return;
        if (!confirm(`Retirer l'accès de ${username} ?`)) return;
        try {
            await CloudAuthService.removeCollaborator(activeProjectId, collaboratorUserId);
            await loadDetails();
            dispatch({ type: 'ADD_NOTIFICATION', message: `Accès retiré pour ${username}.`, notifType: 'info' });
        } catch (err: any) {
            setErrorMsg(err.message || 'Erreur lors du retrait de l\'accès.');
        }
    };

    const handleGeneralAccessChange = async (isPublic: boolean, publicRole: 'viewer' | 'editor') => {
        if (!activeProjectId) return;
        setUpdatingGeneralAccess(true);
        setErrorMsg(null);
        try {
            await CloudAuthService.updatePublicAccess(activeProjectId, isPublic, publicRole);
            await loadDetails();
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Accès général mis à jour.', notifType: 'info' });
        } catch (err: any) {
            setErrorMsg(err.message || 'Erreur lors de la mise à jour.');
        } finally {
            setUpdatingGeneralAccess(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(5px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: '#141E18',
                border: '1px solid #2A3F32',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '560px',
                boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                color: '#E0E8E3',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                {/* Header Google Docs style */}
                <div style={{
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid #1F2E25',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={20} color="#6EC97E" />
                            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#F0F6F2' }}>
                                Partager « {documentTitle} »
                            </h2>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#8BA594' }}>
                            Gérez les collaborateurs et les autorisations de consultation ou d'édition
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: '#8BA594',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = '#FFF'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#8BA594'}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
                    
                    {errorMsg && (
                        <div style={{
                            padding: '10px 14px',
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '8px',
                            color: '#FCA5A5',
                            fontSize: '13px'
                        }}>
                            {errorMsg}
                        </div>
                    )}

                    {!activeProjectId ? (
                        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                            <p style={{ color: '#8BA594', fontSize: '14px', marginBottom: '16px' }}>
                                Ce document n'est pas encore enregistré dans le cloud. Enregistrez-le pour le partager.
                            </p>
                            <button
                                onClick={async () => {
                                    setLoading(true);
                                    await CloudAuthService.saveProject(documentTitle, state);
                                    await loadDetails();
                                }}
                                style={{
                                    background: '#238636',
                                    color: '#FFF',
                                    border: 'none',
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Enregistrer dans le Cloud maintenant
                            </button>
                        </div>
                    ) : loading ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: '#8BA594' }}>
                            Chargement des permissions...
                        </div>
                    ) : (
                        <>
                            {/* Invite Section */}
                            <form onSubmit={handleInvite} style={{ display: 'flex', gap: '8px' }}>
                                <div style={{
                                    flex: 1,
                                    position: 'relative',
                                    display: 'flex',
                                    alignItems: 'center',
                                    background: '#0E1611',
                                    border: '1px solid #2A3F32',
                                    borderRadius: '8px',
                                    padding: '0 12px'
                                }}>
                                    <UserPlus size={16} color="#6EC97E" style={{ marginRight: '8px' }} />
                                    <input
                                        type="text"
                                        placeholder="Ajouter des personnes (pseudo ou email)..."
                                        value={inviteInput}
                                        onChange={(e) => setInviteInput(e.target.value)}
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 'none',
                                            outline: 'none',
                                            color: '#E0E8E3',
                                            fontSize: '13px',
                                            padding: '10px 0'
                                        }}
                                    />
                                    <select
                                        value={inviteRole}
                                        onChange={(e) => setInviteRole(e.target.value as any)}
                                        style={{
                                            background: '#1A2920',
                                            color: '#6EC97E',
                                            border: '1px solid #2A3F32',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            outline: 'none',
                                            marginLeft: '8px'
                                        }}
                                    >
                                        <option value="viewer">Lecteur</option>
                                        <option value="editor">Éditeur</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={!inviteInput.trim() || submittingInvite}
                                    style={{
                                        background: inviteInput.trim() ? '#2E7D47' : '#1C2E23',
                                        color: inviteInput.trim() ? '#FFF' : '#6A8072',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0 16px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        cursor: inviteInput.trim() ? 'pointer' : 'default',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {submittingInvite ? 'Ajout...' : 'Envoyer'}
                                </button>
                            </form>

                            {/* Collaborators List */}
                            <div>
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#8BA594', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Personnes ayant accès
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {/* Owner Row */}
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 12px',
                                        background: '#0E1611',
                                        borderRadius: '8px',
                                        border: '1px solid #1F2E25'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: '#2E7D47',
                                                color: '#FFF',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '13px',
                                                fontWeight: 600
                                            }}>
                                                {(sharingDetails?.owner.username || 'P')[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '13px', fontWeight: 500, color: '#F0F6F2' }}>
                                                    {sharingDetails?.owner.username} {sharingDetails?.is_owner && '(vous)'}
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#6A8072' }}>Propriétaire</div>
                                            </div>
                                        </div>
                                        <span style={{ fontSize: '12px', color: '#6EC97E', fontWeight: 500 }}>
                                            Propriétaire
                                        </span>
                                    </div>

                                    {/* Invited Collaborators */}
                                    {sharingDetails?.collaborators.map((collab) => (
                                        <div key={collab.share_id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            background: '#0E1611',
                                            borderRadius: '8px',
                                            border: '1px solid #1F2E25'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{
                                                    width: '32px',
                                                    height: '32px',
                                                    borderRadius: '50%',
                                                    background: collab.role === 'editor' ? '#2563EB' : '#4B5563',
                                                    color: '#FFF',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '13px',
                                                    fontWeight: 600
                                                }}>
                                                    {collab.username[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#F0F6F2' }}>
                                                        {collab.username}
                                                    </div>
                                                    {collab.email && (
                                                        <div style={{ fontSize: '11px', color: '#6A8072' }}>{collab.email}</div>
                                                    )}
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {sharingDetails.is_owner ? (
                                                    <>
                                                        <select
                                                            value={collab.role}
                                                            onChange={async (e) => {
                                                                const newRole = e.target.value as 'viewer' | 'editor';
                                                                await CloudAuthService.inviteCollaborator(activeProjectId, collab.username, newRole);
                                                                await loadDetails();
                                                            }}
                                                            style={{
                                                                background: '#1A2920',
                                                                color: '#E0E8E3',
                                                                border: '1px solid #2A3F32',
                                                                borderRadius: '6px',
                                                                fontSize: '12px',
                                                                padding: '4px 8px',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <option value="viewer">Lecteur</option>
                                                            <option value="editor">Éditeur</option>
                                                        </select>
                                                        <button
                                                            onClick={() => handleRemoveCollaborator(collab.user_id, collab.username)}
                                                            title="Supprimer l'accès"
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: '#EF4444',
                                                                cursor: 'pointer',
                                                                padding: '4px',
                                                                borderRadius: '4px'
                                                            }}
                                                        >
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: '#8BA594' }}>
                                                        {collab.role === 'editor' ? 'Éditeur' : 'Lecteur'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* General Access Section */}
                            <div style={{ borderTop: '1px solid #1F2E25', paddingTop: '16px' }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#8BA594', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Accès général
                                </h3>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    background: '#0E1611',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    border: '1px solid #1F2E25'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            background: sharingDetails?.is_public ? 'rgba(59, 130, 246, 0.15)' : 'rgba(107, 114, 128, 0.15)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: sharingDetails?.is_public ? '#60A5FA' : '#9CA3AF'
                                        }}>
                                            {sharingDetails?.is_public ? <Globe size={20} /> : <Lock size={20} />}
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 500, color: '#F0F6F2' }}>
                                                {sharingDetails?.is_public ? 'Tous les utilisateurs disposant du lien' : 'Limité'}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#6A8072' }}>
                                                {sharingDetails?.is_public
                                                    ? 'Toute personne sur Internet avec ce lien peut accéder au document'
                                                    : 'Seules les personnes disposant d\'un accès peuvent ouvrir ce lien'}
                                            </div>
                                        </div>
                                    </div>

                                    {sharingDetails?.is_owner && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <select
                                                disabled={updatingGeneralAccess}
                                                value={sharingDetails?.is_public ? 'public' : 'restricted'}
                                                onChange={(e) => {
                                                    const isPub = e.target.value === 'public';
                                                    handleGeneralAccessChange(isPub, sharingDetails?.public_role || 'viewer');
                                                }}
                                                style={{
                                                    background: '#1A2920',
                                                    color: '#E0E8E3',
                                                    border: '1px solid #2A3F32',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    padding: '5px 8px',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <option value="restricted">Limité</option>
                                                <option value="public">Tous avec le lien</option>
                                            </select>

                                            {sharingDetails?.is_public && (
                                                <select
                                                    disabled={updatingGeneralAccess}
                                                    value={sharingDetails?.public_role || 'viewer'}
                                                    onChange={(e) => {
                                                        const pRole = e.target.value as 'viewer' | 'editor';
                                                        handleGeneralAccessChange(true, pRole);
                                                    }}
                                                    style={{
                                                        background: '#1A2920',
                                                        color: '#6EC97E',
                                                        border: '1px solid #2A3F32',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        padding: '5px 8px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <option value="viewer">Lecteur</option>
                                                    <option value="editor">Éditeur</option>
                                                </select>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer with Copier le lien and Terminé */}
                <div style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #1F2E25',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#101813'
                }}>
                    <button
                        onClick={handleCopyLink}
                        disabled={!sharingDetails?.share_token}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: copied ? 'rgba(110, 201, 126, 0.15)' : '#1A2920',
                            color: copied ? '#6EC97E' : '#E0E8E3',
                            border: `1px solid ${copied ? '#2E7D47' : '#2A3F32'}`,
                            borderRadius: '8px',
                            padding: '8px 16px',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {copied ? <Check size={16} /> : <Link size={16} />}
                        {copied ? 'Lien copié !' : 'Copier le lien'}
                    </button>

                    <button
                        onClick={onClose}
                        style={{
                            background: '#238636',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '8px 20px',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Terminé
                    </button>
                </div>
            </div>
        </div>
    );
}

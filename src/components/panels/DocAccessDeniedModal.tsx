/**
 * DocAccessDeniedModal.tsx — Écran d'accès restreint et demande d'autorisation (style Google Drive).
 * S'affiche lorsqu'un utilisateur tente d'ouvrir un document privé sans autorisation.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import { CloudAuthService } from '../../logic/CloudAuthService';
import FleurDeLysLogo from '../layout/FleurDeLysLogo';
import { Lock, FileText, User, Mail, Send, CheckCircle2, ArrowLeft, LogIn, RefreshCw } from 'lucide-react';

interface DocAccessDeniedModalProps {
    projectId: string;
    projectTitle: string;
    ownerUsername: string;
    requiresAuth: boolean;
    onClose?: () => void;
}

export default function DocAccessDeniedModal({
    projectId,
    projectTitle,
    ownerUsername,
    requiresAuth,
    onClose
}: DocAccessDeniedModalProps) {
    const navigate = useNavigate();
    const { user, logout, setAuthModalOpen } = useAuth();

    const [name, setName] = useState(user?.username || '');
    const [email, setEmail] = useState(user?.email || '');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const handleSendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);
        setSending(true);
        try {
            await CloudAuthService.requestAccess(
                projectId,
                name.trim() || user?.username || 'Anonyme',
                email.trim() || user?.email || undefined,
                message.trim() || undefined
            );
            setSent(true);
        } catch (err: any) {
            setErrorMsg(err.message || 'Impossible d\'envoyer la demande. Veuillez réessayer.');
        } finally {
            setSending(false);
        }
    };

    const handleSwitchAccount = () => {
        logout();
        navigate(`/login?redirect=/d/${projectId}`);
    };

    const handleLogin = () => {
        navigate(`/login?redirect=/d/${projectId}`);
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.card}>
                {/* Header Logo */}
                <div style={styles.brand}>
                    <FleurDeLysLogo size={36} color="#6EC97E" />
                    <span style={styles.brandTitle}>ScoutRaider</span>
                </div>

                {!sent ? (
                    <>
                        <div style={styles.iconCircle}>
                            <Lock size={28} color="#F87171" />
                        </div>

                        <h2 style={styles.title}>Demande d'autorisation</h2>
                        <p style={styles.subtitle}>
                            Vous devez disposer d'une autorisation pour ouvrir ce document.
                        </p>

                        {/* Document badge */}
                        <div style={styles.docBadge}>
                            <div style={styles.docIcon}>
                                <FileText size={20} color="#6EC97E" />
                            </div>
                            <div style={styles.docInfo}>
                                <div style={styles.docTitle}>{projectTitle || 'Document sans titre'}</div>
                                <div style={styles.docOwner}>Propriétaire : <strong>{ownerUsername || 'Inconnu'}</strong></div>
                            </div>
                        </div>

                        {/* Case 1: Unauthenticated user */}
                        {requiresAuth && (
                            <div style={styles.authPromptBox}>
                                <div style={styles.authPromptText}>
                                    Vous n'êtes pas connecté. Connectez-vous avec un compte autorisé ou demandez l'accès au propriétaire.
                                </div>
                                <button onClick={handleLogin} style={styles.loginBtn} type="button">
                                    <LogIn size={15} />
                                    <span>Se connecter / S'inscrire</span>
                                </button>
                                <div style={styles.dividerRow}>
                                    <span style={styles.dividerLine} />
                                    <span style={styles.dividerText}>ou demander l'accès</span>
                                    <span style={styles.dividerLine} />
                                </div>
                            </div>
                        )}

                        {/* Case 2: Authenticated user without access */}
                        {!requiresAuth && user && (
                            <div style={styles.userBox}>
                                <div style={styles.userIcon}>
                                    <User size={16} color="#6EC97E" />
                                </div>
                                <div style={styles.userText}>
                                    Connecté en tant que <strong>{user.username}</strong>
                                    {user.email && <span style={styles.userEmail}> ({user.email})</span>}
                                </div>
                            </div>
                        )}

                        {/* Access Request Form */}
                        <form onSubmit={handleSendRequest} style={styles.form}>
                            {requiresAuth && (
                                <div style={styles.rowTwo}>
                                    <div style={styles.field}>
                                        <label style={styles.label}>Votre nom ou pseudo</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            placeholder="Ex: Scout Raider"
                                            style={styles.input}
                                            required
                                        />
                                    </div>
                                    <div style={styles.field}>
                                        <label style={styles.label}>Votre adresse e-mail</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            placeholder="scout@exemple.fr"
                                            style={styles.input}
                                        />
                                    </div>
                                </div>
                            )}

                            <div style={styles.field}>
                                <label style={styles.label}>Message au propriétaire (facultatif)</label>
                                <textarea
                                    value={message}
                                    onChange={e => setMessage(e.target.value)}
                                    placeholder="Ex : Bonjour, je fais partie de l'équipe pour le raid du week-end..."
                                    style={styles.textarea}
                                    rows={3}
                                />
                            </div>

                            {errorMsg && (
                                <div style={styles.errorAlert}>{errorMsg}</div>
                            )}

                            <div style={styles.actionsRow}>
                                <button
                                    type="button"
                                    onClick={() => navigate('/projects')}
                                    style={styles.backBtn}
                                >
                                    <ArrowLeft size={14} />
                                    <span>Retour aux projets</span>
                                </button>

                                {!requiresAuth && (
                                    <button
                                        type="button"
                                        onClick={handleSwitchAccount}
                                        style={styles.switchBtn}
                                        title="Changer de compte"
                                    >
                                        <RefreshCw size={13} />
                                        <span>Changer de compte</span>
                                    </button>
                                )}

                                <button
                                    type="submit"
                                    disabled={sending}
                                    style={styles.submitBtn}
                                >
                                    {sending ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                                    <span>{sending ? 'Envoi...' : 'Demander l\'accès'}</span>
                                </button>
                            </div>
                        </form>
                    </>
                ) : (
                    /* Success state */
                    <div style={styles.successBox}>
                        <div style={styles.successIconCircle}>
                            <CheckCircle2 size={44} color="#6EC97E" />
                        </div>
                        <h3 style={styles.successTitle}>Demande d'accès envoyée</h3>
                        <p style={styles.successText}>
                            Votre demande a bien été transmise à <strong>{ownerUsername}</strong>.<br />
                            Dès que le propriétaire aura validé votre demande, vous pourrez consulter ce document en rouvrant ce lien.
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate('/projects')}
                            style={styles.successBackBtn}
                        >
                            <span>Retour à mes projets</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(9, 9, 11, 0.94)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    },
    card: {
        width: '100%',
        maxWidth: '520px',
        background: '#141E18',
        border: '1px solid #233529',
        borderRadius: '16px',
        padding: '32px 28px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
        color: '#E0E8E3',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
    },
    brand: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '20px',
    },
    brandTitle: {
        fontSize: '18px',
        fontWeight: 700,
        color: '#6EC97E',
        letterSpacing: '-0.5px',
    },
    iconCircle: {
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'rgba(239, 68, 68, 0.12)',
        border: '1px solid rgba(239, 68, 68, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
    },
    title: {
        margin: '0 0 6px 0',
        fontSize: '22px',
        fontWeight: 700,
        color: '#FAFAFA',
        letterSpacing: '-0.3px',
    },
    subtitle: {
        margin: '0 0 20px 0',
        fontSize: '13px',
        color: '#9CA3AF',
        lineHeight: 1.5,
    },
    docBadge: {
        width: '100%',
        background: '#1A2920',
        border: '1px solid #2A3F32',
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        textAlign: 'left',
        marginBottom: '18px',
        boxSizing: 'border-box',
    },
    docIcon: {
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: 'rgba(110, 201, 126, 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    docInfo: {
        flex: 1,
        minWidth: 0,
    },
    docTitle: {
        fontSize: '14px',
        fontWeight: 600,
        color: '#F0F6F2',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    docOwner: {
        fontSize: '12px',
        color: '#7E9988',
        marginTop: '2px',
    },
    authPromptBox: {
        width: '100%',
        background: 'rgba(37, 99, 235, 0.08)',
        border: '1px solid rgba(37, 99, 235, 0.25)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
    },
    authPromptText: {
        fontSize: '12px',
        color: '#93C5FD',
        lineHeight: 1.4,
    },
    loginBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: '#2563EB',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 18px',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'background 120ms ease',
    },
    dividerRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        marginTop: '2px',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        background: 'rgba(255,255,255,0.1)',
    },
    dividerText: {
        fontSize: '11px',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
    },
    userBox: {
        width: '100%',
        background: '#1A2920',
        border: '1px solid #2A3F32',
        borderRadius: '8px',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '12px',
        color: '#D1D5DB',
        marginBottom: '16px',
        boxSizing: 'border-box',
        textAlign: 'left',
    },
    userIcon: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userText: {
        flex: 1,
    },
    userEmail: {
        color: '#9CA3AF',
    },
    form: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        textAlign: 'left',
    },
    rowTwo: {
        display: 'flex',
        gap: '10px',
    },
    field: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        flex: 1,
    },
    label: {
        fontSize: '11.5px',
        fontWeight: 600,
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
    },
    input: {
        background: '#0d1511',
        border: '1px solid #233529',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '13px',
        color: '#F0F6F2',
        outline: 'none',
        fontFamily: 'inherit',
    },
    textarea: {
        background: '#0d1511',
        border: '1px solid #233529',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '13px',
        color: '#F0F6F2',
        outline: 'none',
        fontFamily: 'inherit',
        resize: 'vertical',
    },
    errorAlert: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '8px',
        padding: '8px 10px',
        fontSize: '12px',
        color: '#FCA5A5',
    },
    actionsRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        marginTop: '6px',
        flexWrap: 'wrap',
    },
    backBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'transparent',
        border: '1px solid #2A3F32',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '12px',
        color: '#9CA3AF',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    switchBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        background: 'transparent',
        border: 'none',
        padding: '8px',
        fontSize: '12px',
        color: '#6EC97E',
        cursor: 'pointer',
        fontFamily: 'inherit',
        textDecoration: 'underline',
    },
    submitBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'linear-gradient(135deg, #6EC97E, #4da85e)',
        border: 'none',
        borderRadius: '8px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: 600,
        color: '#0d1511',
        cursor: 'pointer',
        fontFamily: 'inherit',
        marginLeft: 'auto',
    },
    successBox: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '12px 0',
    },
    successIconCircle: {
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: 'rgba(110, 201, 126, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '16px',
    },
    successTitle: {
        margin: '0 0 8px 0',
        fontSize: '20px',
        fontWeight: 700,
        color: '#F0F6F2',
    },
    successText: {
        fontSize: '13px',
        color: '#9CA3AF',
        lineHeight: 1.5,
        margin: '0 0 20px 0',
    },
    successBackBtn: {
        background: 'linear-gradient(135deg, #6EC97E, #4da85e)',
        border: 'none',
        borderRadius: '8px',
        padding: '10px 20px',
        fontSize: '13px',
        fontWeight: 600,
        color: '#0d1511',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
};

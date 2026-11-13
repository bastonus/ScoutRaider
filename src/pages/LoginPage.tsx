/**
 * LoginPage.tsx — Page de connexion / inscription ScoutRaider
 * Route: / (redirige vers /projects si déjà connecté)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import FleurDeLysLogo from '../components/layout/FleurDeLysLogo';

type Tab = 'login' | 'register';

export default function LoginPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, login, register, continueAsGuest } = useAuth();

    const [tab, setTab] = useState<Tab>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate('/projects', { replace: true });
        }
    }, [isAuthenticated, isLoading, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            if (tab === 'login') {
                await login(username, password);
            } else {
                await register(username, password, email || undefined);
            }
            navigate('/projects', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleGuest = () => {
        continueAsGuest();
        navigate('/projects', { replace: true });
    };

    if (isLoading) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner} />
            </div>
        );
    }

    return (
        <div style={styles.page}>
            {/* Background decorative blobs */}
            <div style={styles.blob1} />
            <div style={styles.blob2} />

            <div style={styles.card}>
                {/* Logo + Brand */}
                <div style={styles.brandRow}>
                    <div style={styles.logoWrap}>
                        <FleurDeLysLogo size={40} color="#6EC97E" />
                    </div>
                    <div>
                        <h1 style={styles.brandName}>ScoutRaider</h1>
                        <p style={styles.brandSub}>Suite de cartographie tactique</p>
                    </div>
                </div>

                {/* Tabs */}
                <div style={styles.tabRow}>
                    <button
                        style={{ ...styles.tabBtn, ...(tab === 'login' ? styles.tabBtnActive : {}) }}
                        onClick={() => { setTab('login'); setError(null); }}
                        type="button"
                    >
                        Connexion
                    </button>
                    <button
                        style={{ ...styles.tabBtn, ...(tab === 'register' ? styles.tabBtnActive : {}) }}
                        onClick={() => { setTab('register'); setError(null); }}
                        type="button"
                    >
                        Inscription
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>
                            {tab === 'login' ? "Nom d'utilisateur" : "Nom d'utilisateur"}
                        </label>
                        <input
                            style={styles.input}
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder={tab === 'login' ? 'scout_raider' : 'mon_pseudo'}
                            autoComplete="username"
                            required
                        />
                    </div>

                    {tab === 'register' && (
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>E-mail <span style={styles.optional}>(optionnel)</span></label>
                            <input
                                style={styles.input}
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="email@exemple.fr"
                                autoComplete="email"
                            />
                        </div>
                    )}

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Mot de passe</label>
                        <input
                            style={styles.input}
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                            required
                        />
                    </div>

                    {error && (
                        <div style={styles.errorBox}>{error}</div>
                    )}

                    <button
                        style={{ ...styles.submitBtn, opacity: submitting ? 0.7 : 1 }}
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting
                            ? (tab === 'login' ? 'Connexion…' : 'Inscription…')
                            : (tab === 'login' ? 'Se connecter' : "S'inscrire")}
                    </button>
                </form>

                {/* Divider */}
                <div style={styles.divider}>
                    <span style={styles.dividerLine} />
                    <span style={styles.dividerText}>ou</span>
                    <span style={styles.dividerLine} />
                </div>

                {/* Guest */}
                <button style={styles.guestBtn} onClick={handleGuest} type="button">
                    Continuer en tant qu'invité
                </button>

                <p style={styles.disclaimer}>
                    Vos données locales sont préservées en mode invité.
                </p>
            </div>
        </div>
    );
}

/* ── Styles ───────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#0d1511',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
    },
    blob1: {
        position: 'fixed',
        top: '-120px',
        left: '-120px',
        width: '400px',
        height: '400px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(110,201,126,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    blob2: {
        position: 'fixed',
        bottom: '-100px',
        right: '-100px',
        width: '350px',
        height: '350px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(110,201,126,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    card: {
        width: '100%',
        maxWidth: '420px',
        background: '#141E18',
        border: '1px solid rgba(110,201,126,0.18)',
        borderRadius: '16px',
        padding: '36px 32px 28px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        position: 'relative',
        zIndex: 1,
    },
    brandRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        marginBottom: '28px',
    },
    logoWrap: {
        width: '48px',
        height: '48px',
        background: 'rgba(110,201,126,0.1)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: '1px solid rgba(110,201,126,0.2)',
    },
    brandName: {
        margin: 0,
        fontSize: '22px',
        fontWeight: 700,
        color: '#e8f5eb',
        letterSpacing: '-0.3px',
    },
    brandSub: {
        margin: '2px 0 0',
        fontSize: '12px',
        color: 'rgba(232,245,235,0.45)',
        letterSpacing: '0.3px',
    },
    tabRow: {
        display: 'flex',
        gap: '4px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '10px',
        padding: '4px',
        marginBottom: '24px',
    },
    tabBtn: {
        flex: 1,
        padding: '9px 0',
        border: 'none',
        background: 'transparent',
        color: 'rgba(232,245,235,0.5)',
        fontSize: '14px',
        fontWeight: 500,
        borderRadius: '7px',
        cursor: 'pointer',
        transition: 'all 0.15s',
    },
    tabBtnActive: {
        background: '#1f2f24',
        color: '#6EC97E',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    label: {
        fontSize: '13px',
        fontWeight: 500,
        color: 'rgba(232,245,235,0.65)',
        letterSpacing: '0.1px',
    },
    optional: {
        fontWeight: 400,
        color: 'rgba(232,245,235,0.35)',
    },
    input: {
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(110,201,126,0.2)',
        borderRadius: '8px',
        padding: '10px 12px',
        color: '#e8f5eb',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.15s',
        width: '100%',
        boxSizing: 'border-box',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '8px',
        padding: '10px 12px',
        color: '#fca5a5',
        fontSize: '13px',
    },
    submitBtn: {
        background: 'linear-gradient(135deg, #6EC97E, #4da85e)',
        color: '#0d1511',
        border: 'none',
        borderRadius: '8px',
        padding: '12px',
        fontSize: '15px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'opacity 0.15s, transform 0.1s',
        marginTop: '4px',
        letterSpacing: '0.1px',
    },
    divider: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '20px 0',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        background: 'rgba(110,201,126,0.12)',
        display: 'block',
    },
    dividerText: {
        fontSize: '12px',
        color: 'rgba(232,245,235,0.3)',
    },
    guestBtn: {
        width: '100%',
        background: 'transparent',
        border: '1px solid rgba(110,201,126,0.25)',
        borderRadius: '8px',
        padding: '11px',
        color: 'rgba(232,245,235,0.65)',
        fontSize: '14px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
    },
    disclaimer: {
        textAlign: 'center',
        fontSize: '11px',
        color: 'rgba(232,245,235,0.25)',
        marginTop: '14px',
        marginBottom: 0,
    },
    loadingContainer: {
        minHeight: '100vh',
        background: '#0d1511',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinner: {
        width: '32px',
        height: '32px',
        border: '3px solid rgba(110,201,126,0.2)',
        borderTopColor: '#6EC97E',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
};

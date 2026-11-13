/**
 * LoginPage.tsx — Page de connexion / inscription ScoutRaider
 * Route: / (redirige vers /projects si déjà connecté)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import FleurDeLysLogo from '../components/layout/FleurDeLysLogo';
import { version } from '../../package.json';

type Tab = 'login' | 'register';

/** Map raw error messages / HTTP status hints to user-friendly French messages */
function parseAuthError(raw: string, tab: Tab): { message: string; hint?: string } {
    const r = raw.toLowerCase();

    // Network / server unreachable
    if (r.includes('failed to fetch') || r.includes('networkerror') || r.includes('network') || r.includes('fetch')) {
        return {
            message: '🌐 Impossible de contacter le serveur.',
            hint: 'Vérifiez votre connexion Internet ou réessayez dans quelques instants.',
        };
    }

    // Login-specific errors
    if (tab === 'login') {
        if (r.includes('identifiant') || r.includes('incorrect') || r.includes('401') || r.includes('unauthorized')) {
            return {
                message: '❌ Nom d\'utilisateur ou mot de passe incorrect.',
                hint: 'Vérifiez vos identifiants. Pas encore de compte ? Utilisez l\'onglet "Inscription".',
            };
        }
    }

    // Register-specific errors
    if (tab === 'register') {
        if (r.includes('déjà utilisé') || r.includes('already') || r.includes('409') || r.includes('conflict')) {
            return {
                message: '⚠️ Ce nom d\'utilisateur est déjà pris.',
                hint: 'Choisissez un autre pseudo ou connectez-vous si vous avez déjà un compte.',
            };
        }
        if (r.includes('email') && (r.includes('déjà') || r.includes('already'))) {
            return {
                message: '⚠️ Cette adresse e-mail est déjà associée à un compte.',
                hint: 'Utilisez une autre adresse ou connectez-vous.',
            };
        }
        if (r.includes('3 caract') || r.includes('username')) {
            return { message: '⚠️ Le pseudo doit contenir au moins 3 caractères.' };
        }
        if (r.includes('6 caract') || r.includes('password') || r.includes('mot de passe')) {
            return { message: '⚠️ Le mot de passe doit contenir au moins 6 caractères.' };
        }
    }

    // Generic server error
    if (r.includes('500') || r.includes('internal')) {
        return {
            message: '🔧 Erreur interne du serveur.',
            hint: 'Notre serveur rencontre un problème. Réessayez dans quelques instants.',
        };
    }

    // Fallback: show raw message cleaned up
    return { message: raw.charAt(0).toUpperCase() + raw.slice(1) };
}

export default function LoginPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, login, register, continueAsGuest } = useAuth();

    const [tab, setTab] = useState<Tab>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
    const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string; email?: string }>({});
    const [submitting, setSubmitting] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate('/projects', { replace: true });
        }
    }, [isAuthenticated, isLoading, navigate]);

    /** Client-side validation before hitting the API */
    const validate = (): boolean => {
        const errs: typeof fieldErrors = {};
        if (!username.trim()) {
            errs.username = 'Le nom d\'utilisateur est requis.';
        } else if (tab === 'register' && username.trim().length < 3) {
            errs.username = 'Minimum 3 caractères.';
        }
        if (!password) {
            errs.password = 'Le mot de passe est requis.';
        } else if (tab === 'register' && password.length < 6) {
            errs.password = 'Minimum 6 caractères.';
        }
        if (tab === 'register' && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errs.email = 'Adresse e-mail invalide.';
        }
        setFieldErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        if (!validate()) return;
        setSubmitting(true);
        try {
            if (tab === 'login') {
                await login(username.trim(), password);
            } else {
                await register(username.trim(), password, email.trim() || undefined);
            }
            navigate('/projects', { replace: true });
        } catch (err: any) {
            const raw: string = err.message || 'Une erreur est survenue.';
            setError(parseAuthError(raw, tab));
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
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .sr-input:focus { border-color: #2563EB !important; box-shadow: 0 0 0 2px rgba(37,99,235,0.15) !important; }
                .sr-submit:hover:not(:disabled) { background: #1D4ED8 !important; }
                .sr-guest:hover { border-color: #3F3F46 !important; color: #FAFAFA !important; }
            `}</style>

            <div style={styles.card}>
                {/* ── Wordmark ── */}
                <div style={styles.wordmark}>
                    <FleurDeLysLogo size={48} color="#6EC97E" />
                    <div style={styles.wordmarkText}>
                        <span style={styles.wordScout}>Scout</span>
                        <span style={styles.wordRaider}>Raider</span>
                        <span style={styles.versionBadge}>v{version}</span>
                    </div>
                    <p style={styles.tagline}>Suite de cartographie tactique</p>
                </div>

                {/* ── Tabs ── */}
                <div style={styles.tabRow}>
                    <button
                        style={{ ...styles.tabBtn, ...(tab === 'login' ? styles.tabBtnActive : {}) }}
                        onClick={() => { setTab('login'); setError(null); setFieldErrors({}); }}
                        type="button"
                    >
                        Connexion
                    </button>
                    <button
                        style={{ ...styles.tabBtn, ...(tab === 'register' ? styles.tabBtnActive : {}) }}
                        onClick={() => { setTab('register'); setError(null); setFieldErrors({}); }}
                        type="button"
                    >
                        Inscription
                    </button>
                </div>

                {/* ── Form ── */}
                <form onSubmit={handleSubmit} style={styles.form}>
                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Nom d'utilisateur</label>
                        <input
                            className="sr-input"
                            style={{ ...styles.input, ...(fieldErrors.username ? styles.inputError : {}) }}
                            type="text"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            placeholder={tab === 'login' ? 'scout_raider' : 'mon_pseudo'}
                            autoComplete="username"
                        />
                        {fieldErrors.username && (
                            <span style={styles.fieldError}>{fieldErrors.username}</span>
                        )}
                    </div>

                    {tab === 'register' && (
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>
                                E-mail <span style={styles.optional}>(optionnel)</span>
                            </label>
                            <input
                                className="sr-input"
                                style={{ ...styles.input, ...(fieldErrors.email ? styles.inputError : {}) }}
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="email@exemple.fr"
                                autoComplete="email"
                            />
                            {fieldErrors.email && (
                                <span style={styles.fieldError}>{fieldErrors.email}</span>
                            )}
                        </div>
                    )}

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Mot de passe</label>
                        <input
                            className="sr-input"
                            style={{ ...styles.input, ...(fieldErrors.password ? styles.inputError : {}) }}
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                        />
                        {fieldErrors.password && (
                            <span style={styles.fieldError}>{fieldErrors.password}</span>
                        )}
                    </div>

                    {error && (
                        <div style={styles.errorBox}>
                            <div>{error.message}</div>
                            {error.hint && (
                                <div style={styles.errorHint}>
                                    {error.hint}
                                    {tab === 'login' && error.message.includes('incorrect') && (
                                        <> —{' '}
                                            <button
                                                type="button"
                                                style={styles.errorLink}
                                                onClick={() => { setTab('register'); setError(null); setFieldErrors({}); }}
                                            >
                                                Créer un compte
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        className="sr-submit"
                        style={{ ...styles.submitBtn, opacity: submitting ? 0.65 : 1 }}
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting
                            ? (tab === 'login' ? 'Connexion…' : 'Inscription…')
                            : (tab === 'login' ? 'Se connecter' : "S'inscrire")}
                    </button>
                </form>

                {/* ── Divider ── */}
                <div style={styles.divider}>
                    <span style={styles.dividerLine} />
                    <span style={styles.dividerText}>ou</span>
                    <span style={styles.dividerLine} />
                </div>

                {/* ── Guest ── */}
                <button className="sr-guest" style={styles.guestBtn} onClick={handleGuest} type="button">
                    Continuer en tant qu'invité
                </button>

                <p style={styles.disclaimer}>
                    Vos données locales sont préservées en mode invité.
                </p>
            </div>
        </div>
    );
}

/* ── Styles — charte graphique ScoutRaider ──────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
    page: {
        minHeight: '100vh',
        background: '#09090B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    },
    card: {
        width: '100%',
        maxWidth: '400px',
        background: '#1C1C21',
        border: '1px solid #27272A',
        borderRadius: '18px',
        padding: '40px 32px 32px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.85)',
    },
    wordmark: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '36px',
    },
    wordmarkText: {
        display: 'flex',
        alignItems: 'baseline',
        gap: '0',
        lineHeight: 1,
        position: 'relative',
    },
    wordScout: {
        fontSize: '48px',
        fontWeight: 800,
        letterSpacing: '-2px',
        color: '#52525B',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    },
    wordRaider: {
        fontSize: '48px',
        fontWeight: 800,
        letterSpacing: '-2px',
        color: '#6EC97E',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    },
    versionBadge: {
        position: 'absolute',
        left: '100%',
        bottom: '6px',
        marginLeft: '6px',
        fontSize: '11px',
        fontWeight: 500,
        color: '#3F3F46',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap' as const,
    },
    tagline: {
        margin: 0,
        fontSize: '12px',
        color: '#52525B',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontWeight: 500,
    },
    tabRow: {
        display: 'flex',
        gap: '3px',
        background: '#121215',
        border: '1px solid #27272A',
        borderRadius: '12px',
        padding: '3px',
        marginBottom: '24px',
    },
    tabBtn: {
        flex: 1,
        padding: '8px 0',
        border: 'none',
        background: 'transparent',
        color: '#52525B',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: '9px',
        cursor: 'pointer',
        transition: 'all 120ms ease',
        fontFamily: 'inherit',
    },
    tabBtnActive: {
        background: '#27272A',
        color: '#FAFAFA',
        fontWeight: 600,
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
    },
    label: {
        fontSize: '12px',
        fontWeight: 600,
        color: '#A1A1AA',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
    },
    optional: {
        fontWeight: 400,
        color: '#52525B',
        textTransform: 'none',
        letterSpacing: 0,
    },
    input: {
        background: '#121215',
        border: '1px solid #27272A',
        borderRadius: '10px',
        padding: '10px 12px',
        color: '#FAFAFA',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        width: '100%',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
    },
    errorBox: {
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: '10px',
        padding: '10px 12px',
        color: '#FCA5A5',
        fontSize: '13px',
    },
    errorHint: {
        marginTop: '6px',
        paddingTop: '6px',
        borderTop: '1px solid rgba(239,68,68,0.2)',
        fontSize: '12px',
        color: 'rgba(252,165,165,0.8)',
    },
    errorLink: {
        background: 'none',
        border: 'none',
        color: '#6EC97E',
        cursor: 'pointer',
        padding: 0,
        fontSize: '12px',
        textDecoration: 'underline',
    },
    inputError: {
        borderColor: 'rgba(239,68,68,0.6)',
        background: 'rgba(239,68,68,0.05)',
    },
    fieldError: {
        fontSize: '11px',
        color: '#fca5a5',
        marginTop: '-2px',
        display: 'block',
    },
    submitBtn: {
        background: '#2563EB',
        color: '#FFFFFF',
        border: 'none',
        borderRadius: '10px',
        padding: '12px',
        fontSize: '14px',
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'background 120ms ease, opacity 120ms ease',
        marginTop: '4px',
        fontFamily: 'inherit',
        letterSpacing: '0.02em',
    },
    divider: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        margin: '22px 0',
    },
    dividerLine: {
        flex: 1,
        height: '1px',
        background: '#27272A',
        display: 'block',
    },
    dividerText: {
        fontSize: '11px',
        color: '#3F3F46',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
    },
    guestBtn: {
        width: '100%',
        background: 'transparent',
        border: '1px solid #27272A',
        borderRadius: '10px',
        padding: '10px',
        color: '#71717A',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'border-color 120ms ease, color 120ms ease',
        fontFamily: 'inherit',
        fontWeight: 500,
    },
    disclaimer: {
        textAlign: 'center',
        fontSize: '11px',
        color: '#3F3F46',
        marginTop: '16px',
        marginBottom: 0,
    },
    loadingContainer: {
        minHeight: '100vh',
        background: '#09090B',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    spinner: {
        width: '28px',
        height: '28px',
        border: '2px solid #27272A',
        borderTopColor: '#2563EB',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
    },
};

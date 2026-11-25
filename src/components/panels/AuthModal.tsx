/**
 * AuthModal.tsx — Login / Registration / Guest Selection Modal.
 */

import React, { useId, useState } from 'react';
import { User, Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { useAuth } from '../../AuthContext';
import Modal from '../common/Modal';

export default function AuthModal({ onClose }: { onClose: () => void }) {
    const { login, register, continueAsGuest } = useAuth();
    const usernameId = useId();
    const emailId = useId();
    const passwordId = useId();

    const [tab, setTab] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (tab === 'login') {
                await login(username, password);
            } else {
                await register(username, password, email || undefined);
            }
            onClose();
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            title={tab === 'login' ? 'Connexion' : 'Créer un compte'}
            onClose={onClose}
            maxWidth="400px"
        >
                {/* Tabs */}
                <div
                    role="tablist"
                    aria-label="Mode d'authentification"
                    style={{
                        display: 'flex',
                        padding: '2px',
                        margin: '12px 16px 0',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        gap: '2px'
                    }}
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'login'}
                        onClick={() => { setTab('login'); setError(null); }}
                        style={{
                            flex: 1,
                            padding: '5px 8px',
                            background: tab === 'login' ? 'var(--bg-elevated)' : 'transparent',
                            color: tab === 'login' ? 'var(--text-primary)' : 'var(--text-dim)',
                            fontWeight: tab === 'login' ? 600 : 400,
                            fontSize: '11.5px',
                            border: tab === 'login' ? '1px solid var(--border-subtle)' : '1px solid transparent',
                            borderRadius: 'var(--radius-xs)',
                            cursor: 'pointer',
                            boxShadow: tab === 'login' ? 'var(--shadow-sm)' : 'none',
                            transition: 'all 100ms ease'
                        }}
                    >
                        Se connecter
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={tab === 'register'}
                        onClick={() => { setTab('register'); setError(null); }}
                        style={{
                            flex: 1,
                            padding: '5px 8px',
                            background: tab === 'register' ? 'var(--bg-elevated)' : 'transparent',
                            color: tab === 'register' ? 'var(--text-primary)' : 'var(--text-dim)',
                            fontWeight: tab === 'register' ? 600 : 400,
                            fontSize: '11.5px',
                            border: tab === 'register' ? '1px solid var(--border-subtle)' : '1px solid transparent',
                            borderRadius: 'var(--radius-xs)',
                            cursor: 'pointer',
                            boxShadow: tab === 'register' ? 'var(--shadow-sm)' : 'none',
                            transition: 'all 100ms ease'
                        }}
                    >
                        S'inscrire
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div
                        role="alert"
                        style={{
                            margin: '12px 16px 0',
                            padding: '8px 12px',
                            background: 'var(--semantic-danger-bg)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--semantic-danger)',
                            fontSize: '11.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <ShieldAlert size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label htmlFor={usernameId} style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '5px' }}>
                            {tab === 'login' ? "Nom d'utilisateur ou email" : "Nom d'utilisateur"}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                            <input
                                id={usernameId}
                                name="username"
                                type="text"
                                required
                                autoComplete="username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder={tab === 'login' ? "ex: pierre ou pierre@raid.fr" : "ex: scout_75"}
                                style={{
                                    width: '100%',
                                    padding: '7px 10px 7px 32px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {tab === 'register' && (
                        <div>
                            <label htmlFor={emailId} style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '5px' }}>
                                Adresse email (optionnel)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                                <input
                                    id={emailId}
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="ex: scout@raider.fr"
                                    style={{
                                        width: '100%',
                                        padding: '7px 10px 7px 32px',
                                        background: 'var(--bg-surface)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 'var(--radius-sm)',
                                        color: 'var(--text-primary)',
                                        fontSize: '12px',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label htmlFor={passwordId} style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '5px' }}>
                            Mot de passe
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-dim)', pointerEvents: 'none' }} />
                            <input
                                id={passwordId}
                                name="password"
                                type="password"
                                required
                                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '7px 10px 7px 32px',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-sm)',
                                    color: 'var(--text-primary)',
                                    fontSize: '12px',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '4px',
                            height: '34px',
                            background: 'var(--accent-primary)',
                            color: 'var(--accent-primary-text)',
                            fontWeight: 600,
                            fontSize: '12px',
                            border: '1px solid var(--accent-primary)',
                            borderRadius: 'var(--radius-sm)',
                            cursor: loading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 100ms ease',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Chargement...' : (tab === 'login' ? 'Se connecter' : 'Créer mon compte')}
                        <ArrowRight size={14} aria-hidden="true" />
                    </button>
                </form>

                {/* Guest Mode Section */}
                <div style={{
                    margin: '0 16px 16px',
                    padding: '10px 12px',
                    background: 'var(--bg-surface)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Mode Invité :</strong> Vos modifications restent stockées uniquement en local.
                    </div>
                    <button
                        type="button"
                        onClick={() => { continueAsGuest(); onClose(); }}
                        style={{
                            padding: '5px 10px',
                            background: 'transparent',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-dim)',
                            fontSize: '11.5px',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 100ms ease'
                        }}
                    >
                        Continuer en tant qu'invité
                    </button>
                </div>
        </Modal>
    );
}

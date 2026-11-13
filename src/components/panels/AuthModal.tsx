/**
 * AuthModal.tsx — Login / Registration / Guest Selection Modal.
 */

import React, { useState } from 'react';
import { X, User, Lock, Mail, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '../../AuthContext';

export default function AuthModal({ onClose }: { onClose: () => void }) {
    const { login, register, continueAsGuest } = useAuth();

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
                    maxWidth: '400px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
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
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border-subtle)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {tab === 'login' ? 'Connexion' : 'Créer un compte'}
                        </span>
                    </div>
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
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    padding: '2px',
                    margin: '12px 16px 0',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    gap: '2px'
                }}>
                    <button
                        type="button"
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
                    <div style={{
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
                    }}>
                        <ShieldAlert size={14} style={{ flexShrink: 0 }} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '5px' }}>
                            {tab === 'login' ? "Nom d'utilisateur ou email" : "Nom d'utilisateur"}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-dim)' }} />
                            <input 
                                type="text"
                                required
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
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {tab === 'register' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '5px' }}>
                                Adresse email (optionnel)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-dim)' }} />
                                <input 
                                    type="email"
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
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', marginBottom: '5px' }}>
                            Mot de passe
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-dim)' }} />
                            <input 
                                type="password"
                                required
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
                                    outline: 'none',
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
                        <ArrowRight size={14} />
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
                        onClick={continueAsGuest}
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
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--border-strong)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            e.currentTarget.style.color = 'var(--text-dim)';
                        }}
                    >
                        Continuer en tant qu'invité
                    </button>
                </div>
            </div>
        </div>
    );
}

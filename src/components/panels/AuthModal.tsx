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
                    maxWidth: '430px',
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
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                            {tab === 'login' ? 'Connexion' : 'Créer un compte'}
                        </span>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            cursor: 'pointer',
                            padding: '4px'
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div style={{
                    display: 'flex',
                    padding: '6px',
                    margin: '16px 20px 0',
                    background: 'rgba(255,255,255,0.04)',
                    borderRadius: '10px',
                    gap: '4px'
                }}>
                    <button
                        type="button"
                        onClick={() => { setTab('login'); setError(null); }}
                        style={{
                            flex: 1,
                            padding: '8px',
                            background: tab === 'login' ? 'var(--accent-default)' : 'transparent',
                            color: tab === 'login' ? '#0a100d' : 'rgba(255,255,255,0.6)',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        Se connecter
                    </button>
                    <button
                        type="button"
                        onClick={() => { setTab('register'); setError(null); }}
                        style={{
                            flex: 1,
                            padding: '8px',
                            background: tab === 'register' ? 'var(--accent-default)' : 'transparent',
                            color: tab === 'register' ? '#0a100d' : 'rgba(255,255,255,0.6)',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        S'inscrire
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div style={{
                        margin: '14px 20px 0',
                        padding: '10px 14px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#fca5a5',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <ShieldAlert size={16} flexShrink={0} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                            {tab === 'login' ? "Nom d'utilisateur ou email" : "Nom d'utilisateur"}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'rgba(255,255,255,0.3)' }} />
                            <input 
                                type="text"
                                required
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder={tab === 'login' ? "ex: pierre ou pierre@raid.fr" : "ex: scout_75"}
                                style={{
                                    width: '100%',
                                    padding: '9px 12px 9px 36px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '13px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {tab === 'register' && (
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                                Adresse email (optionnel)
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'rgba(255,255,255,0.3)' }} />
                                <input 
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="ex: scout@raider.fr"
                                    style={{
                                        width: '100%',
                                        padding: '9px 12px 9px 36px',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        color: '#fff',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>
                            Mot de passe
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={15} style={{ position: 'absolute', left: '12px', top: '11px', color: 'rgba(255,255,255,0.3)' }} />
                            <input 
                                type="password"
                                required
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{
                                    width: '100%',
                                    padding: '9px 12px 9px 36px',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    color: '#fff',
                                    fontSize: '13px',
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
                            marginTop: '8px',
                            padding: '11px',
                            background: 'var(--accent-default)',
                            color: '#0a100d',
                            fontWeight: 800,
                            fontSize: '13px',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: loading ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'opacity 0.15s ease',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Chargement...' : (tab === 'login' ? 'Se connecter' : 'Créer mon compte')}
                        <ArrowRight size={15} />
                    </button>
                </form>

                {/* Guest Mode Section */}
                <div style={{
                    margin: '0 20px 20px',
                    padding: '14px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
                        <strong style={{ color: 'rgba(255,255,255,0.85)' }}>Mode Invité :</strong> Vos modifications restent uniquement dans votre navigateur en session locale. Aucune sauvegarde n'est effectuée sur le serveur.
                    </div>
                    <button
                        type="button"
                        onClick={continueAsGuest}
                        style={{
                            padding: '7px 12px',
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            borderRadius: '6px',
                            color: 'rgba(255,255,255,0.8)',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    >
                        Continuer en tant qu'invité (sans sauvegarde)
                    </button>
                </div>
            </div>
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Boxes,
  User,
  LogOut,
  FolderOpen,
  Minus,
  Maximize2,
  X,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useViewport } from '../hooks';
import FleurDeLysLogo from '../components/layout/FleurDeLysLogo';
import UnifiedResourceHub from '../components/panels/UnifiedResourceHub';

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { user, isGuest, cloudSyncStatus, logout, setAuthModalOpen } = useAuth();
  const { isMobile } = useViewport();

  // User menu state & ref for click-away
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/projects');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleWindowControl = (action: string) => {
    (window as any).electronAPI?.windowControl(action);
  };

  return (
    <div style={{
      height: '100dvh',
      background: 'var(--bg-base)',
      color: 'var(--text-default)',
      fontFamily: 'var(--font-ui)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* ── Top Navigation Bar (consistent 56px bar matching ProjectsHomePage) ── */}
      <header
        style={{
          height: '56px',
          userSelect: 'none',
          background: 'var(--bg-dark)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 clamp(16px, 3vw, 32px)',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 2000,
          flexShrink: 0,
          WebkitAppRegion: 'drag'
        } as any}
      >
        {/* LEFT: BACK BUTTON, LOGO & TITLE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, WebkitAppRegion: 'no-drag' } as any}>
          <button
            type="button"
            onClick={handleBack}
            className="sr-btn-secondary"
            style={{ padding: isMobile ? '0 8px' : '0 10px' }}
            title="Retour"
            aria-label="Retour"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {!isMobile && <span>Retour</span>}
          </button>

          <button
            type="button"
            title="Retour aux projets"
            aria-label="Retour aux projets"
            onClick={() => navigate('/projects')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
              padding: '2px',
              background: 'transparent',
              border: 'none',
            }}
          >
            <FleurDeLysLogo size={24} color="var(--accent-primary)" />
          </button>

          <span style={{
            fontSize: '15px',
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            Marketplace
          </span>
        </div>

        {/* RIGHT: USER PROFILE & WINDOW CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, WebkitAppRegion: 'no-drag' } as any}>
          {/* User Profile avatar */}
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            {!isGuest && user ? (
              <button
                type="button"
                className="sr-btn-secondary"
                onClick={() => setUserMenuOpen(prev => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                title={`Connecté en tant que ${user.username}`}
                style={{ padding: '0 10px 0 6px' }}
              >
                <span style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'var(--accent-transparent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-hover)',
                  fontSize: '11px',
                  fontWeight: 700
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </span>
                {!isMobile && <span>{user.username}</span>}
              </button>
            ) : (
              <button
                type="button"
                className="sr-btn-secondary"
                onClick={() => setAuthModalOpen(true)}
                title="Se connecter"
              >
                <User size={13} aria-hidden="true" />
                <span>Connexion</span>
              </button>
            )}

            {/* User dropdown */}
            {userMenuOpen && !isGuest && user && (
              <div role="menu" style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '180px',
                padding: '4px 0',
                zIndex: 3500
              }}>
                <button
                  type="button"
                  role="menuitem"
                  className="sr-menu-item"
                  onClick={() => {
                    navigate('/projects');
                    setUserMenuOpen(false);
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <FolderOpen size={13} color="var(--text-dim)" aria-hidden="true" />
                    Mes projets
                  </span>
                </button>
                <div role="separator" style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                <button
                  type="button"
                  role="menuitem"
                  className="sr-menu-item"
                  onClick={() => {
                    handleLogout();
                    setUserMenuOpen(false);
                  }}
                  style={{ color: 'var(--semantic-danger)' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <LogOut size={13} aria-hidden="true" />
                    Se déconnecter
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Electron window controls if desktop app */}
          {(window as any).electronAPI && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
              <button
                type="button"
                className="btn-icon"
                aria-label="Réduire la fenêtre"
                onClick={() => handleWindowControl('minimize')}
              >
                <Minus size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label="Agrandir la fenêtre"
                onClick={() => handleWindowControl('maximize')}
              >
                <Maximize2 size={12} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn-icon"
                aria-label="Fermer la fenêtre"
                onClick={() => handleWindowControl('close')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Unified Resource Hub ── */}
      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <UnifiedResourceHub
          initialCategory="all"
          isCompact={false}
        />
      </main>
    </div>
  );
}

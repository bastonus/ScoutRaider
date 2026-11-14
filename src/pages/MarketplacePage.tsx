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
import FleurDeLysLogo from '../components/layout/FleurDeLysLogo';
import UnifiedResourceHub from '../components/panels/UnifiedResourceHub';

export default function MarketplacePage() {
  const navigate = useNavigate();
  const { user, isGuest, cloudSyncStatus, logout, setAuthModalOpen } = useAuth();

  // Responsive window width tracking
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;

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
      {/* ── Top Navigation Bar ── */}
      <header
        className="menu-bar"
        style={{
          height: isMobile ? '46px' : '54px',
          userSelect: 'none',
          background: 'var(--bg-dark)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          padding: isMobile ? '0 8px' : '0 16px',
          justifyContent: 'space-between',
          zIndex: 2000,
          flexShrink: 0,
          WebkitAppRegion: 'drag'
        } as any}
      >
        {/* LEFT: BACK BUTTON, LOGO, TITLE & BADGE */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '10px', flexShrink: 0, WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={handleBack}
            className="btn-icon btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: isMobile ? '4px' : '4px 8px',
              height: '28px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--text-dim)',
              fontSize: '11.5px',
              cursor: 'pointer',
              transition: 'all 100ms ease'
            }}
            title="Retour à l'éditeur"
          >
            <ArrowLeft size={14} />
            {!isMobile && <span>Retour</span>}
          </button>

          <div
            title="Retour aux projets"
            onClick={() => navigate('/projects')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
              padding: '2px',
            }}
          >
            <FleurDeLysLogo size={isMobile ? 22 : 28} color="#2563EB" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: isMobile ? '13px' : '14.5px', fontWeight: 700, color: 'var(--text-bright)' }}>
                Marketplace & Hub
              </span>
              <span style={{
                fontSize: '9.5px',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: '4px',
                background: 'rgba(37,99,235,0.15)',
                border: '1px solid rgba(37,99,235,0.3)',
                color: 'var(--accent-hover)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Ressources
              </span>
            </div>
            {!isMobile && (
              <span style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>
                Catalogue officiel et communautaire pour vos carnets de raid
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: USER PROFILE & WINDOW CONTROLS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', WebkitAppRegion: 'no-drag' } as any}>
          {/* User Profile avatar */}
          <div style={{ position: 'relative' }} ref={userMenuRef}>
            {!isGuest && user ? (
              <button
                onClick={() => setUserMenuOpen(prev => !prev)}
                title={`Connecté en tant que ${user.username}`}
                style={{
                  height: '28px',
                  borderRadius: '14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 8px 0 6px',
                  color: 'var(--text-primary)',
                  fontSize: '11.5px',
                  fontWeight: 600
                }}
              >
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'var(--accent-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '10px',
                  fontWeight: 700
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                {!isMobile && <span>{user.username}</span>}
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                title="Se connecter"
                style={{
                  height: '28px',
                  borderRadius: 'var(--radius-xs)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 10px',
                  color: 'var(--text-dim)',
                  fontSize: '11.5px'
                }}
              >
                <User size={13} />
                <span>Connexion</span>
              </button>
            )}

            {/* User dropdown */}
            {userMenuOpen && !isGuest && user && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: '180px',
                padding: '4px 0',
                zIndex: 3500
              }}>
                <div
                  onClick={() => {
                    navigate('/projects');
                    setUserMenuOpen(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px' }}
                >
                  <FolderOpen size={13} color="var(--text-dim)" />
                  <span>Mes projets</span>
                </div>
                <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                <div
                  onClick={() => {
                    handleLogout();
                    setUserMenuOpen(false);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', color: 'var(--semantic-danger)' }}
                >
                  <LogOut size={13} />
                  <span>Se déconnecter</span>
                </div>
              </div>
            )}
          </div>

          {/* Electron window controls if desktop app */}
          {(window as any).electronAPI && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '6px' }}>
              <button
                onClick={() => handleWindowControl('minimize')}
                style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Minus size={13} />
              </button>
              <button
                onClick={() => handleWindowControl('maximize')}
                style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Maximize2 size={12} />
              </button>
              <button
                onClick={() => handleWindowControl('close')}
                style={{ width: '28px', height: '28px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Unified Resource Hub ── */}
      <main style={{ flex: 1, height: 'calc(100dvh - 54px)', overflow: 'hidden' }}>
        <UnifiedResourceHub
          initialCategory="all"
          isCompact={false}
        />
      </main>
    </div>
  );
}

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom';
import MenuBar from './components/layout/MenuBar';
import ProjectWorkspace from './components/layout/ProjectWorkspace';
import RightSidebar from './components/layout/RightSidebar';
import NotificationOverlay from './components/map/NotificationOverlay';
import ExportModal from './components/panels/ExportModal';
import PreferencesModal from './components/panels/PreferencesModal';
import MarketplaceModal from './components/panels/MarketplaceModal';
import UnifiedResourceHub from './components/panels/UnifiedResourceHub';
import AuthModal from './components/panels/AuthModal';
import ProjectsDashboardModal from './components/panels/ProjectsDashboardModal';
import ShareModal from './components/panels/ShareModal';
import DocAccessDeniedModal from './components/panels/DocAccessDeniedModal';
import CommandPalette from './components/layout/CommandPalette';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';
import { useViewport } from './hooks';

export type ViewMode = 'map' | 'text' | 'split';

export type SectionId = 'layers' | 'orchestration' | 'themes' | 'modules' | 'maps' | 'export';

function App() {
  const navigate = useNavigate();
  const { isTablet: isMobileOrTablet } = useViewport();

  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [, setActiveRightSection] = useState<SectionId>('layers');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [marketplaceModalOpen, setMarketplaceModalOpen] = useState(false);
  const [mobileMarketplaceOpen, setMobileMarketplaceOpen] = useState(false);
  const { 
    authModalOpen, 
    setAuthModalOpen, 
    projectsModalOpen, 
    setProjectsModalOpen,
    shareModalOpen,
    setShareModalOpen,
    accessDenied,
    clearAccessDenied
  } = useAuth();

  const [rightWidth, setRightWidth] = useState(460);
  const rightResizing = useRef(false);

  const prevMobileRef = useRef(isMobileOrTablet);
  useEffect(() => {
    if (!prevMobileRef.current && isMobileOrTablet) {
      setRightSidebarOpen(false);
    }
    prevMobileRef.current = isMobileOrTablet;
  }, [isMobileOrTablet]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (rightResizing.current) {
        setRightWidth(Math.max(200, Math.min(600, window.innerWidth - e.clientX)));
      }
    };
    const handleMouseUp = () => {
      rightResizing.current = false;
      document.body.style.cursor = 'default';
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const { state, dispatch } = useApp();

  // Keep document title synchronized with package version
  useEffect(() => {
    const version = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : 'v0.3.14';
    const title = state.document_title || 'Document sans titre';
    document.title = `${title} — ScoutRaider ${version}`;
  }, [state.document_title]);

  // Keyboard shortcuts for panel toggling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey) {
            if (e.key === '[') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('scoutraider:toggle-route-panel'));
            } else if (e.key === ']') {
                e.preventDefault();
                setRightSidebarOpen(prev => !prev);
            }
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSidebar = (side: 'left' | 'right') => {
    if (side === 'left') {
      window.dispatchEvent(new CustomEvent('scoutraider:toggle-route-panel'));
    } else if (side === 'right') {
      setRightSidebarOpen(!rightSidebarOpen);
    }
  };

  // Global listener for marketplace trigger (mobile sheet or desktop modal)
  useEffect(() => {
    const handleOpenMarketplace = () => {
      if (isMobileOrTablet) {
        setMobileMarketplaceOpen(true);
      } else {
        setMarketplaceModalOpen(true);
      }
    };
    window.addEventListener('scoutraider:open-marketplace', handleOpenMarketplace);
    return () => window.removeEventListener('scoutraider:open-marketplace', handleOpenMarketplace);
  }, [isMobileOrTablet]);

  const handleExportRequest = useCallback(() => {
    setExportModalOpen(true);
  }, []);

  useEffect(() => {
    const h = () => setExportModalOpen(true);
    window.addEventListener('scoutraider:open-export', h);
    return () => window.removeEventListener('scoutraider:open-export', h);
  }, []);

  // Global Ctrl+E
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setExportModalOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Global Ctrl+, (Preferences)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setPreferencesModalOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Global Ctrl+M (Marketplace)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        navigate('/marketplace');
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [navigate]);

  // Global Ctrl+K (Command Palette)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Global Quick Shortcuts for views, route inversion, and tools
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // View switching: Ctrl+1 (or Digit1), Ctrl+2 (or Digit2), Ctrl+3 (or Digit3)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        if (e.key === '1' || e.code === 'Digit1') {
          e.preventDefault();
          setViewMode('map');
          return;
        }
        if (e.key === '2' || e.code === 'Digit2') {
          e.preventDefault();
          setViewMode('text');
          return;
        }
        if (e.key === '3' || e.code === 'Digit3') {
          e.preventDefault();
          setViewMode('split');
          return;
        }
      }

      // Quick actions (only when not typing in text fields)
      if (!isInput) {
        // Ctrl+I: Invert route
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'i') {
          e.preventDefault();
          dispatch({ type: 'INVERT_ROUTE' });
          return;
        }
        // Ctrl+Shift+A: Toggle Elevation profile
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' });
          return;
        }
        // Ctrl+Shift+M: Toggle General Map in carnet
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_GENERAL_MAP' });
          return;
        }
        // Ctrl+Shift+P: Toggle POIs
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_POIS_ON_MAP' });
          return;
        }
        // Ctrl+Shift+D: Toggle Dangers
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          dispatch({ type: 'TOGGLE_DANGERS_ON_MAP' });
          return;
        }
        // Alt+S: Toggle Carnet Participant / Solution view
        if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 's') {
          e.preventDefault();
          dispatch({ type: 'SET_CARNET_VIEW', view: state.carnet_view === 'participant' ? 'solution' : 'participant' });
          return;
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [dispatch, state.carnet_view]);

  return (
    <div className="app-shell" style={{ 
      height: '100dvh', 
      minHeight: '100vh',
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      background: 'var(--bg-base)'
    }}>
      <MenuBar 
        onToggleSidebar={toggleSidebar} 
        rightSidebarOpen={rightSidebarOpen}
        viewMode={viewMode} 
        onViewModeChange={setViewMode} 
        onExport={handleExportRequest} 
        onPreferencesOpen={() => setPreferencesModalOpen(true)}
        onSetRightSection={setActiveRightSection}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenMarketplace={() => toggleSidebar('right')}
      />
      
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* MAIN WORKSPACE */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          <ProjectWorkspace 
            onExport={handleExportRequest} 
            viewMode={viewMode} 
            onViewModeChange={setViewMode}
            onToggleSidebar={toggleSidebar} 
            rightSidebarOpen={rightSidebarOpen} 
          />
        </main>

        {/* DESKTOP RIGHT SIDEBAR: Marketplace & Ressources */}
        {!isMobileOrTablet && rightSidebarOpen && (
          <>
            {/* Right Resizer */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Redimensionner le panneau Ressources"
              aria-valuenow={rightWidth}
              aria-valuemin={200}
              aria-valuemax={600}
              tabIndex={0}
              onMouseDown={(e) => { e.preventDefault(); rightResizing.current = true; document.body.style.cursor = 'col-resize'; }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft') { e.preventDefault(); setRightWidth(w => Math.min(600, w + 24)); }
                if (e.key === 'ArrowRight') { e.preventDefault(); setRightWidth(w => Math.max(200, w - 24)); }
              }}
              style={{ width: '4px', cursor: 'col-resize', background: 'var(--bg-border)', zIndex: 10, marginLeft: '-2px', marginRight: '-2px' }}
            />
            <RightSidebar 
              width={rightWidth} 
              onClose={() => setRightSidebarOpen(false)}
              onMarketplaceOpen={() => {
                setRightSidebarOpen(false);
                setMarketplaceModalOpen(true);
              }}
              onPreferencesOpen={() => setPreferencesModalOpen(true)}
            />
          </>
        )}

      </div>

      {/* MOBILE / TABLET BOTTOM SHEET (CALQUES PURE: NO TITLES, NO BUTTONS, NO DIVIDERS ABOVE) */}
      {isMobileOrTablet && rightSidebarOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setRightSidebarOpen(false)} aria-hidden="true" />
          <div className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Marketplace et Ressources">
            <button
              type="button"
              className="bottom-sheet-handle-zone"
              onClick={() => setRightSidebarOpen(false)}
              aria-label="Fermer le volet"
              style={{ width: '100%', background: 'transparent', border: 'none' }}
            >
              <div className="bottom-sheet-handle-bar" />
            </button>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
              <RightSidebar width="100%" />
            </div>
          </div>
        </>
      )}

      {/* MOBILE MARKETPLACE BOTTOM SHEET (DÉROULANT DU BAS SUR MOBILE) */}
      {isMobileOrTablet && mobileMarketplaceOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setMobileMarketplaceOpen(false)} aria-hidden="true" />
          <div className="bottom-sheet-panel" role="dialog" aria-modal="true" aria-label="Marketplace" style={{ height: '80dvh', maxHeight: '88dvh' }}>
            <button
              type="button"
              className="bottom-sheet-handle-zone"
              onClick={() => setMobileMarketplaceOpen(false)}
              aria-label="Fermer le volet"
              style={{ width: '100%', background: 'transparent', border: 'none' }}
            >
              <div className="bottom-sheet-handle-bar" />
            </button>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', overscrollBehavior: 'contain' }}>
              <UnifiedResourceHub
                initialCategory="all"
                isCompact={false}
                onPreferencesOpen={() => {
                  setMobileMarketplaceOpen(false);
                  setPreferencesModalOpen(true);
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Global Notifications */}
      <NotificationOverlay />

      {/* Marketplace Modal (Desktop) */}
      {marketplaceModalOpen && <MarketplaceModal onClose={() => setMarketplaceModalOpen(false)} />}

      {/* Export Modal */}
      {exportModalOpen && <ExportModal onClose={() => setExportModalOpen(false)} />}

      {/* Preferences Modal */}
      {preferencesModalOpen && <PreferencesModal onClose={() => setPreferencesModalOpen(false)} />}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onViewModeChange={setViewMode}
        onExport={handleExportRequest}
        onPreferencesOpen={() => setPreferencesModalOpen(true)}
      />

      {/* Cloud Auth, Workspace, Access Control & Share Modals */}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
      {projectsModalOpen && <ProjectsDashboardModal onClose={() => setProjectsModalOpen(false)} />}
      {shareModalOpen && <ShareModal onClose={() => setShareModalOpen(false)} />}
      {accessDenied && (
        <DocAccessDeniedModal
          projectId={accessDenied.projectId}
          projectTitle={accessDenied.projectTitle}
          ownerUsername={accessDenied.ownerUsername}
          requiresAuth={accessDenied.requiresAuth}
          onClose={clearAccessDenied}
        />
      )}
    </div>
  );
}

export default App;

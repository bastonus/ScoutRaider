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
import { 
  PanelRightClose, 
  PanelRightOpen,
  PanelRight,
  FileText,
  Layers,
  X
} from 'lucide-react';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';

export type ViewMode = 'map' | 'text' | 'split';

export type SectionId = 'layers' | 'orchestration' | 'themes' | 'modules' | 'maps' | 'export';

function App() {
  const navigate = useNavigate();
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const isMobileOrTablet = windowWidth < 1024;

  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);
  const [activeRightSection, setActiveRightSection] = useState<SectionId>('layers');
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

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    const version = typeof __APP_VERSION__ !== 'undefined' ? `v${__APP_VERSION__}` : 'v0.3.3-beta';
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

  // Global Ctrl+P
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
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

  // Floating panel toggle button style on map
  // Height 40px, width 40px, radius 12px, top 16px to align perfectly with FloatingSearch (height 40px, top 16px)
  const mapPanelToggleStyle: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    zIndex: 900,
    width: '40px',
    height: '40px',
    padding: 0,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '12px',
    boxShadow: 'none',
    color: 'var(--text-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 100ms ease',
  };

  // Inline header bar toggle button style (in text / split mode)
  // Height 28px, width 28px, radius 6px to fit within the 40px header bar
  const inlinePanelToggleStyle: React.CSSProperties = {
    width: '28px',
    height: '28px',
    padding: 0,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xs)',
    color: 'var(--text-dim)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 100ms ease',
    flexShrink: 0,
  };

  // In text/split mode the toggle buttons sit outside the map, so we don't need
  // absolute-positioned overlays. We show them inline in the header band instead.
  const isTextMode = viewMode === 'text';
  const isSplitMode = viewMode === 'split';

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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          <ProjectWorkspace 
            onExport={handleExportRequest} 
            viewMode={viewMode} 
            onViewModeChange={setViewMode}
            onToggleSidebar={toggleSidebar} 
            rightSidebarOpen={rightSidebarOpen} 
          />
        </div>

        {/* DESKTOP RIGHT SIDEBAR: Marketplace & Ressources */}
        {!isMobileOrTablet && rightSidebarOpen && (
          <>
            {/* Right Resizer */}
            <div 
              onMouseDown={(e) => { e.preventDefault(); rightResizing.current = true; document.body.style.cursor = 'col-resize'; }}
              style={{ width: '4px', cursor: 'col-resize', background: 'var(--bg-border)', zIndex: 10, marginLeft: '-2px', marginRight: '-2px' }}
            />
            <RightSidebar 
              width={rightWidth} 
              onClose={() => setRightSidebarOpen(false)}
              onPreferencesOpen={() => setPreferencesModalOpen(true)}
            />
          </>
        )}

      </div>

      {/* MOBILE / TABLET BOTTOM SHEET (CALQUES PURE: NO TITLES, NO BUTTONS, NO DIVIDERS ABOVE) */}
      {isMobileOrTablet && rightSidebarOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setRightSidebarOpen(false)} />
          <div className="bottom-sheet-panel">
            <div className="bottom-sheet-handle-zone" onClick={() => setRightSidebarOpen(false)} role="button" aria-label="Fermer le volet">
              <div className="bottom-sheet-handle-bar" />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <RightSidebar width="100%" />
            </div>
          </div>
        </>
      )}

      {/* MOBILE MARKETPLACE BOTTOM SHEET (DÉROULANT DU BAS SUR MOBILE) */}
      {isMobileOrTablet && mobileMarketplaceOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setMobileMarketplaceOpen(false)} />
          <div className="bottom-sheet-panel" style={{ height: '80vh', maxHeight: '88vh' }}>
            <div className="bottom-sheet-handle-zone" onClick={() => setMobileMarketplaceOpen(false)} role="button" aria-label="Fermer le volet">
              <div className="bottom-sheet-handle-bar" />
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

import React, { useState, useRef, useEffect, useCallback } from 'react'
import MenuBar from './components/layout/MenuBar';
import ProjectWorkspace from './components/layout/ProjectWorkspace';
import LeftSidebarPanel from './components/panels/LeftSidebarPanel';
import RightSidebar from './components/layout/RightSidebar';
import NotificationOverlay from './components/map/NotificationOverlay';
import TextualHeader from './components/textual/TextualHeader';
import ExportModal from './components/panels/ExportModal';
import PreferencesModal from './components/panels/PreferencesModal';
import AuthModal from './components/panels/AuthModal';
import ProjectsDashboardModal from './components/panels/ProjectsDashboardModal';
import ShareModal from './components/panels/ShareModal';
import CommandPalette from './components/layout/CommandPalette';
import { 
  PanelLeftClose, 
  PanelLeftOpen, 
  PanelRightClose, 
  PanelRightOpen,
  PanelLeft,
  PanelRight,
  X
} from 'lucide-react';
import { useApp } from './AppContext';
import { useAuth } from './AuthContext';

export type ViewMode = 'map' | 'text' | 'split';

export type SectionId = 'layers' | 'orchestration' | 'themes' | 'modules' | 'maps' | 'export';

function App() {
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const isMobileOrTablet = windowWidth < 1024;

  const [leftSidebarOpen, setLeftSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [activeRightSection, setActiveRightSection] = useState<SectionId>('layers');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { 
    authModalOpen, 
    setAuthModalOpen, 
    projectsModalOpen, 
    setProjectsModalOpen,
    shareModalOpen,
    setShareModalOpen
  } = useAuth();

  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);

  const leftResizing = useRef(false);
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
      setLeftSidebarOpen(false);
      setRightSidebarOpen(false);
    }
    prevMobileRef.current = isMobileOrTablet;
  }, [isMobileOrTablet]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (leftResizing.current) {
        setLeftWidth(Math.max(200, Math.min(600, e.clientX)));
      } else if (rightResizing.current) {
        setRightWidth(Math.max(200, Math.min(600, window.innerWidth - e.clientX)));
      }
    };
    const handleMouseUp = () => {
      leftResizing.current = false;
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
                setLeftSidebarOpen(prev => !prev);
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
      if (isMobileOrTablet && !leftSidebarOpen) {
        setRightSidebarOpen(false);
      }
      setLeftSidebarOpen(!leftSidebarOpen);
    } else if (side === 'right') {
      if (isMobileOrTablet && !rightSidebarOpen) {
        setLeftSidebarOpen(false);
      }
      setRightSidebarOpen(!rightSidebarOpen);
    }
  };

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
    boxShadow: 'var(--shadow-lg)',
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
        viewMode={viewMode} 
        onViewModeChange={setViewMode} 
        onExport={handleExportRequest} 
        onPreferencesOpen={() => setPreferencesModalOpen(true)}
        onSetRightSection={setActiveRightSection}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />
      
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        
        {/* DESKTOP LEFT SIDEBAR: Itinerary */}
        {!isMobileOrTablet && leftSidebarOpen && (
          <>
            <div style={{ 
              width: `${leftWidth}px`, 
              flexShrink: 0, 
              display: 'flex', 
              flexDirection: 'column',
              background: 'var(--bg-panel)',
              borderRight: '1px solid var(--bg-border)',
              height: '100%',
              overflow: 'hidden'
            }}>
              <LeftSidebarPanel />
            </div>
            {/* Left Resizer */}
            <div 
              onMouseDown={(e) => { e.preventDefault(); leftResizing.current = true; document.body.style.cursor = 'col-resize'; }}
              style={{ width: '4px', cursor: 'col-resize', background: 'var(--bg-border)', zIndex: 10, marginLeft: '-2px', marginRight: '-2px' }}
            />
          </>
        )}

        {/* MAIN WORKSPACE */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', position: 'relative' }}>
          
          {isTextMode || isSplitMode ? (
            <div style={{
              display: 'flex', alignItems: 'center',
              padding: '0 12px',
              height: '40px',
              background: 'var(--bg-dark)',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0, zIndex: 900,
              gap: '10px'
            }}>
              <button
                onClick={() => toggleSidebar('left')}
                title={`${leftSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'itinéraire (Ctrl+[)`}
                style={inlinePanelToggleStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-dim)';
                }}
              >
                {leftSidebarOpen ? <PanelLeftClose size={15} strokeWidth={2} /> : <PanelLeftOpen size={15} strokeWidth={2} />}
              </button>
              
              <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
                <TextualHeader onExport={handleExportRequest} />
              </div>

              <button
                onClick={() => toggleSidebar('right')}
                title={`${rightSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'orchestration (Ctrl+])`}
                style={inlinePanelToggleStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-surface)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-dim)';
                }}
              >
                {rightSidebarOpen ? <PanelRightClose size={15} strokeWidth={2} /> : <PanelRightOpen size={15} strokeWidth={2} />}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => toggleSidebar('left')}
                title={`${leftSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'itinéraire (Ctrl+[)`}
                style={{ ...mapPanelToggleStyle, left: '16px' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-dim)';
                }}
              >
                {leftSidebarOpen ? <PanelLeftClose size={18} strokeWidth={2} /> : <PanelLeftOpen size={18} strokeWidth={2} />}
              </button>
              
              <button
                onClick={() => toggleSidebar('right')}
                title={`${rightSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'orchestration (Ctrl+])`}
                style={{ ...mapPanelToggleStyle, right: '16px' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-elevated)';
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.color = 'var(--text-dim)';
                }}
              >
                {rightSidebarOpen ? <PanelRightClose size={18} strokeWidth={2} /> : <PanelRightOpen size={18} strokeWidth={2} />}
              </button>
            </>
          )}

          <ProjectWorkspace onExport={handleExportRequest} viewMode={viewMode} />
        </div>

        {/* DESKTOP RIGHT SIDEBAR: Libraries */}
        {!isMobileOrTablet && rightSidebarOpen && (
          <>
            {/* Right Resizer */}
            <div 
              onMouseDown={(e) => { e.preventDefault(); rightResizing.current = true; document.body.style.cursor = 'col-resize'; }}
              style={{ width: '4px', cursor: 'col-resize', background: 'var(--bg-border)', zIndex: 10, marginLeft: '-2px', marginRight: '-2px' }}
            />
            <RightSidebar activeSection={activeRightSection} onSectionChange={setActiveRightSection} onPreferencesOpen={() => setPreferencesModalOpen(true)} width={rightWidth} />
          </>
        )}

      </div>

      {/* MOBILE / TABLET BOTTOM SHEETS (< 1024px) */}
      {isMobileOrTablet && leftSidebarOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setLeftSidebarOpen(false)} />
          <div className="bottom-sheet-panel">
            <div className="bottom-sheet-handle-bar" />
            <div className="bottom-sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                <PanelLeft size={16} color="var(--accent-default)" />
                <span>Itinéraire & Calque actif</span>
              </div>
              <button
                onClick={() => setLeftSidebarOpen(false)}
                aria-label="Fermer"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-xs)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <LeftSidebarPanel />
            </div>
          </div>
        </>
      )}

      {isMobileOrTablet && rightSidebarOpen && (
        <>
          <div className="bottom-sheet-backdrop" onClick={() => setRightSidebarOpen(false)} />
          <div className="bottom-sheet-panel">
            <div className="bottom-sheet-handle-bar" />
            <div className="bottom-sheet-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                <PanelRight size={16} color="var(--accent-default)" />
                <span>Calques & Orchestration</span>
              </div>
              <button
                onClick={() => setRightSidebarOpen(false)}
                aria-label="Fermer"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 'var(--radius-xs)' }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <RightSidebar activeSection={activeRightSection} onSectionChange={setActiveRightSection} onPreferencesOpen={() => setPreferencesModalOpen(true)} width="100%" />
            </div>
          </div>
        </>
      )}

      {/* Global Notifications */}
      <NotificationOverlay />

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

      {/* Cloud Auth, Workspace & Share Modals */}
      {authModalOpen && <AuthModal onClose={() => setAuthModalOpen(false)} />}
      {projectsModalOpen && <ProjectsDashboardModal onClose={() => setProjectsModalOpen(false)} />}
      {shareModalOpen && <ShareModal onClose={() => setShareModalOpen(false)} />}
    </div>
  );
}

export default App;

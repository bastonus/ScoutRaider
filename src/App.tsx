import React, { useState, useRef, useEffect, useCallback } from 'react'
import MenuBar from './components/layout/MenuBar';
import ProjectWorkspace from './components/layout/ProjectWorkspace';
import RoutePanel from './components/panels/RoutePanel';
import RightSidebar from './components/layout/RightSidebar';
import NotificationOverlay from './components/map/NotificationOverlay';
import TextualHeader from './components/textual/TextualHeader';
import ExportModal from './components/panels/ExportModal';
import { List, Library, ChevronLeft, ChevronRight } from 'lucide-react';

export type ViewMode = 'map' | 'text' | 'split';

export type SectionId = 'orchestration' | 'themes' | 'modules' | 'export';

function App() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeRightSection, setActiveRightSection] = useState<SectionId>('orchestration');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [exportModalOpen, setExportModalOpen] = useState(false);

  const [leftWidth, setLeftWidth] = useState(280);
  const [rightWidth, setRightWidth] = useState(320);

  const leftResizing = useRef(false);
  const rightResizing = useRef(false);

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
      setLeftSidebarOpen(!leftSidebarOpen);
    } else if (side === 'right') {
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

  const panelToggleStyle: React.CSSProperties = {
    position: 'absolute', top: '16px', zIndex: 900,
    height: '38px', padding: '0 10px',
    background: 'rgba(14, 22, 17, 0.92)', backdropFilter: 'blur(14px) saturate(1.4)',
    border: '1px solid rgba(110, 201, 126, 0.08)', borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
    color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', gap: '6px',
    transition: 'all 0.15s ease-in-out'
  };

  // In text/split mode the toggle buttons sit outside the map, so we don't need
  // absolute-positioned overlays. We show them inline in the header band instead.
  const isTextMode = viewMode === 'text';
  const isSplitMode = viewMode === 'split';

  return (
    <div className="app-shell" style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      overflow: 'hidden',
      background: 'var(--bg-base)'
    }}>
      <MenuBar onToggleSidebar={toggleSidebar} viewMode={viewMode} onViewModeChange={setViewMode} onExport={handleExportRequest} />
      
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR: Itinerary */}
        {leftSidebarOpen && (
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
              <RoutePanel />
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
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 12px',
              background: 'linear-gradient(180deg, rgba(18,26,20,0.98) 0%, rgba(14,22,17,0.95) 100%)',
              borderBottom: '1px solid rgba(110, 201, 126, 0.07)',
              flexShrink: 0, zIndex: 900,
            }}>
              <button
                onClick={() => toggleSidebar('left')}
                title={`${leftSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'itinéraire (Ctrl+[)`}
                style={{ ...panelToggleStyle, position: 'static', top: 'unset', zIndex: 'unset' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(110, 201, 126, 0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(14, 22, 17, 0.92)'}
              >
                <List size={17} />
                {leftSidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
              </button>
              
              <TextualHeader onExport={handleExportRequest} />

              <button
                onClick={() => toggleSidebar('right')}
                title={`${rightSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'orchestration (Ctrl+])`}
                style={{ ...panelToggleStyle, position: 'static', top: 'unset', zIndex: 'unset' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(110, 201, 126, 0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(14, 22, 17, 0.92)'}
              >
                <Library size={17} />
                {rightSidebarOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => toggleSidebar('left')}
                title={`${leftSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'itinéraire (Ctrl+[)`}
                style={{ ...panelToggleStyle, left: '16px', top: '16px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(110, 201, 126, 0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(14, 22, 17, 0.92)'}
              >
                <List size={18} />
                {leftSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              </button>
              
              <button
                onClick={() => toggleSidebar('right')}
                title={`${rightSidebarOpen ? 'Réduire' : 'Ouvrir'} le panneau d'orchestration (Ctrl+])`}
                style={{ ...panelToggleStyle, right: '16px', top: '16px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(110, 201, 126, 0.12)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(14, 22, 17, 0.92)'}
              >
                <Library size={18} />
                {rightSidebarOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </>
          )}

          <ProjectWorkspace onExport={handleExportRequest} viewMode={viewMode} />
        </div>

        {/* RIGHT SIDEBAR: Libraries */}
        {rightSidebarOpen && (
          <>
            {/* Right Resizer */}
            <div 
              onMouseDown={(e) => { e.preventDefault(); rightResizing.current = true; document.body.style.cursor = 'col-resize'; }}
              style={{ width: '4px', cursor: 'col-resize', background: 'var(--bg-border)', zIndex: 10, marginLeft: '-2px', marginRight: '-2px' }}
            />
            <RightSidebar activeSection={activeRightSection} onSectionChange={setActiveRightSection} width={rightWidth} />
          </>
        )}

      </div>

      <div className="status-bar" style={{ 
        height: '24px', 
        background: 'var(--bg-dark)', 
        borderTop: '1px solid var(--glass-border)',
        fontSize: '11px', color: 'var(--text-dim)',
        display: 'flex', alignItems: 'center', padding: '0 12px'
      }}>
        Prêt
      </div>

      {/* Global Notifications */}
      <NotificationOverlay />

      {/* Export Modal */}
      {exportModalOpen && <ExportModal onClose={() => setExportModalOpen(false)} />}
    </div>
  );
}

export default App;

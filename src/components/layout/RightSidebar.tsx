import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Store } from 'lucide-react';
import DifficultyLibrary from '../panels/DifficultyLibrary';
import ThemePanel from '../panels/ThemePanel';
import LibraryPanel from '../panels/LibraryPanel';
import MapLibraryPanel from '../panels/MapLibraryPanel';
import LayerManagerPanel from '../panels/LayerManagerPanel';

interface AccordionSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ title, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: isOpen ? 1 : 0, flexShrink: 0, flexBasis: isOpen ? '0%' : 'auto', overflow: 'hidden' }}>
      <div 
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 8px',
          background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent',
          borderBottom: '1px solid var(--bg-border)',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          userSelect: 'none',
          marginTop: '-1px' // Collapse double borders
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        onMouseLeave={(e) => e.currentTarget.style.background = isOpen ? 'rgba(255,255,255,0.02)' : 'transparent'}
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
      </div>
      {isOpen && (
        <div className="accordion-content" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export type SectionId = 'layers' | 'orchestration' | 'themes' | 'modules' | 'maps' | 'export';

interface RightSidebarProps {
  activeSection: SectionId;
  onSectionChange: (id: SectionId) => void;
  onPreferencesOpen?: () => void;
  onMarketplaceOpen?: () => void;
  width: number | string;
}

export default function RightSidebar({ activeSection, onSectionChange, onPreferencesOpen, onMarketplaceOpen, width }: RightSidebarProps) {
  const toggle = (id: SectionId) => {
    onSectionChange(id);
  };

  const isFull = width === '100%' || width === 'auto';

  return (
    <div style={{ 
      width: typeof width === 'number' ? `${width}px` : width, 
      flexShrink: 0, 
      display: 'flex', 
      flexDirection: 'column',
      borderLeft: isFull ? 'none' : '1px solid var(--bg-border)',
      background: 'var(--bg-panel)',
      height: '100%'
    }}>
      <style>{`
        /* Hide internal headers of panels since we have accordion headers now */
        .accordion-content .section-title {
          display: none !important;
        }
      `}</style>

      {/* Fast Marketplace Trigger */}
      {onMarketplaceOpen && (
        <div style={{ padding: '8px', borderBottom: '1px solid var(--bg-border)' }}>
          <button
            onClick={onMarketplaceOpen}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '7px 12px',
              background: 'linear-gradient(135deg, rgba(110,201,126,0.15), rgba(14,165,233,0.15))',
              border: '1px solid rgba(110,201,126,0.3)',
              borderRadius: '6px',
              color: 'var(--accent-default, #6EC97E)',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Store size={14} />
            <span>Marketplace des Modules</span>
          </button>
        </div>
      )}
      
      <AccordionSection 
        title="Calques" 
        isOpen={activeSection === 'layers'} 
        onToggle={() => toggle('layers')}
      >
        <LayerManagerPanel />
      </AccordionSection>

      <AccordionSection 
        title="Orchestrations" 
        isOpen={activeSection === 'orchestration'} 
        onToggle={() => toggle('orchestration')}
      >
        <DifficultyLibrary />
      </AccordionSection>

      <AccordionSection 
        title="Thèmes" 
        isOpen={activeSection === 'themes'} 
        onToggle={() => toggle('themes')}
      >
        <ThemePanel />
      </AccordionSection>

      <AccordionSection 
        title="Codes & Énigmes" 
        isOpen={activeSection === 'modules'} 
        onToggle={() => toggle('modules')}
      >
        <LibraryPanel />
      </AccordionSection>

      <AccordionSection 
        title="Fonds de carte" 
        isOpen={activeSection === 'maps'} 
        onToggle={() => toggle('maps')}
      >
        <MapLibraryPanel 
          onSetRightSection={onSectionChange} 
          onPreferencesOpen={onPreferencesOpen}
        />
      </AccordionSection>
      
    </div>
  );
}

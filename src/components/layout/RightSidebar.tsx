import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import DifficultyLibrary from '../panels/DifficultyLibrary';
import ThemePanel from '../panels/ThemePanel';
import LibraryPanel from '../panels/LibraryPanel';
import ExportPanel from '../panels/ExportPanel';

interface AccordionSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function AccordionSection({ title, isOpen, onToggle, children }: AccordionSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: isOpen ? 1 : 'none', overflow: 'hidden', flexShrink: 0 }}>
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

export type SectionId = 'orchestration' | 'themes' | 'modules' | 'export';

interface RightSidebarProps {
  activeSection: SectionId;
  onSectionChange: (id: SectionId) => void;
  width: number;
}

export default function RightSidebar({ activeSection, onSectionChange, width }: RightSidebarProps) {
  const toggle = (id: SectionId) => {
    onSectionChange(id);
  };

  return (
    <div style={{ 
      width: `${width}px`, 
      flexShrink: 0, 
      display: 'flex', 
      flexDirection: 'column',
      borderLeft: '1px solid var(--bg-border)',
      background: 'var(--bg-panel)',
      height: '100%'
    }}>
      <style>{`
        /* Hide internal headers of panels since we have accordion headers now */
        .accordion-content .section-title {
          display: none !important;
        }
      `}</style>
      
      <AccordionSection 
        title="Orchestration Automatique" 
        isOpen={activeSection === 'orchestration'} 
        onToggle={() => toggle('orchestration')}
      >
        <DifficultyLibrary />
      </AccordionSection>

      <AccordionSection 
        title="Bibliothèque de Thèmes" 
        isOpen={activeSection === 'themes'} 
        onToggle={() => toggle('themes')}
      >
        <ThemePanel />
      </AccordionSection>

      <AccordionSection 
        title="Bibliothèque de Modules" 
        isOpen={activeSection === 'modules'} 
        onToggle={() => toggle('modules')}
      >
        <LibraryPanel />
      </AccordionSection>

      <AccordionSection 
        title="Export & Génération" 
        isOpen={activeSection === 'export'} 
        onToggle={() => toggle('export')}
      >
        <ExportPanel />
      </AccordionSection>
      
    </div>
  );
}

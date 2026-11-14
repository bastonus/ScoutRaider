import React, { useState, useEffect, useRef } from 'react';
import { 
  Footprints, 
  Spline, 
  Waypoints, 
  Compass, 
  PencilRuler, 
  MapPin, 
  Pentagon, 
  Pencil, 
  Type, 
  ArrowLeft, 
  ChevronUp, 
  KeyRound
} from 'lucide-react';

interface FloatingToolbarProps {
  activeTool: string;
  onToolChange: (toolId: string) => void;
}

// ── Shared island cell style ──────────────────────────────────────────────────
// Inner radius rule:
// Container: padding 4px, border-radius 14px (--radius-toolbar/--radius-sm).
// Inner buttons: 34px × 34px, border-radius 10px (14px - 4px = 10px).
const CELL: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '14px',
  padding: '4px',
  boxShadow: 'none',
  pointerEvents: 'all' as const,
  overflow: 'visible',
  flexShrink: 0,
};

function RouteSentiersAreaIcon({ size = 18 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12.828 4.813 5.344 2.375"/>
      <path d="m15.769 18.153 3.461-8.306"/>
      <path d="m5.687 14.074 7.625 4.852"/>
      <circle cx="11" cy="4" r="2"/>
      <circle cx="15" cy="20" r="2"/>
      <circle cx="20" cy="8" r="2"/>
      <circle cx="4" cy="13" r="2"/>
      <path d="M6 13 Q9 10 12 13 Q15 16 18 13" strokeWidth="1.5" strokeDasharray="2 1.5" opacity="0.85"/>
    </svg>
  );
}

const ANNOTATION_TOOLS = ['annotate_point', 'annotate_area', 'annotate_area_routed', 'annotate_draw', 'annotate_text'];

export default function FloatingToolbar({ activeTool, onToolChange }: FloatingToolbarProps) {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  
  // 'main' = Tracé, Nœud, Azimut, Encodage, Panneau d'annotations
  // 'annotations' = Retour, Repère, Zone Poly, Zone Sentiers, Pinceau, Texte
  const [toolbarMode, setToolbarMode] = useState<'main' | 'annotations'>(() => {
    return ANNOTATION_TOOLS.includes(activeTool) ? 'annotations' : 'main';
  });

  const [lastRouteMode, setLastRouteMode] = useState<'route' | 'route_direct'>('route');
  const [routeMenuOpen, setRouteMenuOpen] = useState(false);
  const routeMenuRef = useRef<HTMLDivElement>(null);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync toolbar mode when activeTool changes externally
  useEffect(() => {
    if (ANNOTATION_TOOLS.includes(activeTool)) {
      setToolbarMode('annotations');
    } else if (activeTool === 'route') {
      setLastRouteMode('route');
      setToolbarMode('main');
    } else if (activeTool === 'route_direct') {
      setLastRouteMode('route_direct');
      setToolbarMode('main');
    } else if (['node', 'azimut', 'encodage'].includes(activeTool)) {
      setToolbarMode('main');
    }
  }, [activeTool]);

  // Click outside to close route dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (routeMenuRef.current && !routeMenuRef.current.contains(e.target as Node)) {
        setRouteMenuOpen(false);
      }
    };
    if (routeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [routeMenuOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) return;
      const key = e.key.toLowerCase();
      switch (key) {
        case 'p':
          onToolChange('route');
          setLastRouteMode('route');
          setToolbarMode('main');
          setRouteMenuOpen(false);
          break;
        case 'h':
          onToolChange('route_direct');
          setLastRouteMode('route_direct');
          setToolbarMode('main');
          setRouteMenuOpen(false);
          break;
        case 'n':
          onToolChange('node');
          setToolbarMode('main');
          setRouteMenuOpen(false);
          break;
        case 'a':
          onToolChange('azimut');
          setToolbarMode('main');
          setRouteMenuOpen(false);
          break;
        case 'e':
          onToolChange('encodage');
          setToolbarMode('main');
          setRouteMenuOpen(false);
          break;
        case 'r':
          onToolChange('annotate_point');
          setToolbarMode('annotations');
          setRouteMenuOpen(false);
          break;
        case 'z':
          onToolChange('annotate_area');
          setToolbarMode('annotations');
          setRouteMenuOpen(false);
          break;
        case 'x':
          onToolChange('annotate_area_routed');
          setToolbarMode('annotations');
          setRouteMenuOpen(false);
          break;
        case 'b':
          onToolChange('annotate_draw');
          setToolbarMode('annotations');
          setRouteMenuOpen(false);
          break;
        case 't':
          onToolChange('annotate_text');
          setToolbarMode('annotations');
          setRouteMenuOpen(false);
          break;
        case 'escape':
          if (routeMenuOpen) {
            setRouteMenuOpen(false);
          } else if (toolbarMode === 'annotations') {
            setToolbarMode('main');
            onToolChange(lastRouteMode);
          }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToolChange, routeMenuOpen, toolbarMode, lastRouteMode]);

  const btn = (id: string, icon: React.ReactNode, label: string) => {
    const isActive = activeTool === id;
    return (
      <button
        key={id}
        onClick={() => onToolChange(id)}
        title={label}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '34px',
          height: '34px',
          border: isActive ? '1px solid var(--accent-default)' : '1px solid transparent',
          background: isActive ? 'var(--accent-default)' : 'transparent',
          borderRadius: '10px',
          cursor: 'pointer',
          color: isActive ? '#ffffff' : 'var(--text-dim)',
          transition: 'all 100ms ease',
          boxShadow: 'none',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }
        }}
        onMouseLeave={e => {
          if (!isActive) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-dim)';
          }
        }}
      >
        {icon}
      </button>
    );
  };

  const isRouteActive = activeTool === 'route' || activeTool === 'route_direct';
  const isAnnotationActive = ANNOTATION_TOOLS.includes(activeTool);

  return (
    <>
      <style>{`
        @keyframes toolbarSwapIn {
          0% {
            opacity: 0;
            transform: translateY(4px) scale(0.97);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes routePopoverIn {
          0% {
            opacity: 0;
            transform: translateY(6px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      <div
        id="toolbar-container"
        style={{
          position: 'absolute',
          bottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          pointerEvents: 'none',
          background: 'transparent',
          maxWidth: 'calc(100% - 20px)',
          overflow: 'visible',
          padding: '4px',
        }}
      >
        {/* ── MODE 1 : OUTILS PRINCIPAUX (Tracé regroupé, Nœud, Azimut, Annotations) ── */}
        {toolbarMode === 'main' ? (
          <div
            key="main-toolbar"
            style={{
              ...CELL,
              animation: 'toolbarSwapIn 160ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Tracé avec sélecteur développant */}
            <div style={{ position: 'relative' }} ref={routeMenuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isRouteActive) {
                    onToolChange(lastRouteMode);
                  }
                  setRouteMenuOpen(prev => !prev);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title={lastRouteMode === 'route' ? "Tracé pédestre BRouter (P) — Cliquer pour changer de mode" : "Tracé polygonal hors piste (H) — Cliquer pour changer de mode"}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  border: isRouteActive ? '1px solid var(--accent-default)' : '1px solid transparent',
                  background: isRouteActive ? 'var(--accent-default)' : 'transparent',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: isRouteActive ? '#ffffff' : 'var(--text-dim)',
                  transition: 'all 100ms ease',
                  position: 'relative',
                  flexShrink: 0,
                }}
                onMouseEnter={e => {
                  if (!isRouteActive) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isRouteActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-dim)';
                  }
                }}
              >
                {lastRouteMode === 'route' ? (
                  <Footprints size={18} strokeWidth={2.1} />
                ) : (
                  <Spline size={18} strokeWidth={2.1} />
                )}
                {/* Micro chevron indicatif du panneau déroulant */}
                <ChevronUp 
                  size={10} 
                  style={{ 
                    position: 'absolute', 
                    bottom: '2px', 
                    right: '2px', 
                    opacity: isRouteActive ? 0.95 : 0.6,
                    transform: routeMenuOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 120ms ease',
                  }} 
                />
              </button>

              {/* Panneau déroulant de choix de tracé */}
              {routeMenuOpen && (
                <div 
                  onMouseDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 8px)',
                    left: '0',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    minWidth: '220px',
                    zIndex: 5000,
                    pointerEvents: 'all',
                    animation: 'routePopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <div style={{ padding: '6px 8px 3px', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Type de tracé
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToolChange('route');
                      setLastRouteMode('route');
                      setRouteMenuOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (activeTool !== 'route') e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (activeTool !== 'route') e.currentTarget.style.background = 'transparent';
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: activeTool === 'route' ? 'var(--accent-default)' : 'transparent',
                      color: activeTool === 'route' ? '#ffffff' : 'var(--text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: activeTool === 'route' ? 600 : 500,
                      textAlign: 'left',
                      transition: 'all 80ms ease',
                    }}
                  >
                    <Footprints size={17} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Pédestre (BRouter)</span>
                        <span style={{ fontSize: '10px', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>P</span>
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '1px' }}>Suit chemins & sentiers</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToolChange('route_direct');
                      setLastRouteMode('route_direct');
                      setRouteMenuOpen(false);
                    }}
                    onMouseEnter={(e) => {
                      if (activeTool !== 'route_direct') e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      if (activeTool !== 'route_direct') e.currentTarget.style.background = 'transparent';
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: activeTool === 'route_direct' ? 'var(--accent-default)' : 'transparent',
                      color: activeTool === 'route_direct' ? '#ffffff' : 'var(--text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: activeTool === 'route_direct' ? 600 : 500,
                      textAlign: 'left',
                      transition: 'all 80ms ease',
                    }}
                  >
                    <Spline size={17} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Polygonal direct</span>
                        <span style={{ fontSize: '10px', opacity: 0.6, fontFamily: 'var(--font-mono)' }}>H</span>
                      </div>
                      <div style={{ fontSize: '10px', opacity: 0.75, marginTop: '1px' }}>Lignes droites hors piste</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Nœud */}
            {btn('node', <Waypoints size={18} strokeWidth={2} />, 'Édition des nœuds : ajouter, déplacer, supprimer (N)')}

            {/* Azimut */}
            {btn('azimut', <Compass size={18} strokeWidth={2} />, "Visée & Calcul d'azimut (A)")}

            {/* Encodage Topo */}
            {btn('encodage', <KeyRound size={17} strokeWidth={2} />, "Encodage cryptographique du raid (E)")}

            {/* Déclencheur du panneau d'annotations */}
            <button
              onClick={() => {
                setToolbarMode('annotations');
                if (!ANNOTATION_TOOLS.includes(activeTool)) {
                  onToolChange('annotate_point');
                }
              }}
              title="Ouvrir la palette d'annotations (Repères, Zones, Dessin, Texte)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                border: isAnnotationActive ? '1px solid var(--accent-default)' : '1px solid transparent',
                background: isAnnotationActive ? 'var(--accent-default)' : 'transparent',
                borderRadius: '10px',
                cursor: 'pointer',
                color: isAnnotationActive ? '#ffffff' : 'var(--text-dim)',
                transition: 'all 100ms ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                if (!isAnnotationActive) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={e => {
                if (!isAnnotationActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-dim)';
                }
              }}
            >
              <PencilRuler size={18} strokeWidth={2} />
            </button>
          </div>
        ) : (
          /* ── MODE 2 : PANNEAU D'ANNOTATION (Déploiement avec bouton retour) ── */
          <div
            key="annotations-toolbar"
            style={{
              ...CELL,
              animation: 'toolbarSwapIn 160ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Bouton retour vers les outils de tracé */}
            <button
              onClick={() => {
                setToolbarMode('main');
                onToolChange(lastRouteMode);
              }}
              title="Retour aux outils de tracé (Échap)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                height: '34px',
                padding: isMobile ? '0 8px' : '0 10px',
                border: '1px solid var(--border-subtle)',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontSize: '11px',
                fontWeight: 600,
                transition: 'all 100ms ease',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--border-strong)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}
            >
              <ArrowLeft size={15} strokeWidth={2.4} />
              <span>Tracé</span>
            </button>

            <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 2px' }} />

            {/* Repère */}
            {btn('annotate_point', <MapPin size={18} strokeWidth={2} />, 'Repère (R)')}

            {/* Zone libre poly */}
            {btn('annotate_area', <Pentagon size={18} strokeWidth={2} />, 'Zone libre polygonale (Z)')}

            {/* Zone sentiers BRouter */}
            {btn('annotate_area_routed', <RouteSentiersAreaIcon size={18} />, 'Zone sur sentiers BRouter (X)')}

            {/* Dessin libre au pinceau */}
            {btn('annotate_draw', <Pencil size={18} strokeWidth={2} />, 'Dessin libre au pinceau (B)')}

            {/* Texte libre */}
            {btn('annotate_text', <Type size={18} strokeWidth={2} />, 'Texte libre sur carte (T)')}
          </div>
        )}
      </div>
    </>
  );
}

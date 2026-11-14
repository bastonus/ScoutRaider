import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Search, 
  Map as MapIcon, 
  Code, 
  Sliders, 
  Palette, 
  BookmarkCheck, 
  Check, 
  Maximize2, 
  Radio, 
  Ghost, 
  Shield, 
  Anchor, 
  Flag, 
  MessageSquare, 
  Sparkles, 
  Lock, 
  Play, 
  X, 
  Filter, 
  Pencil, 
  ExternalLink, 
  Star, 
  Satellite, 
  Compass, 
  Key, 
  ShieldCheck, 
  Zap, 
  Globe 
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { useAuth } from '../../AuthContext';
import { CloudAuthService, MarketplaceModule, UserLibraryItem } from '../../logic/CloudAuthService';
import { MAP_LAYERS, PROVIDERS } from '../../logic/MapConfig';
import { ALL_MODULE_IDS, MODULE_META, ModuleRegistry } from '../../logic/ModuleRegistry';
import { presetsManager } from '../../logic/PresetsManager';
import { themeManager } from '../../logic/ThemeManager';
import type { ThemeData } from '../../logic/types';

import PresetEditorModal from './PresetEditorModal';
import ThemeEditorModal from './ThemeEditorModal';
import ModuleEditorModal from './ModuleEditorModal';
import PreferencesModal from './PreferencesModal';

export type UnifiedCategory = 'all' | 'maps' | 'code' | 'orchestration' | 'theme' | 'my_library';
export type UnifiedScope = 'all' | 'installed' | 'community';

export interface UnifiedResourceItem {
  id: string;
  name: string;
  category: 'maps' | 'code' | 'orchestration' | 'theme';
  categoryLabel: string;
  description: string;
  badge?: string;
  color: string;
  icon: React.ReactNode;
  previewImage?: string;
  previewBannerComponent?: React.ReactNode;
  logoImage?: string;
  websiteUrl?: string;
  isActive: boolean;
  isBuiltIn: boolean;
  isInLibrary: boolean;
  isFavorite?: boolean;
  isSatellite?: boolean;
  needsKey?: boolean;
  hasKey?: boolean;
  keyLabel?: string;
  author?: string;
  version?: string;
  rawModule?: MarketplaceModule;
  metaDetails?: Record<string, any>;
  onApply: () => void;
  onEdit?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

interface UnifiedResourceHubProps {
  initialCategory?: UnifiedCategory;
  isCompact?: boolean;
  onExpandFullscreen?: () => void;
  onPreferencesOpen?: () => void;
}

// ── Shared floating bar island cell style ──────────────────────────────────────
const CELL: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '3px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: '14px',
  padding: '4px',
  boxShadow: 'none',
  flexShrink: 0,
};

// ── Pixel-Perfect Resource Card ──────────────────────────────────────────────
interface ResourceHubCardProps {
  item: UnifiedResourceItem;
  isActive: boolean;
  onApply: () => void;
  onEdit?: () => void;
  onToggleLibrary?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

function ResourceHubCard({
  item,
  isActive,
  onApply,
  onEdit,
  onToggleLibrary,
  onDragStart
}: ResourceHubCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const hasBanner = !!item.previewBannerComponent || (!!item.previewImage && !imageFailed);

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onClick={onApply}
      style={{
        background: isActive ? 'rgba(110, 201, 126, 0.04)' : 'rgba(255, 255, 255, 0.02)',
        borderRadius: '16px',
        border: '1px solid',
        borderColor: isActive ? 'var(--accent-default)' : 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
        boxShadow: isActive ? '0 0 0 1px var(--accent-default), 0 8px 24px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.2)',
        transition: 'all 0.3s ease',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        cursor: onDragStart ? 'grab' : 'pointer',
        boxSizing: 'border-box',
        width: '100%',
        minHeight: hasBanner ? '285px' : '110px',
        position: 'relative'
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
        }
      }}
    >
      {/* ── CARD BANNER (140px) ─────────────────────────────────── */}
      {hasBanner && (
        <div style={{
          width: '100%',
          height: '140px',
          minHeight: '140px',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          background: '#0a0b0e'
        }}>
          {item.previewBannerComponent ? (
            item.previewBannerComponent
          ) : item.previewImage ? (
            <img
              src={item.previewImage}
              alt={item.name}
              onError={() => setImageFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
            />
          ) : null}

          {/* Badges Overlay (ROW top-left) */}
          <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', flexWrap: 'wrap', gap: '6px', zIndex: 5 }}>
            {item.needsKey && !item.hasKey && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.95)',
                padding: '4px 8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,0,0,0.1)'
              }}>
                <Lock size={12} color="#fff" fill="#fff" fillOpacity={0.1} strokeWidth={2.5} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>Bloqué</span>
              </div>
            )}

            {item.isFavorite && (
              <div style={{
                background: 'rgba(251, 191, 36, 0.95)',
                padding: '4px 8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,0,0,0.1)'
              }}>
                <Star size={12} color="#000" fill="#000" strokeWidth={2.5} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#000', letterSpacing: '0.3px' }}>Favori</span>
              </div>
            )}

            {item.isSatellite && (
              <div style={{
                background: 'rgba(168, 85, 247, 0.95)',
                padding: '4px 8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,0,0,0.1)'
              }}>
                <Satellite size={12} color="#fff" strokeWidth={2.5} />
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', letterSpacing: '0.3px' }}>Satellite</span>
              </div>
            )}

            {item.badge && !item.isFavorite && !item.isSatellite && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.75)',
                padding: '4px 8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: item.color || '#fff'
              }}>
                <span style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  {item.badge}
                </span>
              </div>
            )}
          </div>

          {/* Watermark in bottom-right over gradient */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'flex-end',
            pointerEvents: 'none',
            zIndex: 4
          }}>
            {item.logoImage ? (
              <img
                src={item.logoImage}
                alt="Logo"
                style={{ maxHeight: '24px', maxWidth: '40%', filter: 'brightness(1.1) drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
              />
            ) : (item.category === 'maps' && item.categoryLabel?.toUpperCase().includes('IGN')) ? (
              <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.5px', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                IGN
              </span>
            ) : item.author ? (
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.8)', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                @{item.author}
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* ── CARD CONTENT BODY (16px) ────────────────────────────── */}
      <div style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        justifyContent: 'space-between'
      }}>
        <div>
          {/* Title row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', textTransform: 'uppercase' }}>
                  {item.name}
                </div>
                {isActive && (
                  <div style={{
                    background: 'rgba(110, 201, 126, 0.2)',
                    color: 'var(--accent-default)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '9px',
                    fontWeight: 800,
                    border: '1px solid rgba(110, 201, 126, 0.3)',
                    textTransform: 'uppercase'
                  }}>
                    Actif
                  </div>
                )}
              </div>
              <div style={{
                fontSize: '10px',
                color: 'var(--accent-default)',
                fontWeight: 700,
                textTransform: 'uppercase',
                marginTop: '2px',
                letterSpacing: '0.5px'
              }}>
                {item.categoryLabel}
              </div>
            </div>

            {/* External link or quick edit */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
              {item.websiteUrl && (
                <a
                  href={item.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'rgba(255,255,255,0.2)', transition: 'color 0.2s', padding: '4px', display: 'flex' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                >
                  <ExternalLink size={14} />
                </a>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  title="Modifier"
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.2)', padding: '4px', cursor: 'pointer', display: 'flex' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <p style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.5)',
            lineHeight: 1.6,
            margin: '8px 0 0'
          }}>
            {item.description}
          </p>
        </div>

        {/* ── CARD ACTION BUTTONS ───────────────────────────────── */}
        {/* Blocked Button (Exact same style as the original map library) */}
        {item.needsKey && !item.hasKey ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(251, 191, 36, 0.1)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              borderRadius: '10px',
              color: '#fbbf24',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '16px',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
          >
            <Lock size={14} color="#fbbf24" fill="#fbbf24" fillOpacity={0.2} style={{ marginRight: '8px' }} />
            <span style={{ display: 'inline-block', lineHeight: '1.2' }}>
              Débloquer avec une clé {item.badge || item.categoryLabel}
            </span>
          </div>
        ) : item.category !== 'maps' ? (
          /* Action Button for non-maps */
          <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
            <button
              onClick={onApply}
              style={{
                flex: 1,
                padding: '10px',
                background: isActive ? 'rgba(110, 201, 126, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '1px solid rgba(110, 201, 126, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                color: isActive ? 'var(--accent-default)' : '#fff',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              {isActive ? (
                <>
                  <Check size={14} strokeWidth={2.5} />
                  <span>Sélectionné</span>
                </>
              ) : item.category === 'code' ? (
                <>
                  <Play size={13} fill="#fff" />
                  <span>Tester / Insérer</span>
                </>
              ) : (
                <>
                  <Play size={13} />
                  <span>Appliquer</span>
                </>
              )}
            </button>

            {!item.isBuiltIn && item.rawModule && onToggleLibrary && (
              <button
                onClick={onToggleLibrary}
                title={item.isInLibrary ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                style={{
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: item.isInLibrary ? 'var(--accent-default)' : 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer'
                }}
              >
                <BookmarkCheck size={14} />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function UnifiedResourceHub({
  initialCategory = 'all',
  isCompact = false,
  onExpandFullscreen,
  onPreferencesOpen
}: UnifiedResourceHubProps) {
  const { state, dispatch } = useApp();
  const { user, isGuest, setAuthModalOpen } = useAuth();

  const [activeCategory, setActiveCategory] = useState<UnifiedCategory>(initialCategory);
  const [scopeFilter, setScopeFilter] = useState<UnifiedScope>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [cloudModules, setCloudModules] = useState<MarketplaceModule[]>([]);
  const [userLibrary, setUserLibrary] = useState<UserLibraryItem[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);

  // Editor & Config modals
  const [presetEditorOpen, setPresetEditorOpen] = useState(false);
  const [themeEditorOpen, setThemeEditorOpen] = useState(false);
  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);
  const [activeEditingId, setActiveEditingId] = useState<string>('');
  const [localPrefModalOpen, setLocalPrefModalOpen] = useState(false);

  // Quick code tester state
  const [previewTestModule, setPreviewTestModule] = useState<{ id: string; name: string } | null>(null);
  const [testInput, setTestInput] = useState('SCOUT RAID 2026');
  const [testOutput, setTestOutput] = useState('');

  // Dynamic responsive grid measurement (2 to 3 cards per line depending on width)
  const galleryRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!galleryRef.current) return;
    const updateWidth = () => {
      if (galleryRef.current) {
        setContainerWidth(galleryRef.current.clientWidth);
      }
    };
    updateWidth();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    observer.observe(galleryRef.current);
    return () => observer.disconnect();
  }, []);

  const gridColumns = useMemo(() => {
    if (containerWidth >= 700) return 3;
    if (containerWidth >= 380) return 2;
    if (containerWidth > 0) return 1;
    return isCompact ? 1 : 2;
  }, [containerWidth, isCompact]);

  useEffect(() => {
    if (initialCategory) {
      setActiveCategory(initialCategory);
    }
  }, [initialCategory]);

  const loadCloudData = useCallback(async () => {
    setIsLoadingCloud(true);
    try {
      const [mList, uLib] = await Promise.all([
        CloudAuthService.listMarketplaceModules(
          activeCategory === 'my_library' || activeCategory === 'all' ? undefined : activeCategory
        ),
        CloudAuthService.getUserLibrary()
      ]);
      setCloudModules(mList);
      setUserLibrary(uLib);
    } catch {
      // Offline fallback
    } finally {
      setIsLoadingCloud(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    loadCloudData();
  }, [loadCloudData]);

  const isInLibrary = useCallback((moduleId: string) => {
    return userLibrary.some(item => item.module_id === moduleId);
  }, [userLibrary]);

  const handleToggleLibrary = async (mod: MarketplaceModule) => {
    if (isGuest) {
      setAuthModalOpen(true);
      return;
    }
    const already = isInLibrary(mod.id);
    try {
      if (already) {
        await CloudAuthService.removeFromUserLibrary(mod.id);
        setUserLibrary(prev => prev.filter(item => item.module_id !== mod.id));
      } else {
        await CloudAuthService.addToUserLibrary(mod.id, mod.name, mod.category);
        const updated = await CloudAuthService.getUserLibrary();
        setUserLibrary(updated);
      }
    } catch (e: any) {
      dispatch({ type: 'ADD_NOTIFICATION', message: `Erreur: ${e.message}`, notifType: 'error' });
    }
  };

  // ── 1. Map Layers (Original Rich Card Design) ──────────────────────────────
  const mapItems = useMemo<UnifiedResourceItem[]>(() => {
    const activeMapId = state.active_ign_layer || 'PLAN.IGN';
    return Object.entries(MAP_LAYERS).map(([id, data]) => {
      const provider = PROVIDERS[data.provider];
      const hasKey = data.provider === 'IGN' 
        ? !!state.ign_api_key 
        : (data.provider === 'Mapy.cz' ? !!state.mapy_api_key : true);
      const isActive = activeMapId === id;

      return {
        id,
        name: id,
        category: 'maps',
        categoryLabel: data.category || 'IGN',
        description: provider?.description || data.attribution,
        badge: data.provider,
        color: data.isSatellite ? '#a855f7' : '#10b981',
        icon: <MapIcon size={16} />,
        previewImage: data.preview || provider?.preview || '',
        logoImage: provider?.logo,
        websiteUrl: provider?.website,
        isActive,
        isBuiltIn: true,
        isInLibrary: isActive || !!data.isFavorite,
        isFavorite: !!data.isFavorite,
        isSatellite: !!data.isSatellite,
        needsKey: data.needsKey,
        hasKey,
        keyLabel: `Clé ${data.provider}`,
        onApply: () => {
          if (data.needsKey && !hasKey) {
            if (onPreferencesOpen) onPreferencesOpen();
            else setLocalPrefModalOpen(true);
            dispatch({ 
              type: 'ADD_NOTIFICATION', 
              message: `Une clé API ${data.provider} est requise pour activer ce fond de carte.`, 
              notifType: 'info' 
            });
            return;
          }
          dispatch({ type: 'SET_IGN_LAYER', layer: id });
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            message: `Fond de carte activé : ${id}`, 
            notifType: 'success' 
          });
        },
        onEdit: () => {
          if (onPreferencesOpen) onPreferencesOpen();
          else setLocalPrefModalOpen(true);
        }
      };
    });
  }, [state.active_ign_layer, state.ign_api_key, state.mapy_api_key, dispatch, onPreferencesOpen]);

  // ── 2. Codes & Énigmes (Declined Rich Visual Banner) ────────────────────────
  const codeItems = useMemo<UnifiedResourceItem[]>(() => {
    return ALL_MODULE_IDS.map(mId => {
      const meta = MODULE_META[mId];
      const manifest = ModuleRegistry.getManifest(mId);
      
      let icon = <Code size={16} />;
      if (mId === 'morse') icon = <Radio size={16} />;
      if (mId === 'gilwell') icon = <Ghost size={16} />;
      if (mId === 'templier') icon = <Shield size={16} />;
      if (mId === 'maritime') icon = <Anchor size={16} />;
      if (mId === 'drapeaux') icon = <Flag size={16} />;
      if (mId === 'texte_clair') icon = <MessageSquare size={16} />;
      if (mId === 'carte_ign') icon = <MapIcon size={16} />;

      // Custom graphical preview banner representing the code's nature
      const previewBannerComponent = (
        <div style={{
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 75% 30%, ${meta.color}35 0%, #09090b 80%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px',
          position: 'relative',
          userSelect: 'none'
        }}>
          {/* Subtle cipher watermark background */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.12,
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: 1.5,
            overflow: 'hidden',
            padding: '8px',
            color: meta.color,
            wordBreak: 'break-all'
          }}>
            ... --- ... / -.-. --- -.. . / .-. .- .. -.. / .--. --- .-.. -.-- --. --- -.
            01010011 01000011 01001111 01010101 01010100 00100000 01010010 01000001
          </div>
          {/* Centered distinctive graphic symbol */}
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${meta.color}45, ${meta.color}15)`,
            border: `1.5px solid ${meta.color}60`,
            boxShadow: `0 8px 24px ${meta.color}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            zIndex: 2
          }}>
            {React.cloneElement(icon as React.ReactElement, { size: 28, strokeWidth: 2.2 })}
          </div>
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: meta.color,
            textTransform: 'uppercase',
            zIndex: 2
          }}>
            {meta.label}
          </div>
        </div>
      );

      return {
        id: mId,
        name: meta.label,
        category: 'code',
        categoryLabel: manifest?.type === 'visual' ? 'Module Visuel & Graphique' : 'Module de Chiffrement',
        description: manifest?.description || 'Module d\'encodage cryptographique ou visuel.',
        badge: manifest?.type === 'visual' ? 'Graphique' : 'Chiffré',
        color: meta.color || '#f59e0b',
        icon,
        previewBannerComponent,
        isActive: false,
        isBuiltIn: true,
        isInLibrary: true,
        onApply: () => {
          setPreviewTestModule({ id: mId, name: meta.label });
          try {
            const encoded = ModuleRegistry.encode(mId, 'SCOUT RAID 2026');
            setTestOutput(encoded?.encoded_text || (typeof encoded === 'string' ? encoded : 'Module activé'));
          } catch {
            setTestOutput('Prêt à être utilisé sur vos étapes.');
          }
        },
        onEdit: () => {
          setActiveEditingId(mId);
          setModuleEditorOpen(true);
        },
        onDragStart: (e: React.DragEvent) => {
          e.dataTransfer.setData('application/x-scoutraider-module', mId);
          e.dataTransfer.setData('text/plain', mId);
          e.dataTransfer.effectAllowed = 'copy';
          (window as any).__draggingModuleId = mId;
        }
      };
    });
  }, []);

  // ── 3. Règles de raid (Declined Rich Visual Banner) ─────────────────────────
  const orchestrationItems = useMemo<UnifiedResourceItem[]>(() => {
    const rawPresets = presetsManager.getAllPresets();
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

    return rawPresets.map((p, i) => {
      const isActive = state.active_preset_id === p.id;
      const themeColor = colors[i % colors.length];

      // Custom graphical elevation & difficulty preview banner
      const previewBannerComponent = (
        <div style={{
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 80% 20%, ${themeColor}30 0%, #0c0d12 85%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px',
          position: 'relative',
          userSelect: 'none'
        }}>
          {/* Topographic elevation curve watermark */}
          <svg style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: '70px', opacity: 0.25 }} viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M0,80 Q60,30 130,50 T260,20 T400,60 L400,100 L0,100 Z" fill={themeColor} />
            <path d="M0,90 Q90,50 180,70 T320,40 T400,85" fill="none" stroke={themeColor} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${themeColor}45, ${themeColor}15)`,
            border: `1.5px solid ${themeColor}60`,
            boxShadow: `0 8px 24px ${themeColor}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            zIndex: 2
          }}>
            <Sliders size={26} strokeWidth={2.2} />
          </div>
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: themeColor,
            textTransform: 'uppercase',
            zIndex: 2
          }}>
            Niveau {i + 1} • {p.polygonalisation?.hors_piste ? 'Hors-piste' : 'Sentiers BRouter'}
          </div>
        </div>
      );

      return {
        id: p.id,
        name: p.name,
        category: 'orchestration',
        categoryLabel: p.isCustom ? 'Règle Personnalisée' : 'Preset Officiel ScoutRaider',
        description: p.isCustom 
          ? 'Règles de progression sur-mesure pour votre carnet de raid.' 
          : 'Preset officiel calibré pour un dosage équilibré d\'orientation et d\'étapes.',
        badge: p.isCustom ? 'Personnalisé' : `Niveau ${i + 1}`,
        color: themeColor,
        icon: <Sliders size={16} />,
        previewBannerComponent,
        isActive,
        isBuiltIn: !p.isCustom,
        isInLibrary: true,
        onApply: () => {
          dispatch({ type: 'SET_PRESET', presetId: p.id });
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            message: `Règles appliquées : ${p.name}`, 
            notifType: 'success' 
          });
        },
        onEdit: () => {
          setActiveEditingId(p.id);
          setPresetEditorOpen(true);
        }
      };
    });
  }, [state.active_preset_id, dispatch]);

  // ── 4. Thèmes & Récits (Declined Rich Visual Banner) ────────────────────────
  const themeItems = useMemo<UnifiedResourceItem[]>(() => {
    const ids = themeManager.getThemeIds();
    const colors = ['#f43f5e', '#a855f7', '#06b6d4', '#eab308', '#10b981'];

    return ids.map((id, i) => {
      const data: ThemeData = themeManager.getTheme(id);
      const isActive = state.theme_id === id;
      const themeColor = colors[i % colors.length];
      const introSample = data.intros?.[0] ? `"${data.intros[0]}"` : 'Habillage narratif pour carnet de raid.';

      // Custom graphical narrative banner
      const previewBannerComponent = (
        <div style={{
          width: '100%',
          height: '100%',
          background: `radial-gradient(circle at 70% 30%, ${themeColor}35 0%, #0d0e14 85%)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px',
          position: 'relative',
          userSelect: 'none'
        }}>
          {/* Compass rose watermark */}
          <div style={{ position: 'absolute', right: '12px', bottom: '6px', opacity: 0.12, color: themeColor }}>
            <Compass size={84} strokeWidth={1} />
          </div>
          <div style={{
            width: '54px',
            height: '54px',
            borderRadius: '16px',
            background: `linear-gradient(135deg, ${themeColor}45, ${themeColor}15)`,
            border: `1.5px solid ${themeColor}60`,
            boxShadow: `0 8px 24px ${themeColor}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            zIndex: 2
          }}>
            <Palette size={26} strokeWidth={2.2} />
          </div>
          <div style={{
            marginTop: '8px',
            fontSize: '12.5px',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#fff',
            textTransform: 'uppercase',
            zIndex: 2
          }}>
            {id}
          </div>
          {data.vigenere_key && (
            <div style={{
              marginTop: '4px',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: 'monospace',
              color: themeColor,
              background: 'rgba(0,0,0,0.4)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: `1px solid ${themeColor}40`,
              zIndex: 2
            }}>
              CLÉ : {data.vigenere_key}
            </div>
          )}
        </div>
      );

      return {
        id,
        name: id,
        category: 'theme',
        categoryLabel: 'Univers Narratif & Récit',
        description: introSample,
        badge: data.vigenere_key ? `Clé : ${data.vigenere_key}` : 'Standard',
        color: themeColor,
        icon: <Palette size={16} />,
        previewBannerComponent,
        isActive,
        isBuiltIn: true,
        isInLibrary: true,
        metaDetails: { vigenere_key: data.vigenere_key },
        onApply: () => {
          dispatch({ type: 'SET_THEME', themeId: id });
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            message: `Thème narratif activé : ${id}`, 
            notifType: 'success' 
          });
        },
        onEdit: () => {
          setActiveEditingId(id);
          setThemeEditorOpen(true);
        }
      };
    });
  }, [state.theme_id, dispatch]);

  // ── 5. Cloud Marketplace Items ─────────────────────────────────────────────
  const cloudItems = useMemo<UnifiedResourceItem[]>(() => {
    return cloudModules.map(mod => {
      const category: UnifiedCategory = 
        mod.category === 'code' ? 'code' :
        mod.category === 'orchestration' ? 'orchestration' :
        mod.category === 'theme' ? 'theme' : 'code';

      const inLib = isInLibrary(mod.id);
      const categoryLabel = 
        category === 'code' ? 'Code Communautaire' :
        category === 'orchestration' ? 'Règle Communautaire' : 'Thème Communautaire';

      const color = 
        category === 'code' ? '#f59e0b' :
        category === 'orchestration' ? '#3b82f6' : '#a855f7';

      return {
        id: mod.id,
        name: mod.name,
        category: category as any,
        categoryLabel,
        description: mod.description || 'Module communautaire partagé sur la Marketplace.',
        badge: mod.author_username ? `@${mod.author_username}` : 'Communauté',
        color,
        icon: category === 'code' ? <Code size={16} /> : category === 'orchestration' ? <Sliders size={16} /> : <Palette size={16} />,
        previewImage: mod.preview_image,
        isActive: false,
        isBuiltIn: false,
        isInLibrary: inLib,
        author: mod.author_username,
        version: mod.version,
        rawModule: mod,
        onApply: () => {
          handleToggleLibrary(mod);
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            message: `Module "${mod.name}" synchronisé`, 
            notifType: 'info' 
          });
        }
      };
    });
  }, [cloudModules, isInLibrary]);

  const allItems = useMemo<UnifiedResourceItem[]>(() => {
    return [...mapItems, ...codeItems, ...orchestrationItems, ...themeItems, ...cloudItems];
  }, [mapItems, codeItems, orchestrationItems, themeItems, cloudItems]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (activeCategory === 'my_library') {
        if (!item.isInLibrary && !item.isActive) return false;
      } else if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      if (scopeFilter === 'installed' && !item.isBuiltIn && !item.isInLibrary) {
        return false;
      }
      if (scopeFilter === 'community' && item.isBuiltIn) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchBadge = item.badge?.toLowerCase().includes(q);
        const matchCat = item.categoryLabel.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchBadge && !matchCat) return false;
      }

      return true;
    });
  }, [allItems, activeCategory, scopeFilter, searchQuery]);

  const categories = useMemo(() => [
    { id: 'all' as UnifiedCategory, label: 'Tout', icon: <Sparkles size={13} />, count: allItems.length },
    { id: 'maps' as UnifiedCategory, label: 'Fonds de carte', icon: <MapIcon size={13} />, count: mapItems.length },
    { id: 'code' as UnifiedCategory, label: 'Codes & Énigmes', icon: <Code size={13} />, count: codeItems.length },
    { id: 'orchestration' as UnifiedCategory, label: 'Règles de raid', icon: <Sliders size={13} />, count: orchestrationItems.length },
    { id: 'theme' as UnifiedCategory, label: 'Thèmes & Récits', icon: <Palette size={13} />, count: themeItems.length },
    { id: 'my_library' as UnifiedCategory, label: 'Ma Bibliothèque', icon: <BookmarkCheck size={13} />, count: allItems.filter(i => i.isInLibrary).length }
  ], [allItems, mapItems, codeItems, orchestrationItems, themeItems]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      overflow: 'hidden'
    }}>
      {/* ── TOP CONTROLS (FLOATING BAR AESTHETIC) ──────────────────────── */}
      <div style={{
        padding: isCompact ? '10px 12px' : '16px 24px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-dark)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        flexShrink: 0
      }}>
        {/* Search bar & Scope */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '0 12px',
            height: '38px'
          }}>
            <Search size={15} color="var(--text-dim)" style={{ flexShrink: 0, marginRight: '8px' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une carte, un code, une règle, un thème..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '12.5px',
                width: '100%'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Scope Pills */}
          <div style={{ ...CELL, borderRadius: '12px', padding: '3px 4px' }}>
            {(['all', 'installed', 'community'] as UnifiedScope[]).map(s => {
              const isSActive = scopeFilter === s;
              const label = s === 'all' ? 'Tous' : s === 'installed' ? 'Locaux' : 'Cloud';
              return (
                <button
                  key={s}
                  onClick={() => setScopeFilter(s)}
                  style={{
                    background: isSActive ? 'var(--accent-transparent)' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '4px 10px',
                    color: isSActive ? 'var(--accent-hover)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: isSActive ? 700 : 500,
                    transition: 'all 100ms ease'
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Fullscreen trigger if compact */}
          {onExpandFullscreen && (
            <button
              onClick={onExpandFullscreen}
              title="Agrandir en grand écran"
              style={{
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-dim)',
                cursor: 'pointer'
              }}
            >
              <Maximize2 size={15} />
            </button>
          )}
        </div>

        {/* Categories segmented bar */}
        <div style={{ ...CELL, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {categories.map(cat => {
            const isCatActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isCatActive ? 'var(--accent-transparent)' : 'transparent',
                  color: isCatActive ? 'var(--accent-hover)' : 'var(--text-dim)',
                  fontSize: '12px',
                  fontWeight: isCatActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 100ms ease'
                }}
                onMouseEnter={e => {
                  if (!isCatActive) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isCatActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-dim)';
                  }
                }}
              >
                {cat.icon}
                <span>{cat.label}</span>
                <span style={{
                  fontSize: '9.5px',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  background: isCatActive ? 'rgba(37,99,235,0.25)' : 'rgba(255,255,255,0.06)',
                  color: isCatActive ? '#93c5fd' : 'var(--text-dim)',
                  fontWeight: 700
                }}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── GALLERY AREA (RESPONSIVE MULTI-COLUMN GRID 2 OR 3 CARDS) ──── */}
      <div 
        ref={galleryRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: containerWidth < 500 ? '12px' : '18px 20px',
          display: 'grid',
          gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
          gridAutoRows: 'max-content',
          gap: containerWidth < 500 ? '12px' : '16px',
          alignContent: 'start',
          alignItems: 'start',
          background: 'rgba(0,0,0,0.15)'
        }}
      >
        {filteredItems.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '48px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--text-dim)'
          }}>
            <Sparkles size={28} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: '13.5px', fontWeight: 700 }}>Aucune ressource disponible</div>
            <div style={{ fontSize: '11.5px', maxWidth: '300px', lineHeight: 1.5 }}>
              Modifiez votre terme de recherche ou explorez une autre catégorie.
            </div>
          </div>
        ) : (
          filteredItems.map(item => (
            <ResourceHubCard
              key={`${item.category}-${item.id}`}
              item={item}
              isActive={item.isActive}
              onApply={item.onApply}
              onEdit={item.onEdit}
              onToggleLibrary={item.rawModule ? () => handleToggleLibrary(item.rawModule!) : undefined}
              onDragStart={item.onDragStart}
            />
          ))
        )}
      </div>

      {/* ── TESTER DRAWER (FOR CODES) ──────────────────────────────────── */}
      {previewTestModule && (
        <div style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-dark)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#fff' }}>
              Banc d'essai : {previewTestModule.name}
            </span>
            <button
              onClick={() => setPreviewTestModule(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}
            >
              <X size={13} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <input
              type="text"
              value={testInput}
              onChange={(e) => {
                const val = e.target.value;
                setTestInput(val);
                try {
                  const res = ModuleRegistry.encode(previewTestModule.id, val);
                  setTestOutput(res?.encoded_text || (typeof res === 'string' ? res : ''));
                } catch {
                  setTestOutput('Erreur d\'encodage');
                }
              }}
              placeholder="Texte à tester..."
              style={{
                flex: 1,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '5px 10px',
                color: '#fff',
                fontSize: '11.5px'
              }}
            />
          </div>
          <div style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            padding: '6px 10px',
            background: 'rgba(0,0,0,0.4)',
            borderRadius: '6px',
            color: 'var(--accent-hover)',
            wordBreak: 'break-all',
            maxHeight: '60px',
            overflowY: 'auto'
          }}>
            {testOutput || 'Résultat du chiffrement...'}
          </div>
        </div>
      )}

      {/* ── SUB-MODALS ─────────────────────────────────────────────────── */}
      {presetEditorOpen && (
        <PresetEditorModal
          activePresetId={activeEditingId || state.active_preset_id || 'seconde_classe_1'}
          onClose={() => setPresetEditorOpen(false)}
          onSelectPreset={(id) => {
            dispatch({ type: 'SET_PRESET', presetId: id });
          }}
        />
      )}

      {themeEditorOpen && (
        <ThemeEditorModal
          activeThemeId={activeEditingId || state.theme_id || 'Neutre'}
          onClose={() => setThemeEditorOpen(false)}
          onSelectTheme={(id) => {
            dispatch({ type: 'SET_THEME', themeId: id });
          }}
        />
      )}

      {moduleEditorOpen && (
        <ModuleEditorModal
          activeModuleId={activeEditingId || ALL_MODULE_IDS[0]}
          onClose={() => setModuleEditorOpen(false)}
        />
      )}

      {localPrefModalOpen && (
        <PreferencesModal
          onClose={() => setLocalPrefModalOpen(false)}
        />
      )}
    </div>
  );
}

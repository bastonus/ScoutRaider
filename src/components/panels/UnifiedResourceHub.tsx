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
  Globe,
  Cloud
} from 'lucide-react';
import { useApp } from '../../AppContext';
import { useAuth } from '../../AuthContext';
import { CloudAuthService, MarketplaceModule, UserLibraryItem } from '../../logic/CloudAuthService';
import { MAP_LAYERS, PROVIDERS } from '../../logic/MapConfig';
import { ALL_MODULE_IDS, MODULE_META, ModuleRegistry } from '../../logic/ModuleRegistry';
import { ModuleLogic } from '../../logic/ModuleLogic';
import { presetsManager } from '../../logic/PresetsManager';
import { themeManager } from '../../logic/ThemeManager';
import type { ThemeData } from '../../logic/types';

import PresetEditorModal from './PresetEditorModal';
import ThemeEditorModal from './ThemeEditorModal';
import ModuleEditorModal from './ModuleEditorModal';
import PreferencesModal from './PreferencesModal';

export type UnifiedCategory = 'all' | 'maps' | 'routing' | 'code' | 'orchestration' | 'theme' | 'my_library';
export type UnifiedScope = 'all' | 'installed' | 'community';

export interface UnifiedResourceItem {
  id: string;
  name: string;
  category: 'maps' | 'routing' | 'code' | 'orchestration' | 'theme';
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
  s3_download_url?: string;
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
  const isMap = item.category === 'maps';
  const hasBanner = !!item.previewBannerComponent || (!!item.previewImage && !imageFailed);
  const color = item.color || 'var(--accent-primary)';

  return (
    <article
      className="sr-card"
      data-active={isActive ? 'true' : 'false'}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      style={{
        cursor: onDragStart ? 'grab' : 'default',
        width: '100%',
        position: 'relative',
      }}
    >
      {/* Map Banner — sleek panoramic preview (compact in sidebar, taller in full gallery) */}
      {isMap && hasBanner && (
        <div style={{
          width: '100%',
          height: '96px',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--bg-dark)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {item.previewBannerComponent ? (
            item.previewBannerComponent
          ) : item.previewImage ? (
            <img
              src={item.previewImage}
              alt=""
              onError={() => setImageFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : null}

          {/* Quiet top-left status badges (max 2) */}
          <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {item.needsKey && !item.hasKey && (
              <span style={{
                background: 'rgba(18, 18, 21, 0.88)', border: '1px solid rgba(239, 68, 68, 0.45)',
                padding: '2px 7px', borderRadius: '6px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                color: '#FCA5A5', fontSize: '10px', fontWeight: 600
              }}>
                <Lock size={10} aria-hidden="true" />
                Clé requise
              </span>
            )}
            {item.isSatellite && (
              <span style={{
                background: 'rgba(18, 18, 21, 0.88)', border: '1px solid var(--border-strong)',
                padding: '2px 7px', borderRadius: '6px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                color: 'var(--text-primary)', fontSize: '10px', fontWeight: 600
              }}>
                <Satellite size={10} aria-hidden="true" />
                Satellite
              </span>
            )}
            {!item.isSatellite && item.isFavorite && (
              <span style={{
                background: 'rgba(18, 18, 21, 0.88)', border: '1px solid rgba(245, 158, 11, 0.4)',
                padding: '2px 7px', borderRadius: '6px',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                color: '#FCD34D', fontSize: '10px', fontWeight: 600
              }}>
                <Star size={10} fill="currentColor" aria-hidden="true" />
                Recommandé
              </span>
            )}
          </div>

          {/* Provider attribution — bottom right */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'linear-gradient(to top, rgba(9,9,11,0.85), transparent)',
            padding: '18px 10px 7px',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end'
          }}>
            {item.logoImage ? (
              <img
                src={item.logoImage}
                alt={`Logo ${item.name}`}
                style={{ height: '18px', maxWidth: '68px', objectFit: 'contain', opacity: 0.9 }}
              />
            ) : (
              <span style={{
                fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.75)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.03em'
              }}>
                {item.author ? `@${item.author}` : 'IGN'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Card Content Body */}
      <div style={{
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        <div>
          {/* Header row: Icon + Title/Meta + Utility actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                color: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }} aria-hidden="true">
                {item.icon}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    title={item.name}
                    style={{
                      fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}
                  >
                    {item.name}
                  </span>
                  {isActive && (
                    <span style={{
                      background: 'var(--accent-transparent)',
                      color: 'var(--accent-hover)',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      flexShrink: 0
                    }}>
                      Actif
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>{item.categoryLabel}</span>
                  {item.version && (
                    <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                      v{item.version}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Utility icons (S3 download / Edit) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              {item.s3_download_url && (
                <a
                  href={item.s3_download_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Télécharger depuis S3 Garage`}
                  aria-label={`Télécharger ${item.name} depuis S3`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    fontSize: '10px', fontWeight: 600, padding: '3px 6px',
                    borderRadius: '6px', background: 'var(--bg-elevated)',
                    color: 'var(--text-dim)', border: '1px solid var(--border-subtle)',
                    textDecoration: 'none'
                  }}
                >
                  <Cloud size={10} aria-hidden="true" />
                  <span>S3</span>
                </a>
              )}
              {onEdit && (
                <button
                  type="button"
                  className="btn-icon"
                  onClick={onEdit}
                  title={`Configurer ${item.name}`}
                  aria-label={`Configurer ${item.name}`}
                >
                  <Pencil size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <p style={{
            margin: '10px 0 0',
            fontSize: '12px',
            color: 'var(--text-dim)',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {item.description}
          </p>
        </div>

        {/* Unified Footer Action Bar */}
        <div style={{
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}>
          {/* Library Status Toggle — quiet when inactive so primary CTA stands out */}
          {onToggleLibrary ? (
            <button
              type="button"
              onClick={onToggleLibrary}
              aria-pressed={item.isInLibrary}
              title={item.isInLibrary ? 'Inclus dans votre bibliothèque (cliquer pour retirer)' : 'Ajouter à votre bibliothèque'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 8px',
                borderRadius: '7px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 500,
                background: item.isInLibrary ? 'var(--accent-transparent)' : 'transparent',
                border: item.isInLibrary ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid transparent',
                color: item.isInLibrary ? 'var(--accent-hover)' : 'var(--text-dim)',
                transition: 'all 100ms ease',
              }}
            >
              <BookmarkCheck size={13} aria-hidden="true" />
              <span>{item.isInLibrary ? 'Enregistré' : 'Enregistrer'}</span>
            </button>
          ) : (
            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              {item.badge || (item.isBuiltIn ? 'Intégré' : 'Communauté')}
            </span>
          )}

          {/* Primary Card Action */}
          {item.needsKey && !item.hasKey ? (
            <button
              type="button"
              className="sr-pressable"
              onClick={onApply}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '6px 12px',
                borderRadius: '7px', background: 'var(--semantic-orange-bg)',
                border: '1px solid rgba(245, 158, 11, 0.35)', color: '#FCD34D',
                fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Lock size={12} aria-hidden="true" />
              <span>Configurer</span>
            </button>
          ) : (
            <button
              type="button"
              className="sr-pressable"
              onClick={onApply}
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                padding: '6px 12px',
                borderRadius: '7px',
                background: isActive ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-strong)',
                color: isActive ? '#FFFFFF' : 'var(--text-primary)',
                fontSize: '11.5px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {isActive ? (
                <>
                  <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                  <span>Actif</span>
                </>
              ) : item.category === 'code' ? (
                <>
                  <Play size={11} aria-hidden="true" />
                  <span>Tester</span>
                </>
              ) : item.category === 'maps' ? (
                <>
                  <MapIcon size={12} aria-hidden="true" />
                  <span>Activer</span>
                </>
              ) : item.category === 'routing' ? (
                <>
                  <Zap size={12} aria-hidden="true" />
                  <span>Choisir</span>
                </>
              ) : (
                <>
                  <Play size={11} aria-hidden="true" />
                  <span>Appliquer</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
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

  // Local persistence of library active/deactivated items
  // By default, all modules and public maps are in the library.
  // Private maps (requiring a missing key) are excluded by default.
  const [disabledLibraryIds, setDisabledLibraryIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('scoutraider_hub_disabled_ids');
      if (stored) return new Set(JSON.parse(stored));
    } catch {}
    return new Set();
  });

  const handleToggleLocalLibrary = useCallback((item: UnifiedResourceItem) => {
    if (item.rawModule && !item.isBuiltIn) {
      handleToggleLibrary(item.rawModule);
      return;
    }
    const id = item.id;
    setDisabledLibraryIds(prev => {
      const next = new Set(prev);
      const isCurrentlyIn = item.isInLibrary;
      if (isCurrentlyIn) {
        next.add(id);
        dispatch({
          type: 'ADD_NOTIFICATION',
          message: `"${item.name}" retiré de votre bibliothèque`,
          notifType: 'info'
        });
      } else {
        next.delete(id);
        dispatch({
          type: 'ADD_NOTIFICATION',
          message: `"${item.name}" ajouté à votre bibliothèque`,
          notifType: 'info'
        });
      }
      try {
        localStorage.setItem('scoutraider_hub_disabled_ids', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  }, [dispatch, handleToggleLibrary]);

  // ── 1. Map Layers (Original Rich Card Design) ──────────────────────────────
  const mapItems = useMemo<UnifiedResourceItem[]>(() => {
    const activeMapId = state.active_ign_layer || 'PLAN.IGN';
    return Object.entries(MAP_LAYERS).map(([id, data]) => {
      const provider = PROVIDERS[data.provider];
      const hasKey = data.provider === 'IGN' 
        ? !!state.ign_api_key 
        : (data.provider === 'Mapy.cz' ? !!state.mapy_api_key : true);
      const isActive = activeMapId === id;
      const isPrivate = data.needsKey && !hasKey;
      const inLib = !isPrivate && !disabledLibraryIds.has(id);

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
        isInLibrary: inLib,
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
            notifType: 'info' 
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
    const baseItems = ALL_MODULE_IDS.map(mId => {
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

      const isSpatial = mId === 'gilwell';
      const isMap = mId === 'carte_ign' || mId === 'carte_simple';
      const catLabel = isSpatial ? 'Module Spatial & Itinéraire' : isMap ? 'Cartographie & Repérage' : manifest?.type === 'visual' ? 'Module Visuel & Graphique' : 'Module de Chiffrement';
      const badgeLabel = isSpatial ? 'Itinéraire / Azimuts' : isMap ? 'Carte' : manifest?.type === 'visual' ? 'Graphique' : 'Chiffré';

      return {
        id: mId,
        name: meta.label,
        category: 'code' as const,
        categoryLabel: catLabel,
        description: manifest?.description || 'Module d\'encodage cryptographique ou visuel.',
        badge: badgeLabel,
        color: meta.color || '#f59e0b',
        icon,
        previewBannerComponent,
        isActive: false,
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has(mId),
        s3_download_url: `https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/${mId}-2.0.0.zip`,
        onApply: () => {
          setPreviewTestModule({ id: mId, name: meta.label });
          try {
            const encoded = ModuleLogic.encode(mId, 'SCOUT RAID 2026');
            setTestOutput((encoded as any)?.encoded_text || (typeof encoded === 'string' ? encoded : 'Module activé'));
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

    // Modules topographiques additionnels (Altimétrie, Aperçu général)
    const topoItems: UnifiedResourceItem[] = [
      {
        id: 'profil_altimetrique',
        name: 'Profil Altimétrique & Dénivelé',
        category: 'code' as const,
        categoryLabel: 'Topographie & Relief',
        description: 'Calcul et tracé vectoriel du profil altimétrique (courbes de niveau, D+, D-, altitude min/max, pente moyenne et jalons).',
        badge: 'Altimétrie / D+',
        color: '#0284c7',
        icon: <Sliders size={16} />,
        isActive: false,
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has('profil_altimetrique'),
        onApply: () => {
          dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Profil Altimétrique : Génération automatique du dénivelé pour votre raid.',
            notifType: 'info'
          });
        }
      },
      {
        id: 'apercu_carte_synoptique',
        name: 'Aperçu Synoptique de Carte',
        category: 'code' as const,
        categoryLabel: 'Topographie & Cartouche',
        description: 'Cartouche cartographique général avec vue d\'ensemble du parcours, rose des vents, échelle et boîte de sécurité.',
        badge: 'Vue d\'ensemble',
        color: '#16a34a',
        icon: <MapIcon size={16} />,
        isActive: false,
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has('apercu_carte_synoptique'),
        onApply: () => {
          dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Aperçu Synoptique : Cartouche général de raid activé.',
            notifType: 'info'
          });
        }
      }
    ];

    return [...baseItems, ...topoItems];
  }, [disabledLibraryIds]);

  // ── 2b. Moteurs de routage & Chargeurs de chemins (v2.0 Modular Standard) ──
  const [activeRoutingEngine, setActiveRoutingEngine] = useState<string>(() => {
    return localStorage.getItem('scoutraider_active_routing_engine') || 'routing_brouter';
  });

  const routingItems = useMemo<UnifiedResourceItem[]>(() => {
    const items: UnifiedResourceItem[] = [
      {
        id: 'routing_brouter',
        name: 'Moteur BRouter Randonnée',
        category: 'routing' as const,
        categoryLabel: 'Moteur de Routage Pédestre',
        description: 'Calcul d\'itinéraires pédestres haute précision optimisé pour les sentiers de randonnée (GR, PR), évitant les axes routiers dangereux.',
        badge: 'Sentiers / Randonnée',
        color: '#10b981',
        icon: <Compass size={16} />,
        isActive: activeRoutingEngine === 'routing_brouter',
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has('routing_brouter'),
        s3_download_url: 'https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/routing_brouter-2.0.0.zip',
        onApply: () => {
          setActiveRoutingEngine('routing_brouter');
          localStorage.setItem('scoutraider_active_routing_engine', 'routing_brouter');
          dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Moteur BRouter sélectionné comme moteur de routage par défaut.',
            notifType: 'info'
          });
        }
      },
      {
        id: 'routing_valhalla_ign',
        name: 'Moteur Valhalla BD TOPO IGN',
        category: 'routing' as const,
        categoryLabel: 'Moteur Souverain Géoplateforme',
        description: 'Calcul d\'itinéraires sur la base de données officielle BD TOPO de l\'IGN. Intègre le réseau des sentiers balisés nationaux français.',
        badge: 'IGN France / Valhalla',
        color: '#0284c7',
        icon: <ShieldCheck size={16} />,
        isActive: activeRoutingEngine === 'routing_valhalla_ign',
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has('routing_valhalla_ign'),
        s3_download_url: 'https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/routing_valhalla_ign-2.0.0.zip',
        onApply: () => {
          setActiveRoutingEngine('routing_valhalla_ign');
          localStorage.setItem('scoutraider_active_routing_engine', 'routing_valhalla_ign');
          dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Moteur IGN Géoplateforme BD TOPO sélectionné pour le routage.',
            notifType: 'info'
          });
        }
      },
      {
        id: 'routing_direct',
        name: 'Azimut Direct & Vol d\'Oiseau',
        category: 'routing' as const,
        categoryLabel: 'Moteur Hors-Piste & Boussole',
        description: 'Calcul de tracés directs à vol d\'oiseau pour progression hors-sentier, navigation boussole et franchissements.',
        badge: '100% Hors-ligne',
        color: '#f59e0b',
        icon: <Zap size={16} />,
        isActive: activeRoutingEngine === 'routing_direct',
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has('routing_direct'),
        s3_download_url: 'https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/routing_direct-2.0.0.zip',
        onApply: () => {
          setActiveRoutingEngine('routing_direct');
          localStorage.setItem('scoutraider_active_routing_engine', 'routing_direct');
          dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Mode azimut direct (vol d\'oiseau) sélectionné.',
            notifType: 'info'
          });
        }
      },
      {
        id: 'loader_gpx',
        name: 'Chargeur GPX Universel',
        category: 'routing' as const,
        categoryLabel: 'Connecteur & Import de Traces',
        description: 'Importateur et analyseur de traces GPS au standard XML GPX (1.0 / 1.1). Extrait tracés, altitudes, chronos et waypoints d\'étapes.',
        badge: 'GPX / Garmin / Montres',
        color: '#8b5cf6',
        icon: <MapIcon size={16} />,
        isActive: false,
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has('loader_gpx'),
        s3_download_url: 'https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/loader_gpx-2.0.0.zip',
        onApply: () => {
          dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Chargeur GPX prêt : glissez un fichier .gpx sur la carte ou ouvrez le gestionnaire de traces.',
            notifType: 'info'
          });
        }
      },
      {
        id: 'loader_geojson',
        name: 'Chargeur Vectoriel GeoJSON SIG',
        category: 'routing' as const,
        categoryLabel: 'Connecteur Données Vectorielles',
        description: 'Importateur universel de tracés vectoriels et couches SIG au format GeoJSON, FeatureCollection et KML normalisé.',
        badge: 'GeoJSON / SIG / KML',
        color: '#ec4899',
        icon: <Globe size={16} />,
        isActive: false,
        isBuiltIn: true,
        isInLibrary: !disabledLibraryIds.has('loader_geojson'),
        s3_download_url: 'https://s3-scoutraider.silverhorse.fr/scoutraider-assets/modules/loader_geojson-2.0.0.zip',
        onApply: () => {
          dispatch({
            type: 'ADD_NOTIFICATION',
            message: 'Chargeur GeoJSON prêt : compatible QGIS, Overpass OSM et Leaflet.',
            notifType: 'info'
          });
        }
      }
    ];
    return items;
  }, [activeRoutingEngine, disabledLibraryIds, dispatch]);

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
            Niveau {i + 1} • {(p as any).polygonalisation?.hors_piste ? 'Hors-piste' : 'Sentiers BRouter'}
          </div>
        </div>
      );

      return {
        id: p.id,
        name: p.name,
        category: 'orchestration',
        categoryLabel: p.isCustom ? 'Trame de Raid Personnalisée' : 'Trame de Raid Officielle',
        description: p.isCustom 
          ? 'Trame de progression et contraintes sur-mesure pour votre carnet de raid.' 
          : 'Trame pédagogique officielle avec gestion des dépendances et alternance des étapes.',
        badge: p.isCustom ? 'Trame Custom' : `Trame Niveau ${i + 1}`,
        color: themeColor,
        icon: <Sliders size={16} />,
        previewBannerComponent,
        isActive,
        isBuiltIn: !p.isCustom,
        isInLibrary: !disabledLibraryIds.has(p.id),
        onApply: () => {
          dispatch({ type: 'SET_PRESET', presetId: p.id });
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            message: `Trame appliquée : ${p.name}`, 
            notifType: 'info' 
          });
        },
        onEdit: () => {
          setActiveEditingId(p.id);
          setPresetEditorOpen(true);
        }
      };
    });
  }, [state.active_preset_id, disabledLibraryIds, dispatch]);

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
        isInLibrary: !disabledLibraryIds.has(id),
        metaDetails: { vigenere_key: data.vigenere_key },
        onApply: () => {
          dispatch({ type: 'SET_THEME', themeId: id });
          dispatch({ 
            type: 'ADD_NOTIFICATION', 
            message: `Thème narratif activé : ${id}`, 
            notifType: 'info' 
          });
        },
        onEdit: () => {
          setActiveEditingId(id);
          setThemeEditorOpen(true);
        }
      };
    });
  }, [state.theme_id, disabledLibraryIds, dispatch]);

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
    return [...mapItems, ...routingItems, ...codeItems, ...orchestrationItems, ...themeItems, ...cloudItems];
  }, [mapItems, routingItems, codeItems, orchestrationItems, themeItems, cloudItems]);

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
    { id: 'all' as UnifiedCategory, label: 'Tout', icon: <Sparkles size={12} aria-hidden="true" />, count: allItems.length },
    { id: 'maps' as UnifiedCategory, label: 'Cartes', icon: <MapIcon size={12} aria-hidden="true" />, count: mapItems.length },
    { id: 'routing' as UnifiedCategory, label: 'Routage', icon: <Compass size={12} aria-hidden="true" />, count: routingItems.length },
    { id: 'code' as UnifiedCategory, label: 'Codes', icon: <Code size={12} aria-hidden="true" />, count: codeItems.length },
    { id: 'orchestration' as UnifiedCategory, label: 'Trames', icon: <Sliders size={12} aria-hidden="true" />, count: orchestrationItems.length },
    { id: 'theme' as UnifiedCategory, label: 'Thèmes', icon: <Palette size={12} aria-hidden="true" />, count: themeItems.length },
    { id: 'my_library' as UnifiedCategory, label: 'Bibliothèque', icon: <BookmarkCheck size={12} aria-hidden="true" />, count: allItems.filter(i => i.isInLibrary).length }
  ], [allItems, mapItems, routingItems, codeItems, orchestrationItems, themeItems]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-base)',
      color: 'var(--text-primary)',
      overflow: 'hidden'
    }}>
      {/* ── COMPACT, UNCLUTTERED HEADER CONTROLS ──────────────────────── */}
      <div style={{
        padding: isCompact ? '10px 12px 8px' : '14px clamp(16px, 3vw, 32px) 10px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-dark)',
        flexShrink: 0
      }}>
        <div style={{
          maxWidth: isCompact ? 'none' : '1360px',
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
        {/* Search bar & compact Scope switch */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{
            flex: '1 1 180px',
            minWidth: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '0 10px',
            height: '32px'
          }}>
            <Search size={14} color="var(--text-dim)" aria-hidden="true" style={{ flexShrink: 0, marginRight: '7px' }} />
            <input
              type="text"
              aria-label="Rechercher dans la marketplace"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher…"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: '12px',
                width: '100%',
                minWidth: 0,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="Effacer la recherche"
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
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Lightweight Scope Switch */}
          <div role="group" aria-label="Filtrer par source" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '8px',
            padding: '2px',
            height: '32px',
            boxSizing: 'border-box',
          }}>
            {(['all', 'installed', 'community'] as UnifiedScope[]).map(s => {
              const isSActive = scopeFilter === s;
              const label = s === 'all' ? 'Tous' : s === 'installed' ? 'Locaux' : 'Cloud';
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={isSActive}
                  onClick={() => setScopeFilter(s)}
                  style={{
                    background: isSActive ? 'var(--bg-hover)' : 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    color: isSActive ? 'var(--text-primary)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: isSActive ? 600 : 500,
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
              type="button"
              className="btn-icon"
              onClick={onExpandFullscreen}
              title="Agrandir en grand écran"
              aria-label="Agrandir en grand écran"
              style={{ height: '32px', width: '32px', border: '1px solid var(--border-subtle)' }}
            >
              <Maximize2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Borderless Category Pills — airy, no nested box, counts only on active tab */}
        <div role="tablist" aria-label="Catégories de ressources" style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px',
        }}>
          {categories.map(cat => {
            const isCatActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isCatActive}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  height: '26px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: isCatActive ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid transparent',
                  background: isCatActive ? 'var(--accent-transparent)' : 'transparent',
                  color: isCatActive ? 'var(--accent-hover)' : 'var(--text-dim)',
                  fontSize: '11.5px',
                  fontWeight: isCatActive ? 600 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background-color 100ms ease, color 100ms ease'
                }}
              >
                {cat.icon}
                <span>{cat.label}</span>
                {isCatActive && (
                  <span className="tabular-nums" style={{
                    fontSize: '10px',
                    color: 'var(--accent-hover)',
                    fontWeight: 600,
                    opacity: 0.85,
                  }}>
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {/* ── GALLERY AREA (RESPONSIVE AUTO-FILL GRID) ──── */}
      <div 
        ref={galleryRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: isCompact ? '12px' : 'clamp(16px, 2.5vw, 24px) clamp(16px, 3vw, 32px)',
          background: 'var(--bg-base)'
        }}
      >
        <div style={{
          maxWidth: isCompact ? 'none' : '1360px',
          width: '100%',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 275px), 1fr))',
          gridAutoRows: 'max-content',
          gap: isCompact ? '10px' : '14px',
          alignContent: 'start',
          alignItems: 'stretch',
        }}>
        {filteredItems.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '48px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--text-dim)'
          }}>
            <Sparkles size={28} aria-hidden="true" style={{ opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {searchQuery ? `Aucun résultat pour « ${searchQuery} »` : 'Aucune ressource dans cette catégorie'}
            </div>
            <div style={{ fontSize: '12px', maxWidth: '320px', lineHeight: 1.5 }}>
              Modifiez votre recherche ou réinitialisez les filtres pour explorer tout le catalogue.
            </div>
            {(searchQuery || scopeFilter !== 'all' || activeCategory !== 'all') && (
              <button
                type="button"
                className="sr-btn-secondary"
                onClick={() => { setSearchQuery(''); setScopeFilter('all'); setActiveCategory('all'); }}
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : activeCategory === 'all' && !searchQuery ? (
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {([
              { id: 'maps' as UnifiedCategory, title: 'Fonds de carte' },
              { id: 'routing' as UnifiedCategory, title: 'Routage & Chemins' },
              { id: 'code' as UnifiedCategory, title: 'Codes & Énigmes' },
              { id: 'orchestration' as UnifiedCategory, title: 'Trames de Raid' },
              { id: 'theme' as UnifiedCategory, title: 'Thèmes & Récits' },
            ]).map(sec => {
              const sectionItems = filteredItems.filter(i => i.category === sec.id);
              if (sectionItems.length === 0) return null;
              const previewCount = isCompact ? 2 : 4;
              const visibleSlice = sectionItems.slice(0, previewCount);
              return (
                <section key={sec.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{sec.title}</span>
                      <span className="tabular-nums" style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 500 }}>
                        ({sectionItems.length})
                      </span>
                    </h3>
                    {sectionItems.length > previewCount && (
                      <button
                        type="button"
                        onClick={() => setActiveCategory(sec.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--accent-hover)',
                          fontSize: '11.5px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          padding: '2px 4px',
                        }}
                      >
                        Voir tout ({sectionItems.length})
                      </button>
                    )}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isCompact ? 'minmax(0, 1fr)' : 'repeat(auto-fill, minmax(min(100%, 275px), 1fr))',
                    gridAutoRows: 'max-content',
                    gap: isCompact ? '10px' : '14px',
                    alignItems: 'stretch',
                  }}>
                    {visibleSlice.map(item => (
                      <ResourceHubCard
                        key={`${item.category}-${item.id}`}
                        item={item}
                        isActive={item.isActive}
                        onApply={item.onApply}
                        onEdit={item.onEdit}
                        onToggleLibrary={() => handleToggleLocalLibrary(item)}
                        onDragStart={item.onDragStart}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          filteredItems.map(item => (
            <ResourceHubCard
              key={`${item.category}-${item.id}`}
              item={item}
              isActive={item.isActive}
              onApply={item.onApply}
              onEdit={item.onEdit}
              onToggleLibrary={() => handleToggleLocalLibrary(item)}
              onDragStart={item.onDragStart}
            />
          ))
        )}
        </div>
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
                  const res = ModuleLogic.encode(previewTestModule.id, val);
                  setTestOutput((res as any)?.encoded_text || (typeof res === 'string' ? res : ''));
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

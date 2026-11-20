/**
 * BlockGutter.tsx — Colonne latérale unifiée pour tous les blocs du carnet
 * Largeur fixe : 44px (22px indicateur + 8px gap + 14px menu 3 points)
 * Contient : indicateur de type, label d'étape (A,B,C), bouton 3 points
 * Aligné pour tous les types : commentaire, code, carte, computed, etc.
 */
import React, { useRef, useMemo } from 'react';
import {
    MessageSquarePlus, Code2, Map, MapPin, Layers,
    Key, Grid, Hash, Flag, RotateCcw, Minus, Circle, Type,
    MoreVertical, Check, MoveUp, MoveDown, Copy, Link2, Trash2,
    Settings, Palette, Globe, Eye, EyeOff, Lock, Unlock
} from 'lucide-react';
import { MODULE_META } from '../../logic/ModuleRegistry';
import { ModuleManagementService } from '../../logic/ModuleManagementService';
import { CIPHER_FONTS, CIPHER_FONT_SIZES, CIPHER_ICONS } from './MarkdownRenderer';
import UnifiedContextMenu from './UnifiedContextMenu';
import type { ModuleId, CarnetStep, NavLanguage } from '../../logic/types';
import { useApp } from '../../AppContext';

// ─── Largeur fixe du gutter ──────────────────────────────────────────────
export const GUTTER_WIDTH = 26; // Colonne latérale épurée pour l'icône interactive du module

// ─── Types ──────────────────────────────────────────────────────────────
export interface BlockGutterProps {
    /** Type de bloc pour choisir l'icône */
    blockType: 'html' | 'code' | 'computed' | 'map' | 'title' | 'generic';
    /** Données du bloc */
    blockData: CarnetStep;
    /** Couleur d'étape (optionnelle) */
    stepColor?: string;
    /** Module ID pour les blocs code */
    moduleId?: ModuleId;
    /** Si le bloc est sélectionné */
    isSelected?: boolean;
    /** Si c'est un bloc titre */
    isTitle?: boolean;
    /** Si le bloc parent est survolé */
    isHovered?: boolean;
    /** Position d'ouverture externe du menu contextuel (clic droit ou long press) */
    contextMenuPos?: { x: number; y: number } | null;
    /** Callback d'ouverture manuelle du menu contextuel */
    onOpenContextMenu?: (pos: { x: number; y: number }) => void;
    /** Callback de fermeture du menu contextuel */
    onCloseContextMenu?: () => void;
    /** Callbacks */
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onCopy?: () => void;
    onLinkRef?: () => void;
    onConvertToCode?: (cipher: ModuleId) => void;
    onConvertToHtml?: () => void;
    onChangeCipher?: (cipher: ModuleId) => void;
    onChangeLanguage?: (lang: string) => void;
    onTogglePOI?: (poiId: string) => void;
    onToggleSolution?: () => void;
    onLockToggle?: () => void;
    onOpenFonts?: () => void;
    onOpenSettings?: () => void;
    /** États pour menu contextuel */
    isLocked?: boolean;
    isSolutionView?: boolean;
    hasSolution?: boolean;
    navLanguage?: NavLanguage;
    pois?: Array<{ id: string; name: string; selected: boolean }>;
    /** Ref pour le conteneur parent (pour positionnement menu) */
    containerRef?: React.RefObject<HTMLDivElement>;
    /** Si le bloc est calculé depuis l'itinéraire */
    isComputedBlock?: boolean;
}

/**
 * Retourne l'icône et la couleur pour un type de bloc/module
 */
function getBlockIndicator(blockType: BlockGutterProps['blockType'], blockData: CarnetStep, moduleId?: ModuleId, isTitle = false) {
    const meta = moduleId ? MODULE_META[moduleId] : null;
    const color = meta?.color || '#6b7280';
    const font = CIPHER_FONTS[moduleId || ''] || 'monospace';
    const size = CIPHER_FONT_SIZES[moduleId || ''] || '14px';

    switch (blockType) {
        case 'title':
            return {
                icon: <MessageSquarePlus size={11} color={isTitle ? 'var(--accent-hover)' : 'var(--text-dim)'} strokeWidth={2.4} />,
                bg: isTitle ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-surface)',
                border: isTitle ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid var(--border-subtle)',
                tooltip: 'Titre du document'
            };

        case 'html':
            return {
                icon: <MessageSquarePlus size={11} color='var(--text-dim)' strokeWidth={2.4} />,
                bg: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                tooltip: 'Commentaire'
            };

        case 'code':
            // Icône spécifique au cipher
            const cipherIcon = CIPHER_ICONS[moduleId || ''] || <Code2 size={11} color={color} strokeWidth={2.5} />;
            return {
                icon: cipherIcon,
                bg: `${color}18`,
                border: `1.5px solid ${color}55`,
                tooltip: `Code ${meta?.label || moduleId}`
            };

        case 'computed':
            // Pour les blocs calculés, montrer l'icône du module
            if (moduleId) {
                if (['carte_ign', 'carte_simple', 'drapeaux'].includes(moduleId)) {
                    return {
                        icon: <MapPin size={11} color={color} strokeWidth={2.4} />,
                        bg: `${color}18`,
                        border: `1.5px solid ${color}55`,
                        tooltip: `Carte ${MODULE_META[moduleId]?.label || moduleId}`
                    };
                }
                if (moduleId === 'gilwell') {
                    return {
                        icon: <Layers size={11} color={color} strokeWidth={2.4} />,
                        bg: `${color}18`,
                        border: `1.5px solid ${color}55`,
                        tooltip: 'Gilwell'
                    };
                }
                // Ciphers textuels
                const cipherIcon = CIPHER_ICONS[moduleId] || <Code2 size={11} color={color} strokeWidth={2.5} />;
                return {
                    icon: cipherIcon,
                    bg: `${color}18`,
                    border: `1.5px solid ${color}55`,
                    tooltip: `${MODULE_META[moduleId]?.label || moduleId} (calculé)`
                };
            }
            return {
                icon: <Code2 size={11} color={color} strokeWidth={2.5} />,
                bg: `${color}18`,
                border: `1.5px solid ${color}55`,
                tooltip: 'Bloc calculé'
            };

        case 'map':
            return {
                icon: <MapPin size={11} color={color} strokeWidth={2.4} />,
                bg: `${color}18`,
                border: `1.5px solid ${color}55`,
                tooltip: 'Carte'
            };

        default:
            return {
                icon: <Circle size={11} color='var(--text-dim)' strokeWidth={2} />,
                bg: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                tooltip: 'Bloc'
            };
    }
}

/**
 * Gutter unifié - Colonne de gauche fixe pour tous les blocs
 */
export default function BlockGutter({
    blockType,
    blockData,
    moduleId,
    isSelected,
    isTitle = false,
    isHovered = false,
    contextMenuPos,
    onOpenContextMenu,
    onCloseContextMenu,
    onEdit,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onCopy,
    onLinkRef,
    onConvertToCode,
    onConvertToHtml,
    onChangeCipher,
    onChangeLanguage,
    onTogglePOI,
    onToggleSolution,
    onLockToggle,
    onOpenFonts,
    onOpenSettings,
    isLocked = false,
    isSolutionView = false,
    hasSolution = false,
    navLanguage,
    pois = [],
    containerRef,
    isComputedBlock = false
}: BlockGutterProps) {
    const { dispatch } = useApp();
    const indicator = getBlockIndicator(blockType, blockData, moduleId, isTitle);
    const meta = moduleId ? MODULE_META[moduleId] : null;
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Déterminer les ciphers textuels disponibles
    const textualCiphers = useMemo(() =>
        ModuleManagementService.getAllModules()
            .filter(m =>
                m.resource_type === 'crypto_module' &&
                !['map_path', 'elevation_profile', 'map_overview'].includes(m.data_capability || '')
            )
            .map(m => m.id as ModuleId),
        []
    );

    const handleIconClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onOpenContextMenu?.({ x: rect.right + 6, y: rect.top });
    };

    return (
        <div
            className="block-gutter"
            style={{
                width: GUTTER_WIDTH,
                marginRight: '12px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                paddingTop: '2px',
                position: 'relative',
                userSelect: 'none',
            }}
        >
            {/* Icône interactive du module (clic ouvre les options synthétiques) */}
            <button
                type="button"
                onClick={handleIconClick}
                style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    background: indicator.bg,
                    border: indicator.border,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: meta?.color || 'var(--text-dim)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 120ms ease, box-shadow 120ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                title={`${indicator.tooltip} — Clic pour les options`}
            >
                {indicator.icon}
            </button>

            {/* Icône de synchronisation avec l'itinéraire */}
            {isComputedBlock && (
                <div title="Synchronisé avec l'itinéraire" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px', opacity: 0.4 }}>
                    <Link2 size={8} color="var(--text-dim)" strokeWidth={2} />
                </div>
            )}

            {/* Menu contextuel unifié (sans bouton 3 points visible, activable par clic icône, clic droit ou appui long) */}
            <UnifiedContextMenu
                blockType={blockType}
                blockId={blockData.id}
                blockData={blockData}
                availableCiphers={textualCiphers}
                triggerRef={triggerRef}
                showTriggerButton={false}
                anchorPosition={contextMenuPos}
                onClose={onCloseContextMenu}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onCopy={onCopy}
                onLinkReference={onLinkRef}
                onConvertToCode={onConvertToCode}
                onConvertToHtml={onConvertToHtml}
                onChangeCipher={onChangeCipher}
                onChangeLanguage={onChangeLanguage}
                onTogglePOI={onTogglePOI}
                onToggleSolution={onToggleSolution}
                onLockToggle={onLockToggle}
                onOpenFontSelector={onOpenFonts}
                onOpenSettings={onOpenSettings}
                isLocked={isLocked}
                isSolutionView={isSolutionView}
                hasSolution={hasSolution}
                navLanguage={navLanguage}
                pois={pois}
                isHovered={isHovered}
            />

            {/* Indicateur de sélection (check) */}
            {isSelected && (
                <div
                    style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '5px',
                        background: 'var(--accent-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        marginTop: '2px',
                    }}
                    title="Bloc sélectionné"
                >
                    <Check size={11} strokeWidth={3} />
                </div>
            )}
        </div>
    );
}

// Re-export pour utilisation dans d'autres composants
export { getBlockIndicator };
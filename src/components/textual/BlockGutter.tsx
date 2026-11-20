/**
 * BlockGutter.tsx — Colonne latérale unifiée pour tous les blocs du carnet
 * Largeur fixe : 44px (22px indicateur + 8px gap + 14px menu 3 points)
 * Contient : indicateur de type, label d'étape (A,B,C), bouton 3 points
 * Aligné pour tous les types : commentaire, code, carte, computed, etc.
 */
import React, { useRef } from 'react';
import {
    MessageSquarePlus, Code2, Map, MapPin, Layers,
    Key, Grid, Hash, Flag, RotateCcw, Minus, Circle, Type,
    MoreVertical, Check, MoveUp, MoveDown, Copy, Link2, Trash2,
    Settings, Palette, Globe, Eye, EyeOff, Lock, Unlock
} from 'lucide-react';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import { CIPHER_FONTS, CIPHER_FONT_SIZES, CIPHER_ICONS } from './MarkdownRenderer';
import UnifiedContextMenu from './UnifiedContextMenu';
import type { ModuleId, CarnetStep, NavLanguage } from '../../logic/types';
import { useApp } from '../../AppContext';

// ─── Largeur fixe du gutter ──────────────────────────────────────────────
export const GUTTER_WIDTH = 56; // Permet d'afficher l'indicateur d'étape (A,B,C ou n°) + l'icône du module de cryptage/carte

// ─── Types ──────────────────────────────────────────────────────────────
export interface BlockGutterProps {
    /** Type de bloc pour choisir l'icône */
    blockType: 'html' | 'code' | 'computed' | 'map' | 'title' | 'generic';
    /** Données du bloc */
    blockData: CarnetStep;
    /** Label d'étape (A, B, C...) */
    stepLabel?: string;
    /** Numéro d'étape dans l'itinéraire (1, 2, 3...) */
    stepNumber?: number | string;
    /** Couleur d'étape */
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
    stepLabel,
    stepNumber,
    stepColor,
    moduleId,
    isSelected,
    isTitle = false,
    isHovered = false,
    contextMenuPos,
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
    containerRef
}: BlockGutterProps) {
    const { dispatch } = useApp();
    const indicator = getBlockIndicator(blockType, blockData, moduleId, isTitle);
    const meta = moduleId ? MODULE_META[moduleId] : null;
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Déterminer les ciphers textuels disponibles
    const textualCiphers = ALL_MODULE_IDS.filter(id =>
        ['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis', 'texte_clair'].includes(id)
    );

    const hasRouteStep = !!stepLabel || stepNumber !== undefined;

    return (
        <div
            className="block-gutter"
            style={{
                width: GUTTER_WIDTH,
                marginRight: '10px',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                paddingTop: '2px',
                position: 'relative',
                userSelect: 'none',
            }}
        >
            {/* Ligne des badges dans la marge : [ Étape/N° ] + [ Icône Module/Cryptage ] */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    width: '100%',
                    flexShrink: 0,
                    minHeight: '24px',
                }}
            >
                {/* 1. Badge d'étape de l'itinéraire (A, B, C ou numéro de segment) */}
                {stepLabel ? (
                    <div
                        style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: 'var(--bg-base)',
                            border: `2px solid ${stepColor || 'var(--accent-default)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '11px',
                            fontWeight: 800,
                            color: stepColor || 'var(--accent-default)',
                            fontFamily: 'var(--font-mono)',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                        title={`Étape ${stepLabel} de l'itinéraire`}
                    >
                        {stepLabel}
                    </div>
                ) : stepNumber !== undefined ? (
                    <div
                        style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            background: 'var(--bg-surface)',
                            border: '1.5px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '10px',
                            fontWeight: 700,
                            color: 'var(--text-dim)',
                            fontFamily: 'var(--font-mono)',
                        }}
                        title={`Segment ${stepNumber} de l'itinéraire`}
                    >
                        {stepNumber}
                    </div>
                ) : null}

                {/* 2. Icône du type de module (texte, cryptage spécifique, carte IGN, gilwell...) */}
                <div
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
                        transition: 'transform 120ms ease',
                    }}
                    title={indicator.tooltip}
                >
                    {indicator.icon}
                </div>
            </div>

            {/* 3. Menu contextuel unifié (3 points) */}
            <UnifiedContextMenu
                blockType={blockType}
                blockId={blockData.id}
                blockData={blockData}
                availableCiphers={textualCiphers}
                triggerRef={triggerRef}
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

            {/* 4. Indicateur de sélection (check) */}
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
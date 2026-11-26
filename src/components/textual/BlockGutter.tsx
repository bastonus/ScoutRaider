/**
 * BlockGutter.tsx — Gouttière unifiée de 40px façon Notion pour tous les blocs.
 * Au repos : invisible (sauf repère d'anomalie ou coche de sélection).
 * Au survol (ou focus tactile) : affiche `+` (insérer & menu `/`) et `⋮⋮` (glisser / menu du bloc).
 */
import React, { useRef, useMemo } from 'react';
import { Plus, GripVertical, Check } from 'lucide-react';
import { ModuleManagementService } from '../../logic/ModuleManagementService';
import UnifiedContextMenu from './UnifiedContextMenu';
import type { ModuleId, CarnetStep, NavLanguage } from '../../logic/types';

// ─── Largeur fixe de la gouttière (Lot A : 40px) ──────────────────────────
export const GUTTER_WIDTH = 40;

export interface BlockGutterProps {
    blockType: 'html' | 'code' | 'computed' | 'map' | 'title' | 'generic';
    blockData: CarnetStep;
    stepColor?: string;
    moduleId?: ModuleId;
    isSelected?: boolean;
    isTitle?: boolean;
    isHovered?: boolean;
    /** Sur tactile : affiche les poignées quand le bloc a le focus */
    isFocused?: boolean;
    /** Indique une anomalie sur ce bloc (repère discret dans la gouttière) */
    hasWarning?: boolean;
    contextMenuPos?: { x: number; y: number } | null;
    onOpenContextMenu?: (pos: { x: number; y: number }) => void;
    onCloseContextMenu?: () => void;
    /** + : insérer une ligne en dessous et ouvrir le menu / */
    onInsertBelow?: (anchorRect: DOMRect) => void;
    /** Glisser-déposer via ⋮⋮ */
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
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
    /** Actions Lot E/F/G */
    onRegenerate?: () => void;
    onDetach?: () => void;
    onRestoreGenerated?: () => void;
    onChangeTextColor?: (color: string) => void;
    onChangeTextAlign?: (align: 'left' | 'center' | 'right') => void;
    onChangeMapSize?: (size: 'column' | 'wide' | 'full') => void;
    onToggleMapAutoFrame?: () => void;
    onOpenOnMap?: () => void;
    isLocked?: boolean;
    isSolutionView?: boolean;
    hasSolution?: boolean;
    navLanguage?: NavLanguage;
    pois?: Array<{ id: string; name: string; selected: boolean }>;
    containerRef?: React.RefObject<HTMLDivElement>;
    isComputedBlock?: boolean;
}

export default function BlockGutter({
    blockType,
    blockData,
    isSelected,
    isHovered = false,
    isFocused = false,
    hasWarning = false,
    contextMenuPos,
    onOpenContextMenu,
    onCloseContextMenu,
    onInsertBelow,
    onDragStart,
    onDragEnd,
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
    onRegenerate,
    onDetach,
    onRestoreGenerated,
    onChangeTextColor,
    onChangeTextAlign,
    onChangeMapSize,
    onToggleMapAutoFrame,
    onOpenOnMap,
    isLocked = false,
    isSolutionView = false,
    hasSolution = false,
    navLanguage,
    pois = [],
    isComputedBlock = false
}: BlockGutterProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const plusBtnRef = useRef<HTMLButtonElement>(null);

    const textualCiphers = useMemo(() =>
        ModuleManagementService.getAllModules()
            .filter(m =>
                m.resource_type === 'crypto_module' &&
                !['map_path', 'elevation_profile', 'map_overview'].includes(m.data_capability || '')
            )
            .map(m => m.id as ModuleId),
        []
    );

    const showHandles = isHovered || isFocused || Boolean(contextMenuPos);

    const handleMenuClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onOpenContextMenu?.({ x: rect.right + 6, y: rect.top });
    };

    const handlePlusClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onInsertBelow?.(rect);
    };

    const handleBtnStyle: React.CSSProperties = {
        width: '18px',
        minWidth: '18px',
        height: '28px',
        minHeight: '28px',
        borderRadius: '5px',
        background: 'transparent',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        padding: 0,
        transition: 'background 100ms ease, color 100ms ease',
    };

    return (
        <div
            className="block-gutter"
            style={{
                width: `${GUTTER_WIDTH}px`,
                minWidth: `${GUTTER_WIDTH}px`,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: 0,
                paddingRight: '4px',
                boxSizing: 'border-box',
                position: 'relative',
                userSelect: 'none',
            }}
        >
            {/* Poignées + et ⋮⋮ : visibles au survol ou au focus (tactile), sans décaler le contenu */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    opacity: showHandles ? 1 : 0,
                    pointerEvents: showHandles ? 'auto' : 'none',
                    transition: 'opacity 110ms ease',
                }}
            >
                <button
                    ref={plusBtnRef}
                    type="button"
                    aria-label="Insérer un bloc en dessous"
                    title="Cliquer pour insérer en dessous"
                    onClick={handlePlusClick}
                    style={handleBtnStyle}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-dim)';
                    }}
                >
                    <Plus size={14} strokeWidth={2.2} />
                </button>

                <button
                    ref={triggerRef}
                    type="button"
                    aria-label="Menu du bloc et déplacement"
                    title="Glisser pour déplacer · Cliquer pour les options"
                    draggable={Boolean(onDragStart)}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onClick={handleMenuClick}
                    style={{
                        ...handleBtnStyle,
                        cursor: onDragStart ? 'grab' : 'pointer',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-dim)';
                    }}
                >
                    <GripVertical size={14} strokeWidth={2.1} />
                </button>
            </div>

            {/* Pastilles d'alerte retirées pour le moment */}

            {/* Indicateur de multi-sélection */}
            {isSelected && (
                <div
                    style={{
                        position: 'absolute',
                        right: '8px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '4px',
                        background: 'var(--accent-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#ffffff',
                        pointerEvents: 'none',
                    }}
                    title="Bloc sélectionné"
                >
                    <Check size={10} strokeWidth={3} />
                </div>
            )}

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
                onRegenerate={onRegenerate}
                onDetach={onDetach}
                onRestoreGenerated={onRestoreGenerated}
                onChangeTextColor={onChangeTextColor}
                onChangeTextAlign={onChangeTextAlign}
                onChangeMapSize={onChangeMapSize}
                onToggleMapAutoFrame={onToggleMapAutoFrame}
                onOpenOnMap={onOpenOnMap}
                isLocked={isLocked}
                isSolutionView={isSolutionView}
                hasSolution={hasSolution}
                navLanguage={navLanguage}
                pois={pois}
                isHovered={isHovered}
                isComputedBlock={isComputedBlock}
            />
        </div>
    );
}

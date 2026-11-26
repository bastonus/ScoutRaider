/**
 * UnifiedContextMenu.tsx — Menu contextuel unifié et synthétique
 * Style épuré identique à la barre d'outils flottante (bg-elevated, border-strong, shadow-lg)
 * Déclenché par :
 * - Clic gauche sur le bouton 3 points du gutter
 * - Clic droit n'importe où sur le bloc
 * - Appui long (500ms) sur mobile / tactile
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    MoreVertical, Edit2, Trash2, Copy, MoveUp, MoveDown,
    Lock, Unlock, Eye, EyeOff, Palette, MapPin, Check,
    Waves, Key, Grid, Hash, Flag, RotateCcw, Minus, Type, Layers, Code2
} from 'lucide-react';
import { ModuleManagementService } from '../../logic/ModuleManagementService';
import { themeManager } from '../../logic/ThemeManager';
import { useApp } from '../../AppContext';
import type { ModuleId, NavLanguage } from '../../logic/types';

export interface UnifiedContextMenuProps {
    blockType: 'html' | 'code' | 'computed' | 'map' | 'annexe' | 'title' | 'generic';
    blockId: string;
    blockData?: any;
    availableCiphers?: ModuleId[];
    anchorPosition?: { x: number; y: number } | null;
    triggerRef?: React.RefObject<HTMLButtonElement>;
    isHovered?: boolean;
    showTriggerButton?: boolean;
    isLocked?: boolean;
    isSolutionView?: boolean;
    hasSolution?: boolean;
    navLanguage?: string;
    pois?: Array<{ id: string; name: string; selected: boolean }>;
    onEdit?: () => void;
    onDelete?: () => void;
    onDuplicate?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onCopy?: () => void;
    onLinkReference?: () => void;
    onConvertToCode?: (cipher: ModuleId) => void;
    onConvertToHtml?: () => void;
    onChangeCipher?: (cipher: ModuleId) => void;
    onChangeLanguage?: (lang: string) => void;
    onTogglePOI?: (poiId: string) => void;
    onToggleSolution?: () => void;
    onLockToggle?: () => void;
    onOpenFontSelector?: () => void;
    onOpenSettings?: () => void;
    onRegenerate?: () => void;
    onDetach?: () => void;
    onRestoreGenerated?: () => void;
    onChangeTextColor?: (color: string) => void;
    onChangeTextAlign?: (align: 'left' | 'center' | 'right') => void;
    onChangeMapSize?: (size: 'column' | 'wide' | 'full') => void;
    onToggleMapAutoFrame?: () => void;
    onOpenOnMap?: () => void;
    isComputedBlock?: boolean;
    onClose?: () => void;
}



const NAV_LANGUAGES: { id: NavLanguage; label: string }[] = [
    { id: 'Horaire', label: '12h' },
    { id: 'Cardinaux', label: 'N-E' },
    { id: 'Azimut', label: 'Azimut' },
    { id: 'Tournant', label: 'Tournant' },
];

export default function UnifiedContextMenu({
    blockType,
    blockId,
    blockData,
    anchorPosition,
    triggerRef,
    isHovered = false,
    showTriggerButton = false,
    isLocked = false,
    isSolutionView = false,
    hasSolution = false,
    navLanguage,
    pois = [],
    onEdit,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onCopy,
    onConvertToCode,
    onConvertToHtml,
    onChangeCipher,
    onChangeLanguage,
    onTogglePOI,
    onToggleSolution,
    onLockToggle,
    onOpenFontSelector,
    onRegenerate,
    onDetach,
    onRestoreGenerated,
    onChangeTextColor,
    onChangeTextAlign,
    onChangeMapSize,
    onToggleMapAutoFrame,
    onOpenOnMap,
    isComputedBlock = false,
    onClose
}: UnifiedContextMenuProps) {
    const { state, dispatch } = useApp();
    const [isOpen, setIsOpen] = useState(false);
    const [showAdvancedCodes, setShowAdvancedCodes] = useState(false);
    const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);

    const currentCipher = blockData?.moduleId as ModuleId | undefined;
    const themeIds = useMemo(() => {
        try {
            return themeManager.getThemeIds();
        } catch {
            return ['Neutre'];
        }
    }, [isOpen]);

    // Chargement dynamique de tous les ciphers (standards + codes avancés)
    const { standardCiphers, advancedCiphers } = useMemo(() => {
        const STANDARD_IDS = new Set(['morse', 'vigenere', 'avocat', 'cassis', 'polybe', 'templier', 'maritime', 'texte_clair']);
        const managedModules = ModuleManagementService.getAllModules();
        const textualModules = managedModules.filter(m =>
            m.resource_type === 'crypto_module' &&
            !['map_path', 'elevation_profile', 'map_overview'].includes(m.data_capability || '')
        );
        const mapped = textualModules.map(m => ({
            id: m.id as ModuleId,
            label: m.name.length > 14 ? m.name.split(' ')[0] : m.name,
            fullName: m.name,
            color: m.color || '#6b7280',
            isAdvanced: !STANDARD_IDS.has(m.id),
        }));
        return {
            standardCiphers: mapped.filter(c => !c.isAdvanced),
            advancedCiphers: mapped.filter(c => c.isAdvanced),
        };
    }, []);
    const dynamicCiphers = useMemo(() => [...standardCiphers, ...advancedCiphers], [standardCiphers, advancedCiphers]);

    const menuInstanceId = useRef(`ctx-${Math.random().toString(36).slice(2)}`);

    // Synchronisation si ouverture par anchorPosition externe (clic droit ou long press)
    useEffect(() => {
        if (anchorPosition) {
            window.dispatchEvent(new CustomEvent('textual:close-menus', { detail: { except: menuInstanceId.current } }));
            setMenuCoords(anchorPosition);
            setIsOpen(true);
        }
    }, [anchorPosition]);

    const handleClose = () => {
        setIsOpen(false);
        setMenuCoords(null);
        onClose?.();
    };

    // Clic extérieur, Échap, défilement, ou ouverture d'un autre menu
    useEffect(() => {
        if (!isOpen) return;
        const handleOutside = (e: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                handleClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        const handleScroll = (e: Event) => {
            if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
            handleClose();
        };
        const handleCloseOthers = (e: Event) => {
            const except = (e as CustomEvent).detail?.except;
            if (except !== menuInstanceId.current) handleClose();
        };
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('touchstart', handleOutside);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('textual:close-menus', handleCloseOthers);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('touchstart', handleOutside);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('textual:close-menus', handleCloseOthers);
        };
    }, [isOpen]);

    const toggleFromButton = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (isOpen) {
            handleClose();
        } else {
            if (triggerButtonRef.current) {
                const rect = triggerButtonRef.current.getBoundingClientRect();
                setMenuCoords({ x: rect.right + 6, y: rect.top });
            }
            setIsOpen(true);
        }
    };

    // Calcul de position ajustée aux bords de l'écran
    const getComputedPosition = (): React.CSSProperties => {
        const menuWidth = 284;
        const menuHeight = 290;
        let x = menuCoords ? menuCoords.x : 0;
        let y = menuCoords ? menuCoords.y : 0;

        if (x + menuWidth > window.innerWidth - 8) {
            x = Math.max(8, window.innerWidth - menuWidth - 8);
        }
        if (y + menuHeight > window.innerHeight - 8) {
            y = Math.max(8, window.innerHeight - menuHeight - 8);
        }

        return {
            position: 'fixed',
            left: `${x}px`,
            top: `${y}px`,
            zIndex: 99999,
        };
    };

    const triggerButton = (
        <button
            ref={triggerButtonRef}
            type="button"
            onClick={toggleFromButton}
            title="Options du bloc (clic gauche ou clic droit)"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                border: 'none',
                background: isOpen ? 'var(--bg-hover)' : 'transparent',
                color: isOpen ? 'var(--accent-hover)' : 'var(--text-dim)',
                cursor: 'pointer',
                padding: 0,
                borderRadius: '4px',
                opacity: isOpen ? 1 : (isHovered ? 0.9 : 0.2),
                transition: 'opacity 150ms ease, background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={e => {
                e.currentTarget.style.color = 'var(--text-primary)';
                e.currentTarget.style.background = 'var(--bg-hover)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.color = isOpen ? 'var(--accent-hover)' : 'var(--text-dim)';
                e.currentTarget.style.background = isOpen ? 'var(--bg-hover)' : 'transparent';
            }}
        >
            <MoreVertical size={14} strokeWidth={2.2} />
        </button>
    );

    return (
        <div
            className="unified-context-menu-wrapper"
            style={{ position: 'relative', display: showTriggerButton ? 'inline-flex' : 'contents', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
        >
            {showTriggerButton && triggerButton}

            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    role="menu"
                    aria-label={`Options du bloc (${blockType})`}
                    style={{ ...getComputedPosition(), zIndex: 99999 }}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onKeyDown={e => {
                        if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleClose();
                        }
                    }}
                >
                    <div style={{
                        width: '284px',
                        maxHeight: '420px',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        animation: 'popIn 120ms ease-out',
                        userSelect: 'none',
                        boxSizing: 'border-box',
                    }}>
                        {/* En-tête : type du bloc (puisque l'icône de gouttière permanente est retirée) */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '2px 6px 4px',
                            fontSize: '12px',
                            fontWeight: 600,
                            color: 'var(--text-dim)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <span>
                                {blockType === 'html' ? 'Texte libre'
                                    : blockType === 'map' ? 'Carte'
                                    : blockType === 'code' ? `Code (${currentCipher || 'chiffré'})`
                                    : isComputedBlock ? `Texte guidé (${currentCipher || 'clair'})`
                                    : 'Bloc'}
                            </span>
                            {blockData?.isEdited && (
                                <span style={{ fontSize: '11px', color: 'var(--accent-hover)' }}>Modifié</span>
                            )}
                        </div>

                        {/* 1. BARRE D'ACTIONS COMMUNES (Dupliquer, Déplacer, Supprimer) */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'rgba(255, 255, 255, 0.03)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            padding: '2px 4px',
                        }}>
                            {onEdit && (
                                <button
                                    role="menuitem"
                                    type="button"
                                    onClick={() => { onEdit(); handleClose(); }}
                                    title="Éditer le texte"
                                    style={quickBtnStyle}
                                    onMouseEnter={quickBtnHover}
                                    onMouseLeave={quickBtnUnhover}
                                >
                                    <Edit2 size={13} strokeWidth={2.2} />
                                </button>
                            )}
                            {onDuplicate && (
                                <button
                                    role="menuitem"
                                    type="button"
                                    onClick={() => { onDuplicate(); handleClose(); }}
                                    title="Dupliquer"
                                    style={quickBtnStyle}
                                    onMouseEnter={quickBtnHover}
                                    onMouseLeave={quickBtnUnhover}
                                >
                                    <Copy size={13} strokeWidth={2.2} />
                                </button>
                            )}
                            {onMoveUp && (
                                <button
                                    role="menuitem"
                                    type="button"
                                    onClick={() => { onMoveUp(); handleClose(); }}
                                    title="Monter (Alt+Maj+↑)"
                                    style={quickBtnStyle}
                                    onMouseEnter={quickBtnHover}
                                    onMouseLeave={quickBtnUnhover}
                                >
                                    <MoveUp size={13} strokeWidth={2.2} />
                                </button>
                            )}
                            {onMoveDown && (
                                <button
                                    role="menuitem"
                                    type="button"
                                    onClick={() => { onMoveDown(); handleClose(); }}
                                    title="Descendre (Alt+Maj+↓)"
                                    style={quickBtnStyle}
                                    onMouseEnter={quickBtnHover}
                                    onMouseLeave={quickBtnUnhover}
                                >
                                    <MoveDown size={13} strokeWidth={2.2} />
                                </button>
                            )}
                            <div style={{ width: '1px', height: '16px', background: 'var(--border-subtle)', margin: '0 2px' }} />
                            {onDelete && (
                                <button
                                    role="menuitem"
                                    type="button"
                                    onClick={() => {
                                        onDelete();
                                        handleClose();
                                    }}
                                    title={isComputedBlock ? 'Masquer ce bloc (Annuler disponible)' : 'Supprimer'}
                                    style={{ ...quickBtnStyle, color: '#ef4444' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <Trash2 size={13} strokeWidth={2.2} />
                                </button>
                            )}
                        </div>

                        {/* Entrées propres : Texte libre (Couleur, Alignement) */}
                        {blockType === 'html' && (onChangeTextColor || onChangeTextAlign) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {onChangeTextColor && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Couleur</span>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {['var(--text-primary)', '#a1a1aa', '#60a5fa', '#4ade80', '#fbbf24', '#f87171'].map(c => (
                                                <button
                                                    key={c}
                                                    role="menuitem"
                                                    type="button"
                                                    aria-label={`Couleur ${c}`}
                                                    onClick={() => { onChangeTextColor(c); handleClose(); }}
                                                    style={{
                                                        width: '16px', height: '16px', borderRadius: '50%',
                                                        background: c, border: '1px solid var(--border-strong)', cursor: 'pointer', padding: 0,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {onChangeTextAlign && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Alignement</span>
                                        <div style={{ display: 'flex', gap: '3px' }}>
                                            {(['left', 'center', 'right'] as const).map(a => (
                                                <button
                                                    key={a}
                                                    role="menuitem"
                                                    type="button"
                                                    onClick={() => { onChangeTextAlign(a); handleClose(); }}
                                                    style={{
                                                        padding: '2px 7px', borderRadius: '5px', fontSize: '12px',
                                                        border: '1px solid var(--border-subtle)',
                                                        background: blockData?.textAlign === a ? 'var(--bg-hover)' : 'transparent',
                                                        color: 'var(--text-primary)', cursor: 'pointer',
                                                    }}
                                                >
                                                    {a === 'left' ? 'Gauche' : a === 'center' ? 'Centre' : 'Droite'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Entrées propres : Texte guidé (généré) */}
                        {isComputedBlock && (blockType === 'computed' || blockType === 'code') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {onRegenerate && (
                                    <button
                                        role="menuitem"
                                        type="button"
                                        onClick={() => { onRegenerate(); handleClose(); }}
                                        style={rowItemStyle}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Régénérer</span>
                                    </button>
                                )}
                                {onDetach && (
                                    <button
                                        role="menuitem"
                                        type="button"
                                        onClick={() => { onDetach(); handleClose(); }}
                                        style={rowItemStyle}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Détacher (convertir en bloc libre)</span>
                                    </button>
                                )}
                                {blockData?.isEdited && onRestoreGenerated && (
                                    <button
                                        role="menuitem"
                                        type="button"
                                        onClick={() => { onRestoreGenerated(); handleClose(); }}
                                        style={rowItemStyle}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <span style={{ fontSize: '12px', color: 'var(--accent-hover)' }}>Restaurer le texte généré</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Entrées propres : Carte (Taille, Cadrage, Ouvrir) */}
                        {blockType === 'map' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {onChangeMapSize && (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
                                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Taille</span>
                                        <div style={{ display: 'flex', gap: '3px' }}>
                                            {([
                                                { id: 'column', label: 'Colonne' },
                                                { id: 'wide', label: 'Large' },
                                                { id: 'full', label: 'Plein' },
                                            ] as const).map(sz => (
                                                <button
                                                    key={sz.id}
                                                    role="menuitem"
                                                    type="button"
                                                    onClick={() => { onChangeMapSize(sz.id); handleClose(); }}
                                                    style={{
                                                        padding: '2px 7px', borderRadius: '5px', fontSize: '12px',
                                                        border: '1px solid var(--border-subtle)',
                                                        background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
                                                    }}
                                                >
                                                    {sz.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {onToggleMapAutoFrame && (
                                    <button
                                        role="menuitem"
                                        type="button"
                                        onClick={() => { onToggleMapAutoFrame(); handleClose(); }}
                                        style={rowItemStyle}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>Cadrage : auto sur l'étape / libre</span>
                                    </button>
                                )}
                                {onOpenOnMap && (
                                    <button
                                        role="menuitem"
                                        type="button"
                                        onClick={() => { onOpenOnMap(); handleClose(); }}
                                        style={rowItemStyle}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        <span style={{ fontSize: '12px', color: 'var(--accent-hover)' }}>Ouvrir sur la carte</span>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* 2. CHIFFREMENT MIS EN AVANT (codes standards + codes avancés) */}
                        {(blockType === 'code' || blockType === 'computed') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.16)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ ...sectionLabelStyle, color: 'var(--accent-hover)' }}>Chiffrement & Codes</div>
                                    {advancedCiphers.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedCodes(v => !v)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer', padding: '0 2px' }}
                                        >
                                            {showAdvancedCodes ? 'Masquer avancés' : `+ ${advancedCiphers.length} avancés`}
                                        </button>
                                    )}
                                </div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '3px',
                                }}>
                                    {(showAdvancedCodes ? dynamicCiphers : standardCiphers).map(c => {
                                        const isCurrent = c.id === currentCipher;
                                        return (
                                            <button
                                                key={c.id}
                                                role="menuitem"
                                                type="button"
                                                onClick={() => {
                                                    onChangeCipher?.(c.id);
                                                    handleClose();
                                                }}
                                                title={`Chiffrement ${c.fullName}`}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '5px 2px',
                                                    borderRadius: '6px',
                                                    border: isCurrent ? `1.5px solid ${c.color}` : '1px solid var(--border-subtle)',
                                                    background: isCurrent ? `${c.color}20` : 'transparent',
                                                    color: isCurrent ? c.color : 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    fontSize: '10.5px',
                                                    fontWeight: isCurrent ? 700 : 500,
                                                    transition: 'all 80ms ease',
                                                }}
                                                onMouseEnter={e => {
                                                    if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)';
                                                }}
                                                onMouseLeave={e => {
                                                    if (!isCurrent) e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <Code2 size={12} color={c.color} strokeWidth={2.4} />
                                                <span style={{ marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '58px' }}>
                                                    {c.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Thème narratif appliqué à l'ensemble des phrases générées */}
                        {blockType === 'computed' && themeIds.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={sectionLabelStyle}>Thème (toutes les phrases générées)</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                    {themeIds.map(tId => {
                                        const isActive = state.theme_id === tId;
                                        return (
                                            <button
                                                key={tId}
                                                role="menuitem"
                                                type="button"
                                                onClick={() => {
                                                    dispatch({ type: 'SET_THEME', themeId: tId });
                                                    handleClose();
                                                }}
                                                style={{
                                                    padding: '3px 8px',
                                                    borderRadius: '6px',
                                                    border: isActive ? '1px solid var(--accent-default)' : '1px solid var(--border-subtle)',
                                                    background: isActive ? 'var(--accent-transparent)' : 'transparent',
                                                    color: isActive ? 'var(--accent-hover)' : 'var(--text-primary)',
                                                    fontSize: '11.5px',
                                                    fontWeight: isActive ? 600 : 400,
                                                    cursor: 'pointer',
                                                }}
                                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {tId}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Pour texte libre : Chiffrer / Convertir en code (tous les codes) */}
                        {blockType === 'html' && onConvertToCode && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.16)' }}>
                                <div style={{ ...sectionLabelStyle, color: 'var(--accent-hover)' }}>Chiffrer avec un code</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                                    {dynamicCiphers.map(c => (
                                        <button
                                            key={c.id}
                                            role="menuitem"
                                            type="button"
                                            onClick={() => { onConvertToCode(c.id); handleClose(); }}
                                            title={c.fullName}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                                                padding: '4px', borderRadius: '6px', border: '1px solid var(--border-subtle)',
                                                background: 'transparent', color: c.color, fontSize: '10.5px', fontWeight: 600, cursor: 'pointer'
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = `${c.color}15`)}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <Code2 size={11} color={c.color} strokeWidth={2.4} />
                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 3. GUIDAGE (HORAIRE, CARDINAUX, AZIMUT, TOURNANT) — pour blocs calculés */}
                        {blockType === 'computed' && onChangeLanguage && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={sectionLabelStyle}>Guidage</div>
                                <div style={{ display: 'flex', gap: '3px' }}>
                                    {NAV_LANGUAGES.map(lang => {
                                        const isCurrent = navLanguage === lang.id;
                                        return (
                                            <button
                                                key={lang.id}
                                                type="button"
                                                onClick={() => { onChangeLanguage(lang.id); handleClose(); }}
                                                style={{
                                                    flex: 1,
                                                    padding: '4px 0',
                                                    borderRadius: '6px',
                                                    border: isCurrent ? '1px solid var(--accent-default)' : '1px solid var(--border-subtle)',
                                                    background: isCurrent ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                                                    color: isCurrent ? 'var(--accent-hover)' : 'var(--text-dim)',
                                                    fontSize: '10.5px',
                                                    fontWeight: isCurrent ? 700 : 500,
                                                    cursor: 'pointer',
                                                    textAlign: 'center',
                                                    transition: 'all 80ms ease'
                                                }}
                                                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                {lang.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 4. ACTIONS COMPACTES : SOLUTION, VERROUILLAGE, POLICES */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
                            {/* Toggle Solution / Participant */}
                            {hasSolution && onToggleSolution && (
                                <button
                                    type="button"
                                    onClick={() => { onToggleSolution(); handleClose(); }}
                                    style={rowItemStyle}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        {isSolutionView ? <EyeOff size={13} color="var(--semantic-green)" /> : <Eye size={13} color="var(--text-dim)" />}
                                        <span style={{ fontSize: '11px', color: isSolutionView ? 'var(--semantic-green)' : 'var(--text-primary)', fontWeight: 500 }}>
                                            {isSolutionView ? 'Vue organisateur (solution)' : 'Vue participant (chiffré)'}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px' }}>
                                        {isSolutionView ? 'Actif' : 'Masqué'}
                                    </span>
                                </button>
                            )}

                            {/* Toggle Verrouillage */}
                            {onLockToggle && (
                                <button
                                    type="button"
                                    onClick={() => { onLockToggle(); handleClose(); }}
                                    style={rowItemStyle}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        {isLocked ? <Lock size={13} color="var(--semantic-orange)" /> : <Unlock size={13} color="var(--text-dim)" />}
                                        <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                            {isLocked ? 'Étape verrouillée' : 'Verrouiller cette étape'}
                                        </span>
                                    </div>
                                </button>
                            )}

                            {/* Sélecteur de typographie */}
                            {onOpenFontSelector && (
                                <button
                                    type="button"
                                    onClick={() => { onOpenFontSelector(); handleClose(); }}
                                    style={rowItemStyle}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                        <Palette size={13} color="var(--accent-default)" />
                                        <span style={{ fontSize: '11px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                            Polices et typographie…
                                        </span>
                                    </div>
                                </button>
                            )}

                            {/* Points d'intérêt (POIs) */}
                            {pois.length > 0 && onTogglePOI && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                    <div style={sectionLabelStyle}>Repères (POI)</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                        {pois.map(poi => (
                                            <button
                                                key={poi.id}
                                                type="button"
                                                onClick={() => onTogglePOI(poi.id)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '4px',
                                                    padding: '3px 7px',
                                                    borderRadius: '4px',
                                                    border: poi.selected ? '1px solid var(--semantic-orange)' : '1px solid var(--border-subtle)',
                                                    background: poi.selected ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                                                    color: poi.selected ? 'var(--semantic-orange)' : 'var(--text-dim)',
                                                    fontSize: '10px',
                                                    fontWeight: poi.selected ? 700 : 400,
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <MapPin size={10} />
                                                <span>{poi.name}</span>
                                                {poi.selected && <Check size={10} strokeWidth={2.5} />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

// ─── Styles constants pour le menu synthétique ──────────────────────────────
const quickBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '28px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 90ms ease',
};

const quickBtnHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'var(--bg-hover)';
    e.currentTarget.style.color = 'var(--text-primary)';
};

const quickBtnUnhover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = 'transparent';
    e.currentTarget.style.color = 'var(--text-secondary)';
};

const sectionLabelStyle: React.CSSProperties = {
    fontSize: '9.5px',
    fontWeight: 700,
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    paddingLeft: '2px',
};

const rowItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '5px 6px',
    borderRadius: '6px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 80ms ease',
    textAlign: 'left',
};

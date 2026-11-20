/**
 * UnifiedContextMenu.tsx — Menu contextuel unifié et synthétique
 * Style épuré identique à la barre d'outils flottante (bg-elevated, border-strong, shadow-lg)
 * Déclenché par :
 * - Clic gauche sur le bouton 3 points du gutter
 * - Clic droit n'importe où sur le bloc
 * - Appui long (500ms) sur mobile / tactile
 */
import React, { useState, useRef, useEffect } from 'react';
import {
    MoreVertical, Edit2, Trash2, Copy, MoveUp, MoveDown,
    Lock, Unlock, Eye, EyeOff, Palette, MapPin, Check,
    Waves, Key, Grid, Hash, Flag, RotateCcw, Minus, Type, Layers
} from 'lucide-react';
import { MODULE_META } from '../../logic/ModuleRegistry';
import type { ModuleId, NavLanguage } from '../../logic/types';

export interface UnifiedContextMenuProps {
    blockType: 'html' | 'code' | 'computed' | 'map' | 'annexe' | 'title' | 'generic';
    blockId: string;
    blockData?: any;
    availableCiphers?: ModuleId[];
    anchorPosition?: { x: number; y: number } | null;
    triggerRef?: React.RefObject<HTMLButtonElement>;
    isHovered?: boolean;
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
    onClose?: () => void;
}

const TEXTUAL_CIPHERS: { id: ModuleId; label: string; color: string; Icon: React.ComponentType<any> }[] = [
    { id: 'morse', label: 'Morse', color: '#ef4444', Icon: Waves },
    { id: 'vigenere', label: 'Vigenère', color: '#8b5cf6', Icon: Key },
    { id: 'polybe', label: 'Polybe', color: '#14b8a6', Icon: Grid },
    { id: 'templier', label: 'Templier', color: '#b45309', Icon: Hash },
    { id: 'avocat', label: 'Avocat', color: '#f59e0b', Icon: RotateCcw },
    { id: 'cassis', label: 'Cassis', color: '#7c3aed', Icon: Minus },
    { id: 'maritime', label: 'Maritime', color: '#0ea5e9', Icon: Flag },
    { id: 'texte_clair', label: 'Clair', color: '#6b7280', Icon: Type },
];

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
    onClose
}: UnifiedContextMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuCoords, setMenuCoords] = useState<{ x: number; y: number } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerButtonRef = useRef<HTMLButtonElement>(null);

    const currentCipher = blockData?.moduleId as ModuleId | undefined;

    // Synchronisation si ouverture par anchorPosition externe (clic droit ou long press)
    useEffect(() => {
        if (anchorPosition) {
            setMenuCoords(anchorPosition);
            setIsOpen(true);
        }
    }, [anchorPosition]);

    const handleClose = () => {
        setIsOpen(false);
        setMenuCoords(null);
        onClose?.();
    };

    // Clic extérieur ou touche Échap pour fermer
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
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('touchstart', handleOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('touchstart', handleOutside);
            document.removeEventListener('keydown', handleKeyDown);
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
            style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
        >
            {triggerButton}

            {isOpen && (
                <div
                    ref={menuRef}
                    style={getComputedPosition()}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                >
                    <div style={{
                        width: '284px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        animation: 'popIn 120ms ease-out',
                        userSelect: 'none',
                        boxSizing: 'border-box',
                    }}>
                        {/* 1. BARRE D'ACTIONS RAPIDES (Éditer, Dupliquer, Monter, Descendre, Copier, Supprimer) */}
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
                                    type="button"
                                    onClick={() => { onDuplicate(); handleClose(); }}
                                    title="Dupliquer l'étape"
                                    style={quickBtnStyle}
                                    onMouseEnter={quickBtnHover}
                                    onMouseLeave={quickBtnUnhover}
                                >
                                    <Copy size={13} strokeWidth={2.2} />
                                </button>
                            )}
                            {onMoveUp && (
                                <button
                                    type="button"
                                    onClick={() => { onMoveUp(); handleClose(); }}
                                    title="Monter d'un rang"
                                    style={quickBtnStyle}
                                    onMouseEnter={quickBtnHover}
                                    onMouseLeave={quickBtnUnhover}
                                >
                                    <MoveUp size={13} strokeWidth={2.2} />
                                </button>
                            )}
                            {onMoveDown && (
                                <button
                                    type="button"
                                    onClick={() => { onMoveDown(); handleClose(); }}
                                    title="Descendre d'un rang"
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
                                    type="button"
                                    onClick={() => {
                                        if (window.confirm('Supprimer cette étape ?')) {
                                            onDelete();
                                            handleClose();
                                        }
                                    }}
                                    title="Supprimer l'étape"
                                    style={{ ...quickBtnStyle, color: '#ef4444' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <Trash2 size={13} strokeWidth={2.2} />
                                </button>
                            )}
                        </div>

                        {/* 2. SÉLECTEUR SYNTHÉTIQUE DE CHIFFREMENT (Grille compacte 4×2) */}
                        {(blockType === 'code' || blockType === 'computed') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={sectionLabelStyle}>Chiffrement</div>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(4, 1fr)',
                                    gap: '3px',
                                }}>
                                    {TEXTUAL_CIPHERS.map(c => {
                                        const isCurrent = c.id === currentCipher;
                                        const IconComponent = c.Icon;
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => {
                                                    onChangeCipher?.(c.id);
                                                    handleClose();
                                                }}
                                                title={`Chiffrement ${c.label}`}
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
                                                    fontSize: '10px',
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
                                                <IconComponent size={12} color={c.color} strokeWidth={2.4} />
                                                <span style={{ marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '58px' }}>
                                                    {c.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Pour commentaire HTML : Option de conversion rapide en bloc chiffré */}
                        {blockType === 'html' && onConvertToCode && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <div style={sectionLabelStyle}>Convertir en message chiffré</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
                                    {TEXTUAL_CIPHERS.slice(0, 4).map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => { onConvertToCode(c.id); handleClose(); }}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px',
                                                padding: '4px', borderRadius: '6px', border: '1px solid var(--border-subtle)',
                                                background: 'transparent', color: c.color, fontSize: '10px', fontWeight: 600, cursor: 'pointer'
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = `${c.color}15`)}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <c.Icon size={11} strokeWidth={2.4} />
                                            <span>{c.label}</span>
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
                </div>
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

/**
 * TextualView.tsx — Carnet de route en mode texte.
 * Rendu éditorial pur SANS contours ni fonds isolants pour une intégration fluide dans le document.
 *
 * Règle stricte des annexes :
 *  - Ne JAMAIS afficher les annexes qui ne correspondent pas aux codes employés dans le raid.
 *  - Chaque annexe correspondante possède un bouton de switch dans sa marge/en-tête pour la griser ou l'inclure.
 */
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ModuleId, CarnetView, NavLanguage, AnnexeId } from '../../logic/types';
import { useApp } from '../../AppContext';
import { CarnetEngine } from '../../logic/CarnetEngine';
import { themeManager } from '../../logic/ThemeManager';
import { ModuleLogic } from '../../logic/ModuleLogic';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import CarnetStepBlock, { StageHeaderBlock } from './CarnetStepBlock';
import CodeBlockPicker from './CodeBlockPicker';
import CarnetElevationBlock from './CarnetElevationBlock';
import { GUTTER_WIDTH } from './BlockGutter';
import SlashCommandPalette from './SlashCommandPalette';
import { mapRef } from '../map/MapComponent';
import L from 'leaflet';
import type { ViewMode } from '../../App';
import {
    AlertTriangle, Sparkles, Binary,
    LayoutGrid, KeyRound, Flag, Shield, Scale, Table,
    CheckSquare, X, ChevronDown, Globe, Code2,
    Maximize2, Minimize2,
    Lightbulb, ArrowRight,
    Smile, Image as ImageIcon, Mountain, Lock, FileText, MoreHorizontal,
    Cloud, RefreshCw, CloudOff, AlertCircle
} from 'lucide-react';

function AnnexeSwitch({ isChecked, onToggle }: { isChecked: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={isChecked}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 0',
                userSelect: 'none'
            }}
            title={isChecked ? "Masquer l'annexe" : "Afficher l'annexe"}
        >
            <div style={{
                width: '28px',
                height: '15px',
                borderRadius: '9999px',
                background: isChecked ? 'var(--accent-default)' : 'var(--bg-hover)',
                position: 'relative',
                transition: 'background 150ms ease',
                flexShrink: 0
            }}>
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: isChecked ? '15px' : '2px',
                    width: '11px',
                    height: '11px',
                    borderRadius: '50%',
                    background: isChecked ? '#ffffff' : 'var(--text-dim)',
                    transition: 'left 150ms ease, background 150ms ease',
                }} />
            </div>
            <span style={{
                fontSize: '12px',
                fontWeight: 500,
                color: isChecked ? 'var(--text-secondary)' : 'var(--text-dim)',
                whiteSpace: 'nowrap'
            }}>
                {isChecked ? 'Incluse' : 'Masquée'}
            </span>
        </button>
    );
}

function MultiSelectBatchBar({
    selectedCount,
    onBatchModule,
    onBatchLanguage,
    onDeselectAll
}: {
    selectedCount: number;
    onBatchModule: (moduleId: ModuleId) => void;
    onBatchLanguage: (lang?: NavLanguage) => void;
    onDeselectAll: () => void;
}) {
    const [moduleMenuOpen, setModuleMenuOpen] = useState(false);
    const [langMenuOpen, setLangMenuOpen] = useState(false);
    const moduleMenuRef = useRef<HTMLDivElement>(null);
    const langMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (moduleMenuRef.current && !moduleMenuRef.current.contains(e.target as Node)) {
                setModuleMenuOpen(false);
            }
            if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
                setLangMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    const languages: { id?: NavLanguage; label: string }[] = [
        { id: undefined, label: 'Auto (Par défaut)' },
        { id: 'Horaire', label: 'Horaire (ex: 2h)' },
        { id: 'Cardinaux', label: 'Cardinaux (ex: N-NE)' },
        { id: 'Azimut', label: 'Azimut (ex: 60°)' },
        { id: 'Tournant', label: 'Tournant (ex: à droite)' },
    ];

    return (
        <div
            data-textual-pane="true"
            style={{
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            height: '40px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '14px',
            padding: '3px 4px',
            boxShadow: 'var(--shadow-md)',
            pointerEvents: 'all',
            position: 'relative',
            animation: 'toolbarSwapIn 160ms cubic-bezier(0.16, 1, 0.3, 1)',
            maxWidth: 'calc(100vw - 32px)',
            boxSizing: 'border-box'
        }}>
            {/* 1. Compteur de sélection */}
            <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0 10px',
                height: '32px',
                borderRadius: '9px',
                background: 'rgba(37, 99, 235, 0.15)',
                color: 'var(--accent-hover)',
                fontSize: '11px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0
            }}>
                <CheckSquare size={13} strokeWidth={2.4} />
                <span>{selectedCount} tronçon{selectedCount > 1 ? 's' : ''}</span>
            </div>

            {/* 2. Menu déroulant Changer de code */}
            <div style={{ position: 'relative' }} ref={moduleMenuRef}>
                <button
                    type="button"
                    onClick={() => { setModuleMenuOpen(v => !v); setLangMenuOpen(false); }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '32px',
                        padding: '0 10px',
                        borderRadius: '9px',
                        border: `1px solid ${moduleMenuOpen ? 'var(--accent-default)' : 'transparent'}`,
                        background: moduleMenuOpen ? 'var(--bg-hover)' : 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 100ms ease'
                    }}
                    onMouseEnter={e => {
                        if (!moduleMenuOpen) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={e => {
                        if (!moduleMenuOpen) e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <Code2 size={12} color="var(--accent-hover)" />
                    <span>Changer de code</span>
                    <ChevronDown size={11} style={{ opacity: 0.6, transform: moduleMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                </button>

                {moduleMenuOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 1600,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '5px',
                        minWidth: '200px',
                        maxHeight: '280px',
                        overflowY: 'auto',
                        animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Appliquer aux {selectedCount} tronçons
                        </div>
                        {ALL_MODULE_IDS.map(mId => {
                            const meta = MODULE_META[mId];
                            return (
                                <button
                                    key={mId}
                                    type="button"
                                    onClick={() => {
                                        onBatchModule(mId);
                                        setModuleMenuOpen(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '7px',
                                        width: '100%',
                                        padding: '6px 8px',
                                        borderRadius: '7px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--text-primary)',
                                        fontSize: '11px',
                                        textAlign: 'left',
                                        cursor: 'pointer'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta?.color || '#94a3b8', flexShrink: 0 }} />
                                    <span>{meta?.label || mId}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 3. Menu déroulant Langue de guidage */}
            <div style={{ position: 'relative' }} ref={langMenuRef}>
                <button
                    type="button"
                    onClick={() => { setLangMenuOpen(v => !v); setModuleMenuOpen(false); }}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        height: '32px',
                        padding: '0 10px',
                        borderRadius: '9px',
                        border: `1px solid ${langMenuOpen ? 'var(--accent-default)' : 'transparent'}`,
                        background: langMenuOpen ? 'var(--bg-hover)' : 'transparent',
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 100ms ease'
                    }}
                    onMouseEnter={e => {
                        if (!langMenuOpen) e.currentTarget.style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={e => {
                        if (!langMenuOpen) e.currentTarget.style.background = 'transparent';
                    }}
                >
                    <Globe size={12} color="var(--accent-hover)" />
                    <span>Guidage</span>
                    <ChevronDown size={11} style={{ opacity: 0.6, transform: langMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                </button>

                {langMenuOpen && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 1600,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-strong)',
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '5px',
                        minWidth: '180px',
                        animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Langue de guidage
                        </div>
                        {languages.map((l, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => {
                                    onBatchLanguage(l.id);
                                    setLangMenuOpen(false);
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    fontSize: '11px',
                                    textAlign: 'left',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <span>{l.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. Bouton Tout désélectionner */}
            <button
                type="button"
                onClick={onDeselectAll}
                title="Désélectionner tout (Échap)"
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '10px',
                    border: '1px solid transparent',
                    background: 'transparent',
                    color: 'var(--text-dim)',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 100ms ease'
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
                <X size={12} />
                <span>Désélectionner</span>
            </button>
        </div>
    );
}

// ─── Cloud Sync Status Component ──────────────────────────────────────────
function CloudSyncStatus() {
    const { state } = useApp();

    const getStatusConfig = () => {
        switch (state.cloud_sync_status) {
            case 'synced':
                return { icon: Cloud, color: 'var(--semantic-success)', label: 'Synchronisé', tooltip: state.cloud_last_synced ? `Dernière sync: ${new Date(state.cloud_last_synced).toLocaleTimeString()}` : 'Synchronisé' };
            case 'pending':
                return { icon: RefreshCw, color: 'var(--semantic-warning)', label: 'En attente', tooltip: 'Sauvegarde en attente...' };
            case 'offline':
                return { icon: CloudOff, color: 'var(--text-dim)', label: 'Hors ligne', tooltip: 'Mode hors ligne - les changements seront synchronisés à la reconnexion' };
            case 'error':
                return { icon: AlertCircle, color: 'var(--semantic-danger)', label: 'Erreur', tooltip: 'Erreur de synchronisation - cliquez pour réessayer' };
            default:
                return { icon: CloudOff, color: 'var(--text-dim)', label: 'Inconnu', tooltip: 'Statut inconnu' };
        }
    };

    const config = getStatusConfig();
    const Icon = config.icon;

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: `${config.color}15`,
                border: `1px solid ${config.color}40`,
                color: config.color,
                cursor: 'pointer',
                transition: 'all 150ms ease',
                position: 'relative',
            }}
            title={config.tooltip}
        >
            <Icon size={16} strokeWidth={2.2} />
            {state.cloud_sync_status === 'pending' && (
                <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--semantic-warning)',
                    animation: 'pulse 1.5s infinite'
                }} />
            )}
            {state.cloud_sync_status === 'error' && (
                <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: 'var(--semantic-danger)'
                }} />
            )}
        </div>
    );
}

// ─── Barre d'état discrète en bas de l'éditeur (Lot A) ───────────────────────
function TextualStatusBar({
    isSolution,
    onToggleSolution,
    errorItems,
    hasErrors
}: {
    isSolution: boolean;
    onToggleSolution: () => void;
    errorItems: Array<{ stepId: string; stepLabel: string; message: string; severity: 'error' | 'warning' }>;
    hasErrors: boolean;
}) {
    const errorCount = errorItems.length;

    return (
        <div
            data-textual-pane="true"
            style={{
            height: '28px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 14px',
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-base)',
            fontSize: '12px',
            color: 'var(--text-dim)',
            userSelect: 'none',
            position: 'relative',
            zIndex: 100,
        }}>
            {/* Gauche : vide (pastilles d'alerte retirées pour le moment) */}
            <div />

            {/* Droite : toggle Solutions discret */}
            <button
                type="button"
                role="switch"
                aria-checked={isSolution}
                onClick={onToggleSolution}
                title={isSolution ? 'Masquer les solutions (Alt+S)' : 'Afficher les solutions (Alt+S)'}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: 'none',
                    background: isSolution ? 'rgba(245, 158, 11, 0.14)' : 'transparent',
                    color: isSolution ? 'var(--semantic-orange)' : 'var(--text-dim)',
                    fontSize: '12px',
                    fontWeight: isSolution ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'background 100ms ease, color 100ms ease',
                }}
                onMouseEnter={e => { if (!isSolution) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isSolution) e.currentTarget.style.background = 'transparent'; }}
            >
                <Lightbulb size={12} />
                <span>Solutions</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', opacity: 0.65 }}>Alt+S</span>
            </button>
        </div>
    );
}

// Bottom sheet pour les erreurs (s'ouvre vers le haut depuis le bas)
function ErrorBottomSheet({ errorItems, hasErrors }: { errorItems: any[]; hasErrors: boolean }) {
    const [isOpen, setIsOpen] = useState(false);
    const sheetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('textual:open-errors', handleOpen);
        const handleClickOutside = (e: MouseEvent) => {
            if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => { window.removeEventListener('textual:open-errors', handleOpen); document.removeEventListener('mousedown', handleClickOutside); };
    }, []);

    const handleJumpToError = (stepId: string) => {
        setIsOpen(false);
        const el = document.getElementById(`carnet-step-${stepId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'box-shadow 0.2s';
            el.style.boxShadow = '0 0 0 2px #ef4444';
            setTimeout(() => { el.style.boxShadow = 'none'; }, 2000);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            ref={sheetRef}
            style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                right: 0,
                zIndex: 1600,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-strong)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                minWidth: '260px',
                maxWidth: '340px',
                maxHeight: '380px',
                overflowY: 'auto',
                animation: 'islandPopoverInTopRight 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                transformOrigin: 'bottom right',
            }}
        >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 8px 6px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                Anomalies & Contraintes ({errorItems.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {errorItems.map((item, idx) => (
                    <div
                        key={idx}
                        onClick={() => handleJumpToError(item.stepId)}
                        style={{
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px',
                            padding: '6px 8px', borderRadius: '8px', background: 'transparent', cursor: 'pointer',
                            transition: 'all 80ms ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: item.severity === 'error' ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.severity === 'error' ? '#ef4444' : '#f59e0b' }} />
                                {item.stepLabel}
                            </span>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-default)', lineHeight: 1.3, marginTop: '2px' }}>
                                {item.message}
                            </span>
                        </div>
                        <ArrowRight size={12} color="var(--text-dim)" style={{ marginTop: '3px', flexShrink: 0 }} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Titre éditorial principal du document de raid.
 * Écrit directement en grand format titre, au-dessus de l'étape 1,
 * et bidirectionnellement synchronisé avec state.document_title (MenuBar, exports, etc.).
 */
const PAGE_ICONS = ['🧭', '🏕️', '🗺️', '🥾', '🌲', '🔥'];

function CarnetDocumentTitle({ onEnterToBody }: { onEnterToBody?: () => void }) {
    const { state, dispatch } = useApp();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [title, setTitle] = useState(state.document_title === 'Document sans titre' ? '' : (state.document_title || ''));
    const [hovered, setHovered] = useState(false);
    const [iconIdx, setIconIdx] = useState<number | null>(null);
    const [showCover, setShowCover] = useState(false);

    useEffect(() => {
        setTitle(state.document_title === 'Document sans titre' ? '' : (state.document_title || ''));
    }, [state.document_title]);

    const adjustHeight = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    };

    useEffect(() => {
        adjustHeight();
    }, [title]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value.replace(/[\r\n]+/g, ' ');
        setTitle(val);
        dispatch({ type: 'SET_DOCUMENT_TITLE', title: val });
    };

    const handleBlur = () => {
        const clean = title.trim();
        if (clean !== title) {
            setTitle(clean);
            dispatch({ type: 'SET_DOCUMENT_TITLE', title: clean });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            textareaRef.current?.blur();
            onEnterToBody?.();
        }
        if (e.key === 'Escape') {
            textareaRef.current?.blur();
        }
    };

    return (
        <div
            className="carnet-document-title-wrapper"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                marginBottom: '20px',
                marginTop: '4px',
                boxSizing: 'border-box',
            }}
        >
            {/* Couverture optionnelle style Notion (sans arrondis) */}
            {showCover && (
                <div style={{
                    marginLeft: `${GUTTER_WIDTH}px`,
                    height: '96px',
                    borderRadius: 0,
                    marginBottom: '16px',
                    background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.22), rgba(15, 23, 42, 0.85))',
                    border: '1px solid var(--border-subtle)',
                    position: 'relative',
                }}>
                    {hovered && (
                        <button
                            type="button"
                            onClick={() => setShowCover(false)}
                            style={{
                                position: 'absolute', right: '8px', bottom: '8px',
                                padding: '3px 8px', borderRadius: '5px', border: 'none',
                                background: 'rgba(0,0,0,0.55)', color: 'var(--text-secondary)',
                                fontSize: '12px', cursor: 'pointer',
                            }}
                        >
                            Retirer la couverture
                        </button>
                    )}
                </div>
            )}

            {/* Barre d'actions discrètes au survol façon Notion (cachée au repos) */}
            <div style={{
                paddingLeft: `${GUTTER_WIDTH}px`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '24px',
                marginBottom: '4px',
                opacity: hovered ? 1 : 0,
                pointerEvents: hovered ? 'auto' : 'none',
                transition: 'opacity 120ms ease',
            }}>
                <button
                    type="button"
                    onClick={() => setIconIdx(i => (i === null ? 0 : (i + 1 >= PAGE_ICONS.length ? null : i + 1)))}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: 'transparent', border: 'none', borderRadius: '5px',
                        padding: '2px 6px', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                >
                    <Smile size={13} />
                    <span>{iconIdx === null ? 'Ajouter une icône' : 'Changer l\'icône'}</span>
                </button>
                <button
                    type="button"
                    onClick={() => setShowCover(c => !c)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: 'transparent', border: 'none', borderRadius: '5px',
                        padding: '2px 6px', color: 'var(--text-dim)', fontSize: '12px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-dim)'; }}
                >
                    <ImageIcon size={13} />
                    <span>{showCover ? 'Masquer la couverture' : 'Ajouter une couverture'}</span>
                </button>
                <button
                    type="button"
                    onClick={() => dispatch({ type: 'TOGGLE_ELEVATION_PROFILE' })}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        background: 'transparent', border: 'none', borderRadius: '5px',
                        padding: '2px 6px',
                        color: state.carnet_include_elevation_profile ? 'var(--accent-hover)' : 'var(--text-dim)',
                        fontSize: '12px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; if (!state.carnet_include_elevation_profile) e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = state.carnet_include_elevation_profile ? 'var(--accent-hover)' : 'var(--text-dim)'; }}
                >
                    <Mountain size={13} />
                    <span>{state.carnet_include_elevation_profile ? 'Masquer le profil' : 'Profil altimétrique'}</span>
                </button>
            </div>

            {/* Icône + Titre principal alignés sur la gouttière 40px */}
            <div style={{ display: 'flex', alignItems: 'flex-start', width: '100%' }}>
                <div style={{ width: `${GUTTER_WIDTH}px`, minWidth: `${GUTTER_WIDTH}px`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {iconIdx !== null && (
                        <button
                            type="button"
                            onClick={() => setIconIdx(i => (i === null ? 0 : (i + 1) % PAGE_ICONS.length))}
                            title="Cliquer pour changer d'icône"
                            style={{
                                width: '44px', height: '44px', fontSize: '34px', lineHeight: 1,
                                background: 'transparent', border: 'none', borderRadius: '8px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            {PAGE_ICONS[iconIdx]}
                        </button>
                    )}
                    <style>{`.carnet-document-title-input::placeholder { color: rgba(255, 255, 255, 0.2); font-weight: 700; }`}</style>
                    <textarea
                        ref={textareaRef}
                        className="carnet-document-title-input"
                        value={title}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="Sans titre"
                        aria-label="Titre du document"
                        rows={1}
                        spellCheck={false}
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 0,
                            outline: 'none',
                            resize: 'none',
                            overflow: 'hidden',
                            fontSize: 'clamp(32px, 4vw, 42px)',
                            fontWeight: 700,
                            letterSpacing: '-0.03em',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                            lineHeight: 1.15,
                            padding: 0,
                            margin: 0,
                            boxSizing: 'border-box',
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export interface TextualViewProps {
    onExport?: () => void;
    viewMode?: ViewMode;
    onViewModeChange?: (mode: ViewMode) => void;
    onToggleSidebar?: (side: 'left' | 'right') => void;
    rightSidebarOpen?: boolean;
}

export default function TextualView({ onExport, viewMode = 'split', onViewModeChange, onToggleSidebar, rightSidebarOpen }: TextualViewProps) {
    const { state, dispatch } = useApp();
    const steps = state.carnet_steps || [];
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const [pickingCodeFor, setPickingCodeFor] = useState<{ stepId: string, anchorSegmentIdx?: number } | null>(null);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);
    const [slashPaletteOpen, setSlashPaletteOpen] = useState(false);
    const [slashPaletteTrigger, setSlashPaletteTrigger] = useState<{ x: number; y: number } | null>(null);
    const [slashTargetStepId, setSlashTargetStepId] = useState<string | null>(null);
    const [slashInitialQuery, setSlashInitialQuery] = useState('');
    const [autoFocusStepId, setAutoFocusStepId] = useState<string | null>(null);
    const pendingAutoFocusNewStepRef = useRef(false);
    const prevStepIdsRef = useRef<Set<string>>(new Set(steps.map(s => s.id)));
    const slashPaletteAnchorRef = useRef<HTMLDivElement>(null);

    // Auto-focus d'un bloc fraîchement inséré (+ ouverture du menu / si déclenché par le bouton +)
    useEffect(() => {
        if (pendingAutoFocusNewStepRef.current) {
            const added = steps.find(s => !prevStepIdsRef.current.has(s.id) && s.isManual);
            if (added) {
                pendingAutoFocusNewStepRef.current = false;
                setAutoFocusStepId(added.id);
                if (pendingInsertSlashRectRef.current) {
                    const r = pendingInsertSlashRectRef.current;
                    pendingInsertSlashRectRef.current = null;
                    setSlashTargetStepId(added.id);
                    setSlashInitialQuery('');
                    setSlashPaletteTrigger({ x: r.right + 8, y: r.bottom + 4 });
                    setSlashPaletteOpen(true);
                }
            }
        }
        prevStepIdsRef.current = new Set(steps.map(s => s.id));
    }, [steps]);

    // Raccourci Alt+S (Solutions) et toast Annuler lors du masquage d'un bloc généré
    const [hiddenToastStepId, setHiddenToastStepId] = useState<string | null>(null);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                dispatch({ type: 'SET_CARNET_VIEW', view: state.carnet_view === 'solution' ? 'participant' : 'solution' });
            }
        };
        const onHidden = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail?.stepId) {
                setHiddenToastStepId(detail.stepId);
                setTimeout(() => setHiddenToastStepId(prev => (prev === detail.stepId ? null : prev)), 5000);
            }
        };
        window.addEventListener('keydown', onKey);
        window.addEventListener('textual:block-hidden', onHidden);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.removeEventListener('textual:block-hidden', onHidden);
        };
    }, [dispatch, state.carnet_view]);

    // Liste aplatie de tous les éléments sélectionnables pour la sélection de plage (Shift+Click)
    const flatItems = useMemo(() => {
        const list: Array<{ key: string; stepId: string; segIdx?: number; stepIndex: number; lineIdx: number }> = [];
        steps.forEach((step, sIdx) => {
            if (step.isManual) {
                list.push({ key: `step-${step.id}`, stepId: step.id, stepIndex: sIdx, lineIdx: 0 });
            } else {
                const segIndices = (step.stepIndices && step.stepIndices.length > 0)
                    ? step.stepIndices
                    : (step.originalSegmentIndex !== undefined ? [step.originalSegmentIndex] : [0]);
                segIndices.forEach((segIdx: number, lIdx: number) => {
                    list.push({ key: `seg-${segIdx}`, stepId: step.id, segIdx, stepIndex: sIdx, lineIdx: lIdx });
                });
            }
        });
        return list;
    }, [steps]);

    // Carte unique des étapes pour garantir qu'aucune lettre d'étape (A, B, C...) ne se répète entre les textes
    const stageLabelMap = useMemo(() => {
        const map = new Map<string, string>();
        const assignedStages = new Set<string>();

        // Étape A / départ initial : assignée au tout premier élément
        if (state.stages.length > 0 && steps.length > 0) {
            const firstStep = steps[0];
            const firstSegIdx = (firstStep.stepIndices && firstStep.stepIndices.length > 0)
                ? firstStep.stepIndices[0]
                : (firstStep.segmentIndices && firstStep.segmentIndices.length > 0)
                    ? firstStep.segmentIndices[0]
                    : (firstStep.originalSegmentIndex !== undefined ? firstStep.originalSegmentIndex : undefined);
            const firstKey = firstSegIdx !== undefined ? `seg-${firstSegIdx}` : `step-${firstStep.id}`;
            const firstLabel = state.stages[0]?.label || 'A';
            map.set(firstKey, firstLabel);
            assignedStages.add(firstLabel);
        }

        // Pour les étapes intermédiaires (B, C... sauf la dernière qui est l'arrivée au bas du document)
        const intermediateStages = state.stages.slice(1, -1);
        for (const st of intermediateStages) {
            if (!st.coords || assignedStages.has(st.label)) continue;

            let foundKey: string | null = null;
            for (const step of steps) {
                const segIndices = (step.stepIndices && step.stepIndices.length > 0)
                    ? step.stepIndices
                    : (step.segmentIndices && step.segmentIndices.length > 0)
                        ? step.segmentIndices
                        : (step.originalSegmentIndex !== undefined ? [step.originalSegmentIndex] : []);

                for (const segIdx of segIndices) {
                    const seg = state.polygonal_steps[segIdx];
                    if (seg && seg.coords && seg.coords.length > 0) {
                        const cStart = seg.coords[0]; // [lon, lat]
                        // st.coords is [lat, lon]
                        const distLat = Math.abs(st.coords[0] - cStart[1]);
                        const distLon = Math.abs(st.coords[1] - cStart[0]);
                        if (distLat < 0.0015 && distLon < 0.0015) {
                            foundKey = `seg-${segIdx}`;
                            break;
                        }
                    }
                }
                if (foundKey) break;

                if (step.fromLabel === st.label) {
                    foundKey = (step.stepIndices && step.stepIndices.length > 0)
                        ? `seg-${step.stepIndices[0]}`
                        : `step-${step.id}`;
                    break;
                }
            }

            if (foundKey) {
                map.set(foundKey, st.label);
                assignedStages.add(st.label);
            }
        }

        return map;
    }, [state.stages, state.polygonal_steps, steps]);

    // Sélection multiple intelligente (Ctrl / Cmd + Clic, Maj + Clic)
    const handleItemSelect = useCallback((key: string, e: React.MouseEvent, segIdx?: number, stepId?: string) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            e.stopPropagation();
            setSelectedKeys(prev => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            });
            setLastSelectedKey(key);
        } else if (e.shiftKey && lastSelectedKey) {
            e.preventDefault();
            e.stopPropagation();
            const startIdx = flatItems.findIndex(it => it.key === lastSelectedKey);
            const endIdx = flatItems.findIndex(it => it.key === key);
            if (startIdx !== -1 && endIdx !== -1) {
                const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
                setSelectedKeys(prev => {
                    const next = new Set(prev);
                    for (let i = min; i <= max; i++) {
                        next.add(flatItems[i].key);
                    }
                    return next;
                });
            }
            setLastSelectedKey(key);
        } else {
            if (selectedKeys.size > 1) {
                setSelectedKeys(new Set([key]));
                setLastSelectedKey(key);
            } else {
                setLastSelectedKey(key);
            }
        }
    }, [flatItems, lastSelectedKey, selectedKeys.size]);

    // Échap pour désélectionner
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && selectedKeys.size > 0) {
                setSelectedKeys(new Set());
            }
            // Ctrl+/ pour ouvrir la palette de commandes slash
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                // Positionner la palette au centre de l'écran
                setSlashPaletteTrigger({ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 });
                setSlashPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedKeys.size]);

    // Nettoyage de l'ancienne cellule artificielle résiduelle "# Document sans titre"
    useEffect(() => {
        const dummyTitleStep = steps.find(s => s.isManual && s.solutionText?.trim() === '# Document sans titre');
        if (dummyTitleStep) {
            dispatch({ type: 'REMOVE_MANUAL_STEP', stepId: dummyTitleStep.id });
        }
    }, [steps, dispatch]);

    // Action par lot : assignation de module
    const handleBatchAssignModule = useCallback((moduleId: ModuleId) => {
        const newAssignments = { ...(state.custom_assignments || {}) };
        selectedKeys.forEach(k => {
            const item = flatItems.find(it => it.key === k);
            if (item) {
                if (item.segIdx !== undefined) {
                    newAssignments[item.segIdx.toString()] = moduleId;
                } else if (item.stepId) {
                    dispatch({ type: 'MANUAL_MODULE_ASSIGNMENT', stepId: item.stepId, moduleId });
                }
            }
        });
        dispatch({ type: 'SET_CUSTOM_ASSIGNMENTS', assignments: newAssignments });
        dispatch({ type: 'REBUILD_CARNET' });
    }, [dispatch, flatItems, selectedKeys, state.custom_assignments]);

    // Action par lot : assignation de langue de guidage
    const handleBatchAssignLanguage = useCallback((lang?: NavLanguage) => {
        selectedKeys.forEach(k => {
            const item = flatItems.find(it => it.key === k);
            if (item) {
                if (item.segIdx !== undefined) {
                    dispatch({ type: 'SET_NAV_LANGUAGE', segIdx: item.segIdx, lang });
                } else if (item.stepId) {
                    dispatch({ type: 'SET_NAV_LANGUAGE', stepId: item.stepId, lang });
                }
            }
        });
        dispatch({ type: 'REBUILD_CARNET' });
    }, [dispatch, flatItems, selectedKeys]);

    const handleModuleChange = useCallback((stepId: string, moduleId: ModuleId) => {
        dispatch({ type: 'MANUAL_MODULE_ASSIGNMENT', stepId, moduleId });
        dispatch({ type: 'REBUILD_CARNET' });
    }, [dispatch]);

    const handleAddHtmlStep = useCallback((afterStepId: string, anchorSegmentIdx?: number) => {
        pendingAutoFocusNewStepRef.current = true;
        dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, anchorSegmentIdx, content: '', manualType: 'html' });
    }, [dispatch]);

    const handleTriggerSlashPalette = useCallback((stepId: string, rect: DOMRect, query: string) => {
        setSlashTargetStepId(stepId);
        setSlashInitialQuery(query);
        // Positionner sous le caret (rect.left = x caret, rect.top = y caret pour les DOMRect miroirs)
        const x = rect.left;
        const y = rect.bottom > rect.top ? rect.bottom + 4 : rect.top + 4;
        setSlashPaletteTrigger({ x, y });
        setSlashPaletteOpen(true);
    }, []);

    const handleEnterFromTitle = useCallback(() => {
        const firstManual = steps[0];
        if (firstManual && firstManual.isManual && firstManual.manualType === 'html') {
            setAutoFocusStepId(firstManual.id);
        } else {
            pendingAutoFocusNewStepRef.current = true;
            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId: '', content: '', manualType: 'html' });
        }
    }, [steps, dispatch]);

    const handleAddCodeStep = useCallback((afterStepId: string, anchorSegmentIdx?: number) => {
        setPickingCodeFor({ stepId: afterStepId, anchorSegmentIdx });
    }, []);

    const handleRemoveStep = useCallback((stepId: string) => {
        dispatch({ type: 'REMOVE_MANUAL_STEP', stepId });
    }, [dispatch]);

    const handleManualContentChange = useCallback((stepId: string, content: string) => {
        dispatch({ type: 'UPDATE_MANUAL_TEXT', stepId, text: content });
    }, [dispatch]);

    const handleNavLanguageChange = useCallback((stepId: string, lang?: NavLanguage) => {
        dispatch({ type: 'SET_NAV_LANGUAGE', stepId, lang });
    }, [dispatch]);

    const handlePoiToggle = useCallback((stepId?: string, segIdx?: number, poiId?: string) => {
        const pId = poiId || (typeof segIdx === 'string' ? (segIdx as any) : undefined);
        const sId = stepId || '';
        if (pId) {
            dispatch({ type: 'TOGGLE_POI', stepId: sId, poiId: pId });
        }
    }, [dispatch]);

    // Nouvelles actions pour les blocs
    const handleDuplicateStep = useCallback((stepId: string) => {
        // Trouver l'étape et la dupliquer après elle
        const stepIdx = steps.findIndex(s => s.id === stepId);
        if (stepIdx >= 0) {
            const step = steps[stepIdx];
            if (step.isManual) {
                dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId: stepId, content: step.solutionText, manualType: step.manualType || 'html', moduleId: step.moduleId });
            }
        }
    }, [dispatch, steps]);

    const handleMoveStepUp = useCallback((stepId: string) => {
        dispatch({ type: 'MOVE_CARNET_STEP', stepId, direction: 'up' });
    }, [dispatch]);

    const handleMoveStepDown = useCallback((stepId: string) => {
        dispatch({ type: 'MOVE_CARNET_STEP', stepId, direction: 'down' });
    }, [dispatch]);

    const handleDragReorder = useCallback((sourceStepId: string, targetStepId: string, position: 'before' | 'after') => {
        dispatch({ type: 'REORDER_CARNET_STEPS', sourceStepId, targetStepId, position });
    }, [dispatch]);

    const pendingInsertSlashRectRef = useRef<DOMRect | null>(null);
    const handleInsertBelowAndOpenMenu = useCallback((afterStepId: string, rect: DOMRect) => {
        pendingInsertSlashRectRef.current = rect;
        pendingAutoFocusNewStepRef.current = true;
        dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '', manualType: 'html' });
    }, [dispatch]);

    const handleSplitBlockOnEnter = useCallback((afterStepId: string, initialContent = '') => {
        pendingAutoFocusNewStepRef.current = true;
        dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: initialContent, manualType: 'html' });
    }, [dispatch]);

    const handleCopyStep = useCallback((stepId: string) => {
        const step = steps.find(s => s.id === stepId);
        if (step) {
            navigator.clipboard.writeText(JSON.stringify(step, null, 2));
        }
    }, [steps]);

    const handleLinkReference = useCallback((stepId: string) => {
        // Copier une référence markdown vers ce bloc
        const ref = `[@block:${stepId}]`;
        navigator.clipboard.writeText(ref);
    }, []);

    const handleOpenFontSelector = useCallback((stepId: string) => {
        // Ouvrir le sélecteur de polices pour ce bloc
        console.log('Open font selector for:', stepId);
    }, []);

    const handleOpenSettings = useCallback((stepId: string) => {
        // Ouvrir les paramètres avancés pour ce bloc
        console.log('Open settings for:', stepId);
    }, []);

    const handleLineClick = useCallback((step: any, segIdx?: number) => {
        if (viewMode === 'split' && mapRef.current) {
            if (segIdx !== undefined) {
                const seg = state.polygonal_steps[segIdx];
                if (seg && seg.coords && seg.coords.length > 0) {
                    const latLngs = seg.coords.map((c: any) => [c[1], c[0]] as [number, number]);
                    const bounds = L.latLngBounds(latLngs);
                    mapRef.current.flyToBounds(bounds, { padding: [50, 50], duration: 0.5 });
                }
            } else if (step.coords && step.coords.length > 0) {
                const latLngs = step.coords.map((c: any) => [c[1], c[0]] as [number, number]);
                const bounds = L.latLngBounds(latLngs);
                mapRef.current.flyToBounds(bounds, { padding: [50, 50], duration: 0.5 });
            }
        }
    }, [viewMode, state.polygonal_steps]);

    const handleStageClick = useCallback((stageLabel: string) => {
        const stage = state.stages.find(s => s.label === stageLabel);
        if (!stage || !stage.coords) return;

        if (viewMode === 'text') {
            onViewModeChange?.('split');
        }

        setTimeout(() => {
            if (mapRef.current) {
                mapRef.current.flyTo(stage.coords, Math.max(mapRef.current.getZoom(), 16), { duration: 0.8 });
            }
        }, viewMode === 'text' ? 120 : 0);
    }, [state.stages, viewMode, onViewModeChange]);

    const errorItems = useMemo(() => {
        const items: { stepId: string; stepLabel: string; message: string; severity: 'error' | 'warning' }[] = [];
        for (const step of steps) {
            if (step.warnings && step.warnings.length > 0 && !step.isEdited && !step.isHidden) {
                for (const w of step.warnings) {
                    if (w.message) {
                        items.push({
                            stepId: step.id,
                            stepLabel: step.fromLabel || 'Étape',
                            message: w.message,
                            severity: w.severity === 'error' ? 'error' : 'warning'
                        });
                    }
                }
            }
        }
        return items;
    }, [steps]);
    const hasErrors = useMemo(() => errorItems.some(i => i.severity === 'error'), [errorItems]);

    // Extraction de tous les modules réellement employés dans le carnet
    const usedModules = new Set<string>();
    for (const step of steps) {
        if (step.moduleId) usedModules.add(step.moduleId);
        if (step.inlineManualSteps) {
            for (const sub of Object.values(step.inlineManualSteps) as any[]) {
                if (sub && sub.moduleId) usedModules.add(sub.moduleId);
            }
        }
    }

    const hasMorse = usedModules.has('morse');
    const hasPolybe = usedModules.has('polybe');
    const hasVigenere = usedModules.has('vigenere');
    const hasMaritime = usedModules.has('maritime') || usedModules.has('drapeaux');
    const hasTemplier = usedModules.has('templier');
    const hasAvocat = usedModules.has('avocat');

    const anyAnnexeEmployed = hasMorse || hasPolybe || hasVigenere || hasMaritime || hasTemplier || hasAvocat;
    const isAnnexeActive = (id: AnnexeId) => !(state.disabled_annexes || []).includes(id);

    const accentColor = state.carnet_view === 'solution' ? 'var(--semantic-orange)' : 'var(--accent-hover)';
    const isSolution = state.carnet_view === 'solution';

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const handleContainerDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!e.dataTransfer.types.includes('text/carnet-step-id')) return;
        const el = scrollContainerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (e.clientY < rect.top + 60) el.scrollBy({ top: -18 });
        else if (e.clientY > rect.bottom - 60) el.scrollBy({ top: 18 });
    };

    const colStyle: React.CSSProperties = {
        maxWidth: '760px',
        width: '100%',
        margin: '0 auto',
        padding: '0 clamp(14px, 4vw, 40px)',
        boxSizing: 'border-box',
    };

    return (
        <div
            data-textual-pane="true"
            tabIndex={-1}
            style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bg-base)',
            overflow: 'hidden',
            position: 'relative',
            outline: 'none',
        }}>
            {/* ── Corps défilable : les fonds générés vont jusqu'aux bords de la page ── */}
            <div
                ref={scrollContainerRef}
                onDragOver={handleContainerDragOver}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingTop: '96px',
                    paddingBottom: '96px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                }}
            >
                <div style={{
                    width: '100%',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                }}>
                        {/* ── Titre principal du document style Notion ── */}
                        <div style={colStyle}>
                            <CarnetDocumentTitle onEnterToBody={handleEnterFromTitle} />
                        </div>

                        <>
                            {/* Profil altimétrique aligné sur la gouttière 40px */}
                            <div style={colStyle}>
                                <div style={{ paddingLeft: GUTTER_WIDTH }}>
                                    <CarnetElevationBlock />
                                </div>
                            </div>

                            {pickingCodeFor?.stepId === "" && (
                                <div style={colStyle}>
                                    <CodeBlockPicker
                                        afterStepId=""
                                        anchorSegmentIdx={pickingCodeFor.anchorSegmentIdx}
                                        onClose={() => setPickingCodeFor(null)}
                                    />
                                </div>
                            )}

                            {steps.map((step, idx) => {
                                const visiblePrev = steps.slice(0, idx).reverse().find(s => !s.isHidden);
                                const visibleNext = steps.slice(idx + 1).find(s => !s.isHidden);
                                const isPrevGenerated = Boolean(visiblePrev && !visiblePrev.isManual);
                                const isNextGenerated = Boolean(visibleNext && !visibleNext.isManual);
                                const isGeneratedBand = !step.isManual && !step.isHidden;

                                const blockEl = (
                                    <CarnetStepBlock
                                        step={step}
                                        stepIndex={idx}
                                        view={state.carnet_view}
                                        onModuleChange={handleModuleChange}
                                        onManualContentChange={handleManualContentChange}
                                        onRemoveStep={handleRemoveStep}
                                        onNavLanguageChange={handleNavLanguageChange}
                                        onPoiToggle={handlePoiToggle}
                                        onLineClick={handleLineClick}
                                        onAddInlineCode={(segIdx: number) => setPickingCodeFor({ stepId: step.id, anchorSegmentIdx: segIdx })}
                                        selectedKeys={selectedKeys}
                                        onItemSelect={handleItemSelect}
                                        stageLabelMap={stageLabelMap}
                                        onDuplicateStep={handleDuplicateStep}
                                        onMoveStepUp={handleMoveStepUp}
                                        onMoveStepDown={handleMoveStepDown}
                                        onCopyStep={handleCopyStep}
                                        onLinkReference={handleLinkReference}
                                        onOpenFontSelector={handleOpenFontSelector}
                                        onOpenSettings={handleOpenSettings}
                                        onStageClick={handleStageClick}
                                        onTriggerSlashPalette={handleTriggerSlashPalette}
                                        onInsertBelow={handleInsertBelowAndOpenMenu}
                                        onSplitBlockOnEnter={handleSplitBlockOnEnter}
                                        onDragReorder={handleDragReorder}
                                        isPrevGenerated={isPrevGenerated}
                                        isNextGenerated={isNextGenerated}
                                        autoFocusStepId={autoFocusStepId}
                                        onAutoFocusHandled={() => setAutoFocusStepId(null)}
                                        splitMode={viewMode === 'split' && !isMobile}
                                    />
                                );

                                return (
                                    <React.Fragment key={step.id}>
                                        {isGeneratedBand ? blockEl : <div style={colStyle}>{blockEl}</div>}
                                        {pickingCodeFor?.stepId === step.id && (
                                            <div style={colStyle}>
                                                <CodeBlockPicker
                                                    afterStepId={step.id}
                                                    anchorSegmentIdx={pickingCodeFor.anchorSegmentIdx}
                                                    onClose={() => setPickingCodeFor(null)}
                                                />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {/* ── Marqueur d'arrivée final : bloc d'étape à part entière ── */}
                            {steps.length > 0 && !steps[steps.length - 1].isManual && steps[steps.length - 1].toLabel && (
                                <div style={colStyle}>
                                    <StageHeaderBlock
                                        stageLabel={steps[steps.length - 1].toLabel!}
                                        dotColor="var(--semantic-red)"
                                        isArrival={true}
                                        splitMode={viewMode === 'split' && !isMobile}
                                        onStageClick={handleStageClick}
                                    />
                                </div>
                            )}
                            {/* Zone cliquable en pied de page façon Notion : cliquer pour ajouter un bloc et écrire */}
                            <div
                                onClick={() => {
                                    const lastStep = steps[steps.length - 1];
                                    if (lastStep && lastStep.isManual && lastStep.manualType === 'html' && !(lastStep.solutionText || '').trim()) {
                                        setAutoFocusStepId(lastStep.id);
                                    } else {
                                        handleAddHtmlStep(lastStep ? lastStep.id : '');
                                    }
                                }}
                                style={{
                                    ...colStyle,
                                    minHeight: '48px',
                                    flex: 1,
                                    cursor: 'text',
                                }}
                            />

                            {/* Actions rapides vers le bas de la page tant qu'aucun bloc n'est rempli (le titre ne compte pas) */}
                            {!steps.some(s => !s.isHidden && (!s.isManual || Boolean((s.solutionText || '').trim() || (s.encodedText || '').trim()))) && (() => {
                                const emptyManualStep = steps.find(s => !s.isHidden && s.isManual && !(s.solutionText || '').trim() && !(s.encodedText || '').trim());
                                const triggerQuickCode = (cipher: ModuleId) => {
                                    if (emptyManualStep) {
                                        dispatch({ type: 'CONVERT_MANUAL_STEP_TYPE', stepId: emptyManualStep.id, targetType: 'code', moduleId: cipher });
                                        setAutoFocusStepId(emptyManualStep.id);
                                    } else {
                                        const afterStepId = steps.length > 0 ? steps[steps.length - 1].id : '';
                                        pendingAutoFocusNewStepRef.current = true;
                                        dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '', manualType: 'code', moduleId: cipher });
                                    }
                                };
                                const triggerQuickText = () => {
                                    if (emptyManualStep && emptyManualStep.manualType === 'html') {
                                        setAutoFocusStepId(emptyManualStep.id);
                                    } else {
                                        handleAddHtmlStep(steps.length > 0 ? steps[steps.length - 1].id : '');
                                    }
                                };
                                return (
                                <div
                                    style={{
                                        ...colStyle,
                                        marginTop: 'auto',
                                        paddingTop: '32px',
                                        paddingBottom: '8px',
                                    }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div style={{ paddingLeft: `${GUTTER_WIDTH}px` }}>
                                        <div style={{
                                            fontSize: '12.5px',
                                            color: 'var(--text-dim)',
                                            marginBottom: '10px',
                                        }}>
                                            Commencer avec
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                        }}>
                                            <button
                                                type="button"
                                                onClick={() => triggerQuickCode('morse')}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                    height: '32px', padding: '0 13px', borderRadius: '9999px',
                                                    background: 'rgba(37, 99, 235, 0.16)',
                                                    border: '1px solid rgba(59, 130, 246, 0.32)',
                                                    color: '#60a5fa', fontSize: '13px', fontWeight: 500,
                                                    cursor: 'pointer', transition: 'background 100ms ease',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(37, 99, 235, 0.24)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(37, 99, 235, 0.16)')}
                                            >
                                                <Lock size={14} />
                                                <span>Message en Morse</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={triggerQuickText}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                    height: '32px', padding: '0 13px', borderRadius: '9999px',
                                                    background: 'var(--bg-surface)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500,
                                                    cursor: 'pointer', transition: 'background 100ms ease',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                                            >
                                                <FileText size={14} color="var(--text-dim)" />
                                                <span>Texte libre</span>
                                            </button>

                                            {([
                                                { id: 'vigenere', label: 'Vigenère', Icon: KeyRound },
                                                { id: 'polybe', label: 'Polybe', Icon: LayoutGrid },
                                                { id: 'templier', label: 'Templier', Icon: Shield },
                                            ] as const).map(({ id, label, Icon }) => (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => triggerQuickCode(id)}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '7px',
                                                        height: '32px', padding: '0 13px', borderRadius: '9999px',
                                                        background: 'var(--bg-surface)',
                                                        border: '1px solid var(--border-subtle)',
                                                        color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500,
                                                        cursor: 'pointer', transition: 'background 100ms ease',
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                                                >
                                                    <Icon size={14} color="var(--text-dim)" />
                                                    <span>{label}</span>
                                                </button>
                                            ))}

                                            <button
                                                type="button"
                                                aria-label="Plus de blocs et codes"
                                                title="Tous les blocs et codes avancés (/)"
                                                onClick={(e) => {
                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                    setSlashTargetStepId(null);
                                                    setSlashInitialQuery('');
                                                    setSlashPaletteTrigger({ x: rect.left, y: rect.bottom + 6 });
                                                    setSlashPaletteOpen(true);
                                                }}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                    width: '32px', height: '32px', borderRadius: '9999px',
                                                    background: 'var(--bg-surface)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-secondary)',
                                                    cursor: 'pointer', transition: 'background 100ms ease',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface)')}
                                            >
                                                <MoreHorizontal size={15} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })()}

                            {/* Bouton de compilation si le tracé existe mais que les tronçons doivent être assemblés */}
                            {state.polygonal_steps.length > 0 && steps.filter(s => !s.isManual).length === 0 && (
                                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                                    <button
                                        onClick={() => dispatch({ type: 'REBUILD_CARNET' })}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '7px',
                                            padding: '9px 20px',
                                            background: 'var(--accent-primary)',
                                            color: 'var(--accent-primary-text)',
                                            border: 'none',
                                            borderRadius: 'var(--radius-xs)',
                                            fontSize: '12.5px',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            boxShadow: 'var(--shadow-sm)',
                                            transition: 'background 120ms ease'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-primary-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-primary)'}
                                    >
                                        <Sparkles size={14} />
                                        <span>Compiler les tronçons du carnet</span>
                                    </button>
                                </div>
                            )}
                        </>
                    
                    {/* ── Annexes documentaires style Notion : alignées sur la gouttière 40px ── */}
                    {steps.length > 0 && anyAnnexeEmployed && (
                        <div style={{ ...colStyle, marginTop: '48px', paddingBottom: '48px' }}>
                            <div style={{ paddingLeft: `${GUTTER_WIDTH}px`, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    paddingBottom: '8px',
                                    borderBottom: '1px solid var(--border-subtle)',
                                }}>
                                    <Table size={15} color="var(--text-dim)" />
                                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                                        Annexes de décodage
                                    </h2>
                                </div>

                                {/* ── Annexe Morse ── */}
                                {hasMorse && (() => {
                                    const active = isAnnexeActive('alphabet_morse');
                                    return (
                                        <div style={{
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Binary size={14} color="var(--text-dim)" />
                                                    <h3 style={{ fontSize: '13.5px', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                                                        Code Morse international
                                                    </h3>
                                                </div>
                                                <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'alphabet_morse' })} />
                                            </div>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
                                                gap: '6px',
                                                opacity: active ? 1 : 0.35,
                                                transition: 'opacity 180ms ease',
                                            }}>
                                                {Object.entries(ModuleLogic.getMorseTable()).map(([char, code]) => (
                                                    <div key={char} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
                                                        <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{char.toUpperCase()}</span>
                                                        <span style={{ display: 'block', fontFamily: '"Morse", "Courier New", monospace', fontSize: '18px', color: 'var(--text-secondary)', marginTop: '2px', letterSpacing: '2px' }}>{char.toUpperCase()}</span>
                                                        <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' }}>{code}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ── Annexe Polybe ── */}
                                {hasPolybe && (() => {
                                    const active = isAnnexeActive('grille_polybe');
                                    return (
                                        <div style={{
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <LayoutGrid size={14} color="var(--text-dim)" />
                                                    <h3 style={{ fontSize: '13.5px', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                                                        Carré de Polybe
                                                    </h3>
                                                </div>
                                                <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'grille_polybe' })} />
                                            </div>
                                            <div style={{
                                                overflowX: 'auto',
                                                WebkitOverflowScrolling: 'touch',
                                                opacity: active ? 1 : 0.35,
                                                transition: 'opacity 180ms ease',
                                            }}>
                                                <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: 'auto', margin: '0 auto', fontVariantNumeric: 'tabular-nums' }}>
                                                    <tbody>
                                                        <tr>
                                                            <th style={{ border: '1px solid var(--border-subtle)', padding: '6px 10px', textAlign: 'center', background: 'var(--bg-hover)', color: 'var(--text-dim)' }}></th>
                                                            {[1, 2, 3, 4, 5, 6].map(i => (
                                                                <th key={i} style={{ border: '1px solid var(--border-subtle)', padding: '6px 10px', textAlign: 'center', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                                    {i}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        {ModuleLogic.getPolybeGrid().map((row, rIdx) => (
                                                            <tr key={rIdx}>
                                                                <th style={{ border: '1px solid var(--border-subtle)', padding: '6px 10px', textAlign: 'center', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                                    {rIdx + 1}
                                                                </th>
                                                                {row.map((cell, cIdx) => (
                                                                    <td key={cIdx} style={{ border: '1px solid var(--border-subtle)', padding: '6px 10px', textAlign: 'center', background: 'var(--bg-base)' }}>
                                                                        <b style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>{cell.char}</b><br />
                                                                        <small style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>{cell.coord}</small>
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ── Annexe Vigenère ── */}
                                {hasVigenere && (() => {
                                    const active = isAnnexeActive('tableau_vigenere');
                                    const v = ModuleLogic.getVigenereTable(themeManager.getTheme(state.theme_id).vigenere_key || 'MOUSTACHE');
                                    return (
                                        <div style={{
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <KeyRound size={14} color="var(--text-dim)" />
                                                    <h3 style={{ fontSize: '13.5px', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                                                        Carré de Vigenère · Clé{' '}
                                                        <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '1px 6px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-primary)' }}>
                                                            {v.key}
                                                        </code>
                                                    </h3>
                                                </div>
                                                <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'tableau_vigenere' })} />
                                            </div>
                                            <div style={{
                                                overflowX: 'auto',
                                                WebkitOverflowScrolling: 'touch',
                                                opacity: active ? 1 : 0.35,
                                                transition: 'opacity 180ms ease',
                                            }}>
                                                <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: 'auto', margin: '0 auto', fontFamily: 'var(--font-mono)' }}>
                                                    <tbody>
                                                        <tr>
                                                            <th style={{ border: '1px solid var(--border-subtle)', padding: '4px 6px', textAlign: 'center', background: 'var(--bg-hover)', color: 'var(--text-dim)' }}></th>
                                                            {v.alphabet.split('').map(c => (
                                                                <th key={c} style={{ border: '1px solid var(--border-subtle)', padding: '4px 6px', textAlign: 'center', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                                    {c}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                        {v.table.map((row, rIdx) => (
                                                            <tr key={rIdx}>
                                                                <th style={{ border: '1px solid var(--border-subtle)', padding: '4px 6px', textAlign: 'center', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                                    {v.alphabet[rIdx]}
                                                                </th>
                                                                {row.map((c, cIdx) => (
                                                                    <td key={cIdx} style={{ border: '1px solid var(--border-subtle)', padding: '3px 5px', textAlign: 'center', minWidth: '16px', color: 'var(--text-secondary)', background: 'var(--bg-base)' }}>
                                                                        {c}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ── Annexe Maritime ── */}
                                {hasMaritime && (() => {
                                    const active = isAnnexeActive('index_drapeaux');
                                    return (
                                        <div style={{
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Flag size={14} color="var(--text-dim)" />
                                                    <h3 style={{ fontSize: '13.5px', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                                                        Code maritime & pavillons NATO
                                                    </h3>
                                                </div>
                                                <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'index_drapeaux' })} />
                                            </div>
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(54px, 1fr))',
                                                gap: '6px',
                                                opacity: active ? 1 : 0.35,
                                                transition: 'opacity 180ms ease',
                                            }}>
                                                {Object.entries(ModuleLogic.getNATOAlphabet()).map(([char, word]) => (
                                                    <div key={char} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '6px 4px', textAlign: 'center' }}>
                                                        <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>{char.toUpperCase()}</span>
                                                        <span style={{ display: 'block', fontFamily: '"Maritime", "Courier New", monospace', fontSize: '24px', color: 'var(--text-secondary)', marginTop: '2px' }}>{char.toUpperCase()}</span>
                                                        <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{word}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ── Annexe Templier ── */}
                                {hasTemplier && (() => {
                                    const active = isAnnexeActive('code_templier');
                                    return (
                                        <div style={{
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Shield size={14} color="var(--text-dim)" />
                                                    <h3 style={{ fontSize: '13.5px', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                                                        Croix templière
                                                    </h3>
                                                </div>
                                                <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'code_templier' })} />
                                            </div>
                                            <div style={{
                                                textAlign: 'center',
                                                overflowX: 'auto',
                                                opacity: active ? 1 : 0.35,
                                                transition: 'opacity 180ms ease',
                                            }}>
                                                <img
                                                    src="/assets/images/code_templier.jpg"
                                                    alt="Code Templier"
                                                    style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: '6px', outline: '1px solid oklch(1 0 0 / 0.1)', outlineOffset: '-1px', objectFit: 'contain' }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* ── Annexe Avocat ── */}
                                {hasAvocat && (() => {
                                    const active = isAnnexeActive('methode_avocat');
                                    return (
                                        <div style={{
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            padding: '14px 16px',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <Scale size={14} color="var(--text-dim)" />
                                                    <h3 style={{ fontSize: '13.5px', color: 'var(--text-primary)', margin: 0, fontWeight: 600 }}>
                                                        Méthode Avocat (A = K, décalage +10)
                                                    </h3>
                                                </div>
                                                <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'methode_avocat' })} />
                                            </div>
                                            <div style={{
                                                background: 'var(--bg-base)',
                                                border: '1px solid var(--border-subtle)',
                                                borderRadius: '6px',
                                                padding: '12px',
                                                textAlign: 'center',
                                                fontFamily: 'var(--font-mono)',
                                                fontSize: '12px',
                                                opacity: active ? 1 : 0.35,
                                                transition: 'opacity 180ms ease',
                                            }}>
                                                <div style={{ color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '2px', marginBottom: '4px' }}>
                                                    A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
                                                </div>
                                                <div style={{ color: 'var(--text-dim)', fontSize: '11.5px', marginBottom: '4px' }}>↓ décalage de 10 lettres ↓</div>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 600, letterSpacing: '2px' }}>
                                                    K L M N O P Q R S T U V W X Y Z A B C D E F G H I J
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Barre d'actions par lot uniquement lors d'une multi-sélection */}
            {selectedKeys.size > 1 && (
                <div
                    id="textual-floating-bar-container"
                    style={{
                        position: 'absolute',
                        top: isMobile ? '12px' : '16px',
                        left: isMobile ? '12px' : '16px',
                        zIndex: 1100,
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <MultiSelectBatchBar
                        selectedCount={selectedKeys.size}
                        onBatchModule={handleBatchAssignModule}
                        onBatchLanguage={handleBatchAssignLanguage}
                        onDeselectAll={() => setSelectedKeys(new Set())}
                    />
                </div>
            )}

            {/* BOUTONS HAUT DROITE DISCRETS : SOLUTIONS (tout le doc) + MAXIMIZE / MINIMIZE */}
            <div style={{
                position: 'absolute',
                top: '12px',
                right: '14px',
                zIndex: 1100,
                pointerEvents: 'all',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                {onViewModeChange && !isMobile && (
                    <button
                        type="button"
                        onClick={() => onViewModeChange(viewMode === 'text' ? 'split' : 'text')}
                        title={viewMode === 'text' ? "Réduire le carnet (Mode partagé)" : "Agrandir le carnet (Plein écran)"}
                        style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '7px',
                            border: 'none',
                            background: viewMode === 'text' ? 'var(--accent-transparent)' : 'transparent',
                            color: viewMode === 'text' ? 'var(--accent-hover)' : 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background 120ms ease, color 120ms ease'
                        }}
                        onMouseEnter={e => {
                            if (viewMode !== 'text') {
                                e.currentTarget.style.background = 'var(--bg-hover)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (viewMode !== 'text') {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = 'var(--text-dim)';
                            }
                        }}
                    >
                        {viewMode === 'text' ? (
                            <Minimize2 size={15} strokeWidth={2} />
                        ) : (
                            <Maximize2 size={15} strokeWidth={2} />
                        )}
                    </button>
                )}
            </div>

            {/* Toast Annuler lors du masquage d'un bloc généré (Lot F) */}
            {hiddenToastStepId && (
                <div style={{
                    position: 'absolute',
                    bottom: '40px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1200,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    fontSize: '12.5px',
                    color: 'var(--text-primary)',
                }}>
                    <span>Bloc masqué</span>
                    <button
                        type="button"
                        onClick={() => {
                            dispatch({ type: 'UNHIDE_COMPUTED_STEP', stepId: hiddenToastStepId });
                            setHiddenToastStepId(null);
                        }}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-hover)',
                            fontWeight: 600,
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                        }}
                    >
                        Annuler
                    </button>
                </div>
            )}

            {/* ── Barre d'état discrète en bas : anomalies & Solutions (Lot A) ── */}
            <TextualStatusBar
                isSolution={isSolution}
                onToggleSolution={() => dispatch({ type: 'SET_CARNET_VIEW', view: isSolution ? 'participant' : 'solution' })}
                errorItems={errorItems}
                hasErrors={hasErrors}
            />

            {/* ── Palette de commandes slash (/) ── */}
            <SlashCommandPalette
                isOpen={slashPaletteOpen}
                onClose={() => {
                    setSlashPaletteOpen(false);
                    setSlashTargetStepId(null);
                    setSlashInitialQuery('');
                }}
                initialQuery={slashInitialQuery}
                onInsertBlock={(blockType, config) => {
                    const snippetMap: Record<string, string> = {
                        heading: '#'.repeat(config?.level || 1) + ' ',
                        paragraph: '',
                        bullet_list: '- ',
                        numbered_list: '1. ',
                        check_list: '- [ ] ',
                        blockquote: '> ',
                        divider: '\n---\n',
                        image: '![]()',
                        file: '[Fichier]()',
                        code_block: '\n```\n\n```\n',
                        latex: '$$\n\n$$\n',
                        toc: '[[TOC]]',
                    };

                    if (slashTargetStepId) {
                        const targetStep = steps.find(s => s.id === slashTargetStepId);
                        const currentText = targetStep?.solutionText || '';
                        const cleaned = currentText.replace(/(?:^|\n)\s*\/[^\n]*$/, (m) => (m.startsWith('\n') ? '\n' : ''));
                        if (blockType === 'crypto_block') {
                            if (cleaned !== currentText) {
                                handleManualContentChange(slashTargetStepId, cleaned);
                            }
                            dispatch({
                                type: 'CONVERT_MANUAL_STEP_TYPE',
                                stepId: slashTargetStepId,
                                targetType: 'code',
                                moduleId: config?.cipher,
                            });
                            setAutoFocusStepId(slashTargetStepId);
                            return;
                        }
                        if (blockType === 'annexe') return;

                        const nextText = cleaned + (snippetMap[blockType] ?? '');
                        handleManualContentChange(slashTargetStepId, nextText);
                        setAutoFocusStepId(slashTargetStepId);
                        return;
                    }

                    // Fallback (Ctrl+/) : insérer un nouveau bloc après le dernier
                    const afterStepId = steps.length > 0 ? steps[steps.length - 1].id : '';
                    if (blockType === 'crypto_block') {
                        pendingAutoFocusNewStepRef.current = true;
                        dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '', manualType: 'code', moduleId: config?.cipher });
                        return;
                    }
                    if (blockType === 'annexe') return;

                    pendingAutoFocusNewStepRef.current = true;
                    dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: snippetMap[blockType] ?? '', manualType: 'html' });
                }}
                onSearchReference={(query) => {
                    console.log('Search reference:', query);
                }}
                anchorRef={slashPaletteAnchorRef}
                triggerPosition={slashPaletteTrigger}
            />
            {viewMode === 'split' && !isMobile && (
                <SplitStageBadgesOverlay
                    scrollContainerRef={scrollContainerRef}
                    onStageClick={handleStageClick}
                    depsKey={steps.length}
                />
            )}
        </div>
    );
}

interface StageBadgePosition {
    label: string;
    color: string;
    title: string;
    top: number;
    left: number;
}

function SplitStageBadgesOverlay({
    scrollContainerRef,
    onStageClick,
    depsKey,
}: {
    scrollContainerRef: React.RefObject<HTMLDivElement | null>;
    onStageClick: (label: string) => void;
    depsKey: number;
}) {
    const [badges, setBadges] = useState<StageBadgePosition[]>([]);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const recompute = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) {
            setBadges([]);
            return;
        }
        const paneRect = container.getBoundingClientRect();
        const anchors = container.querySelectorAll<HTMLElement>('[data-stage-anchor]');
        const next: StageBadgePosition[] = [];
        anchors.forEach((el) => {
            const label = el.getAttribute('data-stage-anchor') || '';
            const color = el.getAttribute('data-stage-color') || '#94A3B8';
            const title = el.getAttribute('data-stage-title') || `Étape ${label}`;
            const offset = Number(el.getAttribute('data-stage-offset') ?? 4);
            const rect = el.getBoundingClientRect();
            const top = Math.round(rect.top + (Number.isFinite(offset) ? offset : 4));
            // Masquer si hors de la zone visible du panneau texte
            if (top < paneRect.top + 4 || top > paneRect.bottom - 26) return;
            next.push({
                label,
                color,
                title,
                top,
                left: Math.round(paneRect.left - 11),
            });
        });
        setBadges(next);
    }, [scrollContainerRef]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(recompute);
        };
        schedule();
        container.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule);
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
        ro?.observe(container);
        return () => {
            cancelAnimationFrame(raf);
            container.removeEventListener('scroll', schedule);
            window.removeEventListener('resize', schedule);
            ro?.disconnect();
        };
    }, [scrollContainerRef, recompute, depsKey]);

    if (typeof document === 'undefined' || badges.length === 0) return null;

    return createPortal(
        <div
            aria-hidden={false}
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 1200,
            }}
        >
            {badges.map((b, idx) => {
                const isHovered = hoveredIdx === idx;
                return (
                    <button
                        key={`${b.label}-${idx}`}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onStageClick(b.label); }}
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                        title={b.title}
                        aria-label={b.title}
                        style={{
                            position: 'fixed',
                            left: `${b.left}px`,
                            top: `${b.top}px`,
                            width: '22px',
                            height: '22px',
                            borderRadius: '6px',
                            background: isHovered ? 'var(--bg-elevated)' : 'var(--bg-base)',
                            border: `1.5px solid ${b.color}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: b.color,
                            fontFamily: 'var(--font-mono)',
                            cursor: 'pointer',
                            padding: 0,
                            pointerEvents: 'all',
                            boxShadow: isHovered ? `0 0 8px ${b.color}66` : '0 1px 4px rgba(0, 0, 0, 0.35)',
                            transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                            transition: 'transform 120ms ease, box-shadow 120ms ease',
                        }}
                    >
                        {b.label}
                    </button>
                );
            })}
        </div>,
        document.body
    );
}

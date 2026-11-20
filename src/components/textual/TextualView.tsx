/**
 * TextualView.tsx — Carnet de route en mode texte.
 * Rendu éditorial pur SANS contours ni fonds isolants pour une intégration fluide dans le document.
 *
 * Règle stricte des annexes :
 *  - Ne JAMAIS afficher les annexes qui ne correspondent pas aux codes employés dans le raid.
 *  - Chaque annexe correspondante possède un bouton de switch dans sa marge/en-tête pour la griser ou l'inclure.
 */
import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import type { ModuleId, CarnetView, NavLanguage, AnnexeId } from '../../logic/types';
import { useApp } from '../../AppContext';
import { CarnetEngine } from '../../logic/CarnetEngine';
import { themeManager } from '../../logic/ThemeManager';
import { ModuleLogic } from '../../logic/ModuleLogic';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import CarnetStepBlock, { StageHeaderBlock } from './CarnetStepBlock';
import CodeBlockPicker from './CodeBlockPicker';
import CarnetElevationBlock from './CarnetElevationBlock';
import StepInsertSeparator from './StepInsertSeparator';
import TextualHeader from './TextualHeader';
import SlashCommandPalette from './SlashCommandPalette';
import { mapRef } from '../map/MapComponent';
import L from 'leaflet';
import type { ViewMode } from '../../App';
import {
    Compass, AlertTriangle, Sparkles, Binary,
    LayoutGrid, KeyRound, Flag, Shield, Scale, Table,
    CheckSquare, X, ChevronDown, Globe, Code2, SlidersHorizontal,
    Maximize2, Minimize2, FileText,
    Lightbulb, ArrowRight,
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
                width: '30px',
                height: '16px',
                borderRadius: '8px',
                background: isChecked ? 'var(--accent-default)' : 'var(--bg-hover)',
                border: 'none',
                position: 'relative',
                transition: 'all 150ms ease',
                flexShrink: 0
            }}>
                <div style={{
                    position: 'absolute',
                    top: '2px',
                    left: isChecked ? '16px' : '2px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: isChecked ? '#ffffff' : 'var(--text-dim)',
                    transition: 'left 150ms ease, background 150ms ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }} />
            </div>
            <span style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap'
            }}>
                Afficher l'annexe
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
        <div style={{
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
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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

// ─── Barre bas-gauche : Solutions (ampoule) + Erreurs ─────────────────────────
function TextualBottomBar({ isSolution, onToggleSolution }: { isSolution: boolean; onToggleSolution: () => void }) {
    const { state } = useApp();

    // Récupérer les erreurs exposées par TextualHeader via window
    const errorData = (window as any).__textualErrors || { items: [], hasErrors: false };
    const errorItems = errorData.items || [];
    const hasErrors = errorData.hasErrors || false;
    const errorCount = errorItems.length;

    return (
        <div style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
        }}>
            {/* BOUTON SOLUTIONS (ampoule) */}
            <button
                type="button"
                role="switch"
                aria-checked={isSolution}
                onClick={onToggleSolution}
                title={isSolution ? "Masquer les solutions (Vue participant)" : "Afficher les solutions (Vue animateur) — Raccourci : Alt+S"}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 10px',
                    height: '36px',
                    borderRadius: '10px',
                    border: isSolution ? '1px solid var(--semantic-orange)' : '1px solid var(--border-subtle)',
                    background: isSolution ? 'var(--semantic-orange)' : 'var(--bg-elevated)',
                    color: isSolution ? '#09090b' : 'var(--text-primary)',
                    fontSize: '12px',
                    fontWeight: isSolution ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 100ms ease',
                    boxShadow: 'var(--shadow-sm)',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!isSolution) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { if (!isSolution) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
            >
                <Lightbulb size={14} strokeWidth={isSolution ? 2.5 : 2} color={isSolution ? '#09090b' : 'var(--text-dim)'} fill={isSolution ? '#09090b' : 'none'} />
                <span>Solutions</span>
                <kbd style={{
                    fontSize: '8.5px', padding: '0 4px', height: '16px', borderRadius: '4px',
                    background: isSolution ? 'rgba(0, 0, 0, 0.15)' : 'var(--bg-surface)',
                    color: isSolution ? '#09090b' : 'var(--text-dim)',
                    border: isSolution ? 'none' : '1px solid var(--border-subtle)',
                    fontFamily: 'var(--font-mono)', display: 'inline-flex', alignItems: 'center'
                }} title="Raccourci clavier : Alt+S">Alt S</kbd>
            </button>

            {/* BOUTON ERREURS (si des anomalies existent) */}
            {errorCount > 0 && (
                <div style={{ position: 'relative' }}>
                    <button
                        type="button"
                        onClick={() => {
                            const evt = new CustomEvent('textual:open-errors');
                            window.dispatchEvent(evt);
                        }}
                        title={`${errorCount} anomalie${errorCount > 1 ? 's' : ''} détectée${errorCount > 1 ? 's' : ''} dans le carnet — Cliquer pour voir la liste`}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                            height: '36px', padding: '0 10px', borderRadius: '10px',
                            border: `1px solid ${hasErrors ? '#dc2626' : '#d97706'}`,
                            background: hasErrors ? '#ef4444' : '#f59e0b', color: '#ffffff',
                            cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                            transition: 'all 100ms ease', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = hasErrors ? '#dc2626' : '#d97706'}
                        onMouseLeave={e => e.currentTarget.style.background = hasErrors ? '#ef4444' : '#f59e0b'}
                    >
                        <AlertTriangle size={13} strokeWidth={2.6} color="#ffffff" />
                        <span>{errorCount}</span>
                    </button>

                    <ErrorBottomSheet
                        errorItems={errorItems}
                        hasErrors={hasErrors}
                    />
                </div>
            )}
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
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 8px 6px', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
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
function CarnetDocumentTitle() {
    const { state, dispatch } = useApp();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [title, setTitle] = useState(state.document_title || '');

    useEffect(() => {
        setTitle(state.document_title || '');
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
        if (!clean) {
            const fallback = 'Document sans titre';
            setTitle(fallback);
            dispatch({ type: 'SET_DOCUMENT_TITLE', title: fallback });
        } else if (clean !== title) {
            setTitle(clean);
            dispatch({ type: 'SET_DOCUMENT_TITLE', title: clean });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            textareaRef.current?.blur();
        }
        if (e.key === 'Escape') {
            textareaRef.current?.blur();
        }
    };

    return (
        <div
            className="carnet-document-title-wrapper"
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                width: '100%',
                paddingLeft: '38px', // Alignement strict avec le contenu des étapes (26px gutter + 12px margin)
                marginBottom: '16px',
                marginTop: '6px',
                boxSizing: 'border-box'
            }}
        >
            <textarea
                ref={textareaRef}
                value={title}
                onChange={handleChange}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder="Document sans titre"
                rows={1}
                spellCheck={false}
                style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    overflow: 'hidden',
                    fontSize: 'clamp(24px, 3.4vw, 34px)',
                    fontWeight: 800,
                    letterSpacing: '-0.025em',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                    lineHeight: 1.25,
                    padding: '2px 0',
                    margin: 0,
                    boxSizing: 'border-box',
                    transition: 'color 0.15s ease'
                }}
            />
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
    const slashPaletteAnchorRef = useRef<HTMLDivElement>(null);

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
        dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, anchorSegmentIdx, content: '', manualType: 'html' });
    }, [dispatch]);

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
        const stepIdx = steps.findIndex(s => s.id === stepId);
        if (stepIdx > 0) {
            // Échanger avec l'étape précédente
            const newSteps = [...steps];
            [newSteps[stepIdx - 1], newSteps[stepIdx]] = [newSteps[stepIdx], newSteps[stepIdx - 1]];
            // Note: This would need a proper REORDER action in the reducer
            // For now, we'll need to implement this in the reducer
        }
    }, [dispatch, steps]);

    const handleMoveStepDown = useCallback((stepId: string) => {
        const stepIdx = steps.findIndex(s => s.id === stepId);
        if (stepIdx >= 0 && stepIdx < steps.length - 1) {
            const newSteps = [...steps];
            [newSteps[stepIdx], newSteps[stepIdx + 1]] = [newSteps[stepIdx + 1], newSteps[stepIdx]];
        }
    }, [dispatch, steps]);

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

    const warningCount = steps.reduce((n, s) => n + (s.warnings || []).filter(w => w.severity === 'error').length, 0);

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

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bg-base)',
            overflow: 'hidden',
            position: 'relative',
        }}>
            {/* ── Bannière d'erreurs / avertissements ── */}
            {warningCount > 0 && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 16px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    borderBottom: '1px solid rgba(239, 68, 68, 0.25)',
                    fontSize: '11.5px',
                    color: '#f87171',
                    fontWeight: 600,
                    flexShrink: 0
                }}>
                    <AlertTriangle size={15} color="#ef4444" style={{ flexShrink: 0 }} />
                    <span>
                        {warningCount} anomalie{warningCount > 1 ? 's' : ''} de contrainte détectée{warningCount > 1 ? 's' : ''} — vérifiez les étapes marquées dans le carnet
                    </span>
                </div>
            )}

            {/* ── Corps défilable sans boîtes séparatrices ── */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: 'clamp(12px, 3vw, 24px) clamp(10px, 4vw, 32px)',
                paddingTop: '68px',
                paddingBottom: '32px',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box'
            }}>
                <div style={{
                    maxWidth: '920px',
                    width: '100%',
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    boxSizing: 'border-box'
                }}>
                        {/* ── Titre principal du document (au-dessus de l'étape 1, synchronisé avec le doc) ── */}
                        <CarnetDocumentTitle />

                        <>
                            {/* Profil altimétrique monté dans le doc sans contours séparateurs */}
                            <CarnetElevationBlock />

                            {pickingCodeFor?.stepId === "" && (
                                <CodeBlockPicker
                                    afterStepId=""
                                    anchorSegmentIdx={pickingCodeFor.anchorSegmentIdx}
                                    onClose={() => setPickingCodeFor(null)}
                                />
                            )}

                            {/* Séparateur initial au survol style ipynb (haut du carnet) */}
                            <StepInsertSeparator
                                afterStepId=""
                                onAddComment={handleAddHtmlStep}
                                onAddCode={handleAddCodeStep}
                            />
                            
                            {steps.map((step, idx) => (
                                <React.Fragment key={step.id}>
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
                                    />
                                    {pickingCodeFor?.stepId === step.id && (
                                        <CodeBlockPicker
                                            afterStepId={step.id}
                                            anchorSegmentIdx={pickingCodeFor.anchorSegmentIdx}
                                            onClose={() => setPickingCodeFor(null)}
                                        />
                                    )}
                                    {/* Séparateur au survol style ipynb entre chaque étape */}
                                    <StepInsertSeparator
                                        afterStepId={step.id}
                                        onAddComment={handleAddHtmlStep}
                                        onAddCode={handleAddCodeStep}
                                    />
                                </React.Fragment>
                            ))}

                            {/* ── Marqueur d'arrivée final : bloc d'étape à part entière ── */}
                            {steps.length > 0 && !steps[steps.length - 1].isManual && steps[steps.length - 1].toLabel && (
                                <StageHeaderBlock
                                    stageLabel={steps[steps.length - 1].toLabel!}
                                    dotColor="var(--semantic-red)"
                                    isArrival={true}
                                    onStageClick={handleStageClick}
                                />
                            )}
                            {/* Bandeau d'aide lorsque le tracé n'a pas encore été commencé */}
                            {state.polygonal_steps.length === 0 && (
                                <div style={{
                                    marginTop: '24px',
                                    padding: '16px 20px',
                                    borderRadius: '12px',
                                    background: 'var(--bg-surface)',
                                    border: '1px dashed var(--border-subtle)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    color: 'var(--text-dim)',
                                    fontSize: '12.5px'
                                }}>
                                    <Compass size={20} color="var(--accent-default)" style={{ flexShrink: 0 }} />
                                    <span>
                                        Tracez votre itinéraire dans la vue <strong>Carte</strong> avec au moins deux points pour synchroniser les étapes encodées de votre raid.
                                    </span>
                                </div>
                            )}

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
                    
                    {/* ── Annexes documentaires : affichées UNIQUEMENT si le code est employé dans le raid (sans contours ni fonds séparateurs) ── */}
                    {steps.length > 0 && anyAnnexeEmployed && (
                        <div style={{ marginTop: '40px', paddingBottom: '48px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                paddingBottom: '6px',
                                borderBottom: '1px solid var(--border-subtle)'
                            }}>
                                <Table size={15} color={accentColor} />
                                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                                    Annexes de décodage des codes employés
                                </span>
                            </div>

                            {/* ── Annexe Morse ── */}
                            {hasMorse && (() => {
                                const active = isAnnexeActive('alphabet_morse');
                                return (
                                    <div style={{
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Binary size={14} color={active ? accentColor : 'var(--text-dim)'} />
                                                <h3 style={{ fontSize: '11px', color: active ? accentColor : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontWeight: 700 }}>
                                                    TABLE DE CODE MORSE INTERNATIONAL
                                                </h3>
                                            </div>
                                            <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'alphabet_morse' })} />
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '6px',
                                            opacity: active ? 1 : 0.35,
                                            filter: active ? 'none' : 'grayscale(0.95)',
                                            transition: 'all 200ms ease'
                                        }}>
                                            {Object.entries(ModuleLogic.getMorseTable()).map(([char, code]) => (
                                                <div key={char} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', padding: '5px 7px', textAlign: 'center', minWidth: '42px' }}>
                                                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: active ? accentColor : 'var(--text-dim)' }}>{char.toUpperCase()}</span>
                                                    <span style={{ display: 'block', fontFamily: '"Morse", "Courier New", monospace', fontSize: '20px', color: 'var(--text-default)', marginTop: '1px', letterSpacing: '2px' }}>{char.toUpperCase()}</span>
                                                    <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '9.5px', color: 'var(--text-dim)' }}>{code}</span>
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
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <LayoutGrid size={14} color={active ? accentColor : 'var(--text-dim)'} />
                                                <h3 style={{ fontSize: '11px', color: active ? accentColor : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontWeight: 700 }}>
                                                    CARRÉ DE POLYBE (COORDONNÉES BI-CHIFFRÉES)
                                                </h3>
                                            </div>
                                            <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'grille_polybe' })} />
                                        </div>
                                        <div style={{
                                            overflowX: 'auto',
                                            WebkitOverflowScrolling: 'touch',
                                            opacity: active ? 1 : 0.35,
                                            filter: active ? 'none' : 'grayscale(0.95)',
                                            transition: 'all 200ms ease'
                                        }}>
                                            <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: 'auto', margin: '0 auto' }}>
                                                <tbody>
                                                    <tr>
                                                        <th style={{ border: '1px solid var(--border-subtle)', padding: '5px 8px', textAlign: 'center', background: active ? accentColor : 'var(--border-strong)', color: '#09090B' }}></th>
                                                        {[1, 2, 3, 4, 5, 6].map(i => (
                                                            <th key={i} style={{ border: '1px solid var(--border-subtle)', padding: '5px 8px', textAlign: 'center', background: active ? accentColor : 'var(--border-strong)', color: '#09090B', fontWeight: 700 }}>
                                                                {i}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                    {ModuleLogic.getPolybeGrid().map((row, rIdx) => (
                                                        <tr key={rIdx}>
                                                            <th style={{ border: '1px solid var(--border-subtle)', padding: '5px 8px', textAlign: 'center', background: active ? accentColor : 'var(--border-strong)', color: '#09090B', fontWeight: 700 }}>
                                                                {rIdx + 1}
                                                            </th>
                                                            {row.map((cell, cIdx) => (
                                                                <td key={cIdx} style={{ border: '1px solid var(--border-subtle)', padding: '5px 8px', textAlign: 'center', background: 'transparent' }}>
                                                                    <b style={{ color: 'var(--text-primary)', fontSize: '12.5px' }}>{cell.char}</b><br/>
                                                                    <small style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>{cell.coord}</small>
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
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <KeyRound size={14} color={active ? accentColor : 'var(--text-dim)'} />
                                                <h3 style={{ fontSize: '11px', color: active ? accentColor : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontWeight: 700 }}>
                                                    CARRÉ DE VIGENÈRE — Clé : <code style={{ fontFamily: 'var(--font-mono)', background: 'transparent', border: '1px solid var(--border-subtle)', padding: '1px 6px', borderRadius: '3px', color: 'var(--accent-hover)' }}>{v.key}</code>
                                                </h3>
                                            </div>
                                            <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'tableau_vigenere' })} />
                                        </div>
                                        <div style={{
                                            overflowX: 'auto',
                                            WebkitOverflowScrolling: 'touch',
                                            opacity: active ? 1 : 0.35,
                                            filter: active ? 'none' : 'grayscale(0.95)',
                                            transition: 'all 200ms ease'
                                        }}>
                                            <table style={{ borderCollapse: 'collapse', fontSize: '10px', width: 'auto', margin: '0 auto', fontFamily: 'var(--font-mono)' }}>
                                                <tbody>
                                                    <tr>
                                                        <th style={{ border: '1px solid var(--border-subtle)', padding: '4px 6px', textAlign: 'center', background: active ? accentColor : 'var(--border-strong)', color: '#09090B' }}></th>
                                                        {v.alphabet.split('').map(c => (
                                                            <th key={c} style={{ border: '1px solid var(--border-subtle)', padding: '4px 6px', textAlign: 'center', background: active ? accentColor : 'var(--border-strong)', color: '#09090B', fontWeight: 700 }}>
                                                                {c}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                    {v.table.map((row, rIdx) => (
                                                        <tr key={rIdx}>
                                                            <th style={{ border: '1px solid var(--border-subtle)', padding: '4px 6px', textAlign: 'center', background: active ? accentColor : 'var(--border-strong)', color: '#09090B', fontWeight: 700 }}>
                                                                {v.alphabet[rIdx]}
                                                            </th>
                                                            {row.map((c, cIdx) => (
                                                                <td key={cIdx} style={{ border: '1px solid var(--border-subtle)', padding: '3px 5px', textAlign: 'center', minWidth: '16px', fontSize: '9.5px', color: 'var(--text-default)' }}>
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
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Flag size={14} color={active ? accentColor : 'var(--text-dim)'} />
                                                <h3 style={{ fontSize: '11px', color: active ? accentColor : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontWeight: 700 }}>
                                                    CODE MARITIME & PAVILLONS NATO
                                                </h3>
                                            </div>
                                            <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'index_drapeaux' })} />
                                        </div>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '6px',
                                            opacity: active ? 1 : 0.35,
                                            filter: active ? 'none' : 'grayscale(0.95)',
                                            transition: 'all 200ms ease'
                                        }}>
                                            {Object.entries(ModuleLogic.getNATOAlphabet()).map(([char, word]) => (
                                                <div key={char} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', padding: '5px 7px', textAlign: 'center', minWidth: '48px' }}>
                                                    <span style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: active ? accentColor : 'var(--text-dim)' }}>{char.toUpperCase()}</span>
                                                    <span style={{ display: 'block', fontFamily: '"Maritime", "Courier New", monospace', fontSize: '26px', color: 'var(--text-default)', marginTop: '2px' }}>{char.toUpperCase()}</span>
                                                    <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-dim)', marginTop: '2px' }}>{word}</span>
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
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Shield size={14} color={active ? accentColor : 'var(--text-dim)'} />
                                                <h3 style={{ fontSize: '11px', color: active ? accentColor : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontWeight: 700 }}>
                                                    CROIX TEMPLIÈRE
                                                </h3>
                                            </div>
                                            <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'code_templier' })} />
                                        </div>
                                        <div style={{
                                            textAlign: 'center',
                                            overflowX: 'auto',
                                            opacity: active ? 1 : 0.35,
                                            filter: active ? 'none' : 'grayscale(0.95)',
                                            transition: 'all 200ms ease'
                                        }}>
                                            <img
                                                src="/assets/images/code_templier.jpg"
                                                alt="Code Templier"
                                                style={{ maxWidth: '100%', maxHeight: '320px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', objectFit: 'contain' }}
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
                                        background: 'transparent',
                                        border: 'none',
                                        boxShadow: 'none',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Scale size={14} color={active ? accentColor : 'var(--text-dim)'} />
                                                <h3 style={{ fontSize: '11px', color: active ? accentColor : 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0, fontWeight: 700 }}>
                                                    MÉTHODE AVOCAT (A = K / DÉCALAGE +10)
                                                </h3>
                                            </div>
                                            <AnnexeSwitch isChecked={active} onToggle={() => dispatch({ type: 'TOGGLE_ANNEXE', annexeId: 'methode_avocat' })} />
                                        </div>
                                        <div style={{
                                            background: 'transparent',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: 'var(--radius-xs)',
                                            padding: '10px',
                                            textAlign: 'center',
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '11.5px',
                                            opacity: active ? 1 : 0.35,
                                            filter: active ? 'none' : 'grayscale(0.95)',
                                            transition: 'all 200ms ease'
                                        }}>
                                            <div style={{ color: active ? accentColor : 'var(--text-dim)', fontWeight: 700, letterSpacing: '2px', marginBottom: '4px' }}>
                                                A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
                                            </div>
                                            <div style={{ color: 'var(--text-dim)', fontSize: '10px', marginBottom: '4px' }}>↓ décalage de 10 lettres (A devient K) ↓</div>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 700, letterSpacing: '2px' }}>
                                                K L M N O P Q R S T U V W X Y Z A B C D E F G H I J
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Floating Toolbar globale en HAUT du carnet (Alignée avec la barre de recherche des cartes, 40px) ── */}
            {/* Conteneur responsive : marge gauche 16px, barre prend tout l'espace, marge droite 16px + bouton maximize (~60px) */}
            <div
                id="textual-floating-bar-container"
                style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    right: onViewModeChange && !isMobile ? '88px' : '16px', // 16px marge + ~72px maximize+sync
                    zIndex: 1100,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start', // barre alignée à gauche, utilise toute la largeur
                }}
            >
                {selectedKeys.size > 1 ? (
                    <MultiSelectBatchBar
                        selectedCount={selectedKeys.size}
                        onBatchModule={handleBatchAssignModule}
                        onBatchLanguage={handleBatchAssignLanguage}
                        onDeselectAll={() => setSelectedKeys(new Set())}
                    />
                ) : (
                    <TextualHeader
                        onExport={onExport || (() => {})}
                    />
                )}
            </div>

            {/* BOUTON HAUT DROITE ALIGNÉ : SYNC STATUS + MAXIMIZE / MINIMIZE (DESKTOP SEULEMENT) */}
            {onViewModeChange && !isMobile && (
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '14px',
                    padding: '3px 4px',
                    boxShadow: 'none',
                    zIndex: 1100,
                    pointerEvents: 'all',
                }}>
                    <button
                        type="button"
                        onClick={() => onViewModeChange(viewMode === 'text' ? 'split' : 'text')}
                        title={viewMode === 'text' ? "Réduire le carnet (Mode partagé)" : "Agrandir le carnet (Plein écran)"}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            border: 'none',
                            background: viewMode === 'text' ? 'var(--accent-transparent)' : 'transparent',
                            color: viewMode === 'text' ? 'var(--accent-hover)' : 'var(--text-dim)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 120ms ease'
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
                            <Minimize2 size={16} strokeWidth={2.2} />
                        ) : (
                            <Maximize2 size={16} strokeWidth={2.2} />
                        )}
                    </button>
                </div>
            )}

            {/* ── BARRE FLOTTANTE BAS-DROITE : Solutions (ampoule) + Erreurs ── */}
            <div
                id="textual-bottom-bar"
                style={{
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    zIndex: 1100,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}
            >
                <TextualBottomBar
                    isSolution={isSolution}
                    onToggleSolution={() => dispatch({ type: 'SET_CARNET_VIEW', view: isSolution ? 'participant' : 'solution' })}
                />
            </div>

            {/* ── Palette de commandes slash (/) ── */}
            <SlashCommandPalette
                isOpen={slashPaletteOpen}
                onClose={() => setSlashPaletteOpen(false)}
                onInsertBlock={(blockType, config) => {
                    // Gérer l'insertion de blocs via la palette
                    const afterStepId = steps.length > 0 ? steps[steps.length - 1].id : '';
                    switch (blockType) {
                        case 'heading':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '# '.repeat(config?.level || 1) + ' ', manualType: 'html' });
                            break;
                        case 'paragraph':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '', manualType: 'html' });
                            break;
                        case 'bullet_list':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '- ', manualType: 'html' });
                            break;
                        case 'numbered_list':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '1. ', manualType: 'html' });
                            break;
                        case 'check_list':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '- [ ] ', manualType: 'html' });
                            break;
                        case 'blockquote':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '> ', manualType: 'html' });
                            break;
                        case 'divider':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '\n---\n', manualType: 'html' });
                            break;
                        case 'image':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '![]()', manualType: 'html' });
                            break;
                        case 'file':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '[Fichier]()', manualType: 'html' });
                            break;
                        case 'crypto_block':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '', manualType: 'code', moduleId: config?.cipher });
                            break;
                        case 'code_block':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '\n```\n\n```\n', manualType: 'html' });
                            break;
                        case 'annexe':
                            // Insérer une annexe
                            break;
                        case 'latex':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '$$\n\n$$\n', manualType: 'html' });
                            break;
                        case 'toc':
                            dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '[[TOC]]', manualType: 'html' });
                            break;
                    }
                }}
                onSearchReference={(query) => {
                    // Gérer la recherche de références
                    console.log('Search reference:', query);
                }}
                anchorRef={slashPaletteAnchorRef}
                triggerPosition={slashPaletteTrigger}
            />
        </div>
    );
}

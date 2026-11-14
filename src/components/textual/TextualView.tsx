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
import CarnetStepBlock from './CarnetStepBlock';
import CodeBlockPicker from './CodeBlockPicker';
import CarnetElevationBlock from './CarnetElevationBlock';
import StepInsertSeparator from './StepInsertSeparator';
import TextualHeader from './TextualHeader';
import { mapRef } from '../map/MapComponent';
import L from 'leaflet';
import type { ViewMode } from '../../App';
import {
    Compass, AlertTriangle, Sparkles, Binary,
    LayoutGrid, KeyRound, Flag, Shield, Scale, Table,
    CheckSquare, X, ChevronDown, Globe, Code2, SlidersHorizontal,
    Maximize2, Minimize2, FileText
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
                segIndices.forEach((segIdx, lIdx) => {
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
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedKeys.size]);

    // Garantir qu'au moins un bloc de commentaire titre existe par défaut si le carnet est vide
    useEffect(() => {
        if (steps.length === 0) {
            dispatch({
                type: 'INSERT_MANUAL_STEP_TYPED',
                afterStepId: '',
                content: '',
                manualType: 'html',
                isTitleStep: true
            });
        }
    }, [steps.length, dispatch]);

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

    const handlePoiToggle = useCallback((stepId: string, poiId: string) => {
        dispatch({ type: 'TOGGLE_POI', stepId, poiId });
    }, [dispatch]);

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
                        {/* ── Liste des étapes du carnet (jamais vide : commence par le titre) ── */}
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

                            {/* ── Marqueur d'arrivée final : badge carré + barre pleine arrondie ── */}
                            {steps.length > 0 && !steps[steps.length - 1].isManual && steps[steps.length - 1].toLabel && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    width: '100%',
                                    marginTop: '18px',
                                    marginBottom: '10px',
                                    userSelect: 'none'
                                }}>
                                    <div 
                                        title={`Arrivée : Étape ${steps[steps.length - 1].toLabel}`}
                                        style={{ 
                                            width: '22px',
                                            height: '22px', 
                                            borderRadius: '5px',
                                            background: 'var(--bg-base)', 
                                            border: `2px solid var(--semantic-green)`,
                                            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--semantic-green)',
                                            fontWeight: 800,
                                            fontSize: '11px',
                                            fontFamily: 'var(--font-mono)',
                                            flexShrink: 0
                                        }}
                                    >
                                        {steps[steps.length - 1].toLabel}
                                    </div>
                                    <div style={{
                                        flex: 1,
                                        height: '2px',
                                        borderRadius: '999px',
                                        background: 'var(--semantic-green)',
                                    }} />
                                </div>
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
            <div
                id="textual-floating-bar-container"
                style={{
                    position: 'absolute',
                    top: '16px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1100,
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    maxWidth: isMobile ? 'calc(100% - 24px)' : 'calc(100% - 100px)',
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

            {/* BOUTON HAUT DROITE ALIGNÉ : MAXIMIZE / MINIMIZE (DESKTOP SEULEMENT) */}
            {onViewModeChange && !isMobile && (
                <div style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
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
        </div>
    );
}

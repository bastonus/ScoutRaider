/**
 * CarnetStepBlock.tsx — Composant principal des blocs du carnet de route
 * Version modernisée avec :
 * - Menu contextuel unifié (3 points) pour tous types de blocs
 * - Rendu Markdown complet (HTML, LaTeX, polices, codes chiffrés)
 * - Aides à l'écriture (auto-complétion, raccourcis)
 * - Sélecteur de polices par bloc
 * - Palette de commandes slash (/)
 * - Double-clic pour éditer uniformisé
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { marked } from 'marked';
import {
    Eye, ChevronDown, Check, Trash2, Globe, Edit2, MessageSquarePlus, Code2,
    Ruler, Layers, Lock, Unlock, Compass, AlertTriangle, X, SlidersHorizontal,
    CheckSquare, MoreVertical, Lightbulb, Copy, MoveUp, MoveDown, Copy as DuplicateIcon,
    Link2, Flag, Info, Heading1, Heading2, Heading3, List, Quote, Image,
    FileText, Key, Sigma, Zap, Settings, Palette, ChevronRight, MapPin
} from 'lucide-react';

import type { CarnetStep, ModuleId, CarnetView, NavLanguage } from '../../logic/types';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import { useApp } from '../../AppContext';
import { PolygonalEngine } from '../../logic/PolygonalEngine';
import InlineEditor from './InlineEditor';
import MiniMap, { calculateZoomForScale, calculateScaleForZoom } from './MiniMap';
import UnifiedContextMenu from './UnifiedContextMenu';
import BlockGutter, { GUTTER_WIDTH } from './BlockGutter';
import { mapRef } from '../map/MapComponent';
import MarkdownRenderer, { FONT_PRESETS, CIPHER_FONTS, CIPHER_FONT_SIZES } from './MarkdownRenderer';
import WritingAids from './WritingAids';
import FontSelector from './FontSelector';

// ─── Constantes ────────────────────────────────────────────────────────────

const NAV_LANGUAGES = ['Horaire', 'Cardinaux', 'Azimut', 'Tournant'] as const;
const ALL_MODULES = Object.keys(MODULE_META) as ModuleId[];
const TEXTUAL_CIPHERS = ALL_MODULES.filter(id =>
    ['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis', 'texte_clair'].includes(id)
);

// ─── Types ────────────────────────────────────────────────────────────────

interface CarnetStepBlockProps {
    step: CarnetStep;
    stepIndex?: number;
    view: CarnetView;
    onModuleChange?: (stepId: string, moduleId: ModuleId) => void;
    onManualContentChange?: (stepId: string, text: string) => void;
    onRemoveStep?: (stepId: string) => void;
    onNavLanguageChange?: (stepId: string, lang?: NavLanguage) => void;
    onPoiToggle?: (stepId?: string, segIdx?: number, poiId?: string) => void;
    onLineClick?: (step: CarnetStep, segIdx?: number) => void;
    onAddInlineCode?: (segIdx: number) => void;
    selectedKeys?: Set<string>;
    onItemSelect?: (key: string, e: React.MouseEvent, segIdx?: number, stepId?: string) => void;
    stageLabelMap?: Map<string, string>;
    // Nouvelles props pour les fonctionnalités avancées
    onDuplicateStep?: (stepId: string) => void;
    onMoveStepUp?: (stepId: string) => void;
    onMoveStepDown?: (stepId: string) => void;
    onCopyStep?: (stepId: string) => void;
    onLinkReference?: (stepId: string) => void;
    onOpenFontSelector?: (stepId: string) => void;
    onOpenSettings?: (stepId: string) => void;
    blockFontConfigs?: Record<string, { baseFont?: string; headingFonts?: Record<number, string>; monoFont?: string }>;
    onStageClick?: (stageLabel: string) => void;
}

// ─── Configuration marked ─────────────────────────────────────────────────

marked.use({ gfm: true, breaks: true });

// ─── Composant principal ──────────────────────────────────────────────────

// ─── Helpers & Composant d'Étape Dédiée ───────────────────────────────────

export function getStageDotColor(stageLabel: string, stages: any[]): string {
    const stageIdx = stages.findIndex((st: any) => st.label === stageLabel);
    if (stageIdx === 0) return 'var(--semantic-green)';
    if (stageIdx === stages.length - 1 && stageIdx > 0) return 'var(--semantic-red)';
    return 'var(--accent-hover)';
}

/**
 * Bloc dédié à part entière pour une étape (A, B, C...)
 * Colonne latérale unifiée (26px + 12px) avec badge carré arrondi cliquable
 * Titre synthétique : pas de mention "Étape..." redondante
 */
export function StageHeaderBlock({
    stageLabel,
    stageName,
    dotColor,
    isFirst = false,
    isArrival = false,
    onStageClick
}: {
    stageLabel: string;
    stageName?: string;
    dotColor: string;
    isFirst?: boolean;
    isArrival?: boolean;
    onStageClick?: (stageLabel: string) => void;
}) {
    const { state } = useApp();
    const [hovered, setHovered] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Libellé synthétique : pas de "Étape X" redondant avec le badge
    const labelText = isArrival
        ? 'Arrivée'
        : stageName
            ? (isFirst ? `Départ — ${stageName}` : stageName)
            : (isFirst ? 'Départ' : '');

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onStageClick) {
            onStageClick(stageLabel);
        } else {
            const st = state.stages.find(s => s.label === stageLabel);
            if (st && st.coords && mapRef.current) {
                mapRef.current.flyTo(st.coords, Math.max(mapRef.current.getZoom(), 16), { duration: 0.8 });
            }
        }
    };

    return (
        <div
            className="carnet-stage-block"
            onClick={handleClick}
            onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setHovered(true); }}
            onMouseLeave={() => { hoverTimer.current = setTimeout(() => setHovered(false), 120); }}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as any); }}
            title={`Localiser l'étape ${stageLabel} sur la carte`}
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: '28px',
                marginTop: isFirst ? '6px' : (isArrival ? '24px' : '20px'),
                marginBottom: '8px',
                userSelect: 'none',
                width: '100%',
                cursor: 'pointer'
            }}
        >
            {/* Gutter unifié : 26px + 12px de marge pour alignement parfait */}
            <div
                style={{
                    width: '26px',
                    marginRight: '12px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {/* Badge carré arrondi (24x24px, borderRadius 6px) */}
                <div
                    style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        background: hovered ? `${dotColor}22` : 'var(--bg-base)',
                        border: `2px solid ${dotColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: dotColor,
                        fontFamily: 'var(--font-mono)',
                        boxShadow: hovered ? `0 0 8px ${dotColor}66` : '0 1px 3px rgba(0,0,0,0.2)',
                        transform: hovered ? 'scale(1.08)' : 'scale(1)',
                        transition: 'transform 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease'
                    }}
                >
                    {stageLabel}
                </div>
            </div>

            {/* Corps du bloc d'étape : Libellé synthétique + ligne séparatrice */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                {labelText && (
                    <span
                        style={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            color: hovered ? 'var(--text-primary)' : dotColor,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            fontFamily: 'var(--font-mono)',
                            whiteSpace: 'nowrap',
                            transition: 'color 0.15s ease'
                        }}
                    >
                        {labelText}
                    </span>
                )}
                <div
                    style={{
                        flex: 1,
                        height: '1.5px',
                        borderRadius: '999px',
                        background: dotColor,
                        opacity: hovered ? 0.8 : 0.5,
                        transition: 'opacity 0.15s ease'
                    }}
                />
            </div>
        </div>
    );
}

// ─── Composant Principal CarnetStepBlock ────────────────────────────────────

export default function CarnetStepBlock({
    step, stepIndex = 0, view, onModuleChange, onManualContentChange, onRemoveStep,
    onNavLanguageChange, onPoiToggle, onLineClick, onAddInlineCode,
    selectedKeys, onItemSelect, stageLabelMap,
    onDuplicateStep, onMoveStepUp, onMoveStepDown, onCopyStep,
    onLinkReference, onOpenFontSelector, onOpenSettings,
    blockFontConfigs = {},
    onStageClick
}: CarnetStepBlockProps) {
    const { state, dispatch } = useApp();
    const isSolution = view === 'solution';

    // Blocs manuels (HTML ou Code)
    if (step.isManual) {
        const lineKey = `step-${step.id}`;
        const isSelected = selectedKeys?.has(lineKey) || false;
        const lineLabel = stageLabelMap?.get(lineKey) || '';
        const stageObj = lineLabel ? state.stages.find(s => s.label === lineLabel) : null;
        const dotColor = lineLabel ? getStageDotColor(lineLabel, state.stages) : 'var(--accent-hover)';

        if (step.manualType === 'html') {
            return (
                <React.Fragment>
                    {lineLabel && (
                        <StageHeaderBlock
                            stageLabel={lineLabel}
                            stageName={stageObj?.address}
                            dotColor={dotColor}
                            isFirst={stepIndex === 0}
                            onStageClick={onStageClick}
                        />
                    )}
                    <ManualStepHtml
                        step={step}
                        stepIndex={stepIndex}
                        onManualContentChange={onManualContentChange}
                        onRemoveStep={onRemoveStep}
                        isSelected={isSelected}
                        onItemSelect={(e: React.MouseEvent) => onItemSelect?.(lineKey, e, undefined, step.id)}
                        fontConfig={blockFontConfigs[step.id]}
                        onDuplicate={onDuplicateStep}
                        onMoveUp={onMoveStepUp}
                        onMoveDown={onMoveStepDown}
                        onCopy={onCopyStep}
                        onLinkRef={onLinkReference}
                        onOpenFonts={onOpenFontSelector}
                        onOpenSettings={onOpenSettings}
                    />
                </React.Fragment>
            );
        }
        if (step.manualType === 'code') {
            return (
                <React.Fragment>
                    {lineLabel && (
                        <StageHeaderBlock
                            stageLabel={lineLabel}
                            stageName={stageObj?.address}
                            dotColor={dotColor}
                            isFirst={stepIndex === 0}
                            onStageClick={onStageClick}
                        />
                    )}
                    <ManualCodeBlock
                        step={step}
                        stepIndex={stepIndex}
                        onManualContentChange={onManualContentChange}
                        onRemoveStep={onRemoveStep}
                        isSolution={isSolution}
                        isSelected={isSelected}
                        onItemSelect={(e: React.MouseEvent) => onItemSelect?.(lineKey, e, undefined, step.id)}
                        onDuplicate={onDuplicateStep}
                        onMoveUp={onMoveStepUp}
                        onMoveDown={onMoveStepDown}
                        onCopy={onCopyStep}
                        onLinkRef={onLinkReference}
                        onOpenSettings={onOpenSettings}
                    />
                </React.Fragment>
            );
        }
    }

    // Blocs visuels (carte, gilwell, drapeaux)
    const isVisual = ['carte_ign', 'gilwell', 'drapeaux'].includes(step.moduleId);
    const hasMap = ['carte_ign', 'drapeaux'].includes(step.moduleId) && step.coords && step.coords.length > 0;
    const hasGilwell = step.moduleId === 'gilwell' && step.gilwellSvg;

    const encodedLines = (step.encodedText || '').split('\n').filter(Boolean);
    const solutionLines = (step.solutionText || '').split('\n').filter(Boolean);

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            {(() => {
                const getDangerLevel = (segIdx?: number) => {
                    if (segIdx === undefined) return null;
                    const seg = state.polygonal_steps[segIdx];
                    if (!seg) return null;

                    let legKey = seg.leg_key;
                    if (state.route_chain && state.polygonal_legs) {
                        let count = 0;
                        for (const lId of state.route_chain) {
                            const lSegs = state.polygonal_legs[lId];
                            if (lSegs) {
                                if (segIdx >= count && segIdx < count + lSegs.length) {
                                    legKey = lId;
                                    break;
                                }
                                count += lSegs.length;
                            }
                        }
                    }

                    if (!legKey) return null;
                    const route = state.routes.find((r: any) => r.id === legKey);
                    if (!route || !route.geojson) return null;

                    const allOriginalCoords = state.routes.flatMap((r: any) =>
                        r?.geojson?.geometry?.coordinates || r?.geojson?.coordinates || []
                    );

                    const startIdx = seg.properties?.start_idx || 0;
                    const endIdx = seg.properties?.point_idx || 0;

                    let startM = 0;
                    for (let i = 0; i < startIdx; i++) {
                        if (allOriginalCoords[i] && allOriginalCoords[i + 1]) {
                            startM += PolygonalEngine.calculateDistance(allOriginalCoords[i], allOriginalCoords[i + 1]);
                        }
                    }
                    let endM = startM;
                    for (let i = startIdx; i < endIdx; i++) {
                        if (allOriginalCoords[i] && allOriginalCoords[i + 1]) {
                            endM += PolygonalEngine.calculateDistance(allOriginalCoords[i], allOriginalCoords[i + 1]);
                        }
                    }

                    const props = route.geojson.properties || (route.geojson.type === 'Feature' ? route.geojson.properties : {});
                    const dangerIntervals = props?.danger_intervals || [];

                    if (dangerIntervals.length > 0) {
                        let maxDl: string | null = null;
                        const dlPriority: Record<string, number> = { 'extreme': 4, 'motorway_cross': 3, 'high': 2, 'minor': 1 };

                        for (const di of dangerIntervals) {
                            const intervalLength = di.end - di.start;
                            if (intervalLength < 30 && di.level !== 'extreme') continue;

                            const overlapStart = Math.max(startM, di.start);
                            const overlapEnd = Math.min(endM, di.end);

                            if (overlapStart < overlapEnd) {
                                if (!maxDl || dlPriority[di.level] > dlPriority[maxDl]) {
                                    maxDl = di.level;
                                }
                            }
                        }
                        if (maxDl) return maxDl;
                    }

                    if (props?.danger_level) return props.danger_level;
                    return null;
                };

                const linesToRender = isVisual ? [encodedLines[0] || ''] : encodedLines;

                return linesToRender.map((line: string, idx: number) => {
                    const segIdx = isVisual ? step.segmentIndices?.[0] : step.segmentIndices?.[idx];
                    const originalSeg = segIdx !== undefined ? state.polygonal_steps[segIdx] : null;
                    const distance = step.isManual ? 0 : (isVisual ? (step.distanceM ?? 0) : (originalSeg?.distance ?? 0));
                    const azimuth = step.isManual ? 0 : (originalSeg?.azimut ?? 0);

                    const lineKey = segIdx !== undefined ? `seg-${segIdx}` : `step-${step.id}`;
                    const isSelected = selectedKeys?.has(lineKey) || false;
                    const lineLabel = stageLabelMap ? (stageLabelMap.get(lineKey) || '') : (stepIndex === 0 && idx === 0 ? (state.stages[0]?.label || 'A') : '');
                    const stageObj = lineLabel ? state.stages.find(s => s.label === lineLabel) : null;
                    const dotColor = lineLabel ? getStageDotColor(lineLabel, state.stages) : 'var(--accent-hover)';

                    return (
                        <React.Fragment key={idx}>
                            {lineLabel && (
                                <StageHeaderBlock
                                    stageLabel={lineLabel}
                                    stageName={stageObj?.address}
                                    dotColor={dotColor}
                                    isFirst={stepIndex === 0 && idx === 0}
                                    onStageClick={onStageClick}
                                />
                            )}
                            <ComputedStepLine
                                step={step}
                                stepIndex={stepIndex}
                                lineIdx={idx}
                                segIdx={segIdx}
                                lineKey={lineKey}
                                isSelected={isSelected}
                                onItemSelect={(e: React.MouseEvent) => onItemSelect?.(lineKey, e, segIdx, step.id)}
                                encodedLine={line}
                                solutionLine={solutionLines[idx] || line}
                                distance={distance}
                                azimuth={azimuth}
                                isFirst={idx === 0}
                                isSolutionView={isSolution}
                                isVisual={isVisual}
                                dangerLevel={getDangerLevel(segIdx)}
                                navLanguage={segIdx !== undefined ? state.custom_languages?.[segIdx.toString()] : step.navLanguage}
                                pois={segIdx !== undefined ? state.segment_pois?.[segIdx.toString()] : step.pois}
                                onModuleChange={(mod: string) => {
                                    if (segIdx !== undefined) dispatch({ type: 'ASSIGN_MODULES_RANGE', startIdx: segIdx, endIdx: segIdx, moduleId: mod });
                                }}
                                onNavLanguageChange={(lang: any) => {
                                    if (segIdx !== undefined) dispatch({ type: 'SET_NAV_LANGUAGE', segIdx, lang });
                                }}
                                onLineClick={() => onLineClick?.(step, segIdx)}
                                onPoiToggle={(poiId: string) => {
                                    if (segIdx !== undefined) dispatch({ type: 'TOGGLE_POI', segIdx, poiId });
                                }}
                                onDuplicate={onDuplicateStep}
                                onMoveUp={onMoveStepUp}
                                onMoveDown={onMoveStepDown}
                                onCopy={onCopyStep}
                                onLinkRef={onLinkReference}
                                onOpenSettings={onOpenSettings}
                            />
                            {step.inlineManualSteps && segIdx !== undefined && step.inlineManualSteps[segIdx] && (
                                step.inlineManualSteps[segIdx].manualType === 'html' ? (
                                    <ManualStepHtml
                                        step={step.inlineManualSteps[segIdx]}
                                        onManualContentChange={onManualContentChange}
                                        onRemoveStep={onRemoveStep}
                                        fontConfig={blockFontConfigs[step.inlineManualSteps[segIdx].id]}
                                        onDuplicate={onDuplicateStep}
                                        onMoveUp={onMoveStepUp}
                                        onMoveDown={onMoveStepDown}
                                        onCopy={onCopyStep}
                                        onLinkRef={onLinkReference}
                                        onOpenFonts={onOpenFontSelector}
                                        onOpenSettings={onOpenSettings}
                                    />
                                ) : (
                                    <ManualCodeBlock
                                        step={step.inlineManualSteps[segIdx]}
                                        onManualContentChange={onManualContentChange}
                                        onRemoveStep={onRemoveStep}
                                        isSolution={isSolution}
                                        onDuplicate={onDuplicateStep}
                                        onMoveUp={onMoveStepUp}
                                        onMoveDown={onMoveStepDown}
                                        onCopy={onCopyStep}
                                        onLinkRef={onLinkReference}
                                        onOpenSettings={onOpenSettings}
                                    />
                                )
                            )}
                        </React.Fragment>
                    );
                });
            })()}
        </div>
    );
}

// ─── ManualStepHtml — Bloc commentaire Markdown (style épuré comme les blocs code) ──────────────

interface ManualStepHtmlProps {
    step: CarnetStep;
    stepIndex?: number;
    onManualContentChange?: (stepId: string, text: string) => void;
    onRemoveStep?: (stepId: string) => void;
    isSelected?: boolean;
    onItemSelect?: (e: React.MouseEvent) => void;
    fontConfig?: { baseFont?: string; headingFonts?: Record<number, string>; monoFont?: string };
    onDuplicate?: (stepId: string) => void;
    onMoveUp?: (stepId: string) => void;
    onMoveDown?: (stepId: string) => void;
    onCopy?: (stepId: string) => void;
    onLinkRef?: (stepId: string) => void;
    onOpenFonts?: (stepId: string) => void;
    onOpenSettings?: (stepId: string) => void;
}

function ManualStepHtml({
    step, stepIndex = 0, onManualContentChange, onRemoveStep, isSelected,
    onItemSelect, fontConfig, onDuplicate, onMoveUp, onMoveDown,
    onCopy, onLinkRef, onOpenFonts, onOpenSettings
}: ManualStepHtmlProps) {
    const { dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(step.solutionText || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastTapRef = useRef(0);

    const rawContent: string = step.solutionText || '';
    const isEmpty = !rawContent || rawContent === '<p>&nbsp;</p>' || rawContent.trim() === '' || rawContent === '<p></p>';

    // Sync editValue when step changes externally
    useEffect(() => {
        if (!isEditing) setEditValue(step.solutionText || '');
    }, [step.solutionText, isEditing]);

    const startEditing = () => {
        setEditValue(step.solutionText || '');
        setIsEditing(true);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleValidate = () => {
        onManualContentChange?.(step.id, editValue);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleValidate();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            setEditValue(step.solutionText || '');
            setIsEditing(false);
        }
    };

    const handleTextareaInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const t = e.currentTarget;
        t.style.height = 'auto';
        t.style.height = `${t.scrollHeight}px`;
        setEditValue(t.value);
    };

    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const touchTimerRef = useRef<any>(null);

    // Clic droit = ouverture menu contextuel à la position du curseur
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    };

    // Appui long tactile (500ms) = menu contextuel sur mobile
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            touchTimerRef.current = setTimeout(() => {
                setContextMenuPos({ x, y });
            }, 500);
        }
    };

    const handleTouchMove = () => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    };

    // Mobile double-tap → enter edit mode
    const handleTouchEnd = () => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            startEditing();
        }
        lastTapRef.current = now;
    };

    const blockRef = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={blockRef}
            id={`carnet-step-${step.id}`}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                position: 'relative',
                minHeight: '36px',
                padding: '4px 0',
                zIndex: hovered || isEditing ? 50 : 1
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { if (!isEditing) setHovered(false); }}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
        >
            {/* Gutter unifié : indicateur + menu contextuel */}
            <BlockGutter
                blockType="html"
                blockData={step}
                isTitle={false}
                isSelected={false}
                isHovered={hovered || isEditing}
                contextMenuPos={contextMenuPos}
                onOpenContextMenu={pos => setContextMenuPos(pos)}
                onCloseContextMenu={() => setContextMenuPos(null)}
                onEdit={startEditing}
                onDelete={() => onRemoveStep?.(step.id)}
                onDuplicate={onDuplicate ? () => onDuplicate(step.id) : undefined}
                onMoveUp={onMoveUp ? () => onMoveUp(step.id) : undefined}
                onMoveDown={onMoveDown ? () => onMoveDown(step.id) : undefined}
                onCopy={onCopy ? () => onCopy(step.id) : undefined}
                onLinkRef={onLinkRef ? () => onLinkRef(step.id) : undefined}
                onConvertToCode={(cipher) => {
                    dispatch({
                        type: 'CONVERT_MANUAL_STEP_TYPE',
                        stepId: step.id,
                        targetType: 'code',
                        moduleId: cipher,
                    });
                }}
                onOpenFonts={onOpenFonts ? () => onOpenFonts(step.id) : undefined}
                onOpenSettings={onOpenSettings ? () => onOpenSettings(step.id) : undefined}
                containerRef={blockRef}
            />

            {/* Contenu - STYLE ÉPURÉ SANS CONTEUR NI FOND */}
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                {isEditing ? (
                    /* ── Mode édition : textarea simple + coche verte ── */
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                        <textarea
                            ref={textareaRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onInput={handleTextareaInput}
                            rows={1}
                            placeholder="Écrivez en Markdown… (# titre, **gras**, *italique*, $latex$, ```code```, [morse]...[/morse])"
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1.5px solid var(--accent-default)',
                                borderRadius: 0,
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                fontWeight: 400,
                                fontFamily: 'var(--font-ui)',
                                lineHeight: 1.5,
                                padding: '2px 4px',
                                resize: 'none',
                                outline: 'none',
                                boxSizing: 'border-box',
                                overflow: 'hidden'
                            }}
                        />
                        {/* Coche verte — même style que InlineEditor et blocs code ── */}
                        <button
                            type="button"
                            onClick={handleValidate}
                            title="Valider (Ctrl+Entrée)"
                            style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: 'var(--semantic-success)',
                                border: 'none', color: '#09090B',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', flexShrink: 0,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                transition: 'transform 100ms ease',
                                marginTop: '2px',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                            <Check size={13} strokeWidth={3} />
                        </button>
                    </div>
                ) : (
                    /* ── Mode vue : rendu Markdown pur SANS fond ni contour ── */
                    <div
                        onDoubleClick={startEditing}
                        onTouchEnd={handleTouchEnd}
                        title="Double-cliquer pour éditer"
                        style={{
                            cursor: 'text',
                            minHeight: '24px',
                        }}
                    >
                        {isEmpty && (
                            <div style={{
                                color: 'rgba(255,255,255,0.28)',
                                fontSize: '13px',
                                fontWeight: 400,
                                fontStyle: 'italic',
                                paddingTop: '4px',
                                letterSpacing: 'normal',
                            }}>
                                {'Écrivez en Markdown… (# titre, **gras**, *italique*, $latex$, ```code```, [morse]...[/morse])'}
                            </div>
                        )}
                        <MarkdownRenderer
                            content={rawContent}
                            fontConfig={fontConfig}
                            viewMode="participant"
                            onChange={startEditing}
                            blockId={step.id}
                            className="manual-html-view ck-content"
                            style={{
                                fontSize: '13px',
                                fontWeight: 400,
                                color: 'var(--text-primary)',
                                lineHeight: 1.6,
                                padding: '2px 0',
                                minHeight: '24px',
                                outline: 'none',
                                wordBreak: 'break-word',
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── ManualCodeBlock — Bloc code chiffré manuel ───────────────────────────

interface ManualCodeBlockProps {
    step: CarnetStep;
    stepIndex?: number;
    onManualContentChange?: (stepId: string, text: string) => void;
    onRemoveStep?: (stepId: string) => void;
    isSolution: boolean;
    isSelected?: boolean;
    onItemSelect?: (e: React.MouseEvent) => void;
    onDuplicate?: (stepId: string) => void;
    onMoveUp?: (stepId: string) => void;
    onMoveDown?: (stepId: string) => void;
    onCopy?: (stepId: string) => void;
    onLinkRef?: (stepId: string) => void;
    onOpenSettings?: (stepId: string) => void;
}

function ManualCodeBlock({
    step, stepIndex = 0, onManualContentChange, onRemoveStep, isSolution,
    isSelected, onItemSelect, onDuplicate, onMoveUp, onMoveDown,
    onCopy, onLinkRef, onOpenSettings
}: ManualCodeBlockProps) {
    const { dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = CIPHER_FONTS[step.moduleId] || 'monospace';
    const fontSize = CIPHER_FONT_SIZES[step.moduleId] || '14px';

    const isActuallyEncoded = step.moduleId !== 'texte_clair' && !!step.encodedText && step.encodedText !== step.solutionText;
    const displayText = isActuallyEncoded
        ? (isSolution ? (step.solutionText || '') : (step.encodedText || step.solutionText || ''))
        : (step.solutionText || step.encodedText || '');
    const isEncoded = !isSolution && isActuallyEncoded;

    const handleConvertToComment = () => {
        dispatch({
            type: 'CONVERT_MANUAL_STEP_TYPE',
            stepId: step.id,
            targetType: 'html',
        });
    };

    const handleSwitchModule = (mId: ModuleId) => {
        dispatch({
            type: 'MANUAL_MODULE_ASSIGNMENT',
            stepId: step.id,
            moduleId: mId,
        });
    };

    const blockRef = useRef<HTMLDivElement>(null);
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const touchTimerRef = useRef<any>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            touchTimerRef.current = setTimeout(() => {
                setContextMenuPos({ x, y });
            }, 500);
        }
    };

    const handleTouchEnd = () => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    };

    return (
        <div
            ref={blockRef}
            id={`carnet-step-${step.id}`}
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                position: 'relative',
                minHeight: '44px',
                padding: '4px 0',
                zIndex: hovered ? 50 : 1
            }}
            onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setHovered(true); }}
            onMouseLeave={() => { hoverTimer.current = setTimeout(() => setHovered(false), 120); }}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
        >
            {/* Gutter unifié : indicateur + menu contextuel */}
            <BlockGutter
                blockType="code"
                blockData={step}
                moduleId={step.moduleId}
                isSelected={isSelected}
                isHovered={hovered}
                contextMenuPos={contextMenuPos}
                onOpenContextMenu={pos => setContextMenuPos(pos)}
                onCloseContextMenu={() => setContextMenuPos(null)}
                onEdit={() => {}} // Double-clic géré par le textarea
                onDelete={() => onRemoveStep?.(step.id)}
                onDuplicate={() => onDuplicate?.(step.id)}
                onMoveUp={() => onMoveUp?.(step.id)}
                onMoveDown={() => onMoveDown?.(step.id)}
                onCopy={() => onCopy?.(step.id)}
                onLinkRef={() => onLinkRef?.(step.id)}
                onChangeCipher={handleSwitchModule}
                onConvertToHtml={handleConvertToComment}
                onOpenSettings={() => onOpenSettings?.(step.id)}
                hasSolution={isActuallyEncoded}
                isSolutionView={isSolution}
                containerRef={blockRef}
            />

            {/* Contenu éditable */}
            <div style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none' }}>
                <textarea
                    value={step.solutionText || ''}
                    onChange={e => onManualContentChange?.(step.id, e.target.value)}
                    placeholder="Tapez le texte à encoder…"
                    style={{
                        width: '100%', background: 'var(--bg-base)',
                        border: `1px solid ${hovered ? accentColor + '60' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-xs)', color: 'var(--text-primary)', fontSize: '12px',
                        fontFamily: 'var(--font-ui)', lineHeight: 1.5,
                        padding: '6px 8px', resize: 'none', outline: 'none',
                        boxSizing: 'border-box', minHeight: '36px',
                        transition: 'border-color 0.15s', overflow: 'hidden',
                    }}
                    rows={1}
                    onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                />
                {/* Aperçu encodé */}
                {isEncoded && (
                    <div style={{
                        marginTop: '4px', padding: '5px 8px',
                        background: `${accentColor}10`, borderRadius: 'var(--radius-xs)',
                        border: `1px solid ${accentColor}30`,
                        fontFamily: font, fontSize: fontSize, color: accentColor,
                        lineHeight: 1.6, wordBreak: 'break-all',
                    }}>
                        {displayText}
                    </div>
                )}
                {(hovered || isSolution) && isActuallyEncoded && step.solutionText && (
                    <div style={{
                        marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px',
                        fontSize: '11px', color: 'var(--semantic-green)', fontWeight: 600,
                    }}>
                        <Lightbulb size={11} strokeWidth={2.4} color="var(--semantic-green)" style={{ flexShrink: 0 }} />
                        <span>Solution : {step.solutionText}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── ComputedStepLine — Ligne d'étape calculée (depuis l'itinéraire) ──────

interface ComputedStepLineProps {
    step: CarnetStep;
    stepIndex?: number;
    lineIdx: number;
    segIdx?: number;
    lineKey: string;
    isSelected: boolean;
    onItemSelect?: (e: React.MouseEvent) => void;
    encodedLine: string;
    solutionLine: string;
    distance: number;
    azimuth: number;
    isFirst: boolean;
    isSolutionView: boolean;
    isVisual: boolean;
    dangerLevel: string | null;
    navLanguage?: NavLanguage;
    pois?: Array<{ id: string; name: string; selected: boolean }>;
    onModuleChange?: (mod: string) => void;
    onNavLanguageChange?: (lang?: NavLanguage) => void;
    onLineClick?: () => void;
    onPoiToggle?: (poiId: string) => void;
    onDuplicate?: (stepId: string) => void;
    onMoveUp?: (stepId: string) => void;
    onMoveDown?: (stepId: string) => void;
    onCopy?: (stepId: string) => void;
    onLinkRef?: (stepId: string) => void;
    onOpenSettings?: (stepId: string) => void;
}

function ComputedStepLine({
    step, stepIndex = 0, lineIdx, segIdx, lineKey, isSelected, onItemSelect,
    encodedLine, solutionLine, distance, azimuth, isFirst, isSolutionView, isVisual,
    dangerLevel, navLanguage, pois, onModuleChange, onNavLanguageChange,
    onLineClick, onPoiToggle, onDuplicate, onMoveUp, onMoveDown, onCopy,
    onLinkRef, onOpenSettings
}: ComputedStepLineProps) {
    const { state, dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hasMap = ['carte_ign', 'drapeaux'].includes(step.moduleId) && step.coords && step.coords.length > 0;
    const hasGilwell = step.moduleId === 'gilwell' && step.gilwellSvg;

    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = CIPHER_FONTS[step.moduleId] || 'monospace';
    const fontSize = CIPHER_FONT_SIZES[step.moduleId] || '14px';

    const isActuallyEncoded = !isVisual && step.moduleId !== 'texte_clair' && encodedLine !== solutionLine;

    let dangerColor: string | undefined;
    if (dangerLevel === 'extreme' || dangerLevel === 'motorway_cross') dangerColor = '#ef4444';
    else if (dangerLevel === 'high') dangerColor = '#f97316';
    else if (dangerLevel === 'minor') dangerColor = '#eab308';

    // Double clic pour éditer
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isVisual) {
            setIsEditing(true);
        }
    };

    const handleLineClickInternal = (e: React.MouseEvent) => {
        if (onItemSelect) onItemSelect(e);
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && onLineClick) onLineClick();
    };

    // Référence pour le bloc
    const blockRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const touchTimerRef = useRef<any>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const x = touch.clientX;
            const y = touch.clientY;
            touchTimerRef.current = setTimeout(() => {
                setContextMenuPos({ x, y });
            }, 500);
        }
    };

    const handleTouchEnd = () => {
        if (touchTimerRef.current) {
            clearTimeout(touchTimerRef.current);
            touchTimerRef.current = null;
        }
    };

    return (
        <div
            ref={blockRef}
            id={`carnet-step-${step.id}-${lineIdx}`}
            className="carnet-step-row"
            style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'flex-start',
                position: 'relative',
                minHeight: '28px',
                padding: '3px 0',
                zIndex: hovered ? 150 : 1,
                borderRadius: '6px',
                transition: 'box-shadow 0.25s ease, background-color 0.2s ease',
            }}
            onMouseEnter={() => { if (hoverTimer.current) clearTimeout(hoverTimer.current); setHovered(true); }}
            onMouseLeave={() => { hoverTimer.current = setTimeout(() => setHovered(false), 120); }}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
        >
            {/* Gutter unifié : indicateur + menu contextuel */}
            <BlockGutter
                blockType={isVisual ? (hasMap ? 'map' : 'generic') : 'computed'}
                blockData={step}
                moduleId={step.moduleId}
                isSelected={isSelected}
                isHovered={hovered || isEditing}
                isComputedBlock={true}
                contextMenuPos={contextMenuPos}
                onOpenContextMenu={pos => setContextMenuPos(pos)}
                onCloseContextMenu={() => setContextMenuPos(null)}
                onEdit={() => setIsEditing(true)}
                onDuplicate={() => onDuplicate?.(step.id)}
                onMoveUp={() => onMoveUp?.(step.id)}
                onMoveDown={() => onMoveDown?.(step.id)}
                onCopy={() => onCopy?.(step.id)}
                onLinkRef={() => onLinkRef?.(lineKey)}
                onChangeCipher={(cipher) => onModuleChange?.(cipher)}
                onChangeLanguage={(lang) => onNavLanguageChange?.(lang as NavLanguage)}
                onTogglePOI={(poiId) => onPoiToggle?.(poiId)}
                onToggleSolution={() => dispatch({ type: 'SET_CARNET_VIEW', view: isSolutionView ? 'participant' : 'solution' })}
                onLockToggle={() => {
                    if (hasMap && step.mapPersist) {
                        dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, isLocked: !step.mapPersist.isLocked });
                    }
                }}
                onOpenSettings={() => onOpenSettings?.(step.id)}
                isLocked={step.mapPersist?.isLocked}
                isSolutionView={isSolutionView}
                hasSolution={isActuallyEncoded}
                navLanguage={navLanguage}
                pois={pois}
                containerRef={blockRef}
            />

            {/* Corps du texte */}
            <div style={{
                flex: 1, minWidth: 0, position: 'relative',
                background: isSelected ? 'rgba(37, 99, 235, 0.08)' : (hovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent'),
                border: isSelected ? '1px solid var(--accent-default)' : '1px solid transparent',
                borderRadius: '6px', padding: '2px 4px', boxSizing: 'border-box',
                transition: 'background-color 120ms ease, border-color 120ms ease',
                display: 'flex', flexDirection: 'column', gap: '4px'
            }}>

                <div style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px'
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                        <InlineEditor stepId={step.id} solutionText={solutionLine} moduleId={step.moduleId} lineIdx={lineIdx} onClose={() => setIsEditing(false)} />
                    ) : !isVisual ? (
                        <div style={{ cursor: 'pointer' }} onClick={handleLineClickInternal}>
                            {isActuallyEncoded ? (
                                <>
                                    {/* Code chiffré */}
                                    <div style={{ fontFamily: font, fontSize: fontSize, color: dangerColor || 'var(--text-primary)', fontWeight: dangerColor ? 700 : 'normal', wordBreak: 'break-all', letterSpacing: step.moduleId === 'morse' ? '2px' : '0.02em', lineHeight: 1.4 }}>
                                        <HighlightedText text={encodedLine} pois={pois} isEncoded={true} sourceLine={solutionLine} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />
                                    </div>
                                    {/* Ligne de solution affichée en colonne sous le code chiffré (au survol ou mode solution) */}
                                    {(hovered || isSolutionView) && (
                                        <div style={{ fontSize: '11px', color: dangerColor || 'var(--semantic-green)', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Lightbulb size={11} strokeWidth={2.4} color={dangerColor || 'var(--semantic-green)'} style={{ flexShrink: 0 }} />
                                            <HighlightedText text={solutionLine} pois={pois} isEncoded={false} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />
                                        </div>
                                    )}
                                </>
                            ) : (
                                /* Texte déjà en clair : DEMEURE STRICTEMENT INCHANGÉ, pas de colonne, pas de vert, pas d'ampoule */
                                /* NB: MarkdownRenderer NE doit PAS être utilisé ici — les lignes calculées par l'itinéraire sont du texte brut,
                                   non du markdown. MarkdownRenderer génère des placeholders internes (CIPHER_xxx_0) qui fuient dans l'affichage. */
                                <div style={{ fontSize: '13px', color: dangerColor || 'var(--text-primary)', fontWeight: dangerColor ? 700 : 'normal', lineHeight: 1.5 }}>
                                    <HighlightedText text={encodedLine || solutionLine} pois={pois} isEncoded={false} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ cursor: 'pointer' }} onClick={handleLineClickInternal}>
                            {hasGilwell && <div dangerouslySetInnerHTML={{ __html: step.gilwellSvg! }} style={{ marginBottom: '10px', textAlign: 'left' }} />}
                            {hasMap && isFirst && (
                                <MiniMap stepId={step.id} moduleId={step.moduleId} coords={step.coords} initialPersist={step.mapPersist} />
                            )}
                            {(hovered || isSolutionView) && step.moduleId !== 'texte_clair' && !hasMap && solutionLine && (
                                <div style={{ fontSize: '11.5px', color: 'var(--semantic-green)', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Lightbulb size={12} strokeWidth={2.4} color="var(--semantic-green)" style={{ flexShrink: 0 }} />
                                    <HighlightedText text={solutionLine} pois={pois} isEncoded={false} onPoiToggle={onPoiToggle} />
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
        </div>
    );

}

// ─── HighlightedText — Mise en évidence syntaxique (POI, distances, azimuths) ───
// Fonctionne même sur texte encodé (isEncoded=true) : on repère les patterns dans le texte
// source (solutionLine) et on colorie les tokens correspondants dans l'encodedLine via les indices.

// Helpers azimut
function azimutToDegres(text: string): number | null {
    const degMatch = text.match(/(\d+)\s*°/);
    if (degMatch) return parseInt(degMatch[1], 10);
    const dirs: Record<string, number> = {
        'Nord': 0, 'Est': 90, 'Sud': 180, 'Ouest': 270,
        'Nord-Est': 45, 'Sud-Est': 135, 'Sud-Ouest': 225, 'Nord-Ouest': 315,
        'Nord-Nord-Est': 22, 'Est-Nord-Est': 67, 'Est-Sud-Est': 112, 'Sud-Sud-Est': 157,
        'Sud-Sud-Ouest': 202, 'Ouest-Sud-Ouest': 247, 'Ouest-Nord-Ouest': 292, 'Nord-Nord-Ouest': 337,
    };
    for (const [k, v] of Object.entries(dirs)) {
        if (text.toLowerCase().includes(k.toLowerCase())) return v;
    }
    const heureMatch = text.match(/(\d+)\s*heure/);
    if (heureMatch) return ((parseInt(heureMatch[1], 10) % 12) / 12) * 360;
    if (/tout droit|12h/i.test(text)) return 0; // relatif
    if (/à droite/i.test(text)) return 90;
    if (/à gauche/i.test(text)) return 270;
    if (/demi.tour/i.test(text)) return 180;
    return null;
}

function degreesToHoraire(deg: number): string {
    const h = Math.round((deg / 360) * 12) % 12 || 12;
    return `${h}h`;
}
function degreesToCardinal(deg: number): string {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    return dirs[Math.round(deg / 22.5) % 16];
}

// Popover azimut — supprimé, intégré directement dans AzimutToken

// Token azimut — badge déroulant style POI avec fond bleu + flèche
// Permet de choisir le format de direction (Tournant / Horaire / Cardinaux / Azimut)
function AzimutToken({ children, navLanguage, onNavLanguageChange }: {
    children: string;
    navLanguage?: NavLanguage;
    onNavLanguageChange?: (lang: NavLanguage) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    const deg = azimutToDegres(children);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    // 4 formats de navigation — le format actif est mis en évidence
    const navOptions: { lang: NavLanguage; label: string; desc: string; example: string }[] = [
        {
            lang: 'Tournant',
            label: 'Tournant',
            desc: 'tout droit / à droite…',
            example: deg !== null ? (deg < 22 || deg > 338 ? 'tout droit' : deg < 112 ? 'à droite' : deg < 248 ? 'demi-tour' : 'à gauche') : 'tournant',
        },
        {
            lang: 'Horaire',
            label: 'Horaire',
            desc: '12h / 3h / 9h…',
            example: deg !== null ? degreesToHoraire(deg) : '—',
        },
        {
            lang: 'Cardinaux',
            label: 'Cardinaux',
            desc: 'N / NE / SO…',
            example: deg !== null ? degreesToCardinal(deg) : '—',
        },
        {
            lang: 'Azimut',
            label: 'Azimut',
            desc: 'en degrés (0–360°)',
            example: deg !== null ? `${deg}°` : '—',
        },
    ];

    const rect = ref.current?.getBoundingClientRect();

    return (
        <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <span
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)',
                    borderRadius: '5px', padding: '1px 5px 1px 6px',
                    color: '#60a5fa', fontWeight: 700, fontSize: 'inherit',
                    cursor: 'pointer', userSelect: 'none',
                    transition: 'background 80ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(96,165,250,0.15)')}
                title="Cliquer pour changer le format de direction"
            >
                {children}
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, marginLeft: '1px' }}>
                    <path d="M1.5 3L4 5.5L6.5 3" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
            {open && rect && (
                <div onMouseDown={e => e.stopPropagation()} style={{
                    position: 'fixed', left: rect.left, top: rect.bottom + 4, zIndex: 99999,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                    borderRadius: '8px', padding: '5px', boxShadow: 'var(--shadow-lg)',
                    minWidth: '190px',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    animation: 'popIn 100ms ease-out',
                }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 4px 4px' }}>Format de direction</div>
                    {navOptions.map(opt => {
                        const isCurrent = navLanguage === opt.lang;
                        return (
                            <button key={opt.lang} type="button"
                                onClick={() => { onNavLanguageChange?.(opt.lang); setOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '5px 7px', borderRadius: '6px', border: 'none',
                                    background: isCurrent ? 'rgba(96,165,250,0.15)' : 'transparent',
                                    cursor: onNavLanguageChange ? 'pointer' : 'default',
                                    width: '100%', textAlign: 'left', gap: '8px',
                                    transition: 'background 70ms ease',
                                }}
                                onMouseEnter={e => { if (!isCurrent && onNavLanguageChange) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '11px', color: isCurrent ? '#60a5fa' : 'var(--text-primary)', fontWeight: isCurrent ? 700 : 500 }}>{opt.label}</span>
                                    <span style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 400 }}>{opt.desc}</span>
                                </div>
                                <span style={{
                                    background: 'rgba(96,165,250,0.15)', border: `1px solid ${isCurrent ? 'rgba(96,165,250,0.6)' : 'rgba(96,165,250,0.3)'}`,
                                    borderRadius: '5px', padding: '2px 7px',
                                    fontSize: '11px', color: '#60a5fa', fontWeight: 700,
                                    fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                }}>{opt.example}</span>
                                {isCurrent && <Check size={11} color="#60a5fa" style={{ flexShrink: 0 }} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </span>
    );
}

// Token POI — badge avec fond coloré + flèche déroulante
function PoiToken({ pois, onPoiToggle }: { pois: Array<{ id: string; name: string; selected: boolean; type?: string }>; onPoiToggle?: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    const selectedPoi = pois.find(p => p.selected);
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);
    const handleSelect = (id: string) => {
        // Désélectionner l'actuel si différent, puis sélectionner le nouveau
        if (selectedPoi && selectedPoi.id !== id) onPoiToggle?.(selectedPoi.id);
        onPoiToggle?.(id);
        setOpen(false);
    };
    const rect = ref.current?.getBoundingClientRect();
    return (
        <span ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <span
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                    background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.45)',
                    borderRadius: '5px', padding: '1px 5px 1px 6px',
                    color: '#fbbf24', fontWeight: 700, fontSize: 'inherit',
                    cursor: 'pointer', userSelect: 'none',
                    transition: 'background 80ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.28)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.18)')}
                title={selectedPoi ? `POI : ${selectedPoi.name}` : 'Choisir un point d\'intérêt'}
            >
                {selectedPoi ? selectedPoi.name : '…'}
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, marginLeft: '1px' }}>
                    <path d="M1.5 3L4 5.5L6.5 3" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
            {open && rect && (
                <div onMouseDown={e => e.stopPropagation()} style={{
                    position: 'fixed', left: rect.left, top: rect.bottom + 4, zIndex: 99999,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
                    borderRadius: '8px', padding: '5px', boxShadow: 'var(--shadow-lg)',
                    minWidth: '160px', maxHeight: '220px', overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: '2px',
                    animation: 'popIn 100ms ease-out',
                }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 4px 4px' }}>Points d'intérêt</div>
                    {pois.map(poi => (
                        <button key={poi.id} type="button" onClick={() => handleSelect(poi.id)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '5px 7px', borderRadius: '6px', border: 'none',
                            background: poi.selected ? 'rgba(251,191,36,0.15)' : 'transparent',
                            color: poi.selected ? '#fbbf24' : 'var(--text-primary)',
                            fontSize: '11px', fontWeight: poi.selected ? 700 : 400,
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'background 70ms ease',
                        }}
                            onMouseEnter={e => { if (!poi.selected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { if (!poi.selected) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <MapPin size={10} color={poi.selected ? '#fbbf24' : 'var(--text-dim)'} />
                            {poi.name}
                            {poi.selected && <Check size={10} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
                        </button>
                    ))}
                    {pois.length === 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', padding: '5px 7px' }}>Aucun POI disponible</div>
                    )}
                </div>
            )}
        </span>
    );
}

interface HighlightedTextProps {
    text: string;
    pois?: Array<{ id: string; name: string; selected: boolean; type?: string }>;
    isEncoded: boolean;
    /** Pour le texte encodé, le texte source (non encodé) pour situer les patterns */
    sourceLine?: string;
    onPoiToggle?: (poiId: string) => void;
    navLanguage?: NavLanguage;
    onNavLanguageChange?: (lang: NavLanguage) => void;
}

const HighlightedText = ({ text, pois, isEncoded, sourceLine, onPoiToggle, navLanguage, onNavLanguageChange }: HighlightedTextProps) => {
    if (!text) return null;

    // Pattern pour balises personnalisées : [morse]...[/morse], etc.
    const customTagRegex = /(\[(morse|templier|maritime|code)\]([\s\S]*?)\[\/\2\]|<(morse|templier|maritime|code)>([\s\S]*?)<\/\4>)/gi;

    if (customTagRegex.test(text)) {
        const segments: React.ReactNode[] = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;
        customTagRegex.lastIndex = 0;

        while ((match = customTagRegex.exec(text)) !== null) {
            const before = text.substring(lastIndex, match.index);
            if (before) {
                segments.push(<HighlightedTextCore key={`before-${lastIndex}`} text={before} pois={pois} isEncoded={isEncoded} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />);
            }

            const tagName = (match[2] || match[4] || '').toLowerCase();
            const innerText = match[3] !== undefined ? match[3] : match[5];

            let className = '';
            let style: React.CSSProperties = {};
            if (tagName === 'morse') {
                className = 'font-morse';
                style = { fontFamily: 'Morse', fontSize: '1.2em', letterSpacing: '0.12em', display: 'inline-block' };
            } else if (tagName === 'templier') {
                className = 'font-templier';
                style = { fontFamily: 'TemplarsCipherPlus', fontSize: '1.25em', letterSpacing: '0.08em', display: 'inline-block' };
            } else if (tagName === 'maritime') {
                className = 'font-maritime';
                style = { fontFamily: 'Maritime', fontSize: '1.3em', letterSpacing: '0.08em', display: 'inline-block' };
            } else if (tagName === 'code') {
                className = 'font-mono-tag';
                style = { fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,0.08)', padding: '1px 4px', borderRadius: '4px' };
            }

            segments.push(
                <span key={`tag-${match.index}`} className={className} style={style} data-cipher={tagName}>
                    {innerText}
                </span>
            );

            lastIndex = customTagRegex.lastIndex;
        }

        const remaining = text.substring(lastIndex);
        if (remaining) {
            segments.push(<HighlightedTextCore key={`after-${lastIndex}`} text={remaining} pois={pois} isEncoded={isEncoded} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />);
        }

        return <>{segments}</>;
    }

    return <HighlightedTextCore text={text} pois={pois} isEncoded={isEncoded} sourceLine={sourceLine} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />;
}

interface HighlightedTextCoreProps {
    text: string;
    pois?: Array<{ id: string; name: string; selected: boolean; type?: string }>;
    isEncoded: boolean;
    sourceLine?: string;
    onPoiToggle?: (poiId: string) => void;
    navLanguage?: NavLanguage;
    onNavLanguageChange?: (lang: NavLanguage) => void;
}

const HighlightedTextCore = ({ text, pois, isEncoded, sourceLine, onPoiToggle, navLanguage, onNavLanguageChange }: HighlightedTextCoreProps) => {
    if (!text) return null;

    // Pour texte encodé : on affiche le texte encodé brut mais on insère des marqueurs
    // colorés positionnels en superposant les segments détectés dans la ligne source (sourceLine).
    // Si pas de sourceLine, on affiche tel quel (pas de couleurs sur encodé sans référence).
    if (isEncoded) {
        if (!sourceLine) return <>{text}</>;
        // On va colorer le texte encodé par segments de même longueur que les tokens source
        return <EncodedHighlightedText encoded={text} source={sourceLine} pois={pois} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />;
    }

    const selectedPoi = pois?.find(p => p.selected);
    const poiName = selectedPoi ? selectedPoi.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

    const distanceRegex = '\\d+(?:\\.\\d+)?\\s*(?:pas|mètres|km|kilomètres)';
    const azimuthRegex = [
        'au\\s+\\d+°', '\\d+°',
        'du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?',
        'en direction du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?',
        '(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?(?=\\b|$)',
        '(?:tournez\\s+)?légèrement\\s+à\\s+(?:droite|gauche)',
        '(?:tournez\\s+)?à\\s+(?:droite|gauche)',
        'faites\\s+un\\s+demi-tour(?:\\s+à\\s+(?:droite|gauche))?', 'demi-tour',
        'continuez\\s+tout\\s+droit', 'tout\\s+droit(?:\\s+\\(12h\\))?',
        '\\d+\\s+heure(?:s)?(?:\\s+\\(.*?\\))?',
    ].join('|');

    const patterns: string[] = [];
    if (poiName) patterns.push(poiName);
    patterns.push(distanceRegex);
    patterns.push(azimuthRegex);

    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) => {
                if (!part) return null;

                // POI : badge déroulant avec tous les POIs disponibles
                if (pois && pois.length > 0 && poiName && part.toLowerCase() === selectedPoi?.name.toLowerCase()) {
                    return <PoiToken key={i} pois={pois} onPoiToggle={onPoiToggle} />;
                }
                // Distance : colorée en vert
                if (new RegExp(`^${distanceRegex}$`, 'i').test(part)) {
                    return <span key={i} style={{ color: '#34d399', fontWeight: 700 }}>{part}</span>;
                }
                // Azimut : badge déroulant avec choix du format de navigation
                if (new RegExp(`^(${azimuthRegex})$`, 'i').test(part)) {
                    return <AzimutToken key={i} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange}>{part}</AzimutToken>;
                }

                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

// Coloration positionnelle sur texte encodé :
// On détecte les tokens dans la source, on calcule leur position relative dans le texte encodé
// par rapport à la longueur totale, et on applique la couleur sur la tranche correspondante.
function EncodedHighlightedText({
    encoded, source, pois, onPoiToggle, navLanguage, onNavLanguageChange
}: {
    encoded: string;
    source: string;
    pois?: Array<{ id: string; name: string; selected: boolean; type?: string }>;
    onPoiToggle?: (id: string) => void;
    navLanguage?: NavLanguage;
    onNavLanguageChange?: (lang: NavLanguage) => void;
}) {
    if (!encoded || !source) return <>{encoded}</>;

    const selectedPoi = pois?.find(p => p.selected);
    const poiNameRe = selectedPoi ? selectedPoi.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;

    const distanceRegex = '\\d+(?:\\.\\d+)?\\s*(?:pas|mètres|km|kilomètres)';
    const azimuthRegex = [
        'au\\s+\\d+°','\\d+°',
        'du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?',
        'en direction du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?',
        '(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?(?=\\b|$)',
        '(?:tournez\\s+)?légèrement\\s+à\\s+(?:droite|gauche)',
        '(?:tournez\\s+)?à\\s+(?:droite|gauche)',
        'faites\\s+un\\s+demi-tour(?:\\s+à\\s+(?:droite|gauche))?','demi-tour',
        'continuez\\s+tout\\s+droit','tout\\s+droit(?:\\s+\\(12h\\))?',
        '\\d+\\s+heure(?:s)?(?:\\s+\\(.*?\\))?',
    ].join('|');

    const patterns: string[] = [];
    if (poiNameRe) patterns.push(poiNameRe);
    patterns.push(distanceRegex);
    patterns.push(azimuthRegex);

    const regex = new RegExp(`(${patterns.join('|')})`, 'gi');

    // Identifier les spans dans la source avec leur type et position relative
    interface Span { start: number; end: number; type: 'poi' | 'distance' | 'azimut'; text: string; }
    const spans: Span[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(source)) !== null) {
        const part = m[0];
        let type: 'poi' | 'distance' | 'azimut' = 'azimut';
        if (poiNameRe && part.toLowerCase() === selectedPoi?.name.toLowerCase()) type = 'poi';
        else if (new RegExp(`^${distanceRegex}$`, 'i').test(part)) type = 'distance';
        spans.push({ start: m.index, end: m.index + part.length, type, text: part });
    }

    if (spans.length === 0) return <>{encoded}</>;

    // Mapper positions source → positions encodées proportionnellement
    const srcLen = source.length;
    const encLen = encoded.length;
    const toEnc = (srcPos: number) => Math.round((srcPos / srcLen) * encLen);

    // Construire les segments du texte encodé avec colorisation
    const segments: React.ReactNode[] = [];
    let encCursor = 0;

    for (let si = 0; si < spans.length; si++) {
        const span = spans[si];
        const eStart = Math.max(encCursor, toEnc(span.start));
        const eEnd = Math.min(encLen, toEnc(span.end));

        if (eStart > encCursor) {
            segments.push(<span key={`pre-${si}`}>{encoded.slice(encCursor, eStart)}</span>);
        }
        if (eEnd > eStart) {
            const slice = encoded.slice(eStart, eEnd);
            if (span.type === 'poi') {
                segments.push(<PoiToken key={`poi-${si}`} pois={pois || []} onPoiToggle={onPoiToggle} />);
            } else if (span.type === 'distance') {
                segments.push(<span key={`dist-${si}`} style={{ color: '#34d399', fontWeight: 700 }}>{slice}</span>);
            } else {
                segments.push(<AzimutToken key={`az-${si}`} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange}>{slice}</AzimutToken>);
            }
        }
        encCursor = eEnd;
    }
    if (encCursor < encLen) {
        segments.push(<span key="tail">{encoded.slice(encCursor)}</span>);
    }

    return <>{segments}</>;
}
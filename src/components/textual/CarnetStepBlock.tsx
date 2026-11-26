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
import { createPortal } from 'react-dom';
import { marked } from 'marked';
import katex from 'katex';
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
import InlineEditor, { type EditSelectionMode } from './InlineEditor';
import MiniMap, { calculateZoomForScale, calculateScaleForZoom } from './MiniMap';
import UnifiedContextMenu from './UnifiedContextMenu';
import BlockGutter, { GUTTER_WIDTH } from './BlockGutter';
import { mapRef } from '../map/MapComponent';
import MarkdownRenderer, { FONT_PRESETS, CIPHER_FONTS, CIPHER_FONT_SIZES } from './MarkdownRenderer';
import WritingAids from './WritingAids';
import FontSelector from './FontSelector';
import SelectionBubble, { type InlineFormatAction } from './SelectionBubble';
import { type EditorCommandDef, getWordBounds, estimateOffsetFromClick } from './editorCommands';
import { ModuleLogic } from '../../logic/ModuleLogic';
import { themeManager } from '../../logic/ThemeManager';

// ─── Utilitaire : position pixel du bas de la ligne courante du caret ─────────
// Approche robuste : on compte les lignes avant le curseur et on additionne la hauteur de ligne.
function getCaretLineBottom(textarea: HTMLTextAreaElement): { x: number; y: number } {
    const rect = textarea.getBoundingClientRect();
    const style = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(style.lineHeight) || 20;
    const paddingTop = parseFloat(style.paddingTop) || 2;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;

    // Nombre de sauts de ligne avant le curseur (position dans le texte)
    const textBefore = textarea.value.slice(0, textarea.selectionStart ?? textarea.value.length);
    const lineCount = (textBefore.match(/\n/g) || []).length;

    // y = haut du textarea + padding + (numéro de ligne + 1) * lineHeight − scroll interne
    const y = rect.top + paddingTop + (lineCount + 1) * lineHeight - textarea.scrollTop;
    const x = rect.left + paddingLeft;

    return {
        x: Math.max(rect.left + 4, Math.min(x, rect.right - 10)),
        // On se limite à rect.bottom + 4 max pour éviter de sortir du viewport
        y: Math.min(y, rect.bottom + 4),
    };
}

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
    onTriggerSlashPalette?: (stepId: string, rect: DOMRect, query: string) => void;
    onInsertBelow?: (afterStepId: string, rect: DOMRect) => void;
    onSplitBlockOnEnter?: (afterStepId: string, initialContent?: string) => void;
    onDragReorder?: (sourceStepId: string, targetStepId: string, position: 'before' | 'after') => void;
    isPrevGenerated?: boolean;
    isNextGenerated?: boolean;
    autoFocusStepId?: string | null;
    onAutoFocusHandled?: () => void;
    splitMode?: boolean;
}

// ─── Configuration marked ─────────────────────────────────────────────────

marked.use({ gfm: true, breaks: true });

// ─── Composant principal ──────────────────────────────────────────────────

// ─── Helpers & Composant d'Étape Dédiée ───────────────────────────────────

export function getStageDotColor(stageLabel: string, stages: any[]): string {
    const stageIdx = stages.findIndex((st: any) => st.label === stageLabel);
    if (stageIdx === 0) return 'var(--semantic-green)';
    if (stageIdx === stages.length - 1 && stageIdx > 0) return 'var(--semantic-red)';
    return '#94A3B8';
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
    splitMode = false,
    stackIndex = 0,
    onStageClick
}: {
    stageLabel: string;
    stageName?: string;
    dotColor: string;
    isFirst?: boolean;
    isArrival?: boolean;
    splitMode?: boolean;
    stackIndex?: number;
    onStageClick?: (stageLabel: string) => void;
}) {
    const { state } = useApp();
    const [hovered, setHovered] = useState(false);

    const labelText = isArrival
        ? 'Arrivée'
        : stageName
            ? (isFirst ? `Départ — ${stageName}` : stageName)
            : (isFirst ? 'Départ' : '');
    const titleText = labelText
        ? `${stageLabel} · ${labelText} — Cliquer pour localiser sur la carte`
        : `Étape ${stageLabel} — Cliquer pour localiser sur la carte`;

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
            data-stage-anchor={stageLabel}
            data-stage-color={dotColor}
            data-stage-title={titleText}
            data-stage-offset={String((isArrival ? -22 : 4) + stackIndex * 26)}
            style={{
                position: 'relative',
                height: 0,
                margin: 0,
                padding: 0,
                overflow: 'visible',
                userSelect: 'none',
            }}
        >
            {!splitMode && (
                <button
                    type="button"
                    onClick={handleClick}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    title={titleText}
                    aria-label={titleText}
                    style={{
                        position: 'absolute',
                        left: '-20px',
                        top: `${(isArrival ? -22 : 4) + stackIndex * 26}px`,
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        background: hovered ? `${dotColor}22` : 'var(--bg-base)',
                        border: `1.5px solid ${dotColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: dotColor,
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        padding: 0,
                        opacity: hovered ? 1 : 0.72,
                        boxShadow: hovered ? `0 0 8px ${dotColor}55` : '0 1px 2px rgba(0,0,0,0.18)',
                        transform: hovered ? 'scale(1.08)' : 'scale(1)',
                        transition: 'opacity 140ms ease, transform 140ms ease, background-color 140ms ease',
                        zIndex: 20,
                    }}
                >
                    {stageLabel}
                </button>
            )}
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
    onStageClick,
    onTriggerSlashPalette,
    onInsertBelow,
    onSplitBlockOnEnter,
    onDragReorder,
    isPrevGenerated = false,
    isNextGenerated = false,
    autoFocusStepId,
    onAutoFocusHandled,
    splitMode = false
}: CarnetStepBlockProps) {
    const { state, dispatch } = useApp();
    const isSolution = view === 'solution';
    const [dropPos, setDropPos] = useState<'before' | 'after' | null>(null);

    if (step.isHidden) return null;

    const handleBlockDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/carnet-step-id', step.id);
        e.dataTransfer.effectAllowed = 'move';
    };
    const handleBlockDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        if (!e.dataTransfer.types.includes('text/carnet-step-id')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        setDropPos(e.clientY < mid ? 'before' : 'after');
    };
    const handleBlockDrop = (e: React.DragEvent<HTMLDivElement>) => {
        const sourceId = e.dataTransfer.getData('text/carnet-step-id');
        const pos = dropPos || 'after';
        setDropPos(null);
        if (sourceId && sourceId !== step.id) {
            e.preventDefault();
            onDragReorder?.(sourceId, step.id, pos);
        }
    };

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
                            splitMode={splitMode}
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
                        onTriggerSlashPalette={onTriggerSlashPalette}
                        onInsertBelow={onInsertBelow}
                        onSplitBlockOnEnter={onSplitBlockOnEnter}
                        onDragStart={handleBlockDragStart}
                        onDragOver={handleBlockDragOver}
                        onDragLeave={() => setDropPos(null)}
                        onDrop={handleBlockDrop}
                        dropIndicator={dropPos}
                        shouldAutoFocus={autoFocusStepId === step.id}
                        onAutoFocusHandled={onAutoFocusHandled}
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
                            splitMode={splitMode}
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
                        shouldAutoFocus={autoFocusStepId === step.id}
                        onAutoFocusHandled={onAutoFocusHandled}
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
        <div
            onDragOver={handleBlockDragOver}
            onDragLeave={() => setDropPos(null)}
            onDrop={handleBlockDrop}
            style={{
                width: '100%',
                position: 'relative',
                background: 'rgba(96, 165, 250, 0.085)',
                borderRadius: 0,
            }}
        >
            <div style={{
                maxWidth: '760px',
                width: '100%',
                margin: '0 auto',
                padding: '2px clamp(14px, 4vw, 40px)',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
            }}>
            {dropPos === 'before' && (
                <div style={{ position: 'absolute', top: '-1px', left: '40px', right: 0, height: '2px', background: 'var(--accent-default)', zIndex: 80, pointerEvents: 'none' }} />
            )}
            {dropPos === 'after' && (
                <div style={{ position: 'absolute', bottom: '-1px', left: '40px', right: 0, height: '2px', background: 'var(--accent-default)', zIndex: 80, pointerEvents: 'none' }} />
            )}
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

                const allStepSegIndices = (step.stepIndices && step.stepIndices.length > 0)
                    ? step.stepIndices
                    : (step.segmentIndices || []);
                const coveredCount = isVisual ? 1 : linesToRender.length;
                const extraMergedLabels: string[] = [];
                if (stageLabelMap && allStepSegIndices.length > coveredCount) {
                    const firstKey = step.segmentIndices?.[0] !== undefined ? `seg-${step.segmentIndices[0]}` : `step-${step.id}`;
                    const firstLabel = stageLabelMap.get(firstKey) || '';
                    for (let sPos = coveredCount; sPos < allStepSegIndices.length; sPos++) {
                        const lbl = stageLabelMap.get(`seg-${allStepSegIndices[sPos]}`);
                        if (lbl && lbl !== firstLabel && !extraMergedLabels.includes(lbl)) {
                            extraMergedLabels.push(lbl);
                        }
                    }
                }

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
                                    splitMode={splitMode}
                                    onStageClick={onStageClick}
                                />
                            )}
                            {idx === 0 && extraMergedLabels.map((extraLbl, extraIdx) => {
                                const extraStageObj = state.stages.find(s => s.label === extraLbl);
                                const extraDotColor = getStageDotColor(extraLbl, state.stages);
                                return (
                                    <StageHeaderBlock
                                        key={`merged-${extraLbl}`}
                                        stageLabel={extraLbl}
                                        stageName={extraStageObj?.address}
                                        dotColor={extraDotColor}
                                        isFirst={false}
                                        splitMode={splitMode}
                                        stackIndex={extraIdx + (lineLabel ? 1 : 0)}
                                        onStageClick={onStageClick}
                                    />
                                );
                            })}
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
                                onInsertBelow={onInsertBelow}
                                onSplitBlockOnEnter={onSplitBlockOnEnter}
                                onDragStart={handleBlockDragStart}
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
    onTriggerSlashPalette?: (stepId: string, rect: DOMRect, query: string) => void;
    onInsertBelow?: (afterStepId: string, rect: DOMRect) => void;
    onSplitBlockOnEnter?: (afterStepId: string, initialContent?: string) => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
    onDragLeave?: () => void;
    onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
    dropIndicator?: 'before' | 'after' | null;
    shouldAutoFocus?: boolean;
    onAutoFocusHandled?: () => void;
}

function ManualStepHtml({
    step, stepIndex = 0, onManualContentChange, onRemoveStep, isSelected,
    onItemSelect, fontConfig, onDuplicate, onMoveUp, onMoveDown,
    onCopy, onLinkRef, onOpenFonts, onOpenSettings,
    onTriggerSlashPalette, onInsertBelow, onSplitBlockOnEnter, onDragStart, onDragOver, onDragLeave, onDrop, dropIndicator,
    shouldAutoFocus, onAutoFocusHandled
}: ManualStepHtmlProps) {
    const { dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(step.solutionText || '');
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const skipBlurRef = useRef(false);
    const lastTapRef = useRef(0);

    const rawContent: string = step.solutionText || '';
    const isEmpty = !rawContent || rawContent === '<p>&nbsp;</p>' || rawContent.trim() === '' || rawContent === '<p></p>';

    // Sync editValue when step changes externally
    useEffect(() => {
        if (!isEditing) setEditValue(step.solutionText || '');
    }, [step.solutionText, isEditing]);

    const resizeTextarea = useCallback(() => {
        const t = textareaRef.current;
        if (!t) return;
        t.style.height = 'auto';
        t.style.height = `${t.scrollHeight}px`;
    }, []);

    const pendingSelectionRef = useRef<{ mode: EditSelectionMode; offset?: number }>({ mode: 'caret' });
    const [preservedHeight, setPreservedHeight] = useState<number | undefined>(undefined);
    const viewBoxRef = useRef<HTMLDivElement>(null);

    const applyPendingSelection = useCallback((t: HTMLTextAreaElement, mode: EditSelectionMode, offset?: number) => {
        if (mode === 'all') {
            t.select();
            const rect = t.getBoundingClientRect();
            setBubblePos({ x: rect.left + Math.min(200, rect.width / 3), y: rect.bottom });
            setBubbleVisible(true);
        } else if (mode === 'word') {
            const [start, end] = getWordBounds(t.value, offset ?? 0);
            t.setSelectionRange(start, end);
            if (start !== end) {
                const rect = t.getBoundingClientRect();
                setBubblePos({ x: rect.left + Math.min(200, rect.width / 3), y: rect.bottom });
                setBubbleVisible(true);
            }
        } else {
            const pos = offset !== undefined ? Math.max(0, Math.min(offset, t.value.length)) : t.value.length;
            t.setSelectionRange(pos, pos);
        }
    }, []);

    useEffect(() => {
        if (isEditing) {
            resizeTextarea();
            const t = textareaRef.current;
            if (t && document.activeElement !== t) {
                t.focus();
                const { mode, offset } = pendingSelectionRef.current;
                applyPendingSelection(t, mode, offset);
                pendingSelectionRef.current = { mode: 'caret' };
            }
        }
    }, [isEditing, editValue, resizeTextarea, applyPendingSelection]);

    const startEditing = useCallback((mode: EditSelectionMode = 'caret', offset?: number) => {
        if (viewBoxRef.current) {
            setPreservedHeight(viewBoxRef.current.offsetHeight);
        }
        pendingSelectionRef.current = { mode, offset };
        setEditValue(step.solutionText || '');
        setIsEditing(true);
        requestAnimationFrame(() => {
            const t = textareaRef.current;
            if (t) {
                t.focus();
                applyPendingSelection(t, mode, offset);
                resizeTextarea();
            }
        });
    }, [step.solutionText, resizeTextarea, applyPendingSelection]);

    useEffect(() => {
        if (shouldAutoFocus) {
            startEditing();
            onAutoFocusHandled?.();
        }
    }, [shouldAutoFocus, startEditing, onAutoFocusHandled]);

    const handleValidate = () => {
        if (skipBlurRef.current) {
            skipBlurRef.current = false;
            return;
        }
        setBubbleVisible(false);
        setPreservedHeight(undefined);
        if (editValue !== (step.solutionText || '')) {
            onManualContentChange?.(step.id, editValue);
        }
        setIsEditing(false);
    };

    const applyInlineFormat = useCallback((action: InlineFormatAction) => {
        const t = textareaRef.current;
        if (!t) return;
        const start = t.selectionStart ?? 0;
        const end = t.selectionEnd ?? 0;
        const val = editValue;
        const selected = val.slice(start, end);
        const wrappers: Record<InlineFormatAction, [string, string]> = {
            bold: ['**', '**'],
            italic: ['*', '*'],
            underline: ['<u>', '</u>'],
            code: ['`', '`'],
            link: ['[', '](https://)'],
        };
        const [pre, post] = wrappers[action];
        const next = val.slice(0, start) + pre + (selected || 'texte') + post + val.slice(end);
        setEditValue(next);
        onManualContentChange?.(step.id, next);
        setBubbleVisible(false);
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const cursor = start + pre.length + (selected ? selected.length : 5) + post.length;
                textareaRef.current.setSelectionRange(cursor, cursor);
            }
        }, 0);
    }, [editValue, onManualContentChange, step.id]);

    const lastContextMenuAtRef = useRef(0);

    const handleSelectionUpdate = (e?: React.MouseEvent | React.SyntheticEvent) => {
        if (e && 'button' in e && e.button === 2) return;
        if (Date.now() - lastContextMenuAtRef.current < 350) return;
        const t = textareaRef.current;
        if (!t) return;
        if (t.selectionStart !== t.selectionEnd) {
            const rect = t.getBoundingClientRect();
            const mouseX = e && 'clientX' in e && e.clientX ? e.clientX : rect.left + Math.min(200, rect.width / 3);
            setBubblePos({ x: mouseX, y: rect.bottom });
            setBubbleVisible(true);
        } else {
            setBubbleVisible(false);
        }
    };

    const handleViewMouseUp = (e: React.MouseEvent) => {
        if (e.button === 2) return;
        if (Date.now() - lastContextMenuAtRef.current < 350) return;
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (sel && !sel.isCollapsed && sel.toString().trim().length > 0 && e.detail < 2) {
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setBubblePos({ x: e.clientX || rect.left, y: rect.bottom || e.clientY });
            setBubbleVisible(true);
            return;
        }
        const rect = e.currentTarget.getBoundingClientRect();
        const offset = estimateOffsetFromClick(step.solutionText || '', e.clientX, e.clientY, rect);
        if (e.detail === 3) {
            startEditing('all');
        } else if (e.detail === 2) {
            startEditing('word', offset);
        } else {
            startEditing('caret', offset);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const mod = e.ctrlKey || e.metaKey;
        if (e.altKey && e.shiftKey && e.key === 'ArrowUp') {
            e.preventDefault();
            onMoveUp?.(step.id);
            return;
        }
        if (e.altKey && e.shiftKey && e.key === 'ArrowDown') {
            e.preventDefault();
            onMoveDown?.(step.id);
            return;
        }
        if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); applyInlineFormat('bold'); return; }
        if (mod && e.key.toLowerCase() === 'i') { e.preventDefault(); applyInlineFormat('italic'); return; }
        if (mod && e.key.toLowerCase() === 'u') { e.preventDefault(); applyInlineFormat('underline'); return; }
        if (mod && e.key.toLowerCase() === 'e') { e.preventDefault(); applyInlineFormat('code'); return; }
        if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); applyInlineFormat('link'); return; }

        if (e.key === 'Enter' && !e.shiftKey && !mod) {
            e.preventDefault();
            skipBlurRef.current = true;
            const t = textareaRef.current;
            const start = t?.selectionStart ?? editValue.length;
            const end = t?.selectionEnd ?? editValue.length;
            const before = editValue.slice(0, start);
            const after = editValue.slice(end);
            setBubbleVisible(false);
            setEditValue(before);
            if (before !== (step.solutionText || '')) {
                onManualContentChange?.(step.id, before);
            }
            setIsEditing(false);
            onSplitBlockOnEnter?.(step.id, after);
            return;
        }
        if (e.key === 'Enter' && mod) {
            e.preventDefault();
            handleValidate();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            handleValidate();
        }
        if (e.key === 'Backspace' && editValue === '' && onRemoveStep) {
            e.preventDefault();
            onRemoveStep(step.id);
        }
    };

    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setEditValue(val);
        setBubbleVisible(false); // Se cache pendant la frappe
        resizeTextarea();

        // Détecter "/" en début de ligne pour ouvrir/mettre à jour la palette Notion
        const slashMatch = val.match(/(?:^|\n)\/([^\n]*)$/);
        if (slashMatch && textareaRef.current) {
            const t = textareaRef.current;
            if (!slashMatch[1]) {
                // Première frappe de "/" : calculer la position du caret et ouvrir la palette
                const caretPos = getCaretLineBottom(t);
                const triggerRect = {
                    left: caretPos.x, right: caretPos.x,
                    top: caretPos.y, bottom: caretPos.y,
                    width: 0, height: 0, x: caretPos.x, y: caretPos.y,
                    toJSON: () => ({})
                } as DOMRect;
                onTriggerSlashPalette?.(step.id, triggerRect, '');
            } else {
                // Frappes suivantes : filtrer la liste sans re-positionner ni voler le focus
                window.dispatchEvent(new CustomEvent('textual:slash-query', { detail: { query: slashMatch[1] } }));
            }
        } else {
            // Le "/" a été effacé → fermer la palette
            window.dispatchEvent(new CustomEvent('textual:slash-query', { detail: { query: null } }));
        }
    };

    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const touchTimerRef = useRef<any>(null);

    // Clic droit intelligent : entre en édition (si besoin), place le | et ouvre le menu contextuel standardisé
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        lastContextMenuAtRef.current = Date.now();
        const pos = { x: e.clientX, y: e.clientY };
        if (!isEditing) {
            const rect = e.currentTarget.getBoundingClientRect();
            const offset = estimateOffsetFromClick(step.solutionText || '', e.clientX, e.clientY, rect);
            startEditing('caret', offset);
            requestAnimationFrame(() => {
                setBubblePos(pos);
                setBubbleVisible(true);
            });
        } else {
            setBubblePos(pos);
            setBubbleVisible(true);
        }
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
            aria-label="Bloc texte libre"
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                position: 'relative',
                minHeight: '28px',
                padding: '3px 0',
                zIndex: hovered || isEditing ? 50 : 1
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => { if (!isEditing) setHovered(false); }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
        >
            {dropIndicator === 'before' && (
                <div style={{ position: 'absolute', top: '-1px', left: '40px', right: 0, height: '2px', background: 'var(--accent-default)', zIndex: 80, pointerEvents: 'none' }} />
            )}
            {dropIndicator === 'after' && (
                <div style={{ position: 'absolute', bottom: '-1px', left: '40px', right: 0, height: '2px', background: 'var(--accent-default)', zIndex: 80, pointerEvents: 'none' }} />
            )}

            {/* Gutter unifié 40px : + et ⋮⋮ au survol ou au focus tactile */}
            <BlockGutter
                blockType="html"
                blockData={step}
                isTitle={false}
                isSelected={isSelected}
                isHovered={hovered || isEditing}
                isFocused={isEditing}
                contextMenuPos={contextMenuPos}
                onOpenContextMenu={pos => setContextMenuPos(pos)}
                onCloseContextMenu={() => setContextMenuPos(null)}
                onInsertBelow={rect => onInsertBelow?.(step.id, rect)}
                onDragStart={onDragStart}
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
                onChangeTextColor={(color) => dispatch({ type: 'SET_STEP_STYLE', stepId: step.id, textColor: color })}
                onChangeTextAlign={(align) => dispatch({ type: 'SET_STEP_STYLE', stepId: step.id, textAlign: align })}
                onOpenFonts={onOpenFonts ? () => onOpenFonts(step.id) : undefined}
                onOpenSettings={onOpenSettings ? () => onOpenSettings(step.id) : undefined}
                containerRef={blockRef}
            />

            {/* Contenu - STYLE ÉPURÉ FAÇON NOTION */}
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                <SelectionBubble
                    visible={bubbleVisible}
                    position={bubblePos}
                    blockContext={{
                        isComputed: false,
                        textAlign: step.textAlign,
                        onChangeTextAlign: (align) => dispatch({ type: 'SET_STEP_STYLE', stepId: step.id, textAlign: align }),
                    }}
                    onClose={() => setBubbleVisible(false)}
                    onFormat={applyInlineFormat}
                    onApplyColor={(color) => dispatch({ type: 'SET_STEP_STYLE', stepId: step.id, textColor: color })}
                    onTransformBlock={(cmd: EditorCommandDef) => {
                        setBubbleVisible(false);
                        const t = textareaRef.current;
                        const hasStrictSelection = Boolean(
                            isEditing && t && t.selectionStart !== t.selectionEnd &&
                            editValue.slice(t.selectionStart, t.selectionEnd).trim().length > 0 &&
                            (editValue.slice(0, t.selectionStart).trim().length > 0 || editValue.slice(t.selectionEnd).trim().length > 0)
                        );
                        if (hasStrictSelection && t) {
                            const beforeText = editValue.slice(0, t.selectionStart);
                            const selectedRaw = editValue.slice(t.selectionStart, t.selectionEnd);
                            const afterText = editValue.slice(t.selectionEnd);
                            skipBlurRef.current = true;
                            setIsEditing(false);
                            if (cmd.blockType === 'crypto_block' && cmd.config?.cipher) {
                                dispatch({
                                    type: 'ISOLATE_SELECTION_TO_BLOCK',
                                    stepId: step.id,
                                    beforeText,
                                    selectedText: selectedRaw,
                                    afterText,
                                    targetType: 'code',
                                    moduleId: cmd.config.cipher,
                                });
                            } else {
                                const strippedSel = selectedRaw.trim().replace(/^(?:#{1,3}\s+|-\s+\[\s?\]\s+|-\s+|\d+\.\s+|>\s+)/, '');
                                dispatch({
                                    type: 'ISOLATE_SELECTION_TO_BLOCK',
                                    stepId: step.id,
                                    beforeText,
                                    selectedText: (cmd.markdownPrefix ?? '') + strippedSel,
                                    afterText,
                                    targetType: 'html',
                                });
                            }
                            return;
                        }
                        if (cmd.blockType === 'crypto_block' && cmd.config?.cipher) {
                            dispatch({
                                type: 'CONVERT_MANUAL_STEP_TYPE',
                                stepId: step.id,
                                targetType: 'code',
                                moduleId: cmd.config.cipher,
                            });
                            return;
                        }
                        const stripped = editValue.replace(/^(?:#{1,3}\s+|-\s+\[\s?\]\s+|-\s+|\d+\.\s+|>\s+)/, '');
                        const next = (cmd.markdownPrefix ?? '') + stripped;
                        setEditValue(next);
                        onManualContentChange?.(step.id, next);
                    }}
                />
                {isEditing ? (
                    <div
                        style={{
                            minHeight: preservedHeight ? `${preservedHeight}px` : undefined,
                            cursor: 'text',
                        }}
                        onMouseDown={(e) => {
                            const t = textareaRef.current;
                            if (!t) return;
                            const rect = e.currentTarget.getBoundingClientRect();
                            if (e.detail === 3) {
                                e.preventDefault();
                                t.focus();
                                t.select();
                                setBubblePos({ x: e.clientX || rect.left + Math.min(200, rect.width / 3), y: t.getBoundingClientRect().bottom });
                                setBubbleVisible(true);
                                return;
                            }
                            if (e.detail === 2 && e.target !== t) {
                                e.preventDefault();
                                t.focus();
                                const offset = estimateOffsetFromClick(t.value, e.clientX, e.clientY, rect);
                                const [start, end] = getWordBounds(t.value, offset);
                                t.setSelectionRange(start, end);
                                if (start !== end) {
                                    setBubblePos({ x: e.clientX || rect.left + Math.min(200, rect.width / 3), y: t.getBoundingClientRect().bottom });
                                    setBubbleVisible(true);
                                }
                                return;
                            }
                            if (e.detail === 1 && e.target !== t) {
                                e.preventDefault();
                                t.focus();
                                t.setSelectionRange(t.value.length, t.value.length);
                            }
                        }}
                    >
                        <textarea
                            ref={textareaRef}
                            value={editValue}
                            onChange={handleTextareaChange}
                            onSelect={handleSelectionUpdate}
                            onKeyUp={handleSelectionUpdate}
                            onMouseUp={handleSelectionUpdate}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                const t = e.currentTarget;
                                if (t.selectionStart === t.selectionEnd && t.value.length > 0) {
                                    const [start, end] = getWordBounds(t.value, t.selectionStart ?? 0);
                                    t.setSelectionRange(start, end);
                                }
                                handleSelectionUpdate(e);
                            }}
                            onFocus={() => {
                                // Si le texte contient déjà "/query" en fin de ligne → rouvrir la palette
                                const val = editValue;
                                const slashMatch = val.match(/(?:^|\n)\/([^\n]*)$/);
                                if (slashMatch && textareaRef.current) {
                                    const caretPos = getCaretLineBottom(textareaRef.current);
                                    const triggerRect = {
                                        left: caretPos.x, right: caretPos.x,
                                        top: caretPos.y, bottom: caretPos.y,
                                        width: 0, height: 0, x: caretPos.x, y: caretPos.y,
                                        toJSON: () => ({})
                                    } as DOMRect;
                                    onTriggerSlashPalette?.(step.id, triggerRect, slashMatch[1]);
                                }
                            }}
                            onBlur={(_e) => {
                                // Fermer la palette slash quand on quitte ce textarea (sauf si focus va sur la palette)
                                window.dispatchEvent(new CustomEvent('textual:slash-query', { detail: { query: null } }));
                                handleValidate();
                            }}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            placeholder="Tapez / pour insérer un bloc"
                            style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 0,
                                color: step.textColor || 'var(--text-primary)',
                                caretColor: 'var(--text-primary)',
                                textAlign: step.textAlign || 'left',
                                fontSize: '15px',
                                fontWeight: 400,
                                fontFamily: 'var(--font-ui)',
                                lineHeight: 1.6,
                                padding: '2px 0',
                                minHeight: '28px',
                                margin: 0,
                                resize: 'none',
                                outline: 'none',
                                boxSizing: 'border-box',
                                overflow: 'hidden',
                                display: 'block',
                            }}
                        />
                    </div>
                ) : (
                    /* ── Mode vue : rendu Markdown pur, sélection affiche le menu, clic simple édite ── */
                    <div
                        ref={viewBoxRef}
                        onMouseUp={handleViewMouseUp}
                        onDoubleClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const offset = estimateOffsetFromClick(step.solutionText || '', e.clientX, e.clientY, rect);
                            startEditing('word', offset);
                        }}
                        onTouchEnd={handleTouchEnd}
                        style={{
                            cursor: 'text',
                            minHeight: '28px',
                        }}
                    >
                        {!isEmpty && (
                            <MarkdownRenderer
                                content={rawContent}
                                fontConfig={fontConfig}
                                viewMode="participant"
                                onChange={() => startEditing('caret')}
                                blockId={step.id}
                                className="manual-html-view ck-content"
                                style={{
                                    fontSize: '15px',
                                    fontWeight: 400,
                                    color: step.textColor || 'var(--text-primary)',
                                    textAlign: step.textAlign || 'left',
                                    lineHeight: 1.6,
                                    padding: '2px 0',
                                    minHeight: '28px',
                                    outline: 'none',
                                    wordBreak: 'break-word',
                                }}
                            />
                        )}
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
    shouldAutoFocus?: boolean;
    onAutoFocusHandled?: () => void;
}

function ManualCodeBlock({
    step, stepIndex = 0, onManualContentChange, onRemoveStep, isSolution,
    isSelected, onItemSelect, onDuplicate, onMoveUp, onMoveDown,
    onCopy, onLinkRef, onOpenSettings, shouldAutoFocus, onAutoFocusHandled
}: ManualCodeBlockProps) {
    const { dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [bubbleVisible, setBubbleVisible] = useState(false);
    const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
    // liveText : valeur locale du textarea, mise à jour immédiatement à chaque frappe
    // pour que l'aperçu encodé soit instantané sans attendre le cycle store
    const [liveText, setLiveText] = useState(step.solutionText || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lastContextMenuAtRef = useRef(0);
    const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const font = CIPHER_FONTS[step.moduleId] || 'monospace';
    const fontSize = CIPHER_FONT_SIZES[step.moduleId] || '14px';

    // Synchroniser liveText quand le step change depuis l'extérieur (changement de module, undo…)
    useEffect(() => {
        if (!isEditing) setLiveText(step.solutionText || '');
    }, [step.solutionText, isEditing]);

    // Aperçu encodé calculé localement depuis liveText → instantané dès la frappe
    const liveEncoded = useMemo(() => {
        if (!liveText.trim()) return '';
        const theme = themeManager.getTheme();
        return ModuleLogic.encode(step.moduleId, liveText, { key: theme.vigenere_key });
    }, [liveText, step.moduleId]);

    // isActuallyEncoded : vrai dès que le module produit un encodage distinct du texte brut
    // (y compris Morse dont la font_text peut être visuellement identique — la police fait le travail)
    const isCipherModule = step.moduleId !== 'texte_clair';
    const isActuallyEncoded = isCipherModule && !!liveEncoded;
    const encodedDisplay = liveEncoded || liveText;
    const isEmpty = !liveText.trim();

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            const t = textareaRef.current;
            t.focus();
            t.style.height = 'auto';
            t.style.height = `${t.scrollHeight}px`;
        }
    }, [isEditing]);

    useEffect(() => {
        if (shouldAutoFocus) {
            setIsEditing(true);
            onAutoFocusHandled?.();
        }
    }, [shouldAutoFocus, onAutoFocusHandled]);

    const handleSelectionUpdate = (e?: React.MouseEvent | React.SyntheticEvent) => {
        if (e && 'button' in e && e.button === 2) return;
        if (Date.now() - lastContextMenuAtRef.current < 350) return;
        const t = textareaRef.current;
        if (!t) return;
        if (t.selectionStart !== t.selectionEnd) {
            const rect = t.getBoundingClientRect();
            const mouseX = e && 'clientX' in e && e.clientX ? e.clientX : rect.left + Math.min(200, rect.width / 3);
            setBubblePos({ x: mouseX, y: rect.bottom });
            setBubbleVisible(true);
        } else {
            setBubbleVisible(false);
        }
    };

    const applyInlineFormat = useCallback((action: InlineFormatAction) => {
        const t = textareaRef.current;
        if (!t) return;
        const val = liveText;
        const start = t.selectionStart ?? 0;
        const end = t.selectionEnd ?? 0;
        const selected = val.slice(start, end);
        const wrappers: Record<InlineFormatAction, [string, string]> = {
            bold: ['**', '**'],
            italic: ['*', '*'],
            underline: ['<u>', '</u>'],
            code: ['`', '`'],
            link: ['[', '](https://)'],
        };
        const [pre, post] = wrappers[action];
        const next = val.slice(0, start) + pre + (selected || 'texte') + post + val.slice(end);
        setLiveText(next);
        onManualContentChange?.(step.id, next);
        setBubbleVisible(false);
    }, [liveText, step.id, onManualContentChange]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        lastContextMenuAtRef.current = Date.now();
        const pos = { x: e.clientX, y: e.clientY };
        if (!isEditing) {
            setIsEditing(true);
            requestAnimationFrame(() => {
                textareaRef.current?.focus();
                setBubblePos(pos);
                setBubbleVisible(true);
            });
        } else {
            setBubblePos(pos);
            setBubbleVisible(true);
        }
    };

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
                minHeight: '28px',
                padding: '3px 0',
                zIndex: hovered || isEditing ? 50 : 1
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
                isHovered={hovered || isEditing}
                isFocused={isEditing}
                contextMenuPos={contextMenuPos}
                onOpenContextMenu={pos => setContextMenuPos(pos)}
                onCloseContextMenu={() => setContextMenuPos(null)}
                onEdit={() => setIsEditing(true)}
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

            {/* Contenu façon Notion sans fond ni bordure : texte en clair au-dessus (édition / survol / solution), aperçu encodé en dessous */}
            <div style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', position: 'relative' }}>
                <SelectionBubble
                    visible={bubbleVisible}
                    position={bubblePos}
                    blockContext={{
                        isComputed: false,
                        moduleId: step.moduleId,
                        textAlign: step.textAlign,
                        onChangeTextAlign: (align) => dispatch({ type: 'SET_STEP_STYLE', stepId: step.id, textAlign: align }),
                        onOpenSettings: () => onOpenSettings?.(step.id),
                    }}
                    onClose={() => setBubbleVisible(false)}
                    onFormat={applyInlineFormat}
                    onApplyColor={(color) => dispatch({ type: 'SET_STEP_STYLE', stepId: step.id, textColor: color })}
                    onTransformBlock={(cmd: EditorCommandDef) => {
                        setBubbleVisible(false);
                        if (cmd.blockType === 'crypto_block' && cmd.config?.cipher) {
                            handleSwitchModule(cmd.config.cipher);
                            return;
                        }
                        handleConvertToComment();
                    }}
                />
                {/* Textarea toujours monté pour éviter la perte de focus entre isEmpty→false et isEditing→true */}
                <textarea
                    ref={textareaRef}
                    value={liveText}
                    onChange={e => {
                        const val = e.target.value;
                        setLiveText(val);
                        onManualContentChange?.(step.id, val);
                        setBubbleVisible(false);
                    }}
                    onSelect={handleSelectionUpdate}
                    onMouseUp={handleSelectionUpdate}
                    onKeyUp={handleSelectionUpdate}
                    onDoubleClick={handleSelectionUpdate}
                    onFocus={() => setIsEditing(true)}
                    onBlur={() => setIsEditing(false)}
                    placeholder={isCipherModule
                        ? `Tapez le texte en ${MODULE_META[step.moduleId]?.label ?? 'code'}…`
                        : 'Tapez le texte…'
                    }
                    style={{
                        width: '100%',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 0,
                        color: 'var(--text-primary)',
                        caretColor: 'var(--text-primary)',
                        fontSize: '15px',
                        fontFamily: 'var(--font-ui)',
                        lineHeight: 1.6,
                        padding: '2px 0',
                        minHeight: '28px',
                        margin: 0,
                        resize: 'none',
                        outline: 'none',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        // Visible seulement quand focus ou vide (placeholder visible)
                        display: (isEditing || isEmpty) ? 'block' : 'none',
                    }}
                    rows={1}
                    onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; }}
                />
                {/* Aperçu en clair (hors édition, si contenu) */}
                {!isEditing && !isEmpty && (hovered || isSolution) && (
                    <div
                        onClick={() => { setIsEditing(true); requestAnimationFrame(() => textareaRef.current?.focus()); }}
                        style={{
                            width: '100%',
                            color: 'var(--text-primary)',
                            fontSize: '15px',
                            fontFamily: 'var(--font-ui)',
                            lineHeight: 1.6,
                            padding: '2px 0',
                            marginBottom: isActuallyEncoded ? '4px' : 0,
                            cursor: 'text',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {liveText}
                    </div>
                )}

                {/* Code encodé (toujours affiché en dessous, sans fond ni bordure) */}
                {!isEmpty && (
                    <div
                        onClick={() => { setIsEditing(true); requestAnimationFrame(() => textareaRef.current?.focus()); }}
                        style={{
                            fontFamily: isActuallyEncoded ? font : 'var(--font-ui)',
                            fontSize: isActuallyEncoded ? fontSize : '15px',
                            color: 'var(--text-primary)',
                            lineHeight: isActuallyEncoded ? 1.5 : 1.6,
                            letterSpacing: step.moduleId === 'morse' ? '2px' : '0.02em',
                            wordBreak: 'break-all',
                            padding: '2px 0',
                            cursor: 'text',
                        }}
                    >
                        {encodedDisplay}
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
    onInsertBelow?: (afterStepId: string, rect: DOMRect) => void;
    onSplitBlockOnEnter?: (afterStepId: string, initialContent?: string) => void;
    onDragStart?: (e: React.DragEvent) => void;
}

function ComputedStepLine({
    step, stepIndex = 0, lineIdx, segIdx, lineKey, isSelected, onItemSelect,
    encodedLine, solutionLine, distance, azimuth, isFirst, isSolutionView, isVisual,
    dangerLevel, navLanguage, pois, onModuleChange, onNavLanguageChange,
    onLineClick, onPoiToggle, onDuplicate, onMoveUp, onMoveDown, onCopy,
    onLinkRef, onOpenSettings, onInsertBelow, onSplitBlockOnEnter, onDragStart
}: ComputedStepLineProps) {
    const { state, dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editSelectionMode, setEditSelectionMode] = useState<EditSelectionMode>('caret');
    const [editInitialOffset, setEditInitialOffset] = useState<number | undefined>(undefined);
    const [preservedHeight, setPreservedHeight] = useState<number | undefined>(undefined);
    const viewContentRef = useRef<HTMLDivElement>(null);
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

    const enterEditFromEvent = useCallback((e: React.MouseEvent, modeOverride?: EditSelectionMode) => {
        if (isVisual) return;
        const container = viewContentRef.current || (e.currentTarget as HTMLElement);
        const rect = container.getBoundingClientRect();
        setPreservedHeight(container.offsetHeight > 0 ? container.offsetHeight : undefined);
        const offset = estimateOffsetFromClick(solutionLine, e.clientX, e.clientY, rect);
        const mode: EditSelectionMode = modeOverride ?? (e.detail === 3 ? 'all' : e.detail === 2 ? 'word' : 'caret');
        setEditInitialOffset(offset);
        setEditSelectionMode(mode);
        setIsEditing(true);
    }, [isVisual, solutionLine]);

    // Double clic : sélectionner le mot (et non tout le bloc) lors de l'entrée en édition
    const handleDoubleClick = (e: React.MouseEvent) => {
        if (isEditing || isVisual) return;
        e.stopPropagation();
        enterEditFromEvent(e, 'word');
    };

    const handleLineClickInternal = (e: React.MouseEvent) => {
        if (onItemSelect) onItemSelect(e);
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && onLineClick) onLineClick();
    };

    // Référence pour le bloc
    const blockRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const [editContextMenuPos, setEditContextMenuPos] = useState<{ x: number; y: number } | null>(null);
    const touchTimerRef = useRef<any>(null);

    const handleContextMenu = (e: React.MouseEvent) => {
        if (isVisual) {
            e.preventDefault();
            e.stopPropagation();
            setContextMenuPos({ x: e.clientX, y: e.clientY });
            return;
        }
        if (isEditing) return;
        e.preventDefault();
        e.stopPropagation();
        setEditContextMenuPos({ x: e.clientX, y: e.clientY });
        enterEditFromEvent(e, 'caret');
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
            {/* Gutter unifié 40px : + et ⋮⋮ au survol */}
            <BlockGutter
                blockType={isVisual ? (hasMap ? 'map' : 'generic') : 'computed'}
                blockData={step}
                moduleId={step.moduleId}
                isSelected={isSelected}
                isHovered={hovered || isEditing}
                isFocused={isEditing}
                hasWarning={!step.isEdited && Boolean(step.warnings && step.warnings.length > 0)}
                isComputedBlock={true}
                contextMenuPos={contextMenuPos}
                onOpenContextMenu={pos => setContextMenuPos(pos)}
                onCloseContextMenu={() => setContextMenuPos(null)}
                onInsertBelow={rect => onInsertBelow?.(step.id, rect)}
                onDragStart={onDragStart}
                onEdit={() => setIsEditing(true)}
                onDelete={() => {
                    dispatch({ type: 'HIDE_COMPUTED_STEP', stepId: step.id });
                    window.dispatchEvent(new CustomEvent('textual:block-hidden', { detail: { stepId: step.id } }));
                }}
                onDuplicate={() => onDuplicate?.(step.id)}
                onMoveUp={() => onMoveUp?.(step.id)}
                onMoveDown={() => onMoveDown?.(step.id)}
                onCopy={() => onCopy?.(step.id)}
                onLinkRef={() => onLinkRef?.(lineKey)}
                onChangeCipher={(cipher) => onModuleChange?.(cipher)}
                onChangeLanguage={(lang) => onNavLanguageChange?.(lang as NavLanguage)}
                onTogglePOI={(poiId) => onPoiToggle?.(poiId)}
                onToggleSolution={() => dispatch({ type: 'SET_CARNET_VIEW', view: isSolutionView ? 'participant' : 'solution' })}
                onRegenerate={() => dispatch({ type: 'REBUILD_CARNET' })}
                onDetach={() => dispatch({ type: 'DETACH_COMPUTED_STEP', stepId: step.id })}
                onRestoreGenerated={() => dispatch({ type: 'RESTORE_COMPUTED_STEP', stepId: step.id })}
                onChangeMapSize={(size) => {
                    const pct = size === 'column' ? 100 : size === 'wide' ? 115 : 130;
                    dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, widthPercent: pct });
                }}
                onOpenOnMap={onLineClick}
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
            <div
                onClick={!isVisual && !isEditing ? (e) => {
                    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
                    if (sel && !sel.isCollapsed && e.detail < 2) return;
                    handleLineClickInternal(e);
                    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                        enterEditFromEvent(e);
                    }
                } : undefined}
                style={{
                    flex: 1, minWidth: 0, position: 'relative',
                    background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    outline: isSelected ? '1px solid var(--accent-default)' : 'none',
                    borderRadius: '6px', padding: '2px 0', boxSizing: 'border-box',
                    transition: 'background-color 120ms ease',
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    cursor: !isVisual && !isEditing ? 'text' : undefined,
                }}
            >

                <div style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px'
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                        <>
                            <InlineEditor
                                stepId={step.id}
                                solutionText={solutionLine}
                                moduleId={step.moduleId}
                                lineIdx={lineIdx}
                                initialSelectionMode={editSelectionMode}
                                initialOffset={editInitialOffset}
                                preservedHeight={preservedHeight}
                                initialContextMenuPos={editContextMenuPos}
                                blockContext={{
                                    isComputed: true,
                                    moduleId: step.moduleId,
                                    isEdited: step.isEdited,
                                    navLanguage,
                                    themeId: state.theme_id,
                                    onChangeLanguage: onNavLanguageChange,
                                    onChangeTheme: (themeId) => dispatch({ type: 'SET_THEME', themeId }),
                                    onRegenerate: () => dispatch({ type: 'RESTORE_COMPUTED_STEP', stepId: step.id }),
                                    onDetach: () => dispatch({ type: 'DETACH_COMPUTED_STEP', stepId: step.id }),
                                    onRestoreGenerated: () => dispatch({ type: 'RESTORE_COMPUTED_STEP', stepId: step.id }),
                                    onOpenSettings: () => onOpenSettings?.(step.id),
                                }}
                                onClose={() => { setIsEditing(false); setEditSelectionMode('caret'); setPreservedHeight(undefined); setEditContextMenuPos(null); }}
                                onEnterCreateBelow={() => onSplitBlockOnEnter?.(step.id, '')}
                            />
                            {isActuallyEncoded && (
                                <div style={{
                                    marginTop: '4px',
                                    fontFamily: font,
                                    fontSize: fontSize,
                                    color: step.textColor || dangerColor || 'var(--text-secondary)',
                                    wordBreak: 'break-all',
                                    letterSpacing: step.moduleId === 'morse' ? '2px' : '0.02em',
                                    lineHeight: 1.4,
                                }}>
                                    <HighlightedText text={encodedLine} pois={pois} isEncoded={true} sourceLine={solutionLine} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />
                                </div>
                            )}
                        </>
                    ) : !isVisual ? (
                        <div
                            ref={viewContentRef}
                            style={{ cursor: 'text', textAlign: step.textAlign || 'left' }}
                        >
                            {isActuallyEncoded ? (
                                <>
                                    {/* Texte en clair au-dessus uniquement au survol ou si Solutions actif */}
                                    {(hovered || isSolutionView) && (
                                        <div style={{
                                            marginBottom: '6px',
                                            paddingLeft: '10px',
                                            borderLeft: '2px solid var(--border-subtle)',
                                            fontSize: '13.5px',
                                            color: dangerColor || 'var(--text-secondary)',
                                            fontWeight: 400,
                                            lineHeight: 1.55,
                                        }}>
                                            <HighlightedText text={solutionLine} pois={pois} isEncoded={false} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />
                                        </div>
                                    )}
                                    {/* Code chiffré */}
                                    <div style={{ fontFamily: font, fontSize: fontSize, color: step.textColor || dangerColor || 'var(--text-primary)', fontWeight: dangerColor ? 700 : 'normal', wordBreak: 'break-all', letterSpacing: step.moduleId === 'morse' ? '2px' : '0.02em', lineHeight: 1.4 }}>
                                        <HighlightedText text={encodedLine} pois={pois} isEncoded={true} sourceLine={solutionLine} onPoiToggle={onPoiToggle} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange} />
                                    </div>
                                </>
                            ) : (
                                /* Texte déjà en clair : supporte le Markdown inline (gras, italique, souligné, code, lien) sans MarkdownRenderer */
                                <div style={{ fontSize: '15px', color: step.textColor || dangerColor || 'var(--text-primary)', fontWeight: dangerColor ? 700 : 'normal', lineHeight: 1.6 }}>
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
                                <div style={{
                                    marginTop: '6px',
                                    paddingLeft: '10px',
                                    borderLeft: '2px solid var(--border-subtle)',
                                    fontSize: '13.5px',
                                    color: 'var(--text-secondary)',
                                    fontWeight: 400,
                                    lineHeight: 1.55,
                                }}>
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
    const [hovered, setHovered] = useState(false);
    const [frozen, setFrozen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const tokenId = useRef(`az-${Math.random().toString(36).slice(2)}`);
    const deg = azimutToDegres(children);

    useEffect(() => {
        if (!open) return;
        window.dispatchEvent(new CustomEvent('textual:close-menus', { detail: { except: tokenId.current } }));
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node) &&
                popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        const onScroll = () => setOpen(false);
        const onCloseOthers = (e: Event) => {
            if ((e as CustomEvent).detail?.except !== tokenId.current) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('textual:close-menus', onCloseOthers);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('textual:close-menus', onCloseOthers);
        };
    }, [open]);

    if (frozen) {
        return <span>{children}</span>;
    }

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
        <span ref={ref} style={{ position: 'relative', display: 'inline' }}>
            <span
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: 'relative',
                    display: 'inline',
                    borderBottom: '1px dotted var(--text-dim)',
                    color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit',
                    cursor: 'pointer', userSelect: 'none',
                }}
                title="Cliquer pour changer le format de direction"
            >
                {children}
                {(hovered || open) && (
                    <span
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: 'calc(100% + 2px)',
                            top: '50%',
                            transform: 'translateY(-55%)',
                            fontSize: '10px',
                            opacity: 0.75,
                            pointerEvents: 'none',
                        }}
                    >
                        ⌄
                    </span>
                )}
            </span>
            {open && rect && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popoverRef}
                    role="menu"
                    aria-label="Format de direction"
                    onMouseDown={e => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        left: Math.max(12, Math.min(rect.left, window.innerWidth - 252)),
                        top: rect.bottom + 260 > window.innerHeight ? Math.max(12, rect.top - 245) : rect.bottom + 6,
                        zIndex: 99999,
                        width: '240px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: '6px',
                        boxShadow: '0 10px 32px rgba(0, 0, 0, 0.5)',
                        overscrollBehavior: 'contain',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        animation: 'islandPopoverIn 110ms cubic-bezier(0.16, 1, 0.3, 1)',
                        boxSizing: 'border-box',
                    }}
                >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', padding: '4px 8px 4px' }}>
                        Format de direction
                    </div>
                    {navOptions.map(opt => {
                        const isCurrent = navLanguage === opt.lang;
                        return (
                            <button
                                key={opt.lang}
                                role="menuitem"
                                type="button"
                                onClick={() => { onNavLanguageChange?.(opt.lang); setOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '6px 8px', borderRadius: '6px', border: 'none',
                                    background: isCurrent ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                    cursor: onNavLanguageChange ? 'pointer' : 'default',
                                    width: '100%', textAlign: 'left', gap: '8px',
                                    transition: 'background 80ms ease',
                                }}
                                onMouseEnter={e => { if (!isCurrent && onNavLanguageChange) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                                    <span style={{ fontSize: '13px', color: isCurrent ? 'var(--accent-hover)' : 'var(--text-primary)', fontWeight: isCurrent ? 600 : 400 }}>{opt.label}</span>
                                    <span style={{ fontSize: '11.5px', color: 'var(--text-dim)', fontWeight: 400 }}>{opt.desc}</span>
                                </div>
                                <span style={{
                                    background: 'var(--bg-surface)',
                                    border: `1px solid ${isCurrent ? 'rgba(59, 130, 246, 0.35)' : 'var(--border-subtle)'}`,
                                    borderRadius: '5px', padding: '2px 7px',
                                    fontSize: '11.5px',
                                    color: isCurrent ? 'var(--accent-hover)' : 'var(--text-secondary)',
                                    fontWeight: 500,
                                    fontVariantNumeric: 'tabular-nums',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                }}>
                                    {opt.example}
                                </span>
                                {isCurrent && <Check size={13} color="var(--accent-hover)" style={{ flexShrink: 0 }} />}
                            </button>
                        );
                    })}
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '3px 0' }} />
                    <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setFrozen(true); setOpen(false); }}
                        style={{
                            padding: '6px 8px', borderRadius: '6px', border: 'none',
                            background: 'transparent', color: 'var(--text-secondary)',
                            fontSize: '12.5px', cursor: 'pointer', textAlign: 'left',
                            transition: 'background 80ms ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        Saisie libre (texte normal)
                    </button>
                </div>,
                document.body
            )}
        </span>
    );
}

// Token POI — style variable sobre : soulignement pointillé + caret au survol
function PoiToken({ pois, onPoiToggle }: { pois: Array<{ id: string; name: string; selected: boolean; type?: string }>; onPoiToggle?: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [frozen, setFrozen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const tokenId = useRef(`poi-${Math.random().toString(36).slice(2)}`);
    const selectedPoi = pois.find(p => p.selected);
    useEffect(() => {
        if (!open) return;
        window.dispatchEvent(new CustomEvent('textual:close-menus', { detail: { except: tokenId.current } }));
        const close = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node) &&
                popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        const onScroll = () => setOpen(false);
        const onCloseOthers = (e: Event) => {
            if ((e as CustomEvent).detail?.except !== tokenId.current) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', onKey);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('textual:close-menus', onCloseOthers);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', onKey);
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('textual:close-menus', onCloseOthers);
        };
    }, [open]);
    const handleSelect = (id: string) => {
        if (selectedPoi && selectedPoi.id !== id) onPoiToggle?.(selectedPoi.id);
        onPoiToggle?.(id);
        setOpen(false);
    };
    if (frozen) {
        return <span>{selectedPoi ? selectedPoi.name : '…'}</span>;
    }
    const rect = ref.current?.getBoundingClientRect();
    return (
        <span ref={ref} style={{ position: 'relative', display: 'inline' }}>
            <span
                onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    position: 'relative',
                    display: 'inline',
                    borderBottom: '1px dotted var(--text-dim)',
                    color: 'inherit', fontWeight: 'inherit', fontSize: 'inherit',
                    cursor: 'pointer', userSelect: 'none',
                }}
                title={selectedPoi ? `POI : ${selectedPoi.name}` : 'Choisir un point d\'intérêt'}
            >
                {selectedPoi ? selectedPoi.name : '…'}
                {(hovered || open) && (
                    <span
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            left: 'calc(100% + 2px)',
                            top: '50%',
                            transform: 'translateY(-55%)',
                            fontSize: '10px',
                            opacity: 0.75,
                            pointerEvents: 'none',
                        }}
                    >
                        ⌄
                    </span>
                )}
            </span>
            {open && rect && typeof document !== 'undefined' && createPortal(
                <div
                    ref={popoverRef}
                    role="menu"
                    aria-label="Points d'intérêt"
                    onMouseDown={e => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        left: Math.max(12, Math.min(rect.left, window.innerWidth - 228)),
                        top: rect.bottom + 250 > window.innerHeight ? Math.max(12, rect.top - 235) : rect.bottom + 6,
                        zIndex: 99999,
                        width: '216px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: '6px',
                        boxShadow: '0 10px 32px rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        animation: 'islandPopoverIn 110ms cubic-bezier(0.16, 1, 0.3, 1)',
                        boxSizing: 'border-box',
                    }}
                >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', padding: '4px 8px 4px' }}>
                        Points d'intérêt
                    </div>
                    {pois.map(poi => (
                        <button
                            key={poi.id}
                            role="menuitem"
                            type="button"
                            onClick={() => handleSelect(poi.id)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '6px 8px', borderRadius: '6px', border: 'none',
                                background: poi.selected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                                color: poi.selected ? 'var(--accent-hover)' : 'var(--text-primary)',
                                fontSize: '13px', fontWeight: poi.selected ? 600 : 400,
                                cursor: 'pointer', textAlign: 'left', width: '100%',
                                transition: 'background 80ms ease',
                            }}
                            onMouseEnter={e => { if (!poi.selected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                            onMouseLeave={e => { if (!poi.selected) e.currentTarget.style.background = 'transparent'; }}
                        >
                            <MapPin size={13} color={poi.selected ? 'var(--accent-hover)' : 'var(--text-dim)'} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {poi.name}
                            </span>
                            {poi.selected && <Check size={13} color="var(--accent-hover)" style={{ flexShrink: 0 }} />}
                        </button>
                    ))}
                    {pois.length === 0 && (
                        <div style={{ fontSize: '12.5px', color: 'var(--text-dim)', padding: '6px 8px' }}>Aucun POI disponible</div>
                    )}
                    <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '3px 0' }} />
                    <button
                        role="menuitem"
                        type="button"
                        onClick={() => { setFrozen(true); setOpen(false); }}
                        style={{
                            padding: '6px 8px', borderRadius: '6px', border: 'none',
                            background: 'transparent', color: 'var(--text-secondary)',
                            fontSize: '12.5px', cursor: 'pointer', textAlign: 'left',
                            transition: 'background 80ms ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        Saisie libre (texte normal)
                    </button>
                </div>,
                document.body
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

    const renderPlainTokens = (segment: string, keyPrefix: string): React.ReactNode => {
        const parts = segment.split(regex);
        return parts.map((part, i) => {
            if (!part) return null;
            if (pois && pois.length > 0 && poiName && part.toLowerCase() === selectedPoi?.name.toLowerCase()) {
                return <PoiToken key={`${keyPrefix}-${i}`} pois={pois} onPoiToggle={onPoiToggle} />;
            }
            if (new RegExp(`^${distanceRegex}$`, 'i').test(part)) {
                return <span key={`${keyPrefix}-${i}`}>{part}</span>;
            }
            if (new RegExp(`^(${azimuthRegex})$`, 'i').test(part)) {
                return <AzimutToken key={`${keyPrefix}-${i}`} navLanguage={navLanguage} onNavLanguageChange={onNavLanguageChange}>{part}</AzimutToken>;
            }
            return <span key={`${keyPrefix}-${i}`}>{part}</span>;
        });
    };

    // Parse le Markdown inline (**gras**, *italique*, <u>souligné</u>, `code`, [lien](url), $latex$, $$latex$$) sans passer par MarkdownRenderer
    const renderInlineMarkdown = (input: string, keyPrefix = 'md', depth = 0): React.ReactNode => {
        if (!input || depth > 4) return renderPlainTokens(input, keyPrefix);
        const mdRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\*\*[^*]+\*\*|\*[^*]+\*|<u>[\s\S]*?<\/u>|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
        const chunks = input.split(mdRegex);
        if (chunks.length === 1) return renderPlainTokens(input, keyPrefix);
        return chunks.map((chunk, idx) => {
            if (!chunk) return null;
            const k = `${keyPrefix}-${idx}`;
            if (chunk.startsWith('$$') && chunk.endsWith('$$') && chunk.length > 4) {
                const html = katex.renderToString(chunk.slice(2, -2).trim(), { displayMode: true, throwOnError: false });
                return <span key={k} style={{ display: 'block', textAlign: 'center', margin: '6px 0' }} dangerouslySetInnerHTML={{ __html: html }} />;
            }
            if (chunk.startsWith('$') && chunk.endsWith('$') && chunk.length > 2) {
                const html = katex.renderToString(chunk.slice(1, -1).trim(), { displayMode: false, throwOnError: false });
                return <span key={k} style={{ display: 'inline-block', verticalAlign: 'middle', padding: '0 2px' }} dangerouslySetInnerHTML={{ __html: html }} />;
            }
            if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4) {
                return <strong key={k}>{renderInlineMarkdown(chunk.slice(2, -2), k, depth + 1)}</strong>;
            }
            if (chunk.startsWith('*') && chunk.endsWith('*') && chunk.length > 2) {
                return <em key={k}>{renderInlineMarkdown(chunk.slice(1, -1), k, depth + 1)}</em>;
            }
            if (chunk.startsWith('<u>') && chunk.endsWith('</u>') && chunk.length > 7) {
                return <u key={k}>{renderInlineMarkdown(chunk.slice(3, -4), k, depth + 1)}</u>;
            }
            if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length > 2) {
                return (
                    <code
                        key={k}
                        style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.9em',
                            background: 'var(--bg-hover)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                        }}
                    >
                        {chunk.slice(1, -1)}
                    </code>
                );
            }
            const linkMatch = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (linkMatch) {
                return (
                    <a
                        key={k}
                        href={linkMatch[2]}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ color: 'var(--accent-hover)', textDecoration: 'underline' }}
                    >
                        {renderInlineMarkdown(linkMatch[1], k, depth + 1)}
                    </a>
                );
            }
            return renderPlainTokens(chunk, k);
        });
    };

    return <>{renderInlineMarkdown(text)}</>;
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
                segments.push(<span key={`dist-${si}`}>{slice}</span>);
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
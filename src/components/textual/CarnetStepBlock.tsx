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
    FileText, Key, Sigma, Zap, Settings, Palette, ChevronRight
} from 'lucide-react';

import type { CarnetStep, ModuleId, CarnetView, NavLanguage } from '../../logic/types';
import { MODULE_META, ALL_MODULE_IDS } from '../../logic/ModuleRegistry';
import { useApp } from '../../AppContext';
import { PolygonalEngine } from '../../logic/PolygonalEngine';
import InlineEditor from './InlineEditor';
import MiniMap, { calculateZoomForScale, calculateScaleForZoom } from './MiniMap';
import UnifiedContextMenu from './UnifiedContextMenu';
import BlockGutter, { GUTTER_WIDTH } from './BlockGutter';
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
    onPoiToggle?: (stepId?: string, segIdx?: number, poiId: string) => void;
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
}

// ─── Configuration marked ─────────────────────────────────────────────────

marked.use({ gfm: true, breaks: true });

// ─── Composant principal ──────────────────────────────────────────────────

export default function CarnetStepBlock({
    step, stepIndex = 0, view, onModuleChange, onManualContentChange, onRemoveStep,
    onNavLanguageChange, onPoiToggle, onLineClick, onAddInlineCode,
    selectedKeys, onItemSelect, stageLabelMap,
    onDuplicateStep, onMoveStepUp, onMoveStepDown, onCopyStep,
    onLinkReference, onOpenFontSelector, onOpenSettings,
    blockFontConfigs = {}
}: CarnetStepBlockProps) {
    const { state, dispatch } = useApp();
    const isSolution = view === 'solution';

    // Blocs manuels (HTML ou Code)
    if (step.isManual) {
        const lineKey = `step-${step.id}`;
        const isSelected = selectedKeys?.has(lineKey) || false;
        const lineLabel = stageLabelMap?.get(lineKey) || '';

        if (step.manualType === 'html') {
            return (
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
            );
        }
        if (step.manualType === 'code') {
            return (
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

                    return (
                        <React.Fragment key={idx}>
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
                                lineLabel={lineLabel}
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
    const isTitle = step.isTitleStep || step.id === 'manual-title' || (stepIndex === 0 && step.isManual);

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
        dispatch({ type: 'LOCK_DOCUMENT_TITLE' });
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

    // Mobile double-tap → enter edit mode
    const handleTouchEnd = () => {
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
        >
            {/* Gutter unifié : indicateur + label étape + menu 3 points */}
            <BlockGutter
                blockType={isTitle ? 'title' : 'html'}
                blockData={step}
                stepLabel={isTitle ? undefined : undefined} // Pas de label A,B,C pour les commentaires
                isTitle={isTitle}
                isSelected={false}
                onEdit={startEditing}
                onDelete={() => onRemoveStep?.(step.id)}
                onDuplicate={onDuplicate}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onCopy={onCopy}
                onLinkRef={onLinkRef}
                onConvertToCode={(cipher) => {
                    dispatch({
                        type: 'CONVERT_MANUAL_STEP_TYPE',
                        stepId: step.id,
                        targetType: 'code',
                        moduleId: cipher,
                    });
                }}
                onOpenFonts={onOpenFonts}
                onOpenSettings={onOpenSettings}
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
                            placeholder={isTitle ? 'Titre du raid / document…' : 'Écrivez en Markdown… (# titre, **gras**, *italique*, $latex$, ```code```, [morse]...[/morse])'}
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                borderBottom: '1.5px solid var(--accent-default)',
                                borderRadius: 0,
                                color: 'var(--text-primary)',
                                fontSize: isTitle ? '17px' : '13px',
                                fontWeight: isTitle ? 700 : 400,
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
                                fontSize: isTitle ? '17px' : '13px',
                                fontWeight: isTitle ? 700 : 400,
                                fontStyle: isTitle ? 'normal' : 'italic',
                                paddingTop: isTitle ? '2px' : '4px',
                                letterSpacing: isTitle ? '0.02em' : 'normal',
                            }}>
                                {isTitle ? 'Titre du raid / document…' : 'Écrivez en Markdown… (# titre, **gras**, *italique*, $latex$, ```code```, [morse]...[/morse])'}
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
                                fontSize: isTitle ? '17px' : '13px',
                                fontWeight: isTitle ? 700 : 400,
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

            {/* Menu contextuel unifié (3 points) - clic gauche */}
            <UnifiedContextMenu
                blockType={isTitle ? 'title' : 'html'}
                blockId={step.id}
                blockData={step}
                availableCiphers={['morse', 'vigenere', 'polybe', 'templier', 'maritime', 'avocat', 'cassis', 'texte_clair']}
                triggerRef={useRef(null)}
                onEdit={startEditing}
                onDelete={() => onRemoveStep?.(step.id)}
                onDuplicate={() => onDuplicate?.(step.id)}
                onMoveUp={() => onMoveUp?.(step.id)}
                onMoveDown={() => onMoveDown?.(step.id)}
                onCopy={() => onCopy?.(step.id)}
                onLinkReference={() => onLinkRef?.(step.id)}
                onConvertToCode={(cipher) => {
                    dispatch({
                        type: 'CONVERT_MANUAL_STEP_TYPE',
                        stepId: step.id,
                        targetType: 'code',
                        moduleId: cipher,
                    });
                }}
                onOpenFontSelector={() => onOpenFonts?.(step.id)}
                onOpenSettings={() => onOpenSettings?.(step.id)}
            />
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
    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = CIPHER_FONTS[step.moduleId] || 'monospace';
    const fontSize = CIPHER_FONT_SIZES[step.moduleId] || '14px';
    const displayText = isSolution ? (step.solutionText || '') : (step.encodedText || step.solutionText || '');
    const isEncoded = !isSolution && step.encodedText && step.encodedText !== step.solutionText;

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
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Gutter unifié : indicateur + menu 3 points */}
            <BlockGutter
                blockType="code"
                blockData={step}
                moduleId={step.moduleId}
                isSelected={isSelected}
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
                containerRef={blockRef}
            />

            {/* Contenu éditable */}
            <div style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none' }}>
                <textarea
                    value={step.solutionText || ''}
                    onChange={e => onManualContentChange?.(step.id, e.target.value)}
                    onBlur={() => dispatch({ type: 'LOCK_DOCUMENT_TITLE' })}
                    placeholder={step.isTitleStep || stepIndex === 0 ? "Titre du raid / document…" : "Tapez le texte à encoder…"}
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
                {isSolution && step.solutionText && (
                    <div style={{
                        marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px',
                        fontSize: '11px', color: 'var(--semantic-green)', fontWeight: 600,
                    }}>
                        <Lightbulb size={12} strokeWidth={2.4} color="var(--semantic-green)" style={{ flexShrink: 0 }} />
                        <span>Solution : {step.solutionText}</span>
                    </div>
                )}
                {hovered && !isSolution && step.solutionText && step.encodedText && step.encodedText !== step.solutionText && (
                    <div style={{
                        marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px',
                        fontSize: '11px', color: 'var(--semantic-green)', fontWeight: 600,
                    }}>
                        <Lightbulb size={11} strokeWidth={2.4} color="var(--semantic-green)" style={{ flexShrink: 0 }} />
                        <span>Solution : {step.solutionText}</span>
                    </div>
                )}
            </div>

            {/* Menu contextuel unifié */}
            <UnifiedContextMenu
                blockType="code"
                blockId={step.id}
                blockData={step}
                availableCiphers={TEXTUAL_CIPHERS}
                triggerRef={useRef(null)}
                onEdit={() => {}} // Double-clic géré par le textarea
                onDelete={() => onRemoveStep?.(step.id)}
                onDuplicate={() => onDuplicate?.(step.id)}
                onMoveUp={() => onMoveUp?.(step.id)}
                onMoveDown={() => onMoveDown?.(step.id)}
                onCopy={() => onCopy?.(step.id)}
                onLinkReference={() => onLinkRef?.(step.id)}
                onChangeCipher={handleSwitchModule}
                onConvertToHtml={handleConvertToComment}
                onOpenSettings={() => onOpenSettings?.(step.id)}
            />
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
    lineLabel: string;
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
    lineLabel, dangerLevel, navLanguage, pois, onModuleChange, onNavLanguageChange,
    onLineClick, onPoiToggle, onDuplicate, onMoveUp, onMoveDown, onCopy,
    onLinkRef, onOpenSettings
}: ComputedStepLineProps) {
    const { state, dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const hasMap = ['carte_ign', 'drapeaux'].includes(step.moduleId) && step.coords && step.coords.length > 0;
    const hasGilwell = step.moduleId === 'gilwell' && step.gilwellSvg;

    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = CIPHER_FONTS[step.moduleId] || 'monospace';
    const fontSize = CIPHER_FONT_SIZES[step.moduleId] || '14px';

    const isEncoded = !isSolutionView && !isVisual && encodedLine !== solutionLine;

    let dangerColor: string | undefined;
    if (dangerLevel === 'extreme' || dangerLevel === 'motorway_cross') dangerColor = '#ef4444';
    else if (dangerLevel === 'high') dangerColor = '#f97316';
    else if (dangerLevel === 'minor') dangerColor = '#eab308';

    let dotColor = 'var(--accent-default)';
    if (lineLabel) {
        const stageIdx = state.stages.findIndex((st: any) => st.label === lineLabel);
        if (stageIdx === 0) dotColor = 'var(--semantic-green)';
        else if (stageIdx === state.stages.length - 1 && stageIdx > 0) dotColor = 'var(--semantic-red)';
    }

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

    // Référence pour le bouton 3 points
    const blockRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    return (
        <div
            ref={blockRef}
            id={`carnet-step-${step.id}-${lineIdx}`}
            style={{
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                minHeight: '26px',
                padding: '2px 0 4px 0',
                zIndex: hovered ? 150 : 1,
                borderRadius: '6px',
                transition: 'box-shadow 0.25s ease, background-color 0.2s ease',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onDoubleClick={handleDoubleClick}
        >
            {/* Gutter unifié : indicateur + label étape (A,B,C) + menu 3 points */}
            <BlockGutter
                blockType={isVisual ? (hasMap ? 'map' : 'generic') : 'computed'}
                blockData={step}
                stepLabel={lineLabel}
                stepColor={dotColor}
                moduleId={step.moduleId}
                isSelected={isSelected}
                onEdit={() => setIsEditing(true)}
                onDuplicate={() => onDuplicate?.(step.id)}
                onMoveUp={() => onMoveUp?.(step.id)}
                onMoveDown={() => onMoveDown?.(step.id)}
                onCopy={() => onCopy?.(step.id)}
                onLinkRef={() => onLinkRef?.(lineKey)}
                onChangeCipher={(cipher) => onModuleChange?.(cipher)}
                onChangeLanguage={(lang) => onNavLanguageChange?.(lang)}
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
                hasSolution={!!step.solutionText && step.solutionText !== step.encodedText}
                navLanguage={navLanguage}
                pois={pois}
                containerRef={blockRef}
            />

            {/* Corps du texte - avec badge d'étape (A, B, C) + ligne horizontale DANS LE CONTENU PRINCIPAL */}
            <div style={{
                width: '100%', minWidth: 0, position: 'relative',
                background: isSelected ? 'rgba(37, 99, 235, 0.12)' : (hovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent'),
                border: isSelected ? '1px solid var(--accent-default)' : '1px solid transparent',
                borderRadius: '8px', padding: '3px 6px', boxSizing: 'border-box',
                transition: 'background-color 120ms ease, border-color 120ms ease',
                display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
                {/* Badge d'étape (A, B, C...) + ligne horizontale - DANS LE CONTENU PRINCIPAL */}
                {lineLabel && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        marginBottom: '4px',
                        userSelect: 'none'
                    }}>
                        <div
                            title={`Étape ${lineLabel}`}
                            style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '5px',
                                background: 'var(--bg-base)',
                                border: `2px solid ${dotColor}`,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: dotColor,
                                fontWeight: 800,
                                fontSize: '11px',
                                fontFamily: 'var(--font-mono)',
                                flexShrink: 0
                            }}
                        >
                            {lineLabel}
                        </div>
                        <div style={{
                            flex: 1,
                            height: '2px',
                            borderRadius: '999px',
                            background: dotColor,
                        }} />
                    </div>
                )}

                <div style={{
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px'
                }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                        <InlineEditor stepId={step.id} solutionText={solutionLine} moduleId={step.moduleId} lineIdx={lineIdx} onClose={() => setIsEditing(false)} />
                    ) : !isVisual ? (
                        <div style={{ cursor: 'pointer' }} onClick={handleLineClickInternal}>
                            {isSolutionView ? (
                                <div style={{ fontSize: '13px', color: dangerColor || 'var(--semantic-green)', fontWeight: dangerColor ? 700 : 600, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Lightbulb size={13} strokeWidth={2.4} color={dangerColor || 'var(--semantic-green)'} style={{ flexShrink: 0 }} />
                                    <HighlightedText text={solutionLine} pois={pois} isEncoded={false} />
                                </div>
                            ) : isEncoded ? (
                                <>
                                    <div style={{ fontFamily: font, fontSize: fontSize, color: dangerColor || 'var(--text-primary)', fontWeight: dangerColor ? 700 : 'normal', wordBreak: 'break-all', letterSpacing: step.moduleId === 'morse' ? '2px' : '0.02em', lineHeight: 1.4 }}>
                                        <HighlightedText text={encodedLine} pois={pois} isEncoded={true} />
                                    </div>
                                    {(hovered || isSolutionView) && (
                                        <div style={{ fontSize: '11px', color: dangerColor || 'var(--semantic-green)', marginTop: '3px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <Lightbulb size={11} strokeWidth={2.4} color={dangerColor || 'var(--semantic-green)'} style={{ flexShrink: 0 }} />
                                            <HighlightedText text={solutionLine} pois={pois} isEncoded={false} />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ fontSize: '13px', color: dangerColor || 'var(--text-primary)', fontWeight: dangerColor ? 700 : 'normal', lineHeight: 1.5 }}>
                                    <HighlightedText text={encodedLine} pois={pois} isEncoded={false} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ cursor: 'pointer' }} onClick={handleLineClickInternal}>
                            {hasGilwell && <div dangerouslySetInnerHTML={{ __html: step.gilwellSvg! }} style={{ marginBottom: '10px', textAlign: 'left' }} />}
                            {hasMap && isFirst && (
                                <MiniMap stepId={step.id} moduleId={step.moduleId} coords={step.coords} initialPersist={step.mapPersist} />
                            )}
                            {isSolutionView && (
                                <div style={{ fontSize: '11.5px', color: 'var(--semantic-green)', marginTop: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <Lightbulb size={12} strokeWidth={2.4} color="var(--semantic-green)" style={{ flexShrink: 0 }} />
                                    <HighlightedText text={solutionLine} pois={pois} isEncoded={false} />
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

interface HighlightedTextProps {
    text: string;
    pois?: any[];
    isEncoded: boolean;
}

const HighlightedText = ({ text, pois, isEncoded }: HighlightedTextProps) => {
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
                segments.push(<HighlightedTextCore key={`before-${lastIndex}`} text={before} pois={pois} isEncoded={isEncoded} />);
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
            segments.push(<HighlightedTextCore key={`after-${lastIndex}`} text={remaining} pois={pois} isEncoded={isEncoded} />);
        }

        return <>{segments}</>;
    }

    return <HighlightedTextCore text={text} pois={pois} isEncoded={isEncoded} />;
}

interface HighlightedTextCoreProps {
    text: string;
    pois?: any[];
    isEncoded: boolean;
}

const HighlightedTextCore = ({ text, pois, isEncoded }: HighlightedTextCoreProps) => {
    if (!text || isEncoded) return <>{text}</>;

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

    const patterns = [];
    if (poiName) patterns.push(poiName);
    patterns.push(distanceRegex);
    patterns.push(azimuthRegex);

    const regex = new RegExp(`(${patterns.join('|')})`, 'g');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) => {
                if (!part) return null;

                if (poiName && part.toLowerCase() === selectedPoi?.name.toLowerCase()) {
                    return <span key={i} style={{ color: '#fbbf24', fontWeight: 700 }}>{part}</span>;
                }
                if (new RegExp(`^${distanceRegex}$`).test(part)) {
                    return <span key={i} style={{ color: '#34d399', fontWeight: 700 }}>{part}</span>;
                }
                if (new RegExp(`^${azimuthRegex}$`).test(part)) {
                    return <span key={i} style={{ color: '#60a5fa', fontWeight: 700 }}>{part}</span>;
                }

                return <span key={i}>{part}</span>;
            })}
        </>
    );
}
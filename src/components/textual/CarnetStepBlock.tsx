import React, { useState, useMemo, useRef, useEffect } from 'react';
import { marked } from 'marked';
import { Eye, ChevronDown, Check, Trash2, Globe, Edit2, MessageSquarePlus, Code2, Ruler, Layers, Lock, Unlock, Compass, AlertTriangle, X, SlidersHorizontal, CheckSquare, MoreVertical, Lightbulb } from 'lucide-react';

import type { CarnetStep, ModuleId, CarnetView } from '../../logic/types';
import { MODULE_META } from '../../logic/ModuleRegistry';
import { useApp } from '../../AppContext';
import { PolygonalEngine } from '../../logic/PolygonalEngine';
import InlineEditor from './InlineEditor';
import MiniMap, { calculateZoomForScale, calculateScaleForZoom } from './MiniMap';

const MODULE_FONT: Record<string, string> = {
    morse:    '"Morse", "Courier New", monospace',
    polybe:   '"Courier New", monospace',
    vigenere: '"Courier New", monospace',
    templier: '"TemplarsCipherPlus", "Times New Roman", serif',
    cassis:   '"Kalam", cursive, sans-serif',
    avocat:   '"Kalam", cursive, sans-serif',
    maritime: '"Maritime", "Courier New", monospace',
    gilwell:  '"Inter", sans-serif',
    drapeaux: '"Inter", sans-serif',
    carte_ign:'sans-serif',
    texte_clair: '"Segoe UI", sans-serif',
};

const MODULE_FONT_SIZE: Record<string, string> = {
    morse:    '24px', templier: '28px', cassis: '16px', avocat: '16px',
    vigenere: '14px', polybe: '14px', maritime: '32px', default: '14px',
};

const NAV_LANGUAGES = ['Horaire', 'Cardinaux', 'Azimut', 'Tournant'] as const;
const ALL_MODULES = Object.keys(MODULE_META) as ModuleId[];

export default function CarnetStepBlock({
    step, stepIndex = 0, view, onModuleChange, onManualContentChange, onRemoveStep, onNavLanguageChange, onPoiToggle, onLineClick, onAddInlineCode,
    selectedKeys, onItemSelect, stageLabelMap
}: any) {
    const { state, dispatch } = useApp();
    const isSolution = view === 'solution';

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
                    onItemSelect={(e: React.MouseEvent) => onItemSelect && onItemSelect(lineKey, e, undefined, step.id)}
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
                    isSolution={view === 'solution'} 
                    isSelected={isSelected}
                    onItemSelect={(e: React.MouseEvent) => onItemSelect && onItemSelect(lineKey, e, undefined, step.id)}
                />
            );
        }
    }

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
                    let relativeIdx = -1;
                    if (state.route_chain && state.polygonal_legs) {
                        let count = 0;
                        for (const lId of state.route_chain) {
                            const lSegs = state.polygonal_legs[lId];
                            if (lSegs) {
                                if (segIdx >= count && segIdx < count + lSegs.length) {
                                    legKey = lId;
                                    relativeIdx = segIdx - count;
                                    break;
                                }
                                count += lSegs.length;
                            }
                        }
                    }
                    
                    if (!legKey) return null;
                    const route = state.routes.find((r: any) => r.id === legKey);
                    if (!route || !route.geojson) return null;
                    
                    // Concatenated geometry
                    const allOriginalCoords = state.routes.flatMap((r: any) => 
                        r?.geojson?.geometry?.coordinates || r?.geojson?.coordinates || []
                    );

                    const startIdx = seg.properties?.start_idx || 0;
                    const endIdx = seg.properties?.point_idx || 0;
                    
                    let startM = 0;
                    for (let i = 0; i < startIdx; i++) {
                        if (allOriginalCoords[i] && allOriginalCoords[i+1]) {
                            startM += PolygonalEngine.calculateDistance(allOriginalCoords[i], allOriginalCoords[i+1]);
                        }
                    }
                    let endM = startM;
                    for (let i = startIdx; i < endIdx; i++) {
                        if (allOriginalCoords[i] && allOriginalCoords[i+1]) {
                            endM += PolygonalEngine.calculateDistance(allOriginalCoords[i], allOriginalCoords[i+1]);
                        }
                    }

                    // Check danger_intervals from IGNClient
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
                                step={step} stepIndex={stepIndex} lineIdx={idx} segIdx={segIdx}
                                lineKey={lineKey}
                                isSelected={isSelected}
                                onItemSelect={(e: React.MouseEvent) => onItemSelect && onItemSelect(lineKey, e, segIdx, step.id)}
                                encodedLine={line} solutionLine={solutionLines[idx] || line}
                                distance={distance} azimuth={azimuth}
                                isFirst={idx === 0} isSolutionView={isSolution} isVisual={isVisual}
                                lineLabel={lineLabel}
                                dangerLevel={getDangerLevel(segIdx)}
                                navLanguage={segIdx !== undefined ? state.custom_languages?.[segIdx.toString()] : step.navLanguage}
                                pois={segIdx !== undefined ? state.segment_pois?.[segIdx.toString()] : step.pois}
                                onModuleChange={(mod: string) => {
                                    if (step.isManual) onModuleChange(step.id, mod);
                                    else if (segIdx !== undefined) dispatch({ type: 'ASSIGN_MODULES_RANGE', startIdx: segIdx, endIdx: segIdx, moduleId: mod });
                                }}
                                onNavLanguageChange={(lang: any) => {
                                    if (step.isManual) onNavLanguageChange(step.id, lang);
                                    else if (segIdx !== undefined) dispatch({ type: 'SET_NAV_LANGUAGE', segIdx, lang });
                                }}
                                onLineClick={() => onLineClick && onLineClick(step, segIdx)}
                                onPoiToggle={(poiId: string) => {
                                    if (segIdx !== undefined) dispatch({ type: 'TOGGLE_POI', segIdx, poiId });
                                }}
                            />
                            {step.inlineManualSteps && segIdx !== undefined && step.inlineManualSteps[segIdx] && (
                                step.inlineManualSteps[segIdx].manualType === 'html' ? (
                                    <ManualStepHtml 
                                        step={step.inlineManualSteps[segIdx]} 
                                        onManualContentChange={onManualContentChange} 
                                        onRemoveStep={onRemoveStep} 
                                    />
                                ) : (
                                    <ManualCodeBlock
                                        step={step.inlineManualSteps[segIdx]}
                                        onManualContentChange={onManualContentChange}
                                        onRemoveStep={onRemoveStep}
                                        isSolution={isSolution}
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

const TEXTUAL_MODULE_CHOICES: { id: ModuleId; label: string; color: string; desc: string }[] = [
    { id: 'morse', label: 'Morse', color: '#ef4444', desc: 'Points & traits sonores' },
    { id: 'vigenere', label: 'Vigenère', color: '#8b5cf6', desc: 'Chiffre polyalphabétique' },
    { id: 'avocat', label: 'Code Avocat', color: '#3b82f6', desc: 'César A=K' },
    { id: 'cassis', label: 'Code Cassis', color: '#ec4899', desc: 'César K=6' },
    { id: 'polybe', label: 'Polybe', color: '#06b6d4', desc: 'Grille 6×6' },
    { id: 'templier', label: 'Templier', color: '#f59e0b', desc: 'Chiffre maçonnique pigpen' },
    { id: 'texte_clair', label: 'Texte en clair', color: '#94a3b8', desc: 'Sans encodage' },
];

/** Configure marked once for the whole file */
marked.use({
    gfm: true,
    breaks: true,
});

/**
 * Markdown + custom cipher tags → HTML.
 * Cipher tags are protected before marked runs, then restored as <span> after.
 */
function renderManualHtml(raw: string): string {
    if (!raw) return '';

    // Protect cipher tags from marked (use null-byte placeholders)
    const protected_ = raw
        .replace(/\[morse\]([\s\S]*?)\[\/morse\]/gi,     '\x00morse\x01$1\x00/morse\x01')
        .replace(/\[templier\]([\s\S]*?)\[\/templier\]/gi, '\x00templier\x01$1\x00/templier\x01')
        .replace(/\[maritime\]([\s\S]*?)\[\/maritime\]/gi, '\x00maritime\x01$1\x00/maritime\x01')
        .replace(/\[code\]([\s\S]*?)\[\/code\]/gi,       '\x00code\x01$1\x00/code\x01');

    // Run marked (returns string synchronously with gfm:true)
    let html = marked.parse(protected_) as string;

    // Restore cipher tags as styled spans
    html = html
        .replace(/\x00morse\x01([\s\S]*?)\x00\/morse\x01/g,       '<span class="font-morse">$1</span>')
        .replace(/\x00templier\x01([\s\S]*?)\x00\/templier\x01/g,   '<span class="font-templier">$1</span>')
        .replace(/\x00maritime\x01([\s\S]*?)\x00\/maritime\x01/g,   '<span class="font-maritime">$1</span>')
        .replace(/\x00code\x01([\s\S]*?)\x00\/code\x01/g,           '<span class="font-mono-tag">$1</span>');

    return html;
}

function ManualStepHtml({ step, onManualContentChange, onRemoveStep, stepIndex = 0 }: any) {
    const { dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
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

    // Auto-resize textarea when entering edit mode
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.selectionStart = textareaRef.current.value.length;
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing]);

    const handleConvertToCode = (mId: ModuleId) => {
        dispatch({
            type: 'CONVERT_MANUAL_STEP_TYPE',
            stepId: step.id,
            targetType: 'code',
            moduleId: mId,
        });
        setOptionsMenuOpen(false);
    };

    const startEditing = () => {
        setEditValue(step.solutionText || '');
        setIsEditing(true);
        setOptionsMenuOpen(false);
    };

    const handleValidate = () => {
        onManualContentChange(step.id, editValue);
        dispatch({ type: 'LOCK_DOCUMENT_TITLE' });
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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

    return (
        <div 
            id={`carnet-step-${step.id}`}
            style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                position: 'relative', 
                minHeight: '36px',
                padding: '4px 0',
                zIndex: hovered || optionsMenuOpen ? 50 : 1
            }} 
            onMouseEnter={() => setHovered(true)} 
            onMouseLeave={() => {
                if (!isEditing) setHovered(false);
                setOptionsMenuOpen(false);
            }}
        >
            <div style={{
                width: '22px', height: '22px', borderRadius: '5px',
                background: isTitle ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-surface)',
                border: isTitle ? '1px solid rgba(37, 99, 235, 0.35)' : '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '4px', marginRight: '10px'
            }}>
                <MessageSquarePlus size={11} color={isTitle ? "var(--accent-hover)" : "var(--text-dim)"} strokeWidth={2.4} />
            </div>

            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                {isEditing ? (
                    /* ── Mode édition ── */
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                        <textarea
                            ref={textareaRef}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onInput={handleTextareaInput}
                            rows={1}
                            placeholder={isTitle ? 'Titre du raid / document…' : 'Tapez ici votre commentaire…'}
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
                                overflow: 'hidden',
                            }}
                        />
                        {/* Coche verte — même style que InlineEditor */}
                        <button
                            type="button"
                            onClick={handleValidate}
                            title="Valider (Entrée)"
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
                    /* ── Mode vue ── */
                    <div>
                        {isEmpty && (
                            <div style={{
                                color: 'rgba(255,255,255,0.28)',
                                fontSize: isTitle ? '17px' : '12px',
                                fontWeight: isTitle ? 700 : 400,
                                fontStyle: isTitle ? 'normal' : 'italic',
                                pointerEvents: 'none',
                                paddingTop: isTitle ? '2px' : '4px',
                                letterSpacing: isTitle ? '0.02em' : 'normal',
                            }}>
                                {isTitle ? 'Titre du raid / document…' : 'Tapez ici votre commentaire…'}
                            </div>
                        )}
                        <div
                            className="manual-html-view ck-content"
                            onDoubleClick={startEditing}
                            onTouchEnd={handleTouchEnd}
                            title="Double-cliquer pour éditer"
                            dangerouslySetInnerHTML={{ __html: renderManualHtml(rawContent) }}
                            style={{
                                fontSize: isTitle ? '17px' : '13px',
                                fontWeight: isTitle ? 700 : 400,
                                color: 'var(--text-primary)',
                                lineHeight: 1.6,
                                cursor: 'text',
                                padding: '2px 0',
                                minHeight: '24px',
                                outline: 'none',
                                wordBreak: 'break-word',
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Bouton d'accès aux options (3 points verticaux) identique aux autres étapes */}
            <div style={{ position: 'relative', flexShrink: 0, marginLeft: '8px', marginTop: '2px' }}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOptionsMenuOpen(v => !v);
                    }}
                    title="Options du commentaire"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        border: 'none',
                        background: 'transparent',
                        color: optionsMenuOpen ? 'var(--accent-hover)' : 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: 0,
                        opacity: (hovered || optionsMenuOpen) ? 1 : 0.35,
                        transition: 'opacity 120ms ease, color 120ms ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.color = optionsMenuOpen ? 'var(--accent-hover)' : 'var(--text-dim)';
                        e.currentTarget.style.opacity = (hovered || optionsMenuOpen) ? '1' : '0.35';
                    }}
                >
                    <MoreVertical size={16} strokeWidth={2} />
                </button>

                {optionsMenuOpen && (
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            zIndex: 200,
                            minWidth: '220px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '10px',
                            padding: '5px',
                            boxShadow: 'var(--shadow-md)',
                            animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        {/* Éditer */}
                        <button
                            type="button"
                            onClick={startEditing}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                width: '100%', padding: '6px 8px', borderRadius: '7px',
                                border: 'none', background: 'transparent',
                                color: 'var(--text-primary)', fontSize: '11.5px',
                                fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                                transition: 'background 100ms'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Edit2 size={12} />
                            <span>Éditer le texte</span>
                        </button>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Convertir en Code
                        </div>
                        {TEXTUAL_MODULE_CHOICES.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleConvertToCode(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 100ms'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div>{item.label}</div>
                                    <div style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 400 }}>{item.desc}</div>
                                </div>
                            </button>
                        ))}
                        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                        <button
                            type="button"
                            onClick={() => {
                                onRemoveStep(step.id);
                                setOptionsMenuOpen(false);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '7px',
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Trash2 size={13} />
                            <span>Supprimer le commentaire</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ManualCodeBlock({ step, onManualContentChange, onRemoveStep, isSolution, stepIndex = 0 }: any) {
    const { dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = MODULE_FONT[step.moduleId] || MODULE_FONT.default;
    const fontSize = MODULE_FONT_SIZE[step.moduleId] || MODULE_FONT_SIZE.default;
    const displayText = isSolution ? (step.solutionText || '') : (step.encodedText || step.solutionText || '');
    const isEncoded = !isSolution && step.encodedText && step.encodedText !== step.solutionText;

    const handleConvertToComment = () => {
        dispatch({
            type: 'CONVERT_MANUAL_STEP_TYPE',
            stepId: step.id,
            targetType: 'html',
        });
        setOptionsMenuOpen(false);
    };

    const handleSwitchModule = (mId: ModuleId) => {
        dispatch({
            type: 'MANUAL_MODULE_ASSIGNMENT',
            stepId: step.id,
            moduleId: mId,
        });
        setOptionsMenuOpen(false);
    };

    return (
        <div
            id={`carnet-step-${step.id}`}
            style={{ 
                display: 'flex', 
                alignItems: 'flex-start',
                position: 'relative', 
                minHeight: '44px',
                padding: '4px 0',
                zIndex: hovered || optionsMenuOpen ? 50 : 1
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => {
                setHovered(false);
                setOptionsMenuOpen(false);
            }}
        >
            <div style={{
                width: '22px', height: '22px', borderRadius: '5px',
                background: `${accentColor}18`, border: `1.5px solid ${accentColor}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: '4px', marginRight: '10px'
            }}>
                <Code2 size={11} color={accentColor} strokeWidth={2.5} />
            </div>

            <div style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none' }}>
                {/* Editable source */}
                <textarea
                    value={step.solutionText || ''}
                    onChange={e => onManualContentChange(step.id, e.target.value)}
                    onBlur={() => dispatch({ type: 'LOCK_DOCUMENT_TITLE' })}
                    placeholder={step.isTitleStep || stepIndex === 0 ? "Titre du raid / document…" : "Tapez le texte à encoder…"}
                    style={{
                        width: '100%', background: 'var(--bg-base)',
                        border: `1px solid ${hovered ? accentColor + '60' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-xs)', color: 'var(--text-primary)', fontSize: '12px',
                        fontFamily: 'var(--font-ui)', lineHeight: 1.5,
                        padding: '6px 8px', resize: 'none', outline: 'none',
                        boxSizing: 'border-box', minHeight: '36px',
                        transition: 'border-color 0.15s',
                        overflow: 'hidden',
                    }}
                    rows={1}
                    onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px'; }}
                />
                {/* Encoded output */}
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
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        color: 'var(--semantic-green)',
                        fontWeight: 600,
                    }}>
                        <Lightbulb size={12} strokeWidth={2.4} color="var(--semantic-green)" style={{ flexShrink: 0 }} />
                        <span>Solution : {step.solutionText}</span>
                    </div>
                )}
                {hovered && !isSolution && step.solutionText && step.encodedText && step.encodedText !== step.solutionText && (
                    <div style={{
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '11px',
                        color: 'var(--semantic-green)',
                        fontWeight: 600,
                    }}>
                        <Lightbulb size={11} strokeWidth={2.4} color="var(--semantic-green)" style={{ flexShrink: 0 }} />
                        <span>Solution : {step.solutionText}</span>
                    </div>
                )}
            </div>

            {/* Bouton d'accès aux options (3 points verticaux) identique aux autres étapes */}
            <div style={{ position: 'relative', flexShrink: 0, marginLeft: '8px', marginTop: '2px' }}>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        setOptionsMenuOpen(v => !v);
                    }}
                    title="Options du bloc de code"
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '22px',
                        height: '22px',
                        border: 'none',
                        background: 'transparent',
                        color: optionsMenuOpen ? 'var(--accent-hover)' : 'var(--text-dim)',
                        cursor: 'pointer',
                        padding: 0,
                        opacity: (hovered || optionsMenuOpen) ? 1 : 0.35,
                        transition: 'opacity 120ms ease, color 120ms ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.color = 'var(--text-primary)';
                        e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.color = optionsMenuOpen ? 'var(--accent-hover)' : 'var(--text-dim)';
                        e.currentTarget.style.opacity = (hovered || optionsMenuOpen) ? '1' : '0.35';
                    }}
                >
                    <MoreVertical size={16} strokeWidth={2} />
                </button>

                {optionsMenuOpen && (
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            zIndex: 200,
                            minWidth: '220px',
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '10px',
                            padding: '5px',
                            boxShadow: 'var(--shadow-md)',
                            animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                    >
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '4px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Changer de Code
                        </div>
                        {TEXTUAL_MODULE_CHOICES.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSwitchModule(item.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    background: item.id === step.moduleId ? `${item.color}15` : 'transparent',
                                    color: item.id === step.moduleId ? item.color : 'var(--text-primary)',
                                    fontSize: '11.5px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background 100ms'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = item.id === step.moduleId ? `${item.color}15` : 'transparent'}
                            >
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <div>{item.label}</div>
                                    <div style={{ fontSize: '9.5px', color: 'var(--text-dim)', fontWeight: 400 }}>{item.desc}</div>
                                </div>
                                {item.id === step.moduleId && <Check size={11} color={item.color} strokeWidth={2.8} />}
                            </button>
                        ))}
                        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0' }} />
                        <button
                            type="button"
                            onClick={handleConvertToComment}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '7px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--text-primary)',
                                fontSize: '11.5px',
                                fontWeight: 500,
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <MessageSquarePlus size={13} strokeWidth={2.2} />
                            <span>Convertir en Commentaire</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onRemoveStep(step.id);
                                setOptionsMenuOpen(false);
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '7px',
                                border: 'none',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textAlign: 'left',
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <Trash2 size={13} />
                            <span>Supprimer le bloc</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function ComputedStepLine({
    step, stepIndex = 0, lineIdx, segIdx, lineKey, isSelected, onItemSelect,
    encodedLine, solutionLine, distance, azimuth, isFirst, isSolutionView, isVisual,
    lineLabel, navLanguage, pois, dangerLevel, onModuleChange, onNavLanguageChange, onLineClick, onPoiToggle, onRemoveStep
}: any) {
    const { state, dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [isToolbarOpen, setIsToolbarOpen] = useState(false);
    const [activePopover, setActivePopover] = useState<'module' | 'lang' | 'poi' | 'scale' | 'format' | null>(null);
    const [solutionVisible, setSolutionVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const toolbarRef = useRef<HTMLDivElement>(null);

    const hasMap = ['carte_ign', 'drapeaux'].includes(step.moduleId) && step.coords && step.coords.length > 0;
    const hasGilwell = step.moduleId === 'gilwell' && step.gilwellSvg;

    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = MODULE_FONT[step.moduleId] || MODULE_FONT.default;
    const fontSize = MODULE_FONT_SIZE[step.moduleId] || MODULE_FONT_SIZE.default;

    const isEncoded = !isSolutionView && !isVisual && encodedLine !== solutionLine;

    let dangerColor: string | undefined = undefined;
    if (dangerLevel === 'extreme' || dangerLevel === 'motorway_cross') dangerColor = '#ef4444';
    else if (dangerLevel === 'high') dangerColor = '#f97316';
    else if (dangerLevel === 'minor') dangerColor = '#eab308';

    let dotColor = 'var(--accent-default)';
    if (lineLabel) {
        const stageIdx = state.stages.findIndex((st: any) => st.label === lineLabel);
        if (stageIdx === 0) dotColor = 'var(--semantic-green)';
        else if (stageIdx === state.stages.length - 1 && stageIdx > 0) dotColor = 'var(--semantic-red)';
    }

    // Fermeture des popovers au clic extérieur ou Échap
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent | TouchEvent) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
                setActivePopover(null);
                setIsToolbarOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setActivePopover(null);
                setIsToolbarOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Double clic pour éditer directement
    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isVisual) {
            setIsEditing(true);
            setActivePopover(null);
            setIsToolbarOpen(false);
        }
    };

    const handleLineClickInternal = (e: React.MouseEvent) => {
        if (onItemSelect) onItemSelect(e);
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
            setIsToolbarOpen(true);
            if (onLineClick) onLineClick();
        }
    };

    const showFloatingBar = (hovered || isToolbarOpen || activePopover !== null) && !isEditing;

    return (
        <div 
            id={`carnet-step-${step.id}`}
            style={{ 
                display: 'flex', 
                flexDirection: 'column',
                position: 'relative', 
                minHeight: '26px',
                padding: '2px 0 4px 0',
                zIndex: (showFloatingBar || activePopover !== null) ? 150 : 1,
                borderRadius: '6px',
                transition: 'box-shadow 0.25s ease, background-color 0.2s ease',
            }} 
            onMouseEnter={() => setHovered(true)} 
            onMouseLeave={() => {
                setHovered(false);
                // isSelected is a prop controlled externally via onItemSelect
            }}
            onDoubleClick={handleDoubleClick}
        >
            {/* ── Ligne d'étape : Badge carré Leaflet + Barre pleine arrondie + Saut de ligne ── */}
            {lineLabel && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    marginTop: (isFirst && stepIndex === 0) ? '4px' : '18px',
                    marginBottom: '10px',
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

            {/* ── Corps du texte / de l'étape à la suite sans contours ni boutons encombrants ── */}
            <div style={{
                width: '100%',
                minWidth: 0,
                position: 'relative',
                background: isSelected ? 'rgba(37, 99, 235, 0.12)' : (hovered ? 'rgba(255, 255, 255, 0.02)' : 'transparent'),
                border: isSelected ? '1px solid var(--accent-default)' : '1px solid transparent',
                borderRadius: '8px',
                padding: '3px 6px',
                boxSizing: 'border-box',
                transition: 'background-color 120ms ease, border-color 120ms ease',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '8px'
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
                                    {(hovered || solutionVisible) && (
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
                                <MiniMap
                                    stepId={step.id}
                                    moduleId={step.moduleId}
                                    coords={step.coords}
                                    initialPersist={step.mapPersist}
                                />
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

                {/* Bouton d'accès aux paramètres pour mobile / affordance claire */}
                {!isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, marginTop: '2px' }}>
                        {isSelected && (
                            <div
                                title="Tronçon sélectionné"
                                style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '5px',
                                    background: 'var(--accent-default)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#ffffff'
                                }}
                            >
                                <Check size={12} strokeWidth={3} />
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsToolbarOpen(v => !v);
                            }}
                            title="Options du tronçon"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '22px',
                                height: '22px',
                                border: 'none',
                                background: 'transparent',
                                color: isToolbarOpen ? 'var(--accent-hover)' : 'var(--text-dim)',
                                cursor: 'pointer',
                                padding: 0,
                                opacity: (hovered || isToolbarOpen || isSelected) ? 1 : 0.4,
                                transition: 'opacity 120ms ease, color 120ms ease',
                                boxShadow: 'none',
                                outline: 'none'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.color = 'var(--text-primary)';
                                e.currentTarget.style.opacity = '1';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.color = isToolbarOpen ? 'var(--accent-hover)' : 'var(--text-dim)';
                                e.currentTarget.style.opacity = (hovered || isToolbarOpen || isSelected) ? '1' : '0.4';
                            }}
                        >
                            <MoreVertical size={16} strokeWidth={2} />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Floating bar des paramètres en overlay absolu (NE DÉCALE PAS LE TEXTE) ── */}
            {showFloatingBar && (
                <div 
                    ref={toolbarRef}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 300,
                        pointerEvents: 'all',
                        animation: 'toolbarSwapIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                >
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '14px',
                        padding: '3px 4px',
                        boxShadow: 'var(--shadow-md)',
                        boxSizing: 'border-box',
                        maxWidth: 'calc(100vw - 32px)',
                        overflow: 'visible',
                        position: 'relative'
                    }}>
                        {/* 1. Bouton Éditer */}
                        {!isVisual && (
                            <button
                                type="button"
                                onClick={() => { setIsEditing(true); setActivePopover(null); }}
                                title="Modifier la consigne (Double-clic)"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    height: '28px',
                                    padding: '0 8px',
                                    borderRadius: '10px',
                                    border: '1px solid transparent',
                                    background: 'transparent',
                                    color: 'var(--text-primary)',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 80ms ease',
                                    flexShrink: 0
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Edit2 size={12} color="var(--accent-hover)" />
                                <span>Éditer</span>
                            </button>
                        )}

                        {/* 2. Bouton Module / Chiffrement */}
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setActivePopover(activePopover === 'module' ? null : 'module')}
                                title="Changer le module de chiffrement"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    height: '28px',
                                    padding: '0 8px',
                                    borderRadius: '10px',
                                    border: activePopover === 'module' ? '1px solid var(--accent-default)' : '1px solid transparent',
                                    background: activePopover === 'module' ? 'var(--accent-default)' : 'transparent',
                                    color: activePopover === 'module' ? '#ffffff' : 'var(--text-primary)',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 80ms ease',
                                    flexShrink: 0
                                }}
                                onMouseEnter={e => {
                                    if (activePopover !== 'module') e.currentTarget.style.background = 'var(--bg-hover)';
                                }}
                                onMouseLeave={e => {
                                    if (activePopover !== 'module') e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: meta?.color || '#6b7280', flexShrink: 0 }} />
                                <span>{meta?.label || step.moduleId}</span>
                                <ChevronDown size={10} style={{ opacity: 0.6, transform: activePopover === 'module' ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                            </button>

                            {activePopover === 'module' && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 'calc(100% + 8px)',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '12px',
                                    boxShadow: 'var(--shadow-lg)',
                                    padding: '6px',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(2, 1fr)',
                                    gap: '3px',
                                    minWidth: '240px',
                                    maxWidth: 'min(280px, calc(100vw - 32px))',
                                    zIndex: 5000,
                                    pointerEvents: 'all',
                                    animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                }}>
                                    <div style={{ gridColumn: 'span 2', fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Chiffrement & Module
                                    </div>
                                    {ALL_MODULES.slice(0, 10).map(modId => {
                                        const isCurrent = step.moduleId === modId;
                                        const modMeta = MODULE_META[modId];
                                        return (
                                            <button
                                                key={modId}
                                                type="button"
                                                onClick={() => { onModuleChange(modId); setActivePopover(null); }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '5px 7px',
                                                    borderRadius: '7px',
                                                    border: isCurrent ? '1px solid var(--accent-default)' : '1px solid transparent',
                                                    background: isCurrent ? 'var(--accent-default)' : 'transparent',
                                                    color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                                                    fontSize: '11px',
                                                    fontWeight: isCurrent ? 600 : 500,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    whiteSpace: 'nowrap',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    transition: 'all 80ms ease'
                                                }}
                                                onMouseEnter={e => {
                                                    if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)';
                                                }}
                                                onMouseLeave={e => {
                                                    if (!isCurrent) e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: modMeta?.color || '#6b7280', flexShrink: 0 }} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{modMeta?.label || modId}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 3. Bouton Langage de navigation */}
                        <div style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setActivePopover(activePopover === 'lang' ? null : 'lang')}
                                title="Changer le langage de guidage"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    height: '28px',
                                    padding: '0 8px',
                                    borderRadius: '10px',
                                    border: activePopover === 'lang' ? '1px solid var(--accent-default)' : '1px solid transparent',
                                    background: activePopover === 'lang' ? 'var(--accent-default)' : 'transparent',
                                    color: activePopover === 'lang' ? '#ffffff' : 'var(--text-dim)',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    transition: 'all 80ms ease',
                                    flexShrink: 0
                                }}
                                onMouseEnter={e => {
                                    if (activePopover !== 'lang') {
                                        e.currentTarget.style.background = 'var(--bg-hover)';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }
                                }}
                                onMouseLeave={e => {
                                    if (activePopover !== 'lang') {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = 'var(--text-dim)';
                                    }
                                }}
                            >
                                <Globe size={12} />
                                <span>{navLanguage || 'Aléatoire'}</span>
                                <ChevronDown size={10} style={{ opacity: 0.6, transform: activePopover === 'lang' ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                            </button>

                            {activePopover === 'lang' && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: 'calc(100% + 8px)',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-strong)',
                                    borderRadius: '12px',
                                    boxShadow: 'var(--shadow-lg)',
                                    padding: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    minWidth: '130px',
                                    zIndex: 5000,
                                    pointerEvents: 'all',
                                    animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                }}>
                                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Guidage
                                    </div>
                                    {['Aléatoire', ...NAV_LANGUAGES].map(lang => {
                                        const isCur = lang === 'Aléatoire' ? !navLanguage : navLanguage === lang;
                                        return (
                                            <button
                                                key={lang}
                                                type="button"
                                                onClick={() => { onNavLanguageChange(lang === 'Aléatoire' ? undefined : lang); setActivePopover(null); }}
                                                style={{
                                                    padding: '5px 8px',
                                                    borderRadius: '7px',
                                                    border: isCur ? '1px solid var(--accent-default)' : '1px solid transparent',
                                                    background: isCur ? 'var(--accent-default)' : 'transparent',
                                                    color: isCur ? '#ffffff' : 'var(--text-primary)',
                                                    fontSize: '11px',
                                                    fontWeight: isCur ? 600 : 500,
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 80ms ease'
                                                }}
                                                onMouseEnter={e => {
                                                    if (!isCur) e.currentTarget.style.background = 'var(--bg-hover)';
                                                }}
                                                onMouseLeave={e => {
                                                    if (!isCur) e.currentTarget.style.background = 'transparent';
                                                }}
                                            >
                                                {lang}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 4. Bouton POI (si disponible) */}
                        {pois && pois.length > 0 && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    type="button"
                                    onClick={() => setActivePopover(activePopover === 'poi' ? null : 'poi')}
                                    title="Sélectionner les points d'intérêt"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        height: '28px',
                                        padding: '0 8px',
                                        borderRadius: '10px',
                                        border: activePopover === 'poi' ? '1px solid var(--semantic-orange)' : '1px solid transparent',
                                        background: activePopover === 'poi' ? 'var(--semantic-orange)' : 'transparent',
                                        color: activePopover === 'poi' ? '#09090b' : (pois.some((p: any) => p.selected) ? 'var(--semantic-orange)' : 'var(--text-dim)'),
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        transition: 'all 80ms ease',
                                        flexShrink: 0
                                    }}
                                >
                                    <span>POI</span>
                                    <ChevronDown size={10} style={{ opacity: 0.6, transform: activePopover === 'poi' ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease' }} />
                                </button>

                                {activePopover === 'poi' && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 'calc(100% + 8px)',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-strong)',
                                        borderRadius: '12px',
                                        boxShadow: 'var(--shadow-lg)',
                                        padding: '6px',
                                        minWidth: '180px',
                                        maxWidth: 'min(240px, calc(100vw - 32px))',
                                        zIndex: 5000,
                                        pointerEvents: 'all',
                                        animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}>
                                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                            Points d'intérêt
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            {pois.map((poi: any) => (
                                                <div
                                                    key={poi.id}
                                                    onClick={() => onPoiToggle && onPoiToggle(poi.id)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '5px 8px',
                                                        borderRadius: '7px',
                                                        background: poi.selected ? 'var(--semantic-orange-bg)' : 'transparent',
                                                        cursor: 'pointer',
                                                        transition: 'all 80ms ease'
                                                    }}
                                                >
                                                    <div style={{
                                                        width: '12px', height: '12px', borderRadius: '3px',
                                                        border: `1.5px solid ${poi.selected ? 'var(--semantic-orange)' : 'var(--border-strong)'}`,
                                                        background: poi.selected ? 'var(--semantic-orange)' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                                    }}>
                                                        {poi.selected && <Check size={8} color="#000" strokeWidth={3} />}
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: poi.selected ? 'var(--semantic-orange)' : 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {poi.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 5. Paramètres Carte IGN (si carte) */}
                        {hasMap && (
                            <>
                                {/* Échelle */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        type="button"
                                        onClick={() => setActivePopover(activePopover === 'scale' ? null : 'scale')}
                                        title="Échelle cartographique"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            height: '28px',
                                            padding: '0 8px',
                                            borderRadius: '10px',
                                            border: activePopover === 'scale' ? '1px solid var(--accent-default)' : '1px solid transparent',
                                            background: activePopover === 'scale' ? 'var(--accent-default)' : 'transparent',
                                            color: activePopover === 'scale' ? '#ffffff' : 'var(--accent-hover)',
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            fontFamily: 'var(--font-mono)',
                                            cursor: 'pointer',
                                            transition: 'all 80ms ease',
                                            flexShrink: 0
                                        }}
                                    >
                                        <Ruler size={11} />
                                        <span>{step.mapPersist?.scaleName || '1:25000'}</span>
                                    </button>
                                    {activePopover === 'scale' && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 'calc(100% + 8px)',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'var(--bg-elevated)',
                                            border: '1px solid var(--border-strong)',
                                            borderRadius: '12px',
                                            boxShadow: 'var(--shadow-lg)',
                                            padding: '6px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '2px',
                                            minWidth: '150px',
                                            zIndex: 5000,
                                            pointerEvents: 'all',
                                            animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                        }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Échelle
                                            </div>
                                            {[
                                                { id: '1:25000', label: '1:25 000 (TOP 25)' },
                                                { id: '1:10000', label: '1:10 000 (Détail)' },
                                                { id: '1:50000', label: '1:50 000 (Moyen)' },
                                                { id: 'auto', label: 'Ajuster au tracé' },
                                            ].map(item => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => {
                                                        const denomMap: Record<string, number> = { '1:10000': 10000, '1:25000': 25000, '1:50000': 50000 };
                                                        const denom = denomMap[item.id];
                                                        const mid = step.coords[Math.floor(step.coords.length / 2)] || step.coords[0];
                                                        const z = denom ? calculateZoomForScale(denom, mid[1]) : 15;
                                                        dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, scaleName: item.id, zoom: z, center: [mid[1], mid[0]] });
                                                        setActivePopover(null);
                                                    }}
                                                    style={{
                                                        padding: '5px 8px', borderRadius: '7px',
                                                        background: (step.mapPersist?.scaleName || '1:25000') === item.id ? 'var(--accent-default)' : 'transparent',
                                                        color: (step.mapPersist?.scaleName || '1:25000') === item.id ? '#ffffff' : 'var(--text-primary)',
                                                        border: 'none', fontSize: '11px', cursor: 'pointer', textAlign: 'left', transition: 'all 80ms ease'
                                                    }}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Format / Largeur */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        type="button"
                                        onClick={() => setActivePopover(activePopover === 'format' ? null : 'format')}
                                        title="Format de la carte"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            height: '28px',
                                            padding: '0 8px',
                                            borderRadius: '10px',
                                            border: activePopover === 'format' ? '1px solid var(--accent-default)' : '1px solid transparent',
                                            background: activePopover === 'format' ? 'var(--accent-default)' : 'transparent',
                                            color: activePopover === 'format' ? '#ffffff' : 'var(--text-dim)',
                                            fontSize: '11px',
                                            cursor: 'pointer',
                                            transition: 'all 80ms ease',
                                            flexShrink: 0
                                        }}
                                    >
                                        <span>{step.mapPersist?.widthPercent || 100}%</span>
                                    </button>
                                    {activePopover === 'format' && (
                                        <div style={{
                                            position: 'absolute',
                                            bottom: 'calc(100% + 8px)',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'var(--bg-elevated)',
                                            border: '1px solid var(--border-strong)',
                                            borderRadius: '12px',
                                            boxShadow: 'var(--shadow-lg)',
                                            padding: '6px',
                                            minWidth: '130px',
                                            zIndex: 5000,
                                            pointerEvents: 'all',
                                            animation: 'islandPopoverIn 140ms cubic-bezier(0.16, 1, 0.3, 1)',
                                        }}>
                                            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', padding: '2px 6px 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                Largeur
                                            </div>
                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                {[100, 75, 50].map(pct => (
                                                    <button
                                                        key={pct}
                                                        type="button"
                                                        onClick={() => {
                                                            dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, widthPercent: pct, width: undefined });
                                                            setActivePopover(null);
                                                        }}
                                                        style={{
                                                            flex: 1, padding: '5px 0', borderRadius: '7px',
                                                            background: (step.mapPersist?.widthPercent || 100) === pct ? 'var(--accent-default)' : 'transparent',
                                                            color: (step.mapPersist?.widthPercent || 100) === pct ? '#ffffff' : 'var(--text-primary)',
                                                            border: 'none', fontSize: '11px', cursor: 'pointer'
                                                        }}
                                                    >
                                                        {pct}%
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Cadenas */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const nextLocked = !step.mapPersist?.isLocked;
                                        dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, isLocked: nextLocked });
                                    }}
                                    title={step.mapPersist?.isLocked ? "Carte verrouillée" : "Verrouiller le déplacement"}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '10px',
                                        border: '1px solid transparent',
                                        background: 'transparent',
                                        color: step.mapPersist?.isLocked ? 'var(--semantic-danger)' : 'var(--text-dim)',
                                        cursor: 'pointer',
                                        flexShrink: 0
                                    }}
                                >
                                    {step.mapPersist?.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                                </button>
                            </>
                        )}

                        {/* 6. Supprimer si étape manuelle */}
                        {step.isManual && onRemoveStep && (
                            <button
                                type="button"
                                onClick={() => { setActivePopover(null); onRemoveStep(step.id); }}
                                title="Supprimer cette étape"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '10px',
                                    border: '1px solid transparent',
                                    background: 'transparent',
                                    color: 'var(--semantic-danger)',
                                    cursor: 'pointer',
                                    transition: 'all 80ms ease',
                                    flexShrink: 0
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function HighlightedText({ text, pois, isEncoded }: { text: string, pois?: any[], isEncoded: boolean }) {
    if (!text) return null;

    // Pattern pour balises personnalisées : [morse]...[/morse], <morse>...</morse>, [templier]..., [maritime]..., [code]...
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

function HighlightedTextCore({ text, pois, isEncoded }: { text: string, pois?: any[], isEncoded: boolean }) {
    if (!text || isEncoded) return <>{text}</>;

    const selectedPoi = pois?.find(p => p.selected);
    const poiName = selectedPoi ? selectedPoi.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    
    // Distances
    const distanceRegex = '\\d+(?:\\.\\d+)?\\s*(?:pas|mètres|km|kilomètres)';
    
    // Azimuth directions
    const azimuthRegex = [
        'au\\s+\\d+°',
        '\\d+°',
        'du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?',
        'en direction du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?',
        '(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?(?=\\b|$)',
        '(?:tournez\\s+)?légèrement\\s+à\\s+(?:droite|gauche)',
        '(?:tournez\\s+)?à\\s+(?:droite|gauche)',
        'faites\\s+un\\s+demi-tour(?:\\s+à\\s+(?:droite|gauche))?',
        'demi-tour',
        'continuez\\s+tout\\s+droit',
        'tout\\s+droit(?:\\s+\\(12h\\))?',
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
                
                if (poiName && part.toLowerCase() === selectedPoi.name.toLowerCase()) {
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

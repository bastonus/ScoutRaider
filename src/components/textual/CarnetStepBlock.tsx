import React, { useState, useMemo } from 'react';
import { Eye, EyeOff, ChevronDown, Check, Trash2, Globe, Edit2, MessageSquarePlus, Code2, Ruler, Layers, Lock, Unlock, Compass, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

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
    step, view, onModuleChange, onManualContentChange, onRemoveStep, onNavLanguageChange, onPoiToggle, onLineClick, onAddInlineCode
}: any) {
    const { state, dispatch } = useApp();
    const isSolution = view === 'solution';

    if (step.isManual) {
        if (step.manualType === 'html') {
            return <ManualStepHtml step={step} onManualContentChange={onManualContentChange} onRemoveStep={onRemoveStep} />;
        }
        if (step.manualType === 'code') {
            return <ManualCodeBlock step={step} onManualContentChange={onManualContentChange} onRemoveStep={onRemoveStep} isSolution={view === 'solution'} />;
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
                const seenLabels = new Set<string>();

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
                    
                    // 1. Calculate the precise original distance interval [startM, endM]
                    // We must use the GLOBAL concatenated geometry because indices (start_idx) 
                    // are relative to the full path used during the azimut step.
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

                    // 2. Check danger_intervals from IGNClient
                    const props = route.geojson.properties || (route.geojson.type === 'Feature' ? route.geojson.properties : {});
                    const dangerIntervals = props?.danger_intervals || [];
                    
                    if (dangerIntervals.length > 0) {
                        let maxDl: string | null = null;
                        const dlPriority: Record<string, number> = { 'extreme': 4, 'motorway_cross': 3, 'high': 2, 'minor': 1 };
                        
                        for (const di of dangerIntervals) {
                            // Filter noise: ignore very short intervals unless they are extreme
                            const intervalLength = di.end - di.start;
                            if (intervalLength < 30 && di.level !== 'extreme') continue;

                            // Check for overlap between [startM, endM] and [di.start, di.end]
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

                    // Fallback to legacy behavior
                    if (props?.danger_level) return props.danger_level;
                    return null;
                };

                const linesToRender = isVisual ? [encodedLines[0] || ''] : encodedLines;

                return linesToRender.map((line: string, idx: number) => {
                    const segIdx = isVisual ? step.segmentIndices?.[0] : step.segmentIndices?.[idx];
                    const originalSeg = segIdx !== undefined ? state.polygonal_steps[segIdx] : null;
                    const distance = step.isManual ? 0 : (isVisual ? (step.distanceM ?? 0) : (originalSeg?.distance ?? 0));
                    const azimuth = step.isManual ? 0 : (originalSeg?.azimut ?? 0);
                    
                    let lineLabel = '';
                    if (originalSeg && originalSeg.coords && originalSeg.coords.length > 0) {
                        const cStart = originalSeg.coords[0];
                        lineLabel = state.stages.find((st: any) => Math.abs(st.coords[0] - cStart[1]) < 0.001 && Math.abs(st.coords[1] - cStart[0]) < 0.001)?.label || '';
                    } else if (idx === 0) {
                        lineLabel = step.fromLabel;
                    }

                    if (lineLabel) {
                        if (seenLabels.has(lineLabel)) {
                            lineLabel = '';
                        } else {
                            seenLabels.add(lineLabel);
                        }
                    }

                    return (
                        <React.Fragment key={idx}>
                            {idx > 0 && !step.isManual && (
                                <InlineStepSeparator 
                                    onAddHtml={() => dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId: step.id, anchorSegmentIdx: step.segmentIndices?.[idx - 1], content: '', manualType: 'html' })}
                                    onAddCode={() => dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId: step.id, anchorSegmentIdx: step.segmentIndices?.[idx - 1], content: '', manualType: 'code' })}
                                />
                            )}
                            <ComputedStepLine 
                                step={step} lineIdx={idx} segIdx={segIdx}
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

function InlineStepSeparator({ onAddHtml, onAddCode }: any) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            style={{ display: 'flex', position: 'relative', height: '16px', margin: '-8px 0', zIndex: 20 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div style={{ width: '80px', flexShrink: 0, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', background: 'var(--bg-border)', zIndex: 1 }} />
            </div>

            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{
                    position: 'absolute', left: 0, right: 0, top: '50%',
                    height: '1px',
                    background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                    transition: 'background 0.2s',
                }} />

                <button
                    onClick={onAddHtml}
                    style={{
                        position: 'relative', zIndex: 2,
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '12px',
                        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
                        background: hovered ? 'var(--bg-panel)' : 'transparent',
                        color: hovered ? 'var(--text-dim)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                        transition: 'all 0.15s ease',
                        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                        whiteSpace: 'nowrap',
                    }}
                    title="Ajouter un commentaire HTML riche"
                >
                    <MessageSquarePlus size={11} strokeWidth={2.5} />
                    {hovered && 'Commentaire'}
                </button>

                <button
                    onClick={onAddCode}
                    style={{
                        position: 'relative', zIndex: 2,
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '3px 10px', borderRadius: '12px',
                        border: `1px solid ${hovered ? 'rgba(255,255,255,0.12)' : 'transparent'}`,
                        background: hovered ? 'var(--bg-panel)' : 'transparent',
                        color: hovered ? 'var(--text-dim)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em',
                        transition: 'all 0.15s ease',
                        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                        whiteSpace: 'nowrap',
                    }}
                    title="Ajouter un bloc encodé"
                >
                    <Code2 size={11} strokeWidth={2.5} />
                    {hovered && 'Bloc encodé'}
                </button>
            </div>
        </div>
    );
}

function ManualStepHtml({ step, onManualContentChange, onRemoveStep }: any) {
    const [hovered, setHovered] = useState(false);
    const isEmpty = !step.solutionText || step.solutionText === '<p>&nbsp;</p>' || step.solutionText.trim() === '' || step.solutionText === '<p></p>';
    return (
        <div 
            style={{ 
                display: 'flex', 
                position: 'relative', 
                minHeight: '60px',
                zIndex: hovered ? 50 : 1
            }} 
            onMouseEnter={() => setHovered(true)} 
            onMouseLeave={() => setHovered(false)}
        >
            <div style={{ width: '80px', flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', background: 'var(--bg-border)', zIndex: 1 }} />
                <div style={{ marginTop: '12px', zIndex: 2, width: '10px', height: '10px', borderRadius: '50%', background: 'var(--bg-base)', border: `2px solid #6b7280` }} />
            </div>
            <div style={{ flex: 1, padding: '12px 16px', position: 'relative', background: hovered ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius: '12px', marginLeft: '8px' }}>
                {hovered && (
                    <div style={{ position: 'absolute', top: '8px', right: '12px', zIndex: 10, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '4px' }}>
                        <button onClick={() => onRemoveStep(step.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><Trash2 size={14} /></button>
                    </div>
                )}
                {isEmpty && !hovered && (
                    <div style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px', fontStyle: 'italic', pointerEvents: 'none', paddingTop: '4px' }}>
                        Tapez ici votre commentaire…
                    </div>
                )}
                <div className="ck-content-override inline-editor-container">
                    <style>{`
                        .inline-editor-container .ck.ck-editor__top { display: none; }
                        .inline-editor-container:focus-within .ck.ck-editor__top { display: block; }
                        .ck.ck-editor__editable_inline { min-height: 36px !important; }
                    `}</style>
                    <CKEditor
                        editor={ClassicEditor as any}
                        data={step.solutionText || ''}
                        config={{ toolbar: ['bold', 'italic', 'link', 'bulletedList', 'numberedList', 'blockQuote'] }}
                        onChange={(event, editor) => onManualContentChange(step.id, editor.getData())}
                    />
                </div>
            </div>
        </div>
    );
}

function ManualCodeBlock({ step, onManualContentChange, onRemoveStep, isSolution }: any) {
    const [hovered, setHovered] = useState(false);
    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = MODULE_FONT[step.moduleId] || MODULE_FONT.default;
    const fontSize = MODULE_FONT_SIZE[step.moduleId] || MODULE_FONT_SIZE.default;
    const displayText = isSolution ? (step.solutionText || '') : (step.encodedText || step.solutionText || '');
    const isEncoded = !isSolution && step.encodedText && step.encodedText !== step.solutionText;

    return (
        <div
            style={{ 
                display: 'flex', 
                position: 'relative', 
                minHeight: '72px',
                zIndex: hovered ? 50 : 1
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <div style={{ width: '80px', flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', background: 'var(--bg-border)', zIndex: 1 }} />
                <div style={{
                    marginTop: '16px', zIndex: 2,
                    width: '24px', height: '24px', borderRadius: '6px',
                    background: `${accentColor}18`, border: `1.5px solid ${accentColor}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Code2 size={11} color={accentColor} strokeWidth={2.5} />
                </div>
            </div>
            <div style={{ flex: 1, padding: '10px 16px 10px 12px', marginLeft: '8px' }}>
                {hovered && (
                    <div style={{ position: 'absolute', top: '8px', right: '12px', zIndex: 10, display: 'flex', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: accentColor, fontWeight: 700, background: `${accentColor}15`, border: `1px solid ${accentColor}30`, borderRadius: '8px', padding: '2px 8px' }}>
                            {meta?.label || step.moduleId}
                        </span>
                        <button onClick={() => onRemoveStep(step.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><Trash2 size={13} /></button>
                    </div>
                )}
                {/* Editable source */}
                <textarea
                    value={step.solutionText || ''}
                    onChange={e => onManualContentChange(step.id, e.target.value)}
                    placeholder="Tapez le texte à encoder…"
                    style={{
                        width: '100%', background: 'var(--bg-base)',
                        border: `1px solid ${hovered ? accentColor + '40' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: '6px', color: 'var(--text-dim)', fontSize: '12px',
                        fontFamily: '"Inter", sans-serif', lineHeight: 1.5,
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
                        marginTop: '6px', padding: '6px 8px',
                        background: `${accentColor}08`, borderRadius: '6px',
                        border: `1px solid ${accentColor}20`,
                        fontFamily: font, fontSize: fontSize, color: accentColor,
                        lineHeight: 1.6, wordBreak: 'break-all',
                    }}>
                        {displayText}
                    </div>
                )}
                {isSolution && step.solutionText && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                        Solution visible
                    </div>
                )}
            </div>
        </div>
    );
}

function ComputedStepLine({
    step, lineIdx, segIdx, encodedLine, solutionLine, distance, azimuth, isFirst, isSolutionView, isVisual,
    lineLabel, navLanguage, pois, dangerLevel, onModuleChange, onNavLanguageChange, onLineClick, onPoiToggle, onRemoveStep
}: any) {
    const { state, dispatch } = useApp();
    const [hovered, setHovered] = useState(false);
    const [modulePickerOpen, setModulePickerOpen] = useState(false);
    const [langPickerOpen, setLangPickerOpen] = useState(false);
    const [poiPickerOpen, setPoiPickerOpen] = useState(false);
    const [scaleMenuOpen, setScaleMenuOpen] = useState(false);
    const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
    const [layerMenuOpen, setLayerMenuOpen] = useState(false);
    const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
    const [solutionVisible, setSolutionVisible] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    const hasMap = ['carte_ign', 'drapeaux'].includes(step.moduleId) && step.coords && step.coords.length > 0;
    const hasGilwell = step.moduleId === 'gilwell' && step.gilwellSvg;

    const meta = MODULE_META[step.moduleId as keyof typeof MODULE_META];
    const accentColor = meta?.color || '#6b7280';
    const font = MODULE_FONT[step.moduleId] || MODULE_FONT.default;
    const fontSize = MODULE_FONT_SIZE[step.moduleId] || MODULE_FONT_SIZE.default;

    // Suppress warnings if the step is edited
    const hasWarnings = step.warnings && step.warnings.length > 0 && !step.isEdited;
    const warnColor = hasWarnings ? (step.warnings.some((w: any) => w.severity === 'error') ? '#ef4444' : '#f59e0b') : undefined;

    const isEncoded = !isSolutionView && !isVisual && encodedLine !== solutionLine;

    let dangerColor: string | undefined = undefined;
    let dangerText: string | undefined = undefined;
    if (dangerLevel === 'extreme') { dangerColor = '#ef4444'; dangerText = "Attention : Ce tronçon emprunte ou traverse une voie rapide (Autoroute). Prudence absolue !"; }
    else if (dangerLevel === 'motorway_cross') { dangerColor = '#ef4444'; dangerText = "Attention : Ce tronçon traverse une voie rapide. Regardez bien avant de traverser !"; }
    else if (dangerLevel === 'high') { dangerColor = '#ea580c'; dangerText = "Prudence : Ce tronçon emprunte une route très passante (Nationale)."; }
    else if (dangerLevel === 'minor') { dangerColor = '#eab308'; dangerText = "Prudence : Passage prolongé sur route départementale."; }

    let dotColor = 'var(--accent-default)';
    if (lineLabel) {
        const stageIdx = state.stages.findIndex((st: any) => st.label === lineLabel);
        if (stageIdx === 0) dotColor = 'var(--semantic-green)';
        else if (stageIdx === state.stages.length - 1 && stageIdx > 0) dotColor = 'var(--semantic-red)';
    }

    return (
        <div 
            style={{ 
                display: 'flex', 
                position: 'relative', 
                minHeight: lineLabel ? '84px' : '60px',
                zIndex: hovered ? 2500 : 1
            }} 
            onMouseEnter={() => setHovered(true)} 
            onMouseLeave={() => {
                setHovered(false);
                setModulePickerOpen(false);
                setLangPickerOpen(false);
                setPoiPickerOpen(false);
                setScaleMenuOpen(false);
                setSizeMenuOpen(false);
                setLayerMenuOpen(false);
                setDisplayMenuOpen(false);
            }}
        >
            <div style={{ width: '80px', flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: '2px', background: 'var(--bg-border)', zIndex: 1 }} />
                
                {lineLabel ? (
                    <div style={{ 
                        marginTop: '12px', zIndex: 2, width: '24px', height: '24px', 
                        borderRadius: '8px', background: 'var(--bg-dark)', border: `2px solid ${dotColor}`, 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: dotColor, fontWeight: 800, fontSize: '11px',
                    }}>
                        {lineLabel}
                    </div>
                ) : (
                    <div style={{ marginTop: '12px', zIndex: 2, width: '10px', height: '10px', borderRadius: '50%', background: 'var(--bg-base)', border: `2px solid ${accentColor}` }} />
                )}

                <div style={{ flex: 1, width: '4px', background: accentColor, margin: '4px 0', borderRadius: '2px', zIndex: 2 }} />

                {/* Distance/azimuth labels only for non-first sub-lines to avoid overlap with stage circle */}
                {!step.isManual && !isFirst && (
                    <div style={{ position: 'absolute', top: lineLabel ? '48px' : '32px', left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', zIndex: 3 }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, background: 'var(--bg-base)', padding: '2px 4px', borderRadius: '4px' }}>
                            {Math.round(distance)}m
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, background: 'var(--bg-base)', padding: '2px 4px', borderRadius: '4px' }}>
                            {Math.round(azimuth)}°
                        </div>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, padding: '12px 16px', position: 'relative', background: hovered ? 'rgba(255,255,255,0.03)' : 'transparent', borderRadius: '12px', marginLeft: '8px' }}>
                {isFirst && hasWarnings && (
                    <div style={{ position: 'absolute', top: '12px', left: '16px', right: '16px', zIndex: 5 }}>
                        <div style={{ padding: '6px 10px', background: `${warnColor}15`, borderLeft: `3px solid ${warnColor}`, borderRadius: '4px', fontSize: '11px', color: warnColor }}>
                            {step.warnings[0]?.message}
                        </div>
                    </div>
                )}
                
                {dangerText && (
                    <div style={{ position: 'absolute', top: (isFirst && hasWarnings) ? '48px' : '12px', left: '16px', right: '16px', zIndex: 4 }}>
                        <div style={{ padding: '6px 10px', background: `${dangerColor}15`, borderLeft: `3px solid ${dangerColor}`, borderRadius: '4px', fontSize: '11px', color: dangerColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                            {dangerText}
                        </div>
                    </div>
                )}

                {hovered && !isEditing && (
                    <div style={{ position: 'absolute', top: '-28px', right: '12px', zIndex: 3000, display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '4px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}>
                        {/* Spatial bridge: maintains hover while moving mouse from line up to this menu */}
                        <div style={{ position: 'absolute', top: '100%', left: -20, right: 0, height: '40px', zIndex: -1 }} />
                        
                        {!step.isManual && !isVisual && (
                            <button onClick={() => setIsEditing(true)} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                <Edit2 size={12} /> Éditer la phrase
                            </button>
                        )}
                        {step.isManual && onRemoveStep && (
                            <button onClick={onRemoveStep} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>
                                <Trash2 size={12} />
                            </button>
                        )}

                        {/* ── Paramètres de carte dans le menu d'encodage au hover ── */}
                        {hasMap && (
                            <>
                                {/* Échelle cartographique (1:25k par défaut) */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => { setScaleMenuOpen(!scaleMenuOpen); setSizeMenuOpen(false); setLayerMenuOpen(false); setLangPickerOpen(false); setModulePickerOpen(false); setPoiPickerOpen(false); }}
                                        title="Échelle cartographique de l'étape"
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700 }}
                                    >
                                        <Ruler size={12} />
                                        <span>{step.mapPersist?.scaleName || '1:25000'}</span>
                                        <ChevronDown size={11} />
                                    </button>
                                    {scaleMenuOpen && (
                                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '4px', minWidth: '175px', zIndex: 3500, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', padding: '4px 8px', fontWeight: 700 }}>Échelle cartographique</div>
                                            {[
                                                { id: '1:25000', label: '1:25 000 (TOP 25)', desc: '1 cm = 250 m • IGN (Défaut)' },
                                                { id: '1:10000', label: '1:10 000 (Détail)', desc: '1 cm = 100 m' },
                                                { id: '1:50000', label: '1:50 000 (Moyen)', desc: '1 cm = 500 m' },
                                                { id: '1:100000', label: '1:100 000 (Région)', desc: '1 cm = 1 km' },
                                                { id: 'auto', label: 'Ajuster au tracé', desc: 'Vue d’ensemble' },
                                            ].map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        const denomMap: Record<string, number> = { '1:10000': 10000, '1:25000': 25000, '1:50000': 50000, '1:100000': 100000 };
                                                        const denom = denomMap[item.id];
                                                        const mid = step.coords[Math.floor(step.coords.length / 2)] || step.coords[0];
                                                        const z = denom ? calculateZoomForScale(denom, mid[1]) : 15;
                                                        dispatch({
                                                            type: 'PERSIST_MAP_STATE',
                                                            stepId: step.id,
                                                            scaleName: item.id,
                                                            zoom: z,
                                                            center: [mid[1], mid[0]]
                                                        });
                                                        setScaleMenuOpen(false);
                                                    }}
                                                    style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', cursor: 'pointer', borderRadius: '4px', background: (step.mapPersist?.scaleName || '1:25000') === item.id ? 'var(--accent-default)' : 'transparent', color: '#ffffff' }}
                                                >
                                                    <span style={{ fontSize: '11px', fontWeight: 600 }}>{item.label}</span>
                                                    <span style={{ fontSize: '9px', opacity: 0.7 }}>{item.desc}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Format / Dimensions image */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => { setSizeMenuOpen(!sizeMenuOpen); setScaleMenuOpen(false); setLayerMenuOpen(false); setLangPickerOpen(false); setModulePickerOpen(false); setPoiPickerOpen(false); }}
                                        title="Dimensions et mise en page"
                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}
                                    >
                                        <span>{step.mapPersist?.widthPercent || 100}%</span>
                                        <ChevronDown size={11} />
                                    </button>
                                    {sizeMenuOpen && (
                                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '6px', minWidth: '160px', zIndex: 3500, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700 }}>Largeur</div>
                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                {[100, 75, 50].map(pct => (
                                                    <button
                                                        key={pct}
                                                        onClick={() => {
                                                            dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, widthPercent: pct, width: undefined });
                                                            setSizeMenuOpen(false);
                                                        }}
                                                        style={{ flex: 1, background: (step.mapPersist?.widthPercent || 100) === pct ? 'var(--accent-default)' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', padding: '4px 0', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        {pct}%
                                                    </button>
                                                ))}
                                            </div>
                                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 700, marginTop: '2px' }}>Hauteur</div>
                                            <div style={{ display: 'flex', gap: '3px' }}>
                                                {[{ h: 220, label: '220p' }, { h: 340, label: '340p' }, { h: 480, label: '480p' }].map(item => (
                                                    <button
                                                        key={item.h}
                                                        onClick={() => {
                                                            dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, height: item.h });
                                                            setSizeMenuOpen(false);
                                                        }}
                                                        style={{ flex: 1, background: (step.mapPersist?.height || 340) === item.h ? 'var(--accent-default)' : 'rgba(255,255,255,0.08)', color: '#fff', border: 'none', padding: '4px 0', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        {item.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fond de carte */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => { setLayerMenuOpen(!layerMenuOpen); setScaleMenuOpen(false); setSizeMenuOpen(false); setLangPickerOpen(false); setModulePickerOpen(false); setPoiPickerOpen(false); }}
                                        title="Fond cartographique"
                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: step.mapPersist?.layerId ? '#60a5fa' : 'var(--text-dim)', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px' }}
                                    >
                                        <Layers size={12} />
                                    </button>
                                    {layerMenuOpen && (
                                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '4px', minWidth: '160px', zIndex: 3500, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', padding: '4px 8px', fontWeight: 700 }}>Fond de carte</div>
                                            {[
                                                { id: '', label: 'Défaut global' },
                                                { id: 'PLAN.IGN', label: 'Plan IGN v2' },
                                                { id: 'SCAN25', label: 'Scan 25 IGN' },
                                                { id: 'SAT.IGN', label: 'Satellite Ortho' },
                                                { id: 'CYCLOSM', label: 'CyclOSM Randonnée' },
                                                { id: 'OSM', label: 'OpenStreetMap' },
                                            ].map(lyr => (
                                                <div
                                                    key={lyr.id}
                                                    onClick={() => {
                                                        dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, layerId: lyr.id });
                                                        setLayerMenuOpen(false);
                                                    }}
                                                    style={{ padding: '5px 8px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px', background: (step.mapPersist?.layerId || '') === lyr.id ? 'var(--accent-default)' : 'transparent', color: '#fff' }}
                                                >
                                                    {lyr.label}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Recentrer sur le tracé */}
                                <button
                                    onClick={() => {
                                        const mid = step.coords[Math.floor(step.coords.length / 2)] || step.coords[0];
                                        const denomMap: Record<string, number> = { '1:10000': 10000, '1:25000': 25000, '1:50000': 50000, '1:100000': 100000 };
                                        const curScale = step.mapPersist?.scaleName || '1:25000';
                                        const denom = denomMap[curScale];
                                        const z = denom ? calculateZoomForScale(denom, mid[1]) : (step.mapPersist?.zoom || 15);
                                        dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, center: [mid[1], mid[0]], zoom: z });
                                    }}
                                    title="Recentrer sur le tracé"
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                                >
                                    <Compass size={12} />
                                </button>

                                {/* Verrouillage cadenas */}
                                <button
                                    onClick={() => {
                                        const nextLocked = !step.mapPersist?.isLocked;
                                        dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, isLocked: nextLocked });
                                    }}
                                    title={step.mapPersist?.isLocked ? "Carte verrouillée (cliquez pour déplacer)" : "Verrouiller le déplacement"}
                                    style={{ background: 'transparent', border: 'none', color: step.mapPersist?.isLocked ? '#ef4444' : 'var(--text-dim)', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center' }}
                                >
                                    {step.mapPersist?.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                                </button>

                                <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
                            </>
                        )}
                        
                        {/* Menu d'affichage des éléments IGN (Tracé, Points, Repères & Aires) */}
                                <div style={{ position: 'relative' }}>
                                    <button
                                        onClick={() => { setDisplayMenuOpen(!displayMenuOpen); setScaleMenuOpen(false); setSizeMenuOpen(false); setLayerMenuOpen(false); setLangPickerOpen(false); setModulePickerOpen(false); setPoiPickerOpen(false); }}
                                        title="Éléments affichés sur la carte"
                                        style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}
                                    >
                                        <Eye size={12} />
                                        <span>Affichage</span>
                                        <ChevronDown size={11} />
                                    </button>
                                    {displayMenuOpen && (
                                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '6px', minWidth: '195px', zIndex: 3500, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontSize: '9px', textTransform: 'uppercase', color: '#94a3b8', padding: '2px 6px', fontWeight: 700 }}>Éléments sur la carte</div>
                                            
                                            {/* Tracé de l'itinéraire */}
                                            <div
                                                onClick={() => {
                                                    const cur = step.mapPersist?.showRoute !== false;
                                                    dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, showRoute: !cur });
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', cursor: 'pointer', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: '1.5px solid #60a5fa', background: step.mapPersist?.showRoute !== false ? '#60a5fa' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {step.mapPersist?.showRoute !== false && <Check size={10} color="#000" strokeWidth={3} />}
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#fff' }}>Tracé itinéraire</span>
                                            </div>

                                            {/* Points début & fin */}
                                            <div
                                                onClick={() => {
                                                    const cur = step.mapPersist?.showEndpoints !== false;
                                                    dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, showEndpoints: !cur });
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', cursor: 'pointer', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: '1.5px solid #34d399', background: step.mapPersist?.showEndpoints !== false ? '#34d399' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {step.mapPersist?.showEndpoints !== false && <Check size={10} color="#000" strokeWidth={3} />}
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#fff' }}>Points départ & arrivée</span>
                                            </div>

                                            {/* Repères, aires & dessins */}
                                            <div
                                                onClick={() => {
                                                    const cur = step.mapPersist?.showAnnotations !== false;
                                                    dispatch({ type: 'PERSIST_MAP_STATE', stepId: step.id, showAnnotations: !cur });
                                                }}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', cursor: 'pointer', borderRadius: '4px', background: 'rgba(255,255,255,0.03)' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: '1.5px solid #fbbf24', background: step.mapPersist?.showAnnotations !== false ? '#fbbf24' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {step.mapPersist?.showAnnotations !== false && <Check size={10} color="#000" strokeWidth={3} />}
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#fff' }}>Repères, aires & dessins</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
<div style={{ position: 'relative' }}>
                            <button onClick={() => { setLangPickerOpen(!langPickerOpen); setModulePickerOpen(false); setPoiPickerOpen(false); setScaleMenuOpen(false); setSizeMenuOpen(false); setLayerMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: `transparent`, border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                <Globe size={12} /> Langage : {navLanguage || 'Aléatoire'} <ChevronDown size={12} />
                            </button>
                            {langPickerOpen && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '4px', minWidth: '120px', zIndex: 3500 }}>
                                    {NAV_LANGUAGES.map(lang => (
                                        <div key={lang} onClick={() => { onNavLanguageChange(lang); setLangPickerOpen(false); }} style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '4px', color: lang === navLanguage ? '#fff' : 'var(--text-default)' }}>
                                            {lang}
                                        </div>
                                    ))}
                                    <div onClick={() => { onNavLanguageChange(undefined); setLangPickerOpen(false); }} style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '4px', color: !navLanguage ? '#fff' : 'var(--text-default)' }}>
                                        Aléatoire
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* POI Picker */}
                        {pois && pois.length > 0 && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => { setPoiPickerOpen(!poiPickerOpen); setLangPickerOpen(false); setModulePickerOpen(false); setScaleMenuOpen(false); setSizeMenuOpen(false); setLayerMenuOpen(false); }}
                                    title="Sélectionner un point d'intérêt"
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', color: pois.some((p: any) => p.selected) ? '#fbbf24' : 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}
                                >
                                    📍 POI <ChevronDown size={12} />
                                </button>
                                {poiPickerOpen && (
                                    <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '6px', minWidth: '220px', zIndex: 3500, boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
                                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700, padding: '2px 6px 6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Points d'intérêt proches</div>
                                        {pois.map((poi: any) => (
                                            <div
                                                key={poi.id}
                                                onClick={() => onPoiToggle && onPoiToggle(poi.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer', borderRadius: '6px', background: poi.selected ? 'rgba(251,191,36,0.08)' : 'transparent' }}
                                            >
                                                <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: `2px solid ${poi.selected ? '#fbbf24' : 'var(--bg-border)'}`, background: poi.selected ? '#fbbf24' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    {poi.selected && <Check size={9} color="#000" />}
                                                </div>
                                                <span style={{ fontSize: '12px', color: poi.selected ? '#fbbf24' : 'var(--text-default)', flex: 1 }}>{poi.name}</span>
                                            </div>
                                        ))}
                                        {pois.every((p: any) => !p.selected) && (
                                            <div style={{ fontSize: '10px', color: 'var(--text-dim)', padding: '4px 8px', fontStyle: 'italic' }}>Aucun POI sélectionné — phrase sans landmark</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ position: 'relative' }}>
                            <button onClick={() => { setModulePickerOpen(!modulePickerOpen); setLangPickerOpen(false); setScaleMenuOpen(false); setSizeMenuOpen(false); setLayerMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: `${accentColor}15`, border: 'none', color: accentColor, cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                {meta?.label || step.moduleId} <ChevronDown size={12} />
                            </button>
                            {modulePickerOpen && (
                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '8px', padding: '4px', minWidth: '180px', zIndex: 3500 }}>
                                    {ALL_MODULES.map(modId => (
                                        <div key={modId} onClick={() => { onModuleChange(modId); setModulePickerOpen(false); }} style={{ padding: '6px 8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '4px' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: MODULE_META[modId].color }} />
                                            {MODULE_META[modId].label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ marginTop: (isFirst && hasWarnings) ? '40px' : '0', paddingTop: dangerText ? ((isFirst && hasWarnings) ? '32px' : '36px') : '0' }}>
                    {isEditing ? (
                        <InlineEditor stepId={step.id} solutionText={solutionLine} moduleId={step.moduleId} lineIdx={lineIdx} onClose={() => setIsEditing(false)} />
                    ) : !isVisual ? (
                        <div style={{ marginBottom: '8px', cursor: 'pointer' }} onClick={onLineClick}>
                            {isSolutionView ? (
                                <div style={{ fontSize: '13px', color: dangerColor || 'var(--semantic-green)', fontWeight: dangerColor ? 700 : 600, lineHeight: 1.5 }}>
                                    <HighlightedText text={solutionLine} pois={pois} isEncoded={false} />
                                </div>
                            ) : isEncoded ? (
                                <>
                                    <div style={{ fontFamily: font, fontSize: fontSize, color: dangerColor || 'var(--text-primary)', fontWeight: dangerColor ? 700 : 'normal', wordBreak: 'break-all', letterSpacing: step.moduleId === 'morse' ? '2px' : '0.02em', lineHeight: 1.4 }}>
                                        <HighlightedText text={encodedLine} pois={pois} isEncoded={true} />
                                    </div>
                                    {(hovered || solutionVisible) && (
                                        <div style={{ fontSize: '11px', color: dangerColor || 'var(--semantic-green)', marginTop: '4px', fontWeight: 600 }}>
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
                        /* Contenu visuel rendu directement dans l'encart de l'étape */
                        <div style={{ marginBottom: '8px' }}>
                            {hasGilwell && <div dangerouslySetInnerHTML={{ __html: step.gilwellSvg! }} style={{ marginBottom: '12px', textAlign: 'left' }} />}
                            {hasMap && isFirst && (
                                <MiniMap
                                    stepId={step.id}
                                    moduleId={step.moduleId}
                                    coords={step.coords}
                                    initialPersist={step.mapPersist}
                                />
                            )}
                            {isSolutionView && (
                                <div style={{ fontSize: '12px', color: 'var(--semantic-green)', marginTop: '8px', fontWeight: 600 }}>
                                    <HighlightedText text={solutionLine} pois={pois} isEncoded={false} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function HighlightedText({ text, pois, isEncoded }: { text: string, pois?: any[], isEncoded: boolean }) {
    if (!text || isEncoded) return <>{text}</>;

    const selectedPoi = pois?.find(p => p.selected);
    const poiName = selectedPoi ? selectedPoi.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    
    // Distances: e.g., 100 pas, 150 mètres, 1.5 km
    const distanceRegex = '\\d+(?:\\.\\d+)?\\s*(?:pas|mètres|km|kilomètres)';
    
    // Azimuth directions — case-sensitive: cardinal points must be capitalized
    // Matches: "au 347°", "au Nord", "du Nord-Est", "1 heure", "12 heures",
    //          "tout droit", "demi-tour", "tournez à droite", "tournez légèrement à gauche", etc.
    const azimuthRegex = [
        'au\\s+\\d+°',                                      // au 347°
        '\\d+°',                                             // raw 180°
        'du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?', // du Nord-Est
        'en direction du\\s+(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?', // en direction du Sud-Ouest
        '(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest)(?:-(?:Nord|Sud|Est|Ouest))?)?(?=\\b|$)', // bare cardinal
        '(?:tournez\\s+)?légèrement\\s+à\\s+(?:droite|gauche)',
        '(?:tournez\\s+)?à\\s+(?:droite|gauche)',
        'faites\\s+un\\s+demi-tour(?:\\s+à\\s+(?:droite|gauche))?',
        'demi-tour',
        'continuez\\s+tout\\s+droit',
        'tout\\s+droit(?:\\s+\\(12h\\))?',
        '\\d+\\s+heure(?:s)?(?:\\s+\\(.*?\\))?',            // 3 heures, 12 heures (6h)
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

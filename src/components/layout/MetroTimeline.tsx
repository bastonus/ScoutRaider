import React, { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '../../AppContext';
import { PolySegment } from '../../logic/types';
import type { ModuleId } from '../../logic/types';
import { ALL_MODULE_IDS, MODULE_META } from '../../logic/ModuleRegistry';

export const MODULE_DRAG_TYPE = 'application/x-scoutraider-module';

const fmtDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
const fmtAzimut = (a?: number) => a !== undefined ? `${Math.round(a)}°` : '—';
const compassLabel = (a?: number) => {
    if (a === undefined) return '';
    return ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(a / 45) % 8];
};

export default function MetroTimeline() {
    const { state, dispatch } = useApp();
    const steps: PolySegment[] = state.polygonal_steps || [];
    const stages = state.stages || [];

    const [selection, setSelection] = useState<number[]>([]);
    const [expandedLegs, setExpandedLegs] = useState<Set<string>>(new Set());
    const [dragOver, setDragOver] = useState<number | null>(null);

    // ── Group segments by leg ──────────────────────────────────────────────────
    const groupedLegs: { legKey: string; startLabel: string; endLabel: string; segments: { globalIdx: number; seg: PolySegment }[] }[] = [];
    
    if (state.routes && state.routes.length > 0 && steps.length > 0) {
        // Calculate the boundary index in the flattened allCoords array for each route
        let cumulativePoints = 0;
        const boundaries = state.routes.map(r => {
            const pts = r?.geojson?.geometry?.coordinates || r?.geojson?.coordinates || [];
            cumulativePoints += pts.length;
            return cumulativePoints;
        });

        let currentLegIdx = 0;
        let currentSegments: { globalIdx: number; seg: PolySegment }[] = [];

        for (let i = 0; i < steps.length; i++) {
            const seg = steps[i];
            const startIdx = seg.properties?.start_idx || 0;

            // Advance currentLegIdx if the segment's start_idx is past the current boundary
            while (currentLegIdx < boundaries.length - 1 && startIdx >= boundaries[currentLegIdx]) {
                if (currentSegments.length > 0) {
                    groupedLegs.push({
                        legKey: state.routes[currentLegIdx]?.id || `leg_missing_${currentLegIdx}`,
                        startLabel: stages[currentLegIdx]?.label || '?',
                        endLabel: stages[currentLegIdx + 1]?.label || '?',
                        segments: currentSegments
                    });
                }
                currentLegIdx++;
                currentSegments = [];
            }

            currentSegments.push({ globalIdx: i, seg });
        }

        if (currentSegments.length > 0) {
            groupedLegs.push({
                legKey: state.routes[currentLegIdx]?.id || 'leg_end',
                startLabel: stages[currentLegIdx]?.label || '?',
                endLabel: stages[currentLegIdx + 1]?.label || '?',
                segments: currentSegments
            });
        }
    }

    // ── Selection ─────────────────────────────────────────────────────────────
    const toggleSelection = (e: React.MouseEvent, idx: number) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            setSelection(prev => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]);
        } else if (e.shiftKey && selection.length > 0) {
            const last = selection[selection.length - 1];
            const [s, end] = [Math.min(last, idx), Math.max(last, idx)];
            setSelection(Array.from(new Set([...selection, ...Array.from({ length: end - s + 1 }, (_, k) => s + k)])));
        } else {
            setSelection(prev => prev.length === 1 && prev[0] === idx ? [] : [idx]);
        }
    };

    const selectLeg = (e: React.MouseEvent, leg: typeof groupedLegs[0]) => {
        e.stopPropagation();
        const all = leg.segments.map(s => s.globalIdx);
        setSelection(all.every(i => selection.includes(i)) ? [] : all);
    };

    const handleAssign = (moduleId: string, targets?: number[]) => {
        const sel = targets ?? selection;
        if (sel.length === 0) return;
        dispatch({ type: 'ASSIGN_MODULES_RANGE', startIdx: Math.min(...sel), endIdx: Math.max(...sel), moduleId });
        if (!targets) setSelection([]);
    };

    const onDragStartModule = (e: React.DragEvent, moduleId: string) => {
        e.dataTransfer.setData(MODULE_DRAG_TYPE, moduleId);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const onSegmentDrop = (e: React.DragEvent, globalIdx: number) => {
        e.preventDefault();
        const moduleId = e.dataTransfer.getData(MODULE_DRAG_TYPE) || e.dataTransfer.getData('text/plain');
        if (!moduleId) return;
        handleAssign(moduleId, selection.includes(globalIdx) ? selection : [globalIdx]);
        setDragOver(null);
    };

    const toggleLeg = (legKey: string) =>
        setExpandedLegs(prev => {
            const next = new Set(prev);
            next.has(legKey) ? next.delete(legKey) : next.add(legKey);
            return next;
        });

    // ── Stage circle ──────────────────────────────────────────────────────────
    const StageNode = ({ label }: { label: string }) => (
        <div style={{
            width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--bg-dark)', border: '2px solid var(--accent-default)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '9px', fontWeight: 800, color: 'var(--accent-default)',
        }}>{label}</div>
    );

    // ── Segment square ────────────────────────────────────────────────────────
    const SegSquare = ({ globalIdx, seg, size = 10 }: { globalIdx: number; seg: PolySegment; size?: number }) => {
        const isSelected = selection.includes(globalIdx);
        const isDragOver = dragOver === globalIdx;
        let color = MODULE_META[seg.assigned_module as ModuleId]?.color || 'var(--bg-border)';
        
        if (isDragOver) {
            const draggingMod = (window as any).__draggingModuleId;
            if (draggingMod && MODULE_META[draggingMod as ModuleId]) {
                color = MODULE_META[draggingMod as ModuleId].color;
            }
        }
        
        const label = MODULE_META[seg.assigned_module as ModuleId]?.label;
        return (
            <div
                onClick={e => toggleSelection(e, globalIdx)}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(globalIdx); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => onSegmentDrop(e, globalIdx)}
                title={`#${globalIdx + 1}${label ? ` · ${label}` : ''} · ${fmtDist(seg.distance || 0)} · ${fmtAzimut(seg.azimut)} ${compassLabel(seg.azimut)}`}
                style={{
                    width: `${size}px`, height: `${size}px`,
                    background: color,
                    borderRadius: '2px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    outline: isSelected ? `2px solid #f59e0b` : isDragOver ? `2px solid #fff` : 'none',
                    outlineOffset: '1px',
                    opacity: isDragOver ? 1 : 0.85,
                    transition: '0.1s',
                    position: 'relative',
                    transform: isDragOver ? 'scale(2.5)' : 'scale(1)',
                    zIndex: isDragOver ? 100 : 1,
                    boxShadow: isDragOver ? `0 0 10px ${color}` : (isSelected ? `0 0 6px #f59e0b88` : 'none')
                }}
            />
        );
    };

    return (
        <div style={{
            position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 1200, display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: '6px', pointerEvents: 'none', width: '90%', maxWidth: '1050px'
        }}>
            <div style={{
                background: 'rgba(14, 22, 17, 0.96)', border: '1px solid var(--glass-border)',
                borderRadius: '10px', padding: '8px 12px', pointerEvents: 'all',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)', backdropFilter: 'blur(14px)',
                width: '100%', display: 'flex', flexDirection: 'column', gap: '5px'
            }}>
                {/* ── HEADER ────────────────────────────────────────────── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                            Encodage d'itinéraire
                        </span>
                        {steps.length > 0 && (
                            <span style={{ fontSize: '10px', color: 'var(--accent-default)', fontWeight: 700, background: 'rgba(110,201,126,0.12)', padding: '1px 7px', borderRadius: '10px' }}>
                                {steps.length} tronçons
                            </span>
                        )}
                        {selection.length > 0 && (
                            <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700, background: 'rgba(245,158,11,0.12)', padding: '1px 7px', borderRadius: '10px' }}>
                                {selection.length} sélectionné{selection.length > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => dispatch({ type: 'REBUILD_CARNET' })}
                        style={{
                            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
                            color: 'var(--text-bright)', borderRadius: '5px', padding: '3px 9px',
                            fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer'
                        }}
                    >
                        <RefreshCw size={11} /> Répartir auto
                    </button>
                </div>

                {/* ── LEG ROWS ───────────────────────────────────────────── */}
                {groupedLegs.length === 0 ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', padding: '2px 0' }}>Tracer d'abord un itinéraire</span>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {groupedLegs.map(leg => {
                            const isExpanded = expandedLegs.has(leg.legKey);
                            const someSelected = leg.segments.some(s => selection.includes(s.globalIdx));
                            const allSelected = leg.segments.every(s => selection.includes(s.globalIdx));
                            const legDist = leg.segments.reduce((a, s) => a + (s.seg.distance || 0), 0);

                            return (
                                <div key={leg.legKey} style={{
                                    border: `1px solid ${someSelected ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.05)'}`,
                                    borderRadius: '7px', overflow: 'hidden'
                                }}>
                                    {/* Collapsed row */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '4px 8px',
                                        background: allSelected ? 'rgba(245,158,11,0.06)' : 'transparent',
                                    }}>
                                        {/* Expand toggle */}
                                        <button
                                            onClick={() => toggleLeg(leg.legKey)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0', display: 'flex' }}
                                        >
                                            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                        </button>

                                        <StageNode label={leg.startLabel} />

                                        {/* ── SEGMENT SQUARES (compact row) ── */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
                                            {leg.segments.map(({ globalIdx, seg }) => (
                                                <SegSquare key={globalIdx} globalIdx={globalIdx} seg={seg} size={10} />
                                            ))}
                                        </div>

                                        <StageNode label={leg.endLabel} />

                                        {/* Leg stats */}
                                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', flexShrink: 0, marginLeft: '4px' }}>
                                            {fmtDist(legDist)}
                                        </span>
                                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', flexShrink: 0 }}>
                                            {leg.segments.length} tronç.
                                        </span>

                                        {/* Leg select-all */}
                                        <button
                                            onClick={e => selectLeg(e, leg)}
                                            style={{
                                                background: allSelected ? 'rgba(245,158,11,0.15)' : 'transparent',
                                                border: '1px solid rgba(255,255,255,0.08)',
                                                borderRadius: '4px', padding: '2px 6px', cursor: 'pointer',
                                                fontSize: '9px', color: 'var(--text-dim)', flexShrink: 0, whiteSpace: 'nowrap'
                                            }}
                                        >
                                            {allSelected ? 'Désél.' : 'Tout sél.'}
                                        </button>
                                    </div>

                                    {/* ── EXPANDED: larger squares + labels ── */}
                                    {isExpanded && (
                                        <div style={{
                                            display: 'flex', flexWrap: 'wrap', gap: '4px',
                                            padding: '6px 10px 8px',
                                            background: 'rgba(0,0,0,0.15)',
                                            borderTop: '1px solid rgba(255,255,255,0.04)'
                                        }}>
                                            {leg.segments.map(({ globalIdx, seg }) => {
                                                const isSelected = selection.includes(globalIdx);
                                                const isDragOver = dragOver === globalIdx;
                                                let color = MODULE_META[seg.assigned_module as ModuleId]?.color || '#6b7280';
                                                
                                                if (isDragOver) {
                                                    const draggingMod = (window as any).__draggingModuleId;
                                                    if (draggingMod && MODULE_META[draggingMod as ModuleId]) {
                                                        color = MODULE_META[draggingMod as ModuleId].color;
                                                    }
                                                }
                                                
                                                const label = MODULE_META[seg.assigned_module as ModuleId]?.label;
                                                return (
                                                    <div
                                                        key={globalIdx}
                                                        onClick={e => toggleSelection(e, globalIdx)}
                                                        onDragOver={e => { 
                                                            e.preventDefault(); 
                                                            e.dataTransfer.dropEffect = 'copy';
                                                            setDragOver(globalIdx); 
                                                        }}
                                                        onDragLeave={() => setDragOver(null)}
                                                        onDrop={e => onSegmentDrop(e, globalIdx)}
                                                        title={`#${globalIdx + 1} · ${label || '—'} · ${fmtDist(seg.distance || 0)} · ${fmtAzimut(seg.azimut)} ${compassLabel(seg.azimut)}`}
                                                        style={{
                                                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                                                            cursor: 'pointer', padding: '3px',
                                                            borderRadius: '4px',
                                                            background: isSelected ? 'rgba(245,158,11,0.1)' : isDragOver ? `${color}44` : 'transparent',
                                                            outline: isSelected ? '1.5px solid #f59e0b' : isDragOver ? `2px solid ${color}` : 'none',
                                                            outlineOffset: '1px',
                                                            transition: '0.1s',
                                                            transform: isDragOver ? 'scale(1.5)' : 'scale(1)',
                                                            zIndex: isDragOver ? 100 : 1,
                                                            position: 'relative'
                                                        }}
                                                    >
                                                        {/* Big square */}
                                                        <div style={{
                                                            width: '16px', height: '16px',
                                                            background: color,
                                                            borderRadius: '3px',
                                                            boxShadow: isDragOver ? `0 0 10px ${color}` : (isSelected ? `0 0 6px ${color}88` : 'none')
                                                        }} />
                                                        {/* Index */}
                                                        <span style={{ fontSize: '8px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>
                                                            {globalIdx + 1}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── MODULE PALETTE — visible si sélection ─────────────────── */}
            {selection.length > 0 && (
                <div style={{
                    background: 'rgba(14, 22, 17, 0.97)', border: '1px solid var(--glass-border)',
                    padding: '7px 12px', borderRadius: '10px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    pointerEvents: 'all', animation: 'slideInY 0.15s ease-out',
                    display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap',
                    backdropFilter: 'blur(14px)', width: '100%'
                }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
                        {selection.length} tronçon{selection.length > 1 ? 's' : ''} →
                    </span>
                    {ALL_MODULE_IDS.map(modId => {
                        const meta = MODULE_META[modId];
                        const allHave = selection.every(i => steps[i]?.assigned_module === modId);
                        return (
                            <button
                                key={modId}
                                draggable
                                onDragStart={e => onDragStartModule(e, modId)}
                                onClick={() => handleAssign(modId)}
                                title={meta.label}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    padding: '3px 8px', borderRadius: '20px', cursor: 'grab',
                                    background: allHave ? `${meta.color}33` : 'rgba(255,255,255,0.04)',
                                    border: `1.5px solid ${allHave ? meta.color : 'rgba(255,255,255,0.1)'}`,
                                    color: allHave ? meta.color : 'var(--text-dim)',
                                    fontSize: '11px', fontWeight: 700, transition: 'all 0.12s',
                                    boxShadow: allHave ? `0 0 8px ${meta.color}44` : 'none'
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.background = `${meta.color}22`;
                                    e.currentTarget.style.borderColor = meta.color;
                                    e.currentTarget.style.color = meta.color;
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.background = allHave ? `${meta.color}33` : 'rgba(255,255,255,0.04)';
                                    e.currentTarget.style.borderColor = allHave ? meta.color : 'rgba(255,255,255,0.1)';
                                    e.currentTarget.style.color = allHave ? meta.color : 'var(--text-dim)';
                                }}
                            >
                                <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: meta.color, flexShrink: 0 }} />
                                {meta.label}
                            </button>
                        );
                    })}
                    <button onClick={() => handleAssign('unassigned')} style={{ padding: '3px 8px', borderRadius: '20px', cursor: 'pointer', background: 'transparent', border: '1.5px dashed rgba(255,255,255,0.15)', color: 'var(--text-dim)', fontSize: '11px', fontWeight: 700 }}>× Effacer</button>
                    <button onClick={() => setSelection([])} style={{ marginLeft: 'auto', padding: '3px 7px', borderRadius: '5px', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)', fontSize: '10px' }}>✕</button>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, FolderOpen, MoreHorizontal, Search } from 'lucide-react';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import { Stage } from '../../logic/types';

// ── IGN Geocoding ─────────────────────────────────────────────────────────────
interface SearchResult {
    label: string;
    postcode?: string;
    lat: number;
    lon: number;
}

async function searchIGN(query: string): Promise<SearchResult[]> {
    try {
        const url = `https://data.geopf.fr/geocodage/completion?text=${encodeURIComponent(query)}&maximumResponses=6&type=StreetAddress,PositionOfInterest`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).map((r: any) => ({
            label: r.fulltext || r.label || '',
            postcode: r.postcode || '',
            lat: parseFloat(r.y),
            lon: parseFloat(r.x),
        })).filter((r: SearchResult) => !isNaN(r.lat) && !isNaN(r.lon));
    } catch {
        return [];
    }
}

// ── Shared Routing Helper ─────────────────────────────────────────────────────
function reRouteAdjacentLegs(
    stages: Stage[],
    routes: any[],
    smallRoads: boolean,
    dispatch: any,
    movedIdx: number,
    newLat: number,
    newLon: number
) {
    if (movedIdx > 0) {
        const prevStage = stages[movedIdx - 1];
        if (routes[movedIdx - 1]) dispatch({ type: 'REMOVE_ROUTE', id: routes[movedIdx - 1].id });
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recalcul...' });
        backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-prev`, {
            p1: [prevStage.coords[0], prevStage.coords[1]],
            p2: [newLat, newLon],
            profile: 'pedestrian',
            small_roads: smallRoads,
            insertIdx: movedIdx - 1
        });
    }
    if (movedIdx < stages.length - 1) {
        const nextStage = stages[movedIdx + 1];
        if (routes[movedIdx]) dispatch({ type: 'REMOVE_ROUTE', id: routes[movedIdx].id });
        backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}-next`, {
            p1: [newLat, newLon],
            p2: [nextStage.coords[0], nextStage.coords[1]],
            profile: 'pedestrian',
            small_roads: smallRoads,
            insertIdx: movedIdx
        });
    }
}

// ── StageRow Component ────────────────────────────────────────────────────────
function StageRow({ stage, idx, isDragged, onDragStart, onDragOver, onDrop, onDragEnd }: any) {
    const { state, dispatch } = useApp();
    const [query, setQuery] = useState(stage.address || `${stage.coords[0].toFixed(5)}, ${stage.coords[1].toFixed(5)}`);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Sync input when stage changes externally
    useEffect(() => {
        if (!isFocused) {
            setQuery(stage.address || `${stage.coords[0].toFixed(5)}, ${stage.coords[1].toFixed(5)}`);
        }
    }, [stage.address, stage.coords, isFocused]);

    // Click outside to close results
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounce search
    useEffect(() => {
        if (!isFocused) return;
        const timer = setTimeout(async () => {
            if (query.trim().length >= 3) {
                const res = await searchIGN(query);
                setResults(res);
                setShowResults(true);
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 320);
        return () => clearTimeout(timer);
    }, [query, isFocused]);

    const handleSelect = (r: SearchResult) => {
        setQuery(r.label);
        setShowResults(false);
        setIsFocused(false);
        dispatch({ type: 'MOVE_STAGE', id: stage.id, lat: r.lat, lon: r.lon, address: r.label });
        reRouteAdjacentLegs(state.stages, state.routes, state.small_roads_only, dispatch, idx, r.lat, r.lon);
    };

    const handleDelete = () => {
        dispatch({ type: 'REMOVE_STAGE', id: stage.id });
        if (idx > 0 && idx < state.stages.length - 1) {
            const prevStage = state.stages[idx - 1];
            const nextStage = state.stages[idx + 1];
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Reconnexion...' });
            backgroundEngine.enqueue('route_leg', 0, `job-route-bridge-${Date.now()}`, {
                p1: [prevStage.coords[0], prevStage.coords[1]],
                p2: [nextStage.coords[0], nextStage.coords[1]],
                profile: 'pedestrian',
                small_roads: state.small_roads_only,
                insertIdx: idx - 1
            });
        }
    };

    return (
        <div
            ref={wrapperRef}
            style={{ position: 'relative' }}
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
        >
            <div className="stage-pill" style={{
                display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 8px',
                background: isFocused ? 'var(--bg-dark)' : 'var(--bg-surface)',
                border: isFocused ? '1px solid var(--accent-default)' : '1px solid var(--glass-border)',
                borderRadius: 'var(--radius-pill)', transition: '0.2s',
                opacity: isDragged ? 0.5 : 1,
                cursor: 'grab'
            }}>
                <div className="stage-letter" style={{
                    width: '25px', height: '25px', borderRadius: '50%', background: '#fff',
                    border: '2.5px solid var(--accent-default)', color: 'var(--accent-default)',
                    fontWeight: 800, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                    {stage.label}
                </div>
                <input
                    className="stage-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { setIsFocused(true); if (results.length > 0) setShowResults(true); }}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    placeholder="Adresse ou lieu…"
                    style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: '#fff', fontSize: '12px', fontFamily: 'var(--font-mono)'
                    }}
                />
                <button
                    type="button"
                    className="btn-icon btn-sm"
                    onClick={handleDelete}
                    style={{ color: 'var(--semantic-red)', width: '22px', height: '22px' }}
                >
                    <X size={13} strokeWidth={2.5} />
                </button>
            </div>

            {/* Dropdown */}
            {showResults && results.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                    background: 'var(--bg-panel)', border: '1px solid var(--bg-border)',
                    borderRadius: '8px', zIndex: 100, overflow: 'hidden',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                }}>
                    {results.map((r, i) => (
                        <div
                            key={i}
                            onClick={() => handleSelect(r)}
                            style={{
                                padding: '8px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                borderBottom: i < results.length - 1 ? '1px solid var(--bg-border)' : 'none',
                                background: 'transparent'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-transparent)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span>
                            {r.postcode && <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{r.postcode}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── AddStageRow Component ─────────────────────────────────────────────────────
function AddStageRow() {
    const { state, dispatch } = useApp();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowResults(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.trim().length >= 3) {
                const res = await searchIGN(query);
                setResults(res);
                setShowResults(true);
            } else {
                setResults([]);
                setShowResults(false);
            }
        }, 320);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSelect = (r: SearchResult) => {
        setQuery('');
        setShowResults(false);
        
        // 1. Add Stage
        dispatch({ type: 'ADD_STAGE', lat: r.lat, lon: r.lon, label: '-', address: r.label });

        // 2. Trigger routing
        const anchorIdx = state.anchor_stage_idx >= 0 ? state.anchor_stage_idx : state.stages.length - 1;
        if (anchorIdx >= 0 && anchorIdx < state.stages.length) {
            const prevStage = state.stages[anchorIdx];
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul du tronçon...' });
            backgroundEngine.enqueue('route_leg', 0, `job-route-add-${Date.now()}`, {
                p1: [prevStage.coords[0], prevStage.coords[1]],
                p2: [r.lat, r.lon],
                profile: 'pedestrian',
                small_roads: state.small_roads_only,
                insertIdx: anchorIdx
            });

            if (anchorIdx < state.stages.length - 1) {
                const nextStage = state.stages[anchorIdx + 1];
                if (state.routes[anchorIdx]) dispatch({ type: 'REMOVE_ROUTE', id: state.routes[anchorIdx].id });
                backgroundEngine.enqueue('route_leg', 0, `job-route-add-next-${Date.now()}`, {
                    p1: [r.lat, r.lon],
                    p2: [nextStage.coords[0], nextStage.coords[1]],
                    profile: 'pedestrian',
                    small_roads: state.small_roads_only,
                    insertIdx: anchorIdx + 1
                });
            }
        }

        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div
                className="stage-pill"
                onClick={() => { if (state.active_tool !== 'route') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' }); }}
                style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '5px 8px',
                    background: 'var(--bg-surface)', border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-pill)', cursor: 'text'
                }}
            >
                <div className="stage-letter dim" style={{
                    width: '25px', height: '25px', borderRadius: '50%', background: 'var(--bg-surface)',
                    border: '2.5px solid var(--bg-border)', color: 'var(--text-dim)',
                    fontWeight: 800, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>+</div>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if (results.length > 0) setShowResults(true); }}
                    placeholder="Cliquer ou chercher adresse…"
                    style={{
                        flex: 1, background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--text-primary)', fontSize: '12px'
                    }}
                />
                <button type="button" className="btn-icon btn-sm" style={{ color: 'var(--semantic-green)', width: '22px', height: '22px' }}>
                    <Plus size={14} strokeWidth={3} />
                </button>
            </div>

            {/* Dropdown */}
            {showResults && results.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px',
                    background: 'var(--bg-panel)', border: '1px solid var(--bg-border)',
                    borderRadius: '8px', zIndex: 100, overflow: 'hidden',
                    boxShadow: '0 -8px 24px rgba(0,0,0,0.5)'
                }}>
                    {results.map((r, i) => (
                        <div
                            key={i}
                            onClick={() => handleSelect(r)}
                            style={{
                                padding: '8px 12px', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                                borderBottom: i < results.length - 1 ? '1px solid var(--bg-border)' : 'none',
                                background: 'transparent'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-transparent)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span>
                            {r.postcode && <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{r.postcode}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main RoutePanel Component ─────────────────────────────────────────────────
export default function RoutePanel() {
    const { state, dispatch } = useApp();
    const stages = state.stages;

    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const prevLength = useRef(stages.length);

    useEffect(() => {
        if (stages.length > prevLength.current) {
            if (scrollRef.current) {
                // Scroll to the bottom
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        }
        prevLength.current = stages.length;
    }, [stages.length]);

    const getStageDistance = (index: number) => {
        if (index === 0) return undefined;
        const leg = state.routes[index - 1];
        if (!leg || !leg.geojson || !leg.geojson.geometry) return 'Calcul...';

        const coords = leg.geojson.geometry.coordinates;
        if (!coords || coords.length < 2) return '0.00 KM';

        let dist = 0;
        const R = 6371e3;
        for (let i = 0; i < coords.length - 1; i++) {
            const [lon1, lat1] = coords[i];
            const [lon2, lat2] = coords[i+1];
            const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
            const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
            dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        return `${(dist / 1000).toFixed(2)} KM`;
    };

    const handleDrop = (idx: number) => {
        if (draggedIdx === null || draggedIdx === idx) {
            setDraggedIdx(null);
            return;
        }
        const newStages = [...stages];
        const [moved] = newStages.splice(draggedIdx, 1);
        newStages.splice(idx, 0, moved);
        dispatch({ type: 'REORDER_STAGES', stages: newStages });
        setDraggedIdx(null);
        
        // Full recalculation
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recalcul global...' });
        for (let i = 0; i < newStages.length - 1; i++) {
            const p1 = newStages[i].coords;
            const p2 = newStages[i + 1].coords;
            backgroundEngine.enqueue('route_leg', 0, `job-route-reorder-${Date.now()}-${i}`, {
                p1: [p1[0], p1[1]],
                p2: [p2[0], p2[1]],
                profile: 'pedestrian',
                small_roads: state.small_roads_only,
                insertIdx: i
            });
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 8px',
                background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--bg-border)',
                color: 'var(--text-primary)', fontSize: '11px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em', userSelect: 'none',
                flexShrink: 0, justifyContent: 'space-between',
            }}>
                <span>Étapes de l'itinéraire</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button type="button" className="btn-icon btn-sm" title="Options" style={{ width: '22px', height: '22px', opacity: 0.6 }}>
                        <MoreHorizontal size={13} />
                    </button>
                    <button type="button" className="btn-icon btn-sm" title="Charger un projet" style={{ width: '22px', height: '22px', opacity: 0.6 }}>
                        <FolderOpen size={13} />
                    </button>
                </div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', scrollBehavior: 'smooth' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {stages.map((stage, idx) => (
                        <React.Fragment key={stage.id}>
                            <StageRow
                                stage={stage}
                                idx={idx}
                                isDragged={draggedIdx === idx}
                                onDragStart={() => setDraggedIdx(idx)}
                                onDragOver={(e: any) => e.preventDefault()}
                                onDrop={() => handleDrop(idx)}
                                onDragEnd={() => setDraggedIdx(null)}
                            />
                            {idx < stages.length - 1 && (
                                <div className="stage-connector" style={{
                                    height: '14px', marginLeft: '18px', borderLeft: '2px dashed var(--bg-border)',
                                    display: 'flex', alignItems: 'center', paddingLeft: '12px'
                                }}>
                                    <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 600 }}>
                                        {getStageDistance(idx + 1)}
                                    </span>
                                </div>
                            )}
                        </React.Fragment>
                    ))}

                    <div className="stage-connector" style={{ height: stages.length > 0 ? '14px' : '0', marginLeft: '18px', borderLeft: stages.length > 0 ? '2px dashed var(--bg-border)' : 'none' }} />
                    <AddStageRow />
                </div>
            </div>
        </div>
    );
}

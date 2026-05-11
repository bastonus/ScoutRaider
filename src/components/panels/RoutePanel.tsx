import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, FolderOpen, MoreHorizontal, GripVertical, MapPin } from 'lucide-react';
import { useApp } from '../../AppContext';
import { backgroundEngine } from '../../logic/BackgroundEngine';
import { StateManager } from '../../logic/StateManager';
import { Stage } from '../../logic/types';

interface SearchResult { label: string; postcode?: string; lat: number; lon: number; }

async function searchIGN(query: string): Promise<SearchResult[]> {
    try {
        const url = `https://data.geopf.fr/geocodage/completion?text=${encodeURIComponent(query)}&maximumResponses=6&type=StreetAddress,PositionOfInterest`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return (data.results || []).map((r: any) => ({
            label: r.fulltext || r.label || '',
            postcode: r.postcode || '',
            lat: parseFloat(r.y), lon: parseFloat(r.x),
        })).filter((r: SearchResult) => !isNaN(r.lat) && !isNaN(r.lon));
    } catch { return []; }
}

/** Try to parse a raw coordinate string like "48.8566, 2.3522" or "48.8566 2.3522".
 *  Accepts comma or space as separator, and both '.' and ',' as decimal mark. */
function parseCoords(raw: string): { lat: number; lon: number } | null {
    // Normalise: replace commas used as decimal marks inside numbers, then split on remaining comma/semicolon/space
    const s = raw.trim();
    // Pattern: two floating-point numbers separated by comma, semicolon, or whitespace
    const m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d+(?:[.,]\d+)?)$/);
    if (!m) return null;
    const lat = parseFloat(m[1].replace(',', '.'));
    const lon = parseFloat(m[2].replace(',', '.'));
    if (isNaN(lat) || isNaN(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return { lat, lon };
}

function reRouteAdjacentLegs(stages: Stage[], routes: any[], smallRoads: boolean, dispatch: any, movedIdx: number, newLat: number, newLon: number) {
    if (movedIdx > 0) {
        const prev = stages[movedIdx - 1];
        if (routes[movedIdx - 1]) dispatch({ type: 'REMOVE_ROUTE', id: routes[movedIdx - 1].id });
        backgroundEngine.enqueue('route_leg', 0, `job-${Date.now()}-prev`, { p1: [prev.coords[0], prev.coords[1]], p2: [newLat, newLon], profile: 'pedestrian', small_roads: smallRoads, insertIdx: movedIdx - 1 });
    }
    if (movedIdx < stages.length - 1) {
        const next = stages[movedIdx + 1];
        if (routes[movedIdx]) dispatch({ type: 'REMOVE_ROUTE', id: routes[movedIdx].id });
        backgroundEngine.enqueue('route_leg', 0, `job-${Date.now()}-next`, { p1: [newLat, newLon], p2: [next.coords[0], next.coords[1]], profile: 'pedestrian', small_roads: smallRoads, insertIdx: movedIdx });
    }
}

function SmartDropdown({ results, onSelect, anchorRef }: { results: SearchResult[]; onSelect: (r: SearchResult) => void; anchorRef: React.RefObject<HTMLDivElement | null>; }) {
    const [dropUp, setDropUp] = useState(false);
    useEffect(() => {
        if (!anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const dropHeight = Math.min(results.length * 52, 260);
        setDropUp(window.innerHeight - rect.bottom < dropHeight && rect.top > window.innerHeight - rect.bottom);
    }, [results]);
    return (
        <div style={{
            position: 'absolute',
            ...(dropUp ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            left: 0, right: 0, background: 'var(--bg-panel)',
            border: '1px solid var(--bg-border)', borderRadius: '12px',
            zIndex: 9999, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            maxHeight: '260px', overflowY: 'auto',
            animation: 'fadeInScale 0.12s ease',
        }}>
            {results.map((r, i) => (
                <div key={i} onMouseDown={e => { e.preventDefault(); onSelect(r); }}
                    style={{ padding: '9px 14px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: i < results.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-transparent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{r.label}</span>
                    {r.postcode && <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{r.postcode}</span>}
                </div>
            ))}
        </div>
    );
}

function StageRow({ stage, idx, total, isDragged, onDragStart, onDragOver, onDrop, onDragEnd }: any) {
    const { state, dispatch } = useApp();
    const [query, setQuery] = useState(stage.address || `${stage.coords[0].toFixed(5)}, ${stage.coords[1].toFixed(5)}`);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isDraggingRow, setIsDraggingRow] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    useEffect(() => { if (!isFocused) setQuery(stage.address || `${stage.coords[0].toFixed(5)}, ${stage.coords[1].toFixed(5)}`); }, [stage.address, stage.coords, isFocused]);
    useEffect(() => {
        const handler = (e: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) { setShowResults(false); setIsFocused(false); } };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);
    useEffect(() => {
        if (!isFocused) return;
        // Don't search if it looks like raw coordinates
        if (parseCoords(query)) { setResults([]); setShowResults(false); return; }
        const t = setTimeout(async () => {
            if (query.trim().length >= 3) { const res = await searchIGN(query); setResults(res); setShowResults(res.length > 0); }
            else { setResults([]); setShowResults(false); }
        }, 320);
        return () => clearTimeout(t);
    }, [query, isFocused]);

    const handleSelect = (r: SearchResult) => {
        setQuery(r.label); setShowResults(false); setIsFocused(false);
        dispatch({ type: 'MOVE_STAGE', id: stage.id, lat: r.lat, lon: r.lon, address: r.label });
        reRouteAdjacentLegs(state.stages, state.routes, state.small_roads_only, dispatch, idx, r.lat, r.lon);
    };

    const handleCommit = () => {
        const coords = parseCoords(query);
        if (coords) {
            const label = `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`;
            setQuery(label); setShowResults(false); setIsFocused(false);
            dispatch({ type: 'MOVE_STAGE', id: stage.id, lat: coords.lat, lon: coords.lon, address: label });
            reRouteAdjacentLegs(state.stages, state.routes, state.small_roads_only, dispatch, idx, coords.lat, coords.lon);
        } else if (results.length > 0) {
            handleSelect(results[0]);
        }
    };

    const handleDelete = () => {
        dispatch({ type: 'REMOVE_STAGE', id: stage.id });
        if (idx > 0 && idx < state.stages.length - 1) {
            const prev = state.stages[idx - 1], next = state.stages[idx + 1];
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Reconnexion...' });
            backgroundEngine.enqueue('route_leg', 0, `job-bridge-${Date.now()}`, { p1: [prev.coords[0], prev.coords[1]], p2: [next.coords[0], next.coords[1]], profile: 'pedestrian', small_roads: state.small_roads_only, insertIdx: idx - 1 });
        }
    };

    const isFirst = idx === 0, isLast = idx === total - 1;
    const dotColor = isFirst ? 'var(--semantic-green)' : isLast ? 'var(--semantic-red)' : 'var(--accent-default)';

    // ── Drag handlers: only initiate drag from the grip handle ──
    const handleGripMouseDown = () => {
        // Make the row draggable when the user presses the grip
        if (rowRef.current) rowRef.current.setAttribute('draggable', 'true');
    };
    const handleRowDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(idx));
        setIsDraggingRow(true);
        onDragStart(e);
    };
    const handleRowDragEnd = (e: React.DragEvent) => {
        // Remove draggable so clicking/focusing the row normally doesn't accidentally drag
        if (rowRef.current) rowRef.current.setAttribute('draggable', 'false');
        setIsDraggingRow(false);
        onDragEnd(e);
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div
                ref={rowRef}
                draggable={false}
                onDragStart={handleRowDragStart}
                onDragOver={(e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onDragOver(e); }}
                onDrop={onDrop}
                onDragEnd={handleRowDragEnd}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px 0 8px',
                    minHeight: '40px',
                    background: isFocused ? 'var(--bg-dark)' : 'var(--bg-surface)',
                    border: `1px solid ${isFocused ? 'var(--accent-default)' : 'var(--glass-border)'}`,
                    borderRadius: '12px', transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
                    boxShadow: isFocused ? '0 0 0 3px var(--accent-transparent)' : isDraggingRow ? '0 0 0 2px var(--accent-default)' : 'none',
                    opacity: isDragged ? 0.35 : 1,
                }}>
                {/* Grip handle — this is the only drag initiator */}
                <div
                    onMouseDown={handleGripMouseDown}
                    onMouseUp={() => { if (rowRef.current) rowRef.current.setAttribute('draggable', 'false'); }}
                    title="Glisser pour réordonner"
                    style={{ cursor: 'grab', padding: '2px', marginLeft: '-2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}
                >
                    <GripVertical size={13} style={{ color: 'var(--text-dim)', opacity: isDraggingRow ? 0.9 : 0.45, transition: 'opacity 0.15s' }} />
                </div>
                <div style={{
                    width: '24px', height: '24px', borderRadius: '8px',
                    background: isFocused ? dotColor : 'var(--bg-dark)', border: `2px solid ${dotColor}`,
                    color: isFocused ? '#111' : dotColor, fontWeight: 800, fontSize: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'background 0.2s, color 0.2s',
                }}>{stage.label}</div>
                {/* Input: draggable=false prevents native text-drag from hijacking row drag */}
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => { setIsFocused(true); if (results.length > 0) setShowResults(true); }}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCommit(); } }}
                    onDragStart={e => e.preventDefault()}
                    draggable={false}
                    placeholder="Adresse, lieu ou lat, lon…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-ui)', minWidth: 0 }}
                />
                <button type="button" onClick={handleDelete} title="Supprimer"
                    style={{ width: '22px', height: '22px', borderRadius: '6px', background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.15s', flexShrink: 0 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,95,95,0.15)'; (e.currentTarget as HTMLElement).style.color = 'var(--semantic-red)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-dim)'; }}>
                    <X size={12} strokeWidth={2.5} />
                </button>
            </div>
            {showResults && results.length > 0 && <SmartDropdown results={results} onSelect={handleSelect} anchorRef={wrapperRef} />}
        </div>
    );
}

function AddStageRow() {
    const { state, dispatch } = useApp();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [showResults, setShowResults] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    // Keep a ref to current stages so the callback always sees fresh data
    const stagesRef = useRef(state.stages);
    const routesRef = useRef(state.routes);
    useEffect(() => { stagesRef.current = state.stages; }, [state.stages]);
    useEffect(() => { routesRef.current = state.routes; }, [state.routes]);

    useEffect(() => {
        const h = (e: MouseEvent) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) { setShowResults(false); setIsFocused(false); } };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    useEffect(() => {
        // Don't trigger IGN search for raw coordinate input
        if (parseCoords(query)) { setResults([]); setShowResults(false); return; }
        const t = setTimeout(async () => {
            if (query.trim().length >= 3) { const res = await searchIGN(query); setResults(res); setShowResults(res.length > 0); }
            else { setResults([]); setShowResults(false); }
        }, 320);
        return () => clearTimeout(t);
    }, [query]);

    const handleSelect = (r: SearchResult) => {
        setQuery(''); setShowResults(false); setIsFocused(false);
        // Capture anchor BEFORE dispatching ADD_STAGE (state is still pre-add here)
        const stages = stagesRef.current;
        const routes = routesRef.current;
        const anchorIdx = state.anchor_stage_idx >= 0 ? state.anchor_stage_idx : stages.length - 1;
        dispatch({ type: 'ADD_STAGE', lat: r.lat, lon: r.lon, label: '-', address: r.label });
        if (anchorIdx >= 0 && anchorIdx < stages.length) {
            const prev = stages[anchorIdx];
            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul du tronçon...' });
            backgroundEngine.enqueue('route_leg', 0, `job-add-${Date.now()}`, { p1: [prev.coords[0], prev.coords[1]], p2: [r.lat, r.lon], profile: 'pedestrian', small_roads: state.small_roads_only, insertIdx: anchorIdx });
            if (anchorIdx < stages.length - 1) {
                const next = stages[anchorIdx + 1];
                if (routes[anchorIdx]) dispatch({ type: 'REMOVE_ROUTE', id: routes[anchorIdx].id });
                backgroundEngine.enqueue('route_leg', 0, `job-add-next-${Date.now()}`, { p1: [r.lat, r.lon], p2: [next.coords[0], next.coords[1]], profile: 'pedestrian', small_roads: state.small_roads_only, insertIdx: anchorIdx + 1 });
            }
        }
        dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' });
    };

    const handleCommit = () => {
        const coords = parseCoords(query);
        if (coords) {
            handleSelect({ label: `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`, lat: coords.lat, lon: coords.lon });
        } else if (results.length > 0) {
            handleSelect(results[0]);
        }
    };

    return (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
            <div onClick={() => { if (state.active_tool !== 'route') dispatch({ type: 'SET_ACTIVE_TOOL', tool: 'route' }); }}
                style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px',
                    minHeight: '40px',
                    background: isFocused ? 'var(--bg-dark)' : 'rgba(92,189,110,0.04)',
                    border: `1.5px dashed ${isFocused ? 'var(--accent-default)' : 'rgba(92,189,110,0.25)'}`,
                    borderRadius: '12px', cursor: 'text', transition: '0.2s',
                    boxShadow: isFocused ? '0 0 0 3px var(--accent-transparent)' : 'none',
                }}>
                <Plus size={13} style={{ color: 'var(--accent-default)', flexShrink: 0, opacity: 0.8 }} />
                <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                    onFocus={() => { setIsFocused(true); if (results.length > 0) setShowResults(true); }}
                    onBlur={() => setTimeout(() => setIsFocused(false), 150)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCommit(); } }}
                    placeholder="Adresse, lieu ou lat, lon…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-ui)', minWidth: 0 }} />
            </div>
            {showResults && results.length > 0 && <SmartDropdown results={results} onSelect={handleSelect} anchorRef={wrapperRef} />}
        </div>
    );
}

// ── Drop Zone between stages ───────────────────────────────────────────────────
function DropZone({ insertAfterIdx, dist, isDirect, onDrop, onToggleDirect }: { insertAfterIdx: number; dist?: string; isDirect?: boolean; onDrop: (idx: number) => void; onToggleDirect?: () => void }) {
    const [over, setOver] = useState(false);
    return (
        <div
            onDragOver={e => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); onDrop(insertAfterIdx); }}
            style={{
                display: 'flex', alignItems: 'center',
                paddingLeft: '11px',
                height: over ? '40px' : '32px',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                borderRadius: '12px',
                background: over ? 'var(--accent-transparent)' : 'transparent',
                border: over ? '1px dashed var(--accent-default)' : 'none',
                cursor: 'default',
                margin: '2px 0'
            }}
        >
            {/* Vertical Line Connector */}
            <div style={{
                width: '2px', height: '100%',
                marginLeft: '10px',
                background: over ? 'var(--accent-default)' : 'rgba(255,255,255,0.06)',
                borderRadius: '1px',
                transition: 'background 0.2s',
            }} />

            {/* Info Badges */}
            {dist && !over && (
                <div style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px', 
                    marginLeft: '12px',
                    animation: 'fadeInScale 0.2s ease-out'
                }}>
                    {/* Distance Badge */}
                    <div style={{
                        fontSize: '9px', color: 'rgba(255,255,255,0.7)', fontWeight: 800,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '6px', padding: '3px 8px', letterSpacing: '0.02em'
                    }}>{dist}</div>

                    {/* Profile Toggle Badge */}
                    {onToggleDirect && (
                        <div 
                            onClick={(e) => { e.stopPropagation(); onToggleDirect(); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                cursor: 'pointer', padding: '3px 8px', borderRadius: '6px',
                                background: isDirect ? 'rgba(201, 149, 74, 0.15)' : 'rgba(255,255,255,0.04)',
                                border: '1px solid',
                                borderColor: isDirect ? 'rgba(201, 149, 74, 0.3)' : 'rgba(255,255,255,0.08)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = isDirect ? 'rgba(201, 149, 74, 0.5)' : 'rgba(255,255,255,0.2)';
                                e.currentTarget.style.background = isDirect ? 'rgba(201, 149, 74, 0.25)' : 'rgba(255,255,255,0.08)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = isDirect ? 'rgba(201, 149, 74, 0.3)' : 'rgba(255,255,255,0.08)';
                                e.currentTarget.style.background = isDirect ? 'rgba(201, 149, 74, 0.15)' : 'rgba(255,255,255,0.04)';
                            }}
                        >
                            <div style={{
                                width: '6px', height: '6px', borderRadius: '50%',
                                background: isDirect ? '#c9954a' : 'rgba(255,255,255,0.2)',
                                transition: 'background 0.2s'
                            }} />
                            <span style={{ 
                                fontSize: '9px', fontWeight: 700, 
                                color: isDirect ? '#c9954a' : 'rgba(255,255,255,0.4)',
                                textTransform: 'uppercase', letterSpacing: '0.03em'
                            }}>
                                Hors piste
                            </span>
                        </div>
                    )}
                </div>
            )}

            {over && (
                <span style={{ fontSize: '10px', color: 'var(--accent-default)', fontWeight: 800, marginLeft: '12px' }}>
                    Déposer ici
                </span>
            )}
        </div>
    );
}

// ── Main RoutePanel ────────────────────────────────────────────────────────────
export default function RoutePanel() {
    const { state, dispatch } = useApp();
    const stages = state.stages;
    const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
    const prevLength = useRef(stages.length);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleOpen = async () => {
        const loaded = await StateManager.loadProject();
        if (loaded) {
            dispatch({ type: 'LOAD_PROJECT', state: loaded });
            dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet chargé.', notifType: 'info' });
        }
    };

    const handleSave = async () => {
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Enregistrement...' });
        const ok = await StateManager.saveProject(state);
        dispatch({ type: 'SET_LOADING', isLoading: false });
        dispatch({ type: 'ADD_NOTIFICATION', message: ok ? 'Projet enregistré.' : 'Erreur sauvegarde.', notifType: ok ? 'info' : 'error' });
    };

    useEffect(() => {
        if (stages.length > prevLength.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        prevLength.current = stages.length;
    }, [stages.length]);

    const getStageDistance = (index: number) => {
        if (index === 0) return undefined;
        const leg = state.routes[index - 1];
        if (!leg || !leg.geojson?.geometry) return 'Calcul...';
        const coords = leg.geojson.geometry.coordinates;
        if (!coords || coords.length < 2) return '0.00 KM';
        let dist = 0; const R = 6371e3;
        for (let i = 0; i < coords.length - 1; i++) {
            const [, lat1] = coords[i], [, lat2] = coords[i + 1];
            const [lon1] = coords[i], [lon2] = coords[i + 1];
            const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
            const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
            dist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }
        return `${(dist / 1000).toFixed(2)} KM`;
    };

    // Drop on a stage: insert dragged item AT that position
    const handleDropOnStage = (targetIdx: number) => {
        if (draggedIdx === null || draggedIdx === targetIdx) { setDraggedIdx(null); return; }
        performReorder(draggedIdx, targetIdx);
    };

    // Drop on a connector: insert dragged item AFTER that connector index
    const handleDropOnConnector = (insertAfterIdx: number) => {
        if (draggedIdx === null) return;
        // insertAfterIdx is the index of the stage ABOVE the connector
        // We want dragged to be placed at insertAfterIdx+1
        let targetIdx = insertAfterIdx + 1;
        if (draggedIdx < targetIdx) targetIdx -= 1; // account for removal shift
        if (draggedIdx === targetIdx) { setDraggedIdx(null); return; }
        performReorder(draggedIdx, targetIdx);
    };

    const handleToggleProfile = (idx: number) => {
        const stageA = state.stages[idx];
        const stageB = state.stages[idx + 1];
        if (!stageA || !stageB) return;
        const currentRoute = state.routes[idx];
        if (!currentRoute) return;

        const newProfile = currentRoute.profile === 'direct' ? 'pedestrian' : 'direct';

        dispatch({ type: 'REMOVE_ROUTE', id: currentRoute.id });
        dispatch({ type: 'SET_LOADING', isLoading: true, text: newProfile === 'direct' ? 'Ligne droite...' : 'Routage (BRouter)...' });
        
        backgroundEngine.enqueue('route_leg', 0, `job-route-${Date.now()}`, {
            p1: [stageA.coords[0], stageA.coords[1]],
            p2: [stageB.coords[0], stageB.coords[1]],
            profile: newProfile,
            small_roads: state.small_roads_only,
            insertIdx: idx
        });
    };

    const performReorder = (fromIdx: number, toIdx: number) => {
        const newStages = [...stages];
        const [moved] = newStages.splice(fromIdx, 1);
        newStages.splice(toIdx, 0, moved);
        dispatch({ type: 'REORDER_STAGES', stages: newStages });
        setDraggedIdx(null);

        // 1) Clear ALL existing routes
        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recalcul global...' });
        for (const route of state.routes) {
            if (route) dispatch({ type: 'REMOVE_ROUTE', id: route.id });
        }

        // 2) Recalculate all legs fresh
        for (let i = 0; i < newStages.length - 1; i++) {
            backgroundEngine.enqueue('route_leg', 0, `job-reorder-${Date.now()}-${i}`, {
                p1: [newStages[i].coords[0], newStages[i].coords[1]],
                p2: [newStages[i + 1].coords[0], newStages[i + 1].coords[1]],
                profile: 'pedestrian', small_roads: state.small_roads_only, insertIdx: i
            });
        }
    };

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            overflow: 'hidden',
            background: 'var(--bg-panel)',
            borderRight: '1px solid var(--bg-border)'
        }}>
            {/* Steps */}
            <div ref={scrollRef} style={{ 
                flex: 1, 
                overflowY: 'auto', 
                padding: '16px', 
                scrollBehavior: 'smooth',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                background: 'rgba(0,0,0,0.15)'
            }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {stages.map((stage, idx) => (
                        <React.Fragment key={stage.id}>
                            {/* Connector / Drop zone BEFORE each stage (except first) */}
                            {idx > 0 && (
                                <DropZone
                                    insertAfterIdx={idx - 1}
                                    dist={getStageDistance(idx)}
                                    isDirect={state.routes[idx - 1]?.profile === 'direct'}
                                    onToggleDirect={() => handleToggleProfile(idx - 1)}
                                    onDrop={handleDropOnConnector}
                                />
                            )}
                            <StageRow
                                stage={stage} idx={idx} total={stages.length}
                                isDragged={draggedIdx === idx}
                                onDragStart={() => setDraggedIdx(idx)}
                                onDragOver={(e: any) => e.preventDefault()}
                                onDrop={() => handleDropOnStage(idx)}
                                onDragEnd={() => setDraggedIdx(null)}
                            />
                        </React.Fragment>
                    ))}

                    {stages.length > 0 && (
                        <DropZone insertAfterIdx={stages.length - 1} onDrop={handleDropOnConnector} />
                    )}

                    <div style={{ marginTop: stages.length > 0 ? '2px' : '0' }}>
                        <AddStageRow />
                    </div>
                </div>

                {stages.length === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                        <MapPin size={28} style={{ opacity: 0.2 }} />
                        <p style={{ fontSize: '12px', lineHeight: 1.5, margin: 0 }}>Cliquez sur la carte ou recherchez une adresse pour démarrer votre itinéraire.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

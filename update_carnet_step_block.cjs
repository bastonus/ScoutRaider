const fs = require('fs');
let code = fs.readFileSync('src/components/textual/CarnetStepBlock.tsx', 'utf8');
const isCRLF = code.includes('\r\n');
let norm = code.replace(/\r\n/g, '\n');

// 1. Update linesToRender for isVisual
const oldMapBlock = `                return encodedLines.map((line: string, idx: number) => {
                    const segIdx = step.segmentIndices?.[idx];
                    const originalSeg = segIdx !== undefined ? state.polygonal_steps[segIdx] : null;
                    const distance = step.isManual ? 0 : (originalSeg?.distance ?? 0);
                    const azimuth = step.isManual ? 0 : (originalSeg?.azimut ?? 0);`;

const newMapBlock = `                const linesToRender = isVisual ? [encodedLines[0] || ''] : encodedLines;

                return linesToRender.map((line: string, idx: number) => {
                    const segIdx = isVisual ? step.segmentIndices?.[0] : step.segmentIndices?.[idx];
                    const originalSeg = segIdx !== undefined ? state.polygonal_steps[segIdx] : null;
                    const distance = step.isManual ? 0 : (isVisual ? (step.distanceM ?? 0) : (originalSeg?.distance ?? 0));
                    const azimuth = step.isManual ? 0 : (originalSeg?.azimut ?? 0);`;

if (norm.includes(oldMapBlock)) {
    norm = norm.replace(oldMapBlock, newMapBlock);
    console.log('linesToRender logic updated');
} else {
    console.log('oldMapBlock not found');
}

// 2. Add displayMenuOpen state
const oldStateBlock = `    const [layerMenuOpen, setLayerMenuOpen] = useState(false);
    const [solutionVisible, setSolutionVisible] = useState(false);`;

const newStateBlock = `    const [layerMenuOpen, setLayerMenuOpen] = useState(false);
    const [displayMenuOpen, setDisplayMenuOpen] = useState(false);
    const [solutionVisible, setSolutionVisible] = useState(false);`;

if (norm.includes(oldStateBlock)) {
    norm = norm.replace(oldStateBlock, newStateBlock);
    console.log('displayMenuOpen state added');
} else {
    console.log('oldStateBlock not found');
}

// 3. Reset displayMenuOpen in onMouseLeave and click outside
norm = norm.replace('setLayerMenuOpen(false);', 'setLayerMenuOpen(false);\n                setDisplayMenuOpen(false);');

// 4. Add display dropdown menu in the hover toolbar for hasMap
const targetBeforeLang = `<div style={{ position: 'relative' }}>
                            <button onClick={() => { setLangPickerOpen(!langPickerOpen); setModulePickerOpen(false); setPoiPickerOpen(false); setScaleMenuOpen(false); setSizeMenuOpen(false); setLayerMenuOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: \`transparent\`, border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 }}>
                                <Globe size={12} /> Langage : {navLanguage || 'Aléatoire'} <ChevronDown size={12} />
                            </button>`;

const displayMenuHtml = `{/* Menu d'affichage des éléments IGN (Tracé, Points, Repères & Aires) */}
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
`;

if (norm.includes(targetBeforeLang)) {
    norm = norm.replace(targetBeforeLang, displayMenuHtml + targetBeforeLang);
    console.log('Display menu added to hover toolbar');
} else {
    console.log('targetBeforeLang not found');
}

const finalCode = isCRLF ? norm.replace(/\n/g, '\r\n') : norm;
fs.writeFileSync('src/components/textual/CarnetStepBlock.tsx', finalCode, 'utf8');
console.log('Finished CarnetStepBlock.tsx');

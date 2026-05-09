/**
 * TextualView.tsx — Carnet de route en mode texte.
 * Reproduit fidèlement le rendu du legacy PDF (export_html.py).
 *
 * Layout:
 *  ┌─ TOOLBAR (mode Participant | Solution + Exporter) ─────────────────────┐
 *  │  [Warning banner if errors]                                             │
 *  ├─ BODY (scroll) ─────────────────────────────────────────────────────── │
 *  │  StepSeparator [+]                                                      │
 *  │  CarnetStepBlock  (style legacy PDF)                                    │
 *  │  StepSeparator [+]                                                      │
 *  │  …                                                                      │
 *  └─────────────────────────────────────────────────────────────────────────┘
 */
import React, { useCallback, useState } from 'react';
import type { ModuleId, CarnetView, NavLanguage } from '../../logic/types';
import { useApp } from '../../AppContext';
import { CarnetEngine } from '../../logic/CarnetEngine';
import { themeManager } from '../../logic/ThemeManager';
import { ModuleLogic } from '../../logic/ModuleLogic';
import TextualHeader from './TextualHeader';
import CarnetStepBlock from './CarnetStepBlock';
import StepSeparator from './StepSeparator';
import CodeBlockPicker from './CodeBlockPicker';
import { mapRef } from '../map/MapComponent';
import L from 'leaflet';

export default function TextualView({ onExport, viewMode }: { onExport?: () => void, viewMode?: string }) {
    const { state, dispatch } = useApp();
    const steps = state.carnet_steps;
    
    const [pickingCodeFor, setPickingCodeFor] = useState<{ stepId: string, anchorSegmentIdx?: number } | null>(null);

    const handleModuleChange = useCallback((stepId: string, moduleId: ModuleId) => {
        dispatch({ type: 'MANUAL_MODULE_ASSIGNMENT', stepId, moduleId });
        dispatch({ type: 'REBUILD_CARNET' });
    }, [dispatch]);

    const handleAddHtmlStep = useCallback((afterStepId: string) => {
        dispatch({ type: 'INSERT_MANUAL_STEP_TYPED', afterStepId, content: '', manualType: 'html' });
    }, [dispatch]);

    const handleAddCodeStep = useCallback((afterStepId: string) => {
        setPickingCodeFor({ stepId: afterStepId });
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

    const handleViewChange = useCallback((view: CarnetView) => {
        dispatch({ type: 'SET_CARNET_VIEW', view });
    }, [dispatch]);

    const handleToggleGeneralMap = useCallback(() => {
        dispatch({ type: 'TOGGLE_GENERAL_MAP' });
    }, [dispatch]);

    const handleExportClick = () => {
        if (onExport) {
            onExport();
        } else {
            const html = CarnetEngine.generateExportHTML(
                steps,
                themeManager.currentTheme,
                { name: 'Carnet de Scout', date: new Date().toLocaleDateString('fr-FR') }
            );
            const blob = new Blob([html], { type: 'text/html' });
            window.open(URL.createObjectURL(blob), '_blank');
        }
    };

    const warningCount = steps.reduce((n, s) => n + (s.warnings || []).filter(w => w.severity === 'error').length, 0);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            // Match dark theme background
            background: 'var(--bg-base)',
            overflow: 'hidden',
        }}>
            {/* ── Warning banner ───────────────────────────────────────── */}
            {warningCount > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 20px',
                    background: 'rgba(239,68,68,0.08)',
                    borderBottom: '1px solid rgba(239,68,68,0.15)',
                    fontSize: '11px', color: '#ef4444', fontWeight: 600,
                }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                    {warningCount} erreur{warningCount > 1 ? 's' : ''} de contrainte — vérifiez les étapes marquées
                </div>
            )}

            {/* ── Scrollable body ──────────────────────────────────────── */}
            <div style={{
                flex: 1, overflowY: 'auto',
                padding: '24px 32px',
                display: 'flex', flexDirection: 'column',
            }}>
                {steps.length === 0 ? (
                    /* ── Empty state ─────────────────────────────────────── */
                    <div style={{
                        flex: 1, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        color: '#94a3b8', gap: '14px', paddingTop: '80px',
                    }}>
                        <div style={{ fontSize: '52px' }}>📋</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#64748b' }}>
                            Aucune étape calculée
                        </div>
                        <div style={{ fontSize: '13px', textAlign: 'center', maxWidth: '380px', lineHeight: 1.6, color: '#94a3b8' }}>
                            {state.polygonal_steps.length > 0 ? (
                                <>Le carnet se génère automatiquement. Si rien n'apparaît, cliquez ci-dessous.</>
                            ) : (
                                <>Tracez votre itinéraire dans la vue carte, puis calculez l'itinéraire.
                                Le carnet de route se mettra à jour <strong style={{ color: '#64748b' }}>automatiquement</strong>.</>
                            )}
                        </div>
                        {state.polygonal_steps.length > 0 && (
                            <button
                                onClick={() => dispatch({ type: 'REBUILD_CARNET' })}
                                style={{
                                    marginTop: '8px', padding: '8px 18px',
                                    background: 'var(--accent-default)', color: '#ffffff', border: 'none',
                                    borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Générer le carnet
                            </button>
                        )}
                    </div>
                ) : (
                    /* ── Steps list ──────────────────────────────────────── */
                    <>
                        <StepSeparator index={0} afterStepId="" onAddHtml={handleAddHtmlStep} onAddCode={handleAddCodeStep} />
                        {pickingCodeFor?.stepId === "" && <CodeBlockPicker afterStepId="" anchorSegmentIdx={pickingCodeFor.anchorSegmentIdx} onClose={() => setPickingCodeFor(null)} />}
                        
                        {steps.map((step, idx) => (
                            <React.Fragment key={step.id}>
                                <CarnetStepBlock
                                    step={step}
                                    view={state.carnet_view}
                                    onModuleChange={handleModuleChange}
                                    onManualContentChange={handleManualContentChange}
                                    onRemoveStep={handleRemoveStep}
                                    onNavLanguageChange={handleNavLanguageChange}
                                    onPoiToggle={handlePoiToggle}
                                    onLineClick={handleLineClick}
                                    onAddInlineCode={(segIdx: number) => setPickingCodeFor({ stepId: step.id, anchorSegmentIdx: segIdx })}
                                />
                                <StepSeparator index={idx + 1} afterStepId={step.id} onAddHtml={handleAddHtmlStep} onAddCode={handleAddCodeStep} />
                                {pickingCodeFor?.stepId === step.id && <CodeBlockPicker afterStepId={step.id} anchorSegmentIdx={pickingCodeFor.anchorSegmentIdx} onClose={() => setPickingCodeFor(null)} />}
                            </React.Fragment>
                        ))}
                        {/* ── Final Node (toLabel of the very last step) ── */}
                        {steps.length > 0 && !steps[steps.length - 1].isManual && steps[steps.length - 1].toLabel && (
                            <div style={{ display: 'flex', position: 'relative', height: '40px', marginTop: '-12px' }}>
                                <div style={{ width: '80px', flexShrink: 0, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <div style={{ position: 'absolute', top: 0, bottom: '50%', width: '2px', background: 'var(--bg-border)', zIndex: 1 }} />
                                    <div style={{ 
                                        marginTop: '8px', zIndex: 2,
                                        width: '24px', height: '24px', 
                                        borderRadius: '50%', background: 'var(--bg-base)', 
                                        border: `2px solid var(--semantic-green)`, 
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'var(--semantic-green)', fontWeight: 800, fontSize: '11px',
                                    }}>
                                        {steps[steps.length - 1].toLabel}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
                
                {/* ── Annexes ────────────────────────────────────────────── */}
                {steps.length > 0 && (() => {
                    const enabledAnnexes = new Set(state.enabled_annexes || []);
                    
                    const hasMorse = enabledAnnexes.has('alphabet_morse');
                    const hasPolybe = enabledAnnexes.has('grille_polybe');
                    const hasVigenere = enabledAnnexes.has('tableau_vigenere');
                    const hasMaritime = enabledAnnexes.has('index_drapeaux');
                    const hasTemplier = enabledAnnexes.has('code_templier');

                    if (!hasMorse && !hasPolybe && !hasVigenere && !hasMaritime && !hasTemplier) return null;

                    const accentColor = state.carnet_view === 'solution' ? '#ef4444' : 'var(--accent-default)';

                    return (
                        <div style={{ marginTop: '40px', paddingBottom: '40px' }}>
                            {hasMorse && (
                                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '6px', padding: '14px', marginTop: '16px' }}>
                                    <h3 style={{ fontSize: '11px', color: accentColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>TABLE MORSE</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {Object.entries(ModuleLogic.getMorseTable()).map(([char, code]) => (
                                            <div key={char} style={{ background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: '4px', padding: '4px 7px', textAlign: 'center', minWidth: '44px' }}>
                                                <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: accentColor }}>{char.toUpperCase()}</span>
                                                <span style={{ display: 'block', fontFamily: '"Morse", "Courier New", monospace', fontSize: '24px', color: 'var(--text-dim)', marginTop: '2px', letterSpacing: '2px' }}>{char.toUpperCase()}</span>
                                                <span style={{ display: 'block', fontFamily: '"Courier New", monospace', fontSize: '10px', color: 'var(--text-dim)' }}>{code}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {hasPolybe && (
                                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '6px', padding: '14px', marginTop: '16px' }}>
                                    <h3 style={{ fontSize: '11px', color: accentColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>CARRÉ DE POLYBE</h3>
                                    <table style={{ borderCollapse: 'collapse', fontSize: '10px', width: 'auto', margin: '0 auto' }}>
                                        <tbody>
                                            <tr>
                                                <th style={{ border: '1px solid var(--bg-border)', padding: '3px 5px', textAlign: 'center', background: accentColor, color: '#fff' }}></th>
                                                {[1, 2, 3, 4, 5, 6].map(i => <th key={i} style={{ border: '1px solid var(--bg-border)', padding: '3px 5px', textAlign: 'center', background: accentColor, color: '#fff' }}>{i}</th>)}
                                            </tr>
                                            {ModuleLogic.getPolybeGrid().map((row, rIdx) => (
                                                <tr key={rIdx}>
                                                    <th style={{ border: '1px solid var(--bg-border)', padding: '3px 5px', textAlign: 'center', background: accentColor, color: '#fff' }}>{rIdx + 1}</th>
                                                    {row.map((cell, cIdx) => (
                                                        <td key={cIdx} style={{ border: '1px solid var(--bg-border)', padding: '3px 5px', textAlign: 'center' }}>
                                                            <b style={{ color: 'var(--text-primary)' }}>{cell.char}</b><br/><small style={{ color: 'var(--text-dim)' }}>{cell.coord}</small>
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '6px' }}>Lecture : Ligne (1er chiffre) puis Colonne (2ème chiffre). Ex: 21=G</p>
                                </div>
                            )}

                            {hasVigenere && (() => {
                                const v = ModuleLogic.getVigenereTable(themeManager.getTheme(state.theme_id).vigenere_key || 'MOUSTACHE');
                                return (
                                    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '6px', padding: '14px', marginTop: '16px' }}>
                                        <h3 style={{ fontSize: '11px', color: accentColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                                            CARRÉ DE VIGENÈRE — Clé : <code>{v.key}</code>
                                        </h3>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ borderCollapse: 'collapse', fontSize: '10px', width: 'auto', margin: '0 auto' }}>
                                                <tbody>
                                                    <tr>
                                                        <th style={{ border: '1px solid var(--bg-border)', padding: '3px 5px', textAlign: 'center', background: accentColor, color: '#fff' }}></th>
                                                        {v.alphabet.split('').map(c => <th key={c} style={{ border: '1px solid var(--bg-border)', padding: '3px 5px', textAlign: 'center', background: accentColor, color: '#fff' }}>{c}</th>)}
                                                    </tr>
                                                    {v.table.map((row, rIdx) => (
                                                        <tr key={rIdx}>
                                                            <th style={{ border: '1px solid var(--bg-border)', padding: '3px 5px', textAlign: 'center', background: accentColor, color: '#fff' }}>{v.alphabet[rIdx]}</th>
                                                            {row.map((c, cIdx) => <td key={cIdx} style={{ border: '1px solid var(--bg-border)', padding: '2px', textAlign: 'center', minWidth: '14px', fontSize: '8px', color: 'var(--text-primary)' }}>{c}</td>)}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}

                            {hasMaritime && (
                                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '6px', padding: '14px', marginTop: '16px' }}>
                                    <h3 style={{ fontSize: '11px', color: accentColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>CODE MARITIME (NATO)</h3>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {Object.entries(ModuleLogic.getNATOAlphabet()).map(([char, word]) => (
                                            <div key={char} style={{ background: 'var(--bg-base)', border: '1px solid var(--bg-border)', borderRadius: '4px', padding: '4px 7px', textAlign: 'center', minWidth: '50px' }}>
                                                <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: accentColor }}>{char.toUpperCase()}</span>
                                                <span style={{ display: 'block', fontFamily: '"Maritime", "Courier New", monospace', fontSize: '32px', color: 'var(--text-dim)', marginTop: '4px' }}>{char.toUpperCase()}</span>
                                                <span style={{ display: 'block', fontSize: '9px', color: 'var(--text-dim)', marginTop: '4px' }}>{word}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {hasTemplier && (
                                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--bg-border)', borderRadius: '6px', padding: '14px', marginTop: '16px' }}>
                                    <h3 style={{ fontSize: '11px', color: accentColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>CODE TEMPLIER</h3>
                                    <div style={{ textAlign: 'center' }}>
                                        <img src="/assets/images/code_templier.jpg" alt="Code Templier" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '4px', border: '1px solid var(--bg-border)', objectFit: 'contain' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

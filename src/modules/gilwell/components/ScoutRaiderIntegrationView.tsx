/**
 * Gilwell Module — ScoutRaider Integration View
 * Bidirectional sync between Gilwell steps and ScoutRaider PolySegments.
 * Uses app-provided Tailwind classes only — no internal CSS.
 */

import React, { useState, useMemo } from 'react';
import type {
  GilwellStep,
  GilwellConfig,
  ScoutRaiderPolySegment,
} from '../logic/types';
import {
  stepsToPolySegments,
  polySegmentsToSteps,
  formatStepText,
} from '../logic/GilwellEngine';

interface ScoutRaiderIntegrationViewProps {
  steps: GilwellStep[];
  config: GilwellConfig;
}

interface SyncReport {
  added: number;
  updated: number;
  removed: number;
  matched: number;
}

export default function ScoutRaiderIntegrationView({
  steps,
  config,
}: ScoutRaiderIntegrationViewProps) {
  const [polySegments, setPolySegments] = useState<ScoutRaiderPolySegment[]>([]);
  const [syncDirection, setSyncDirection] = useState<'gilwell-to-sr' | 'sr-to-gilwell'>('gilwell-to-sr');
  const [lastSyncReport, setLastSyncReport] = useState<SyncReport | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Convert Gilwell steps to PolySegments
  const derivedSegments = useMemo(() => stepsToPolySegments(steps), [steps]);

  // Convert PolySegments back to Gilwell steps
  const derivedSteps = useMemo(() => polySegmentsToSteps(polySegments), [polySegments]);

  const handleGilwellToScoutRaider = () => {
    const segments = stepsToPolySegments(steps);
    setPolySegments(segments);
    setSyncDirection('gilwell-to-sr');
    setLastSyncReport({ added: segments.length, updated: 0, removed: 0, matched: 0 });
  };

  const handleScoutRaiderToGilwell = () => {
    const newSteps = polySegmentsToSteps(polySegments);
    setSyncDirection('sr-to-gilwell');
    setLastSyncReport({
      added: Math.max(0, newSteps.length - steps.length),
      updated: Math.min(newSteps.length, steps.length),
      removed: Math.max(0, steps.length - newSteps.length),
      matched: Math.min(newSteps.length, steps.length),
    });
    // Note: Actual step updates must be handled by parent via onImportSteps
    // This view just shows the conversion result
  };

  const handleLoadFromScoutRaider = () => {
    // This would be called by parent to load actual ScoutRaider data
    // For now, just use derived segments
    setPolySegments(derivedSegments);
  };

  const exportSegmentsJson = () => {
    const data = JSON.stringify(polySegments, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scoutraider-segments-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSegmentsJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        if (Array.isArray(parsed)) {
          setPolySegments(parsed);
        }
      } catch {
        alert('JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatCoord = (coord?: [number, number]) =>
    coord ? `${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}` : '—';

  const formatProps = (seg: ScoutRaiderPolySegment) => {
    if (!seg.properties) return '—';
    const p = seg.properties;
    return `az:${p.azimut} m:${p.metrage} ${p.coords_intersection ? `int:${p.coords_intersection[0].toFixed(4)},${p.coords_intersection[1].toFixed(4)}` : ''}`;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Direction:</span>
          <select
            value={syncDirection}
            onChange={(e) => setSyncDirection(e.target.value as any)}
            className="px-2 py-1 text-sm border border-slate-300 rounded bg-white"
          >
            <option value="gilwell-to-sr">Gilwell → ScoutRaider</option>
            <option value="sr-to-gilwell">ScoutRaider → Gilwell</option>
          </select>
        </div>

        <button
          onClick={syncDirection === 'gilwell-to-sr' ? handleGilwellToScoutRaider : handleScoutRaiderToGilwell}
          className="px-3 py-1.5 text-sm border border-emerald-500 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Synchroniser
        </button>

        <button onClick={handleLoadFromScoutRaider} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Charger depuis ScoutRaider
        </button>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <button onClick={exportSegmentsJson} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export JSON
        </button>

        <label className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Import JSON
          <input type="file" accept=".json" onChange={importSegmentsJson} className="hidden" />
        </label>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <label className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer flex items-center gap-1">
          <input type="checkbox" checked={showRawJson} onChange={(e) => setShowRawJson(e.target.checked)} className="w-4 h-4 text-emerald-500 border-slate-300 rounded" />
          JSON brut
        </label>
      </div>

      {/* Sync Report */}
      {lastSyncReport && (
        <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100 text-sm text-emerald-800 flex items-center gap-4">
          <span>✓ Sync terminé</span>
          <span>Ajoutés: <strong>{lastSyncReport.added}</strong></span>
          <span>Mis à jour: <strong>{lastSyncReport.updated}</strong></span>
          <span>Supprimés: <strong>{lastSyncReport.removed}</strong></span>
          <span>Correspondants: <strong>{lastSyncReport.matched}</strong></span>
          <button onClick={() => setLastSyncReport(null)} className="ml-auto text-emerald-600 hover:underline text-xs">Masquer</button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {syncDirection === 'gilwell-to-sr' ? (
          // Show derived PolySegments from Gilwell steps
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              Segments ScoutRaider générés ({derivedSegments.length})
            </h3>

            {showRawJson ? (
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto font-mono max-h-96">
                {JSON.stringify(derivedSegments, null, 2)}
              </pre>
            ) : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {derivedSegments.map((seg: ScoutRaiderPolySegment, i: number) => (
                  <div key={seg.leg_key || i} className="border border-slate-200 rounded-lg p-3 bg-white hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center text-xs font-mono text-slate-500">{i + 1}</span>
                        <span className="font-mono text-sm text-slate-900">{seg.azimut}°</span>
                        <span className="text-slate-500 text-sm">—</span>
                        <span className="font-mono text-sm text-slate-900">{seg.distance}m</span>
                        {seg.assigned_module && (
                          <span className="px-1.5 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">{seg.assigned_module}</span>
                        )}
                      </div>
                      {seg.poi && (
                        <span className="px-2 py-0.5 text-xs bg-amber-50 text-amber-700 rounded flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                          {seg.poi.name} ({seg.poi.distance_m}m)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>
                        <span className="font-medium">Coords:</span> {formatCoord(seg.coords?.[seg.coords.length - 1])}
                      </div>
                      <div>
                        <span className="font-medium">Propriétés:</span> {formatProps(seg)}
                      </div>
                    </div>

                    {seg.coords && seg.coords.length > 1 && (
                      <details className="mt-2">
                        <summary className="text-xs text-slate-500 cursor-pointer">Tous les points ({seg.coords.length})</summary>
                        <div className="mt-1 font-mono text-xs text-slate-500 bg-slate-50 p-2 rounded max-h-32 overflow-auto">
                          {seg.coords.map((c: any, ci: number) => (
                            <div key={ci}>{ci}: {c[0]?.toFixed?.(6)}, {c[1]?.toFixed?.(6)}</div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                ))}

                {derivedSegments.length === 0 && (
                  <div className="text-center text-slate-400 py-8 text-sm">
                    Aucune étape Gilwell à convertir
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          // Show derived Gilwell steps from PolySegments
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Étapes Gilwell reconstruites ({derivedSteps.length})
            </h3>

            {showRawJson ? (
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto font-mono max-h-96">
                {JSON.stringify(derivedSteps, null, 2)}
              </pre>
            ) : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {derivedSteps.map((step: GilwellStep, i: number) => (
                  <div key={step.id} className="border border-slate-200 rounded-lg p-3 bg-white hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center text-xs font-mono text-slate-500">{i + 1}</span>
                        <span className="font-mono text-sm text-slate-900">{step.azimut}°</span>
                        <span className="text-slate-500 text-sm">—</span>
                        <span className="font-mono text-sm text-slate-900">{step.distance}m</span>
                      </div>
                      {step.customColor && (
                        <span className="w-3 h-3 rounded-full" style={{ background: step.customColor }} title="Couleur importée" />
                      )}
                    </div>

                    <div className="text-sm text-slate-600 font-mono">
                      {step.customText || formatStepText(step, config.stepTextTemplate)}
                    </div>

                    {step.customNumber && (
                      <div className="mt-1 text-xs text-slate-500">N°: {step.customNumber}</div>
                    )}
                  </div>
                ))}

                {derivedSteps.length === 0 && (
                  <div className="text-center text-slate-400 py-8 text-sm">
                    Aucun segment ScoutRaider à convertir
                  </div>
                )}
              </div>
            )}

            {/* Action hint */}
            <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-sm text-slate-600">
                Pour appliquer ces étapes à l'éditeur Gilwell, utilisez le bouton "Importer" dans la
                barre latérale (StepSidebar) avec le JSON exporté ci-dessus, ou implémentez un callback
                <code className="bg-slate-100 px-1 rounded text-xs font-mono">onImportSteps</code> dans le composant parent.
              </p>
            </div>
          </div>
        )}

        {/* Raw PolySegments editor (when manually loaded) */}
        {polySegments.length > 0 && syncDirection === 'sr-to-gilwell' && polySegments !== derivedSegments && (
          <details className="mt-6">
            <summary className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
              Segments ScoutRaider chargés manuellement ({polySegments.length})
            </summary>
            <div className="mt-2 max-h-64 overflow-auto">
              {showRawJson ? (
                <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs overflow-auto font-mono">
                  {JSON.stringify(polySegments, null, 2)}
                </pre>
              ) : (
                <div className="space-y-1">
                  {polySegments.map((seg, i) => (
                    <div key={seg.leg_key || i} className="border border-slate-200 rounded p-2 bg-white text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-center font-mono text-slate-500">{i + 1}</span>
                        <span className="font-mono text-slate-900">{seg.azimut}° — {seg.distance}m</span>
                        {seg.assigned_module && <span className="px-1 py-0.5 text-xs bg-slate-100 rounded">{seg.assigned_module}</span>}
                      </div>
                      <div className="font-mono text-slate-500 ml-8">{formatCoord(seg.coords?.[seg.coords.length - 1])}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
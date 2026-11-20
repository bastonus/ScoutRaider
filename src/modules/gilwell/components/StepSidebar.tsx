/**
 * Gilwell Module — Step Sidebar Panel
 * List view with drag-to-reorder, inline editing, import/export.
 * Uses app-provided Tailwind classes only — no internal CSS.
 */

import React, { useState, useRef, useEffect } from 'react';
import type {
  GilwellStep,
  GilwellConfig,
} from '../logic/types';
import {
  formatStepText,
  NUMBERING_FORMATS,
  NUMBERING_POSITIONS,
  NUMBERING_BADGE_SHAPES,
} from '../logic/GilwellEngine';

interface StepSidebarProps {
  steps: GilwellStep[];
  config: GilwellConfig;
  resolvedTypography?: {
    conventionPt: number;
    base: number;
    title: number;
    start: number;
    num: number;
    flow: number;
    wrap: number;
  };
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  onUpdateStep: (id: string, patch: Partial<GilwellStep>) => void;
  onAddStep: () => void;
  onDeleteStep: (id: string) => void;
  onMoveStep: (id: string, dir: -1 | 1) => void;
  onImportSteps: (steps: GilwellStep[]) => void;
  onResetAll: () => void;
  onUpdateConfig: (patch: Partial<GilwellConfig>) => void;
}

const COLORS = [
  '#2d5a8e', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
];

export default function StepSidebar({
  steps,
  config,
  resolvedTypography,
  selectedStepId,
  onSelectStep,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
  onMoveStep,
  onImportSteps,
  onResetAll,
  onUpdateConfig,
}: StepSidebarProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'auto' | 'json' | 'csv' | 'scoutraider'>('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    if (!importText.trim()) return;
    let parsed: GilwellStep[] = [];

    try {
      if (importFormat === 'json' || (importFormat === 'auto' && importText.trim().startsWith('['))) {
        parsed = JSON.parse(importText);
      } else if (importFormat === 'csv' || (importFormat === 'auto' && importText.includes(','))) {
        const lines = importText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const azIdx = headers.findIndex(h => h.includes('azimut') || h === 'az');
        const distIdx = headers.findIndex(h => h.includes('distance') || h === 'dist' || h === 'metrage');
        const textIdx = headers.findIndex(h => h.includes('text') || h.includes('libell') || h === 'label');

        parsed = lines.slice(1).map((line, i) => {
          const cols = line.split(',').map(c => c.trim());
          return {
            id: `import-${Date.now()}-${i}`,
            azimut: parseFloat(cols[azIdx]) || 0,
            distance: parseFloat(cols[distIdx]) || 0,
            customText: cols[textIdx] || undefined,
          };
        });
      } else {
        // ScoutRaider format: "azimut distance [text]" per line
        parsed = importText.trim().split('\n').map((line, i) => {
          const parts = line.trim().split(/\s+/);
          const azimut = parseFloat(parts[0]) || 0;
          const distance = parseFloat(parts[1]) || 0;
          const customText = parts.slice(2).join(' ') || undefined;
          return { id: `import-${Date.now()}-${i}`, azimut, distance, customText };
        });
      }

      // Validate
      parsed = parsed.filter(s => s.azimut >= 0 && s.azimut < 360 && s.distance > 0);
      if (parsed.length) onImportSteps(parsed);
      setImportText('');
    } catch {
      alert('Format invalide. Utilisez JSON, CSV (azimut,distance,texte) ou format ScoutRaider (une ligne par étape: azimut distance texte).');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setImportText(evt.target?.result as string);
      setImportFormat(file.name.endsWith('.json') ? 'json' : file.name.endsWith('.csv') ? 'csv' : 'scoutraider');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportSteps = () => {
    const data = JSON.stringify(steps, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gilwell-steps-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getDisplayNumber = (index: number) => {
    const fmt = config.numbering.format;
    const start = config.numbering.startAt;
    const n = start + index;
    switch (fmt) {
      case 'alpha-upper': return String.fromCharCode(65 + ((n - 1) % 26));
      case 'alpha-lower': return String.fromCharCode(97 + ((n - 1) % 26));
      case 'roman': return toRoman(n);
      default: return String(n);
    }
  };

  const toRoman = (num: number): string => {
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let res = '';
    for (let i = 0; i < vals.length; i++) {
      while (num >= vals[i]) { res += syms[i]; num -= vals[i]; }
    }
    return res;
  };

  const autoText = (step: GilwellStep) => formatStepText(step, config.stepTextTemplate);

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200">
      {/* Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-2">
        <button onClick={onAddStep} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter
        </button>
        <button onClick={exportSteps} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export
        </button>
        <button onClick={onResetAll} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 text-slate-600 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7"/></svg>
          Reset
        </button>
      </div>

      {/* Import Panel (collapsible) */}
      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <details className="w-full">
          <summary className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importer des étapes
          </summary>
          <div className="mt-2 space-y-2">
            <select value={importFormat} onChange={(e) => setImportFormat(e.target.value as any)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white">
              <option value="auto">Auto-détection</option>
              <option value="json">JSON</option>
              <option value="csv">CSV (azimut,distance,texte)</option>
              <option value="scoutraider">ScoutRaider (azimut distance texte)</option>
            </select>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white font-mono text-xs"
              rows={4}
              placeholder={importFormat === 'json'
                ? '[{"id":"1","azimut":45,"distance":100},...]'
                : importFormat === 'csv'
                  ? 'azimut,distance,texte\n45,100,Premier\n90,50,Second'
                  : '45 100 Premier azimut\n90 50 Second azimut'}
            />
            <input type="file" ref={fileInputRef} accept=".json,.csv,.txt" onChange={handleFileImport} className="hidden" id="gilwell-import-file" />
            <div className="flex gap-2">
              <label htmlFor="gilwell-import-file" className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer flex-1 text-center">Fichier</label>
              <button onClick={handleImport} className="px-3 py-1.5 text-sm border border-emerald-500 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex-1">Importer</button>
            </div>
          </div>
        </details>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-2">
        {steps.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm p-4">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-50"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            Aucune étape
            <p className="text-xs mt-1">Cliquez sur "Ajouter" ou importez</p>
          </div>
        ) : (
          <ul className="space-y-1" role="listbox">
            {steps.map((step, index) => {
              const isSelected = selectedStepId === step.id;
              const isExpanded = expandedId === step.id;
              const displayNum = getDisplayNumber(index);
              const text = step.customText || autoText(step);

              return (
                <li
                  key={step.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => { onSelectStep(step.id); setExpandedId(isExpanded ? null : step.id); }}
                  className={`relative flex flex-col rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 border border-emerald-200 ring-1 ring-emerald-300'
                      : 'bg-white border border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {/* Drag handle & main row */}
                  <div className="flex items-start gap-2 p-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveStep(step.id, -1); }}
                      disabled={index === 0}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 mt-0.5"
                      aria-label="Monter"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"/></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onMoveStep(step.id, 1); }}
                      disabled={index === steps.length - 1}
                      className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 mt-0.5"
                      aria-label="Descendre"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-8 text-center text-sm font-mono font-medium text-slate-600 tabular-nums">{displayNum}</span>
                        <span className="flex-1 text-sm font-medium text-slate-900 truncate">{text}</span>
                        {step.customColor && (
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: step.customColor }} title="Couleur personnalisée" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v6M12 16v6"/></svg>
                          {step.azimut}°
                        </span>
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                          {step.distance}m
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteStep(step.id); }}
                      className="p-1 text-slate-400 hover:text-red-500 flex-shrink-0"
                      aria-label="Supprimer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-600">Azimut</label>
                        <input
                          type="number"
                          min="0"
                          max="359"
                          value={step.azimut}
                          onChange={(e) => onUpdateStep(step.id, { azimut: parseInt(e.target.value) || 0 })}
                          className="px-2 py-1 text-sm border border-slate-300 rounded bg-white"
                        />
                        <label className="text-xs text-slate-600">Distance (m)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={step.distance}
                          onChange={(e) => onUpdateStep(step.id, { distance: parseFloat(e.target.value) || 0 })}
                          className="px-2 py-1 text-sm border border-slate-300 rounded bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-600 block mb-1">Texte personnalisé</label>
                        <textarea
                          value={step.customText || ''}
                          onChange={(e) => onUpdateStep(step.id, { customText: e.target.value || undefined })}
                          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white font-mono text-xs"
                          rows={2}
                          placeholder={autoText(step)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-600">N° personnalisé</label>
                        <input
                          type="text"
                          value={step.customNumber || ''}
                          onChange={(e) => onUpdateStep(step.id, { customNumber: e.target.value || undefined })}
                          className="px-2 py-1 text-sm border border-slate-300 rounded bg-white"
                          placeholder="Auto"
                        />
                        <label className="text-xs text-slate-600">Couleur flèche</label>
                        <input
                          type="color"
                          value={step.customColor || config.colors.arrowFill}
                          onChange={(e) => onUpdateStep(step.id, { customColor: e.target.value })}
                          className="w-full h-8 p-0 border-0 cursor-pointer"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-slate-600">Couleur texte</label>
                        <input
                          type="color"
                          value={step.customTextColor || config.colors.textMain}
                          onChange={(e) => onUpdateStep(step.id, { customTextColor: e.target.value })}
                          className="w-full h-8 p-0 border-0 cursor-pointer"
                        />
                      </div>

                      <div className="flex gap-2 pt-2 border-t border-slate-200">
                        <button onClick={() => onAddStep()} className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50">Ajouter</button>
                        <button onClick={() => onDeleteStep(step.id)} className="flex-1 px-2 py-1.5 text-xs border border-red-300 rounded bg-red-50 text-red-700 hover:bg-red-100">Supprimer</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Quick numbering config at bottom */}
        <details className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <summary className="text-sm font-medium text-slate-700 cursor-pointer">Numérotation globale</summary>
          <div className="mt-2 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-600">Format</label>
              <select value={config.numbering.format} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, format: e.target.value as any } })} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white">
                {NUMBERING_FORMATS.map((f: string) => <option key={f} value={f}>{f}</option>)}
              </select>
              <label className="text-xs text-slate-600">Position</label>
              <select value={config.numbering.position} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, position: e.target.value as any } })} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white">
                {NUMBERING_POSITIONS.map((p: string) => <option key={p} value={p}>{p}</option>)}
              </select>
              <label className="text-xs text-slate-600">Badge</label>
              <select value={config.numbering.badgeShape} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, badgeShape: e.target.value as any } })} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white">
                {NUMBERING_BADGE_SHAPES.map((b: string) => <option key={b} value={b}>{b}</option>)}
              </select>
              <label className="text-xs text-slate-600">Départ</label>
              <input type="number" min="1" max="100" value={config.numbering.startAt} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, startAt: parseInt(e.target.value) } })} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white" />
              <label className="text-xs text-slate-600">Taille police</label>
              <input type="number" min="4" max="24" value={config.numbering.fontSize} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, fontSize: parseInt(e.target.value) } })} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white" />
              <label className="text-xs text-slate-600">Décalage (cm)</label>
              <input type="number" min="-2" max="5" step="0.1" value={config.numbering.offsetCm} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, offsetCm: parseFloat(e.target.value) } })} className="px-2 py-1 text-sm border border-slate-300 rounded bg-white" />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.numbering.enabled} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, enabled: e.target.checked } })} className="w-4 h-4 text-emerald-500 border-slate-300 rounded" />
              <span className="text-slate-700">Activée</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.numbering.badgeFilled} onChange={(e) => onUpdateConfig({ numbering: { ...config.numbering, badgeFilled: e.target.checked } })} className="w-4 h-4 text-emerald-500 border-slate-300 rounded" />
              <span className="text-slate-700">Badge rempli</span>
            </label>
          </div>
        </details>
      </div>
    </div>
  );
}
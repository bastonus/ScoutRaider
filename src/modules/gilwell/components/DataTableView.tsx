/**
 * Gilwell Module — Data Table View
 * Spreadsheet-like editor for steps with inline editing, copy/paste, import/export.
 * Uses app-provided Tailwind classes only — no internal CSS.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type {
  GilwellStep,
  GilwellConfig,
} from '../logic/types';
import { formatStepText } from '../logic/GilwellEngine';

interface DataTableViewProps {
  steps: GilwellStep[];
  config: GilwellConfig;
  onUpdateStep: (id: string, patch: Partial<GilwellStep>) => void;
  onAddStep: () => void;
  onDeleteStep: (id: string) => void;
}

const COLORS = [
  '#2d5a8e', '#e74c3c', '#27ae60', '#f39c12', '#8e44ad',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
];

interface CellEdit {
  stepId: string;
  field: keyof GilwellStep;
  value: string;
}

export default function DataTableView({
  steps,
  config,
  onUpdateStep,
  onAddStep,
  onDeleteStep,
}: DataTableViewProps) {
  const [editingCell, setEditingCell] = useState<CellEdit | null>(null);
  const [clipboard, setClipboard] = useState<string>('');
  const [importText, setImportText] = useState('');
  const [importFormat, setImportFormat] = useState<'json' | 'csv' | 'scoutraider'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && editingCell) {
      setEditingCell(null);
    }
    if (e.key === 'Enter' && editingCell) {
      setEditingCell(null);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      copySelection();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      e.preventDefault();
      pasteFromClipboard();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      // Select all handled by browser
    }
  }, [editingCell, steps]);

  const copySelection = () => {
    const lines = steps.map(s =>
      [s.azimut, s.distance, s.customText || ''].join('\t')
    );
    const text = lines.join('\n');
    navigator.clipboard.writeText(text);
    setClipboard(text);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.trim().split('\n').filter(l => l.trim());
      const parsed = lines.map(line => {
        const parts = line.split('\t');
        return {
          azimut: parseFloat(parts[0]) || 0,
          distance: parseFloat(parts[1]) || 0,
          customText: parts[2] || undefined,
        };
      }).filter(s => s.azimut >= 0 && s.azimut < 360 && s.distance > 0);

      if (parsed.length) {
        // Update existing or add new
        parsed.forEach((p, i) => {
          if (steps[i]) {
            onUpdateStep(steps[i].id, p);
          } else {
            onAddStep();
            // Note: Would need to track new step IDs for bulk update
          }
        });
      }
    } catch {
      // Clipboard API not available or denied
    }
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    let parsed: Partial<GilwellStep>[] = [];

    try {
      if (importFormat === 'json') {
        parsed = JSON.parse(importText);
      } else if (importFormat === 'csv') {
        const lines = importText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const azIdx = headers.findIndex(h => h.includes('azimut') || h === 'az');
        const distIdx = headers.findIndex(h => h.includes('distance') || h === 'dist' || h === 'metrage');
        const textIdx = headers.findIndex(h => h.includes('text') || h.includes('libell') || h === 'label');
        const colorIdx = headers.findIndex(h => h.includes('color') || h === 'couleur');
        const numIdx = headers.findIndex(h => h.includes('number') || h === 'numero');

        parsed = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim());
          return {
            azimut: parseFloat(cols[azIdx]) || 0,
            distance: parseFloat(cols[distIdx]) || 0,
            customText: cols[textIdx] || undefined,
            customColor: cols[colorIdx] || undefined,
            customNumber: cols[numIdx] || undefined,
          };
        });
      } else {
        parsed = importText.trim().split('\n').map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            azimut: parseFloat(parts[0]) || 0,
            distance: parseFloat(parts[1]) || 0,
            customText: parts.slice(2).join(' ') || undefined,
          };
        });
      }

      parsed = parsed.filter(s => s.azimut! >= 0 && s.azimut! < 360 && s.distance! > 0);
      if (parsed.length) {
        parsed.forEach((p, i) => {
          if (steps[i]) onUpdateStep(steps[i].id, p);
        });
        setImportText('');
      }
    } catch {
      alert('Format invalide.');
    }
  };

  const exportCSV = () => {
    const headers = 'azimut,distance,customText,customColor,customNumber\n';
    const rows = steps.map(s =>
      [s.azimut, s.distance, s.customText || '', s.customColor || '', s.customNumber || ''].join(',')
    );
    const csv = headers + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gilwell-steps-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const data = JSON.stringify(steps, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gilwell-steps-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEdit = (stepId: string, field: keyof GilwellStep, initialValue: string) => {
    setEditingCell({ stepId, field, value: initialValue });
    // Focus next tick
    setTimeout(() => {
      const input = document.querySelector(`[data-edit-field="${field}"][data-step-id="${stepId}"]`) as HTMLInputElement;
      input?.focus();
      input?.select();
    }, 0);
  };

  const commitEdit = (cell: CellEdit) => {
    const step = steps.find(s => s.id === cell.stepId);
    if (!step) return;

    let value: string | number | undefined = cell.value;
    if (cell.field === 'azimut' || cell.field === 'distance') {
      const num = parseFloat(cell.value);
      if (isNaN(num)) return;
      if (cell.field === 'azimut' && (num < 0 || num >= 360)) return;
      if (cell.field === 'distance' && num < 0) return;
      value = num;
    } else if (cell.field === 'customText' || cell.field === 'customColor' || cell.field === 'customNumber') {
      value = cell.value.trim() || undefined;
    }

    onUpdateStep(cell.stepId, { [cell.field]: value } as Partial<GilwellStep>);
    setEditingCell(null);
  };

  const autoText = (step: GilwellStep) => formatStepText(step, config.stepTextTemplate);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center gap-2">
        <button onClick={onAddStep} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter ligne
        </button>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <button onClick={exportCSV} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export CSV
        </button>
        <button onClick={exportJSON} className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 flex items-center gap-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Export JSON
        </button>
        <div className="w-px h-6 bg-slate-300 mx-1" />
        <details className="relative">
          <summary className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importer
          </summary>
          <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-10">
            <select value={importFormat} onChange={(e) => setImportFormat(e.target.value as any)} className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white mb-2">
              <option value="csv">CSV (azimut,distance,texte,couleur,numero)</option>
              <option value="json">JSON</option>
              <option value="scoutraider">ScoutRaider (azimut distance texte)</option>
            </select>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white font-mono text-xs"
              rows={4}
              placeholder={importFormat === 'csv'
                ? 'azimut,distance,texte,couleur,numero\n45,100,Premier,#2d5a8e,\n90,50,Second,,'
                : importFormat === 'json'
                  ? '[{"azimut":45,"distance":100,"customText":"Premier"}]'
                  : '45 100 Premier\n90 50 Second'}
            />
            <input type="file" ref={fileInputRef} accept=".csv,.json,.txt" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (evt) => { setImportText(evt.target?.result as string); setImportFormat(file.name.endsWith('.json') ? 'json' : 'csv'); };
              reader.readAsText(file);
            }} className="hidden" id="gilwell-dt-import-file" />
            <div className="flex gap-2 mt-2">
              <label htmlFor="gilwell-dt-import-file" className="px-3 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50 cursor-pointer flex-1 text-center">Fichier</label>
              <button onClick={handleImport} className="px-3 py-1.5 text-sm border border-emerald-500 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex-1">Importer</button>
            </div>
          </div>
        </details>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" onKeyDown={handleKeyDown} tabIndex={0}>
        <table ref={tableRef} className="w-full border-collapse text-sm font-mono" role="grid">
          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="w-8 px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">#</th>
              <th className="w-20 px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">Azimut</th>
              <th className="w-24 px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">Distance (m)</th>
              <th className="w-10 px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">Couleur</th>
              <th className="w-20 px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">N° perso</th>
              <th className="flex-1 min-w-60 px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">Texte</th>
              <th className="w-10 px-2 py-1.5 text-left text-xs font-medium text-slate-500 uppercase tracking-wider" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step, index) => {
              const displayNum = config.numbering.enabled
                ? (() => {
                    const fmt = config.numbering.format;
                    const start = config.numbering.startAt;
                    const n = start + index;
                    switch (fmt) {
                      case 'alpha-upper': return String.fromCharCode(65 + ((n - 1) % 26));
                      case 'alpha-lower': return String.fromCharCode(97 + ((n - 1) % 26));
                      case 'roman': {
                        const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
                        const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
                        let res = '', num = n;
                        for (let i = 0; i < vals.length; i++) { while (num >= vals[i]) { res += syms[i]; num -= vals[i]; } }
                        return res;
                      }
                      default: return String(n);
                    }
                  })()
                : String(index + 1);

              const isEditing = editingCell?.stepId === step.id;
              const arrowColor = step.customColor || config.colors.arrowFill;
              const text = step.customText || autoText(step);

              return (
                <tr key={step.id} className={`border-b border-slate-100 hover:bg-slate-50 ${isEditing ? 'bg-emerald-50' : ''}`}>
                  <td className="px-2 py-1.5 text-slate-500 tabular-nums whitespace-nowrap">{displayNum}</td>

                  <td className="px-2 py-1.5">
                    {isEditing && editingCell.field === 'azimut' ? (
                      <input
                        data-edit-field="azimut"
                        data-step-id={step.id}
                        type="number"
                        min="0"
                        max="359"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => commitEdit(editingCell)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(editingCell); if (e.key === 'Escape') setEditingCell(null); }}
                        className="w-full px-1.5 py-1 text-sm border border-emerald-500 rounded bg-white outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(step.id, 'azimut', String(step.azimut))}
                        className="w-full px-1.5 py-1 text-left text-slate-900 hover:bg-slate-100 rounded tabular-nums"
                      >
                        {step.azimut}°
                      </button>
                    )}
                  </td>

                  <td className="px-2 py-1.5">
                    {isEditing && editingCell.field === 'distance' ? (
                      <input
                        data-edit-field="distance"
                        data-step-id={step.id}
                        type="number"
                        min="0"
                        step="0.1"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => commitEdit(editingCell)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(editingCell); if (e.key === 'Escape') setEditingCell(null); }}
                        className="w-full px-1.5 py-1 text-sm border border-emerald-500 rounded bg-white outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(step.id, 'distance', String(step.distance))}
                        className="w-full px-1.5 py-1 text-left text-slate-900 hover:bg-slate-100 rounded tabular-nums"
                      >
                        {step.distance}
                      </button>
                    )}
                  </td>

                  <td className="px-2 py-1.5">
                    {isEditing && editingCell.field === 'customColor' ? (
                      <input
                        data-edit-field="customColor"
                        data-step-id={step.id}
                        type="color"
                        value={editingCell.value || arrowColor}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => commitEdit(editingCell)}
                        className="w-full h-8 p-0 border-0 cursor-pointer"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(step.id, 'customColor', step.customColor || arrowColor)}
                        className="w-8 h-8 rounded border border-slate-200 cursor-pointer hover:scale-105 transition-transform"
                        style={{ background: step.customColor || arrowColor }}
                        title={step.customColor ? 'Personnalisée' : 'Défaut'}
                      />
                    )}
                  </td>

                  <td className="px-2 py-1.5">
                    {isEditing && editingCell.field === 'customNumber' ? (
                      <input
                        data-edit-field="customNumber"
                        data-step-id={step.id}
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => commitEdit(editingCell)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(editingCell); if (e.key === 'Escape') setEditingCell(null); }}
                        className="w-full px-1.5 py-1 text-sm border border-emerald-500 rounded bg-white outline-none"
                        autoFocus
                        placeholder="Auto"
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(step.id, 'customNumber', step.customNumber || '')}
                        className="w-full px-1.5 py-1 text-left text-slate-900 hover:bg-slate-100 rounded truncate"
                      >
                        {step.customNumber || <span className="text-slate-400">Auto</span>}
                      </button>
                    )}
                  </td>

                  <td className="px-2 py-1.5 min-w-0">
                    {isEditing && editingCell.field === 'customText' ? (
                      <input
                        data-edit-field="customText"
                        data-step-id={step.id}
                        type="text"
                        value={editingCell.value}
                        onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                        onBlur={() => commitEdit(editingCell)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(editingCell); if (e.key === 'Escape') setEditingCell(null); }}
                        className="w-full px-1.5 py-1 text-sm border border-emerald-500 rounded bg-white outline-none"
                        autoFocus
                        placeholder={autoText(step)}
                      />
                    ) : (
                      <button
                        onClick={() => startEdit(step.id, 'customText', step.customText || '')}
                        className="w-full px-1.5 py-1 text-left text-slate-900 hover:bg-slate-100 rounded truncate"
                      >
                        {step.customText || <span className="text-slate-400 italic">{autoText(step)}</span>}
                      </button>
                    )}
                  </td>

                  <td className="px-2 py-1.5">
                    <button
                      onClick={() => onDeleteStep(step.id)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded"
                      aria-label="Supprimer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </td>
                </tr>
              );
            })}

            {steps.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">
                  Aucune étape. Cliquez sur "Ajouter ligne" ou importez des données.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm text-slate-600">
        <span>{steps.length} étape{steps.length > 1 ? 's' : ''}</span>
        <span className="font-mono tabular-nums">
          Total: {steps.reduce((sum, s) => sum + s.distance, 0).toFixed(1)} m
        </span>
      </div>
    </div>
  );
}
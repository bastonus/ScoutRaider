/**
 * Gilwell Module — Export Modal
 * Multi-page export to SVG (300 DPI) and PNG with options.
 * Uses app-provided Tailwind classes only — no internal CSS.
 */

import React, { useState, useCallback } from 'react';
import type {
  ComputedGilwellPage,
  GilwellConfig,
} from '../logic/types';
import { downloadSvgPage, downloadPngPage, renderSvgToPngBlob } from '../logic/gilwellExport';

interface ExportModalProps {
  pages: ComputedGilwellPage[];
  config: GilwellConfig;
  onClose: () => void;
}

export default function ExportModal({ pages, config, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<'svg' | 'png'>('svg');
  const [dpi, setDpi] = useState(300);
  const [pageRange, setPageRange] = useState<'all' | 'current' | 'range'>('all');
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(pages.length);
  const [transparentBg, setTransparentBg] = useState(config.transparentBackground);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);

  const getPagesToExport = useCallback(() => {
    if (pageRange === 'all') return pages;
    if (pageRange === 'current') return pages.length > 0 ? [pages[0]] : [];
    return pages.slice(rangeStart - 1, rangeEnd);
  }, [pages, pageRange, rangeStart, rangeEnd]);

  const handleExport = async () => {
    const pagesToExport = getPagesToExport();
    if (!pagesToExport.length) return;

    setExporting(true);
    setProgress(0);

    try {
      if (format === 'svg') {
        pagesToExport.forEach((page, i) => {
          setCurrentPage(page.pageNumber);
          setProgress(Math.round(((i + 1) / pagesToExport.length) * 100));
          // Small delay to show progress
          await new Promise(r => setTimeout(r, 50));
          downloadSvgPage(page, { ...config, transparentBackground: transparentBg });
        });
      } else {
        for (let i = 0; i < pagesToExport.length; i++) {
          const page = pagesToExport[i];
          setCurrentPage(page.pageNumber);
          setProgress(Math.round(((i + 1) / pagesToExport.length) * 100));
          const blob = await renderSvgToPngBlob(page, { ...config, transparentBackground: transparentBg }, dpi);
          const suffix = pagesToExport.length > 1 ? `_page_${page.pageNumber}` : '';
          const filename = `schema_gilwell${suffix}.png`;

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      }
      setProgress(100);
      await new Promise(r => setTimeout(r, 500));
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Échec de l'export: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setExporting(false);
      setProgress(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !exporting) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        className="w-full max-w-md bg-white rounded-xl shadow-xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h2 id="export-modal-title" className="text-lg font-semibold text-slate-900">Exporter le schéma Gilwell</h2>
          <button
            onClick={onClose}
            disabled={exporting}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-50"
            aria-label="Fermer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Format selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Format</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFormat('svg')}
                className={`flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                  format === 'svg'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/><path d="M9 16h6"/></svg>
                  <span>SVG</span>
                </div>
                <div className="text-xs mt-1 opacity-80">Vectoriel, editable, 300 DPI</div>
              </button>
              <button
                onClick={() => setFormat('png')}
                className={`flex-1 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${
                  format === 'png'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  <span>PNG</span>
                </div>
                <div className="text-xs mt-1 opacity-80">Raster, {dpi} DPI</div>
              </button>
            </div>
          </div>

          {/* PNG DPI option */}
          {format === 'png' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Résolution (DPI)</label>
              <select
                value={dpi}
                onChange={(e) => setDpi(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value={150}>150 DPI — Rapide, taille réduite</option>
                <option value={300}>300 DPI — Standard impression</option>
                <option value={600}>600 DPI — Haute qualité</option>
                <option value={1200}>1200 DPI — Très haute qualité (lent)</option>
              </select>
            </div>
          )}

          {/* Page range */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Pages à exporter</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pageRange"
                  value="all"
                  checked={pageRange === 'all'}
                  onChange={() => setPageRange('all')}
                  className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Toutes les pages ({pages.length})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pageRange"
                  value="current"
                  checked={pageRange === 'current'}
                  onChange={() => setPageRange('current')}
                  className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Page courante seulement</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="pageRange"
                  value="range"
                  checked={pageRange === 'range'}
                  onChange={() => setPageRange('range')}
                  className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-slate-700">Plage :</span>
                <input
                  type="number"
                  min="1"
                  max={pages.length}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Math.max(1, Math.min(parseInt(e.target.value) || 1, rangeEnd)))}
                  className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                />
                <span className="text-slate-500">à</span>
                <input
                  type="number"
                  min="1"
                  max={pages.length}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(Math.min(pages.length, Math.max(parseInt(e.target.value) || pages.length, rangeStart)))}
                  className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                />
              </label>
            </div>
          </div>

          {/* Background option */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={transparentBg}
                onChange={(e) => setTransparentBg(e.target.checked)}
                className="w-4 h-4 text-emerald-500 border-slate-300 rounded focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-700">Fond transparent (sinon blanc)</span>
            </label>
          </div>

          {/* Progress */}
          {exporting && (
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Export page {currentPage}...</span>
                <span className="font-mono tabular-nums text-emerald-600">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={exporting}
            className="px-4 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 text-sm border border-emerald-500 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 flex items-center gap-2"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                Export en cours...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Exporter {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
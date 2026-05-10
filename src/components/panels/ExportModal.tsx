/**
 * ExportModal.tsx — Unified export dialog (Infinity-style).
 * Three-column layout: format list | preview | parameters
 */
import React, { useState, useMemo, useEffect } from 'react';
import { X, FileText, Globe, Table2, CheckCircle, AlertTriangle } from 'lucide-react';
import { ExportService, CSV_COLUMNS } from '../../logic/ExportService';
import type { CsvColumnKey, ExportPipelineOptions } from '../../logic/ExportService';
import { ExportHTMLRenderer } from '../../logic/ExportHTMLRenderer';
import { themeManager } from '../../logic/ThemeManager';
import { IGNClient } from '../../logic/IGNClient';
import { useApp } from '../../AppContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type ExportFormatId = 'pdf' | 'docx' | 'html' | 'csv' | 'tsv';
type ExportVersion = 'participant' | 'solution' | 'both';
type PdfEngine = 'auto' | 'weasyprint' | 'electron';

interface FormatDef {
  id: ExportFormatId;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  isBeta?: boolean;
}

const FORMATS: FormatDef[] = [
  { id: 'pdf',  label: 'PDF',  description: 'Carnet imprimable',       color: '#ef4444', icon: <FileText size={14} />, isBeta: true },
  { id: 'docx', label: 'DOCX', description: 'Fichier Word',            color: '#2563eb', icon: <FileText size={14} />, isBeta: true },
  { id: 'html', label: 'HTML', description: 'Carnet web auto-contenu', color: '#3b82f6', icon: <Globe size={14} />, isBeta: true },
  { id: 'csv',  label: 'CSV',  description: 'Tableur — virgule/point-virgule', color: '#10b981', icon: <Table2 size={14} /> },
  { id: 'tsv',  label: 'TSV',  description: 'Tableur — tabulation',   color: '#8b5cf6', icon: <Table2 size={14} /> },
];

// ─── CSV preview parser ───────────────────────────────────────────────────────

function parseCSV(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inQ) {
      if (c === '"' && n === '"') { cell += '"'; i++; }
      else if (c === '"') inQ = false;
      else cell += c;
    } else {
      if (c === '"') { inQ = true; }
      else if (c === sep) { row.push(cell); cell = ''; }
      else if (c === '\r' && n === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
      else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface FormatItemProps {
  fmt: FormatDef;
  active: boolean;
  onClick: () => void;
}

function FormatItem({ fmt, active, onClick }: FormatItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', cursor: 'pointer', borderRadius: '6px',
        margin: '2px 6px',
        background: active ? `${fmt.color}22` : 'transparent',
        border: active ? `1px solid ${fmt.color}55` : '1px solid transparent',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <div style={{
        width: '4px', height: '32px', borderRadius: '2px',
        background: active ? fmt.color : 'rgba(255,255,255,0.1)',
        flexShrink: 0, transition: 'background 0.15s',
      }} />
      <div style={{ color: active ? fmt.color : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
        {fmt.icon}
      </div>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: active ? '#fff' : 'rgba(255,255,255,0.6)', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {fmt.label}
          {fmt.isBeta && (
            <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Beta</span>
          )}
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
          {fmt.description}
        </div>
      </div>
    </div>
  );
}

// (Removed Chip helper to use standard checkboxes)

// ─── Label helper ─────────────────────────────────────────────────────────────

function ParamLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>
      {children}
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────────────

interface ExportModalProps {
  onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { state } = useApp();

  // ── State ──
  const [activeFormat, setActiveFormat] = useState<ExportFormatId>('pdf');
  const [version, setVersion] = useState<ExportVersion>('both');
  const [pdfEngine, setPdfEngine] = useState<PdfEngine>('auto');
  const [includeAnnexes, setIncludeAnnexes] = useState(true);
  const [csvColumns, setCsvColumns] = useState<CsvColumnKey[]>(CSV_COLUMNS.map(c => c.key));
  const [csvSeparator, setCsvSeparator] = useState(';');
  const [csvMaxPois, setCsvMaxPois] = useState(5);
  const [wpStatus, setWpStatus] = useState<{ checked: boolean; available: boolean; version?: string }>({ checked: false, available: false });
  const [enrichedAddresses, setEnrichedAddresses] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  // ── WeasyPrint detection ──
  useEffect(() => {
    ExportService.checkWeasyPrint().then(r => setWpStatus({ checked: true, ...r }));
  }, []);

  // ── Address enrichment ──
  useEffect(() => {
    let active = true;
    const run = async () => {
      const map: Record<string, string> = {};
      for (const stage of state.stages || []) {
        const addr = await IGNClient.reverseGeocode(stage.coords[0], stage.coords[1]);
        if (!active) return;
        map[stage.id] = addr;
      }
      if (active) setEnrichedAddresses(map);
    };
    run();
    return () => { active = false; };
  }, [state.stages]);

  // ── Keyboard close ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // ── CSV preview ──
  const csvSep = activeFormat === 'tsv' ? '\t' : (csvSeparator === 'tab' ? '\t' : csvSeparator);
  const previewOpts: ExportPipelineOptions = useMemo(() => ({
    title: 'Carnet de Route',
    subtitle: new Date().toLocaleDateString('fr-FR'),
    includeGeneralMap: false,
    includeAnnexes,
    version,
    pdfEngine,
    csvColumns,
    csvSeparator: csvSep,
    csvMaxPois,
    enrichedAddresses,
  }), [state, csvColumns, csvSep, csvMaxPois, enrichedAddresses, includeAnnexes, version, pdfEngine]);

  const tableData = useMemo(() => {
    if (activeFormat !== 'csv' && activeFormat !== 'tsv') return [];
    try {
      return parseCSV(ExportService.generateCSVString(state, previewOpts), csvSep);
    } catch { return []; }
  }, [activeFormat, state, previewOpts, csvSep]);

  // ── HTML Preview ──
  const htmlPreviewSrc = useMemo(() => {
    if (activeFormat !== 'html' && activeFormat !== 'pdf' && activeFormat !== 'docx') return '';
    try {
      const isSolution = version === 'solution' || version === 'both';
      const baseOpts = {
          title: 'Carnet de Route',
          subtitle: new Date().toLocaleDateString('fr-FR'),
          date: new Date().toLocaleDateString('fr-FR'),
          themeTitle: themeManager.getLabel('main_title', 'CARNET DE ROUTE'),
          includeGeneralMap: false,
          includeAnnexes,
          vigenereKey: themeManager.getVigenereKey(),
          isSolution
      };
      return ExportHTMLRenderer.render(state.carnet_steps, themeManager.currentTheme, baseOpts, {});
    } catch {
      return '';
    }
  }, [activeFormat, state.carnet_steps, version, includeAnnexes]);

  // ── Export handler ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const opts: ExportPipelineOptions = {
        title: 'Carnet de Route',
        subtitle: new Date().toLocaleDateString('fr-FR'),
        includeGeneralMap: state.carnet_include_general_map,
        includeAnnexes,
        version,
        pdfEngine,
        csvColumns,
        csvSeparator: csvSep,
        csvMaxPois,
        enrichedAddresses,
      };
      const fmt = activeFormat === 'tsv' ? 'csv' : activeFormat;
      await ExportService.performExport(state, fmt as any, opts);
    } finally {
      setExporting(false);
    }
  };

  const toggleCol = (key: CsvColumnKey) => {
    setCsvColumns(prev => prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]);
  };

  const isCsvLike = activeFormat === 'csv' || activeFormat === 'tsv';

  // ── Render ──
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '900px', maxWidth: '97vw', height: '620px', maxHeight: '96vh',
          background: '#0d0d14', borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', letterSpacing: '0.02em' }}>Exporter</span>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>Ctrl+E</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* ── LEFT: Format list ── */}
          <div style={{ width: '180px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', paddingTop: '10px', paddingBottom: '10px', overflowY: 'auto' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 18px', marginBottom: '6px' }}>Format</div>
            {FORMATS.map(fmt => (
              <FormatItem key={fmt.id} fmt={fmt} active={activeFormat === fmt.id} onClick={() => setActiveFormat(fmt.id)} />
            ))}
          </div>

          {/* ── CENTER: Preview ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
              Aperçu
            </div>

            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              {isCsvLike ? (
                /* CSV table preview */
                tableData.length > 1 ? (
                  <table style={{ borderCollapse: 'collapse', width: 'max-content', fontSize: '11px', fontFamily: 'Consolas, monospace', color: '#cdd6f4' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#13131f', zIndex: 10 }}>
                      <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                        {tableData[0]?.map((h, i) => (
                          <th key={i} style={{ padding: '9px 13px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.05)', color: FORMATS.find(f => f.id === activeFormat)?.color || 'var(--accent-default)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.slice(1).map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)' }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ padding: '7px 13px', borderRight: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.25)', fontSize: '12px', gap: '8px' }}>
                    <Table2 size={32} strokeWidth={1} />
                    <span>Aucune donnée à prévisualiser</span>
                  </div>
                )
              ) : (activeFormat === 'html' || activeFormat === 'pdf' || activeFormat === 'docx') ? (
                /* HTML/PDF/DOCX visual preview */
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '4px', overflow: 'hidden', margin: '14px' }}>
                   <iframe srcDoc={htmlPreviewSrc} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
                </div>
              ) : null}
            </div>
          </div>

          {/* ── RIGHT: Parameters ── */}
          <div style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', flexShrink: 0 }}>
              Paramètres
            </div>

            <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, overflowY: 'auto' }}>

              {/* Version — for PDF, DOCX & HTML */}
              {(activeFormat === 'pdf' || activeFormat === 'docx' || activeFormat === 'html') && (
                <div>
                  <ParamLabel>Version</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={version === 'participant' || version === 'both'} onChange={e => {
                        if (e.target.checked) setVersion(version === 'solution' ? 'both' : 'participant');
                        else setVersion(version === 'both' ? 'solution' : 'solution'); // Fallback to solution if unchecking
                      }} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      👤 Participant
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={version === 'solution' || version === 'both'} onChange={e => {
                        if (e.target.checked) setVersion(version === 'participant' ? 'both' : 'solution');
                        else setVersion(version === 'both' ? 'participant' : 'participant');
                      }} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      🔑 Solution
                    </label>
                  </div>
                </div>
              )}

              {/* PDF engine */}
              {activeFormat === 'pdf' && (
                <div>
                  <ParamLabel>Moteur PDF</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                      <input type="radio" checked={pdfEngine === 'auto'} onChange={() => setPdfEngine('auto')} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      🔄 Auto
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: wpStatus.available ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)', cursor: wpStatus.available ? 'pointer' : 'not-allowed' }}>
                      <input type="radio" checked={pdfEngine === 'weasyprint'} onChange={() => setPdfEngine('weasyprint')} disabled={!wpStatus.available} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      🐍 WeasyPrint
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                      <input type="radio" checked={pdfEngine === 'electron'} onChange={() => setPdfEngine('electron')} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      ⚡ Electron
                    </label>
                  </div>
                </div>
              )}

              {/* Annexes toggle — PDF, DOCX & HTML */}
              {(activeFormat === 'pdf' || activeFormat === 'docx' || activeFormat === 'html') && (
                <div>
                  <ParamLabel>Options</ParamLabel>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeAnnexes} onChange={e => setIncludeAnnexes(e.target.checked)} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                    Inclure les annexes
                  </label>
                </div>
              )}

              {/* CSV separator */}
              {isCsvLike && activeFormat === 'csv' && (
                <div>
                  <ParamLabel>Séparateur</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                      <input type="radio" checked={csvSeparator === ';'} onChange={() => setCsvSeparator(';')} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      Point-virgule (;)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                      <input type="radio" checked={csvSeparator === ','} onChange={() => setCsvSeparator(',')} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      Virgule (,)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer' }}>
                      <input type="radio" checked={csvSeparator === 'tab'} onChange={() => setCsvSeparator('tab')} style={{ accentColor: 'var(--accent-default)', width: '14px', height: '14px' }} />
                      Tabulation (\t)
                    </label>
                  </div>
                </div>
              )}

              {/* Max POIs */}
              {isCsvLike && (
                <div>
                  <ParamLabel>Max POI par segment</ParamLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="number" min={1} max={20} value={csvMaxPois}
                      onChange={e => setCsvMaxPois(parseInt(e.target.value) || 1)}
                      style={{ width: '46px', padding: '5px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }}
                    />
                    <input
                      type="range" min={1} max={20} value={csvMaxPois}
                      onChange={e => setCsvMaxPois(parseInt(e.target.value) || 1)}
                      style={{ flex: 1, accentColor: 'var(--accent-default)' }}
                    />
                  </div>
                </div>
              )}

              {/* CSV columns */}
              {isCsvLike && (
                <div>
                  <ParamLabel>Colonnes</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '220px', overflowY: 'auto' }}>
                    {CSV_COLUMNS.map(col => (
                      <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.65)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={csvColumns.includes(col.key)} onChange={() => toggleCol(col.key)} style={{ accentColor: 'var(--accent-default)', width: '13px', height: '13px' }} />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 18px', background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '8px 22px', background: FORMATS.find(f => f.id === activeFormat)?.color || 'var(--accent-default)',
              border: 'none', borderRadius: '6px', color: '#fff', cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: '12px', fontWeight: 700, opacity: exporting ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '7px', transition: 'opacity 0.15s',
            }}
          >
            {exporting ? 'Export en cours…' : `Exporter en ${FORMATS.find(f => f.id === activeFormat)?.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

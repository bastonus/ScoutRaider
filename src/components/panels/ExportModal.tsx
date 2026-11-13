/**
 * ExportModal.tsx — Unified factual export dialog.
 * Direct, factual, streamlined: format list | live preview | parameters
 */
import React, { useState, useMemo, useEffect } from 'react';
import { X, FileText, Globe, Table2 } from 'lucide-react';
import { ExportService, CSV_COLUMNS } from '../../logic/ExportService';
import type { CsvColumnKey, ExportPipelineOptions } from '../../logic/ExportService';
import { ExportHTMLRenderer } from '../../logic/ExportHTMLRenderer';
import { themeManager } from '../../logic/ThemeManager';
import { IGNClient } from '../../logic/IGNClient';
import { useApp } from '../../AppContext';

type ExportFormatId = 'pdf' | 'docx' | 'html' | 'csv' | 'tsv';
type ExportVersion = 'participant' | 'solution' | 'both';
type PdfEngine = 'auto' | 'weasyprint' | 'electron';

interface FormatDef {
  id: ExportFormatId;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const FORMATS: FormatDef[] = [
  { id: 'pdf',  label: 'PDF',  description: 'Document A4 imprimable', icon: <FileText size={14} /> },
  { id: 'docx', label: 'DOCX', description: 'Document Word',          icon: <FileText size={14} /> },
  { id: 'html', label: 'HTML', description: 'Page web autonome',      icon: <Globe size={14} /> },
  { id: 'csv',  label: 'CSV',  description: 'Tableur texte (point-virgule)', icon: <Table2 size={14} /> },
  { id: 'tsv',  label: 'TSV',  description: 'Tableur tabulation',     icon: <Table2 size={14} /> },
];

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

function ParamLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
      {children}
    </div>
  );
}

interface ExportModalProps {
  onClose: () => void;
}

export default function ExportModal({ onClose }: ExportModalProps) {
  const { state } = useApp();

  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 840 : false);
  const [mobileTab, setMobileTab] = useState<'format' | 'preview' | 'params'>('preview');

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 840);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [activeFormat, setActiveFormat] = useState<ExportFormatId>('pdf');
  const [docTitle, setDocTitle] = useState(state.document_title || 'Carnet de Route');

  useEffect(() => {
    if (state.document_title) {
      setDocTitle(state.document_title);
    }
  }, [state.document_title]);

  const [version, setVersion] = useState<ExportVersion>('both');
  const [pdfEngine, setPdfEngine] = useState<PdfEngine>('auto');
  const [includeAnnexes, setIncludeAnnexes] = useState(true);
  const [includeElevation, setIncludeElevation] = useState(state.carnet_include_elevation_profile ?? true);
  const [includeMapPagination, setIncludeMapPagination] = useState(false);
  const [csvColumns, setCsvColumns] = useState<CsvColumnKey[]>(CSV_COLUMNS.map(c => c.key));
  const [csvSeparator, setCsvSeparator] = useState(';');
  const [csvMaxPois, setCsvMaxPois] = useState(5);
  const [wpStatus, setWpStatus] = useState<{ checked: boolean; available: boolean; version?: string }>({ checked: false, available: false });
  const [enrichedAddresses, setEnrichedAddresses] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    ExportService.checkWeasyPrint().then(r => setWpStatus({ checked: true, ...r }));
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const map: Record<string, string> = {};
      for (const st of state.stages) {
        if (!active) return;
        const key = `${st.coords[0].toFixed(5)},${st.coords[1].toFixed(5)}`;
        const addr = await IGNClient.reverseGeocode(st.coords[0], st.coords[1]);
        if (addr) map[key] = addr;
      }
      if (active) setEnrichedAddresses(map);
    };
    run();
    return () => { active = false; };
  }, [state.stages]);

  const htmlPreviewSrc = useMemo(() => {
    if (activeFormat === 'csv' || activeFormat === 'tsv') return '';
    return ExportHTMLRenderer.render(
      state.carnet_steps || [],
      themeManager.currentTheme,
      {
        title: docTitle,
        subtitle: `${state.stages.length} étapes`,
        date: new Date().toLocaleDateString('fr-FR'),
        themeTitle: state.theme_id,
        isSolution: version === 'solution',
        includeGeneralMap: state.carnet_include_general_map,
        includeElevationProfile: includeElevation,
        elevationSvg: state.elevation_profile_svg,
        elevationStats: state.elevation_profile_stats,
        includeMapPagination: includeMapPagination,
        includeAnnexes,
        vigenereKey: themeManager.currentTheme.vigenere_key || 'SCOUT',
        pointAnnotations: state.point_annotations,
        areaAnnotations: state.area_annotations,
        itineraries: state.itineraries,
        paperSize: 'A4'
      }
    );
  }, [activeFormat, docTitle, version, includeAnnexes, includeElevation, includeMapPagination, state.carnet_steps, state.stages, state.theme_id, state.carnet_include_general_map, state.elevation_profile_svg, state.elevation_profile_stats, state.point_annotations, state.area_annotations, state.itineraries]);

  const csvRawText = useMemo(() => {
    if (activeFormat !== 'csv' && activeFormat !== 'tsv') return '';
    const sep = activeFormat === 'tsv' ? '\t' : csvSeparator;
    return ExportService.generateCSVString(state, {
      title: docTitle,
      version,
      csvColumns,
      csvSeparator: sep,
      csvMaxPois,
      enrichedAddresses,
    });
  }, [activeFormat, docTitle, version, csvColumns, csvSeparator, csvMaxPois, enrichedAddresses, state]);

  const tableData = useMemo(() => {
    if (!csvRawText) return [];
    const sep = activeFormat === 'tsv' ? '\t' : csvSeparator;
    return parseCSV(csvRawText, sep);
  }, [csvRawText, activeFormat, csvSeparator]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const opts: ExportPipelineOptions = {
        title: docTitle,
        version,
        pdfEngine,
        includeAnnexes,
        includeElevationProfile: includeElevation,
        includeMapPagination,
        csvColumns,
        csvSeparator: activeFormat === 'tsv' ? '\t' : csvSeparator,
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

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: isNarrow ? '100%' : '900px', 
          maxWidth: isNarrow ? '100vw' : '97vw', 
          height: isNarrow ? '100%' : '600px', 
          maxHeight: isNarrow ? '100dvh' : '96vh',
          borderRadius: isNarrow ? 0 : 'var(--radius-md)',
          background: 'var(--bg-elevated)',
          border: isNarrow ? 'none' : '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isNarrow ? '8px 14px' : '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-panel)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Exportation Factuelle</span>
            {!isNarrow && <kbd style={{ fontSize: '9px', padding: '0 4px', height: '16px' }}>Ctrl E</kbd>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px', borderRadius: 'var(--radius-xs)', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Mobile Tab Switcher */}
        {isNarrow && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-panel)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setMobileTab('format')}
              style={{
                flex: 1, padding: '9px 4px', background: mobileTab === 'format' ? 'var(--bg-hover)' : 'transparent',
                border: 'none', borderBottom: mobileTab === 'format' ? '2px solid var(--accent-default)' : '2px solid transparent',
                color: mobileTab === 'format' ? 'var(--text-primary)' : 'var(--text-dim)', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Format ({activeFormat.toUpperCase()})
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              style={{
                flex: 1, padding: '9px 4px', background: mobileTab === 'preview' ? 'var(--bg-hover)' : 'transparent',
                border: 'none', borderBottom: mobileTab === 'preview' ? '2px solid var(--accent-default)' : '2px solid transparent',
                color: mobileTab === 'preview' ? 'var(--text-primary)' : 'var(--text-dim)', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Aperçu
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('params')}
              style={{
                flex: 1, padding: '9px 4px', background: mobileTab === 'params' ? 'var(--bg-hover)' : 'transparent',
                border: 'none', borderBottom: mobileTab === 'params' ? '2px solid var(--accent-default)' : '2px solid transparent',
                color: mobileTab === 'params' ? 'var(--text-primary)' : 'var(--text-dim)', fontSize: '11px', fontWeight: 600, cursor: 'pointer'
              }}
            >
              Options
            </button>
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Left: Format selector */}
          {(!isNarrow || mobileTab === 'format') && (
            <div style={{ width: isNarrow ? '100%' : '160px', flexShrink: 0, borderRight: isNarrow ? 'none' : '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: '8px 0', background: 'var(--bg-panel)' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', padding: '0 12px 6px', textTransform: 'uppercase' }}>Format</div>
              {FORMATS.map(fmt => {
                const active = activeFormat === fmt.id;
                return (
                  <div
                    key={fmt.id}
                    onClick={() => {
                      setActiveFormat(fmt.id);
                      if (isNarrow) setMobileTab('preview');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', cursor: 'pointer',
                      background: active ? 'var(--bg-hover)' : 'transparent',
                      borderLeft: `2px solid ${active ? 'var(--accent-default)' : 'transparent'}`,
                      color: active ? 'var(--text-primary)' : 'var(--text-dim)',
                      fontSize: '11.5px', fontWeight: active ? 600 : 400,
                      transition: 'all 100ms ease'
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ color: active ? 'var(--accent-default)' : 'var(--text-dim)' }}>
                      {fmt.icon}
                    </div>
                    <div>
                      <div>{fmt.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Center: Live Preview */}
          {(!isNarrow || mobileTab === 'preview') && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: isNarrow ? 'none' : '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px', fontWeight: 500, color: 'var(--text-dim)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Aperçu d'impression</span>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)' }}>Noir & Blanc &bull; Factuel</span>
              </div>

              <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {isCsvLike ? (
                  tableData.length > 4 ? (
                    <table style={{ borderCollapse: 'collapse', width: 'max-content', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-default)' }}>
                      <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 10 }}>
                        <tr style={{ borderBottom: '1px solid var(--border-strong)' }}>
                          {tableData[3]?.map((h, i) => (
                            <th key={i} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderRight: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.slice(4).map((row, ri) => (
                          <tr key={ri} style={{ borderBottom: '1px solid var(--border-subtle)', background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{ padding: '5px 10px', borderRight: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)', fontSize: '11px' }}>
                      Aucune donnée à prévisualiser
                    </div>
                  )
                ) : (
                  <div style={{ height: '100%', background: '#ffffff', overflow: 'hidden' }}>
                    <iframe srcDoc={htmlPreviewSrc} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right: Parameters */}
          {(!isNarrow || mobileTab === 'params') && (
            <div style={{ width: isNarrow ? '100%' : '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', flexShrink: 0 }}>
              Paramètres
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, overflowY: 'auto' }}>
              <div>
                <ParamLabel>Titre du carnet</ParamLabel>
                <input
                  type="text"
                  value={docTitle}
                  onChange={e => setDocTitle(e.target.value)}
                  placeholder="Carnet de Route"
                  style={{ width: '100%', padding: '6px 8px', fontSize: '11.5px' }}
                />
              </div>

              {(activeFormat === 'pdf' || activeFormat === 'docx' || activeFormat === 'html') && (
                <div>
                  <ParamLabel>Version</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={version === 'participant' || version === 'both'} onChange={e => {
                        if (e.target.checked) setVersion(version === 'solution' ? 'both' : 'participant');
                        else setVersion(version === 'both' ? 'solution' : 'solution');
                      }} style={{ accentColor: 'var(--accent-default)' }} />
                      Participant (énoncés)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={version === 'solution' || version === 'both'} onChange={e => {
                        if (e.target.checked) setVersion(version === 'participant' ? 'both' : 'solution');
                        else setVersion(version === 'both' ? 'participant' : 'participant');
                      }} style={{ accentColor: 'var(--accent-default)' }} />
                      Solution (corrigés)
                    </label>
                  </div>
                </div>
              )}

              {activeFormat === 'pdf' && (
                <div>
                  <ParamLabel>Moteur PDF</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="radio" checked={pdfEngine === 'auto'} onChange={() => setPdfEngine('auto')} style={{ accentColor: 'var(--accent-default)' }} />
                      Automatique
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: wpStatus.available ? 'var(--text-default)' : 'var(--text-dim)', cursor: wpStatus.available ? 'pointer' : 'not-allowed' }}>
                      <input type="radio" checked={pdfEngine === 'weasyprint'} onChange={() => setPdfEngine('weasyprint')} disabled={!wpStatus.available} style={{ accentColor: 'var(--accent-default)' }} />
                      WeasyPrint
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="radio" checked={pdfEngine === 'electron'} onChange={() => setPdfEngine('electron')} style={{ accentColor: 'var(--accent-default)' }} />
                      Electron (Natif)
                    </label>
                  </div>
                </div>
              )}

              {(activeFormat === 'pdf' || activeFormat === 'docx' || activeFormat === 'html') && (
                <div>
                  <ParamLabel>Options</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={includeAnnexes} onChange={e => setIncludeAnnexes(e.target.checked)} style={{ accentColor: 'var(--accent-default)' }} />
                      Annexes documentaires
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="checkbox" checked={includeElevation} onChange={e => setIncludeElevation(e.target.checked)} style={{ accentColor: 'var(--accent-default)' }} />
                      Profil altimétrique D+ / D-
                    </label>
                  </div>
                </div>
              )}

              {isCsvLike && activeFormat === 'csv' && (
                <div>
                  <ParamLabel>Séparateur</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="radio" checked={csvSeparator === ';'} onChange={() => setCsvSeparator(';')} style={{ accentColor: 'var(--accent-default)' }} />
                      Point-virgule (;)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-default)', cursor: 'pointer' }}>
                      <input type="radio" checked={csvSeparator === ','} onChange={() => setCsvSeparator(',')} style={{ accentColor: 'var(--accent-default)' }} />
                      Virgule (,)
                    </label>
                  </div>
                </div>
              )}

              {isCsvLike && (
                <div>
                  <ParamLabel>Colonnes incluses</ParamLabel>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
                    {CSV_COLUMNS.map(col => (
                      <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={csvColumns.includes(col.key)} onChange={() => toggleCol(col.key)} style={{ accentColor: 'var(--accent-default)' }} />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-panel)' }}>
          <button
            onClick={onClose}
            style={{ padding: '0 12px', height: '28px', background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '11.5px', fontWeight: 500 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.color = 'var(--text-dim)'; }}
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            style={{
              padding: '0 14px', height: '28px', background: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-primary-text)', cursor: exporting ? 'not-allowed' : 'pointer',
              fontSize: '11.5px', fontWeight: 600, opacity: exporting ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 100ms ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-primary-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-primary)'}
          >
            {exporting ? 'Génération...' : `Exporter (${FORMATS.find(f => f.id === activeFormat)?.label})`}
          </button>
        </div>
      </div>
    </div>
  );
}

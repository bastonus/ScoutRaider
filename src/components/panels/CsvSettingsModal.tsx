import React, { useMemo } from 'react';
import { X, Table2 } from 'lucide-react';
import { CSV_COLUMNS, ExportService } from '../../logic/ExportService';
import type { CsvColumnKey, ExportPipelineOptions } from '../../logic/ExportService';
import { useApp } from '../../AppContext';

interface CsvSettingsModalProps {
    onClose: () => void;
    csvColumns: CsvColumnKey[];
    onChangeColumns: (cols: CsvColumnKey[]) => void;
    separator: string;
    onChangeSeparator: (sep: string) => void;
    maxPois: number;
    onChangeMaxPois: (val: number) => void;
    onAddJob: () => void;
    enrichedAddresses: Record<string, string>;
}

function parseCSV(csvText: string, separator: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;
    
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        
        if (inQuotes) {
            if (char === '"') {
                if (nextChar === '"') {
                    currentCell += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentCell += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === separator) {
                currentRow.push(currentCell);
                currentCell = '';
            } else if (char === '\r' && nextChar === '\n') {
                currentRow.push(currentCell);
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
                i++;
            } else if (char === '\n') {
                currentRow.push(currentCell);
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
        }
    }
    if (currentCell !== '' || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }
    return rows;
}

export default function CsvSettingsModal({
    onClose, csvColumns, onChangeColumns, separator, onChangeSeparator, maxPois, onChangeMaxPois, onAddJob, enrichedAddresses
}: CsvSettingsModalProps) {
    const { state } = useApp();

    const toggleCol = (key: CsvColumnKey) => {
        if (csvColumns.includes(key)) {
            onChangeColumns(csvColumns.filter(c => c !== key));
        } else {
            onChangeColumns([...csvColumns, key]);
        }
    };

    const previewOptions: ExportPipelineOptions = {
        title: 'Carnet de Scout',
        subtitle: new Date().toLocaleDateString('fr-FR'),
        includeGeneralMap: false,
        includeAnnexes: false,
        version: 'both',
        pdfEngine: 'auto',
        csvColumns,
        csvSeparator: separator === 'tab' ? '\t' : separator,
        csvMaxPois: maxPois,
        enrichedAddresses,
    };

    const previewData = useMemo(() => {
        try {
            const fullCsv = ExportService.generateCSVString(state, previewOptions);
            const sep = separator === 'tab' ? '\t' : separator;
            const parsed = parseCSV(fullCsv, sep);
            return parsed;
        } catch (e) {
            return [];
        }
    }, [state, csvColumns, separator]);

    return (
        <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)' }}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-panel, #11111b)', width: 'auto', minWidth: '600px', maxWidth: '95vw', maxHeight: '92vh', borderRadius: '12px', border: '1px solid var(--glass-border, rgba(255,255,255,0.1))', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)', overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Table2 size={18} color="var(--accent-default)" />
                        <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Paramètres d'export CSV</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', display: 'flex', gap: '24px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {/* Settings column */}
                    <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '12px', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Séparateur</div>
                            <select 
                                value={separator} 
                                onChange={e => onChangeSeparator(e.target.value)}
                                style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
                            >
                                <option value=";">Point-virgule (;)</option>
                                <option value=",">Virgule (,)</option>
                                <option value="tab">Tabulation (\t)</option>
                            </select>
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Nombre max de POI</div>
                            <input 
                                type="number" 
                                min={1} max={20}
                                value={maxPois} 
                                onChange={e => onChangeMaxPois(parseInt(e.target.value) || 1)}
                                style={{ width: '100%', padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '13px' }}
                            />
                        </div>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '8px' }}>Colonnes à inclure</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
                                {CSV_COLUMNS.map(col => (
                                    <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-main)' }}>
                                        <input type="checkbox" checked={csvColumns.includes(col.key)} onChange={() => toggleCol(col.key)} style={{ accentColor: 'var(--accent-default)' }} />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Preview column */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '10px', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Aperçu ({previewData.length} lignes)</span>
                            <span style={{ fontSize: '10px', opacity: 0.6, textTransform: 'none' }}>Défilement horizontal/vertical actif</span>
                        </div>
                        <div style={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', overflow: 'auto', flex: 1 }}>
                            <table style={{ borderCollapse: 'collapse', width: 'max-content', fontSize: '11px', color: '#cdd6f4', fontFamily: 'Consolas, monospace' }}>
                                <thead style={{ position: 'sticky', top: 0, background: '#181825', zIndex: 10 }}>
                                    <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.15)' }}>
                                        {previewData[0]?.map((h, i) => (
                                            <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.05)', color: 'var(--accent-default)' }}>
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.slice(1).map((row, rIdx) => (
                                        <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} style={{ padding: '8px 14px', borderRight: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'nowrap', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                    {previewData.length <= 1 && (
                                        <tr>
                                            <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                                                {previewData.length === 0 ? 'Chargement ou erreur...' : 'Aucune donnée à afficher'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: 'rgba(0,0,0,0.1)', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button onClick={onClose} className="btn" style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}>Annuler</button>
                    <button onClick={() => { onAddJob(); onClose(); }} className="btn btn-primary" style={{ padding: '8px 16px', background: 'var(--accent-default)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Ajouter à la file d'export</button>
                </div>
            </div>
        </div>
    );
}

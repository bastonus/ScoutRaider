/**
 * ExportPanel.tsx — Export queue manager with WeasyPrint integration.
 * 
 *   TOP:    Export configuration (version, engine, format)
 *   MIDDLE: Pending / computing jobs + "Tout exporter" button
 *   BOTTOM: Completed / errored jobs with metrics
 */
import React, { useState, useCallback, useEffect } from 'react';
import { Zap, ShieldCheck, AlertTriangle, CheckCircle, FileText, Share2, Table2, Settings2 } from 'lucide-react';
import type { ExportJob, ExportFormat } from '../../logic/types';
import ExportJobItem from './ExportJobItem';
import CsvSettingsModal from './CsvSettingsModal';
import { ExportService, CSV_COLUMNS } from '../../logic/ExportService';
import type { ExportPipelineOptions, CsvColumnKey } from '../../logic/ExportService';
import { IGNClient } from '../../logic/IGNClient';
import { useApp } from '../../AppContext';

const FORMAT_LABELS: Record<ExportFormat, string> = {
    pdf:  'Carnet PDF',
    html: 'Carnet Web (HTML)',
    docx: 'Fichier Word (DOCX)',
    csv:  'Données CSV',
};

function makeJob(format: ExportFormat, version: string): ExportJob {
    const versionLabel = version === 'both' ? 'P+S' : version === 'solution' ? 'SOL' : 'PAR';
    return {
        id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        format,
        status: 'pending',
        label: `${FORMAT_LABELS[format]} (${versionLabel})`,
        progress: 0,
        createdAt: Date.now(),
    };
}

type ExportVersion = 'participant' | 'solution' | 'both';
type PdfEngine = 'auto' | 'weasyprint' | 'electron';

export default function ExportPanel() {
    const { state } = useApp();

    // ── WeasyPrint detection ──
    const [wpStatus, setWpStatus] = useState<{ checked: boolean; available: boolean; version?: string }>({
        checked: false, available: false,
    });

    useEffect(() => {
        ExportService.checkWeasyPrint().then(result => {
            setWpStatus({ checked: true, ...result });
        });
    }, []);

    // ── Config ──
    const [version, setVersion] = useState<ExportVersion>('both');
    const [pdfEngine, setPdfEngine] = useState<PdfEngine>('auto');
    const [includeAnnexes, setIncludeAnnexes] = useState(true);
    const [csvColumns, setCsvColumns] = useState<CsvColumnKey[]>(CSV_COLUMNS.map(c => c.key));
    const [csvSeparator, setCsvSeparator] = useState(';');
    const [csvMaxPois, setCsvMaxPois] = useState(5);
    const [csvModalOpen, setCsvModalOpen] = useState(false);
    const [enrichedAddresses, setEnrichedAddresses] = useState<Record<string, string>>({});

    useEffect(() => {
        let active = true;
        const fetchAddresses = async () => {
            const map: Record<string, string> = {};
            for (const stage of state.stages || []) {
                const addr = await IGNClient.reverseGeocode(stage.coords[0], stage.coords[1]);
                if (!active) return;
                map[stage.id] = addr;
            }
            if (active) setEnrichedAddresses(map);
        };
        fetchAddresses();
        return () => { active = false; };
    }, [state.stages]);

    // ── Jobs queue ──
    const [jobs, setJobs] = useState<ExportJob[]>([]);

    const updateJob = useCallback((id: string, patch: Partial<ExportJob>) => {
        setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
    }, []);

    const addJob = (format: ExportFormat) => {
        const job = makeJob(format, version);
        setJobs(prev => [...prev, job]);
    };

    const removeJob = (id: string) => setJobs(prev => prev.filter(j => j.id !== id));

    const changeFormat = (id: string, format: ExportFormat) => {
        setJobs(prev => prev.map(j =>
            j.id === id ? { ...j, format, label: FORMAT_LABELS[format] } : j
        ));
    };

    const exportAll = async () => {
        const pending = jobs.filter(j => j.status === 'pending');

        for (const job of pending) {
            updateJob(job.id, { status: 'computing', progress: 30 });
            const startTime = Date.now();
            try {
                const opts: ExportPipelineOptions = {
                    title: 'Carnet de Scout',
                    subtitle: new Date().toLocaleDateString('fr-FR'),
                    includeGeneralMap: state.carnet_include_general_map,
                    includeAnnexes,
                    version,
                    pdfEngine,
                    csvColumns,
                    csvSeparator: csvSeparator === 'tab' ? '\t' : csvSeparator,
                    csvMaxPois,
                    enrichedAddresses,
                };

                updateJob(job.id, { progress: 50 });

                const success = await ExportService.performExport(state, job.format, opts);

                if (success) {
                    updateJob(job.id, {
                        status: 'done',
                        progress: 100,
                        durationMs: Date.now() - startTime,
                        completedAt: Date.now(),
                    });
                } else {
                    updateJob(job.id, { status: 'error', progress: 0, error: 'Export annulé ou échoué' });
                }
            } catch (err: any) {
                updateJob(job.id, { status: 'error', progress: 0, error: err?.message || 'Erreur inconnue' });
            }
        }
    };

    const pendingJobs   = jobs.filter(j => j.status === 'pending' || j.status === 'computing');
    const completedJobs = jobs.filter(j => j.status === 'done' || j.status === 'error');
    const isExporting   = pendingJobs.some(j => j.status === 'computing');
    const globalProgress = pendingJobs.length === 0 ? 100
        : Math.round(pendingJobs.reduce((s, j) => s + j.progress, 0) / pendingJobs.length);

    // ── Styles ──
    const chipStyle = (active: boolean) => ({
        padding: '4px 12px',
        fontSize: '11px',
        fontWeight: active ? 700 : 500,
        borderRadius: '14px',
        border: active ? '1px solid var(--accent-default)' : '1px solid rgba(255,255,255,0.1)',
        background: active ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
        color: active ? 'var(--accent-default)' : 'var(--text-dim)',
        cursor: 'pointer',
        transition: 'all 0.15s',
    } as React.CSSProperties);

    const addBtnStyle = {
        padding: '8px 16px',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '8px',
        border: '1px dashed rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.03)',
        color: 'var(--text-dim)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'all 0.15s',
    } as React.CSSProperties;

    return (
        <div className="dock-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>

            {/* ── CONFIG: WeasyPrint status + version + engine ──────────── */}
            <div style={{ flexShrink: 0, marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h2 className="section-title">Configuration d'export</h2>
                    <Settings2 size={14} color="var(--text-dim)" />
                </div>

                {/* WeasyPrint status */}
                <div style={{
                    padding: '8px 12px',
                    background: wpStatus.available ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.06)',
                    border: `1px solid ${wpStatus.available ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}`,
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    {wpStatus.available
                        ? <CheckCircle size={13} color="#10b981" />
                        : <AlertTriangle size={13} color="#f59e0b" />
                    }
                    <span style={{ fontSize: '11px', color: wpStatus.available ? '#10b981' : '#f59e0b' }}>
                        {!wpStatus.checked ? 'Vérification de WeasyPrint...'
                            : wpStatus.available ? `WeasyPrint disponible ${wpStatus.version ? `(${wpStatus.version})` : ''}`
                            : 'WeasyPrint non installé — pip install weasyprint'}
                    </span>
                </div>

                {/* Version selector */}
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
                        Version
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {(['participant', 'solution', 'both'] as ExportVersion[]).map(v => (
                            <button key={v} style={chipStyle(version === v)} onClick={() => setVersion(v)}>
                                {v === 'participant' ? '👤 Participant' : v === 'solution' ? '🔑 Solution' : '📦 Les deux'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* PDF Engine selector */}
                <div style={{ marginBottom: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>
                        Moteur PDF
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {(['auto', 'weasyprint', 'electron'] as PdfEngine[]).map(e => (
                            <button key={e} style={chipStyle(pdfEngine === e)} onClick={() => setPdfEngine(e)}
                                disabled={e === 'weasyprint' && !wpStatus.available}
                            >
                                {e === 'auto' ? '🔄 Auto' : e === 'weasyprint' ? '🐍 WeasyPrint' : '⚡ Electron'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Annexes toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-dim)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeAnnexes} onChange={e => setIncludeAnnexes(e.target.checked)}
                        style={{ accentColor: 'var(--accent-default)' }}
                    />
                    Inclure les annexes (Morse, Polybe, Vigenère…)
                </label>
            </div>

            {/* ── ADD JOB BUTTONS ──────────────────────────────────────── */}
            <div style={{ flexShrink: 0, display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <button style={addBtnStyle} onClick={() => addJob('pdf')}>
                    <FileText size={13} /> + PDF
                </button>
                <button style={addBtnStyle} onClick={() => addJob('html')}>
                    <Share2 size={13} /> + HTML
                </button>
                <button style={addBtnStyle} onClick={() => setCsvModalOpen(true)}>
                    <Table2 size={13} /> + CSV
                </button>
            </div>

            {/* ── PENDING QUEUE ────────────────────────────────────────── */}
            <div style={{ flexShrink: 0 }}>
                {pendingJobs.length === 0 ? (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: 'var(--text-dim)',
                        fontSize: '12px',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed rgba(255,255,255,0.07)',
                    }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📭</div>
                        File vide — ajoutez un export ci-dessus
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {pendingJobs.map(job => (
                            <ExportJobItem key={job.id} job={job} onRemove={removeJob} onFormatChange={changeFormat} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── EXPORT ALL BUTTON + PROGRESS ─────────────────────────── */}
            <div style={{ flexShrink: 0, margin: '16px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                    <button
                        className="btn btn-primary btn-pill"
                        onClick={exportAll}
                        disabled={pendingJobs.length === 0 || isExporting}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '7px',
                            fontSize: '12px', padding: '7px 18px',
                            opacity: pendingJobs.length === 0 ? 0.4 : 1,
                        }}
                    >
                        <Zap size={13} strokeWidth={2.5} />
                        {isExporting ? 'Export en cours…' : 'Tout exporter'}
                    </button>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                </div>

                {isExporting && (
                    <div style={{ marginTop: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)', marginBottom: '5px' }}>
                            <span>Progression globale</span>
                            <span>{globalProgress}%</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${globalProgress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--accent-default), var(--accent-hover, #4b8cff))',
                                borderRadius: '2px',
                                transition: 'width 0.4s ease',
                            }} />
                        </div>
                    </div>
                )}
            </div>

            {/* ── COMPLETED JOBS ────────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {completedJobs.length > 0 && (
                    <>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                            Terminés ({completedJobs.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {completedJobs.map(job => (
                                <ExportJobItem key={job.id} job={job} onRemove={removeJob} />
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* ── FOOTER: Engine status ─────────────────────────────────── */}
            <div style={{ flexShrink: 0, marginTop: '16px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <ShieldCheck size={14} color="var(--semantic-green)" />
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>Pipeline HTML-First</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    {wpStatus.available
                        ? 'WeasyPrint actif — exports PDF haute fidélité avec support @page CSS.'
                        : 'Mode Electron — export PDF via navigateur intégré.'}
                </div>
            </div>

            {csvModalOpen && (
                <CsvSettingsModal 
                    onClose={() => setCsvModalOpen(false)}
                    csvColumns={csvColumns}
                    onChangeColumns={setCsvColumns}
                    separator={csvSeparator}
                    onChangeSeparator={setCsvSeparator}
                    maxPois={csvMaxPois}
                    onChangeMaxPois={setCsvMaxPois}
                    onAddJob={() => addJob('csv')}
                    enrichedAddresses={enrichedAddresses}
                />
            )}
        </div>
    );
}

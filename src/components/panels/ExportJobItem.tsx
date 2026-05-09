/**
 * ExportJobItem.tsx — Card for a single job in the export queue.
 * Shows different UI for pending/computing vs. done/error states.
 */
import React from 'react';
import { FileText, FileDown, Share2, Table2, X, CheckCircle2, AlertCircle, Clock, Loader, Eye, Download } from 'lucide-react';
import type { ExportJob, ExportFormat } from '../../logic/types';

interface ExportJobItemProps {
    job: ExportJob;
    onRemove: (id: string) => void;
    onFormatChange?: (id: string, format: ExportFormat) => void;
}

const FORMAT_CONFIG: Record<ExportFormat, { icon: React.ComponentType<any>; color: string; label: string }> = {
    pdf:  { icon: FileText,  color: '#ef4444', label: 'PDF' },
    docx: { icon: FileDown,  color: '#14b8a6', label: 'Word' },
    html: { icon: Share2,    color: '#f59e0b', label: 'HTML' },
    csv:  { icon: Table2,    color: '#10b981', label: 'CSV' },
};

const ALL_FORMATS: ExportFormat[] = ['pdf', 'html', 'docx', 'csv'];

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
}

export default function ExportJobItem({ job, onRemove, onFormatChange }: ExportJobItemProps) {
    const fmt = FORMAT_CONFIG[job.format];
    const Icon = fmt.icon;
    const isPending   = job.status === 'pending';
    const isComputing = job.status === 'computing';
    const isDone      = job.status === 'done';
    const isError     = job.status === 'error';

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            background: isDone ? 'rgba(16,185,129,0.04)' : isError ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.03)',
            border: '1px solid',
            borderColor: isDone ? 'rgba(16,185,129,0.12)' : isError ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)',
            borderRadius: '10px',
            transition: 'all 0.2s',
        }}>
            {/* Format icon */}
            <div style={{
                width: '36px', height: '36px', flexShrink: 0,
                background: `${fmt.color}15`,
                borderRadius: '9px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon size={18} color={fmt.color} strokeWidth={1.8} />
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {job.label}
                    </span>

                    {/* Editable format badge (only when pending) */}
                    {isPending && onFormatChange ? (
                        <select
                            value={job.format}
                            onChange={e => onFormatChange(job.id, e.target.value as ExportFormat)}
                            style={{
                                background: `${fmt.color}15`,
                                border: `1px solid ${fmt.color}30`,
                                borderRadius: '10px',
                                color: fmt.color,
                                fontSize: '10px',
                                fontWeight: 700,
                                padding: '2px 6px',
                                cursor: 'pointer',
                                outline: 'none',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                            }}
                        >
                            {ALL_FORMATS.map(f => (
                                <option key={f} value={f}>{FORMAT_CONFIG[f].label}</option>
                            ))}
                        </select>
                    ) : (
                        <span style={{
                            background: `${fmt.color}15`,
                            border: `1px solid ${fmt.color}30`,
                            borderRadius: '10px',
                            color: fmt.color,
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                        }}>
                            {fmt.label}
                        </span>
                    )}
                </div>

                {/* Progress bar (computing) */}
                {isComputing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{
                                width: `${job.progress}%`,
                                height: '100%',
                                background: `linear-gradient(90deg, ${fmt.color}, ${fmt.color}99)`,
                                borderRadius: '2px',
                                transition: 'width 0.3s ease',
                            }} />
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                            {job.progress}%
                            {job.etaSeconds !== undefined && ` · ~${job.etaSeconds}s`}
                        </span>
                    </div>
                )}

                {/* Pending status */}
                {isPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'var(--text-dim)' }}>
                        <Clock size={10} />
                        En attente de calcul…
                    </div>
                )}

                {/* Done metrics and actions */}
                {isDone && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
                            {job.fileSizeBytes !== undefined && <span>{formatFileSize(job.fileSizeBytes)}</span>}
                            {job.durationMs !== undefined && <span>· {formatDuration(job.durationMs)}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                className="btn-discreet"
                                style={{ padding: '3px 8px', fontSize: '10px' }}
                                title="Ouvrir le fichier"
                            >
                                <Eye size={11} style={{ marginRight: '3px' }} /> Voir
                            </button>
                            <button
                                className="btn-discreet"
                                style={{ padding: '3px 8px', fontSize: '10px' }}
                                title="Télécharger le fichier"
                            >
                                <Download size={11} style={{ marginRight: '3px' }} /> Télécharger
                            </button>
                        </div>
                    </div>
                )}

                {/* Error */}
                {isError && (
                    <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>
                        {job.error ?? 'Erreur inattendue'}
                    </div>
                )}
            </div>

            {/* Status icon / spinner */}
            <div style={{ flexShrink: 0 }}>
                {isComputing && (
                    <div style={{ animation: 'spin 1s linear infinite' }}>
                        <Loader size={16} color={fmt.color} strokeWidth={2} />
                    </div>
                )}
                {isDone && <CheckCircle2 size={16} color="#10b981" strokeWidth={2} />}
                {isError && <AlertCircle size={16} color="#ef4444" strokeWidth={2} />}
            </div>

            {/* Remove button */}
            <button
                onClick={() => onRemove(job.id)}
                style={{
                    flexShrink: 0,
                    width: '24px', height: '24px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '6px',
                    color: 'rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    transition: 'color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent'; }}
                title="Supprimer"
            >
                <X size={13} strokeWidth={2.5} />
            </button>
        </div>
    );
}

import React, { useState } from 'react';
import { X, MapPin, Flag, Tent, Droplets, AlertTriangle, Star, Info, Check, Trash2 } from 'lucide-react';
import { AnnotationLayerDef, AnnotationIcon, PointAnnotation, AreaAnnotation } from '../../logic/types';

export function calculatePolygonArea(coords: [number, number][]): number {
    if (coords.length < 3) return 0;
    const R = 6378137; // Earth radius in meters
    let total = 0;
    const len = coords.length;
    for (let i = 0; i < len; i++) {
        const p1 = coords[i];
        const p2 = coords[(i + 1) % len];
        const lat1 = (p1[0] * Math.PI) / 180;
        const lat2 = (p2[0] * Math.PI) / 180;
        const lon1 = (p1[1] * Math.PI) / 180;
        const lon2 = (p2[1] * Math.PI) / 180;
        total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    const area = Math.abs((total * R * R) / 2.0);
    return area;
}

export function formatArea(areaM2: number): string {
    if (areaM2 >= 1_000_000) {
        return `${(areaM2 / 1_000_000).toFixed(2)} km²`;
    }
    if (areaM2 >= 10_000) {
        return `${(areaM2 / 10_000).toFixed(2)} ha`;
    }
    return `${Math.round(areaM2)} m²`;
}

export const PRESET_COLORS = [
    { label: 'Bleu', value: '#3b82f6' },
    { label: 'Émeraude', value: '#10b981' },
    { label: 'Ambre / Or', value: '#f59e0b' },
    { label: 'Rouge', value: '#ef4444' },
    { label: 'Pourpre', value: '#8b5cf6' },
    { label: 'Rose', value: '#ec4899' },
    { label: 'Cyan', value: '#06b6d4' },
    { label: 'Gris', value: '#64748b' },
];

export const ICONS_CONFIG: { id: AnnotationIcon; label: string; icon: React.ReactNode }[] = [
    { id: 'pin', label: 'Repère', icon: <MapPin size={16} /> },
    { id: 'camp', label: 'Bivouac / Camp', icon: <Tent size={16} /> },
    { id: 'flag', label: 'Objectif / Drapeau', icon: <Flag size={16} /> },
    { id: 'water', label: 'Point d’eau', icon: <Droplets size={16} /> },
    { id: 'danger', label: 'Attention / Danger', icon: <AlertTriangle size={16} /> },
    { id: 'star', label: 'Remarquable / POI', icon: <Star size={16} /> },
    { id: 'info', label: 'Information', icon: <Info size={16} /> },
];

interface PointModalProps {
    initialData?: Partial<PointAnnotation>;
    layers: AnnotationLayerDef[];
    coords?: [number, number];
    onSave: (data: { title: string; text: string; layerId: string; color: string; icon: AnnotationIcon; coords: [number, number] }) => void;
    onDelete?: () => void;
    onClose: () => void;
}

export function PointAnnotationModal({ initialData, layers, coords, onSave, onDelete, onClose }: PointModalProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [text, setText] = useState(initialData?.text || '');
    const [layerId, setLayerId] = useState(initialData?.layerId || layers.find(l => l.type === 'points')?.id || layers[0]?.id || 'layer-points');
    const [color, setColor] = useState(initialData?.color || '#3b82f6');
    const [icon, setIcon] = useState<AnnotationIcon>(initialData?.icon || 'pin');

    const pointCoords = initialData?.coords || coords || [0, 0];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({
            title: title.trim(),
            text: text.trim(),
            layerId,
            color,
            icon,
            coords: pointCoords
        });
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{
                width: '100%', maxWidth: '440px',
                background: 'linear-gradient(180deg, #18241c 0%, #101913 100%)',
                border: '1px solid rgba(110, 201, 126, 0.2)',
                borderRadius: '16px', boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${color}25`, border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                            <MapPin size={16} />
                        </div>
                        {initialData?.id ? 'Modifier le point annoté' : 'Nouveau point annoté'}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Titre du point *
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            placeholder="Ex: Bivouac sous les pins, Source potable..."
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={{
                                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Commentaire / Notes
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Informations supplémentaires, consignes pour le raid..."
                            value={text}
                            onChange={e => setText(e.target.value)}
                            style={{
                                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* Layer selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Calque d'annotation
                        </label>
                        <select
                            value={layerId}
                            onChange={e => setLayerId(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                                background: '#121a14', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none'
                            }}
                        >
                            {layers.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Icon selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Icône
                        </label>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {ICONS_CONFIG.map(item => {
                                const isSelected = icon === item.id;
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        title={item.label}
                                        onClick={() => setIcon(item.id)}
                                        style={{
                                            padding: '6px 10px', borderRadius: '8px',
                                            background: isSelected ? `${color}30` : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${isSelected ? color : 'rgba(255,255,255,0.08)'}`,
                                            color: isSelected ? color : 'var(--text-dim)',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '11px', fontWeight: isSelected ? 700 : 500
                                        }}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Color selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Couleur
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {PRESET_COLORS.map(c => (
                                <div
                                    key={c.value}
                                    title={c.label}
                                    onClick={() => setColor(c.value)}
                                    style={{
                                        width: '22px', height: '22px', borderRadius: '50%',
                                        background: c.value, cursor: 'pointer',
                                        boxShadow: color === c.value ? `0 0 0 2px #fff, 0 0 0 4px ${c.value}` : 'none',
                                        transition: 'transform 0.15s'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Coordinates hint */}
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        Position : {pointCoords[0].toFixed(5)}, {pointCoords[1].toFixed(5)}
                    </div>

                    {/* Footer Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        {onDelete ? (
                            <button
                                type="button"
                                onClick={() => { onDelete(); onClose(); }}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444', padding: '7px 12px', borderRadius: '8px',
                                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Trash2 size={14} />
                                Supprimer
                            </button>
                        ) : <div />}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'var(--text-dim)', padding: '7px 14px', borderRadius: '8px',
                                    fontSize: '12px', cursor: 'pointer'
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                style={{
                                    background: color, border: 'none',
                                    color: '#fff', padding: '7px 18px', borderRadius: '8px',
                                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Check size={14} />
                                {initialData?.id ? 'Enregistrer' : 'Ajouter le point'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

interface AreaModalProps {
    initialData?: Partial<AreaAnnotation>;
    layers: AnnotationLayerDef[];
    coords?: [number, number][];
    onSave: (data: { title: string; text: string; layerId: string; color: string; fillOpacity: number; coords: [number, number][] }) => void;
    onDelete?: () => void;
    onClose: () => void;
}

export function AreaAnnotationModal({ initialData, layers, coords, onSave, onDelete, onClose }: AreaModalProps) {
    const [title, setTitle] = useState(initialData?.title || '');
    const [text, setText] = useState(initialData?.text || '');
    const [layerId, setLayerId] = useState(initialData?.layerId || layers.find(l => l.type === 'areas')?.id || layers[0]?.id || 'layer-areas');
    const [color, setColor] = useState(initialData?.color || '#10b981');
    const [fillOpacity, setFillOpacity] = useState(initialData?.fillOpacity ?? 0.25);

    const areaCoords = initialData?.coords || coords || [];
    const areaM2 = calculatePolygonArea(areaCoords);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || areaCoords.length < 3) return;
        onSave({
            title: title.trim(),
            text: text.trim(),
            layerId,
            color,
            fillOpacity,
            coords: areaCoords
        });
        onClose();
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px'
        }}>
            <div style={{
                width: '100%', maxWidth: '440px',
                background: 'linear-gradient(180deg, #18241c 0%, #101913 100%)',
                border: '1px solid rgba(110, 201, 126, 0.2)',
                borderRadius: '16px', boxShadow: '0 20px 48px rgba(0, 0, 0, 0.7)',
                overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${color}25`, border: `1px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                            </svg>
                        </div>
                        {initialData?.id ? 'Modifier la zone' : 'Nouvelle zone délimitée'}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', display: 'flex', padding: '4px' }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Nom de la zone *
                        </label>
                        <input
                            type="text"
                            required
                            autoFocus
                            placeholder="Ex: Périmètre de camp, Zone de jeu, Réserve..."
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            style={{
                                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '8px', color: '#fff', fontSize: '13px', outline: 'none'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Commentaire / Instructions
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Règles de franchissement, consignes de sécurité..."
                            value={text}
                            onChange={e => setText(e.target.value)}
                            style={{
                                width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                                background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none',
                                resize: 'vertical'
                            }}
                        />
                    </div>

                    {/* Layer selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Calque d'annotation
                        </label>
                        <select
                            value={layerId}
                            onChange={e => setLayerId(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 10px', boxSizing: 'border-box',
                                background: '#121a14', border: '1px solid rgba(255,255,255,0.12)',
                                borderRadius: '8px', color: '#fff', fontSize: '12px', outline: 'none'
                            }}
                        >
                            {layers.map(l => (
                                <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Color selection */}
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Couleur de la zone
                        </label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {PRESET_COLORS.map(c => (
                                <div
                                    key={c.value}
                                    title={c.label}
                                    onClick={() => setColor(c.value)}
                                    style={{
                                        width: '22px', height: '22px', borderRadius: '50%',
                                        background: c.value, cursor: 'pointer',
                                        boxShadow: color === c.value ? `0 0 0 2px #fff, 0 0 0 4px ${c.value}` : 'none',
                                        transition: 'transform 0.15s'
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Opacity slider */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '5px' }}>
                            <span>Opacité du remplissage</span>
                            <span>{Math.round(fillOpacity * 100)}%</span>
                        </div>
                        <input
                            type="range"
                            min="0.05"
                            max="0.8"
                            step="0.05"
                            value={fillOpacity}
                            onChange={e => setFillOpacity(parseFloat(e.target.value))}
                            style={{ width: '100%', accentColor: color }}
                        />
                    </div>

                    {/* Area surface info */}
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '10px 14px', borderRadius: '8px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: '12px'
                    }}>
                        <span style={{ color: 'var(--text-dim)' }}>Superficie estimée :</span>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{formatArea(areaM2)} ({areaCoords.length} sommets)</span>
                    </div>

                    {/* Footer Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                        {onDelete ? (
                            <button
                                type="button"
                                onClick={() => { onDelete(); onClose(); }}
                                style={{
                                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#ef4444', padding: '7px 12px', borderRadius: '8px',
                                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Trash2 size={14} />
                                Supprimer
                            </button>
                        ) : <div />}

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'var(--text-dim)', padding: '7px 14px', borderRadius: '8px',
                                    fontSize: '12px', cursor: 'pointer'
                                }}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                style={{
                                    background: color, border: 'none',
                                    color: '#fff', padding: '7px 18px', borderRadius: '8px',
                                    fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '6px'
                                }}
                            >
                                <Check size={14} />
                                {initialData?.id ? 'Enregistrer' : 'Valider la zone'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

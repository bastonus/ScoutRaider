/**
 * Gilwell Module — Element Inspector Popover
 * Contextual property editor for each selectable element type.
 * Uses app-provided Tailwind classes only — no internal CSS.
 */

import React, { useState } from 'react';
import type {
  GilwellConfig,
  GilwellStep,
  ComputedGilwellColumn,
  SelectedElementTarget,
} from '../logic/types';
import {
  formatStepText,
  PAGE_FORMATS,
  AXIS_LINE_STYLES,
  NODE_STYLES,
  FLOW_CONNECTOR_SHAPES,
  FLOW_CONNECTOR_LINE_STYLES,
  NUMBERING_FORMATS,
  NUMBERING_POSITIONS,
  NUMBERING_BADGE_SHAPES,
  SUBSEQUENT_START_MODES,
  READING_DIRECTIONS,
  FONT_SIZE_MODES,
} from '../logic/GilwellEngine';

interface ElementInspectorPopoverProps {
  target: SelectedElementTarget;
  config: GilwellConfig;
  step: GilwellStep | null;
  stepDisplayIndex: number;
  column: ComputedGilwellColumn | null;
  onClose: () => void;
  onUpdateConfig: (patch: Partial<GilwellConfig>) => void;
  onUpdateStep: (id: string, patch: Partial<GilwellStep>) => void;
  onAddStepAfter: (afterId: string) => void;
  onDeleteStep: (id: string) => void;
}

const POPOVER_WIDTH = 320;

const labelStyles = 'block text-xs font-medium text-slate-600 mb-1';
const inputStyles =
  'w-full px-2 py-1.5 text-sm border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500';
const selectStyles = inputStyles + ' appearance-none';
const sectionStyles = 'mb-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0';
const rowStyles = 'flex items-center gap-2';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className={sectionStyles}><label className={labelStyles}>{title}</label>{children}</div>;
}

function InputRow({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`${rowStyles} ${className}`}>
      <span className="w-24 text-xs text-slate-600 shrink-0">{label}</span>
      {children}
    </div>
  );
}

export default function ElementInspectorPopover({
  target,
  config,
  step,
  stepDisplayIndex,
  column,
  onClose,
  onUpdateConfig,
  onUpdateStep,
  onAddStepAfter,
  onDeleteStep,
}: ElementInspectorPopoverProps) {
  const [localColor, setLocalColor] = useState('');

  const handleColorChange = (key: keyof GilwellConfig['colors'], value: string) => {
    onUpdateConfig({ colors: { ...config.colors, [key]: value } });
  };

  const handleArrowChange = (key: keyof GilwellConfig['arrow'], value: number) => {
    onUpdateConfig({ arrow: { ...config.arrow, [key]: value } });
  };

  const handleNumberingChange = (key: keyof GilwellConfig['numbering'], value: string | number | boolean) => {
    onUpdateConfig({ numbering: { ...config.numbering, [key]: value } });
  };

  const handleAxisChange = (key: keyof GilwellConfig['axis'], value: string | number | boolean) => {
    onUpdateConfig({ axis: { ...config.axis, [key]: value } });
  };

  const handleFlowChange = (key: keyof GilwellConfig['flowConnector'], value: string | number | boolean) => {
    onUpdateConfig({ flowConnector: { ...config.flowConnector, [key]: value } });
  };

  const stepAzimut = step?.azimut ?? 0;
  const stepDistance = step?.distance ?? 0;
  const autoText = step ? formatStepText(step, config.stepTextTemplate) : '';

  if (target.kind === 'step-arrow') {
    return (
      <div className="fixed z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg" style={{ maxHeight: '80vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Étape {stepDisplayIndex}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Fermer">✕</button>
        </div>

        <Section title="Géométrie">
          <InputRow label="Azimut">
            <input
              type="number"
              min="0"
              max="359"
              value={stepAzimut}
              onChange={(e) => onUpdateStep(step!.id, { azimut: parseInt(e.target.value) || 0 })}
              className={inputStyles}
            />
          </InputRow>
          <InputRow label="Distance (m)">
            <input
              type="number"
              min="0"
              step="0.1"
              value={stepDistance}
              onChange={(e) => onUpdateStep(step!.id, { distance: parseFloat(e.target.value) || 0 })}
              className={inputStyles}
            />
          </InputRow>
        </Section>

        <Section title="Étiquette">
          <InputRow label="Auto">
            <input type="text" value={autoText} readOnly className={`${inputStyles} bg-slate-50 text-slate-500 text-xs`} />
          </InputRow>
          <InputRow label="Personnalisée">
            <input
              type="text"
              value={step?.customText ?? ''}
              onChange={(e) => onUpdateStep(step!.id, { customText: e.target.value || undefined })}
              className={inputStyles}
              placeholder={autoText}
            />
          </InputRow>
          <InputRow label="Couleur texte">
            <input
              type="color"
              value={step?.customTextColor || config.colors.textMain}
              onChange={(e) => onUpdateStep(step!.id, { customTextColor: e.target.value })}
              className="w-10 h-6 p-0 border-0 cursor-pointer"
            />
          </InputRow>
        </Section>

        <Section title="Flèche">
          <InputRow label="Couleur">
            <input
              type="color"
              value={step?.customColor || config.colors.arrowFill}
              onChange={(e) => onUpdateStep(step!.id, { customColor: e.target.value })}
              className="w-10 h-6 p-0 border-0 cursor-pointer"
            />
          </InputRow>
          <InputRow label="Longueur (cm)">
            <input
              type="number"
              min="0.5"
              max="10"
              step="0.1"
              value={config.arrow.length}
              onChange={(e) => handleArrowChange('length', parseFloat(e.target.value))}
              className={inputStyles}
            />
          </InputRow>
          <InputRow label="Épaisseur">
            <input
              type="number"
              min="0.5"
              max="5"
              step="0.1"
              value={config.arrow.strokeWidth}
              onChange={(e) => handleArrowChange('strokeWidth', parseFloat(e.target.value))}
              className={inputStyles}
            />
          </InputRow>
          <InputRow label="Tête L/h">
            <div className="flex gap-1">
              <input type="number" min="2" max="20" step="0.5" value={config.arrow.headWidth} onChange={(e) => handleArrowChange('headWidth', parseFloat(e.target.value))} className={inputStyles} style={{ width: '50%' }} />
              <input type="number" min="2" max="20" step="0.5" value={config.arrow.headLength} onChange={(e) => handleArrowChange('headLength', parseFloat(e.target.value))} className={inputStyles} style={{ width: '50%' }} />
            </div>
          </InputRow>
        </Section>

        <Section title="Numérotation">
          <InputRow label="Personnalisée">
            <input
              type="text"
              value={step?.customNumber ?? ''}
              onChange={(e) => onUpdateStep(step!.id, { customNumber: e.target.value || undefined })}
              className={inputStyles}
              placeholder="Auto"
            />
          </InputRow>
        </Section>

        <Section title="Actions">
          <div className="flex gap-2">
            <button onClick={() => onAddStepAfter(step!.id)} className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded bg-white hover:bg-slate-50">Ajouter après</button>
            <button onClick={() => onDeleteStep(step!.id)} className="flex-1 px-2 py-1.5 text-sm border border-red-300 rounded bg-red-50 text-red-700 hover:bg-red-100">Supprimer</button>
          </div>
        </Section>
      </div>
    );
  }

  if (target.kind === 'step-number') {
    return (
      <div className="fixed z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Numéro étape {stepDisplayIndex}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <Section title="Personnalisation">
          <InputRow label="Étiquette">
            <input
              type="text"
              value={step?.customNumber ?? ''}
              onChange={(e) => onUpdateStep(step!.id, { customNumber: e.target.value || undefined })}
              className={inputStyles}
              placeholder="Auto"
            />
          </InputRow>
        </Section>
        <Section title="Style global">
          <InputRow label="Format">
            <select value={config.numbering.format} onChange={(e) => handleNumberingChange('format', e.target.value as any)} className={selectStyles}>
              {NUMBERING_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </InputRow>
          <InputRow label="Position">
            <select value={config.numbering.position} onChange={(e) => handleNumberingChange('position', e.target.value as any)} className={selectStyles}>
              {NUMBERING_POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </InputRow>
          <InputRow label="Badge">
            <select value={config.numbering.badgeShape} onChange={(e) => handleNumberingChange('badgeShape', e.target.value as any)} className={selectStyles}>
              {NUMBERING_BADGE_SHAPES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </InputRow>
          <InputRow label="Rempli">
            <input type="checkbox" checked={config.numbering.badgeFilled} onChange={(e) => handleNumberingChange('badgeFilled', e.target.checked)} />
          </InputRow>
          <InputRow label="Taille police">
            <input type="number" min="4" max="24" value={config.numbering.fontSize} onChange={(e) => handleNumberingChange('fontSize', parseInt(e.target.value))} className={inputStyles} />
          </InputRow>
          <InputRow label="Décalage (cm)">
            <input type="number" min="-2" max="5" step="0.1" value={config.numbering.offsetCm} onChange={(e) => handleNumberingChange('offsetCm', parseFloat(e.target.value))} className={inputStyles} />
          </InputRow>
          <InputRow label="Couleur">
            <input type="color" value={config.numbering.color} onChange={(e) => handleNumberingChange('color', e.target.value)} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
        </Section>
      </div>
    );
  }

  if (target.kind === 'step-text') {
    return (
      <div className="fixed z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg" style={{ maxHeight: '80vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Texte étape {stepDisplayIndex}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <Section title="Contenu">
          <InputRow label="Auto">
            <input type="text" value={autoText} readOnly className={`${inputStyles} bg-slate-50 text-slate-500 text-xs`} />
          </InputRow>
          <InputRow label="Personnalisé">
            <textarea
              value={step?.customText ?? ''}
              onChange={(e) => onUpdateStep(step!.id, { customText: e.target.value || undefined })}
              className={inputStyles}
              rows={3}
              placeholder={autoText}
            />
          </InputRow>
          <InputRow label="Couleur">
            <input type="color" value={step?.customTextColor || config.colors.textMain} onChange={(e) => onUpdateStep(step!.id, { customTextColor: e.target.value })} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
        </Section>
        <Section title="Police (globale)">
          <InputRow label="Famille">
            <select value={config.fontFamily} onChange={(e) => onUpdateConfig({ fontFamily: e.target.value })} className={selectStyles}>
              {['Inter, system-ui, sans-serif', 'Roboto, system-ui, sans-serif', 'Open Sans, system-ui, sans-serif', 'Merriweather, Georgia, serif', 'JetBrains Mono, monospace'].map((f) => <option key={f} value={f}>{f.split(',')[0]}</option>)}
            </select>
          </InputRow>
          <InputRow label="Taille base">
            <input type="number" min="4" max="24" value={config.fontSizeBase} onChange={(e) => onUpdateConfig({ fontSizeBase: parseInt(e.target.value) })} className={inputStyles} />
          </InputRow>
          <InputRow label="Poids">
            <select value={config.textTypography.step.fontWeight} onChange={(e) => onUpdateConfig({ textTypography: { ...config.textTypography, step: { ...config.textTypography.step, fontWeight: parseInt(e.target.value) } } })} className={selectStyles}>
              {[300, 400, 500, 600, 700].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </InputRow>
          <InputRow label="Largeur wrap">
            <input type="number" min="10" max="80" value={config.wrapWidth} onChange={(e) => onUpdateConfig({ wrapWidth: parseInt(e.target.value) })} className={inputStyles} />
          </InputRow>
        </Section>
      </div>
    );
  }

  if (target.kind === 'axis') {
    return (
      <div className="fixed z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg" style={{ maxHeight: '80vh', overflow: 'auto' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Axe central {target.colKey}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <Section title="Visibilité">
          <InputRow label="Afficher">
            <input type="checkbox" checked={config.axis.visible} onChange={(e) => handleAxisChange('visible', e.target.checked)} />
          </InputRow>
        </Section>
        <Section title="Style de ligne">
          <InputRow label="Type">
            <select value={config.axis.lineStyle} onChange={(e) => handleAxisChange('lineStyle', e.target.value as any)} className={selectStyles}>
              {AXIS_LINE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </InputRow>
          <InputRow label="Épaisseur">
            <input type="number" min="0.3" max="3" step="0.1" value={config.axis.strokeWidth} onChange={(e) => handleAxisChange('strokeWidth', parseFloat(e.target.value))} className={inputStyles} />
          </InputRow>
          <InputRow label="Couleur">
            <input type="color" value={config.axis.color} onChange={(e) => handleAxisChange('color', e.target.value)} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
        </Section>
        <Section title="Nœuds">
          <InputRow label="Style">
            <select value={config.axis.nodeStyle} onChange={(e) => handleAxisChange('nodeStyle', e.target.value as any)} className={selectStyles}>
              {NODE_STYLES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </InputRow>
          <InputRow label="Taille">
            <input type="number" min="2" max="12" step="0.5" value={config.axis.nodeSize} onChange={(e) => handleAxisChange('nodeSize', parseFloat(e.target.value))} className={inputStyles} />
          </InputRow>
          <InputRow label="Couleur">
            <input type="color" value={config.axis.nodeColor} onChange={(e) => handleAxisChange('nodeColor', e.target.value)} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
        </Section>
      </div>
    );
  }

  if (target.kind === 'north') {
    return (
      <div className="fixed z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Indicateur Nord</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <Section title="Affichage">
          <InputRow label="Visible">
            <input type="checkbox" checked={config.showNorth} onChange={(e) => onUpdateConfig({ showNorth: e.target.checked })} />
          </InputRow>
          <InputRow label="Étiquette">
            <input type="text" value={config.northLabel} onChange={(e) => onUpdateConfig({ northLabel: e.target.value || 'NORD' })} className={inputStyles} />
          </InputRow>
        </Section>
        <Section title="Style">
          <InputRow label="Couleur texte">
            <input type="color" value={config.colors.northText} onChange={(e) => handleColorChange('northText', e.target.value)} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
          <InputRow label="Couleur flèche">
            <input type="color" value={config.colors.northArrow} onChange={(e) => handleColorChange('northArrow', e.target.value)} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
          <InputRow label="Police">
            <select value={config.fontFamily} onChange={(e) => onUpdateConfig({ fontFamily: e.target.value })} className={selectStyles}>
              {['Inter, system-ui, sans-serif', 'Roboto, system-ui, sans-serif', 'Open Sans, system-ui, sans-serif', 'Merriweather, Georgia, serif'].map((f) => <option key={f} value={f}>{f.split(',')[0]}</option>)}
            </select>
          </InputRow>
          <InputRow label="Poids">
            <select value={config.textTypography.north.fontWeight} onChange={(e) => onUpdateConfig({ textTypography: { ...config.textTypography, north: { ...config.textTypography.north, fontWeight: parseInt(e.target.value) } } })} className={selectStyles}>
              {[400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </InputRow>
        </Section>
      </div>
    );
  }

  if (target.kind === 'start') {
    const override = config.pageStartOverrides[target.colKey];
    const isFirstSection = column?.globalSectionNumber === 1;
    const displayLabel = override ?? (isFirstSection ? config.startLabel : column?.startLabel ?? 'DÉPART');

    return (
      <div className="fixed z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Départ / Suite</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <Section title="Contenu">
          <InputRow label="Étiquette">
            <input
              type="text"
              value={override ?? ''}
              onChange={(e) => {
                const val = e.target.value.trim();
                const next = { ...config.pageStartOverrides };
                if (!val) delete next[target.colKey];
                else next[target.colKey] = val;
                onUpdateConfig({ pageStartOverrides: next });
              }}
              className={inputStyles}
              placeholder={isFirstSection ? config.startLabel : `Suite p.${column?.pageNumber ?? 1}`}
            />
          </InputRow>
          <InputRow label="Mode suite">
            <select value={config.subsequentStartMode} onChange={(e) => onUpdateConfig({ subsequentStartMode: e.target.value as any })} className={selectStyles}>
              {SUBSEQUENT_START_MODES.map((m) => <option key={m} value={m}>{m === 'repeat-start' ? 'Répéter départ' : 'Suite'}</option>)}
            </select>
          </InputRow>
          <InputRow label="Modèle suite">
            <input type="text" value={config.suiteTemplate} onChange={(e) => onUpdateConfig({ suiteTemplate: e.target.value })} className={inputStyles} />
          </InputRow>
        </Section>
        <Section title="Style">
          <InputRow label="Couleur">
            <input type="color" value={config.colors.startText} onChange={(e) => handleColorChange('startText', e.target.value)} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
          <InputRow label="Police">
            <select value={config.fontFamily} onChange={(e) => onUpdateConfig({ fontFamily: e.target.value })} className={selectStyles}>
              {['Inter, system-ui, sans-serif', 'Roboto, system-ui, sans-serif', 'Merriweather, Georgia, serif'].map((f) => <option key={f} value={f}>{f.split(',')[0]}</option>)}
            </select>
          </InputRow>
          <InputRow label="Poids">
            <select value={config.textTypography.start.fontWeight} onChange={(e) => onUpdateConfig({ textTypography: { ...config.textTypography, start: { ...config.textTypography.start, fontWeight: parseInt(e.target.value) } } })} className={selectStyles}>
              {[400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </InputRow>
        </Section>
        <Section title="Visibilité globale">
          <InputRow label="Afficher départ">
            <input type="checkbox" checked={config.showStart} onChange={(e) => onUpdateConfig({ showStart: e.target.checked })} />
          </InputRow>
        </Section>
      </div>
    );
  }

  if (target.kind === 'flow-connector') {
    return (
      <div className="fixed z-50 w-[320px] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Connecteur de lecture</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <Section title="Général">
          <InputRow label="Activé">
            <input type="checkbox" checked={config.flowConnector.enabled} onChange={(e) => handleFlowChange('enabled', e.target.checked)} />
          </InputRow>
        </Section>
        <Section title="Forme">
          <InputRow label="Type">
            <select value={config.flowConnector.shape} onChange={(e) => handleFlowChange('shape', e.target.value as any)} className={selectStyles}>
              {FLOW_CONNECTOR_SHAPES.map((s) => <option key={s} value={s}>{s === 'stepped' ? 'Échelons' : s === 'curved' ? 'Courbe' : 'Diagonale'}</option>)}
            </select>
          </InputRow>
          <InputRow label="Ligne">
            <select value={config.flowConnector.lineStyle} onChange={(e) => handleFlowChange('lineStyle', e.target.value as any)} className={selectStyles}>
              {FLOW_CONNECTOR_LINE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </InputRow>
          <InputRow label="Épaisseur">
            <input type="number" min="0.3" max="3" step="0.1" value={config.flowConnector.strokeWidth} onChange={(e) => handleFlowChange('strokeWidth', parseFloat(e.target.value))} className={inputStyles} />
          </InputRow>
          <InputRow label="Couleur">
            <input type="color" value={config.flowConnector.color} onChange={(e) => handleFlowChange('color', e.target.value)} className="w-10 h-6 p-0 border-0 cursor-pointer" />
          </InputRow>
        </Section>
        <Section title="Flèche">
          <InputRow label="Afficher">
            <input type="checkbox" checked={config.flowConnector.showArrow} onChange={(e) => handleFlowChange('showArrow', e.target.checked)} />
          </InputRow>
          <InputRow label="Taille">
            <input type="number" min="2" max="16" value={config.flowConnector.arrowSize} onChange={(e) => handleFlowChange('arrowSize', parseInt(e.target.value))} className={inputStyles} />
          </InputRow>
        </Section>
        <Section title="Étiquette">
          <InputRow label="Afficher">
            <input type="checkbox" checked={config.flowConnector.showLabel} onChange={(e) => handleFlowChange('showLabel', e.target.checked)} />
          </InputRow>
          <InputRow label="Texte">
            <input type="text" value={config.flowConnector.labelText} onChange={(e) => handleFlowChange('labelText', e.target.value)} className={inputStyles} />
          </InputRow>
          <InputRow label="Taille">
            <input type="number" min="4" max="16" value={config.flowConnector.labelFontSize} onChange={(e) => handleFlowChange('labelFontSize', parseInt(e.target.value))} className={inputStyles} />
          </InputRow>
        </Section>
      </div>
    );
  }

  return null;
}
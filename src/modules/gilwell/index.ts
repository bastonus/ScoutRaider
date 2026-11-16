/**
 * Gilwell Module — Public API
 * Independent, importable WYSIWYG Gilwell editor module for ScoutRaider.
 *
 * This module is self-contained with zero external dependencies beyond React.
 * All styling is provided by the host app via Tailwind classes passed as props.
 */

// ── Types ──────────────────────────────────────────────────────────────────────
export type {
  PageFormat,
  PageFormatSpec,
  PreviewSurface,
  NumberingFormat,
  NumberingPosition,
  NumberingBadgeShape,
  AxisLineStyle,
  FlowConnectorShape,
  NodeStyle,
  GilwellStep,
  ScoutRaiderPolySegment,
  GilwellColorConfig,
  GilwellArrowStyle,
  GilwellNumberingConfig,
  GilwellAxisConfig,
  GilwellFlowConnectorConfig,
  TextTypeTypography,
  GilwellTextTypographyMap,
  SubsequentStartMode,
  ReadingDirection,
  FontSizeMode,
  GilwellConfig,
  ComputedStepLayout,
  ComputedGilwellColumn,
  ComputedGilwellPage,
  SelectedElementTarget,
  GilwellSheetProps,
  StepSidebarProps,
  DataTableViewProps,
  ScoutRaiderIntegrationViewProps,
  ExportModalProps,
  ElementInspectorPopoverProps,
} from './logic/types';

// ── Logic ──────────────────────────────────────────────────────────────────────
export {
  GilwellEngine,
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
  DEFAULT_GILWELL_CONFIG,
  createDefaultGilwellConfig,
  stepsToPolySegments,
  polySegmentsToSteps,
  formatStepText,
  getBadgePolygonPoints,
  getStrokeDashArray,
} from './logic/GilwellEngine';

export {
  triggerFileDownload,
  downloadSvgPage,
  renderSvgToPngBlob,
  downloadPngPage,
} from './logic/gilwellExport';

// ── Components ─────────────────────────────────────────────────────────────────
export { default as GilwellSheet } from './components/GilwellSheet';
export { default as StepSidebar } from './components/StepSidebar';
export { default as DataTableView } from './components/DataTableView';
export { default as ScoutRaiderIntegrationView } from './components/ScoutRaiderIntegrationView';
export { default as ExportModal } from './components/ExportModal';
export { default as ElementInspectorPopover } from './components/ElementInspectorPopover';

// ── Module Metadata ────────────────────────────────────────────────────────────
export const GILWELL_MODULE_METADATA = {
  id: 'gilwell',
  name: 'Gilwell',
  category: 'graphic' as const,
  type: 'visual' as const,
  defaultAnnexe: 'alphabet_gilwell',
  description: 'Éditeur WYSIWYG de schémas d\'azimuts (piste Gilwell) avec pagination multi-colonnes, connecteurs de lecture, export SVG/PNG 300 DPI.',
  version: '2.0.0',
  capabilities: {
    wysiwyg: true,
    inPlaceEditing: true,
    dragRotate: true,
    multiColumn: true,
    pagination: true,
    flowConnectors: true,
    svgExport: true,
    pngExport: true,
    scoutRaiderSync: true,
    contextualInspectors: true,
    dataTableView: true,
    importExport: true,
  },
} as const;

// ── Default Config Factory ─────────────────────────────────────────────────────
import type { GilwellConfig } from './logic/types';
import { DEFAULT_GILWELL_CONFIG } from './logic/GilwellEngine';

export function createGilwellConfig(overrides: Partial<GilwellConfig> = {}): GilwellConfig {
  return { ...DEFAULT_GILWELL_CONFIG, ...overrides };
}

// ── Version ────────────────────────────────────────────────────────────────────
export const VERSION = '2.0.0';
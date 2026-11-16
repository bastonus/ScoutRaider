/**
 * Gilwell Module — Type Definitions
 * Independent, zero-dependency types for the Gilwell WYSIWYG editor.
 * Uses only standard TypeScript — no external deps, no app-specific imports.
 */

export type PageFormat =
  | 'A3'
  | 'A4'
  | 'A4-landscape'
  | 'A5'
  | 'A5-landscape'
  | 'A6'
  | 'scout-pocket'
  | 'letter'
  | 'square-20'
  | 'infinite'
  | 'custom';

export interface PageFormatSpec {
  id: PageFormat;
  label: string;
  widthCm: number;
  heightCm: number;
  isInfinite: boolean;
  description: string;
}

export type PreviewSurface = 'paper' | 'transparent-light' | 'transparent-dark';

export type NumberingFormat = 'arabic' | 'alpha-upper' | 'alpha-lower' | 'roman';
export type NumberingPosition = 'auto' | 'left' | 'right';
export type NumberingBadgeShape =
  | 'none'
  | 'circle'
  | 'rounded'
  | 'square'
  | 'diamond'
  | 'hexagon';

export type AxisLineStyle =
  | 'dashed'
  | 'dotted'
  | 'solid'
  | 'dash-dot'
  | 'long-dash'
  | 'double';

export type FlowConnectorShape = 'stepped' | 'curved' | 'diagonal';

export type NodeStyle = 'circle' | 'ring' | 'diamond' | 'square' | 'none';

export interface GilwellStep {
  id: string;
  azimut: number;
  distance: number;
  /** Optional user override typed directly in place on the WYSIWYG sheet */
  customText?: string;
  /** Optional custom numbering label override (e.g. "1bis", "A1") */
  customNumber?: string;
  /** Optional per-step arrow color override */
  customColor?: string;
  /** Optional per-step label color override */
  customTextColor?: string;
}

/** Compatible with ScoutRaider's PolySegment interface (src/logic/types.ts) */
export interface ScoutRaiderPolySegment {
  azimut: number;
  distance: number;
  coords?: [number, number][];
  properties?: {
    azimut: number;
    metrage: number;
    coords_intersection?: [number, number];
    start_idx?: number;
    point_idx?: number;
  };
  leg_key?: string;
  assigned_module?: string;
  poi?: { name: string; type: string; distance_m: number } | null;
}

export interface GilwellColorConfig {
  textMain: string;
  axisLine: string;
  arrowFill: string;
  arrowEdge: string;
  startText: string;
  northText: string;
  northArrow: string;
}

export interface GilwellArrowStyle {
  length: number;       // in cm (default 2.6)
  strokeWidth: number;  // shaft thickness
  headWidth: number;    // arrowhead width
  headLength: number;   // arrowhead length
}

export interface GilwellNumberingConfig {
  enabled: boolean;
  format: NumberingFormat;
  startAt: number;
  prefix: string;
  suffix: string;
  position: NumberingPosition;
  badgeShape: NumberingBadgeShape;
  badgeFilled: boolean;
  badgeBorderColor: string;
  badgeFillColor: string;
  badgeBorderWidth: number;
  offsetCm: number;
  fontSize: number;
  color: string;
}

export interface GilwellAxisConfig {
  visible: boolean;
  lineStyle: AxisLineStyle;
  strokeWidth: number;
  color: string;
  nodeStyle: NodeStyle;
  nodeSize: number;
  nodeColor: string;
}

export interface GilwellFlowConnectorConfig {
  enabled: boolean;
  shape: FlowConnectorShape;
  lineStyle: Exclude<AxisLineStyle, 'double'>;
  strokeWidth: number;
  color: string;
  showArrow: boolean;
  arrowSize: number;
  showLabel: boolean;
  labelText: string; // e.g. "{from} → {to}"
  labelFontSize: number;
}

export interface TextTypeTypography {
  fontFamily?: string; // undefined = inherits global config.fontFamily
  fontWeight: number;
}

export interface GilwellTextTypographyMap {
  step: TextTypeTypography;
  north: TextTypeTypography;
  start: TextTypeTypography;
  number: TextTypeTypography;
  flow: TextTypeTypography;
}

export type SubsequentStartMode = 'repeat-start' | 'suite';
export type ReadingDirection = 'ltr' | 'rtl';
export type FontSizeMode = 'auto' | 'fixed';

export interface GilwellConfig {
  pageFormat: PageFormat;
  customWidthCm: number;
  customHeightCm: number;
  columnsPerPage: number;       // 1, 2, 3, 4, 5, 6 axes side-by-side
  readingDirection: ReadingDirection;
  autoFitColumns: boolean;
  showColumnDividers: boolean;
  columnDividerColor: string;
  avoidCenterAxisText: boolean; // push near-vertical arrow labels left/right off center line
  flowConnector: GilwellFlowConnectorConfig;
  pageMarginTopCm: number;      // top page margin in cm
  pageMarginBottomCm: number;   // bottom page margin in cm
  pageMarginXCm: number;        // left & right page margins in cm
  columnGapCm: number;          // gap between side-by-side SVGs/columns in cm
  compactLastPage: boolean;     // shrink the last SVG tightly to its content (default false)
  densityLimit: number;         // max steps per cm (optional ceiling)
  margin: number;               // safety spacing in cm between consecutive steps
  stepTextTemplate: string;     // e.g. "{azimut}° sur {distance}m"
  showNorth: boolean;
  northLabel: string;           // default "NORD"
  showStart: boolean;
  startLabel: string;           // default "DÉPART"
  subsequentStartMode: SubsequentStartMode;
  suiteTemplate: string;        // e.g. "SUITE (p. {page})" or "{start} ({firstStep}–{lastStep})"
  pageStartOverrides: Record<string, string>; // key: "p1-c1", "p1-c2", "p2-c1", ...
  wrapWidth: number;            // max characters per line
  transparentBackground: boolean;
  responsiveDarkModeSvg: boolean;
  fontFamily: string;
  fontSizeMode: FontSizeMode;
  fontSizeBase: number;
  fontSizeTitle: number;
  fontSizeStart: number;
  textTypography: GilwellTextTypographyMap;
  colors: GilwellColorConfig;
  arrow: GilwellArrowStyle;
  numbering: GilwellNumberingConfig;
  axis: GilwellAxisConfig;
}

export interface ComputedStepLayout {
  step: GilwellStep;
  originalIndex: number;
  displayNumber: string;
  /** Logical math Y in cm from bottom */
  mathY: number;
  /** Arrow delta in cm (math coordinates: +dx right, +dy up) */
  dx: number;
  dy: number;
  /** SVG coordinates (origin top-left, scaled by PX_PER_CM) */
  svgX0: number;
  svgY0: number;
  svgX1: number;
  svgY1: number;
  /** Number label anchor position in SVG coordinates */
  numX: number;
  numY: number;
  numAnchor: 'start' | 'middle' | 'end';
  /** Text anchor position in SVG coordinates */
  textX: number;
  textY: number;
  textAnchor: 'start' | 'middle' | 'end';
  dominantBaseline: 'auto' | 'middle' | 'hanging';
  lines: string[];
  rawText: string;
}

export interface ComputedGilwellColumn {
  colIndex: number;       // 0-based visual index (left to right)
  readingOrderIndex: number; // 1-based reading order on this page
  globalSectionNumber: number; // 1-based reading order across all pages
  startKey: string;       // e.g. "p1-c1"
  axisX: number;
  colLeftX: number;
  colRightX: number;
  axisTopY: number;
  axisBottomY: number;
  northArrowTipY: number;
  northTextY: number;
  startTextY: number;
  startLabel: string;
  firstStepLabel: string;
  lastStepLabel: string;
  fontScale: number;
  formatConventionPt: number;
  effectiveFontSizeBase: number;
  effectiveFontSizeTitle: number;
  effectiveFontSizeStart: number;
  effectiveNumberingFontSize: number;
  effectiveFlowLabelFontSize: number;
  effectiveWrapWidth: number;
  steps: ComputedStepLayout[];
}

export interface ComputedGilwellPage {
  pageNumber: number;
  totalPages: number;
  widthCm: number;
  heightCm: number;
  viewBoxWidth: number;
  viewBoxHeight: number;
  columns: ComputedGilwellColumn[];
  /** Flattened steps across all columns on this page */
  steps: ComputedStepLayout[];
}

export type SelectedElementTarget =
  | { kind: 'axis'; colKey: string; xPct: number; yPct: number; pageNumber: number }
  | { kind: 'north'; colKey: string; xPct: number; yPct: number; pageNumber: number }
  | { kind: 'start'; colKey: string; xPct: number; yPct: number; pageNumber: number }
  | { kind: 'flow-connector'; xPct: number; yPct: number; pageNumber: number }
  | { kind: 'step-arrow'; stepId: string; xPct: number; yPct: number; pageNumber: number }
  | { kind: 'step-number'; stepId: string; xPct: number; yPct: number; pageNumber: number }
  | { kind: 'step-text'; stepId: string; xPct: number; yPct: number; pageNumber: number };

/** Props for the main WYSIWYG sheet component */
export interface GilwellSheetProps {
  page: ComputedGilwellPage;
  config: GilwellConfig;
  surface: PreviewSurface;
  zoom: number;
  selectedStepId: string | null;
  selectedElement: SelectedElementTarget | null;
  onSelectElement: (target: SelectedElementTarget | null) => void;
  onSelectStep: (id: string | null) => void;
  onUpdateStep: (id: string, patch: Partial<GilwellStep>) => void;
  onUpdateConfig: (patch: Partial<GilwellConfig>) => void;
  onAddStepAfter: (afterId: string) => void;
  onDeleteStep: (id: string) => void;
}

/** Props for the step sidebar panel */
export interface StepSidebarProps {
  steps: GilwellStep[];
  config: GilwellConfig;
  resolvedTypography?: {
    conventionPt: number;
    base: number;
    title: number;
    start: number;
    num: number;
    flow: number;
    wrap: number;
  };
  selectedStepId: string | null;
  onSelectStep: (id: string) => void;
  onUpdateStep: (id: string, patch: Partial<GilwellStep>) => void;
  onAddStep: () => void;
  onDeleteStep: (id: string) => void;
  onMoveStep: (id: string, dir: -1 | 1) => void;
  onImportSteps: (steps: GilwellStep[]) => void;
  onResetAll: () => void;
  onUpdateConfig: (patch: Partial<GilwellConfig>) => void;
}

/** Props for the data table view */
export interface DataTableViewProps {
  steps: GilwellStep[];
  config: GilwellConfig;
  onUpdateStep: (id: string, patch: Partial<GilwellStep>) => void;
  onAddStep: () => void;
  onDeleteStep: (id: string) => void;
}

/** Props for the ScoutRaider integration view */
export interface ScoutRaiderIntegrationViewProps {
  steps: GilwellStep[];
  config: GilwellConfig;
}

/** Props for the export modal */
export interface ExportModalProps {
  pages: ComputedGilwellPage[];
  config: GilwellConfig;
  onClose: () => void;
}

/** Props for the element inspector popover */
export interface ElementInspectorPopoverProps {
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
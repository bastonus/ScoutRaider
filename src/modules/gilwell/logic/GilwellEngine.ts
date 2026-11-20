/**
 * Gilwell Module — Core Layout & Rendering Engine
 * Pure TypeScript, zero dependencies, fully self-contained.
 * No CSS, no React — just math and SVG string generation.
 */

import type {
  AxisLineStyle,
  ComputedGilwellColumn,
  ComputedGilwellPage,
  ComputedStepLayout,
  GilwellConfig,
  GilwellNumberingConfig,
  GilwellStep,
  NumberingBadgeShape,
  NumberingFormat,
  NumberingPosition,
  PageFormat,
  PageFormatSpec,
  ScoutRaiderPolySegment,
  FlowConnectorShape,
  NodeStyle,
  SubsequentStartMode,
  ReadingDirection,
  FontSizeMode,
} from './types';

export const PX_PER_CM = 38;

export const FONT_FAMILY_OPTIONS: { id: string; label: string }[] = [
  { id: 'Plus Jakarta Sans, sans-serif', label: 'Moderne (Jakarta Sans)' },
  { id: 'Arial, Helvetica, sans-serif', label: 'Classique (Arial)' },
  { id: 'Georgia, Cambria, serif', label: 'Éditorial (Georgia)' },
  { id: '"Trebuchet MS", sans-serif', label: 'Carnet Scout (Trebuchet)' },
  { id: 'JetBrains Mono, monospace', label: 'Technique (JetBrains Mono)' },
  { id: '"Courier New", Courier, monospace', label: 'Machine (Courier)' },
];

export const PAGE_FORMATS: PageFormatSpec[] = [
  { id: 'A4', label: 'A4 Portrait', widthCm: 21.0, heightCm: 29.7, isInfinite: false, description: '21,0 × 29,7 cm' },
  { id: 'A4-landscape', label: 'A4 Paysage', widthCm: 29.7, heightCm: 21.0, isInfinite: false, description: '29,7 × 21,0 cm' },
  { id: 'A5', label: 'A5 Portrait', widthCm: 14.8, heightCm: 21.0, isInfinite: false, description: '14,8 × 21,0 cm' },
  { id: 'A5-landscape', label: 'A5 Paysage', widthCm: 21.0, heightCm: 14.8, isInfinite: false, description: '21,0 × 14,8 cm' },
  { id: 'A6', label: 'A6 Carte', widthCm: 10.5, heightCm: 14.8, isInfinite: false, description: '10,5 × 14,8 cm' },
  { id: 'A3', label: 'A3 Portrait', widthCm: 29.7, heightCm: 42.0, isInfinite: false, description: '29,7 × 42,0 cm' },
  { id: 'scout-pocket', label: 'Carnet Scout', widthCm: 12.0, heightCm: 18.0, isInfinite: false, description: '12,0 × 18,0 cm' },
  { id: 'letter', label: 'US Letter', widthCm: 21.6, heightCm: 27.9, isInfinite: false, description: '21,6 × 27,9 cm' },
  { id: 'square-20', label: 'Carré 20×20', widthCm: 20.0, heightCm: 20.0, isInfinite: false, description: '20,0 × 20,0 cm' },
  { id: 'infinite', label: 'Continu (Infini)', widthCm: 21.0, heightCm: 29.7, isInfinite: true, description: 'Hauteur auto' },
  { id: 'custom', label: 'Personnalisé', widthCm: 18.0, heightCm: 24.0, isInfinite: false, description: 'Sur mesure' },
];

/** Standard editorial/cartographic base body font size (pt) per paper format */
export function getFormatConventionPt(
  fmt: PageFormat,
  widthCm: number,
  heightCm: number
): number {
  switch (fmt) {
    case 'A3':
      return 14;
    case 'A4':
    case 'A4-landscape':
    case 'letter':
    case 'square-20':
    case 'infinite':
      return 12;
    case 'A5':
    case 'A5-landscape':
    case 'scout-pocket':
      return 10;
    case 'A6':
      return 8.5;
    case 'custom': {
      const minDim = Math.min(widthCm, heightCm);
      return Number(Math.max(8, Math.min(16, (minDim / 21.0) * 12)).toFixed(1));
    }
    default:
      return 12;
  }
}

/** Exact 20 sample steps from path_to_gilwell.py */
export const DEFAULT_GILWELL_STEPS: GilwellStep[] = [
  { id: 'step-1', azimut: 265, distance: 403 },
  { id: 'step-2', azimut: 329, distance: 250 },
  { id: 'step-3', azimut: 39, distance: 18 },
  { id: 'step-4', azimut: 36, distance: 893 },
  { id: 'step-5', azimut: 6, distance: 542 },
  { id: 'step-6', azimut: 180, distance: 899 },
  { id: 'step-7', azimut: 147, distance: 1272 },
  { id: 'step-8', azimut: 116, distance: 1339 },
  { id: 'step-9', azimut: 96, distance: 290 },
  { id: 'step-10', azimut: 172, distance: 146 },
  { id: 'step-11', azimut: 114, distance: 1193 },
  { id: 'step-12', azimut: 71, distance: 2038 },
  { id: 'step-13', azimut: 89, distance: 980 },
  { id: 'step-14', azimut: 2, distance: 308 },
  { id: 'step-15', azimut: 350, distance: 186 },
  { id: 'step-16', azimut: 10, distance: 600 },
  { id: 'step-17', azimut: 344, distance: 279 },
  { id: 'step-18', azimut: 33, distance: 69 },
  { id: 'step-19', azimut: 71, distance: 931 },
  { id: 'step-20', azimut: 341, distance: 589 },
];

export const AXIS_LINE_STYLES: AxisLineStyle[] = ['dashed', 'dotted', 'solid', 'dash-dot', 'long-dash', 'double'];
export const NODE_STYLES: NodeStyle[] = ['circle', 'ring', 'diamond', 'square', 'none'];
export const FLOW_CONNECTOR_SHAPES: FlowConnectorShape[] = ['stepped', 'curved', 'diagonal'];
export const FLOW_CONNECTOR_LINE_STYLES: Exclude<AxisLineStyle, 'double'>[] = ['dashed', 'dotted', 'solid', 'dash-dot', 'long-dash'];
export const NUMBERING_FORMATS: NumberingFormat[] = ['arabic', 'alpha-upper', 'alpha-lower', 'roman'];
export const NUMBERING_POSITIONS: NumberingPosition[] = ['auto', 'left', 'right'];
export const NUMBERING_BADGE_SHAPES: NumberingBadgeShape[] = ['none', 'circle', 'rounded', 'square', 'diamond', 'hexagon'];
export const SUBSEQUENT_START_MODES: SubsequentStartMode[] = ['repeat-start', 'suite'];
export const READING_DIRECTIONS: ReadingDirection[] = ['ltr', 'rtl'];
export const FONT_SIZE_MODES: FontSizeMode[] = ['auto', 'fixed'];

export const stepsToPolySegments = (steps: GilwellStep[]) => GilwellEngine.toPolySegments(steps);
export const polySegmentsToSteps = (segments: ScoutRaiderPolySegment[]) => GilwellEngine.fromPolySegments(segments);
export const createDefaultGilwellConfig = (overrides?: Partial<GilwellConfig>): GilwellConfig => ({
  ...DEFAULT_GILWELL_CONFIG,
  ...overrides,
});

export const DEFAULT_GILWELL_CONFIG: GilwellConfig = {
  pageFormat: 'A4',
  customWidthCm: 18.0,
  customHeightCm: 24.0,
  columnsPerPage: 2,
  readingDirection: 'ltr',
  autoFitColumns: true,
  showColumnDividers: false,
  columnDividerColor: '#CBD5E1',
  avoidCenterAxisText: true,
  flowConnector: {
    enabled: true,
    shape: 'curved',
    lineStyle: 'dotted',
    strokeWidth: 1.5,
    color: '#64748B',
    showArrow: true,
    arrowSize: 8,
    showLabel: false,
    labelText: '{from} → {to}',
    labelFontSize: 10,
  },
  pageMarginTopCm: 1.0,
  pageMarginBottomCm: 1.0,
  pageMarginXCm: 1.0,
  columnGapCm: 0.8,
  compactLastPage: false,
  densityLimit: 0.5,
  margin: 1.8,
  stepTextTemplate: '{azimut}° sur {distance}m',
  showNorth: true,
  northLabel: 'NORD',
  showStart: true,
  startLabel: 'DÉPART',
  subsequentStartMode: 'repeat-start',
  suiteTemplate: 'SUITE ({firstStep}–{lastStep})',
  pageStartOverrides: {},
  wrapWidth: 20,
  transparentBackground: true,
  responsiveDarkModeSvg: true,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
  fontSizeMode: 'auto',
  fontSizeBase: 12,
  fontSizeTitle: 15,
  fontSizeStart: 12,
  textTypography: {
    step: { fontWeight: 400 },
    north: { fontWeight: 700 },
    start: { fontWeight: 700 },
    number: { fontWeight: 700 },
    flow: { fontWeight: 700 },
  },
  colors: {
    textMain: '#0F172A',
    axisLine: '#0F172A',
    arrowFill: '#0F172A',
    arrowEdge: '#0F172A',
    startText: '#0F172A',
    northText: '#0F172A',
    northArrow: '#0F172A',
  },
  arrow: {
    length: 2.6,
    strokeWidth: 2.5,
    headWidth: 10.0,
    headLength: 8.0,
  },
  numbering: {
    enabled: true,
    format: 'arabic',
    startAt: 1,
    prefix: '',
    suffix: '',
    position: 'auto',
    badgeShape: 'circle',
    badgeFilled: false,
    badgeBorderColor: '#0F172A',
    badgeFillColor: '#ECFDF5',
    badgeBorderWidth: 1.3,
    offsetCm: 0.55,
    fontSize: 11,
    color: '#0F172A',
  },
  axis: {
    visible: true,
    lineStyle: 'long-dash',
    strokeWidth: 1.6,
    color: '#0F172A',
    nodeStyle: 'circle',
    nodeSize: 4.5,
    nodeColor: '#0F172A',
  },
};

export function toRoman(num: number): string {
  if (num <= 0) return String(num);
  const map: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let n = Math.floor(num);
  let res = '';
  for (const [val, sym] of map) {
    while (n >= val) {
      res += sym;
      n -= val;
    }
  }
  return res;
}

export function toAlpha(num: number, upper: boolean): string {
  if (num <= 0) return String(num);
  let n = Math.floor(num);
  let res = '';
  while (n > 0) {
    n--;
    res = String.fromCharCode((upper ? 65 : 97) + (n % 26)) + res;
    n = Math.floor(n / 26);
  }
  return res;
}

export function formatNumberToken(
  indexZeroBased: number,
  numbering: GilwellNumberingConfig,
  customNumber?: string
): string {
  if (customNumber !== undefined && customNumber !== '') {
    return customNumber;
  }
  const n = numbering.startAt + indexZeroBased;
  let core: string;
  const fmt: NumberingFormat = numbering.format;
  if (fmt === 'roman') core = toRoman(n);
  else if (fmt === 'alpha-upper') core = toAlpha(n, true);
  else if (fmt === 'alpha-lower') core = toAlpha(n, false);
  else core = String(n);

  return `${numbering.prefix}${core}${numbering.suffix}`;
}

export function getStrokeDashArray(style: AxisLineStyle, strokeWidth: number): string | undefined {
  const sw = Math.max(1, strokeWidth);
  switch (style) {
    case 'solid':
    case 'double':
      return undefined;
    case 'dashed':
      return `${(sw * 4).toFixed(1)} ${(sw * 3).toFixed(1)}`;
    case 'long-dash':
      return `${(sw * 8).toFixed(1)} ${(sw * 4).toFixed(1)}`;
    case 'dotted':
      return `1.5 ${(sw * 3.2).toFixed(1)}`;
    case 'dash-dot':
      return `${(sw * 5.5).toFixed(1)} ${(sw * 2.5).toFixed(1)} 1.5 ${(sw * 2.5).toFixed(1)}`;
    default:
      return '6 5';
  }
}

export function getBadgePolygonPoints(
  cx: number,
  cy: number,
  r: number,
  shape: Exclude<NumberingBadgeShape, 'none' | 'circle' | 'rounded' | 'square'>
): string {
  if (shape === 'diamond') {
    const d = r * 1.18;
    return `${cx.toFixed(1)},${(cy - d).toFixed(1)} ${(cx + d).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(cy + d).toFixed(1)} ${(cx - d).toFixed(1)},${cy.toFixed(1)}`;
  }
  // hexagon
  const hr = r * 1.12;
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${(cx + Math.cos(ang) * hr).toFixed(1)},${(cy + Math.sin(ang) * hr).toFixed(1)}`);
  }
  return pts.join(' ');
}

export function wrapText(text: string, width: number): string[] {
  const safeWidth = Math.max(6, width);
  const paragraphs = text.split('\n');
  const allLines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      allLines.push('');
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const nextWord = words[i];
      if (currentLine.length + 1 + nextWord.length <= safeWidth) {
        currentLine += ' ' + nextWord;
      } else {
        allLines.push(currentLine);
        currentLine = nextWord;
      }
    }
    allLines.push(currentLine);
  }

  return allLines.length > 0 ? allLines : [''];
}

export function formatStepText(step: GilwellStep, template: string): string {
  if (step.customText !== undefined && step.customText !== '') {
    return step.customText;
  }
  return template
    .replace(/\{azimut\}/gi, String(Math.round(step.azimut)))
    .replace(/\{distance\}/gi, String(Math.round(step.distance)));
}

export function resolveSmartStartText(
  rawTemplate: string,
  ctx: {
    start: string;
    page: number;
    totalPages: number;
    col: number;
    globalCol: number;
    firstStep: string;
    lastStep: string;
  }
): string {
  return rawTemplate
    .replace(/\{start\}/gi, ctx.start)
    .replace(/\{page\}/gi, String(ctx.page))
    .replace(/\{totalPages\}/gi, String(ctx.totalPages))
    .replace(/\{col\}/gi, String(ctx.col))
    .replace(/\{globalCol\}/gi, String(ctx.globalCol))
    .replace(/\{firstStep\}/gi, ctx.firstStep)
    .replace(/\{lastStep\}/gi, ctx.lastStep);
}

export function getPageDimensions(
  fmt: PageFormat,
  config: GilwellConfig
): { widthCm: number; heightCm: number; isInfinite: boolean } {
  if (fmt === 'custom') {
    return {
      widthCm: Math.max(8, Math.min(60, config.customWidthCm || 18)),
      heightCm: Math.max(8, Math.min(80, config.customHeightCm || 24)),
      isInfinite: false,
    };
  }
  const spec = PAGE_FORMATS.find((f) => f.id === fmt) || PAGE_FORMATS[0];
  return {
    widthCm: spec.widthCm,
    heightCm: spec.heightCm,
    isInfinite: spec.isInfinite,
  };
}

export class GilwellEngine {
  static fromPolySegments(segments: ScoutRaiderPolySegment[]): GilwellStep[] {
    return segments.map((seg, idx) => ({
      id: `seg-${idx + 1}`,
      azimut: Math.round(seg.azimut ?? 0),
      distance: Math.round(seg.distance ?? 0),
    }));
  }

  static toPolySegments(steps: GilwellStep[]): ScoutRaiderPolySegment[] {
    return steps.map((step, idx) => ({
      azimut: step.azimut,
      distance: step.distance,
      coords: [],
      assigned_module: 'gilwell',
      properties: {
        azimut: step.azimut,
        metrage: step.distance,
        start_idx: idx,
        point_idx: idx + 1,
      },
    }));
  }

  private static getVector(step: GilwellStep, arrowLen: number) {
    const rad = (step.azimut * Math.PI) / 180;
    return {
      dx: Math.sin(rad) * arrowLen,
      dy: Math.cos(rad) * arrowLen,
    };
  }

  private static getColumnMetrics(
    widthCm: number,
    heightCm: number,
    config: GilwellConfig
  ) {
    const cols = Math.max(1, Math.min(6, Math.round(config.columnsPerPage || 1)));
    const marginX = Math.max(0, Math.min(widthCm * 0.25, config.pageMarginXCm ?? 1.0));
    const colGap = cols > 1 ? Math.max(0, Math.min(6, config.columnGapCm ?? 0.8)) : 0;
    const usableWidthCm = Math.max(4, widthCm - marginX * 2 - colGap * (cols - 1));
    const colWidthCm = usableWidthCm / cols;
    const autoFit = config.autoFitColumns && cols > 1;
    const isAutoFont = (config.fontSizeMode ?? 'auto') === 'auto';

    const arrowLen = autoFit
      ? Math.min(config.arrow.length, Math.max(0.85, colWidthCm * 0.24))
      : Math.max(0.8, config.arrow.length);

    const formatConventionPt = getFormatConventionPt(
      config.pageFormat,
      widthCm,
      heightCm
    );

    let effectiveFontSizeBase: number;
    let effectiveFontSizeTitle: number;
    let effectiveFontSizeStart: number;
    let effectiveNumberingFontSize: number;
    let effectiveFlowLabelFontSize: number;
    let fontScale: number;

    if (isAutoFont) {
      const colFactor =
        cols === 1
          ? 1.0
          : cols === 2
            ? 0.88
            : cols === 3
              ? 0.78
              : cols === 4
                ? 0.7
                : cols === 5
                  ? 0.64
                  : 0.58;
      // Scale smoothly according to paper format convention (12pt on A4) and column division
      const baseRefRatio = Math.max(0.7, Math.min(1.5, (config.fontSizeBase || 12) / 12));
      const titleRefRatio = Math.max(0.7, Math.min(1.6, (config.fontSizeTitle || 15) / 12));
      const startRefRatio = Math.max(0.7, Math.min(1.6, (config.fontSizeStart || 12) / 12));
      const numRefRatio = Math.max(0.65, Math.min(1.5, (config.numbering.fontSize || 11) / 12));
      const flowRefRatio = Math.max(0.6, Math.min(1.4, (config.flowConnector.labelFontSize || 10) / 12));

      const rawBase = formatConventionPt * colFactor;
      effectiveFontSizeBase = Number(
        Math.max(6.8, Math.min(18.0, rawBase * baseRefRatio)).toFixed(1)
      );
      effectiveFontSizeTitle = Number(
        Math.max(8.0, Math.min(24.0, rawBase * titleRefRatio)).toFixed(1)
      );
      effectiveFontSizeStart = Number(
        Math.max(7.0, Math.min(20.0, rawBase * startRefRatio)).toFixed(1)
      );
      effectiveNumberingFontSize = Number(
        Math.max(6.5, Math.min(18.0, rawBase * numRefRatio)).toFixed(1)
      );
      effectiveFlowLabelFontSize = Number(
        Math.max(6.5, Math.min(16.0, rawBase * flowRefRatio)).toFixed(1)
      );
      fontScale = Number((effectiveFontSizeBase / 12.0).toFixed(3));
    } else {
      effectiveFontSizeBase = Math.max(6, Math.min(32, config.fontSizeBase || 12));
      effectiveFontSizeTitle = Math.max(7, Math.min(40, config.fontSizeTitle || 15));
      effectiveFontSizeStart = Math.max(6, Math.min(32, config.fontSizeStart || 12));
      effectiveNumberingFontSize = Math.max(6, Math.min(28, config.numbering.fontSize || 11));
      effectiveFlowLabelFontSize = Math.max(
        6,
        Math.min(24, config.flowConnector.labelFontSize || 10)
      );
      fontScale = 1.0;
    }

    // Adapt vertical step margin so larger fixed fonts don't collide vertically with adjacent steps
    const minTextHeightCm = (effectiveFontSizeBase * 1.25 * 2.15) / PX_PER_CM;
    const baseMargin = autoFit
      ? Math.min(config.margin, Math.max(0.9, config.margin * (0.78 + 0.22 / cols)))
      : Math.max(0.5, config.margin);
    const margin = Math.max(baseMargin, minTextHeightCm * 0.85);

    // Adapt line wrap width to the actual font size inside the available half-column width
    const approxCharWidthPx = effectiveFontSizeBase * 1.25 * 0.56;
    const sideWidthBudgetPx = Math.max(54, colWidthCm * PX_PER_CM * 0.44);
    const maxCharsByFont = Math.max(
      6,
      Math.floor(sideWidthBudgetPx / Math.max(4, approxCharWidthPx))
    );
    const wrapWidth = isAutoFont
      ? Math.max(7, Math.min(config.wrapWidth, maxCharsByFont))
      : Math.max(6, Math.min(config.wrapWidth, maxCharsByFont));

    return {
      cols,
      marginX,
      colGap,
      colWidthCm,
      arrowLen,
      margin,
      wrapWidth,
      fontScale,
      formatConventionPt,
      effectiveFontSizeBase,
      effectiveFontSizeTitle,
      effectiveFontSizeStart,
      effectiveNumberingFontSize,
      effectiveFlowLabelFontSize,
    };
  }

  /**
   * Computes height-aware pagination AND side-by-side multi-column layout.
   */
  static computePages(
    steps: GilwellStep[],
    config: GilwellConfig
  ): ComputedGilwellPage[] {
    const { widthCm, heightCm, isInfinite } = getPageDimensions(
      config.pageFormat,
      config
    );
    const metrics = this.getColumnMetrics(widthCm, heightCm, config);

    if (steps.length === 0) {
      const h = isInfinite ? 16 : heightCm;
      return [
        this.computePageWithColumns(
          [{ slice: [], startOffset: 0 }],
          1,
          1,
          widthCm,
          h,
          config,
          metrics
        ),
      ];
    }

    if (isInfinite) {
      // Distribute steps evenly across requested columns on 1 infinite sheet
      const cols = metrics.cols;
      const perCol = Math.ceil(steps.length / cols);
      const colSlices: Array<{ slice: GilwellStep[]; startOffset: number }> = [];
      let maxColHeightCm = 15.0;

      for (let c = 0; c < cols; c++) {
        const startOffset = c * perCol;
        const slice = steps.slice(startOffset, startOffset + perCol);
        if (slice.length > 0) {
          colSlices.push({ slice, startOffset });
          const vecs = slice.map((s) => this.getVector(s, metrics.arrowLen));
          let curY = metrics.margin + Math.abs(Math.min(0, vecs[0].dy));
          for (let i = 0; i < slice.length - 1; i++) {
            curY +=
              metrics.margin +
              Math.max(0, vecs[i].dy) +
              Math.abs(Math.min(0, vecs[i + 1].dy));
          }
          const needed = curY + Math.max(0, vecs[vecs.length - 1].dy) + metrics.margin + 4.4;
          if (needed > maxColHeightCm) maxColHeightCm = needed;
        }
      }

      return [
        this.computePageWithColumns(
          colSlices,
          1,
          1,
          widthCm,
          maxColHeightCm,
          config,
          metrics
        ),
      ];
    }

    // Fixed paper format: pack steps into column slices first, then group `cols` per page
    const pageTopMargin = Math.max(0, config.pageMarginTopCm ?? 1.0);
    const pageBottomMargin = Math.max(0, config.pageMarginBottomCm ?? 1.0);
    const titleExtraCm = (metrics.effectiveFontSizeTitle * 1.25 * 1.5) / PX_PER_CM;
    const startExtraCm = (metrics.effectiveFontSizeStart * 1.25 * 1.5) / PX_PER_CM;
    const topReserveCm =
      pageTopMargin + (config.showNorth ? Math.max(1.55, 0.95 + titleExtraCm) : 0.3);
    const bottomReserveCm =
      pageBottomMargin + (config.showStart ? Math.max(0.85, 0.35 + startExtraCm) : 0.2);
    const usableHeightCm = Math.max(3.5, heightCm - topReserveCm - bottomReserveCm);
    const maxByDensity = Math.max(
      2,
      Math.floor(heightCm * Math.max(0.1, config.densityLimit))
    );

    const allColumnSlices: Array<{ slice: GilwellStep[]; startOffset: number }> = [];
    let cursor = 0;

    while (cursor < steps.length) {
      const slice: GilwellStep[] = [];
      const sliceStart = cursor;
      let curY = 0;

      while (cursor < steps.length && slice.length < maxByDensity) {
        const candidate = steps[cursor];
        const vec = this.getVector(candidate, metrics.arrowLen);

        if (slice.length === 0) {
          curY = metrics.margin * 0.65 + Math.abs(Math.min(0, vec.dy));
          const needed = curY + Math.max(0, vec.dy) + metrics.margin * 0.65;
          slice.push(candidate);
          cursor++;
          if (needed > usableHeightCm) break;
        } else {
          const prevVec = this.getVector(slice[slice.length - 1], metrics.arrowLen);
          const nextY =
            curY +
            metrics.margin +
            Math.max(0, prevVec.dy) +
            Math.abs(Math.min(0, vec.dy));
          const needed = nextY + Math.max(0, vec.dy) + metrics.margin * 0.65;
          if (needed <= usableHeightCm) {
            curY = nextY;
            slice.push(candidate);
            cursor++;
          } else {
            break;
          }
        }
      }
      allColumnSlices.push({ slice, startOffset: sliceStart });
    }

    const totalPages = Math.max(1, Math.ceil(allColumnSlices.length / metrics.cols));
    const pages: ComputedGilwellPage[] = [];

    for (let p = 0; p < totalPages; p++) {
      const pageCols = allColumnSlices.slice(
        p * metrics.cols,
        (p + 1) * metrics.cols
      );
      const isLastCompact = Boolean(config.compactLastPage) && p === totalPages - 1;

      let pageWidthCm = widthCm;
      let pageHeightCm = heightCm;

      if (isLastCompact && pageCols.length > 0) {
        if (pageCols.length < metrics.cols) {
          pageWidthCm = Number(
            (
              metrics.marginX * 2 +
              pageCols.length * metrics.colWidthCm +
              Math.max(0, pageCols.length - 1) * metrics.colGap
            ).toFixed(2)
          );
        }

        let maxNeededHeightCm = 4.0;
        for (const colEntry of pageCols) {
          const { slice } = colEntry;
          if (slice.length === 0) continue;
          const vecs = slice.map((s) => this.getVector(s, metrics.arrowLen));
          let spanCm = metrics.margin * 0.55 + Math.abs(Math.min(0, vecs[0].dy));
          for (let i = 0; i < slice.length - 1; i++) {
            spanCm +=
              metrics.margin +
              Math.max(0, vecs[i].dy) +
              Math.abs(Math.min(0, vecs[i + 1].dy));
          }
          spanCm += Math.max(0, vecs[slice.length - 1].dy) + metrics.margin * 0.55;
          const needed = topReserveCm + spanCm + bottomReserveCm + 0.25;
          if (needed > maxNeededHeightCm) {
            maxNeededHeightCm = needed;
          }
        }
        pageHeightCm = Number(Math.min(heightCm, maxNeededHeightCm).toFixed(2));
      }

      pages.push(
        this.computePageWithColumns(
          pageCols,
          p + 1,
          totalPages,
          pageWidthCm,
          pageHeightCm,
          config,
          isLastCompact && pageCols.length < metrics.cols
            ? { ...metrics, cols: pageCols.length }
            : metrics
        )
      );
    }

    return pages;
  }

  private static computePageWithColumns(
    columnSlices: Array<{ slice: GilwellStep[]; startOffset: number }>,
    pageNumber: number,
    totalPages: number,
    widthCm: number,
    heightCm: number,
    config: GilwellConfig,
    metrics: {
      cols: number;
      marginX: number;
      colGap: number;
      colWidthCm: number;
      arrowLen: number;
      margin: number;
      wrapWidth: number;
      fontScale: number;
      formatConventionPt: number;
      effectiveFontSizeBase: number;
      effectiveFontSizeTitle: number;
      effectiveFontSizeStart: number;
      effectiveNumberingFontSize: number;
      effectiveFlowLabelFontSize: number;
    }
  ): ComputedGilwellPage {
    const viewBoxWidth = widthCm * PX_PER_CM;
    const viewBoxHeight = heightCm * PX_PER_CM;
    const colsCount = metrics.cols;
    const marginXPx = metrics.marginX * PX_PER_CM;
    const colGapPx = metrics.colGap * PX_PER_CM;
    const colWidthPx = metrics.colWidthCm * PX_PER_CM;

    const pageTopMargin = Math.max(0, config.pageMarginTopCm ?? 1.0);
    const pageBottomMargin = Math.max(0, config.pageMarginBottomCm ?? 1.0);
    const titleExtraCm = (metrics.effectiveFontSizeTitle * 1.25 * 1.5) / PX_PER_CM;
    const startExtraCm = (metrics.effectiveFontSizeStart * 1.25 * 1.5) / PX_PER_CM;
    const topReserveCm =
      pageTopMargin + (config.showNorth ? Math.max(1.55, 0.95 + titleExtraCm) : 0.3);
    const bottomReserveCm =
      pageBottomMargin + (config.showStart ? Math.max(0.85, 0.35 + startExtraCm) : 0.2);

    const computedColumns: ComputedGilwellColumn[] = [];

    columnSlices.forEach((colEntry, readingIdxZero) => {
      const visualColIdx =
        config.readingDirection === 'rtl'
          ? colsCount - 1 - readingIdxZero
          : readingIdxZero;

      const globalSectionNumber = (pageNumber - 1) * colsCount + readingIdxZero + 1;
      const startKey = `p${pageNumber}-c${readingIdxZero + 1}`;

      const colLeftX = marginXPx + visualColIdx * (colWidthPx + colGapPx);
      const colRightX = colLeftX + colWidthPx;
      const axisX = colLeftX + colWidthPx / 2;

      const { slice, startOffset } = colEntry;
      const vecs = slice.map((s) => this.getVector(s, metrics.arrowLen));

      const mathPositions: Array<{
        mathY: number;
        dx: number;
        dy: number;
        step: GilwellStep;
        originalIndex: number;
      }> = [];

      let currentY =
        slice.length > 0
          ? bottomReserveCm + metrics.margin * 0.55 + Math.abs(Math.min(0, vecs[0].dy))
          : bottomReserveCm + 2;

      for (let i = 0; i < slice.length; i++) {
        mathPositions.push({
          mathY: currentY,
          dx: vecs[i].dx,
          dy: vecs[i].dy,
          step: slice[i],
          originalIndex: startOffset + i + 1,
        });

        if (i < slice.length - 1) {
          const gap =
            metrics.margin +
            Math.max(0, vecs[i].dy) +
            Math.abs(Math.min(0, vecs[i + 1].dy));
          currentY += gap;
        }
      }

      const stackTopMathY =
        slice.length > 0
          ? currentY + Math.max(0, vecs[slice.length - 1].dy) + metrics.margin * 0.55
          : bottomReserveCm + 6;

      // Top-align the stack inside the usable page area so partially-filled pages
      // (especially the last page) never stretch an empty axis line down to the bottom.
      const topTargetMathY = heightCm - topReserveCm;
      const topShiftCm = Math.max(0, topTargetMathY - stackTopMathY);

      const toSvgX = (cmX: number) => axisX + cmX * PX_PER_CM;
      const toSvgY = (cmFromBottom: number) =>
        viewBoxHeight - (cmFromBottom + topShiftCm) * PX_PER_CM;

      const computedSteps: ComputedStepLayout[] = mathPositions.map((pos, idxInSlice) => {
        const { mathY, dx, dy, step, originalIndex } = pos;
        const svgX0 = toSvgX(0);
        const svgY0 = toSvgY(mathY);
        const svgX1 = toSvgX(dx);
        const svgY1 = toSvgY(mathY + dy);

        const length = Math.hypot(dx, dy);
        const ux = length > 0 ? dx / length : 0;
        const uy = length > 0 ? dy / length : 0;

        const textOffsetDist = colsCount > 2 ? 0.28 : 0.38;
        let textMathX = dx + ux * textOffsetDist;
        let textMathY = mathY + dy + uy * textOffsetDist;

        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        if (Math.abs(ux) > 0.3) {
          textAnchor = ux > 0 ? 'start' : 'end';
        }

        let dominantBaseline: 'auto' | 'middle' | 'hanging' = 'middle';
        if (Math.abs(uy) > 0.3) {
          dominantBaseline = uy > 0 ? 'auto' : 'hanging';
        }

        // Prevent step labels from crossing or being sliced by the centerline axis
        if (config.avoidCenterAxisText) {
          const minAxisClearanceCm = Math.max(0.45, (config.axis.nodeSize * 2 + 8) / PX_PER_CM);
          const sideSign = dx >= -0.02 ? 1 : -1;
          if (textAnchor === 'middle' || Math.abs(textMathX) < minAxisClearanceCm) {
            textAnchor = sideSign > 0 ? 'start' : 'end';
            textMathX =
              sideSign > 0
                ? Math.max(textMathX, minAxisClearanceCm)
                : Math.min(textMathX, -minAxisClearanceCm);
            // When arrow is nearly vertical, keep vertical anchor balanced beside tip
            if (Math.abs(ux) <= 0.3) {
              textMathY = mathY + dy * 0.82;
              dominantBaseline = 'middle';
            }
          }
        }

        const rawText = formatStepText(step, config.stepTextTemplate);
        const lines = wrapText(rawText, metrics.wrapWidth);

        const displayNumber = formatNumberToken(
          startOffset + idxInSlice,
          config.numbering,
          step.customNumber
        );

        const hasBadge = config.numbering.badgeShape !== 'none';
        const numFontPx = metrics.effectiveNumberingFontSize * 1.25;
        const badgeR = Math.max(9, numFontPx * 0.78);
        const pillHalfW =
          config.numbering.badgeShape === 'rounded'
            ? Math.max(badgeR, (displayNumber.length * numFontPx * 0.54) / 2 + 5)
            : badgeR;

        const minNumClearanceCm = hasBadge
          ? (config.axis.nodeSize + 6 + pillHalfW) / PX_PER_CM
          : Math.max(
              0.35,
              (config.axis.nodeSize + 6 + metrics.effectiveNumberingFontSize * 0.25) /
                PX_PER_CM
            );

        const offsetPx =
          Math.max(
            minNumClearanceCm,
            config.numbering.offsetCm * Math.max(0.75, metrics.fontScale)
          ) * PX_PER_CM;

        const sideSign =
          config.numbering.position === 'left'
            ? -1
            : config.numbering.position === 'right'
              ? 1
              : dx >= -0.02
                ? -1
                : 1;

        const numX = svgX0 + sideSign * offsetPx;
        const numAnchor: 'start' | 'middle' | 'end' = hasBadge
          ? 'middle'
          : sideSign < 0
            ? 'end'
            : 'start';

        return {
          step,
          originalIndex,
          displayNumber,
          mathY,
          dx,
          dy,
          svgX0,
          svgY0,
          svgX1,
          svgY1,
          numX,
          numY: svgY0,
          numAnchor,
          textX: toSvgX(textMathX),
          textY: toSvgY(textMathY),
          textAnchor,
          dominantBaseline,
          lines,
          rawText,
        };
      });

      const firstStepLabel =
        computedSteps[0]?.displayNumber ?? String(startOffset + 1);
      const lastStepLabel =
        computedSteps[computedSteps.length - 1]?.displayNumber ??
        String(startOffset + slice.length);

      const isFirstSection = globalSectionNumber === 1;
      const overrideText = config.pageStartOverrides?.[startKey];

      let rawStartExpr: string;
      if (overrideText !== undefined && overrideText !== '') {
        rawStartExpr = overrideText;
      } else if (isFirstSection) {
        rawStartExpr = config.startLabel;
      } else if (config.subsequentStartMode === 'repeat-start') {
        rawStartExpr = config.startLabel;
      } else {
        rawStartExpr = config.suiteTemplate || 'SUITE (p. {page})';
      }

      const startLabel = resolveSmartStartText(rawStartExpr, {
        start: config.startLabel,
        page: pageNumber,
        totalPages,
        col: readingIdxZero + 1,
        globalCol: globalSectionNumber,
        firstStep: firstStepLabel,
        lastStep: lastStepLabel,
      });

      const axisTopMathY = stackTopMathY;
      const startClearanceCm = Math.max(
        0.42,
        (metrics.effectiveFontSizeStart * 1.25 * 0.8) / PX_PER_CM + 0.16
      );
      const axisBottomMathY = Math.max(0.3, bottomReserveCm - startClearanceCm - 0.15);
      const northArrowCm = Math.max(0.75, 0.95 * Math.min(1.15, metrics.fontScale));
      const northTextGapCm = Math.max(
        0.24,
        (metrics.effectiveFontSizeTitle * 1.25 * 0.35) / PX_PER_CM + 0.15
      );

      computedColumns.push({
        colIndex: visualColIdx,
        readingOrderIndex: readingIdxZero + 1,
        globalSectionNumber,
        startKey,
        axisX,
        colLeftX,
        colRightX,
        axisTopY: toSvgY(axisTopMathY),
        axisBottomY: toSvgY(axisBottomMathY),
        northArrowTipY: toSvgY(axisTopMathY + northArrowCm),
        northTextY: toSvgY(axisTopMathY + northArrowCm + northTextGapCm),
        startTextY: toSvgY(axisBottomMathY - startClearanceCm),
        startLabel,
        firstStepLabel,
        lastStepLabel,
        fontScale: metrics.fontScale,
        formatConventionPt: metrics.formatConventionPt,
        effectiveFontSizeBase: metrics.effectiveFontSizeBase,
        effectiveFontSizeTitle: metrics.effectiveFontSizeTitle,
        effectiveFontSizeStart: metrics.effectiveFontSizeStart,
        effectiveNumberingFontSize: metrics.effectiveNumberingFontSize,
        effectiveFlowLabelFontSize: metrics.effectiveFlowLabelFontSize,
        effectiveWrapWidth: metrics.wrapWidth,
        steps: computedSteps,
      });
    });

    // Sort visual columns left to right for predictable rendering
    computedColumns.sort((a, b) => a.colIndex - b.colIndex);

    return {
      pageNumber,
      totalPages,
      widthCm,
      heightCm,
      viewBoxWidth,
      viewBoxHeight,
      columns: computedColumns,
      steps: computedColumns.flatMap((c) => c.steps),
    };
  }

  /**
   * Serializes a computed page (including all side-by-side columns & reading order guides)
   * into a standalone, clean, transparent SVG string.
   */
  static renderPageToSvgString(
    page: ComputedGilwellPage,
    config: GilwellConfig
  ): string {
    const escapeXml = (str: string) =>
      str
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"');

    const { colors, arrow, numbering, axis } = config;
    const firstCol = page.columns[0];
    const fontScale = firstCol?.fontScale ?? 1;
    const arrowScale = Math.min(1.15, Math.max(0.7, fontScale));
    const baseFontPx = (firstCol?.effectiveFontSizeBase ?? config.fontSizeBase) * 1.25;
    const titleFontPx = (firstCol?.effectiveFontSizeTitle ?? config.fontSizeTitle) * 1.25;
    const startFontPx = (firstCol?.effectiveFontSizeStart ?? config.fontSizeStart) * 1.25;
    const numFontPx = (firstCol?.effectiveNumberingFontSize ?? numbering.fontSize) * 1.25;
    const flowFontPx =
      (firstCol?.effectiveFlowLabelFontSize ?? config.flowConnector.labelFontSize) * 1.25;
    const lineHeightPx = baseFontPx * 1.25;

    const typo = config.textTypography;
    const stepFamily = typo?.step.fontFamily || config.fontFamily;
    const stepWeight = typo?.step.fontWeight ?? 400;
    const northFamily = typo?.north.fontFamily || config.fontFamily;
    const northWeight = typo?.north.fontWeight ?? 700;
    const startFamily = typo?.start.fontFamily || config.fontFamily;
    const startWeight = typo?.start.fontWeight ?? 700;
    const numFamily = typo?.number.fontFamily || config.fontFamily;
    const numWeight = typo?.number.fontWeight ?? 700;
    const flowFamily = typo?.flow.fontFamily || config.fontFamily;
    const flowWeight = typo?.flow.fontWeight ?? 700;

    const arrowShaftW = Math.max(1.1, arrow.strokeWidth * 0.9 * arrowScale);
    const headW = Math.max(5, arrow.headWidth * arrowScale);
    const headL = Math.max(5, arrow.headLength * arrowScale);
    const markerId = `gilwell-arrow-p${page.pageNumber}`;
    const northMarkerId = `gilwell-north-p${page.pageNumber}`;
    const flowMarkerId = `gilwell-flow-p${page.pageNumber}`;

    const darkModeCss = config.responsiveDarkModeSvg
      ? `<style type="text/css">
    @media (prefers-color-scheme: dark) {
      svg { background: none !important; }
      .gw-text { fill: #FFFFFF !important; }
      .gw-stroke { stroke: #FFFFFF !important; }
      .gw-fill { fill: #FFFFFF !important; }
    }
  </style>`
      : '';

    const dashArray = getStrokeDashArray(axis.lineStyle, axis.strokeWidth);
    const dashAttr = dashArray ? `stroke-dasharray="${dashArray}"` : '';
    const dotCap = axis.lineStyle === 'dotted' ? 'stroke-linecap="round"' : '';

    // Column dividers placed in the center of the inter-column gap
    let dividersMarkup = '';
    if (page.columns.length > 1 && config.showColumnDividers) {
      const topDivY = Math.max(8, (config.pageMarginTopCm ?? 1.0) * PX_PER_CM * 0.6);
      const botDivY = page.viewBoxHeight - Math.max(8, (config.pageMarginBottomCm ?? 1.0) * PX_PER_CM * 0.6);
      const divColor = config.columnDividerColor || '#CBD5E1';
      for (let i = 1; i < page.columns.length; i++) {
        const divX = (page.columns[i - 1].colRightX + page.columns[i].colLeftX) / 2;
        dividersMarkup += `\n  <line x1="${divX.toFixed(1)}" y1="${topDivY.toFixed(1)}" x2="${divX.toFixed(1)}" y2="${botDivY.toFixed(1)}" stroke="${divColor}" stroke-width="1" stroke-dasharray="3 4" />`;
      }
    }

    // Reading order flow connectors between consecutive columns in reading order
    let flowConnectorsMarkup = '';
    const fc = config.flowConnector;
    if (page.columns.length > 1 && fc.enabled) {
      const orderedCols = [...page.columns].sort(
        (a, b) => a.readingOrderIndex - b.readingOrderIndex
      );
      const fcDash = getStrokeDashArray(fc.lineStyle, fc.strokeWidth);
      const fcDashAttr = fcDash ? `stroke-dasharray="${fcDash}"` : '';
      const fcCap = fc.lineStyle === 'dotted' ? 'stroke-linecap="round"' : '';
      const fcMarkerAttr = fc.showArrow ? `marker-end="url(#${flowMarkerId})"` : '';

      for (let i = 0; i < orderedCols.length - 1; i++) {
        const fromCol = orderedCols[i];
        const toCol = orderedCols[i + 1];
        const midX = (fromCol.axisX + toCol.axisX) / 2;
        const fromY = fromCol.axisTopY + 8;
        const toY = toCol.axisBottomY - 6;
        const dirSign = toCol.axisX > fromCol.axisX ? 1 : -1;
        const startX = fromCol.axisX + dirSign * 14;
        const endX = toCol.axisX - dirSign * 14;

        let d: string;
        if (fc.shape === 'diagonal') {
          d = `M ${startX.toFixed(1)} ${fromY.toFixed(1)} L ${endX.toFixed(1)} ${toY.toFixed(1)}`;
        } else if (fc.shape === 'curved') {
          const c1x = midX;
          const c1y = fromY;
          const c2x = midX;
          const c2y = toY;
          d = `M ${startX.toFixed(1)} ${fromY.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${endX.toFixed(1)} ${toY.toFixed(1)}`;
        } else {
          d = `M ${startX.toFixed(1)} ${fromY.toFixed(1)} L ${midX.toFixed(1)} ${fromY.toFixed(1)} L ${midX.toFixed(1)} ${toY.toFixed(1)} L ${endX.toFixed(1)} ${toY.toFixed(1)}`;
        }

        flowConnectorsMarkup += `\n  <path d="${d}" fill="none" stroke="${fc.color}" stroke-width="${fc.strokeWidth}" ${fcDashAttr} ${fcCap} ${fcMarkerAttr} />`;

        if (fc.showLabel) {
          const labelTxt = (fc.labelText || '{from} → {to}')
            .replace(/\{from\}/gi, String(fromCol.globalSectionNumber))
            .replace(/\{to\}/gi, String(toCol.globalSectionNumber));
          const midY = (fromY + toY) / 2;
          flowConnectorsMarkup += `\n  <rect x="${(midX - 24).toFixed(1)}" y="${(midY - 9).toFixed(1)}" width="48" height="18" rx="4" fill="#FFFFFF" fill-opacity="0.9" />`;
          flowConnectorsMarkup += `\n  <text x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(flowFamily)}" font-size="${flowFontPx.toFixed(1)}" font-weight="${flowWeight}" fill="${fc.color}">${escapeXml(labelTxt)}</text>`;
        }
      }
    }

    const columnsMarkup = page.columns
      .map((col) => {
        let axisMarkup = '';
        if (axis.visible) {
          if (axis.lineStyle === 'double') {
            axisMarkup = `
    <line x1="${(col.axisX - 2.2).toFixed(1)}" y1="${col.axisBottomY.toFixed(1)}" x2="${(col.axisX - 2.2).toFixed(1)}" y2="${col.axisTopY.toFixed(1)}" stroke="${axis.color}" stroke-width="${Math.max(1, axis.strokeWidth * 0.7)}" class="gw-stroke" />
    <line x1="${(col.axisX + 2.2).toFixed(1)}" y1="${col.axisBottomY.toFixed(1)}" x2="${(col.axisX + 2.2).toFixed(1)}" y2="${col.axisTopY.toFixed(1)}" stroke="${axis.color}" stroke-width="${Math.max(1, axis.strokeWidth * 0.7)}" class="gw-stroke" />`;
          } else {
            axisMarkup = `
    <line x1="${col.axisX.toFixed(1)}" y1="${col.axisBottomY.toFixed(1)}" x2="${col.axisX.toFixed(1)}" y2="${col.axisTopY.toFixed(1)}" stroke="${axis.color}" stroke-width="${axis.strokeWidth}" ${dashAttr} ${dotCap} class="gw-stroke" />`;
          }
        }

        const northMarkup = config.showNorth
          ? `\n    <line x1="${col.axisX.toFixed(1)}" y1="${col.axisTopY.toFixed(1)}" x2="${col.axisX.toFixed(1)}" y2="${col.northArrowTipY.toFixed(1)}" stroke="${colors.northArrow}" stroke-width="2" marker-end="url(#${northMarkerId})" class="gw-stroke" />
    <text x="${col.axisX.toFixed(1)}" y="${col.northTextY.toFixed(1)}" text-anchor="middle" dominant-baseline="auto" font-family="${escapeXml(northFamily)}" font-size="${titleFontPx.toFixed(1)}" font-weight="${northWeight}" fill="${colors.northText}" class="gw-text">${escapeXml(config.northLabel)}</text>`
          : '';

        const startMarkup = config.showStart
          ? `\n    <text x="${col.axisX.toFixed(1)}" y="${col.startTextY.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="${escapeXml(startFamily)}" font-size="${startFontPx.toFixed(1)}" font-weight="${startWeight}" fill="${colors.startText}" class="gw-text">${escapeXml(col.startLabel)}</text>`
          : '';

        const stepsMarkup = col.steps
          .map((s) => {
            const stepArrowColor = s.step.customColor || colors.arrowEdge;
            const stepTextColor = s.step.customTextColor || colors.textMain;
            const stepMarker = s.step.customColor
              ? `${markerId}-step-${s.originalIndex}`
              : markerId;
            const vx = s.svgX1 - s.svgX0;
            const vy = s.svgY1 - s.svgY0;
            const len = Math.hypot(vx, vy);
            const trim = Math.min(len * 0.4, headL * 0.65);
            const lineEndX = len > 0 ? s.svgX1 - (vx / len) * trim : s.svgX1;
            const lineEndY = len > 0 ? s.svgY1 - (vy / len) * trim : s.svgY1;

            let nodeSvg = '';
            const nr = axis.nodeSize * fontScale;
            if (axis.nodeStyle === 'circle') {
              nodeSvg = `<circle cx="${s.svgX0.toFixed(1)}" cy="${s.svgY0.toFixed(1)}" r="${nr.toFixed(1)}" fill="${axis.nodeColor}" class="gw-fill" />`;
            } else if (axis.nodeStyle === 'ring') {
              nodeSvg = `<circle cx="${s.svgX0.toFixed(1)}" cy="${s.svgY0.toFixed(1)}" r="${nr.toFixed(1)}" fill="#FFFFFF" stroke="${axis.nodeColor}" stroke-width="2" class="gw-stroke" />`;
            } else if (axis.nodeStyle === 'square') {
              nodeSvg = `<rect x="${(s.svgX0 - nr).toFixed(1)}" y="${(s.svgY0 - nr).toFixed(1)}" width="${(nr * 2).toFixed(1)}" height="${(nr * 2).toFixed(1)}" fill="${axis.nodeColor}" class="gw-fill" />`;
            } else if (axis.nodeStyle === 'diamond') {
              const d = nr * 1.3;
              nodeSvg = `<polygon points="${s.svgX0},${s.svgY0 - d} ${s.svgX0 + d},${s.svgY0} ${s.svgX0},${s.svgY0 + d} ${s.svgX0 - d},${s.svgY0}" fill="${axis.nodeColor}" class="gw-fill" />`;
            }

            let numberSvg = '';
            if (numbering.enabled) {
              if (numbering.badgeShape !== 'none') {
                const badgeR = Math.max(9, numFontPx * 0.78);
                const badgeFill = numbering.badgeFilled
                  ? numbering.badgeFillColor
                  : 'none';
                const badgeStroke = numbering.badgeBorderColor || numbering.color;
                const badgeSw = Math.max(0.8, numbering.badgeBorderWidth || 1.3);
                let shapeMarkup = '';

                if (numbering.badgeShape === 'circle') {
                  shapeMarkup = `<circle cx="${s.numX.toFixed(1)}" cy="${s.numY.toFixed(1)}" r="${badgeR.toFixed(1)}" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="${badgeSw}" class="gw-stroke" />`;
                } else if (numbering.badgeShape === 'rounded') {
                  const halfW = Math.max(
                    badgeR,
                    (s.displayNumber.length * numFontPx * 0.54) / 2 + 5
                  );
                  const halfH = badgeR * 0.9;
                  shapeMarkup = `<rect x="${(s.numX - halfW).toFixed(1)}" y="${(s.numY - halfH).toFixed(1)}" width="${(halfW * 2).toFixed(1)}" height="${(halfH * 2).toFixed(1)}" rx="${(halfH * 0.65).toFixed(1)}" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="${badgeSw}" class="gw-stroke" />`;
                } else if (numbering.badgeShape === 'square') {
                  shapeMarkup = `<rect x="${(s.numX - badgeR).toFixed(1)}" y="${(s.numY - badgeR).toFixed(1)}" width="${(badgeR * 2).toFixed(1)}" height="${(badgeR * 2).toFixed(1)}" rx="2" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="${badgeSw}" class="gw-stroke" />`;
                } else {
                  const pts = getBadgePolygonPoints(
                    s.numX,
                    s.numY,
                    badgeR,
                    numbering.badgeShape
                  );
                  shapeMarkup = `<polygon points="${pts}" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="${badgeSw}" class="gw-stroke" />`;
                }

                numberSvg = `
    ${shapeMarkup}
    <text x="${s.numX.toFixed(1)}" y="${s.numY.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(numFamily)}" font-size="${(numFontPx * 0.82).toFixed(1)}" font-weight="${numWeight}" fill="${numbering.color}" class="gw-text">${escapeXml(s.displayNumber)}</text>`;
              } else {
                numberSvg = `
    <text x="${s.numX.toFixed(1)}" y="${s.numY.toFixed(1)}" text-anchor="${s.numAnchor}" dominant-baseline="middle" font-family="${escapeXml(numFamily)}" font-size="${numFontPx.toFixed(1)}" font-weight="${numWeight}" fill="${numbering.color}" class="gw-text">${escapeXml(s.displayNumber)}</text>`;
              }
            }

            const tspans = s.lines
              .map((line, lineIdx) => {
                const dyAttr =
                  lineIdx === 0
                    ? s.dominantBaseline === 'auto' && s.lines.length > 1
                      ? `${-(s.lines.length - 1) * lineHeightPx}`
                      : '0'
                    : `${lineHeightPx}`;
                return `<tspan x="${s.textX.toFixed(1)}" dy="${dyAttr}">${escapeXml(line)}</tspan>`;
              })
              .join('');

            return `  <g class="gw-step" data-step-index="${s.originalIndex}">
    ${nodeSvg}${numberSvg}
    <line x1="${s.svgX0.toFixed(1)}" y1="${s.svgY0.toFixed(1)}" x2="${lineEndX.toFixed(1)}" y2="${lineEndY.toFixed(1)}" stroke="${stepArrowColor}" stroke-width="${arrowShaftW.toFixed(1)}" stroke-linecap="butt" marker-end="url(#${stepMarker})" class="gw-stroke" />
    <text x="${s.textX.toFixed(1)}" y="${s.textY.toFixed(1)}" text-anchor="${s.textAnchor}" dominant-baseline="${s.dominantBaseline}" font-family="${escapeXml(stepFamily)}" font-size="${baseFontPx.toFixed(1)}" font-weight="${stepWeight}" fill="${stepTextColor}" class="gw-text">${tspans}</text>
  </g>`;
          })
          .join('\n');

        return `${axisMarkup}${northMarkup}${startMarkup}\n${stepsMarkup}`;
      })
      .join('\n');

    const customArrowMarkers = page.steps
      .filter((s) => Boolean(s.step.customColor))
      .map(
        (s) => `
    <marker id="${markerId}-step-${s.originalIndex}" markerWidth="${headL}" markerHeight="${headW}" refX="${headL - 1}" refY="${headW / 2}" orient="auto" markerUnits="userSpaceOnUse">
      <polygon points="0,0 ${headL},${headW / 2} 0,${headW}" fill="${s.step.customColor}" class="gw-fill" />
    </marker>`
      )
      .join('');

    const bgStyle = config.transparentBackground
      ? 'background: transparent;'
      : 'background: #FFFFFF;';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.viewBoxWidth.toFixed(1)} ${page.viewBoxHeight.toFixed(1)}" width="${page.widthCm}cm" height="${page.heightCm.toFixed(1)}cm" style="max-width: 100%; height: auto; ${bgStyle}">
  ${darkModeCss}
  <defs>
    <marker id="${markerId}" markerWidth="${headL}" markerHeight="${headW}" refX="${headL - 1}" refY="${headW / 2}" orient="auto" markerUnits="userSpaceOnUse">
      <polygon points="0,0 ${headL},${headW / 2} 0,${headW}" fill="${colors.arrowFill}" class="gw-fill" />
    </marker>${customArrowMarkers}
    <marker id="${northMarkerId}" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto" markerUnits="userSpaceOnUse">
      <polygon points="0,1 10,5 0,9" fill="${colors.northArrow}" class="gw-fill" />
    </marker>
    <marker id="${flowMarkerId}" markerWidth="${fc.arrowSize}" markerHeight="${fc.arrowSize}" refX="${(fc.arrowSize * 0.75).toFixed(1)}" refY="${(fc.arrowSize / 2).toFixed(1)}" orient="auto" markerUnits="userSpaceOnUse">
      <polygon points="0,1 ${fc.arrowSize},${(fc.arrowSize / 2).toFixed(1)} 0,${fc.arrowSize - 1}" fill="${fc.color}" />
    </marker>
  </defs>${dividersMarkup}${flowConnectorsMarkup}${columnsMarkup}
</svg>`;
  }

  static generateScoutRaiderSVG(
    segments: ScoutRaiderPolySegment[],
    config: GilwellConfig = DEFAULT_GILWELL_CONFIG
  ): string {
    const steps = this.fromPolySegments(segments);
    const pages = this.computePages(steps, {
      ...config,
      pageFormat: 'infinite',
    });
    return this.renderPageToSvgString(pages[0], {
      ...config,
      pageFormat: 'infinite',
    });
  }
}
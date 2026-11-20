# logic

## Overview
Core computation engine, calculation models, and export logic for Gilwell navigation puzzles.

## Interface
- `[GilwellEngine.ts] function getFormatConventionPt()`
- `[GilwellEngine.ts] function toRoman()`
- `[GilwellEngine.ts] function toAlpha()`
- `[GilwellEngine.ts] function formatNumberToken()`
- `[GilwellEngine.ts] function getStrokeDashArray()`
- `[GilwellEngine.ts] function getBadgePolygonPoints()`
- `[GilwellEngine.ts] function wrapText()`
- `[GilwellEngine.ts] function formatStepText()`
- `[GilwellEngine.ts] function resolveSmartStartText()`
- `[GilwellEngine.ts] function getPageDimensions()`
- `[GilwellEngine.ts] class GilwellEngine`
- `[GilwellEngine.ts] const PX_PER_CM`
- `[GilwellEngine.ts] const FONT_FAMILY_OPTIONS`
- `[GilwellEngine.ts] const PAGE_FORMATS`
- `[GilwellEngine.ts] const DEFAULT_GILWELL_STEPS`
- `[GilwellEngine.ts] const DEFAULT_GILWELL_CONFIG`
- `[gilwellExport.ts] function triggerFileDownload()`
- `[gilwellExport.ts] function downloadSvgPage()`
- `[gilwellExport.ts] function renderSvgToPngBlob()`
- `[gilwellExport.ts] function downloadPngPage()`
- `[types.ts] interface PageFormatSpec`
- `[types.ts] interface GilwellStep`
- `[types.ts] interface ScoutRaiderPolySegment`
- `[types.ts] interface GilwellColorConfig`
- `[types.ts] interface GilwellArrowStyle`
- *(and 27 more exported symbols)*

## Invariants
- None

## Side Effects
- DOM / browser window side effects

## Verification
- Run: `npm run build`

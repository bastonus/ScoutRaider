/**
 * Gilwell Module — WYSIWYG Sheet Component
 * Main rendering component for a single computed page.
 * Uses app-provided styles only — no internal CSS.
 */

import React, { useEffect, useRef, useState } from 'react';
import type {
  ComputedGilwellColumn,
  ComputedGilwellPage,
  GilwellConfig,
  GilwellStep,
  PreviewSurface,
  SelectedElementTarget,
} from '../logic/types';
import {
  formatStepText,
  getBadgePolygonPoints,
  getStrokeDashArray,
  PAGE_FORMATS,
} from '../logic/GilwellEngine';
import ElementInspectorPopover from './ElementInspectorPopover';

interface GilwellSheetProps {
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

type InPlaceEditTarget =
  | { kind: 'step-text'; stepId: string }
  | { kind: 'step-number'; stepId: string }
  | { kind: 'north'; colKey: string }
  | { kind: 'start'; colKey: string }
  | null;

export default function GilwellSheet({
  page,
  config,
  surface,
  zoom,
  selectedStepId,
  selectedElement,
  onSelectElement,
  onSelectStep,
  onUpdateStep,
  onUpdateConfig,
  onAddStepAfter,
  onDeleteStep,
}: GilwellSheetProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [inPlaceEdit, setInPlaceEdit] = useState<InPlaceEditTarget>(null);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);
  const [hoveredAxisKey, setHoveredAxisKey] = useState<string | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dragAzimuth, setDragAzimuth] = useState<number | null>(null);

  const isDarkSurface = surface === 'transparent-dark';
  const invertDark = isDarkSurface && config.responsiveDarkModeSvg;

  const effectiveInk = invertDark ? '#F8FAFC' : config.colors.textMain;
  const effectiveNorthText = invertDark ? '#F8FAFC' : config.colors.northText;
  const effectiveNorthArrow = invertDark ? '#F8FAFC' : config.colors.northArrow;
  const effectiveAxis = invertDark ? '#E2E8F0' : config.axis.color;
  const effectiveNode = invertDark ? '#E2E8F0' : config.axis.nodeColor;
  const effectiveArrowFill = invertDark ? '#F8FAFC' : config.colors.arrowFill;
  const effectiveArrowEdge = invertDark ? '#F8FAFC' : config.colors.arrowEdge;
  const effectiveStart = invertDark ? '#F8FAFC' : config.colors.startText;
  const effectiveNumColor = invertDark ? '#F8FAFC' : config.numbering.color;

  const firstCol = page.columns[0];
  const fontScale = firstCol?.fontScale ?? 1;
  const arrowScale = Math.min(1.15, Math.max(0.7, fontScale));
  const baseFontPx =
    (firstCol?.effectiveFontSizeBase ?? config.fontSizeBase) * 1.25;
  const titleFontPx =
    (firstCol?.effectiveFontSizeTitle ?? config.fontSizeTitle) * 1.25;
  const startFontPx =
    (firstCol?.effectiveFontSizeStart ?? config.fontSizeStart) * 1.25;
  const numFontPx =
    (firstCol?.effectiveNumberingFontSize ?? config.numbering.fontSize) * 1.25;
  const flowFontPx =
    (firstCol?.effectiveFlowLabelFontSize ?? config.flowConnector.labelFontSize) *
    1.25;
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

  const arrowShaftW = Math.max(1.1, config.arrow.strokeWidth * 0.9 * arrowScale);
  const headW = Math.max(5, config.arrow.headWidth * arrowScale);
  const headL = Math.max(5, config.arrow.headLength * arrowScale);
  const markerId = `wysiwyg-arrow-p${page.pageNumber}`;
  const selectedMarkerId = `wysiwyg-arrow-sel-p${page.pageNumber}`;
  const northMarkerId = `wysiwyg-north-p${page.pageNumber}`;
  const flowMarkerId = `wysiwyg-flow-p${page.pageNumber}`;

  const sheetWidthPx = page.widthCm * 26 * (zoom / 100);
  const sheetHeightPx = page.heightCm * 26 * (zoom / 100);

  const dashArray = getStrokeDashArray(
    config.axis.lineStyle,
    config.axis.strokeWidth
  );
  const elementOnThisPage =
    selectedElement && selectedElement.pageNumber === page.pageNumber
      ? selectedElement
      : null;

  const fc = config.flowConnector;
  const fcDash = getStrokeDashArray(fc.lineStyle, fc.strokeWidth);
  const effectiveFlowColor =
    elementOnThisPage?.kind === 'flow-connector'
      ? '#059669'
      : invertDark
        ? '#CBD5E1'
        : fc.color;

  // Drag arrowhead to rotate azimuth interactively
  useEffect(() => {
    if (!draggingStepId) return;

    const handlePointerMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const stepLayout = page.steps.find((s) => s.step.id === draggingStepId);
      if (!stepLayout) return;

      const rect = svg.getBoundingClientRect();
      const scaleX = page.viewBoxWidth / rect.width;
      const scaleY = page.viewBoxHeight / rect.height;

      const pointerSvgX = (e.clientX - rect.left) * scaleX;
      const pointerSvgY = (e.clientY - rect.top) * scaleY;

      const vx = pointerSvgX - stepLayout.svgX0;
      const vy = stepLayout.svgY0 - pointerSvgY;

      let deg = Math.round((Math.atan2(vx, vy) * 180) / Math.PI);
      if (deg < 0) deg += 360;
      if (e.shiftKey) {
        deg = Math.round(deg / 5) * 5;
        if (deg === 360) deg = 0;
      }
      setDragAzimuth(deg);
      onUpdateStep(draggingStepId, { azimut: deg });
    };

    const handlePointerUp = () => {
      setDraggingStepId(null);
      setDragAzimuth(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingStepId, page, onUpdateStep]);

  const surfaceClass =
    surface === 'paper'
      ? 'bg-white border-slate-200 text-slate-900'
      : surface === 'transparent-light'
        ? 'bg-checkerboard border-slate-200 text-slate-900'
        : 'bg-slate-900 border-slate-700 text-slate-100';

  const formatLabel =
    PAGE_FORMATS.find((f) => f.id === config.pageFormat)?.label ||
    config.pageFormat;

  const popoverStepLayout =
    elementOnThisPage && 'stepId' in elementOnThisPage
      ? page.steps.find((s) => s.step.id === elementOnThisPage.stepId) || null
      : null;

  const popoverColumn: ComputedGilwellColumn | null =
    elementOnThisPage && 'colKey' in elementOnThisPage
      ? page.columns.find((c) => c.startKey === elementOnThisPage.colKey) ||
        page.columns[0] ||
        null
      : page.columns[0] || null;

  const commitInPlaceText = (target: InPlaceEditTarget, newValue: string) => {
    if (!target) return;
    const trimmed = newValue.trim();

    if (target.kind === 'north') {
      onUpdateConfig({ northLabel: trimmed || 'NORD' });
    } else if (target.kind === 'start') {
      const col = page.columns.find((c) => c.startKey === target.colKey);
      if (col && col.globalSectionNumber === 1 && !config.pageStartOverrides[target.colKey]) {
        // Editing the very first section updates global startLabel seamlessly
        onUpdateConfig({ startLabel: trimmed || 'DÉPART' });
      } else {
        const nextOverrides = { ...config.pageStartOverrides };
        if (!trimmed) {
          delete nextOverrides[target.colKey];
        } else {
          nextOverrides[target.colKey] = trimmed;
        }
        onUpdateConfig({ pageStartOverrides: nextOverrides });
      }
    } else if (target.kind === 'step-text') {
      const st = page.steps.find((s) => s.step.id === target.stepId)?.step;
      if (st) {
        const auto = formatStepText(
          { ...st, customText: undefined },
          config.stepTextTemplate
        );
        onUpdateStep(st.id, {
          customText:
            !trimmed || trimmed === auto ? undefined : newValue.replace(/\r/g, ''),
        });
      }
    } else if (target.kind === 'step-number') {
      const st = page.steps.find((s) => s.step.id === target.stepId)?.step;
      if (st) {
        onUpdateStep(st.id, {
          customNumber: trimmed || undefined,
        });
      }
    }
    setInPlaceEdit(null);
  };

  // Flow connectors in reading order
  const orderedColumns = [...page.columns].sort(
    (a, b) => a.readingOrderIndex - b.readingOrderIndex
  );

  return (
    <div className="flex flex-col items-center">
      {/* Page metadata line above sheet */}
      <div
        style={{ width: `${sheetWidthPx}px` }}
        className="mb-2 flex items-center justify-between px-1 text-xs text-slate-500"
      >
        <span className="font-medium tabular-nums">
          Page {page.pageNumber} sur {page.totalPages} · {page.widthCm.toFixed(1)} ×{' '}
          {page.heightCm.toFixed(1)} cm ({formatLabel})
          {page.columns.length > 1 ? ` · ${page.columns.length} colonnes` : ''}
        </span>
        <span className="tabular-nums">
          {page.steps.length} {page.steps.length > 1 ? 'étapes' : 'étape'}
        </span>
      </div>

      {/* Physical WYSIWYG sheet locked to exact aspect ratio */}
      <div
        style={{
          width: `${sheetWidthPx}px`,
          height: `${sheetHeightPx}px`,
        }}
        className={`relative border shadow-sm transition-colors duration-150 ${surfaceClass}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onSelectStep(null);
            onSelectElement(null);
            setInPlaceEdit(null);
          }
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${page.viewBoxWidth} ${page.viewBoxHeight}`}
          className="block h-full w-full select-none overflow-visible"
          onClick={(e) => {
            if (e.target === svgRef.current) {
              onSelectStep(null);
              onSelectElement(null);
              setInPlaceEdit(null);
            }
          }}
        >
          <defs>
            <marker
              id={markerId}
              markerWidth={headL}
              markerHeight={headW}
              refX={headL - 1}
              refY={headW / 2}
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon
                points={`0,0 ${headL},${headW / 2} 0,${headW}`}
                fill={effectiveArrowFill}
              />
            </marker>
            <marker
              id={selectedMarkerId}
              markerWidth={headL}
              markerHeight={headW}
              refX={headL - 1}
              refY={headW / 2}
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon
                points={`0,0 ${headL},${headW / 2} 0,${headW}`}
                fill="#059669"
              />
            </marker>
            <marker
              id={northMarkerId}
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="5"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon points="0,1 10,5 0,9" fill={effectiveNorthArrow} />
            </marker>
            <marker
              id={flowMarkerId}
              markerWidth={fc.arrowSize}
              markerHeight={fc.arrowSize}
              refX={fc.arrowSize * 0.75}
              refY={fc.arrowSize / 2}
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <polygon
                points={`0,1 ${fc.arrowSize},${fc.arrowSize / 2} 0,${fc.arrowSize - 1}`}
                fill={effectiveFlowColor}
              />
            </marker>
            {page.steps
              .filter((s) => Boolean(s.step.customColor) && !invertDark)
              .map((s) => (
                <marker
                  key={`m-${s.step.id}`}
                  id={`${markerId}-step-${s.step.id}`}
                  markerWidth={headL}
                  markerHeight={headW}
                  refX={headL - 1}
                  refY={headW / 2}
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <polygon
                    points={`0,0 ${headL},${headW / 2} 0,${headW}`}
                    fill={s.step.customColor}
                  />
                </marker>
              ))}
          </defs>

          {/* ── COLUMN DIVIDERS ── */}
          {page.columns.length > 1 &&
            config.showColumnDividers &&
            page.columns.slice(1).map((col, idx) => {
              const prevCol = page.columns[idx];
              const divX = (prevCol.colRightX + col.colLeftX) / 2;
              const topDivY = Math.max(8, (config.pageMarginTopCm ?? 1.0) * 38 * 0.6);
              const botDivY =
                page.viewBoxHeight -
                Math.max(8, (config.pageMarginBottomCm ?? 1.0) * 38 * 0.6);
              return (
                <line
                  key={`div-${col.startKey}`}
                  x1={divX}
                  y1={topDivY}
                  x2={divX}
                  y2={botDivY}
                  stroke={
                    isDarkSurface
                      ? '#334155'
                      : config.columnDividerColor || '#CBD5E1'
                  }
                  strokeWidth={1}
                  strokeDasharray="3 4"
                />
              );
            })}

          {/* ── READING ORDER FLOW CONNECTORS ── */}
          {orderedColumns.length > 1 &&
            fc.enabled &&
            orderedColumns.slice(0, -1).map((fromCol, i) => {
              const toCol = orderedColumns[i + 1];
              const midX = (fromCol.axisX + toCol.axisX) / 2;
              const fromY = fromCol.axisTopY + 8;
              const toY = toCol.axisBottomY - 6;
              const dirSign = toCol.axisX > fromCol.axisX ? 1 : -1;
              const startX = fromCol.axisX + dirSign * 14;
              const endX = toCol.axisX - dirSign * 14;
              const midY = (fromY + toY) / 2;

              let d: string;
              if (fc.shape === 'diagonal') {
                d = `M ${startX} ${fromY} L ${endX} ${toY}`;
              } else if (fc.shape === 'curved') {
                d = `M ${startX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${endX} ${toY}`;
              } else {
                d = `M ${startX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${endX} ${toY}`;
              }

              const labelTxt = (fc.labelText || '{from} → {to}')
                .replace(/\{from\}/gi, String(fromCol.globalSectionNumber))
                .replace(/\{to\}/gi, String(toCol.globalSectionNumber));

              const isFlowSelected = elementOnThisPage?.kind === 'flow-connector';

              return (
                <g
                  key={`flow-${fromCol.startKey}-${toCol.startKey}`}
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInPlaceEdit(null);
                    onSelectElement({
                      kind: 'flow-connector',
                      xPct: (midX / page.viewBoxWidth) * 100,
                      yPct: (midY / page.viewBoxHeight) * 100,
                      pageNumber: page.pageNumber,
                    });
                  }}
                >
                  <path
                    d={d}
                    fill="none"
                    stroke={isFlowSelected ? 'rgba(5, 150, 105, 0.14)' : 'transparent'}
                    strokeWidth={16}
                  />
                  <path
                    d={d}
                    fill="none"
                    stroke={effectiveFlowColor}
                    strokeWidth={fc.strokeWidth}
                    strokeDasharray={fcDash}
                    strokeLinecap={fc.lineStyle === 'dotted' ? 'round' : 'butt'}
                    markerEnd={fc.showArrow ? `url(#${flowMarkerId})` : undefined}
                  />
                  {fc.showLabel && (
                    <g>
                      <rect
                        x={midX - 24}
                        y={midY - 9}
                        width={48}
                        height={18}
                        rx={4}
                        fill={isDarkSurface ? '#0F172A' : '#FFFFFF'}
                        fillOpacity={0.92}
                        stroke={isFlowSelected ? '#059669' : 'transparent'}
                        strokeWidth={1}
                      />
                      <text
                        x={midX}
                        y={midY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontFamily={flowFamily}
                        fontSize={flowFontPx}
                        fontWeight={flowWeight}
                        fill={effectiveFlowColor}
                      >
                        {labelTxt}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

          {/* ── COLUMNS ── */}
          {page.columns.map((col) => {
            const isEditingThisNorth =
              inPlaceEdit?.kind === 'north' && inPlaceEdit.colKey === col.startKey;
            const isEditingThisStart =
              inPlaceEdit?.kind === 'start' && inPlaceEdit.colKey === col.startKey;

            return (
              <g key={col.startKey}>
                {/* Centerline Axis */}
                {config.axis.visible ? (
                  <g
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredAxisKey(col.startKey)}
                    onMouseLeave={() => setHoveredAxisKey(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setInPlaceEdit(null);
                      onSelectElement({
                        kind: 'axis',
                        colKey: col.startKey,
                        xPct: (col.axisX / page.viewBoxWidth) * 100,
                        yPct: 50,
                        pageNumber: page.pageNumber,
                      });
                    }}
                  >
                    <line
                      x1={col.axisX}
                      y1={col.axisBottomY}
                      x2={col.axisX}
                      y2={col.axisTopY}
                      stroke={
                        hoveredAxisKey === col.startKey ||
                        elementOnThisPage?.kind === 'axis'
                          ? 'rgba(5, 150, 105, 0.14)'
                          : 'transparent'
                      }
                      strokeWidth={14}
                    />
                    {config.axis.lineStyle === 'double' ? (
                      <>
                        <line
                          x1={col.axisX - 2.2}
                          y1={col.axisBottomY}
                          x2={col.axisX - 2.2}
                          y2={col.axisTopY}
                          stroke={
                            elementOnThisPage?.kind === 'axis'
                              ? '#059669'
                              : effectiveAxis
                          }
                          strokeWidth={Math.max(1, config.axis.strokeWidth * 0.7)}
                        />
                        <line
                          x1={col.axisX + 2.2}
                          y1={col.axisBottomY}
                          x2={col.axisX + 2.2}
                          y2={col.axisTopY}
                          stroke={
                            elementOnThisPage?.kind === 'axis'
                              ? '#059669'
                              : effectiveAxis
                          }
                          strokeWidth={Math.max(1, config.axis.strokeWidth * 0.7)}
                        />
                      </>
                    ) : (
                      <line
                        x1={col.axisX}
                        y1={col.axisBottomY}
                        x2={col.axisX}
                        y2={col.axisTopY}
                        stroke={
                          elementOnThisPage?.kind === 'axis'
                            ? '#059669'
                            : effectiveAxis
                        }
                        strokeWidth={config.axis.strokeWidth}
                        strokeDasharray={dashArray}
                        strokeLinecap={
                          config.axis.lineStyle === 'dotted' ? 'round' : 'butt'
                        }
                      />
                    )}
                  </g>
                ) : (
                  <line
                    x1={col.axisX}
                    y1={col.axisBottomY}
                    x2={col.axisX}
                    y2={col.axisTopY}
                    stroke="rgba(148, 163, 184, 0.25)"
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement({
                        kind: 'axis',
                        colKey: col.startKey,
                        xPct: (col.axisX / page.viewBoxWidth) * 100,
                        yPct: 50,
                        pageNumber: page.pageNumber,
                      });
                    }}
                  />
                )}

                {/* North Indicator */}
                {config.showNorth ? (
                  <g>
                    <line
                      x1={col.axisX}
                      y1={col.axisTopY}
                      x2={col.axisX}
                      y2={col.northArrowTipY}
                      stroke={
                        elementOnThisPage?.kind === 'north'
                          ? '#059669'
                          : effectiveNorthArrow
                      }
                      strokeWidth={2.0}
                      markerEnd={`url(#${northMarkerId})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectElement({
                          kind: 'north',
                          colKey: col.startKey,
                          xPct: (col.axisX / page.viewBoxWidth) * 100,
                          yPct: (col.northTextY / page.viewBoxHeight) * 100,
                          pageNumber: page.pageNumber,
                        });
                      }}
                    />
                    <g
                      className="cursor-text"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInPlaceEdit({ kind: 'north', colKey: col.startKey });
                        onSelectElement({
                          kind: 'north',
                          colKey: col.startKey,
                          xPct: (col.axisX / page.viewBoxWidth) * 100,
                          yPct: (col.northTextY / page.viewBoxHeight) * 100,
                          pageNumber: page.pageNumber,
                        });
                      }}
                    >
                      <rect
                        x={col.axisX - 70}
                        y={col.northTextY - titleFontPx - 4}
                        width={140}
                        height={titleFontPx + 10}
                        rx={4}
                        fill="transparent"
                        className="hover:fill-emerald-500/10"
                      />
                      <text
                        x={col.axisX}
                        y={col.northTextY}
                        textAnchor="middle"
                        dominantBaseline="auto"
                        fontFamily={northFamily}
                        fontSize={titleFontPx}
                        fontWeight={northWeight}
                        fill={effectiveNorthText}
                        opacity={isEditingThisNorth ? 0 : 1}
                      >
                        {config.northLabel}
                      </text>
                    </g>
                  </g>
                ) : (
                  <text
                    x={col.axisX}
                    y={col.northTextY}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#94A3B8"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement({
                        kind: 'north',
                        colKey: col.startKey,
                        xPct: (col.axisX / page.viewBoxWidth) * 100,
                        yPct: (col.northTextY / page.viewBoxHeight) * 100,
                        pageNumber: page.pageNumber,
                      });
                    }}
                  >
                    [Nord masqué]
                  </text>
                )}

                {/* Start / Suite Label (in-place editable per column/page!) */}
                {config.showStart ? (
                  <g
                    className="cursor-text"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInPlaceEdit({ kind: 'start', colKey: col.startKey });
                      onSelectElement({
                        kind: 'start',
                        colKey: col.startKey,
                        xPct: (col.axisX / page.viewBoxWidth) * 100,
                        yPct: (col.startTextY / page.viewBoxHeight) * 100,
                        pageNumber: page.pageNumber,
                      });
                    }}
                  >
                    <rect
                      x={col.axisX - 85}
                      y={col.startTextY - startFontPx * 0.9}
                      width={170}
                      height={startFontPx * 1.8}
                      rx={4}
                      fill="transparent"
                      className="hover:fill-emerald-500/10"
                    />
                    <text
                      x={col.axisX}
                      y={col.startTextY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontFamily={startFamily}
                      fontSize={startFontPx}
                      fontWeight={startWeight}
                      fill={effectiveStart}
                      opacity={isEditingThisStart ? 0 : 1}
                    >
                      {col.startLabel}
                    </text>
                  </g>
                ) : (
                  <text
                    x={col.axisX}
                    y={col.startTextY}
                    textAnchor="middle"
                    fontSize={9}
                    fill="#94A3B8"
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement({
                        kind: 'start',
                        colKey: col.startKey,
                        xPct: (col.axisX / page.viewBoxWidth) * 100,
                        yPct: (col.startTextY / page.viewBoxHeight) * 100,
                        pageNumber: page.pageNumber,
                      });
                    }}
                  >
                    [Départ masqué]
                  </text>
                )}

                {/* Steps inside this column */}
                {col.steps.map((s) => {
                  const isSelected = selectedStepId === s.step.id;
                  const isHovered = hoveredStepId === s.step.id;
                  const isHighlighted = isSelected || isHovered;
                  const isEditingThisText =
                    inPlaceEdit?.kind === 'step-text' &&
                    inPlaceEdit.stepId === s.step.id;
                  const isEditingThisNum =
                    inPlaceEdit?.kind === 'step-number' &&
                    inPlaceEdit.stepId === s.step.id;

                  const vx = s.svgX1 - s.svgX0;
                  const vy = s.svgY1 - s.svgY0;
                  const len = Math.hypot(vx, vy);
                  const trim = Math.min(len * 0.4, headL * 0.65);
                  const lineEndX = len > 0 ? s.svgX1 - (vx / len) * trim : s.svgX1;
                  const lineEndY = len > 0 ? s.svgY1 - (vy / len) * trim : s.svgY1;

                  const arrowColor = isSelected
                    ? '#059669'
                    : !invertDark && s.step.customColor
                      ? s.step.customColor
                      : effectiveArrowEdge;
                  const arrowMarkerId = isSelected
                    ? selectedMarkerId
                    : !invertDark && s.step.customColor
                      ? `${markerId}-step-${s.step.id}`
                      : markerId;
                  const textColor = isSelected
                    ? '#059669'
                    : !invertDark && s.step.customTextColor
                      ? s.step.customTextColor
                      : effectiveInk;
                  const numColor = isSelected ? '#059669' : effectiveNumColor;

                  const longestLineLen = Math.max(
                    4,
                    ...s.lines.map((l) => l.length)
                  );
                  const estWidth = Math.max(
                    64,
                    longestLineLen * baseFontPx * 0.58 + 14
                  );
                  const estHeight = Math.max(
                    22,
                    s.lines.length * lineHeightPx + 10
                  );
                  const hitX =
                    s.textAnchor === 'start'
                      ? s.textX - 6
                      : s.textAnchor === 'end'
                        ? s.textX - estWidth + 6
                        : s.textX - estWidth / 2;
                  const hitY =
                    s.dominantBaseline === 'hanging'
                      ? s.textY - 4
                      : s.dominantBaseline === 'auto'
                        ? s.textY - estHeight + 2
                        : s.textY - estHeight / 2;

                  const nr =
                    (isHighlighted
                      ? config.axis.nodeSize + 1.5
                      : config.axis.nodeSize) * fontScale;

                  return (
                    <g
                      key={s.step.id}
                      onMouseEnter={() => setHoveredStepId(s.step.id)}
                      onMouseLeave={() => setHoveredStepId(null)}
                    >
                      {/* Node */}
                      <g
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInPlaceEdit(null);
                          onSelectStep(s.step.id);
                          onSelectElement({
                            kind: 'step-arrow',
                            stepId: s.step.id,
                            xPct: (s.svgX1 / page.viewBoxWidth) * 100,
                            yPct: (s.svgY1 / page.viewBoxHeight) * 100,
                            pageNumber: page.pageNumber,
                          });
                        }}
                      >
                        {config.axis.nodeStyle === 'circle' && (
                          <circle
                            cx={s.svgX0}
                            cy={s.svgY0}
                            r={nr}
                            fill={isSelected ? '#059669' : effectiveNode}
                          />
                        )}
                        {config.axis.nodeStyle === 'ring' && (
                          <circle
                            cx={s.svgX0}
                            cy={s.svgY0}
                            r={nr}
                            fill={isDarkSurface ? '#0F172A' : '#FFFFFF'}
                            stroke={isSelected ? '#059669' : effectiveNode}
                            strokeWidth={2}
                          />
                        )}
                        {config.axis.nodeStyle === 'square' && (
                          <rect
                            x={s.svgX0 - nr}
                            y={s.svgY0 - nr}
                            width={nr * 2}
                            height={nr * 2}
                            fill={isSelected ? '#059669' : effectiveNode}
                          />
                        )}
                        {config.axis.nodeStyle === 'diamond' && (
                          <polygon
                            points={`${s.svgX0},${s.svgY0 - nr * 1.3} ${s.svgX0 + nr * 1.3},${s.svgY0} ${s.svgX0},${s.svgY0 + nr * 1.3} ${s.svgX0 - nr * 1.3},${s.svgY0}`}
                            fill={isSelected ? '#059669' : effectiveNode}
                          />
                        )}
                        {config.axis.nodeStyle === 'none' && (
                          <circle
                            cx={s.svgX0}
                            cy={s.svgY0}
                            r={6}
                            fill="transparent"
                          />
                        )}
                      </g>

                      {/* Number */}
                      {config.numbering.enabled && (
                        <g
                          className="cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectStep(s.step.id);
                            setInPlaceEdit({
                              kind: 'step-number',
                              stepId: s.step.id,
                            });
                            onSelectElement({
                              kind: 'step-number',
                              stepId: s.step.id,
                              xPct: (s.numX / page.viewBoxWidth) * 100,
                              yPct: (s.numY / page.viewBoxHeight) * 100,
                              pageNumber: page.pageNumber,
                            });
                          }}
                        >
                          <rect
                            x={
                              s.numAnchor === 'end'
                                ? s.numX - 28
                                : s.numAnchor === 'start'
                                  ? s.numX - 4
                                  : s.numX - 15
                            }
                            y={s.numY - 12}
                            width={32}
                            height={24}
                            rx={4}
                            fill="transparent"
                            className="hover:fill-emerald-500/10"
                          />
                          {config.numbering.badgeShape !== 'none' &&
                            (() => {
                              const badgeR = Math.max(9, numFontPx * 0.78);
                              const badgeFill = config.numbering.badgeFilled
                                ? invertDark
                                  ? '#1E293B'
                                  : config.numbering.badgeFillColor
                                : 'none';
                              const badgeStroke = isSelected
                                ? '#059669'
                                : invertDark
                                  ? '#F8FAFC'
                                  : config.numbering.badgeBorderColor ||
                                    config.numbering.color;
                              const badgeSw = Math.max(
                                0.8,
                                config.numbering.badgeBorderWidth || 1.3
                              );

                              if (config.numbering.badgeShape === 'circle') {
                                return (
                                  <circle
                                    cx={s.numX}
                                    cy={s.numY}
                                    r={badgeR}
                                    fill={badgeFill}
                                    stroke={badgeStroke}
                                    strokeWidth={badgeSw}
                                  />
                                );
                              }
                              if (config.numbering.badgeShape === 'rounded') {
                                const halfW = Math.max(
                                  badgeR,
                                  (s.displayNumber.length * numFontPx * 0.54) /
                                    2 +
                                    5
                                );
                                const halfH = badgeR * 0.9;
                                return (
                                  <rect
                                    x={s.numX - halfW}
                                    y={s.numY - halfH}
                                    width={halfW * 2}
                                    height={halfH * 2}
                                    rx={halfH * 0.65}
                                    fill={badgeFill}
                                    stroke={badgeStroke}
                                    strokeWidth={badgeSw}
                                  />
                                );
                              }
                              if (config.numbering.badgeShape === 'square') {
                                return (
                                  <rect
                                    x={s.numX - badgeR}
                                    y={s.numY - badgeR}
                                    width={badgeR * 2}
                                    height={badgeR * 2}
                                    rx={2}
                                    fill={badgeFill}
                                    stroke={badgeStroke}
                                    strokeWidth={badgeSw}
                                  />
                                );
                              }
                              const pts = getBadgePolygonPoints(
                                s.numX,
                                s.numY,
                                badgeR,
                                config.numbering.badgeShape
                              );
                              return (
                                <polygon
                                  points={pts}
                                  fill={badgeFill}
                                  stroke={badgeStroke}
                                  strokeWidth={badgeSw}
                                />
                              );
                            })()}
                          <text
                            x={s.numX}
                            y={s.numY}
                            textAnchor={
                              config.numbering.badgeShape !== 'none'
                                ? 'middle'
                                : s.numAnchor
                            }
                            dominantBaseline={
                              config.numbering.badgeShape !== 'none'
                                ? 'central'
                                : 'middle'
                            }
                            fontFamily={numFamily}
                            fontSize={
                              config.numbering.badgeShape !== 'none'
                                ? numFontPx * 0.82
                                : numFontPx
                            }
                            fontWeight={numWeight}
                            fill={numColor}
                            opacity={isEditingThisNum ? 0 : 1}
                          >
                            {s.displayNumber}
                          </text>
                        </g>
                      )}

                      {/* Arrow hit area */}
                      <line
                        x1={s.svgX0}
                        y1={s.svgY0}
                        x2={s.svgX1}
                        y2={s.svgY1}
                        stroke="transparent"
                        strokeWidth={18}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInPlaceEdit(null);
                          onSelectStep(s.step.id);
                          onSelectElement({
                            kind: 'step-arrow',
                            stepId: s.step.id,
                            xPct: (s.svgX1 / page.viewBoxWidth) * 100,
                            yPct: (s.svgY1 / page.viewBoxHeight) * 100,
                            pageNumber: page.pageNumber,
                          });
                        }}
                      />

                      {/* Arrow */}
                      <line
                        x1={s.svgX0}
                        y1={s.svgY0}
                        x2={lineEndX}
                        y2={lineEndY}
                        stroke={arrowColor}
                        strokeWidth={isHighlighted ? arrowShaftW + 0.6 : arrowShaftW}
                        strokeLinecap="butt"
                        markerEnd={`url(#${arrowMarkerId})`}
                        className="pointer-events-none"
                      />

                      {/* Drag rotation handle */}
                      {isHighlighted && (
                        <circle
                          cx={s.svgX1}
                          cy={s.svgY1}
                          r={7}
                          fill="#059669"
                          fillOpacity={0.18}
                          stroke="#059669"
                          strokeWidth={1.5}
                          className="cursor-grab active:cursor-grabbing"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            setInPlaceEdit(null);
                            onSelectStep(s.step.id);
                            setDraggingStepId(s.step.id);
                            setDragAzimuth(s.step.azimut);
                          }}
                        >
                          <title>
                            Glisser pour orienter l'azimut (Maj pour pas de 5°)
                          </title>
                        </circle>
                      )}

                      {/* Step Label */}
                      <g
                        className="cursor-text"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectStep(s.step.id);
                          setInPlaceEdit({
                            kind: 'step-text',
                            stepId: s.step.id,
                          });
                          onSelectElement({
                            kind: 'step-text',
                            stepId: s.step.id,
                            xPct: (s.textX / page.viewBoxWidth) * 100,
                            yPct: (s.textY / page.viewBoxHeight) * 100,
                            pageNumber: page.pageNumber,
                          });
                        }}
                      >
                        <rect
                          x={hitX}
                          y={hitY}
                          width={estWidth}
                          height={estHeight}
                          rx={4}
                          fill={
                            isSelected && !isEditingThisText
                              ? 'rgba(16, 185, 129, 0.08)'
                              : isHovered && !isEditingThisText
                                ? 'rgba(15, 23, 42, 0.04)'
                                : 'transparent'
                          }
                          stroke={
                            isSelected && !isEditingThisText
                              ? 'rgba(5, 150, 105, 0.4)'
                              : isHovered && !isEditingThisText
                                ? 'rgba(100, 116, 139, 0.25)'
                                : 'transparent'
                          }
                          strokeDasharray={isSelected ? undefined : '3 2'}
                          strokeWidth={1}
                        />
                        <text
                          x={s.textX}
                          y={s.textY}
                          textAnchor={s.textAnchor}
                          dominantBaseline={s.dominantBaseline}
                          fontFamily={stepFamily}
                          fontSize={baseFontPx}
                          fontWeight={stepWeight}
                          fill={textColor}
                          opacity={isEditingThisText ? 0 : 1}
                        >
                          {s.lines.map((line, lineIdx) => {
                            const dyVal =
                              lineIdx === 0
                                ? s.dominantBaseline === 'auto' &&
                                  s.lines.length > 1
                                  ? -(s.lines.length - 1) * lineHeightPx
                                  : 0
                                : lineHeightPx;
                            return (
                              <tspan key={lineIdx} x={s.textX} dy={dyVal}>
                                {line}
                              </tspan>
                            );
                          })}
                        </text>
                      </g>
                    </g>
                  );
                })}

                {/* In-place North Editor for this column */}
                {isEditingThisNorth && (
                  <foreignObject
                    x={col.axisX - 95}
                    y={col.northTextY - titleFontPx * 1.15}
                    width={190}
                    height={titleFontPx * 1.6}
                  >
                    <InPlaceTextInput
                      initialValue={config.northLabel}
                      fontFamily={northFamily}
                      fontSize={titleFontPx}
                      fontWeight={northWeight}
                      color={effectiveNorthText}
                      textAlign="center"
                      onCommit={(val) =>
                        commitInPlaceText({ kind: 'north', colKey: col.startKey }, val)
                      }
                      onCancel={() => setInPlaceEdit(null)}
                    />
                  </foreignObject>
                )}

                {/* In-place Start/Suite Editor for this exact column */}
                {isEditingThisStart && (
                  <foreignObject
                    x={col.axisX - 110}
                    y={col.startTextY - startFontPx * 0.9}
                    width={220}
                    height={startFontPx * 1.8}
                  >
                    <InPlaceTextInput
                      initialValue={
                        config.pageStartOverrides[col.startKey] ?? col.startLabel
                      }
                      fontFamily={startFamily}
                      fontSize={startFontPx}
                      fontWeight={startWeight}
                      color={effectiveStart}
                      textAlign="center"
                      onCommit={(val) =>
                        commitInPlaceText({ kind: 'start', colKey: col.startKey }, val)
                      }
                      onCancel={() => setInPlaceEdit(null)}
                    />
                  </foreignObject>
                )}
              </g>
            );
          })}

          {/* In-place Step Number Editor */}
          {inPlaceEdit?.kind === 'step-number' &&
            (() => {
              const targetS = page.steps.find(
                (st) => st.step.id === inPlaceEdit.stepId
              );
              if (!targetS) return null;
              const boxW = 64;
              const boxH = numFontPx * 1.7;
              const fx =
                targetS.numAnchor === 'end'
                  ? targetS.numX - boxW + 4
                  : targetS.numAnchor === 'start'
                    ? targetS.numX - 4
                    : targetS.numX - boxW / 2;
              return (
                <foreignObject
                  x={fx}
                  y={targetS.numY - boxH / 2}
                  width={boxW}
                  height={boxH}
                >
                  <InPlaceTextInput
                    initialValue={targetS.displayNumber}
                    fontFamily={numFamily}
                    fontSize={numFontPx}
                    fontWeight={numWeight}
                    color="#059669"
                    textAlign={
                      config.numbering.badgeShape !== 'none'
                        ? 'center'
                        : targetS.numAnchor === 'end'
                          ? 'right'
                          : targetS.numAnchor === 'start'
                            ? 'left'
                            : 'center'
                    }
                    onCommit={(val) =>
                      commitInPlaceText(
                        { kind: 'step-number', stepId: targetS.step.id },
                        val
                      )
                    }
                    onCancel={() => setInPlaceEdit(null)}
                  />
                </foreignObject>
              );
            })()}

          {/* In-place Step Text Editor */}
          {inPlaceEdit?.kind === 'step-text' &&
            (() => {
              const targetS = page.steps.find(
                (st) => st.step.id === inPlaceEdit.stepId
              );
              if (!targetS) return null;
              const boxW = Math.max(120, Math.round(190 * fontScale));
              const boxH = Math.max(36, (targetS.lines.length + 1) * lineHeightPx);
              const fx =
                targetS.textAnchor === 'start'
                  ? targetS.textX - 2
                  : targetS.textAnchor === 'end'
                    ? targetS.textX - boxW + 2
                    : targetS.textX - boxW / 2;
              const fy =
                targetS.dominantBaseline === 'hanging'
                  ? targetS.textY - 4
                  : targetS.dominantBaseline === 'auto'
                    ? targetS.textY - boxH + 6
                    : targetS.textY - boxH / 2;
              return (
                <foreignObject x={fx} y={fy} width={boxW} height={boxH}>
                  <InPlaceMultilineInput
                    initialValue={targetS.rawText}
                    fontFamily={stepFamily}
                    fontSize={baseFontPx}
                    color={effectiveInk}
                    textAlign={
                      targetS.textAnchor === 'start'
                        ? 'left'
                        : targetS.textAnchor === 'end'
                          ? 'right'
                          : 'center'
                    }
                    onCommit={(val) =>
                      commitInPlaceText(
                        { kind: 'step-text', stepId: targetS.step.id },
                        val
                      )
                    }
                    onCancel={() => setInPlaceEdit(null)}
                  />
                </foreignObject>
              );
            })()}
        </svg>

        {/* Live azimuth readout while dragging arrowhead */}
        {draggingStepId && dragAzimuth !== null && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-md tabular-nums">
            Azimut : {dragAzimuth}°
          </div>
        )}

        {/* Contextual Element Inspector Popover */}
        {elementOnThisPage && (
          <ElementInspectorPopover
            target={elementOnThisPage}
            config={config}
            step={popoverStepLayout?.step ?? null}
            stepDisplayIndex={popoverStepLayout?.originalIndex ?? 0}
            column={popoverColumn}
            onClose={() => onSelectElement(null)}
            onUpdateConfig={onUpdateConfig}
            onUpdateStep={onUpdateStep}
            onAddStepAfter={onAddStepAfter}
            onDeleteStep={onDeleteStep}
          />
        )}
      </div>
    </div>
  );
}

interface InPlaceTextInputProps {
  initialValue: string;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function InPlaceTextInput({
  initialValue,
  fontFamily,
  fontSize,
  fontWeight = 400,
  color,
  textAlign,
  onCommit,
  onCancel,
}: InPlaceTextInputProps) {
  const [val, setVal] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onCommit(val);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: '1.5px dashed #059669',
        outline: 'none',
        padding: 0,
        margin: 0,
        fontFamily,
        fontSize: `${fontSize}px`,
        fontWeight,
        color,
        textAlign,
      }}
    />
  );
}

interface InPlaceMultilineInputProps {
  initialValue: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  onCommit: (value: string) => void;
  onCancel: () => void;
}

function InPlaceMultilineInput({
  initialValue,
  fontFamily,
  fontSize,
  color,
  textAlign,
  onCommit,
  onCancel,
}: InPlaceMultilineInputProps) {
  const [val, setVal] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <textarea
      ref={ref}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => onCommit(val)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          onCommit(val);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
        border: 'none',
        borderBottom: '1.5px dashed #059669',
        outline: 'none',
        resize: 'none',
        overflow: 'hidden',
        padding: '1px 2px',
        margin: 0,
        lineHeight: 1.25,
        fontFamily,
        fontSize: `${fontSize}px`,
        color,
        textAlign,
      }}
    />
  );
}
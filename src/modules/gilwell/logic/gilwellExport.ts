/**
 * Gilwell Module — Export Utilities
 * Browser-only helpers for downloading SVG/PNG.
 */

import type { ComputedGilwellPage, GilwellConfig } from './types';
import { GilwellEngine } from './GilwellEngine';

export function triggerFileDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSvgPage(
  page: ComputedGilwellPage,
  config: GilwellConfig
): void {
  const svgString = GilwellEngine.renderPageToSvgString(page, config);
  const suffix = page.totalPages > 1 ? `_page_${page.pageNumber}` : '';
  const filename = `schema_gilwell${suffix}.svg`;
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  triggerFileDownload(blob, filename);
}

export async function renderSvgToPngBlob(
  page: ComputedGilwellPage,
  config: GilwellConfig,
  dpi: number = 300
): Promise<Blob> {
  const svgString = GilwellEngine.renderPageToSvgString(page, config);
  const scaleFactor = dpi / 96;
  const pxWidth = Math.round((page.widthCm / 2.54) * dpi);
  const aspect = page.viewBoxHeight / page.viewBoxWidth;
  const pxHeight = Math.round(pxWidth * aspect);

  // Use explicit pixel dimensions for crisp rasterization in Canvas
  const sizedSvg = svgString
    .replace(/width="[^"]+"/, `width="${pxWidth}"`)
    .replace(/height="[^"]+"/, `height="${pxHeight}"`);

  const svgBlob = new Blob([sizedSvg], {
    type: 'image/svg+xml;charset=utf-8',
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, pxWidth);
    canvas.height = Math.max(1, pxHeight || Math.round(page.viewBoxHeight * scaleFactor));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Impossible d'initialiser le contexte Canvas 2D.");
    }

    if (!config.transparentBackground) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Échec de la conversion PNG.'));
      }, 'image/png');
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadPngPage(
  page: ComputedGilwellPage,
  config: GilwellConfig,
  dpi: number = 300
): Promise<void> {
  const blob = await renderSvgToPngBlob(page, config, dpi);
  const suffix = page.totalPages > 1 ? `_page_${page.pageNumber}` : '';
  const filename = `schema_gilwell${suffix}.png`;
  triggerFileDownload(blob, filename);
}
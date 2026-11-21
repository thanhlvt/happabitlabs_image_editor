import UPNG from 'upng-js';
import type { CanvasConfig, ExportFormat, Layer } from '../types/editor';
import { loadImageElement } from './fileHelpers';
import { renderFogToCanvas } from './fogRenderer';
import { clamp } from './geometry';
import {
  applyImageAdjustmentsToCanvas,
  hasActiveAdjustments,
} from './imageFilters';

export interface RenderCompositeOptions {
  scale?: number;
  /** Stop before rendering this layer index (useful for computing backdrop of a fog layer) */
  stopBeforeIndex?: number;
  /** Preloaded HTMLImageElements keyed by ImageLayer.src */
  imageCache?: Map<string, HTMLImageElement>;
}

/**
 * Render the entire canvas (or layers up to stopBeforeIndex) into an offscreen HTMLCanvasElement.
 * Transparent background (backgroundColor === null) preserves full RGBA alpha channel.
 */
export async function renderCompositeCanvas(
  canvasConfig: CanvasConfig,
  layers: Layer[],
  options: RenderCompositeOptions = {}
): Promise<HTMLCanvasElement> {
  const scale = options.scale ?? 1;
  const outWidth = Math.max(1, Math.round(canvasConfig.width * scale));
  const outHeight = Math.max(1, Math.round(canvasConfig.height * scale));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outWidth;
  outCanvas.height = outHeight;

  const ctx = outCanvas.getContext('2d');
  if (!ctx) return outCanvas;

  ctx.clearRect(0, 0, outWidth, outHeight);

  if (canvasConfig.backgroundColor) {
    ctx.fillStyle = canvasConfig.backgroundColor;
    ctx.fillRect(0, 0, outWidth, outHeight);
  }

  const imageCache = options.imageCache ?? new Map<string, HTMLImageElement>();
  const limit = options.stopBeforeIndex ?? layers.length;

  for (let i = 0; i < limit && i < layers.length; i++) {
    const layer = layers[i];
    if (!layer.visible || layer.opacity <= 0) continue;

    ctx.save();
    ctx.globalAlpha = layer.opacity;

    if (layer.type === 'image') {
      let img = imageCache.get(layer.src);
      if (!img) {
        img = await loadImageElement(layer.src);
        imageCache.set(layer.src, img);
      }

      const sourceDrawable: CanvasImageSource = hasActiveAdjustments(
        layer.adjustments
      )
        ? applyImageAdjustmentsToCanvas(img, layer.adjustments)
        : img;

      const cx = (layer.x + layer.width / 2) * scale;
      const cy = (layer.y + layer.height / 2) * scale;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
      ctx.drawImage(
        sourceDrawable,
        layer.cropX,
        layer.cropY,
        layer.cropWidth,
        layer.cropHeight,
        (-layer.width * scale) / 2,
        (-layer.height * scale) / 2,
        layer.width * scale,
        layer.height * scale
      );
    } else if (layer.type === 'fog') {
      // Snapshot current composite as backdrop for this fog layer
      const backdrop = document.createElement('canvas');
      backdrop.width = outWidth;
      backdrop.height = outHeight;
      const bCtx = backdrop.getContext('2d');
      if (bCtx) {
        bCtx.drawImage(outCanvas, 0, 0);
      }

      const scaledFog = {
        ...layer,
        x: layer.x * scale,
        y: layer.y * scale,
        width: layer.width * scale,
        height: layer.height * scale,
        blurRadius: layer.blurRadius * scale,
        borderRadius: layer.borderRadius * scale,
      };

      const fogCanvas = renderFogToCanvas(scaledFog, backdrop);
      const cx = (layer.x + layer.width / 2) * scale;
      const cy = (layer.y + layer.height / 2) * scale;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
      ctx.drawImage(fogCanvas, (-layer.width * scale) / 2, (-layer.height * scale) / 2);
    }

    ctx.restore();
  }

  return outCanvas;
}

/**
 * Map PNG compression level (1..10, default 8) to UPNG color quantization count (cnum).
 * - 1..3: 0 (lossless 32-bit RGBA PNG)
 * - 4..10: smart quantized RGBA (preserves 8-bit alpha, higher level = smaller file)
 */
export function mapPngCompressionToColors(level: number): number {
  const lv = Math.round(clamp(level, 1, 10));
  if (lv <= 3) return 0;
  const table: Record<number, number> = {
    4: 1024,
    5: 512,
    6: 384,
    7: 320,
    8: 256,
    9: 160,
    10: 96,
  };
  return table[lv] ?? 256;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Encode an HTMLCanvasElement to a compressed PNG Data URL (preserving full RGBA alpha).
 */
export function encodeCanvasToPngDataUrl(
  canvas: HTMLCanvasElement,
  compressionLevel = 8
): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  // Copy into a tightly-packed ArrayBuffer for UPNG
  const rgbaBuffer = imageData.data.buffer.slice(
    imageData.data.byteOffset,
    imageData.data.byteOffset + imageData.data.byteLength
  );
  const cnum = mapPngCompressionToColors(compressionLevel);
  const pngBuffer = UPNG.encode([rgbaBuffer], width, height, cnum);
  return `data:image/png;base64,${arrayBufferToBase64(pngBuffer)}`;
}

/**
 * Export canvas to a Data URL (PNG keeps full RGBA alpha channel and supports compression 1-10).
 */
export async function exportCanvasToDataUrl(
  canvasConfig: CanvasConfig,
  layers: Layer[],
  format: ExportFormat = 'image/png',
  quality = 0.92,
  scale = 1,
  pngCompression = 8
): Promise<string> {
  // For JPEG (no alpha channel), flatten onto white if backgroundColor is null
  const effectiveConfig: CanvasConfig =
    format === 'image/jpeg' && !canvasConfig.backgroundColor
      ? { ...canvasConfig, backgroundColor: '#ffffff' }
      : canvasConfig;

  const rendered = await renderCompositeCanvas(effectiveConfig, layers, { scale });
  if (format === 'image/png') {
    return encodeCanvasToPngDataUrl(rendered, pngCompression);
  }
  return rendered.toDataURL(format, quality);
}

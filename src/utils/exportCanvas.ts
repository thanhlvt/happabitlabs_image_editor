import type { CanvasConfig, ExportFormat, Layer } from '../types/editor';
import { loadImageElement } from './fileHelpers';
import { renderFogToCanvas } from './fogRenderer';
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
      ctx.drawImage(fogCanvas, (-layer.width * scale) / 2, (-layer.height * scale) / 2);
    }

    ctx.restore();
  }

  return outCanvas;
}

/**
 * Export canvas to a Data URL (PNG keeps full RGBA alpha channel).
 */
export async function exportCanvasToDataUrl(
  canvasConfig: CanvasConfig,
  layers: Layer[],
  format: ExportFormat = 'image/png',
  quality = 0.92,
  scale = 1
): Promise<string> {
  // For JPEG (no alpha channel), flatten onto white if backgroundColor is null
  const effectiveConfig: CanvasConfig =
    format === 'image/jpeg' && !canvasConfig.backgroundColor
      ? { ...canvasConfig, backgroundColor: '#ffffff' }
      : canvasConfig;

  const rendered = await renderCompositeCanvas(effectiveConfig, layers, { scale });
  return rendered.toDataURL(format, quality);
}

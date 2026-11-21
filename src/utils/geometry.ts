import type { CropRect, Layer } from '../types/editor';

/**
 * Clamp a number between min and max.
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Calculate height from width given an aspect ratio (w / h), or vice versa.
 */
export function computeAspectDimensions(
  changed: 'width' | 'height',
  value: number,
  aspectRatio: number
): { width: number; height: number } {
  const safeVal = Math.max(1, Math.round(value));
  const safeRatio = aspectRatio > 0 ? aspectRatio : 1;
  if (changed === 'width') {
    return {
      width: safeVal,
      height: Math.max(1, Math.round(safeVal / safeRatio)),
    };
  }
  return {
    width: Math.max(1, Math.round(safeVal * safeRatio)),
    height: safeVal,
  };
}

/**
 * Clamp a crop rectangle so it stays within [0, canvasWidth] x [0, canvasHeight]
 * with a minimum size of minSize.
 */
export function clampCropRect(
  rect: CropRect,
  canvasWidth: number,
  canvasHeight: number,
  minSize = 16
): CropRect {
  const minW = Math.min(minSize, canvasWidth);
  const minH = Math.min(minSize, canvasHeight);

  const width = clamp(Math.round(rect.width), minW, canvasWidth);
  const height = clamp(Math.round(rect.height), minH, canvasHeight);
  const x = clamp(Math.round(rect.x), 0, Math.max(0, canvasWidth - width));
  const y = clamp(Math.round(rect.y), 0, Math.max(0, canvasHeight - height));

  return { x, y, width, height };
}

/**
 * Compute a centered crop rectangle for a given aspect ratio inside a canvas.
 */
export function computeAspectCropRect(
  canvasWidth: number,
  canvasHeight: number,
  aspectRatio: number | null
): CropRect {
  if (!aspectRatio || aspectRatio <= 0) {
    const padX = Math.round(canvasWidth * 0.1);
    const padY = Math.round(canvasHeight * 0.1);
    return clampCropRect(
      {
        x: padX,
        y: padY,
        width: canvasWidth - padX * 2,
        height: canvasHeight - padY * 2,
      },
      canvasWidth,
      canvasHeight
    );
  }

  let width = canvasWidth * 0.8;
  let height = width / aspectRatio;
  if (height > canvasHeight * 0.8) {
    height = canvasHeight * 0.8;
    width = height * aspectRatio;
  }

  return clampCropRect(
    {
      x: Math.round((canvasWidth - width) / 2),
      y: Math.round((canvasHeight - height) / 2),
      width: Math.round(width),
      height: Math.round(height),
    },
    canvasWidth,
    canvasHeight
  );
}

/**
 * Scale a list of layers proportionally when resizing the canvas.
 */
export function scaleLayersForResize(
  layers: Layer[],
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): Layer[] {
  if (oldWidth <= 0 || oldHeight <= 0) return layers;
  const sx = newWidth / oldWidth;
  const sy = newHeight / oldHeight;

  return layers.map((layer) => ({
    ...layer,
    x: Math.round(layer.x * sx),
    y: Math.round(layer.y * sy),
    width: Math.max(1, Math.round(layer.width * sx)),
    height: Math.max(1, Math.round(layer.height * sy)),
    ...(layer.type === 'fog'
      ? {
          blurRadius: Math.round(layer.blurRadius * Math.min(sx, sy)),
          borderRadius: Math.round(layer.borderRadius * Math.min(sx, sy)),
        }
      : {}),
  }));
}

/**
 * Translate layers after cropping the canvas to cropRect.
 */
export function translateLayersForCrop(layers: Layer[], cropRect: CropRect): Layer[] {
  return layers.map((layer) => ({
    ...layer,
    x: Math.round(layer.x - cropRect.x),
    y: Math.round(layer.y - cropRect.y),
  }));
}

/**
 * Compute linear gradient start and end coordinates inside a rectangle of size (w, h)
 * given an angle in degrees (CSS-like: 0deg = bottom->top, 90deg = left->right, 180deg = top->bottom)
 * and a spread multiplier (0.1 to 2.0).
 */
export function computeLinearGradientPoints(
  width: number,
  height: number,
  angleDeg: number,
  spread = 1
): { x0: number; y0: number; x1: number; y1: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  // Half-length of projection of the box onto the gradient direction
  const halfLen = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const scaledHalf = halfLen * Math.max(0.1, spread);

  return {
    x0: cx - dx * scaledHalf,
    y0: cy - dy * scaledHalf,
    x1: cx + dx * scaledHalf,
    y1: cy + dy * scaledHalf,
  };
}

export type FitMode = 'width' | 'height' | 'all';

/**
 * Compute new { x, y, width, height, rotation } to fit a layer inside the canvas
 * while preserving its aspect ratio.
 */
export function computeLayerFit(
  layer: Layer,
  canvasWidth: number,
  canvasHeight: number,
  mode: FitMode
): { x: number; y: number; width: number; height: number; rotation: number } {
  const aspect =
    layer.type === 'image' && layer.cropWidth > 0 && layer.cropHeight > 0
      ? layer.cropWidth / layer.cropHeight
      : layer.width / Math.max(1, layer.height);

  let width = canvasWidth;
  let height = canvasHeight;

  if (mode === 'width') {
    width = canvasWidth;
    height = Math.max(1, Math.round(width / aspect));
  } else if (mode === 'height') {
    height = canvasHeight;
    width = Math.max(1, Math.round(height * aspect));
  } else {
    // 'all' — fit entirely inside canvas
    if (canvasWidth / Math.max(1, canvasHeight) > aspect) {
      height = canvasHeight;
      width = Math.max(1, Math.round(height * aspect));
    } else {
      width = canvasWidth;
      height = Math.max(1, Math.round(width / aspect));
    }
  }

  return {
    x: Math.round((canvasWidth - width) / 2),
    y: Math.round((canvasHeight - height) / 2),
    width,
    height,
    rotation: 0,
  };
}

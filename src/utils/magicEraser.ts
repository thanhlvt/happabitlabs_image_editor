import type { ImageLayer, MagicEraserMode } from '../types/editor';
import { clamp } from './geometry';
import { loadImageElement } from './fileHelpers';

export interface ImagePixelPoint {
  px: number;
  py: number;
}

/**
 * Convert a canvas coordinate (canvasX, canvasY) to natural image pixel coordinates
 * accounting for layer position, size, rotation, flipX/flipY, and crop.
 * Returns null if the point is outside the layer bounds.
 */
export function canvasPointToImagePixel(
  canvasX: number,
  canvasY: number,
  layer: ImageLayer
): ImagePixelPoint | null {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const dx = canvasX - cx;
  const dy = canvasY - cy;

  const rad = (-layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  let rx = dx * cos - dy * sin;
  let ry = dx * sin + dy * cos;

  if (layer.flipX) rx = -rx;
  if (layer.flipY) ry = -ry;

  const u = (rx + layer.width / 2) / Math.max(1, layer.width);
  const v = (ry + layer.height / 2) / Math.max(1, layer.height);

  if (u < 0 || u > 1 || v < 0 || v > 1) return null;

  const maxW = Math.max(1, layer.naturalWidth);
  const maxH = Math.max(1, layer.naturalHeight);
  const px = clamp(Math.floor(layer.cropX + u * layer.cropWidth), 0, maxW - 1);
  const py = clamp(Math.floor(layer.cropY + v * layer.cropHeight), 0, maxH - 1);

  return { px, py };
}

/**
 * Mode 1: BFS Flood Fill erase from (startX, startY) for contiguous pixels
 * whose RGB distance from the seed pixel is within tolerance (0..100).
 * Returns number of pixels erased.
 */
export function floodFillErase(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number
): number {
  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return 0;

  const seedIdx = (startY * width + startX) * 4;
  if (data[seedIdx + 3] === 0) return 0;

  const seedR = data[seedIdx];
  const seedG = data[seedIdx + 1];
  const seedB = data[seedIdx + 2];

  const maxDist = (clamp(tolerance, 0, 100) / 100) * 260;
  const maxDistSq = maxDist * maxDist;

  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const startPos = startY * width + startX;
  queue[tail++] = startPos;
  visited[startPos] = 1;

  let erased = 0;

  while (head < tail) {
    const pos = queue[head++];
    const idx = pos * 4;

    if (data[idx + 3] === 0) continue;

    const dr = data[idx] - seedR;
    const dg = data[idx + 1] - seedG;
    const db = data[idx + 2] - seedB;
    if (dr * dr + dg * dg + db * db > maxDistSq) continue;

    data[idx + 3] = 0;
    erased += 1;

    const x = pos % width;
    const y = (pos - x) / width;

    if (x > 0) {
      const n = pos - 1;
      if (!visited[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (x + 1 < width) {
      const n = pos + 1;
      if (!visited[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y > 0) {
      const n = pos - width;
      if (!visited[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y + 1 < height) {
      const n = pos + width;
      if (!visited[n]) {
        visited[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  return erased;
}

/**
 * Mode 2: Erase all pixels inside an ellipse/circle centered at (centerX, centerY)
 * with radii (radiusX, radiusY).
 * Returns number of pixels erased.
 */
export function circleErase(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY = radiusX
): number {
  const rx = Math.max(1, radiusX);
  const ry = Math.max(1, radiusY);

  const minX = clamp(Math.floor(centerX - rx), 0, width - 1);
  const maxX = clamp(Math.ceil(centerX + rx), 0, width - 1);
  const minY = clamp(Math.floor(centerY - ry), 0, height - 1);
  const maxY = clamp(Math.ceil(centerY + ry), 0, height - 1);

  let erased = 0;
  for (let y = minY; y <= maxY; y++) {
    const ny = (y - centerY) / ry;
    const nySq = ny * ny;
    for (let x = minX; x <= maxX; x++) {
      const nx = (x - centerX) / rx;
      if (nx * nx + nySq <= 1) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] !== 0) {
          data[idx + 3] = 0;
          erased += 1;
        }
      }
    }
  }

  return erased;
}

export interface EraseAtPointParams {
  layer: ImageLayer;
  canvasX: number;
  canvasY: number;
  mode: MagicEraserMode;
  tolerance: number;
  radius: number;
}

/**
 * Apply Magic Background Eraser at a canvas point on an ImageLayer and return
 * the updated PNG Data URL (or null if point was outside or nothing changed).
 */
export async function eraseImageAtCanvasPoint({
  layer,
  canvasX,
  canvasY,
  mode,
  tolerance,
  radius,
}: EraseAtPointParams): Promise<string | null> {
  const pt = canvasPointToImagePixel(canvasX, canvasY, layer);
  if (!pt) return null;

  const img = await loadImageElement(layer.src);
  const w = img.naturalWidth || img.width || layer.naturalWidth;
  const h = img.naturalHeight || img.height || layer.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);

  let erased = 0;
  if (mode === 'flood') {
    erased = floodFillErase(imageData.data, w, h, pt.px, pt.py, tolerance);
  } else {
    const rx = radius * (layer.cropWidth / Math.max(1, layer.width));
    const ry = radius * (layer.cropHeight / Math.max(1, layer.height));
    erased = circleErase(imageData.data, w, h, pt.px, pt.py, rx, ry);
  }

  if (erased === 0) return null;

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

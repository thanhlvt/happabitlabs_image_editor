import type { BackgroundRemovalConfig, ImageAdjustments } from '../types/editor';
import { clamp } from './geometry';
import { hexToRgb } from './fogRenderer';

export function createDefaultBackgroundRemoval(): BackgroundRemovalConfig {
  return {
    enabled: false,
    color: '#ffffff',
    tolerance: 18,
    softness: 10,
  };
}

export function createDefaultImageAdjustments(): ImageAdjustments {
  return {
    brightness: 0,
    contrast: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,
    colorEdits: [],
    backgroundRemoval: createDefaultBackgroundRemoval(),
  };
}

export function hasActiveAdjustments(adj?: ImageAdjustments): boolean {
  if (!adj) return false;
  return (
    adj.brightness !== 0 ||
    adj.contrast !== 0 ||
    adj.temperature !== 0 ||
    adj.tint !== 0 ||
    adj.vibrance !== 0 ||
    adj.saturation !== 0 ||
    adj.colorEdits.length > 0 ||
    Boolean(adj.backgroundRemoval?.enabled)
  );
}

/**
 * Apply Color Edit, White Balance, Brightness, Contrast, Vibrance, and Saturation
 * directly onto a Uint8ClampedArray (RGBA) in place, preserving alpha channel.
 */
export function processImageData(
  data: Uint8ClampedArray,
  adjustments: ImageAdjustments
): void {
  const {
    brightness,
    contrast,
    temperature,
    tint,
    vibrance,
    saturation,
    colorEdits,
    backgroundRemoval,
  } = adjustments;

  const bgRemove = backgroundRemoval?.enabled
    ? {
        rgb: hexToRgb(backgroundRemoval.color || '#ffffff'),
        maxDist: (clamp(backgroundRemoval.tolerance, 0, 100) / 100) * 260,
        softDist: (clamp(backgroundRemoval.softness, 0, 50) / 100) * 260,
      }
    : null;

  const parsedEdits = colorEdits.map((rule) => ({
    src: hexToRgb(rule.sourceColor),
    tgt: hexToRgb(rule.targetColor),
    // Max Euclidean distance in RGB space is ~441.67
    maxDist: (clamp(rule.tolerance, 0, 100) / 100) * 260,
    softDist: (clamp(rule.softness, 0, 50) / 100) * 260,
  }));

  // Contrast factor
  const cVal = clamp(contrast, -100, 100) * 2.55;
  const contrastFactor =
    contrast === 0 ? 1 : (259 * (cVal + 255)) / (255 * (259 - cVal));

  // Brightness offset
  const brightOffset = clamp(brightness, -100, 100) * 2.55;

  // White balance shifts
  const tempShift = clamp(temperature, -100, 100) * 0.9;
  const tintShift = clamp(tint, -100, 100) * 0.7;

  // Saturation & Vibrance
  const satAmt = clamp(saturation, -100, 100) / 100;
  const vibAmt = clamp(vibrance, -100, 100) / 100;

  for (let i = 0; i < data.length; i += 4) {
    // Skip fully transparent pixels
    if (data[i + 3] === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 0. Remove Background (set alpha to 0 for matching color)
    if (bgRemove) {
      const dr = r - bgRemove.rgb.r;
      const dg = g - bgRemove.rgb.g;
      const db = b - bgRemove.rgb.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      if (dist <= bgRemove.maxDist) {
        data[i + 3] = 0;
        continue;
      } else if (
        bgRemove.softDist > 0 &&
        dist <= bgRemove.maxDist + bgRemove.softDist
      ) {
        const factor = (dist - bgRemove.maxDist) / bgRemove.softDist;
        data[i + 3] = clamp(Math.round(data[i + 3] * factor), 0, 255);
      }
    }

    // 1. Color Edit (replace source color with target color)
    for (let j = 0; j < parsedEdits.length; j++) {
      const edit = parsedEdits[j];
      const dr = r - edit.src.r;
      const dg = g - edit.src.g;
      const db = b - edit.src.b;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);

      let blend = 0;
      if (dist <= edit.maxDist) {
        blend = 1;
      } else if (edit.softDist > 0 && dist <= edit.maxDist + edit.softDist) {
        blend = 1 - (dist - edit.maxDist) / edit.softDist;
      }

      if (blend > 0) {
        // Preserve subtle shading relative to source color brightness
        const srcLum = (edit.src.r + edit.src.g + edit.src.b) / 3 || 1;
        const pixLum = (r + g + b) / 3;
        const lumRatio = clamp(pixLum / srcLum, 0.4, 1.6);

        const targetR = clamp(edit.tgt.r * (0.65 + 0.35 * lumRatio), 0, 255);
        const targetG = clamp(edit.tgt.g * (0.65 + 0.35 * lumRatio), 0, 255);
        const targetB = clamp(edit.tgt.b * (0.65 + 0.35 * lumRatio), 0, 255);

        r = r + (targetR - r) * blend;
        g = g + (targetG - g) * blend;
        b = b + (targetB - b) * blend;
      }
    }

    // 2. White Balance (Temperature & Tint)
    if (tempShift !== 0 || tintShift !== 0) {
      r += tempShift + tintShift * 0.35;
      g -= tintShift * 0.7;
      b -= tempShift - tintShift * 0.35;
    }

    // 3. Brightness & Contrast
    if (brightOffset !== 0) {
      r += brightOffset;
      g += brightOffset;
      b += brightOffset;
    }
    if (contrastFactor !== 1) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    r = clamp(r, 0, 255);
    g = clamp(g, 0, 255);
    b = clamp(b, 0, 255);

    // 4. Color Vibrance (selective saturation boost for less-saturated pixels)
    if (vibAmt !== 0) {
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const avg = (r + g + b) / 3;
      const curSat = (maxC - minC) / 255;
      const amt = vibAmt > 0 ? vibAmt * (1 - curSat) * 1.4 : vibAmt;
      r = avg + (r - avg) * (1 + amt);
      g = avg + (g - avg) * (1 + amt);
      b = avg + (b - avg) * (1 + amt);
    }

    // 5. Saturation
    if (satAmt !== 0) {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mult = 1 + satAmt;
      r = lum + (r - lum) * mult;
      g = lum + (g - lum) * mult;
      b = lum + (b - lum) * mult;
    }

    data[i] = clamp(Math.round(r), 0, 255);
    data[i + 1] = clamp(Math.round(g), 0, 255);
    data[i + 2] = clamp(Math.round(b), 0, 255);
  }
}

/**
 * Render an HTMLImageElement onto an offscreen canvas with ImageAdjustments applied.
 * Optionally cap dimensions (maxDim) for responsive live preview.
 */
export function applyImageAdjustmentsToCanvas(
  img: HTMLImageElement,
  adjustments?: ImageAdjustments,
  maxDim?: number
): HTMLCanvasElement {
  const natW = img.naturalWidth || img.width || 1;
  const natH = img.naturalHeight || img.height || 1;

  let w = natW;
  let h = natH;
  if (maxDim && (w > maxDim || h > maxDim)) {
    const scale = Math.min(maxDim / w, maxDim / h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.drawImage(img, 0, 0, w, h);

  if (adjustments && hasActiveAdjustments(adjustments)) {
    const imageData = ctx.getImageData(0, 0, w, h);
    processImageData(imageData.data, adjustments);
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

import type { FogLayer, GradientStop } from '../types/editor';
import { clamp, computeLinearGradientPoints } from './geometry';

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return { r, g, b };
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) || 0;
    const g = parseInt(clean.slice(2, 4), 16) || 0;
    const b = parseInt(clean.slice(4, 6), 16) || 0;
    return { r, g, b };
  }
  return { r: 255, g: 255, b: 255 };
}

export function hexToRgbaString(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  const a = clamp(alpha, 0, 1);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function normalizeStops(stops: GradientStop[]): GradientStop[] {
  if (stops.length === 0) {
    return [
      { id: 'default-0', offset: 0, color: '#ffffff', alpha: 0 },
      { id: 'default-1', offset: 1, color: '#ffffff', alpha: 0.85 },
    ];
  }
  return [...stops]
    .map((s) => ({
      ...s,
      offset: clamp(s.offset, 0, 1),
      alpha: clamp(s.alpha, 0, 1),
    }))
    .sort((a, b) => a.offset - b.offset);
}

/**
 * Create a CanvasGradient for either color overlay or alpha mask.
 */
export function createFogCanvasGradient(
  ctx: CanvasRenderingContext2D,
  fog: FogLayer,
  width: number,
  height: number,
  mode: 'color' | 'mask'
): CanvasGradient {
  let grad: CanvasGradient;

  if (fog.gradientType === 'radial') {
    const cx = clamp(fog.radialCenterX, 0, 1) * width;
    const cy = clamp(fog.radialCenterY, 0, 1) * height;
    const maxDim = Math.max(width, height) / 2;
    const r0 = Math.max(0, fog.radialInnerRadius * maxDim);
    const r1 = Math.max(r0 + 1, fog.radialOuterRadius * maxDim);
    grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  } else {
    const pts = computeLinearGradientPoints(width, height, fog.angle, fog.gradientSpread);
    grad = ctx.createLinearGradient(pts.x0, pts.y0, pts.x1, pts.y1);
  }

  const sortedStops = normalizeStops(fog.stops);
  for (const stop of sortedStops) {
    if (mode === 'mask') {
      grad.addColorStop(stop.offset, `rgba(255, 255, 255, ${stop.alpha})`);
    } else {
      grad.addColorStop(stop.offset, hexToRgbaString(stop.color, stop.alpha * fog.colorIntensity));
    }
  }

  return grad;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = clamp(r, 0, Math.min(w, h) / 2);
  ctx.beginPath();
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

/**
 * Render a FogLayer (backdrop blur + alpha gradient mask + color gradient)
 * onto an HTMLCanvasElement of size (fog.width x fog.height).
 */
export function renderFogToCanvas(
  fog: FogLayer,
  backdropCanvas: HTMLCanvasElement | null,
  outCanvas?: HTMLCanvasElement
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(fog.width));
  const h = Math.max(1, Math.round(fog.height));
  const canvas = outCanvas ?? document.createElement('canvas');
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  if (fog.borderRadius > 0) {
    drawRoundedRectPath(ctx, 0, 0, w, h, fog.borderRadius);
    ctx.clip();
  }

  // 1. Backdrop blur layer
  if (backdropCanvas && fog.blurRadius > 0) {
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = w;
    blurCanvas.height = h;
    const bCtx = blurCanvas.getContext('2d');

    if (bCtx) {
      // Sample the backdrop under the fog object (taking rotation into account)
      bCtx.save();
      bCtx.filter = `blur(${fog.blurRadius}px)`;

      // Inverse transform of fog layer to map backdrop pixels into fog's local space
      bCtx.translate(w / 2, h / 2);
      bCtx.rotate((-fog.rotation * Math.PI) / 180);
      bCtx.translate(-(fog.x + w / 2), -(fog.y + h / 2));
      bCtx.drawImage(backdropCanvas, 0, 0);
      bCtx.restore();

      if (fog.blurFollowsAlpha) {
        bCtx.save();
        bCtx.globalCompositeOperation = 'destination-in';
        bCtx.fillStyle = createFogCanvasGradient(bCtx, fog, w, h, 'mask');
        bCtx.fillRect(0, 0, w, h);
        bCtx.restore();
      }

      ctx.drawImage(blurCanvas, 0, 0);
    }
  }

  // 2. Colored gradient fog overlay
  if (fog.colorIntensity > 0) {
    ctx.fillStyle = createFogCanvasGradient(ctx, fog, w, h, 'color');
    ctx.fillRect(0, 0, w, h);
  }

  ctx.restore();
  return canvas;
}

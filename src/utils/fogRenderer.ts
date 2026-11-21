import type { FadeEdge, FogLayer, GradientStop } from '../types/editor';
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

export function smoothStep(edge0: number, edge1: number, x: number): number {
  if (edge1 === edge0) return x >= edge1 ? 1 : 0;
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export interface SmoothFadeStop {
  level: number;
  alpha: number;
}

const SMOOTH_FADE_STEPS = 12;

/**
 * Compute 12-step SmoothStep fade stops matching Unity's BottomFade BaseMeshEffect:
 * - [0, start): alpha = 0 (trimmed completely)
 * - [start, end]: 12 SmoothStep(0, 1, k) steps from alpha 0 to 1
 * - [end, 1]: alpha = 1
 */
export function computeSmoothFadeStops(
  span: number,
  fadeOffset: number,
  fadeHeight: number
): SmoothFadeStop[] {
  if (span <= 0 || fadeHeight <= 0) {
    return [
      { level: 0, alpha: 1 },
      { level: 1, alpha: 1 },
    ];
  }

  const start = clamp(fadeOffset / span, 0, 1);
  const end = clamp((fadeOffset + fadeHeight) / span, start, 1);

  const result: SmoothFadeStop[] = [];

  if (start > 0) {
    result.push({ level: 0, alpha: 0 });
    if (start > 1e-5) {
      result.push({ level: Math.max(0, start - 1e-5), alpha: 0 });
    }
  }

  let lastLevel = -1;
  for (let s = 0; s <= SMOOTH_FADE_STEPS; s++) {
    const k = s / SMOOTH_FADE_STEPS;
    const level = start + (end - start) * k;
    const alpha = smoothStep(0, 1, k);
    if (level - lastLevel >= 1e-5 || s === 0) {
      result.push({ level: clamp(level, 0, 1), alpha });
      lastLevel = level;
    }
  }

  if (end < 1) {
    result.push({ level: 1, alpha: 1 });
  }

  return result;
}

export function getActiveFadeEdges(fog: Pick<FogLayer, 'fadeEdges' | 'fadeEdge'>): FadeEdge[] {
  if (fog.fadeEdges !== undefined) return fog.fadeEdges;
  return fog.fadeEdge ? [fog.fadeEdge] : ['bottom'];
}

export function createEdgeLinearGradient(
  ctx: CanvasRenderingContext2D,
  edge: FadeEdge,
  width: number,
  height: number,
  fadeOffset: number,
  fadeHeight: number
): CanvasGradient {
  const span = edge === 'bottom' || edge === 'top' ? height : width;
  let grad: CanvasGradient;
  if (edge === 'bottom') {
    grad = ctx.createLinearGradient(0, height, 0, 0);
  } else if (edge === 'top') {
    grad = ctx.createLinearGradient(0, 0, 0, height);
  } else if (edge === 'left') {
    grad = ctx.createLinearGradient(0, 0, width, 0);
  } else {
    grad = ctx.createLinearGradient(width, 0, 0, 0);
  }

  const fadeStops = computeSmoothFadeStops(span, fadeOffset, fadeHeight);
  for (const st of fadeStops) {
    grad.addColorStop(st.level, `rgba(255, 255, 255, ${st.alpha})`);
  }
  return grad;
}

/**
 * Build an offscreen alpha mask canvas combining all active Smooth Fade edges
 * via destination-in multiplication.
 */
export function createSmoothFadeMaskCanvas(
  fog: FogLayer,
  width: number,
  height: number
): HTMLCanvasElement {
  const mask = document.createElement('canvas');
  mask.width = width;
  mask.height = height;
  const mCtx = mask.getContext('2d');
  if (!mCtx) return mask;

  const fadeAlpha = clamp(fog.fadeAlpha ?? 1, 0, 1);
  mCtx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;
  mCtx.fillRect(0, 0, width, height);

  const edges = getActiveFadeEdges(fog);
  const fadeOffset = fog.fadeOffset ?? 0;
  const fadeHeight = fog.fadeHeight ?? 90;

  mCtx.globalCompositeOperation = 'destination-in';
  for (const edge of edges) {
    mCtx.fillStyle = createEdgeLinearGradient(
      mCtx,
      edge,
      width,
      height,
      fadeOffset,
      fadeHeight
    );
    mCtx.fillRect(0, 0, width, height);
  }

  return mask;
}

/**
 * Create a CanvasGradient for either color overlay or alpha mask (linear / radial / single-edge smooth-fade).
 */
export function createFogCanvasGradient(
  ctx: CanvasRenderingContext2D,
  fog: FogLayer,
  width: number,
  height: number,
  mode: 'color' | 'mask'
): CanvasGradient {
  let grad: CanvasGradient;

  if (fog.gradientType === 'smooth-fade') {
    const edges = getActiveFadeEdges(fog);
    const edge = edges[0] ?? 'bottom';
    const span = edge === 'bottom' || edge === 'top' ? height : width;
    if (edge === 'bottom') {
      grad = ctx.createLinearGradient(0, height, 0, 0);
    } else if (edge === 'top') {
      grad = ctx.createLinearGradient(0, 0, 0, height);
    } else if (edge === 'left') {
      grad = ctx.createLinearGradient(0, 0, width, 0);
    } else {
      grad = ctx.createLinearGradient(width, 0, 0, 0);
    }

    const fadeStops = computeSmoothFadeStops(
      span,
      fog.fadeOffset ?? 0,
      fog.fadeHeight ?? 90
    );
    const fadeColor = fog.fadeColor ?? '#ffffff';
    const fadeAlpha = clamp(fog.fadeAlpha ?? 1, 0, 1);

    for (const st of fadeStops) {
      const a = st.alpha * fadeAlpha;
      if (mode === 'mask') {
        grad.addColorStop(st.level, `rgba(255, 255, 255, ${a})`);
      } else {
        grad.addColorStop(st.level, hexToRgbaString(fadeColor, a * fog.colorIntensity));
      }
    }
    return grad;
  }

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

  const smoothMask =
    fog.gradientType === 'smooth-fade'
      ? createSmoothFadeMaskCanvas(fog, w, h)
      : null;

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
        if (smoothMask) {
          bCtx.drawImage(smoothMask, 0, 0);
        } else {
          bCtx.fillStyle = createFogCanvasGradient(bCtx, fog, w, h, 'mask');
          bCtx.fillRect(0, 0, w, h);
        }
        bCtx.restore();
      }

      ctx.drawImage(blurCanvas, 0, 0);
    }
  }

  // 2. Colored gradient fog overlay
  if (fog.colorIntensity > 0) {
    if (smoothMask) {
      const colorCanvas = document.createElement('canvas');
      colorCanvas.width = w;
      colorCanvas.height = h;
      const cCtx = colorCanvas.getContext('2d');
      if (cCtx) {
        cCtx.fillStyle = hexToRgbaString(fog.fadeColor ?? '#ffffff', fog.colorIntensity);
        cCtx.fillRect(0, 0, w, h);
        cCtx.globalCompositeOperation = 'destination-in';
        cCtx.drawImage(smoothMask, 0, 0);
        ctx.drawImage(colorCanvas, 0, 0);
      }
    } else {
      ctx.fillStyle = createFogCanvasGradient(ctx, fog, w, h, 'color');
      ctx.fillRect(0, 0, w, h);
    }
  }

  ctx.restore();
  return canvas;
}

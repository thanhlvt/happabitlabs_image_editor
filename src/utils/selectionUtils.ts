import type {
  CanvasSelection,
  ImageLayer,
  SelectionPoint,
  SelectionShape,
  SelectionStep,
} from '../types/editor';
import { loadImageElement } from './fileHelpers';
import { applyImageAdjustmentsToCanvas, hasActiveAdjustments } from './imageFilters';

/**
 * Ray-casting point-in-polygon test for Free Form (lasso) selection.
 */
function isPointInPolygon(
  x: number,
  y: number,
  points: SelectionPoint[]
): boolean {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInSingleShape(
  x: number,
  y: number,
  shapeObj: {
    shape: SelectionShape;
    x: number;
    y: number;
    width: number;
    height: number;
    points?: SelectionPoint[];
  }
): boolean {
  if (shapeObj.width <= 0 || shapeObj.height <= 0) return false;

  if (shapeObj.shape === 'lasso') {
    if (
      x < shapeObj.x ||
      x > shapeObj.x + shapeObj.width ||
      y < shapeObj.y ||
      y > shapeObj.y + shapeObj.height
    ) {
      return false;
    }
    return isPointInPolygon(x, y, shapeObj.points ?? []);
  }

  if (shapeObj.shape === 'rect' || shapeObj.shape === 'square') {
    return (
      x >= shapeObj.x &&
      x <= shapeObj.x + shapeObj.width &&
      y >= shapeObj.y &&
      y <= shapeObj.y + shapeObj.height
    );
  }

  const rx = shapeObj.width / 2;
  const ry = shapeObj.height / 2;
  if (rx <= 0 || ry <= 0) return false;
  const cx = shapeObj.x + rx;
  const cy = shapeObj.y + ry;
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

/**
 * Check if a canvas coordinate (x, y) lies inside a CanvasSelection
 * (evaluating boolean steps: replace, union, subtract, intersect).
 */
export function isPointInSelection(
  x: number,
  y: number,
  selection: CanvasSelection
): boolean {
  if (selection.width <= 0 || selection.height <= 0) return false;

  const steps = selection.steps;
  if (!steps || steps.length === 0) {
    return isPointInSingleShape(x, y, selection);
  }

  let inside = false;
  for (const step of steps) {
    const hit = isPointInSingleShape(x, y, step);
    if (step.op === 'replace') inside = hit;
    else if (step.op === 'union') inside = inside || hit;
    else if (step.op === 'subtract') inside = inside && !hit;
    else if (step.op === 'intersect') inside = inside && hit;
  }
  return inside;
}

/**
 * Combine an existing CanvasSelection with a new SelectionStep (replace/union/subtract/intersect).
 */
export function combineSelectionStep(
  current: CanvasSelection | null,
  step: SelectionStep
): CanvasSelection | null {
  if (!current || step.op === 'replace') {
    return {
      shape: step.shape,
      x: step.x,
      y: step.y,
      width: step.width,
      height: step.height,
      points: step.points,
      steps: [{ ...step, op: 'replace' }],
    };
  }

  const prevSteps: SelectionStep[] =
    current.steps && current.steps.length > 0
      ? current.steps
      : [
          {
            op: 'replace',
            shape: current.shape,
            x: current.x,
            y: current.y,
            width: current.width,
            height: current.height,
            points: current.points,
          },
        ];

  const nextSteps = [...prevSteps, step];

  if (step.op === 'union') {
    const minX = Math.min(current.x, step.x);
    const minY = Math.min(current.y, step.y);
    const maxX = Math.max(current.x + current.width, step.x + step.width);
    const maxY = Math.max(current.y + current.height, step.y + step.height);
    return {
      shape: current.shape,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      steps: nextSteps,
    };
  }

  if (step.op === 'intersect') {
    const minX = Math.max(current.x, step.x);
    const minY = Math.max(current.y, step.y);
    const maxX = Math.min(current.x + current.width, step.x + step.width);
    const maxY = Math.min(current.y + current.height, step.y + step.height);
    if (maxX <= minX || maxY <= minY) return null;
    return {
      shape: current.shape,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      steps: nextSteps,
    };
  }

  // 'subtract' keeps current bounding box
  return {
    ...current,
    steps: nextSteps,
  };
}

/**
 * Translate a CanvasSelection (and all its points/steps) by (dx, dy) without modifying any image layer.
 */
export function translateSelection(
  selection: CanvasSelection,
  dx: number,
  dy: number
): CanvasSelection {
  return {
    ...selection,
    x: selection.x + dx,
    y: selection.y + dy,
    ...(selection.points
      ? {
          points: selection.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        }
      : {}),
    ...(selection.steps
      ? {
          steps: selection.steps.map((st) => ({
            ...st,
            x: st.x + dx,
            y: st.y + dy,
            ...(st.points
              ? { points: st.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
              : {}),
          })),
        }
      : {}),
  };
}

function drawStepPath(
  ctx: CanvasRenderingContext2D,
  step: Pick<SelectionStep, 'shape' | 'x' | 'y' | 'width' | 'height' | 'points'>,
  offsetX: number,
  offsetY: number
) {
  ctx.beginPath();
  if (step.shape === 'lasso' && (step.points?.length ?? 0) >= 3) {
    const pts = step.points!;
    ctx.moveTo(pts[0].x - offsetX, pts[0].y - offsetY);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x - offsetX, pts[i].y - offsetY);
    }
    ctx.closePath();
  } else if (step.shape === 'circle' || step.shape === 'ellipse') {
    ctx.ellipse(
      step.x - offsetX + step.width / 2,
      step.y - offsetY + step.height / 2,
      step.width / 2,
      step.height / 2,
      0,
      0,
      Math.PI * 2
    );
  } else {
    ctx.rect(step.x - offsetX, step.y - offsetY, step.width, step.height);
  }
}

/**
 * Render the combined CanvasSelection boolean mask onto an HTMLCanvasElement.
 */
export function buildSelectionMaskCanvas(
  selection: CanvasSelection,
  outW: number,
  outH: number,
  offsetX: number,
  offsetY: number,
  fillStyle = '#ffffff'
): HTMLCanvasElement {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = outW;
  maskCanvas.height = outH;
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) return maskCanvas;

  const steps: SelectionStep[] =
    selection.steps && selection.steps.length > 0
      ? selection.steps
      : [
          {
            op: 'replace',
            shape: selection.shape,
            x: selection.x,
            y: selection.y,
            width: selection.width,
            height: selection.height,
            points: selection.points,
          },
        ];

  ctx.fillStyle = fillStyle;

  for (const step of steps) {
    if (step.op === 'replace') {
      ctx.clearRect(0, 0, outW, outH);
      ctx.globalCompositeOperation = 'source-over';
      drawStepPath(ctx, step, offsetX, offsetY);
      ctx.fill();
    } else if (step.op === 'union') {
      ctx.globalCompositeOperation = 'source-over';
      drawStepPath(ctx, step, offsetX, offsetY);
      ctx.fill();
    } else if (step.op === 'subtract') {
      ctx.globalCompositeOperation = 'destination-out';
      drawStepPath(ctx, step, offsetX, offsetY);
      ctx.fill();
    } else if (step.op === 'intersect') {
      // Mask current pixels with the new shape
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = outW;
      stepCanvas.height = outH;
      const sCtx = stepCanvas.getContext('2d');
      if (sCtx) {
        sCtx.fillStyle = fillStyle;
        drawStepPath(sCtx, step, offsetX, offsetY);
        sCtx.fill();
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(stepCanvas, 0, 0);
      }
    }
  }

  ctx.globalCompositeOperation = 'source-over';
  return maskCanvas;
}

/**
 * Render a single crisp dashed boundary outline + subtle fill for a combined boolean selection.
 */
export function buildSelectionOutlineCanvas(
  selection: CanvasSelection,
  outW: number,
  outH: number,
  offsetX: number,
  offsetY: number
): HTMLCanvasElement {
  const maskCanvas = buildSelectionMaskCanvas(
    selection,
    outW,
    outH,
    offsetX,
    offsetY,
    '#ffffff'
  );
  const ctx = maskCanvas.getContext('2d');
  if (!ctx) return maskCanvas;

  const imgData = ctx.getImageData(0, 0, outW, outH);
  const src = imgData.data;
  const out = new Uint8ClampedArray(src.length);

  const isInside = (x: number, y: number): boolean => {
    if (x < 0 || x >= outW || y < 0 || y >= outH) return false;
    return src[(y * outW + x) * 4 + 3] > 128;
  };

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const idx = (y * outW + x) * 4;
      if (src[idx + 3] <= 128) continue;

      const onEdge =
        !isInside(x - 1, y) ||
        !isInside(x + 1, y) ||
        !isInside(x, y - 1) ||
        !isInside(x, y + 1);

      if (onEdge) {
        const dash = ((x + y) % 10) < 6;
        out[idx] = dash ? 56 : 255;
        out[idx + 1] = dash ? 189 : 255;
        out[idx + 2] = dash ? 248 : 255;
        out[idx + 3] = 240;
      } else {
        out[idx] = 56;
        out[idx + 1] = 189;
        out[idx + 2] = 248;
        out[idx + 3] = 32;
      }
    }
  }

  ctx.putImageData(new ImageData(out, outW, outH), 0, 0);
  return maskCanvas;
}

/**
 * Build a 0/1 mask (length = maskWidth * maskHeight) for an ImageLayer's pixels
 * corresponding to the active CanvasSelection in canvas space.
 */
export function createLayerMaskFromSelection(
  layer: ImageLayer,
  selection: CanvasSelection,
  maskWidth: number,
  maskHeight: number
): Uint8Array {
  const mask = new Uint8Array(maskWidth * maskHeight);
  const natW = Math.max(1, layer.naturalWidth);
  const natH = Math.max(1, layer.naturalHeight);
  const cropW = Math.max(1, layer.cropWidth);
  const cropH = Math.max(1, layer.cropHeight);

  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const rad = (layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const flipXSign = layer.flipX ? -1 : 1;
  const flipYSign = layer.flipY ? -1 : 1;

  for (let py = 0; py < maskHeight; py++) {
    const natY = ((py + 0.5) / maskHeight) * natH;
    const v = (natY - layer.cropY) / cropH;
    if (v < 0 || v > 1) continue;
    const localY = (v - 0.5) * layer.height * flipYSign;

    for (let px = 0; px < maskWidth; px++) {
      const natX = ((px + 0.5) / maskWidth) * natW;
      const u = (natX - layer.cropX) / cropW;
      if (u < 0 || u > 1) continue;
      const localX = (u - 0.5) * layer.width * flipXSign;

      const canvasX = cx + localX * cos - localY * sin;
      const canvasY = cy + localX * sin + localY * cos;

      if (isPointInSelection(canvasX, canvasY, selection)) {
        mask[py * maskWidth + px] = 1;
      }
    }
  }

  return mask;
}

export interface CopiedSelectionResult {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
}

/**
 * Copy the pixels of an ImageLayer inside a CanvasSelection into a new transparent PNG Data URL.
 */
export async function copySelectionFromImageLayer(
  layer: ImageLayer,
  selection: CanvasSelection
): Promise<CopiedSelectionResult | null> {
  const outW = Math.max(1, Math.round(selection.width));
  const outH = Math.max(1, Math.round(selection.height));
  const selX = Math.round(selection.x);
  const selY = Math.round(selection.y);

  const img = await loadImageElement(layer.src);
  const natW = img.naturalWidth || img.width || layer.naturalWidth;
  const natH = img.naturalHeight || img.height || layer.naturalHeight;

  let drawable: CanvasImageSource = img;
  if (hasActiveAdjustments(layer.adjustments)) {
    const mask = createLayerMaskFromSelection(layer, selection, natW, natH);
    drawable = applyImageAdjustmentsToCanvas(img, layer.adjustments, undefined, mask);
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outW;
  outCanvas.height = outH;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) return null;

  ctx.save();
  const cx = layer.x + layer.width / 2 - selX;
  const cy = layer.y + layer.height / 2 - selY;
  ctx.translate(cx, cy);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.flipX ? -1 : 1, layer.flipY ? -1 : 1);
  ctx.drawImage(
    drawable,
    layer.cropX,
    layer.cropY,
    layer.cropWidth,
    layer.cropHeight,
    -layer.width / 2,
    -layer.height / 2,
    layer.width,
    layer.height
  );
  ctx.restore();

  const maskCanvas = buildSelectionMaskCanvas(selection, outW, outH, selX, selY);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0);
  ctx.restore();

  return {
    src: outCanvas.toDataURL('image/png'),
    x: selX,
    y: selY,
    width: outW,
    height: outH,
    name: `${layer.name} (Selection)`,
  };
}

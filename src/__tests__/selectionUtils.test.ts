import { describe, expect, it } from 'vitest';
import {
  combineSelectionStep,
  createLayerMaskFromSelection,
  isPointInSelection,
  translateSelection,
} from '../utils/selectionUtils';
import {
  createDefaultImageAdjustments,
  processImageData,
} from '../utils/imageFilters';
import type { CanvasSelection, ImageLayer } from '../types/editor';

describe('selectionUtils & masked editing', () => {
  it('checks point inclusion for rect, square, circle, ellipse, and lasso', () => {
    const rectSel: CanvasSelection = {
      shape: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    };
    expect(isPointInSelection(50, 40, rectSel)).toBe(true);
    expect(isPointInSelection(5, 40, rectSel)).toBe(false);

    const circleSel: CanvasSelection = {
      shape: 'circle',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    expect(isPointInSelection(50, 50, circleSel)).toBe(true);
    expect(isPointInSelection(5, 5, circleSel)).toBe(false); // Outside inscribed circle

    const lassoSel: CanvasSelection = {
      shape: 'lasso',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ],
    };
    expect(isPointInSelection(50, 30, lassoSel)).toBe(true);
    expect(isPointInSelection(5, 90, lassoSel)).toBe(false);
  });

  it('creates layer pixel mask from selection and restricts color/background edits to selected region', () => {
    const layer: ImageLayer = {
      id: 'img-1',
      name: 'Photo',
      type: 'image',
      src: 'data:image/png;base64,abc',
      naturalWidth: 4,
      naturalHeight: 1,
      cropX: 0,
      cropY: 0,
      cropWidth: 4,
      cropHeight: 1,
      x: 0,
      y: 0,
      width: 4,
      height: 1,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      lockAspectRatio: true,
    };

    // Select only left half (x in [0, 2])
    const sel: CanvasSelection = {
      shape: 'rect',
      x: 0,
      y: 0,
      width: 2,
      height: 1,
    };
    const mask = createLayerMaskFromSelection(layer, sel, 4, 1);
    expect(Array.from(mask)).toEqual([1, 1, 0, 0]);

    // 4 white pixels
    const data = new Uint8ClampedArray([
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ]);

    processImageData(
      data,
      {
        ...createDefaultImageAdjustments(),
        backgroundRemoval: {
          enabled: true,
          color: '#ffffff',
          tolerance: 15,
          softness: 0,
        },
      },
      mask
    );

    // Pixels inside selection (0, 1) are erased; outside (2, 3) remain opaque
    expect(data[3]).toBe(0);
    expect(data[7]).toBe(0);
    expect(data[11]).toBe(255);
    expect(data[15]).toBe(255);
  });

  it('supports union (+ Thêm), subtract (- Trừ), and intersect (∩ Giao) selection operations', () => {
    // Base rect: [0, 0, 100, 100]
    let sel = combineSelectionStep(null, {
      op: 'replace',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(sel).not.toBeNull();

    // Union with second rect: [150, 0, 50, 50]
    sel = combineSelectionStep(sel, {
      op: 'union',
      shape: 'rect',
      x: 150,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(isPointInSelection(50, 50, sel!)).toBe(true);
    expect(isPointInSelection(175, 25, sel!)).toBe(true);
    expect(isPointInSelection(125, 25, sel!)).toBe(false);

    // Subtract center rect: [25, 25, 50, 50]
    sel = combineSelectionStep(sel, {
      op: 'subtract',
      shape: 'rect',
      x: 25,
      y: 25,
      width: 50,
      height: 50,
    });
    expect(isPointInSelection(50, 50, sel!)).toBe(false);
    expect(isPointInSelection(10, 10, sel!)).toBe(true);

    // Intersect with [0, 0, 60, 60] -> excludes [150, 0, 50, 50]
    sel = combineSelectionStep(sel, {
      op: 'intersect',
      shape: 'rect',
      x: 0,
      y: 0,
      width: 60,
      height: 60,
    });
    expect(isPointInSelection(10, 10, sel!)).toBe(true);
    expect(isPointInSelection(175, 25, sel!)).toBe(false);
    expect(isPointInSelection(90, 90, sel!)).toBe(false);
  });

  it('translates selection frame and all its steps/points without altering layers', () => {
    const sel: CanvasSelection = {
      shape: 'lasso',
      x: 10,
      y: 20,
      width: 50,
      height: 40,
      points: [
        { x: 10, y: 20 },
        { x: 60, y: 20 },
        { x: 35, y: 60 },
      ],
      steps: [
        {
          op: 'replace',
          shape: 'lasso',
          x: 10,
          y: 20,
          width: 50,
          height: 40,
          points: [
            { x: 10, y: 20 },
            { x: 60, y: 20 },
            { x: 35, y: 60 },
          ],
        },
      ],
    };

    const moved = translateSelection(sel, 30, -10);
    expect(moved.x).toBe(40);
    expect(moved.y).toBe(10);
    expect(moved.points?.[0]).toEqual({ x: 40, y: 10 });
    expect(moved.steps?.[0].x).toBe(40);
    expect(moved.steps?.[0].y).toBe(10);
  });
});

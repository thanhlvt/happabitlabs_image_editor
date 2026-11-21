import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampCropRect,
  computeAspectCropRect,
  computeAspectDimensions,
  computeLayerFit,
  computeLinearGradientPoints,
  scaleLayersForResize,
  translateLayersForCrop,
} from '../utils/geometry';
import type { ImageLayer } from '../types/editor';

describe('geometry utilities', () => {
  it('clamps values within [min, max]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(25, 0, 10)).toBe(10);
  });

  it('computes aspect dimensions when width or height changes', () => {
    expect(computeAspectDimensions('width', 1920, 16 / 9)).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(computeAspectDimensions('height', 500, 2)).toEqual({
      width: 1000,
      height: 500,
    });
  });

  it('clamps crop rect inside canvas bounds', () => {
    const rect = clampCropRect(
      { x: -20, y: 50, width: 1500, height: 400 },
      1000,
      600
    );
    expect(rect).toEqual({ x: 0, y: 50, width: 1000, height: 400 });
  });

  it('computes centered aspect crop rect', () => {
    const rect = computeAspectCropRect(1000, 1000, 16 / 9);
    expect(rect.width).toBe(800);
    expect(rect.height).toBe(450);
    expect(rect.x).toBe(100);
    expect(rect.y).toBe(275);
  });

  it('scales and translates layers for resize and crop', () => {
    const sample: ImageLayer = {
      id: 'img-1',
      name: 'Photo',
      type: 'image',
      src: 'data:image/png;base64,abc',
      naturalWidth: 200,
      naturalHeight: 100,
      cropX: 0,
      cropY: 0,
      cropWidth: 200,
      cropHeight: 100,
      x: 100,
      y: 50,
      width: 200,
      height: 100,
      rotation: 0,
      opacity: 0.8,
      visible: true,
      locked: false,
      lockAspectRatio: true,
    };

    const scaled = scaleLayersForResize([sample], 1000, 500, 2000, 1000);
    expect(scaled[0]).toMatchObject({ x: 200, y: 100, width: 400, height: 200 });

    const cropped = translateLayersForCrop([sample], {
      x: 40,
      y: 20,
      width: 500,
      height: 300,
    });
    expect(cropped[0]).toMatchObject({ x: 60, y: 30 });
  });

  it('computes linear gradient endpoints with spread multiplier', () => {
    const normal = computeLinearGradientPoints(200, 100, 90, 1);
    expect(Math.round(normal.x0)).toBe(0);
    expect(Math.round(normal.x1)).toBe(200);

    const spread = computeLinearGradientPoints(200, 100, 90, 0.5);
    expect(Math.round(spread.x0)).toBe(50);
    expect(Math.round(spread.x1)).toBe(150);
  });

  it('computes Fit width, Fit height, and Fit all for an image layer', () => {
    const img: ImageLayer = {
      id: 'img-fit',
      name: 'Wide Photo',
      type: 'image',
      src: 'data:image/png;base64,abc',
      naturalWidth: 400,
      naturalHeight: 200,
      cropX: 0,
      cropY: 0,
      cropWidth: 400,
      cropHeight: 200,
      x: 10,
      y: 10,
      width: 400,
      height: 200,
      rotation: 15,
      opacity: 1,
      visible: true,
      locked: false,
      lockAspectRatio: true,
    };

    // Canvas 1000 x 1000, image is 2:1
    expect(computeLayerFit(img, 1000, 1000, 'width')).toEqual({
      x: 0,
      y: 250,
      width: 1000,
      height: 500,
      rotation: 0,
    });
    expect(computeLayerFit(img, 1000, 1000, 'height')).toEqual({
      x: -500,
      y: 0,
      width: 2000,
      height: 1000,
      rotation: 0,
    });
    expect(computeLayerFit(img, 1000, 1000, 'all')).toEqual({
      x: 0,
      y: 250,
      width: 1000,
      height: 500,
      rotation: 0,
    });
  });
});

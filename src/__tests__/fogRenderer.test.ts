import { describe, expect, it, vi } from 'vitest';
import {
  createFogCanvasGradient,
  hexToRgb,
  hexToRgbaString,
  normalizeStops,
  rgbToHex,
} from '../utils/fogRenderer';
import type { FogLayer } from '../types/editor';

describe('fogRenderer utilities', () => {
  it('converts hex to rgb and rgba string', () => {
    expect(hexToRgb('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
    expect(hexToRgb('#0af')).toEqual({ r: 0, g: 170, b: 255 });
    expect(hexToRgbaString('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    expect(rgbToHex(15, 23, 42)).toBe('#0f172a');
  });

  it('normalizes and sorts gradient stops', () => {
    const stops = normalizeStops([
      { id: 'b', offset: 1.4, color: '#000000', alpha: 1.2 },
      { id: 'a', offset: -0.2, color: '#ffffff', alpha: -0.5 },
      { id: 'c', offset: 0.5, color: '#3b82f6', alpha: 0.6 },
    ]);

    expect(stops.map((s) => s.id)).toEqual(['a', 'c', 'b']);
    expect(stops[0].offset).toBe(0);
    expect(stops[0].alpha).toBe(0);
    expect(stops[2].offset).toBe(1);
    expect(stops[2].alpha).toBe(1);
  });

  it('builds linear and radial CanvasGradient with colorIntensity and mask modes', () => {
    const addColorStop = vi.fn();
    const fakeGrad = { addColorStop } as unknown as CanvasGradient;
    const createLinearGradient = vi.fn(() => fakeGrad);
    const createRadialGradient = vi.fn(() => fakeGrad);

    const fakeCtx = {
      createLinearGradient,
      createRadialGradient,
    } as unknown as CanvasRenderingContext2D;

    const fog: FogLayer = {
      id: 'fog-1',
      name: 'Fog',
      type: 'fog',
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      rotation: 0,
      opacity: 1,
      visible: true,
      locked: false,
      lockAspectRatio: false,
      blurRadius: 20,
      colorIntensity: 0.5,
      gradientType: 'linear',
      angle: 180,
      gradientSpread: 1,
      radialCenterX: 0.5,
      radialCenterY: 0.5,
      radialInnerRadius: 0.2,
      radialOuterRadius: 0.9,
      blurFollowsAlpha: true,
      borderRadius: 0,
      stops: [
        { id: 's1', offset: 0, color: '#ff0000', alpha: 0 },
        { id: 's2', offset: 1, color: '#ff0000', alpha: 0.8 },
      ],
    };

    createFogCanvasGradient(fakeCtx, fog, 400, 200, 'color');
    expect(createLinearGradient).toHaveBeenCalledTimes(1);
    expect(addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgba(255, 0, 0, 0)');
    expect(addColorStop).toHaveBeenNthCalledWith(2, 1, 'rgba(255, 0, 0, 0.4)');

    addColorStop.mockClear();
    createFogCanvasGradient(
      fakeCtx,
      { ...fog, gradientType: 'radial' },
      400,
      200,
      'mask'
    );
    expect(createRadialGradient).toHaveBeenCalledTimes(1);
    expect(addColorStop).toHaveBeenNthCalledWith(1, 0, 'rgba(255, 255, 255, 0)');
    expect(addColorStop).toHaveBeenNthCalledWith(2, 1, 'rgba(255, 255, 255, 0.8)');
  });
});

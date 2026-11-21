import { describe, expect, it } from 'vitest';
import {
  canvasPointToImagePixel,
  circleErase,
  floodFillErase,
} from '../utils/magicEraser';
import type { ImageLayer } from '../types/editor';

describe('magicEraser', () => {
  it('Mode 1 (floodFillErase): erases contiguous matching pixels within tolerance and stops at boundary', () => {
    // 4x4 RGBA image:
    // Top-left 2x2 and row 2 are white (#ffffff)
    // A red barrier (#ff0000) separates bottom-right (3,3) which is also white
    const width = 4;
    const height = 4;
    const data = new Uint8ClampedArray(width * height * 4);
    const setPx = (x: number, y: number, r: number, g: number, b: number) => {
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    };

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        setPx(x, y, 255, 255, 255);
      }
    }
    // Red barrier isolating (3, 3)
    setPx(2, 3, 255, 0, 0);
    setPx(3, 2, 255, 0, 0);
    setPx(2, 2, 255, 0, 0);

    const erased = floodFillErase(data, width, height, 0, 0, 15);
    expect(erased).toBe(12); // 16 - 3 barrier - 1 isolated (3,3)

    // Seed (0,0) erased
    expect(data[3]).toBe(0);
    // Barrier (2,2) intact
    expect(data[(2 * width + 2) * 4 + 3]).toBe(255);
    // Isolated white pixel (3,3) intact
    expect(data[(3 * width + 3) * 4 + 3]).toBe(255);
  });

  it('Mode 2 (circleErase): erases all pixels inside circle radius and preserves outside', () => {
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 255;
    }

    const erased = circleErase(data, width, height, 5, 5, 2);
    expect(erased).toBe(13); // Integer lattice points inside r=2 circle

    // Center (5,5) erased
    expect(data[(5 * width + 5) * 4 + 3]).toBe(0);
    // Edge (7,5) erased (dist = 2)
    expect(data[(5 * width + 7) * 4 + 3]).toBe(0);
    // Outside (0,0) intact
    expect(data[3]).toBe(255);
    // Outside (7,7) intact (dist = sqrt(8) > 2)
    expect(data[(7 * width + 7) * 4 + 3]).toBe(255);
  });

  it('maps canvas coordinates to image pixels accounting for flipX and rotation', () => {
    const layer: ImageLayer = {
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
      flipX: false,
      flipY: false,
      opacity: 1,
      visible: true,
      locked: false,
      lockAspectRatio: true,
    };

    // Outside bounds
    expect(canvasPointToImagePixel(50, 50, layer)).toBeNull();

    // Top-left inside layer
    expect(canvasPointToImagePixel(100, 50, layer)).toEqual({ px: 0, py: 0 });

    // Flipped horizontally: clicking left edge (x=100) maps to right edge of image
    const flipped = { ...layer, flipX: true };
    expect(canvasPointToImagePixel(100, 50, flipped)).toEqual({ px: 199, py: 0 });
  });
});

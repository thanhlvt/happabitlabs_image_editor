import { describe, expect, it } from 'vitest';
import {
  createDefaultImageAdjustments,
  hasActiveAdjustments,
  processImageData,
} from '../utils/imageFilters';

describe('imageFilters', () => {
  it('detects active vs default adjustments', () => {
    const def = createDefaultImageAdjustments();
    expect(hasActiveAdjustments(def)).toBe(false);
    expect(hasActiveAdjustments({ ...def, brightness: 10 })).toBe(true);
    expect(
      hasActiveAdjustments({
        ...def,
        colorEdits: [
          {
            id: 'r1',
            sourceColor: '#ff0000',
            targetColor: '#00ff00',
            tolerance: 20,
            softness: 10,
          },
        ],
      })
    ).toBe(true);
  });

  it('adjusts brightness and contrast while preserving alpha channel', () => {
    const data = new Uint8ClampedArray([100, 100, 100, 128, 0, 0, 0, 0]);
    const adj = {
      ...createDefaultImageAdjustments(),
      brightness: 20,
      contrast: 20,
    };
    processImageData(data, adj);

    expect(data[0]).toBeGreaterThan(100);
    expect(data[3]).toBe(128); // Alpha preserved
    expect(data[4]).toBe(0); // Fully transparent pixel untouched
    expect(data[7]).toBe(0);
  });

  it('adjusts white balance (temperature & tint)', () => {
    const data = new Uint8ClampedArray([120, 120, 120, 255]);
    processImageData(data, {
      ...createDefaultImageAdjustments(),
      temperature: 40,
      tint: 20,
    });

    // Warm temperature boosts red and reduces blue; positive tint reduces green
    expect(data[0]).toBeGreaterThan(120);
    expect(data[1]).toBeLessThan(120);
    expect(data[2]).toBeLessThan(120);
  });

  it('desaturates to grayscale when saturation is -100 and boosts faint color with vibrance', () => {
    const satData = new Uint8ClampedArray([200, 100, 50, 255]);
    processImageData(satData, {
      ...createDefaultImageAdjustments(),
      saturation: -100,
    });
    expect(satData[0]).toBe(satData[1]);
    expect(satData[1]).toBe(satData[2]);

    const vibData = new Uint8ClampedArray([130, 110, 110, 255]);
    processImageData(vibData, {
      ...createDefaultImageAdjustments(),
      vibrance: 80,
    });
    // Red channel should separate further from green/blue
    expect(vibData[0] - vibData[1]).toBeGreaterThan(20);
  });

  it('replaces sourceColor with targetColor within tolerance while leaving distant colors intact', () => {
    // Pixel 1: pure blue (#0000ff), Pixel 2: pure red (#ff0000)
    const data = new Uint8ClampedArray([
      0, 0, 255, 255,
      255, 0, 0, 200,
    ]);
    processImageData(data, {
      ...createDefaultImageAdjustments(),
      colorEdits: [
        {
          id: 'rule-1',
          sourceColor: '#0000ff',
          targetColor: '#00ff00',
          tolerance: 25,
          softness: 5,
        },
      ],
    });

    // Blue pixel replaced by green-ish
    expect(data[1]).toBeGreaterThan(150);
    expect(data[2]).toBeLessThan(50);
    // Red pixel untouched & alpha preserved
    expect(data[4]).toBe(255);
    expect(data[5]).toBe(0);
    expect(data[7]).toBe(200);
  });
});

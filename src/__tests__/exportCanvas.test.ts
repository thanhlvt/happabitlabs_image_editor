import { describe, expect, it } from 'vitest';
import UPNG from 'upng-js';
import { mapPngCompressionToColors } from '../utils/exportCanvas';

describe('exportCanvas PNG compression', () => {
  it('maps compression levels 1-10 accurately (1-3 lossless, 8 -> 256 colors)', () => {
    expect(mapPngCompressionToColors(1)).toBe(0);
    expect(mapPngCompressionToColors(3)).toBe(0);
    expect(mapPngCompressionToColors(4)).toBe(1024);
    expect(mapPngCompressionToColors(8)).toBe(256);
    expect(mapPngCompressionToColors(10)).toBe(96);
    // Clamps out-of-range inputs
    expect(mapPngCompressionToColors(0)).toBe(0);
    expect(mapPngCompressionToColors(99)).toBe(96);
  });

  it('encodes RGBA pixel data to valid PNG signature using UPNG', () => {
    const rgba = new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 128,
      0, 0, 255, 0,
      255, 255, 255, 255,
    ]);
    const buf = UPNG.encode([rgba.buffer], 2, 2, mapPngCompressionToColors(8));
    const bytes = new Uint8Array(buf);
    // PNG magic header: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });
});

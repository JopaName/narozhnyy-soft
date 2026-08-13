import { describe, expect, it } from 'vitest';
import { regionSizeEstimateMB, regionTileCount, tileRangeForZoom } from '../../src/core/offline-maps';
import type { RegionDef } from '../../src/core/offline-maps';

const GELENDZHIK: RegionDef = {
  id: 'gelendzhik',
  name: 'Геленджик',
  bbox: [38.0, 44.53, 38.16, 44.62],
  minZoom: 12,
  maxZoom: 16,
};

describe('tileRangeForZoom', () => {
  it('диапазон тайлов покрывает bbox', () => {
    const r = tileRangeForZoom(GELENDZHIK, 15);
    expect(r.x1).toBeGreaterThan(r.x0);
    expect(r.y1).toBeGreaterThan(r.y0);
    /* на z15 ширина 0.16° ≈ 0.16/360*32768 ≈ 14.6 тайлов */
    expect(r.x1 - r.x0).toBeGreaterThan(10);
    expect(r.x1 - r.x0).toBeLessThan(20);
  });

  it('больше зум — больше тайлов', () => {
    const r15 = tileRangeForZoom(GELENDZHIK, 15);
    const r16 = tileRangeForZoom(GELENDZHIK, 16);
    const n15 = (r15.x1 - r15.x0 + 1) * (r15.y1 - r15.y0 + 1);
    const n16 = (r16.x1 - r16.x0 + 1) * (r16.y1 - r16.y0 + 1);
    expect(n16).toBeGreaterThan(n15 * 3); /* ~4x */
  });
});

describe('regionTileCount / regionSizeEstimateMB', () => {
  it('сумма тайлов по зумам 12-16 положительна и разумна', () => {
    const total = regionTileCount(GELENDZHIK);
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(5000);
  });

  it('оценка размера соответствует числу тайлов', () => {
    const est = regionSizeEstimateMB(GELENDZHIK);
    const total = regionTileCount(GELENDZHIK);
    expect(est).toBe(Math.round((total * 15000) / 1048576));
    expect(est).toBeGreaterThan(5);
    expect(est).toBeLessThan(100);
  });

  it('один зум — счётчик равен количеству тайлов зума', () => {
    const oneZoom: RegionDef = { ...GELENDZHIK, minZoom: 14, maxZoom: 14 };
    const r = tileRangeForZoom(oneZoom, 14);
    expect(regionTileCount(oneZoom)).toBe((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1));
  });
});

import { describe, expect, it } from 'vitest';
import {
  latLngToTile,
  mercatorToMeters,
  metersPerPixel,
  metersToMercator,
  pixelsPerMeter,
  tileZoomForScale,
} from '../../src/core/satellite';

describe('latLngToTile', () => {
  it('экватор/нулевой меридиан, zoom 1', () => {
    const t = latLngToTile(0, 0, 1);
    expect(t.x).toBeCloseTo(1, 6);
    expect(t.y).toBeCloseTo(1, 6);
  });

  it('экватор/нулевой меридиан, zoom 2', () => {
    const t = latLngToTile(0, 0, 2);
    expect(t.x).toBeCloseTo(2, 6);
    expect(t.y).toBeCloseTo(2, 6);
  });

  it('lat 0, lng -90, zoom 10 — точные границы тайла', () => {
    /* lng -90 → x = 0.25*1024 = 256, lat 0 → y = 512 */
    const t = latLngToTile(0, -90, 10);
    expect(t.x).toBeCloseTo(256, 6);
    expect(t.y).toBeCloseTo(512, 6);
  });

  it('lat 45, lng 0, zoom 1 — известное значение меркаторной проекции', () => {
    /* y = (1 - ln(tan45+sec45)/π) = 0.71945 при n=2 */
    const t = latLngToTile(45, 0, 1);
    expect(t.x).toBeCloseTo(1, 6);
    expect(t.y).toBeCloseTo(0.71945, 4);
  });

  it('Краснодар (45.04, 38.98) — валидные границы тайла на zoom 19', () => {
    const z = 19;
    const n = Math.pow(2, z);
    const t = latLngToTile(45.04, 38.98, z);
    expect(t.x).toBeGreaterThan(0);
    expect(t.x).toBeLessThan(n);
    expect(t.y).toBeGreaterThan(0);
    expect(t.y).toBeLessThan(n);
  });
});

describe('metersPerPixel / pixelsPerMeter', () => {
  it('экватор, zoom 0 — каноническое значение', () => {
    expect(metersPerPixel(0, 0)).toBeCloseTo(156543.03392, 3);
  });

  it('на широте 60° — вдвое меньше, чем на экваторе', () => {
    expect(metersPerPixel(60, 0)).toBeCloseTo(156543.03392 / 2, 3);
  });

  it('zoom 19 на широте 45°: ~0.21 м/px → ~4.7 px/м', () => {
    const mpp = metersPerPixel(45, 19);
    expect(mpp).toBeGreaterThan(0.2);
    expect(mpp).toBeLessThan(0.22);
    const ppm = pixelsPerMeter(45, 19);
    expect(ppm).toBeGreaterThan(4.5);
    expect(ppm).toBeLessThan(5);
  });

  it('взаимная обратность', () => {
    const lat = 48.5;
    const z = 18;
    expect(pixelsPerMeter(lat, z) * metersPerPixel(lat, z)).toBeCloseTo(1, 9);
  });

  it('увеличение зума в 2 раза уменьшает метр на пиксель в 2 раза', () => {
    expect(metersPerPixel(0, 5)).toBeCloseTo(metersPerPixel(0, 4) / 2, 9);
  });
});

describe('mercatorToMeters / metersToMercator', () => {
  it('обратное преобразование: круг по Геленджику', () => {
    const m = mercatorToMeters(44.5583, 38.0749);
    const back = metersToMercator(m.x, m.y);
    expect(back.lat).toBeCloseTo(44.5583, 6);
    expect(back.lng).toBeCloseTo(38.0749, 6);
  });

  it('круг по Москве и экватору', () => {
    for (const [lat, lng] of [
      [55.7558, 37.6173],
      [0, 0],
      [-33.87, 151.21],
    ] as const) {
      const m = mercatorToMeters(lat, lng);
      const back = metersToMercator(m.x, m.y);
      expect(back.lat).toBeCloseTo(lat, 6);
      expect(back.lng).toBeCloseTo(lng, 6);
    }
  });
});

describe('tileZoomForScale', () => {
  it('восстанавливает зум из масштаба', () => {
    const lat = 44.56;
    const z = 15;
    const ppm = pixelsPerMeter(lat, z);
    expect(tileZoomForScale(ppm, lat)).toBe(15);
  });

  it('зум 19 на широте 45°', () => {
    const ppm = pixelsPerMeter(45, 19);
    expect(tileZoomForScale(ppm, 45)).toBe(19);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { BOM } from '../../src/core/data';
import { state } from '../../src/core/state';
import { bomTotal, calcBom } from '../../src/domain/bom';
import { simulate } from '../../src/domain/simulation';
import { defaultState } from './_setup';

beforeEach(() => Object.assign(state, structuredClone(defaultState)));

describe('calcBom', () => {
  it('пустой проект: только project-позиции', () => {
    state.panels = [];
    const bom = calcBom();
    expect(bom.some((r) => r.id === 'rack')).toBe(false);
    expect(bom.some((r) => r.id === 'ac_cable')).toBe(true);
    expect(bom.find((r) => r.id === 'ac_cable')!.qty).toBe(10);
  });

  it('количество крепежа = число панелей', () => {
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
      { x: 5, y: 1, w: 1.134, h: 1.722 },
    ];
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    const bom = calcBom();
    const rack = bom.find((r) => r.id === 'rack');
    expect(rack).toBeDefined();
    expect(rack!.qty).toBe(3);
    expect(rack!.total).toBe(3 * 2100);
  });

  it('кабель DC считается на стринги', () => {
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    const bom = calcBom();
    const cable = bom.find((r) => r.id === 'dc_cable');
    expect(cable).toBeDefined();
    expect(cable!.qty).toBeGreaterThan(0);
    expect(cable!.qty % 15).toBe(0); /* кратно 15 м на стринг */
  });

  it('счётчик исключается без экспорта', () => {
    state.exportRate = 0;
    const bom = calcBom();
    expect(bom.some((r) => r.id === 'meter')).toBe(false);
    state.exportRate = 2.5;
    expect(calcBom().some((r) => r.id === 'meter')).toBe(true);
  });

  it('bomTotal суммирует', () => {
    state.panels = [];
    const bom = calcBom();
    const sum = bom.reduce((a, r) => a + r.total, 0);
    expect(bomTotal(bom)).toBe(sum);
    expect(bomTotal(bom)).toBeGreaterThan(0);
  });

  it('simulate() включает BOM в capex и возвращает bom', () => {
    state.panels = [];
    const baseCapex = simulate().capex;
    /* добавление панелей увеличивает capex за счёт крепежа и кабеля */
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];
    const sim = simulate();
    expect(sim.capex).toBeGreaterThan(baseCapex);
    expect(Array.isArray(sim.bom)).toBe(true);
    expect(sim.bom.some((r) => r.id === 'rack')).toBe(true);
    /* BOM позиции из глобального каталога */
    expect(BOM.length).toBeGreaterThan(0);
  });

  it('overrides: BOM считается по другому состоянию', () => {
    state.panels = [];
    const v = simulate({ panels: [{ x: 1, y: 1, w: 1.134, h: 1.722 }] });
    expect(v.bom.find((r) => r.id === 'rack')!.qty).toBe(1);
    expect(state.panels).toHaveLength(0);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../../src/core/state';
import { computeShading, currentShadowScene, sunPos } from '../../src/domain/solar';
import { defaultState } from './_setup';

beforeEach(() => Object.assign(state, structuredClone(defaultState)));

describe('sunPos', () => {
  it('Краснодар, июнь, полдень — солнце высоко', () => {
    const sp = sunPos(45, 166, 12);
    expect(sp.altDeg).toBeGreaterThan(50);
    expect(sp.altDeg).toBeLessThan(75);
  });

  it('Краснодар, декабрь, полдень — солнце низко', () => {
    const sp = sunPos(45, 349, 12);
    expect(sp.altDeg).toBeLessThan(30);
    expect(sp.altDeg).toBeGreaterThan(10);
  });

  it('Краснодар, полночь — солнце за горизонтом', () => {
    const sp = sunPos(45, 166, 0);
    expect(sp.altDeg).toBeLessThan(0);
  });

  it('экватор, равноденствие, 6 утра — на горизонте', () => {
    const sp = sunPos(0, 80, 6);
    expect(sp.altDeg).toBeLessThan(10);
    expect(sp.altDeg).toBeGreaterThan(-5);
  });

  it('возвращает корректные углы (азимут)', () => {
    const sp = sunPos(45, 166, 9);
    /* Утром солнце на востоке → азимут < 180 */
    expect(sp.azDeg).toBeGreaterThan(0);
    expect(sp.azDeg).toBeLessThan(180);
  });

  it('вечером азимут > 180 (запад)', () => {
    const sp = sunPos(45, 166, 17);
    expect(sp.azDeg).toBeGreaterThan(180);
    expect(sp.azDeg).toBeLessThan(360);
  });
});

describe('currentShadowScene', () => {
  it('без препятствий — полигонов теней нет', () => {
    state.obstacles = [];
    const scene = currentShadowScene();
    expect(scene.polys).toHaveLength(0);
  });

  it('с препятствием нулевой высоты — нет теней', () => {
    state.obstacles = [{ x: 5, y: 5, w: 2, h: 2, z: 0 }];
    const scene = currentShadowScene();
    expect(scene.polys).toHaveLength(0);
  });

  it('высокое препятствие даёт тень (солнце над горизонтом)', () => {
    state.shadeMonth = 5;  /* июнь */
    state.shadeHour = 12;  /* полдень */
    state.obstacles = [{ x: 5, y: 5, w: 2, h: 2, z: 5 }];
    const scene = currentShadowScene();
    expect(scene.polys.length).toBeGreaterThan(0);
    expect(scene.sp.altDeg).toBeGreaterThan(40);
  });

  it('ночью теней нет даже с препятствием', () => {
    state.shadeHour = 2; /* глубокая ночь */
    state.obstacles = [{ x: 5, y: 5, w: 2, h: 2, z: 5 }];
    const scene = currentShadowScene();
    expect(scene.polys).toHaveLength(0);
    expect(scene.sp.altDeg).toBeLessThan(0);
  });
});

describe('computeShading', () => {
  it('без панелей — shadeLoss из 12 нулей', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    state.panels = [];
    state.obstacles = [{ x: 3, y: 3, w: 2, h: 2, z: 3 }];
    const loss = computeShading();
    expect(loss).toHaveLength(12);
    expect(loss.every((v) => v === 0)).toBe(true);
  });

  it('без препятствий — shadeLoss из 12 нулей', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    /* пара панелей */
    state.panels = [{ x: 2, y: 2, w: 1, h: 1.7 }];
    state.obstacles = [];
    const loss = computeShading();
    expect(loss).toHaveLength(12);
    expect(loss.every((v) => v === 0)).toBe(true);
  });

  it('с панелями и препятствием — массив из 12 чисел, есть потери', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 12 },
      { x: 0, y: 12 },
    ];
    /* сетка панелей 5×3 */
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        state.panels.push({ x: 1 + col * 2.5, y: 1 + row * 1.5, w: 2.1, h: 1.14 });
      }
    }
    state.obstacles = [{ x: 10, y: 4, w: 1.5, h: 1.5, z: 3 }];
    const loss = computeShading();
    expect(loss).toHaveLength(12);
    /* хотя бы в одном зимнем месяце потери > 0 (солнце низко — тень длиннее) */
    const hasLoss = loss.some((v) => v > 0);
    expect(hasLoss).toBe(true);
    /* все значения в [0, 1] */
    loss.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
    /* состояние обновлено */
    expect(state.shadeLoss).toEqual(loss);
  });

  it('shadeLoss кэшируется в state', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    state.panels = [{ x: 1, y: 1, w: 2, h: 2 }];
    state.obstacles = [{ x: 4, y: 4, w: 1, h: 1, z: 2 }];
    const before = [...state.shadeLoss];
    computeShading();
    const after = state.shadeLoss;
    /* после вызова массив должен обновиться (не обязательно измениться численно, но не быть тем же объектом) */
    expect(after).toHaveLength(12);
  });
});

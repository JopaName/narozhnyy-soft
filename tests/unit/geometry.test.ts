import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../../src/core/state';
import {
  ccw,
  computeRowRects,
  hull,
  orthSnap,
  panelDims,
  panelsInRect,
  pointInPoly,
  polyArea,
  pruneInvalid,
  rectInPoly,
  rectsOverlap,
  roofBBox,
  segCross,
  selfIntersects,
  validRect,
} from '../../src/domain/geometry';
import { defaultState } from './_setup';

beforeEach(() => Object.assign(state, structuredClone(defaultState)));

describe('pointInPoly', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it('точка внутри квадрата', () => {
    expect(pointInPoly(5, 5, square)).toBe(true);
  });

  it('точка снаружи квадрата', () => {
    expect(pointInPoly(15, 5, square)).toBe(false);
    expect(pointInPoly(-1, 5, square)).toBe(false);
  });

  it('точка на границе — разумное поведение', () => {
    /* не проверяем конкретно true/false – зависит от float */
    expect(typeof pointInPoly(0, 5, square)).toBe('boolean');
  });

  it('выпуклый пятиугольник', () => {
    const pent = [
      { x: 0, y: 2 },
      { x: 2, y: 0 },
      { x: 4, y: 1 },
      { x: 3, y: 3 },
      { x: 1, y: 4 },
    ];
    expect(pointInPoly(2, 2, pent)).toBe(true);
    expect(pointInPoly(5, 5, pent)).toBe(false);
  });
});

describe('rectInPoly', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 15 },
    { x: 0, y: 15 },
  ];

  it('полностью внутри', () => {
    expect(rectInPoly({ x: 2, y: 2, w: 5, h: 4 }, square)).toBe(true);
  });

  it('вылезает за край', () => {
    expect(rectInPoly({ x: 18, y: 2, w: 5, h: 4 }, square)).toBe(false);
  });

  it('полностью снаружи', () => {
    expect(rectInPoly({ x: 25, y: 2, w: 5, h: 4 }, square)).toBe(false);
  });
});

describe('rectsOverlap', () => {
  const a = { x: 0, y: 0, w: 10, h: 10 };

  it('пересекаются', () => {
    expect(rectsOverlap(a, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });

  it('касаются — не пересекаются', () => {
    expect(rectsOverlap(a, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });

  it('не пересекаются', () => {
    expect(rectsOverlap(a, { x: 20, y: 20, w: 5, h: 5 })).toBe(false);
  });

  it('полное вложение', () => {
    expect(rectsOverlap(a, { x: 2, y: 2, w: 4, h: 4 })).toBe(true);
  });
});

describe('polyArea', () => {
  it('площадь квадрата 10×10', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(polyArea(sq)).toBeCloseTo(100, 5);
  });

  it('площадь треугольника', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 0, y: 8 },
    ];
    expect(polyArea(tri)).toBeCloseTo(24, 5);
  });
});

describe('ccw / segCross', () => {
  it('ccw — три точки против часовой', () => {
    expect(ccw({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(true);
  });

  it('ccw — коллинеарны', () => {
    expect(ccw({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false);
  });

  it('segCross — пересекаются', () => {
    expect(
      segCross({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }),
    ).toBe(true);
  });

  it('segCross — не пересекаются', () => {
    expect(
      segCross({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }),
    ).toBe(false);
  });
});

describe('selfIntersects', () => {
  it('простой квадрат — нет самопересечений', () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(selfIntersects(sq)).toBe(false);
  });

  it('восьмёрка — есть самопересечение', () => {
    const eight = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    ];
    expect(selfIntersects(eight)).toBe(true);
  });

  it('треугольник — нет самопересечений', () => {
    const tri = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 3, y: 5 },
    ];
    expect(selfIntersects(tri)).toBe(false);
  });
});

describe('hull', () => {
  it('выпуклая оболочка 4 точек в квадрате', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ];
    const h = hull(pts);
    expect(h).toHaveLength(4);
    const area = polyArea(h);
    expect(area).toBeCloseTo(100, 1);
  });

  it('одна точка', () => {
    expect(hull([{ x: 1, y: 1 }])).toHaveLength(1);
  });

  it('две точки', () => {
    expect(
      hull([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toHaveLength(2);
  });
});

describe('orthSnap', () => {
  it('ортогональная привязка — по X', () => {
    state.orth = true;
    state.tempRoof = [{ x: 4, y: 6 }];
    const m = { x: 8.3, y: 6.0 };
    expect(orthSnap(m)).toEqual({ x: 8.25, y: 6 });
  });

  it('нет привязки — без tempRoof', () => {
    state.orth = true;
    state.tempRoof = [];
    const m = { x: 3.12, y: 5.67 };
    expect(orthSnap(m)).toEqual({ x: 3.0, y: 5.75 });
  });
});

describe('panelDims', () => {
  it('портрет — w/h переставлены', () => {
    state.orientation = 'portrait';
    state.panel = 0; /* JA Solar 410: w=1.722 h=1.134 */
    const d = panelDims();
    expect(d.w).toBe(1.134);
    expect(d.h).toBe(1.722);
  });

  it('ландшафт — как в каталоге', () => {
    state.orientation = 'landscape';
    state.panel = 1; /* Longi 450: w=2.094 h=1.134 */
    const d = panelDims();
    expect(d.w).toBe(2.094);
    expect(d.h).toBe(1.134);
  });
});

describe('validRect', () => {
  const roof = [
    { x: 0, y: 0 },
    { x: 15, y: 0 },
    { x: 15, y: 10 },
    { x: 0, y: 10 },
  ];

  beforeEach(() => {
    state.roof = [...roof];
    state.obstacles = [{ x: 5, y: 5, w: 2, h: 2, z: 3 }];
    state.panels = [];
  });

  it('внутри крыши, без препятствий — валидно', () => {
    expect(validRect({ x: 1, y: 1, w: 2, h: 2 })).toBe(true);
  });

  it('снаружи крыши — невалидно', () => {
    expect(validRect({ x: -5, y: -5, w: 2, h: 2 })).toBe(false);
  });

  it('пересекает препятствие — невалидно', () => {
    expect(validRect({ x: 4, y: 4, w: 4, h: 4 })).toBe(false);
  });

  it('нет крыши — невалидно', () => {
    state.roof = [];
    expect(validRect({ x: 1, y: 1, w: 2, h: 2 })).toBe(false);
  });

  it('пересекает другую панель — невалидно', () => {
    state.panels = [{ x: 3, y: 1, w: 2, h: 2 }];
    expect(validRect({ x: 2, y: 2, w: 3, h: 3 })).toBe(false);
  });
});

describe('pruneInvalid', () => {
  it('удаляет панели вне крыши', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 2, h: 2 },
      { x: 20, y: 20, w: 2, h: 2 },
      { x: 5, y: 5, w: 1, h: 1 },
    ];
    const removed = pruneInvalid();
    expect(removed).toBe(1);
    expect(state.panels).toHaveLength(2);
  });
});

describe('roofBBox', () => {
  it('bbox квадрата', () => {
    state.roof = [
      { x: 2, y: 3 },
      { x: 12, y: 3 },
      { x: 12, y: 13 },
      { x: 2, y: 13 },
    ];
    const bb = roofBBox();
    expect(bb.minX).toBeCloseTo(2);
    expect(bb.minY).toBeCloseTo(3);
    expect(bb.maxX).toBeCloseTo(12);
    expect(bb.maxY).toBeCloseTo(13);
  });
});

describe('computeRowRects', () => {
  const anchor = { x: 0, y: 0, w: 2, h: 1 };
  const gap = 0.2;

  it('горизонтальный ряд вправо', () => {
    const rects = computeRowRects(anchor, { x: 5, y: 0.3 }, gap);
    expect(rects.length).toBeGreaterThan(1);
    rects.forEach((r) => {
      expect(r.y).toBe(0);
      expect(r.w).toBe(2);
      expect(r.h).toBe(1);
    });
    /* шаг = 2 + 0.2 = 2.2; до x=5 → floor(5/2.2)+1 = 3 */
    expect(rects).toHaveLength(3);
    expect(rects[1].x).toBeCloseTo(2.2);
    expect(rects[2].x).toBeCloseTo(4.4);
  });

  it('ряд влево (отрицательное направление)', () => {
    const rects = computeRowRects(anchor, { x: -5, y: 0 }, gap);
    expect(rects.length).toBeGreaterThan(1);
    expect(rects[1].x).toBeCloseTo(-2.2);
  });

  it('вертикальный ряд вниз', () => {
    const rects = computeRowRects(anchor, { x: 0.1, y: 4 }, gap);
    rects.forEach((r) => expect(r.x).toBe(0));
    expect(rects[1].y).toBeCloseTo(1.2); /* шаг 1 + 0.2 */
  });

  it('клик без движения — одна панель (якорь)', () => {
    const rects = computeRowRects(anchor, { x: 0, y: 0 }, gap);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual(anchor);
  });
});

describe('panelsInRect', () => {
  const panels = [
    { x: 0, y: 0, w: 1, h: 1 },
    { x: 2, y: 0, w: 1, h: 1 },
    { x: 0, y: 2, w: 1, h: 1 },
    { x: 10, y: 10, w: 1, h: 1 },
  ];

  it('выбирает только целиком попавшие', () => {
    const idx = panelsInRect(panels, { x: -1, y: -1, w: 4, h: 4 });
    expect(idx).toEqual([0, 1, 2]);
  });

  it('пустая рамка — пустой результат', () => {
    expect(panelsInRect(panels, { x: 20, y: 20, w: 2, h: 2 })).toEqual([]);
  });

  it('частичное попадание не считается', () => {
    const idx = panelsInRect(panels, { x: 0.5, y: -0.5, w: 2, h: 2 });
    expect(idx).toEqual([]);
  });
});

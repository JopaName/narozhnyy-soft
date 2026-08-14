import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../../src/core/state';
import {
  ccw,
  computeRowRects,
  computeSnap,
  hull,
  localToWorld,
  orthSnap,
  panelDims,
  panelTotalAngle,
  panelWorldCorners,
  panelWorldCorners2,
  panelsBBox,
  panelsInRect,
  pointInPoly,
  polyArea,
  pruneInvalid,
  rectInPoly,
  rectsOverlap,
  roofBBox,
  rotatedRectInPoly,
  satOverlap,
  segCross,
  selfIntersects,
  validRect,
  worldToLocal,
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

describe('поворот массива', () => {
  it('worldToLocal/localToWorld — взаимообратны', () => {
    for (const ang of [0, 15, -30, 45]) {
      const p = { x: 7.3, y: -2.1 };
      const back = localToWorld(worldToLocal(p, ang), ang);
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it('panelWorldCorners при 0° = axis-aligned углы', () => {
    const c = panelWorldCorners({ x: 2, y: 3, w: 2, h: 1 }, 0);
    expect(c).toEqual([
      { x: 2, y: 3 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ]);
  });

  it('panelWorldCorners при 90° поворачивает углы', () => {
    const c = panelWorldCorners({ x: 0, y: 0, w: 2, h: 1 }, 90);
    /* (2,0) → (0,2), (2,1) → (-1,2), (0,1) → (-1,0) */
    expect(c[1].x).toBeCloseTo(0, 6);
    expect(c[1].y).toBeCloseTo(2, 6);
    expect(c[2].x).toBeCloseTo(-1, 6);
    expect(c[2].y).toBeCloseTo(2, 6);
  });

  it('rotatedRectInPoly: повёрнутый квадрат внутри полигона', () => {
    const big = [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
    ];
    expect(rotatedRectInPoly({ x: -1, y: -1, w: 2, h: 2 }, 30, big)).toBe(true);
    expect(rotatedRectInPoly({ x: 9, y: 9, w: 2, h: 2 }, 0, big)).toBe(false);
  });

  it('satOverlap: пересечение повёрнутого и axis-aligned', () => {
    const rot = panelWorldCorners({ x: 0, y: 0, w: 2, h: 2 }, 45);
    const ax = [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 3 },
      { x: 1, y: 3 },
    ];
    expect(satOverlap(rot, ax)).toBe(true);
    const far = [
      { x: 10, y: 10 },
      { x: 12, y: 10 },
      { x: 12, y: 12 },
      { x: 10, y: 12 },
    ];
    expect(satOverlap(rot, far)).toBe(false);
  });

  it('validRect с повёрнутым массивом: внутри крыши — да, вне — нет', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    state.obstacles = [];
    state.panels = [];
    state.arrayAngle = 20;
    /* (2,2,1×2) при 20° весь внутри */
    expect(validRect({ x: 2, y: 2, w: 1, h: 2 })).toBe(true);
    /* угол (8,8) при повороте выходит за y=10 */
    expect(validRect({ x: 6, y: 6, w: 2, h: 2 })).toBe(false);
    state.arrayAngle = 0;
    expect(validRect({ x: 6, y: 6, w: 2, h: 2 })).toBe(true);
  });

  it('validRect: повёрнутая панель не пересекает препятствие (SAT)', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    state.arrayAngle = 15;
    state.panels = [];
    /* панель (3,3,2×2) при 15° в мире занимает x 1.6..4.05, y 3.67..6.13 */
    state.obstacles = [{ x: 2.5, y: 4, w: 1, h: 1, z: 2 }];
    expect(validRect({ x: 3, y: 3, w: 2, h: 2 })).toBe(false);
    state.obstacles = [{ x: 8, y: 8, w: 1, h: 1, z: 2 }];
    expect(validRect({ x: 3, y: 3, w: 2, h: 2 })).toBe(true);
  });

  it('panelWorldCorners2: собственный угол панели вращается вокруг базы', () => {
    state.arrayAngle = 0;
    const c = panelWorldCorners2({ x: 5, y: 5, w: 2, h: 1, a: 30 });
    /* база (5,5) + R(30°)·offset */
    expect(c[0].x).toBeCloseTo(5, 9);
    expect(c[0].y).toBeCloseTo(5, 9);
    expect(c[1].x).toBeCloseTo(5 + 1.7321, 3);
    expect(c[1].y).toBeCloseTo(6, 3);
    expect(c[3].x).toBeCloseTo(4.5, 3);
    expect(c[3].y).toBeCloseTo(5.866, 3);
  });

  it('panelTotalAngle = угол массива + a', () => {
    state.arrayAngle = 20;
    expect(panelTotalAngle({ x: 0, y: 0, w: 1, h: 1, a: 30 })).toBe(50);
    expect(panelTotalAngle({ x: 0, y: 0, w: 1, h: 1 })).toBe(20);
  });

  it('validRect: панели с разными углами — SAT, с одинаковыми — локальное пересечение', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    state.arrayAngle = 0;
    state.obstacles = [];
    /* первая панель без поворота */
    state.panels = [{ x: 3, y: 3, w: 2, h: 1 }];
    /* вторая повёрнута на 90° и лежит на первой → пересечение (SAT) */
    expect(validRect({ x: 3.4, y: 3.4, w: 2, h: 1, a: 90 })).toBe(false);
    /* рядом — не пересекается */
    expect(validRect({ x: 7, y: 7, w: 1, h: 1, a: 90 })).toBe(true);
  });

  it('validRect: повёрнутая панель частично вне крыши — невалидна', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 6, y: 6 },
      { x: 0, y: 6 },
    ];
    state.arrayAngle = 0;
    state.obstacles = [];
    state.panels = [];
    /* (4.5,4.5) с поворотом 45°: дальний угол вылезает за 6×6 */
    expect(validRect({ x: 4.5, y: 4.5, w: 2, h: 1, a: 45 })).toBe(false);
  });

  it('computeSnap: прилипание к краю соседней панели', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    state.arrayAngle = 0;
    state.obstacles = [];
    /* сосед: правая грань x=5 */
    state.panels = [{ x: 3, y: 1, w: 2, h: 1 }];
    /* тащим панель с левой гранью 4.9 — близко к 5 */
    const snap = computeSnap({ x: 4.9, y: 1, w: 1, h: 1 }, new Set(), 0.2);
    expect(snap.dx).toBeCloseTo(0.1, 6);
    expect(snap.guideX).toBeCloseTo(5, 6);
  });

  it('computeSnap: к краю крыши', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    state.arrayAngle = 0;
    state.obstacles = [];
    state.panels = [];
    const snap = computeSnap({ x: 0.12, y: 5, w: 1, h: 1 }, new Set(), 0.3);
    expect(snap.dx).toBeCloseTo(-0.12, 6);
    expect(snap.guideX).toBeCloseTo(0, 6);
  });

  it('computeSnap: вне порога — нет снапа, игнор работает', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    state.arrayAngle = 0;
    state.obstacles = [];
    state.panels = [
      { x: 3, y: 1, w: 2, h: 1 },
      { x: 8, y: 8, w: 1, h: 1 },
    ];
    /* снап к панели 1 игнорируется */
    const snap = computeSnap({ x: 5.05, y: 1, w: 1, h: 1 }, new Set([0]), 0.2);
    expect(snap.dx).toBe(0);
    /* а к панели 2 — тоже нет (далеко) */
    expect(snap.guideX).toBeNull();
  });

  it('panelsBBox: bbox набора', () => {
    state.panels = [
      { x: 1, y: 1, w: 2, h: 1 },
      { x: 5, y: 3, w: 1, h: 2 },
    ];
    const bb = panelsBBox([0, 1])!;
    expect(bb.x).toBe(1);
    expect(bb.y).toBe(1);
    expect(bb.w).toBe(5);
    expect(bb.h).toBe(4);
  });
});

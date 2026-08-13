import { describe, expect, it } from 'vitest';
import { clipLineToRect, distPointLine, lineIntersection, projectToLine, snapToEdges } from '../../src/core/edge-detect';
import type { EdgeResult } from '../../src/core/edge-detect';

describe('lineIntersection', () => {
  it('x=2 и y=3 пересекаются в (2,3)', () => {
    const p = lineIntersection({ a: 1, b: 0, c: -2 }, { a: 0, b: 1, c: -3 });
    expect(p).not.toBeNull();
    expect(p!.x).toBeCloseTo(2, 9);
    expect(p!.y).toBeCloseTo(3, 9);
  });

  it('параллельные — null', () => {
    expect(lineIntersection({ a: 1, b: 0, c: -2 }, { a: 1, b: 0, c: -5 })).toBeNull();
  });

  it('диагонали пересекаются в (1,1)', () => {
    const p = lineIntersection({ a: 1, b: -1, c: 0 }, { a: 1, b: 1, c: -2 });
    expect(p!.x).toBeCloseTo(1, 9);
    expect(p!.y).toBeCloseTo(1, 9);
  });
});

describe('distPointLine / projectToLine', () => {
  it('расстояние до y=5 и проекция', () => {
    const l = { a: 0, b: 1, c: -5 };
    expect(distPointLine({ x: 7, y: 5.4 }, l)).toBeCloseTo(0.4, 9);
    const proj = projectToLine({ x: 7, y: 5.4 }, l);
    expect(proj.x).toBeCloseTo(7, 9);
    expect(proj.y).toBeCloseTo(5, 9);
  });
});

describe('clipLineToRect', () => {
  const rect = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

  it('горизонтальная линия внутри', () => {
    const seg = clipLineToRect({ a: 0, b: 1, c: -5 }, rect)!;
    expect(seg[0].y).toBeCloseTo(5, 9);
    expect(seg[0].x).toBeCloseTo(0, 9);
    expect(seg[1].x).toBeCloseTo(10, 9);
  });

  it('линия вне прямоугольника — null', () => {
    expect(clipLineToRect({ a: 0, b: 1, c: -20 }, rect)).toBeNull();
  });

  it('вертикальная линия внутри', () => {
    const seg = clipLineToRect({ a: 1, b: 0, c: -3 }, rect)!;
    expect(seg[0].x).toBeCloseTo(3, 9);
  });
});

describe('snapToEdges', () => {
  const edges: EdgeResult = {
    lines: [{ a: 0, b: 1, c: -5 }], /* y=5 */
    corners: [{ x: 2, y: 2 }],
  };

  it('снап к линии в пределах порога', () => {
    const p = snapToEdges({ x: 7, y: 5.3 }, edges, 1);
    expect(p.y).toBeCloseTo(5, 9);
    expect(p.x).toBeCloseTo(7, 9);
  });

  it('снап к углу приоритетнее при меньшем расстоянии', () => {
    const p = snapToEdges({ x: 2.2, y: 2.1 }, edges, 1);
    expect(p.x).toBeCloseTo(2, 9);
    expect(p.y).toBeCloseTo(2, 9);
  });

  it('снап к углу приоритетнее даже если линия ближе', () => {
    const edgesCorner: EdgeResult = {
      lines: [{ a: 0, b: 1, c: -2 }], /* y=2 проходит через угол */
      corners: [{ x: 2, y: 2 }],
    };
    const p = snapToEdges({ x: 1.9, y: 2.1 }, edgesCorner, 1);
    /* расстояние до линии 0.1, до угла 0.14 — угол всё равно выигрывает */
    expect(p.x).toBeCloseTo(2, 9);
    expect(p.y).toBeCloseTo(2, 9);
  });

  it('вне порога — точка не меняется', () => {
    const p = snapToEdges({ x: 9, y: 9 }, edges, 0.5);
    expect(p).toEqual({ x: 9, y: 9 });
  });
});

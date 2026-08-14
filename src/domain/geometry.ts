import { PANELS } from '../core/data';
import { state } from '../core/state';
import type { Point, Rect } from '../core/types';

export function pointInPoly(px: number, py: number, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

export function rectInPoly(r: Rect, poly: Point[]): boolean {
  const pts = [
    [r.x, r.y],
    [r.x + r.w, r.y],
    [r.x, r.y + r.h],
    [r.x + r.w, r.y + r.h],
    [r.x + r.w / 2, r.y + r.h / 2],
  ];
  return pts.every((p) => pointInPoly(p[0], p[1], poly));
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w <= b.x + 1e-9 ||
    b.x + b.w <= a.x + 1e-9 ||
    a.y + a.h <= b.y + 1e-9 ||
    b.y + b.h <= a.y + 1e-9
  );
}

export function polyArea(poly: Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    a += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
  }
  return Math.abs(a) / 2;
}

export function ccw(a: Point, b: Point, c: Point): boolean {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

export function segCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

export function selfIntersects(poly: Point[]): boolean {
  const n = poly.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (segCross(a, b, poly[j], poly[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function hull(pts: Point[]): Point[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function orthSnap(m: Point): Point {
  let x = Math.round(m.x / 0.25) * 0.25;
  let y = Math.round(m.y / 0.25) * 0.25;
  if (state.orth && state.tempRoof.length) {
    const p = state.tempRoof[state.tempRoof.length - 1];
    if (Math.abs(x - p.x) >= Math.abs(y - p.y)) y = p.y;
    else x = p.x;
  }
  return { x, y };
}

export function panelDims(): { w: number; h: number } {
  const md = PANELS[state.panel];
  return state.orientation === 'portrait' ? { w: md.h, h: md.w } : { w: md.w, h: md.h };
}

/** Итоговый угол панели в мире: угол массива + индивидуальный поворот */
export function panelTotalAngle(p: Rect & { a?: number }): number {
  return state.arrayAngle + (p.a || 0);
}

/** Мировые углы панели с учётом двухступенчатого трансформа:
 *  позиция (x,y) живёт в пространстве массива, собственный угол крутится вокруг позиции. */
export function panelWorldCorners2(r: Rect & { a?: number }): Point[] {
  const base = localToWorld({ x: r.x, y: r.y }, state.arrayAngle);
  const total = panelTotalAngle(r);
  const out: Point[] = [];
  for (const [lx, ly] of [
    [0, 0],
    [r.w, 0],
    [r.w, r.h],
    [0, r.h],
  ] as const) {
    const o = localToWorld({ x: lx, y: ly }, total);
    out.push({ x: base.x + o.x, y: base.y + o.y });
  }
  return out;
}

/** Повёрнутая панель внутри полигона: углы + центр + середины рёбер (двухступенчатый трансформ) */
export function rotatedPanelInPoly(r: Rect & { a?: number }, poly: Point[]): boolean {
  const base = localToWorld({ x: r.x, y: r.y }, state.arrayAngle);
  const total = panelTotalAngle(r);
  const samples: [number, number][] = [
    [0, 0],
    [r.w, 0],
    [r.w, r.h],
    [0, r.h],
    [r.w / 2, r.h / 2],
    [r.w / 2, 0],
    [0, r.h / 2],
    [r.w, r.h / 2],
    [r.w / 2, r.h],
  ];
  for (const [lx, ly] of samples) {
    const o = localToWorld({ x: lx, y: ly }, total);
    if (!pointInPoly(base.x + o.x, base.y + o.y, poly)) return false;
  }
  return true;
}

export function validRect(r: Rect & { a?: number }, ignore = -1): boolean {
  if (!r || !isFinite(r.x) || !isFinite(r.y) || r.w <= 0 || r.h <= 0) return false;
  if (!state.roof.length || !rotatedPanelInPoly(r, state.roof)) return false;
  /* препятствия — в мировых координатах: SAT против повёрнутых углов */
  const corners = panelWorldCorners2(r);
  if (state.obstacles.some((o) => satOverlap(corners, [
    { x: o.x, y: o.y },
    { x: o.x + o.w, y: o.y },
    { x: o.x + o.w, y: o.y + o.h },
    { x: o.x, y: o.y + o.h },
  ]))) return false;
  /* панель-панель: одинаковые углы — локальное axis-aligned, иначе SAT */
  for (let i = 0; i < state.panels.length; i++) {
    if (i === ignore) continue;
    const p = state.panels[i];
    if (Math.abs(panelTotalAngle(p) - panelTotalAngle(r)) < 1e-9) {
      if (rectsOverlap(r, p)) return false;
    } else {
      if (satOverlap(corners, panelWorldCorners2(p))) return false;
    }
  }
  return true;
}

export function pruneInvalid(): number {
  const before = state.panels.length;
  state.panels = state.panels.filter((p, i) => validRect(p, i));
  return before - state.panels.length;
}

export function roofBBox(): { minX: number; minY: number; maxX: number; maxY: number } {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  state.roof.forEach((p) => {
    a = Math.min(a, p.x);
    b = Math.min(b, p.y);
    c = Math.max(c, p.x);
    d = Math.max(d, p.y);
  });
  return { minX: a, minY: b, maxX: c, maxY: d };
}

/* ═══ ПОВОРОТ МАССИВА ═══
 * Панели хранятся в локальных координатах массива (axis-aligned),
 * мир = R(arrayAngle) · локальная точка. */

const DEG2RAD = Math.PI / 180;

export function worldToLocal(p: Point, angleDeg: number): Point {
  const rad = -angleDeg * DEG2RAD;
  return { x: p.x * Math.cos(rad) - p.y * Math.sin(rad), y: p.x * Math.sin(rad) + p.y * Math.cos(rad) };
}

export function localToWorld(p: Point, angleDeg: number): Point {
  const rad = angleDeg * DEG2RAD;
  return { x: p.x * Math.cos(rad) - p.y * Math.sin(rad), y: p.x * Math.sin(rad) + p.y * Math.cos(rad) };
}

/** Мировые координаты углов повёрнутой панели (локальный r) */
export function panelWorldCorners(r: Rect, angleDeg: number): Point[] {
  const out: Point[] = [];
  for (const [lx, ly] of [
    [0, 0],
    [r.w, 0],
    [r.w, r.h],
    [0, r.h],
  ] as const) {
    out.push(localToWorld({ x: r.x + lx, y: r.y + ly }, angleDeg));
  }
  return out;
}

/** Повёрнутый прямоугольник внутри полигона: углы + центр + середины рёбер */
export function rotatedRectInPoly(r: Rect, angleDeg: number, poly: Point[]): boolean {
  const pts: Point[] = [];
  const samples: [number, number][] = [
    [0, 0],
    [r.w, 0],
    [r.w, r.h],
    [0, r.h],
    [r.w / 2, r.h / 2],
    [r.w / 2, 0],
    [0, r.h / 2],
    [r.w, r.h / 2],
    [r.w / 2, r.h],
  ];
  for (const [lx, ly] of samples) {
    pts.push(localToWorld({ x: r.x + lx, y: r.y + ly }, angleDeg));
  }
  return pts.every((p) => pointInPoly(p.x, p.y, poly));
}

/** Разделяющие оси (SAT): два выпуклых полигона пересекаются? */
export function satOverlap(c1: Point[], c2: Point[]): boolean {
  const axes: Point[] = [];
  const collect = (c: Point[]) => {
    for (let i = 0; i < c.length; i++) {
      const a = c[i];
      const b = c[(i + 1) % c.length];
      const e = { x: b.x - a.x, y: b.y - a.y };
      axes.push({ x: -e.y, y: e.x });
    }
  };
  collect(c1);
  collect(c2);
  for (const ax of axes) {
    const len = Math.hypot(ax.x, ax.y);
    if (len < 1e-9) continue;
    const nx = ax.x / len;
    const ny = ax.y / len;
    let mn1 = Infinity;
    let mx1 = -Infinity;
    let mn2 = Infinity;
    let mx2 = -Infinity;
    for (const p of c1) {
      const d = p.x * nx + p.y * ny;
      mn1 = Math.min(mn1, d);
      mx1 = Math.max(mx1, d);
    }
    for (const p of c2) {
      const d = p.x * nx + p.y * ny;
      mn2 = Math.min(mn2, d);
      mx2 = Math.max(mx2, d);
    }
    if (mx1 < mn2 - 1e-9 || mx2 < mn1 - 1e-9) return false;
  }
  return true;
}

/** Локальный bbox точек полигона (для автораскладки по повёрнутой сетке) */
export function localPolyBBox(poly: Point[], angleDeg: number): { minX: number; minY: number; maxX: number; maxY: number } {
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  poly.forEach((p) => {
    const l = worldToLocal(p, angleDeg);
    a = Math.min(a, l.x);
    b = Math.min(b, l.y);
    c = Math.max(c, l.x);
    d = Math.max(d, l.y);
  });
  return { minX: a, minY: b, maxX: c, maxY: d };
}

/** Ряд панелей: от якоря вдоль доминирующей оси до точки `to` (включительно) */
export function computeRowRects(anchor: Rect, to: Point, gap: number): Rect[] {
  const horizontal = Math.abs(to.x - anchor.x) >= Math.abs(to.y - anchor.y);
  const stepX = horizontal ? anchor.w + gap : 0;
  const stepY = horizontal ? 0 : anchor.h + gap;
  const len = horizontal ? to.x - anchor.x : to.y - anchor.y;
  const step = horizontal ? stepX : stepY;
  const sign = len >= 0 ? 1 : -1;
  const count = Math.max(1, Math.floor(Math.abs(len) / Math.max(step, 1e-9)) + 1);
  const rects: Rect[] = [];
  for (let i = 0; i < count; i++) {
    rects.push({ x: anchor.x + i * sign * stepX, y: anchor.y + i * sign * stepY, w: anchor.w, h: anchor.h });
  }
  return rects;
}

/** Индексы прямоугольников, целиком лежащих внутри r */
export function panelsInRect(panels: Rect[], r: Rect): number[] {
  const out: number[] = [];
  panels.forEach((p, i) => {
    if (p.x >= r.x - 1e-9 && p.x + p.w <= r.x + r.w + 1e-9 && p.y >= r.y - 1e-9 && p.y + p.h <= r.y + r.h + 1e-9) {
      out.push(i);
    }
  });
  return out;
}

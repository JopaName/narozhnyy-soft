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

export function validRect(r: Rect, ignore = -1): boolean {
  if (!r || !isFinite(r.x) || !isFinite(r.y) || r.w <= 0 || r.h <= 0) return false;
  if (!state.roof.length || !rectInPoly(r, state.roof)) return false;
  if (state.obstacles.some((o) => rectsOverlap(r, o))) return false;
  return !state.panels.some((p, i) => i !== ignore && rectsOverlap(r, p));
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

import { events, R } from '../core/runtime';
import { state } from '../core/state';
import type { Point } from '../core/types';
import { clamp } from '../core/utils';
import { cv, dpr } from './canvas';

export const m2s = (x: number, y: number): [number, number] => [x * R.view.s + R.view.ox, y * R.view.s + R.view.oy];

export function s2m(e: { clientX: number; clientY: number }): Point {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - R.view.ox) / R.view.s, y: (e.clientY - r.top - R.view.oy) / R.view.s };
}

export function fitView(): void {
  const pts: Point[] = [...state.roof];
  state.panels.forEach((p) => {
    pts.push({ x: p.x, y: p.y });
    pts.push({ x: p.x + p.w, y: p.y + p.h });
  });
  if (!pts.length) {
    R.view = { s: 22, ox: 80, oy: 60 };
    events.draw();
    return;
  }
  let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
  pts.forEach((p) => {
    a = Math.min(a, p.x);
    b = Math.min(b, p.y);
    c = Math.max(c, p.x);
    d = Math.max(d, p.y);
  });
  const W = cv.width / dpr || 800;
  const H = cv.height / dpr || 500;
  R.view.s = clamp(Math.min((W - 120) / Math.max(0.5, c - a + 2), (H - 140) / Math.max(0.5, d - b + 2)), 4, 140);
  R.view.ox = (W - (c - a) * R.view.s) / 2 - a * R.view.s;
  R.view.oy = (H - (d - b) * R.view.s) / 2 - b * R.view.s;
  events.draw();
}

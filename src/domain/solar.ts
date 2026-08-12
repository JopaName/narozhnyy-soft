import { CITIES, CUM_DAY } from '../core/data';
import { events, R } from '../core/runtime';
import { state } from '../core/state';
import type { Point } from '../core/types';
import { clamp } from '../core/utils';
import { hull, pointInPoly } from './geometry';

export interface SunPos {
  alt: number;
  az: number;
  altDeg: number;
  azDeg: number;
}

export function sunPos(latDeg: number, dayOfYear: number, hour: number): SunPos {
  const lat = (latDeg * Math.PI) / 180;
  const decl = ((23.45 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365);
  const H = ((hour - 12) * 15 * Math.PI) / 180;
  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(H);
  const alt = Math.asin(clamp(sinAlt, -1, 1));
  const cosAz = (Math.sin(decl) - sinAlt * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat) + 1e-9);
  let az = Math.acos(clamp(cosAz, -1, 1));
  if (H > 0) az = 2 * Math.PI - az;
  return { alt, az, altDeg: (alt * 180) / Math.PI, azDeg: (az * 180) / Math.PI };
}

export function currentShadowScene(): { sp: SunPos; polys: Point[][] } {
  const city = CITIES[state.city] || CITIES.krasnodar;
  const sp = sunPos(city.lat, CUM_DAY[state.shadeMonth] + 15, state.shadeHour);
  const polys: Point[][] = [];
  if (sp.altDeg > 0.5) {
    const L = 1 / Math.tan(sp.alt);
    const dx = -Math.sin(sp.az) * L;
    const dy = Math.cos(sp.az) * L;
    state.obstacles.forEach((o) => {
      const z = o.z || 0;
      if (z <= 0.05) return;
      const pts = [
        { x: o.x, y: o.y },
        { x: o.x + o.w, y: o.y },
        { x: o.x, y: o.y + o.h },
        { x: o.x + o.w, y: o.y + o.h },
        { x: o.x + dx * z, y: o.y + dy * z },
        { x: o.x + o.w + dx * z, y: o.y + dy * z },
        { x: o.x + dx * z, y: o.y + o.h + dy * z },
        { x: o.x + o.w + dx * z, y: o.y + o.h + dy * z },
      ];
      polys.push(hull(pts));
    });
  }
  return { sp, polys };
}

export function computeShading(): number[] {
  const loss = new Array(12).fill(0);
  const obs = state.obstacles.filter((o) => (o.z || 0) > 0.05);
  if (!state.panels.length || !obs.length) {
    state.shadeLoss = loss;
    return loss;
  }
  const city = CITIES[state.city] || CITIES.krasnodar;
  const coarse = state.panels.length > 600;
  const hours = coarse ? [7, 9, 11, 13, 15, 17] : [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  for (let m = 0; m < 12; m++) {
    const doy = CUM_DAY[m] + 15;
    let wSum = 0;
    let lSum = 0;
    for (const hr of hours) {
      const sp = sunPos(city.lat, doy, hr);
      if (sp.altDeg < 3) continue;
      const L = 1 / Math.tan(sp.alt);
      const dx = -Math.sin(sp.az) * L;
      const dy = Math.cos(sp.az) * L;
      const shps: { poly: Point[]; bb: { a: number; b: number; c: number; d: number } }[] = [];
      for (const o of obs) {
        const z = o.z || 0;
        const pts = [
          { x: o.x, y: o.y },
          { x: o.x + o.w, y: o.y },
          { x: o.x, y: o.y + o.h },
          { x: o.x + o.w, y: o.y + o.h },
          { x: o.x + dx * z, y: o.y + dy * z },
          { x: o.x + o.w + dx * z, y: o.y + dy * z },
          { x: o.x + dx * z, y: o.y + o.h + dy * z },
          { x: o.x + o.w + dx * z, y: o.y + o.h + dy * z },
        ];
        const hp = hull(pts);
        let a = 1e9, b = 1e9, c = -1e9, d2 = -1e9;
        hp.forEach((p) => {
          a = Math.min(a, p.x);
          b = Math.min(b, p.y);
          c = Math.max(c, p.x);
          d2 = Math.max(d2, p.y);
        });
        shps.push({ poly: hp, bb: { a, b, c, d: d2 } });
      }
      let tot = 0;
      for (const p of state.panels) {
        let hit = false;
        for (const s of shps) {
          if (!(p.x + p.w <= s.bb.a || s.bb.c <= p.x || p.y + p.h <= s.bb.b || s.bb.d <= p.y)) {
            hit = true;
            break;
          }
        }
        if (!hit) continue;
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const ptsTest: number[][] = coarse
          ? [[cx, cy]]
          : [[cx, cy], [p.x, p.y], [p.x + p.w, p.y], [p.x, p.y + p.h], [p.x + p.w, p.y + p.h]];
        let sh = 0;
        for (const t of ptsTest) {
          for (const s of shps) {
            if (pointInPoly(t[0], t[1], s.poly)) {
              sh++;
              break;
            }
          }
        }
        tot += sh / ptsTest.length;
      }
      const wgt = Math.sin(sp.alt);
      lSum += wgt * (tot / state.panels.length);
      wSum += wgt;
    }
    loss[m] = wSum > 0 ? clamp(lSum / wSum, 0, 1) : 0;
  }
  state.shadeLoss = loss;
  return loss;
}

let shadeTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleShading(): void {
  if (shadeTimer) clearTimeout(shadeTimer);
  shadeTimer = setTimeout(() => {
    computeShading();
    events.refresh();
  }, 250);
}

export function redrawIfCanvasVisible(): void {
  if (R.activeTab === 'scheme') events.draw();
}

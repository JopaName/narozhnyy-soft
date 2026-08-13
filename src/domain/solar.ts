import { CITIES, CUM_DAY } from '../core/data';
import { events, R } from '../core/runtime';
import { state } from '../core/state';
import type { AppState, Point } from '../core/types';
import { clamp } from '../core/utils';
import { resolveState } from './simulation';
import { hull, panelWorldCorners, pointInPoly } from './geometry';

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

export function computeShading(overrides?: Partial<AppState>): number[] {
  const s = resolveState(overrides);
  const loss = new Array(12).fill(0);
  const obs = s.obstacles.filter((o) => (o.z || 0) > 0.05);
  /* По-панельная тепловая карта: годовая взвешенная доля тени (только для живого состояния) */
  const acc = new Array(s.panels.length).fill(0);
  const accW = new Array(s.panels.length).fill(0);
  if (!s.panels.length || !obs.length) {
    panelShade.length = 0;
    if (!overrides) state.shadeLoss = loss;
    return loss;
  }
  /* Углы панелей в мировых координатах (массив может быть повёрнут) + их bbox */
  const panelData = s.panels.map((p) => {
    const pts = panelWorldCorners(p, s.arrayAngle);
    let a = 1e9, b = 1e9, c = -1e9, d2 = -1e9;
    pts.forEach((q) => {
      a = Math.min(a, q.x);
      b = Math.min(b, q.y);
      c = Math.max(c, q.x);
      d2 = Math.max(d2, q.y);
    });
    return { pts, bb: { a, b, c, d: d2 } };
  });
  const city = CITIES[s.city] || CITIES.krasnodar;
  const coarse = s.panels.length > 600;
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
      for (let pi = 0; pi < panelData.length; pi++) {
        const pd = panelData[pi];
        let hit = false;
        for (const sh of shps) {
          if (!(pd.bb.c <= sh.bb.a || sh.bb.c <= pd.bb.a || pd.bb.d <= sh.bb.b || sh.bb.d <= pd.bb.b)) {
            hit = true;
            break;
          }
        }
        if (!hit) continue;
        const testPts = coarse
          ? [midPoint(pd.pts[0], pd.pts[2])]
          : [midPoint(pd.pts[0], pd.pts[2]), pd.pts[0], pd.pts[1], pd.pts[2], pd.pts[3]];
        let sh = 0;
        for (const t of testPts) {
          for (const shPoly of shps) {
            if (pointInPoly(t.x, t.y, shPoly.poly)) {
              sh++;
              break;
            }
          }
        }
        const frac = sh / testPts.length;
        tot += frac;
        if (!overrides && frac > 0) {
          acc[pi] += frac * Math.sin(sp.alt);
          accW[pi] += Math.sin(sp.alt);
        }
      }
      const wgt = Math.sin(sp.alt);
      lSum += wgt * (tot / s.panels.length);
      wSum += wgt;
    }
    loss[m] = wSum > 0 ? clamp(lSum / wSum, 0, 1) : 0;
  }
  if (!overrides) {
    state.shadeLoss = loss;
    /* нормализуем по-панельную карту */
    panelShade.length = acc.length;
    for (let pi = 0; pi < acc.length; pi++) {
      panelShade[pi] = accW[pi] > 0 ? Math.min(1, acc[pi] / accW[pi]) : 0;
    }
  }
  return loss;
}

/** По-панельная годовая доля тени (0..1) — для тепловой карты */
export const panelShade: number[] = [];

function midPoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
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

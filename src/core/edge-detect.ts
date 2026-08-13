/* Детекция краёв крыши по фоновому изображению (спутник/фото).
 * Sobel → порог+NMS → Hough-преобразование → линии в МИРОВЫХ координатах
 * (через calibS — не зависит от зума канваса) + углы (пересечения линий). */

import type { Point } from './types';

export interface DetectedLine {
  /** a·x + b·y + c = 0, нормализовано (a²+b²=1) */
  a: number;
  b: number;
  c: number;
}

export interface EdgeResult {
  lines: DetectedLine[];
  corners: Point[];
}

/* ═══ Чистые хелперы (unit-тестируемые) ═══ */

export function lineIntersection(l1: DetectedLine, l2: DetectedLine): Point | null {
  const det = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(det) < 1e-9) return null;
  const x = (l1.b * l2.c - l2.b * l1.c) / det;
  const y = (l2.a * l1.c - l1.a * l2.c) / det;
  return { x, y };
}

export function distPointLine(p: Point, l: DetectedLine): number {
  return Math.abs(l.a * p.x + l.b * p.y + l.c);
}

export function projectToLine(p: Point, l: DetectedLine): Point {
  const d = l.a * p.x + l.b * p.y + l.c;
  return { x: p.x - l.a * d, y: p.y - l.b * d };
}

export function clipLineToRect(
  l: DetectedLine,
  rect: { minX: number; minY: number; maxX: number; maxY: number },
): [Point, Point] | null {
  if (Math.abs(l.b) > 1e-9) {
    const pts: Point[] = [];
    const y1 = -(l.a * rect.minX + l.c) / l.b;
    const y2 = -(l.a * rect.maxX + l.c) / l.b;
    if (y1 >= rect.minY && y1 <= rect.maxY) pts.push({ x: rect.minX, y: y1 });
    if (y2 >= rect.minY && y2 <= rect.maxY) pts.push({ x: rect.maxX, y: y2 });
    if (pts.length === 2) return [pts[0], pts[1]];
  }
  if (Math.abs(l.a) > 1e-9) {
    const pts: Point[] = [];
    const x1 = -(l.b * rect.minY + l.c) / l.a;
    const x2 = -(l.b * rect.maxY + l.c) / l.a;
    if (x1 >= rect.minX && x1 <= rect.maxX) pts.push({ x: x1, y: rect.minY });
    if (x2 >= rect.minX && x2 <= rect.maxX) pts.push({ x: x2, y: rect.maxY });
    if (pts.length === 2) return [pts[0], pts[1]];
  }
  return null;
}

/** Примагничивание: угол (если в пределах порога) приоритетнее линии, иначе ближайшая линия */
export function snapToEdges(p: Point, edges: EdgeResult, maxDist: number): Point {
  let bestCorner: Point | null = null;
  let bestCD = maxDist;
  for (const c of edges.corners) {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < bestCD) {
      bestCD = d;
      bestCorner = c;
    }
  }
  if (bestCorner) return { x: bestCorner.x, y: bestCorner.y };

  let best: Point = p;
  let bestD = maxDist;
  for (const l of edges.lines) {
    const d = distPointLine(p, l);
    if (d < bestD) {
      bestD = d;
      best = projectToLine(p, l);
    }
  }
  return best;
}

/* ═══ Текущий результат детекции ═══ */

let currentEdges: EdgeResult | null = null;

export function getCurrentEdges(): EdgeResult | null {
  return currentEdges;
}

export function setCurrentEdges(e: EdgeResult | null): void {
  currentEdges = e;
}

/* ═══ Детекция ═══ */

export async function detectEdges(img: HTMLImageElement, calibS: number): Promise<EdgeResult> {
  const maxDim = 480;
  const k = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(3, Math.round(img.naturalWidth * k));
  const h = Math.max(3, Math.round(img.naturalHeight * k));

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return { lines: [], corners: [] };
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  /* Градации серого */
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  /* Sobel */
  const mag = new Float32Array(w * h);
  let maxMag = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] + gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      if (m > maxMag) maxMag = m;
    }
  }

  /* Порог + простое подавление немаксимумов */
  const thresh = maxMag * 0.28;
  const edgePts: Point[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (mag[i] < thresh) continue;
      if (mag[i] < mag[i - 1] || mag[i] < mag[i + 1] || mag[i] < mag[i - w] || mag[i] < mag[i + w]) continue;
      edgePts.push({ x, y });
    }
  }
  if (edgePts.length < 30) return { lines: [], corners: [] };

  /* Hough */
  const diag = Math.ceil(Math.hypot(w, h));
  const rhoStep = 2;
  const thetaStep = (2 * Math.PI) / 180;
  const nRho = Math.ceil((2 * diag) / rhoStep);
  const nTheta = Math.ceil(Math.PI / thetaStep);
  const acc = new Int32Array(nRho * nTheta);
  for (const p of edgePts) {
    for (let ti = 0; ti < nTheta; ti++) {
      const theta = ti * thetaStep;
      const rho = p.x * Math.cos(theta) + p.y * Math.sin(theta);
      const ri = Math.round((rho + diag) / rhoStep);
      if (ri >= 0 && ri < nRho) acc[ri * nTheta + ti]++;
    }
  }

  /* Пики с подавлением окрестности */
  const peaks: { ri: number; ti: number; v: number }[] = [];
  for (let ri = 2; ri < nRho - 2; ri++) {
    for (let ti = 2; ti < nTheta - 2; ti++) {
      const v = acc[ri * nTheta + ti];
      if (v < 20) continue;
      let isMax = true;
      for (let dr = -2; dr <= 2 && isMax; dr++) {
        for (let dt = -2; dt <= 2 && isMax; dt++) {
          if (dr === 0 && dt === 0) continue;
          const idx = (ri + dr) * nTheta + (ti + dt);
          if (idx >= 0 && idx < acc.length && acc[idx] >= v) isMax = false;
        }
      }
      if (isMax) peaks.push({ ri, ti, v });
    }
  }
  peaks.sort((a, b) => b.v - a.v);

  /* Линии в мировых координатах: малый пиксель → мир через k·calibS */
  const lines: DetectedLine[] = [];
  for (const pk of peaks.slice(0, 30)) {
    const theta = pk.ti * thetaStep;
    const rho = pk.ri * rhoStep - diag;
    const A = Math.cos(theta);
    const B = Math.sin(theta);
    const C = rho / (k * calibS);
    lines.push({ a: A, b: B, c: -C });
  }

  /* Углы — пересечения топ-12 линий */
  const corners: Point[] = [];
  const topLines = lines.slice(0, 12);
  for (let i = 0; i < topLines.length; i++) {
    for (let j = i + 1; j < topLines.length; j++) {
      const p = lineIntersection(topLines[i], topLines[j]);
      if (p && isFinite(p.x) && isFinite(p.y)) corners.push(p);
    }
  }

  return { lines, corners };
}

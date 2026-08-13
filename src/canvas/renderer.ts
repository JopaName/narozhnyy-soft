import { MONTHS } from '../core/data';
import { events, R } from '../core/runtime';
import { state } from '../core/state';
import { el, fmtHour, nf } from '../core/utils';
import { localToWorld, orthSnap, roofBBox, validRect } from '../domain/geometry';
import { currentShadowScene, panelShade } from '../domain/solar';
import { stringAssignments } from '../domain/simulation';
import { getBgImage } from '../ui/bg';
import { getCurrentEdges, clipLineToRect } from '../core/edge-detect';
import { ensureTile, getCachedTile } from '../ui/map-browser';
import { ctx, cv, dpr } from './canvas';
import { m2s } from './view';

const STRING_PALETTE = ['#f59e0b', '#38bdf8', '#22c55e', '#a78bfa', '#f87171', '#2dd4bf', '#fbbf24', '#e879f9', '#818cf8', '#fb923c'];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Цвет тепловой карты: 0 — зелёный, 0.5 — жёлтый, 1 — красный */
function shadeColor(f: number): string {
  const t = Math.max(0, Math.min(1, f));
  let r: number, g: number, b: number;
  if (t < 0.5) {
    const k = t / 0.5;
    r = Math.round(lerp(34, 250, k));
    g = Math.round(lerp(197, 204, k));
    b = Math.round(lerp(94, 21, k));
  } else {
    const k = (t - 0.5) / 0.5;
    r = Math.round(lerp(250, 248, k));
    g = Math.round(lerp(204, 113, k));
    b = Math.round(lerp(21, 113, k));
  }
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

const WORLD_METERS = 40075016.686;

function drawMapMode(W: number, H: number): void {
  const mm = R.mapMode!;
  const z = Math.max(1, Math.min(20, mm.zoom));
  const n = Math.pow(2, z);
  /* мировые метры видимой области */
  const wx0 = -R.view.ox / R.view.s;
  const wy0 = -R.view.oy / R.view.s;
  const wx1 = (W - R.view.ox) / R.view.s;
  const wy1 = (H - R.view.oy) / R.view.s;
  const tx0 = Math.floor((wx0 / WORLD_METERS) * n);
  const ty0 = Math.floor((wy0 / WORLD_METERS) * n);
  const tx1 = Math.floor((wx1 / WORLD_METERS) * n);
  const ty1 = Math.floor((wy1 / WORLD_METERS) * n);
  const regionId = mm.regionId;

  ctx.fillStyle = '#1a1d23';
  ctx.fillRect(0, 0, W, H);

  for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = tx0; tx <= tx1; tx++) {
      if (tx < 0 || tx >= n) continue;
      const key = regionId + '/' + z + '/' + tx + '/' + ty;
      const img = getCachedTile(key);
      /* Позиция тайла: мировые метры → экран */
      const tileW = WORLD_METERS / n;
      const sx = tx * tileW * R.view.s + R.view.ox;
      const sy = ty * tileW * R.view.s + R.view.oy;
      const size = tileW * R.view.s;
      if (img) {
        ctx.drawImage(img, sx, sy, size + 0.5, size + 0.5);
      } else {
        ctx.fillStyle = '#262a31';
        ctx.fillRect(sx, sy, size + 1, size + 1);
        ensureTile(regionId, z, tx, ty);
      }
    }
  }

  /* Маркер в центре */
  const cx = W / 2;
  const cy = H / 2;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx, cy - 8);
  ctx.moveTo(cx, cy + 8);
  ctx.lineTo(cx, cy + 22);
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 8, cy);
  ctx.moveTo(cx + 8, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.font = '700 11px Manrope';
  ctx.textAlign = 'center';
  ctx.fillText(mm.lat.toFixed(5) + ', ' + mm.lng.toFixed(5), cx, cy + 34);
}

export function draw(): void {
  if (!cv.width) return;
  const W = cv.width / dpr;
  const H = cv.height / dpr;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, W, H);

  if (R.mapMode) {
    drawMapMode(W, H);
    ctx.restore();
    el('stCoords').textContent =
      R.mapMode.lat.toFixed(5) + '° ; ' + R.mapMode.lng.toFixed(5) + '°' + (R.mapMode.regionId ? '' : ' · вне оффлайн-зоны');
    el('stZoom').textContent = 'z' + R.mapMode.zoom;
    return;
  }

  /* Фон: фото крыши */
  const bgImg = getBgImage();
  if (bgImg && state.bg.visible) {
    ctx.globalAlpha = state.bg.opacity;
    const factor = state.bg.calibS > 0 ? R.view.s / state.bg.calibS : 1;
    ctx.drawImage(bgImg, R.view.ox, R.view.oy, bgImg.naturalWidth * factor, bgImg.naturalHeight * factor);
    ctx.globalAlpha = 1;
  }

  /* Оверлей найденных краёв крыши */
  if (state.snapEdges) {
    const edges = getCurrentEdges();
    if (edges) {
      const worldRect = {
        minX: -R.view.ox / R.view.s,
        minY: -R.view.oy / R.view.s,
        maxX: (W - R.view.ox) / R.view.s,
        maxY: (H - R.view.oy) / R.view.s,
      };
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1;
      edges.lines.forEach((l) => {
        const seg = clipLineToRect(l, worldRect);
        if (!seg) return;
        const [p1, p2] = [m2s(seg[0].x, seg[0].y), m2s(seg[1].x, seg[1].y)];
        ctx.strokeStyle = 'rgba(34,211,238,.35)';
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      edges.corners.forEach((c) => {
        const [px, py] = m2s(c.x, c.y);
        ctx.fillStyle = 'rgba(251,191,36,.8)';
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, 7);
        ctx.fill();
      });
    }
  }

  const step = R.view.s >= 14 ? 1 : 5;
  const wx0 = -R.view.ox / R.view.s;
  const wx1 = (W - R.view.ox) / R.view.s;
  const wy0 = -R.view.oy / R.view.s;
  const wy1 = (H - R.view.oy) / R.view.s;
  if (state.showGrid) {
    ctx.lineWidth = 1;
    for (let gx = Math.floor(wx0 / step) * step; gx <= wx1; gx += step) {
      const [px] = m2s(gx, 0);
      ctx.strokeStyle = gx % 5 === 0 ? 'rgba(56,189,248,.10)' : 'rgba(56,189,248,.045)';
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }
    for (let gy = Math.floor(wy0 / step) * step; gy <= wy1; gy += step) {
      const [, py] = m2s(0, gy);
      ctx.strokeStyle = gy % 5 === 0 ? 'rgba(56,189,248,.10)' : 'rgba(56,189,248,.045)';
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
      ctx.stroke();
    }
  }

  if (state.roof.length) {
    ctx.beginPath();
    state.roof.forEach((p, i) => {
      const [px, py] = m2s(p.x, p.y);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(56,189,248,.07)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();
    const bb = roofBBox();
    if (state.showDims) {
      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px Manrope';
      ctx.textAlign = 'center';
      const [a, b] = m2s(bb.minX, bb.maxY);
      const [c] = m2s(bb.maxX, bb.maxY);
      ctx.fillText(nf(bb.maxX - bb.minX, 1) + ' м', (a + c) / 2, b + 18);
      const [e, f] = m2s(bb.maxX, bb.minY);
      const [, g2] = m2s(bb.maxX, bb.maxY);
      ctx.fillText(nf(bb.maxY - bb.minY, 1) + ' м', e + 28, (f + g2) / 2);
    }
    state.roof.forEach((p) => {
      const [px, py] = m2s(p.x, p.y);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 7);
      ctx.fillStyle = '#0ea5e9';
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }

  if (state.tempRoof.length) {
    ctx.beginPath();
    state.tempRoof.forEach((p, i) => {
      const [px, py] = m2s(p.x, p.y);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    });
    let pv: { x: number; y: number } | null = null;
    if (state.tool === 'roof' && R.cursorM && !R.drag && !R.pinch) {
      pv = orthSnap(R.cursorM);
      const [px, py] = m2s(pv.x, pv.y);
      ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#f59e0b';
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    state.tempRoof.forEach((p) => {
      const [px, py] = m2s(p.x, p.y);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, 7);
      ctx.fillStyle = '#f59e0b';
      ctx.fill();
    });
    if (pv && state.tempRoof.length) {
      const last = state.tempRoof[state.tempRoof.length - 1];
      const len = Math.hypot(pv.x - last.x, pv.y - last.y);
      const [px, py] = m2s((pv.x + last.x) / 2, (pv.y + last.y) / 2);
      ctx.fillStyle = '#fbbf24';
      ctx.font = '700 11px Manrope';
      ctx.textAlign = 'center';
      ctx.fillText(nf(len, 2) + ' м', px, py - 8);
      ctx.beginPath();
      ctx.rect(px - 3, py + 4, 6, 6);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  if (state.showObstacles) {
    state.obstacles.forEach((o, i) => {
      const [px, py] = m2s(o.x, o.y);
      const pw = o.w * R.view.s;
      const ph = o.h * R.view.s;
      const isSel = R.sel && R.sel.type === 'obstacle' && R.sel.i === i;
      ctx.save();
      ctx.beginPath();
      ctx.rect(px, py, pw, ph);
      ctx.clip();
      ctx.fillStyle = 'rgba(245,158,11,.18)';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(245,158,11,.5)';
      ctx.lineWidth = 1;
      for (let l = -ph; l < pw; l += 8) {
        ctx.beginPath();
        ctx.moveTo(px + l, py);
        ctx.lineTo(px + l + ph, py + ph);
        ctx.stroke();
      }
      ctx.restore();
      ctx.strokeStyle = isSel ? '#fbbf24' : '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, pw, ph);
      if (isSel) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '700 11px Manrope';
        ctx.textAlign = 'center';
        ctx.fillText('высота ' + (o.z || 0) + ' м', px + pw / 2, py - 8);
      }
    });
  }

  if (R.ghostOb && R.ghostOb.w > 0.05 && R.ghostOb.h > 0.05) {
    const [px, py] = m2s(R.ghostOb.x, R.ghostOb.y);
    ctx.fillStyle = 'rgba(251,191,36,.10)';
    ctx.fillRect(px, py, R.ghostOb.w * R.view.s, R.ghostOb.h * R.view.s);
    ctx.strokeStyle = '#fbbf24';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, R.ghostOb.w * R.view.s, R.ghostOb.h * R.view.s);
    ctx.setLineDash([]);
  }

  const angleRad = (state.arrayAngle * Math.PI) / 180;
  const assignments = state.showStrings ? stringAssignments() : null;
  state.panels.forEach((p, i) => {
    const w0 = localToWorld({ x: p.x, y: p.y }, state.arrayAngle);
    const [px, py] = m2s(w0.x, w0.y);
    const pw = p.w * R.view.s - 1;
    const ph = p.h * R.view.s - 1;
    if (pw <= 0 || ph <= 0) return;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleRad);
    if (state.showShadeMap) {
      ctx.fillStyle = shadeColor(panelShade[i] ?? 0);
      ctx.globalAlpha = 0.85;
      ctx.fillRect(0, 0, pw, ph);
      ctx.globalAlpha = 1;
    } else {
      const gr = ctx.createLinearGradient(0, 0, 0, ph);
      gr.addColorStop(0, '#1e3a8a');
      gr.addColorStop(1, '#0c1f4a');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, pw, ph);
    }
    if (R.view.s > 10) {
      ctx.strokeStyle = 'rgba(148,163,184,.25)';
      ctx.lineWidth = 1;
      for (let cIdx = 1; cIdx < 6; cIdx++) {
        ctx.beginPath();
        ctx.moveTo((pw * cIdx) / 6, 0);
        ctx.lineTo((pw * cIdx) / 6, ph);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(0, ph / 2);
      ctx.lineTo(pw, ph / 2);
      ctx.stroke();
    }
    const isSel = R.sel && R.sel.type === 'panel' && R.sel.i === i;
    const inMulti = R.multi.includes(i);
    let stroke = isSel || inMulti ? '#fbbf24' : '#64748b';
    if (isSel && !validRect(p, i)) stroke = '#f87171';
    if (assignments && !isSel && !inMulti) {
      const str = assignments.get(i);
      if (str !== undefined) stroke = STRING_PALETTE[str % STRING_PALETTE.length];
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = isSel ? 2.5 : inMulti ? 2 : 1.4;
    if (isSel || inMulti) {
      ctx.shadowColor = stroke;
      ctx.shadowBlur = 10;
    }
    ctx.strokeRect(0, 0, pw, ph);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  /* Легенда стрингов */
  if (assignments) {
    let maxStr = 0;
    assignments.forEach((s) => {
      if (s > maxStr) maxStr = s;
    });
    ctx.font = '700 11px Manrope';
    ctx.textAlign = 'left';
    for (let s = 0; s <= maxStr; s++) {
      const y = 16 + s * 22;
      ctx.fillStyle = STRING_PALETTE[s % STRING_PALETTE.length];
      ctx.fillRect(16, y, 12, 12);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Стринг ' + (s + 1), 34, y + 10);
    }
  }

  /* Легенда тепловой карты */
  if (state.showShadeMap && panelShade.length) {
    const lx = 16;
    const ly = H - 76;
    const lw = 140;
    const grad = ctx.createLinearGradient(lx, 0, lx + lw, 0);
    grad.addColorStop(0, shadeColor(0));
    grad.addColorStop(0.5, shadeColor(0.5));
    grad.addColorStop(1, shadeColor(1));
    ctx.fillStyle = grad;
    ctx.fillRect(lx, ly, lw, 10);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(lx, ly, lw, 10);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px Manrope';
    ctx.textAlign = 'left';
    ctx.fillText('потери тени: 0%', lx, ly + 22);
    ctx.textAlign = 'center';
    ctx.fillText('50%', lx + lw / 2, ly + 22);
    ctx.textAlign = 'right';
    ctx.fillText('100%', lx + lw, ly + 22);
    ctx.textAlign = 'left';
  }

  /* Ghost-превью одиночной панели */
  if (R.ghostPanel) {
    const g = R.ghostPanel;
    const w0 = localToWorld({ x: g.x, y: g.y }, state.arrayAngle);
    const [px, py] = m2s(w0.x, w0.y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angleRad);
    const pw = g.w * R.view.s - 1;
    const ph = g.h * R.view.s - 1;
    ctx.fillStyle = g.valid ? 'rgba(34,197,94,.16)' : 'rgba(248,113,113,.16)';
    ctx.fillRect(0, 0, pw, ph);
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = g.valid ? '#22c55e' : '#f87171';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, 0, pw, ph);
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* Ghost-превью ряда */
  if (R.ghostRow) {
    R.ghostRow.rects.forEach((g) => {
      const w0 = localToWorld({ x: g.x, y: g.y }, state.arrayAngle);
      const [px, py] = m2s(w0.x, w0.y);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angleRad);
      const pw = g.w * R.view.s - 1;
      const ph = g.h * R.view.s - 1;
      ctx.fillStyle = g.valid ? 'rgba(34,197,94,.14)' : 'rgba(248,113,113,.14)';
      ctx.fillRect(0, 0, pw, ph);
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = g.valid ? '#22c55e' : '#f87171';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0, 0, pw, ph);
      ctx.setLineDash([]);
      ctx.restore();
    });
  }

  /* Рамка группового выделения (в экранных координатах) */
  if (R.marquee) {
    const rect = cv.getBoundingClientRect();
    const x1 = Math.min(R.marquee.x1, R.marquee.x2) - rect.left;
    const y1 = Math.min(R.marquee.y1, R.marquee.y2) - rect.top;
    const w = Math.abs(R.marquee.x2 - R.marquee.x1);
    const h = Math.abs(R.marquee.y2 - R.marquee.y1);
    ctx.fillStyle = 'rgba(56,189,248,.08)';
    ctx.fillRect(x1, y1, w, h);
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x1, y1, w, h);
    ctx.setLineDash([]);
  }

  let sunInfo: { altDeg: number; azDeg: number; az: number } | null = null;
  if (state.showShadows) {
    const sr = currentShadowScene();
    sunInfo = sr.sp;
    ctx.fillStyle = 'rgba(2,6,23,.52)';
    sr.polys.forEach((poly) => {
      ctx.beginPath();
      poly.forEach((p, i) => {
        const [px, py] = m2s(p.x, p.y);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
    });
  }

  if (state.showDims) {
    const bl = 5 * R.view.s;
    const bx = 16;
    const by = H - 44;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + bl, by);
    ctx.moveTo(bx, by - 4);
    ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + bl, by - 4);
    ctx.lineTo(bx + bl, by + 4);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 10px Manrope';
    ctx.textAlign = 'left';
    ctx.fillText('5 м', bx + bl + 6, by + 3);
  }

  ctx.beginPath();
  ctx.arc(W - 30, H - 46, 12, 0, 7);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.moveTo(W - 30, H - 54);
  ctx.lineTo(W - 26, H - 42);
  ctx.lineTo(W - 30, H - 45);
  ctx.lineTo(W - 34, H - 42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText('С', W - 30, H - 30);

  if (state.showShadows && sunInfo) {
    const scx = W - 80;
    const scy = H - 46;
    const r = 13;
    ctx.beginPath();
    ctx.arc(scx, scy, r, 0, 7);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (sunInfo.altDeg > 0) {
      const sx = scx + Math.sin(sunInfo.az) * r * 0.75;
      const sy = scy - Math.cos(sunInfo.az) * r * 0.75;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, 7);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      el('stSun').textContent =
        '☀ ' + MONTHS[state.shadeMonth] + ' ' + fmtHour(state.shadeHour) + ' · выс. ' + nf(sunInfo.altDeg, 0) + '° · аз. ' + nf(sunInfo.azDeg, 0) + '°';
    } else {
      el('stSun').textContent = '☀ солнце за горизонтом';
    }
  } else {
    el('stSun').textContent = '';
  }

  ctx.restore();
  el('stZoom').textContent = Math.round((R.view.s / 22) * 100) + '%';
  el('emptyState').style.display = state.roof.length || state.panels.length ? 'none' : 'flex';
}

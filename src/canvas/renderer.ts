import { MONTHS } from '../core/data';
import { events, R } from '../core/runtime';
import { state } from '../core/state';
import { el, fmtHour, nf } from '../core/utils';
import { orthSnap, roofBBox, validRect } from '../domain/geometry';
import { currentShadowScene } from '../domain/solar';
import { getBgImage } from '../ui/bg';
import { ctx, cv, dpr } from './canvas';
import { m2s } from './view';

export function draw(): void {
  if (!cv.width) return;
  const W = cv.width / dpr;
  const H = cv.height / dpr;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, W, H);

  /* Фон: фото крыши */
  const bgImg = getBgImage();
  if (bgImg && state.bg.visible) {
    ctx.globalAlpha = state.bg.opacity;
    const factor = state.bg.calibS > 0 ? R.view.s / state.bg.calibS : 1;
    ctx.drawImage(bgImg, R.view.ox, R.view.oy, bgImg.naturalWidth * factor, bgImg.naturalHeight * factor);
    ctx.globalAlpha = 1;
  }

  const step = R.view.s >= 14 ? 1 : 5;
  const wx0 = -R.view.ox / R.view.s;
  const wx1 = (W - R.view.ox) / R.view.s;
  const wy0 = -R.view.oy / R.view.s;
  const wy1 = (H - R.view.oy) / R.view.s;
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
    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px Manrope';
    ctx.textAlign = 'center';
    const [a, b] = m2s(bb.minX, bb.maxY);
    const [c] = m2s(bb.maxX, bb.maxY);
    ctx.fillText(nf(bb.maxX - bb.minX, 1) + ' м', (a + c) / 2, b + 18);
    const [e, f] = m2s(bb.maxX, bb.minY);
    const [, g2] = m2s(bb.maxX, bb.maxY);
    ctx.fillText(nf(bb.maxY - bb.minY, 1) + ' м', e + 28, (f + g2) / 2);
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

  state.panels.forEach((p, i) => {
    const [px, py] = m2s(p.x, p.y);
    const pw = p.w * R.view.s - 1;
    const ph = p.h * R.view.s - 1;
    if (pw <= 0 || ph <= 0) return;
    const gr = ctx.createLinearGradient(px, py, px, py + ph);
    gr.addColorStop(0, '#1e3a8a');
    gr.addColorStop(1, '#0c1f4a');
    ctx.fillStyle = gr;
    ctx.fillRect(px, py, pw, ph);
    if (R.view.s > 10) {
      ctx.strokeStyle = 'rgba(148,163,184,.25)';
      ctx.lineWidth = 1;
      for (let cIdx = 1; cIdx < 6; cIdx++) {
        ctx.beginPath();
        ctx.moveTo(px + (pw * cIdx) / 6, py);
        ctx.lineTo(px + (pw * cIdx) / 6, py + ph);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(px, py + ph / 2);
      ctx.lineTo(px + pw, py + ph / 2);
      ctx.stroke();
    }
    const isSel = R.sel && R.sel.type === 'panel' && R.sel.i === i;
    const inMulti = R.multi.includes(i);
    let stroke = isSel || inMulti ? '#fbbf24' : '#64748b';
    if (isSel && !validRect(p, i)) stroke = '#f87171';
    ctx.strokeStyle = stroke;
    ctx.lineWidth = isSel ? 2.5 : inMulti ? 2 : 1.2;
    if (isSel || inMulti) {
      ctx.shadowColor = stroke;
      ctx.shadowBlur = 10;
    }
    ctx.strokeRect(px, py, pw, ph);
    ctx.shadowBlur = 0;
  });

  /* Ghost-превью одиночной панели */
  if (R.ghostPanel) {
    const g = R.ghostPanel;
    const [px, py] = m2s(g.x, g.y);
    const pw = g.w * R.view.s - 1;
    const ph = g.h * R.view.s - 1;
    ctx.fillStyle = g.valid ? 'rgba(34,197,94,.16)' : 'rgba(248,113,113,.16)';
    ctx.fillRect(px, py, pw, ph);
    ctx.setLineDash([5, 3]);
    ctx.strokeStyle = g.valid ? '#22c55e' : '#f87171';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
  }

  /* Ghost-превью ряда */
  if (R.ghostRow) {
    R.ghostRow.rects.forEach((g) => {
      const [px, py] = m2s(g.x, g.y);
      const pw = g.w * R.view.s - 1;
      const ph = g.h * R.view.s - 1;
      ctx.fillStyle = g.valid ? 'rgba(34,197,94,.14)' : 'rgba(248,113,113,.14)';
      ctx.fillRect(px, py, pw, ph);
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = g.valid ? '#22c55e' : '#f87171';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, pw, ph);
      ctx.setLineDash([]);
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

import { MAX_PANELS } from '../core/data';
import { commit, events, R, redo, undo } from '../core/runtime';
import { state } from '../core/state';
import type { Point } from '../core/types';
import { clamp, el, nf, num0, toast } from '../core/utils';
import { computeRowRects, orthSnap, panelDims, panelsInRect, pruneInvalid, selfIntersects, validRect } from '../domain/geometry';
import { setTool, updateOrthUI } from '../ui/toolbar';
import { handleCalibClick } from '../ui/bg';
import { cv } from './canvas';
import { draw } from './renderer';
import { s2m } from './view';

/* ═══ ХИТЫ ═══ */
export function hitPanel(m: Point): number {
  for (let i = state.panels.length - 1; i >= 0; i--) {
    const p = state.panels[i];
    if (m.x >= p.x - 1e-9 && m.x <= p.x + p.w + 1e-9 && m.y >= p.y - 1e-9 && m.y <= p.y + p.h + 1e-9) return i;
  }
  return -1;
}

export function hitObstacle(m: Point): number {
  for (let i = state.obstacles.length - 1; i >= 0; i--) {
    const o = state.obstacles[i];
    if (m.x >= o.x - 1e-9 && m.x <= o.x + o.w + 1e-9 && m.y >= o.y - 1e-9 && m.y <= o.y + o.h + 1e-9) return i;
  }
  return -1;
}

export function hitVertex(m: Point): number {
  const r = 10 / R.view.s;
  for (let i = 0; i < state.roof.length; i++) {
    if (Math.hypot(m.x - state.roof[i].x, m.y - state.roof[i].y) < r) return i;
  }
  return -1;
}

export function tryPaint(m: Point): void {
  if (state.panels.length >= MAX_PANELS) {
    toast('Достигнут лимит ' + MAX_PANELS + ' панелей');
    R.drag = null;
    return;
  }
  const d = panelDims();
  const r = { x: Math.round(m.x / 0.25) * 0.25, y: Math.round(m.y / 0.25) * 0.25, w: d.w, h: d.h };
  if (validRect(r)) {
    state.panels.push(r);
    draw();
  }
}

function paintLine(from: Point | null, to: Point): void {
  if (!from) {
    tryPaint(to);
    return;
  }
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(dist / 0.15));
  for (let i = 1; i <= steps; i++) {
    tryPaint({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps });
    if (!R.drag) return;
  }
}

function eraseAt(m: Point): void {
  const pi = hitPanel(m);
  if (pi >= 0) {
    state.panels.splice(pi, 1);
    R.sel = null;
    events.refresh();
    draw();
    return;
  }
  const oi = hitObstacle(m);
  if (oi >= 0) {
    state.obstacles.splice(oi, 1);
    R.sel = null;
    events.refresh();
    draw();
  }
}

export function closeRoof(): void {
  if (state.tempRoof.length < 3) return;
  const cand = state.tempRoof.slice();
  if (selfIntersects(cand)) {
    toast('Контур самопересекается — поправьте точки');
    return;
  }
  state.roof = cand;
  state.tempRoof = [];
  setTool('select');
  commit();
  events.refresh();
  draw();
  toast('Контур крыши создан — жмите «Автораскладка» ⚡');
}

export function rotateSel(): void {
  if (!(R.sel && R.sel.type === 'panel')) {
    toast('Сначала выберите панель');
    return;
  }
  const p = state.panels[R.sel.i];
  if (!p) return;
  const t = p.w;
  p.w = p.h;
  p.h = t;
  commit();
  draw();
}

/* ═══ POINTER / TOUCH ═══ */
function handleDown(e: PointerEvent): void {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if (R.calib) {
    handleCalibClick(e.clientX, e.clientY);
    return;
  }
  const m = s2m(e);
  if (R.spaceDown) {
    /* Space+драг — панорама в любом инструменте */
    R.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: R.view.ox, oy: R.view.oy };
    return;
  }
  if (state.tool === 'roof') {
    const now = performance.now();
    if (R.lastTap && now - R.lastTap.t < 350 && Math.hypot(e.clientX - R.lastTap.x, e.clientY - R.lastTap.y) < 25) {
      R.lastTap = null;
      const t = state.tempRoof;
      while (t.length > 3) {
        const a = t[t.length - 1];
        const b = t[t.length - 2];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) t.pop();
        else break;
      }
      if (t.length >= 3) {
        closeRoof();
        return;
      }
    }
    R.lastTap = { t: now, x: e.clientX, y: e.clientY };
    const pt = e.altKey ? { x: m.x, y: m.y } : orthSnap(m);
    const t = state.tempRoof;
    if (t.length >= 3 && Math.hypot(pt.x - t[0].x, pt.y - t[0].y) < 12 / R.view.s) {
      closeRoof();
      return;
    }
    if (t.some((p) => Math.hypot(pt.x - p.x, pt.y - p.y) < 1e-9)) return;
    t.push(pt);
    draw();
    return;
  }
  R.lastTap = null;
  if (state.tool === 'panel') {
    R.ghostPanel = null;
    R.drag = { type: 'paint', last: m };
    tryPaint(m);
    return;
  }
  if (state.tool === 'row') {
    R.ghostPanel = null;
    const d = panelDims();
    const anchor = {
      x: Math.round(m.x / 0.25) * 0.25,
      y: Math.round(m.y / 0.25) * 0.25,
      w: d.w,
      h: d.h,
    };
    R.drag = { type: 'row', anchor };
    R.ghostRow = { rects: [{ ...anchor, valid: validRect(anchor) }] };
    draw();
    return;
  }
  if (state.tool === 'obstacle') {
    R.drag = { type: 'newOb', sx: m.x, sy: m.y };
    return;
  }
  if (state.tool === 'erase') {
    eraseAt(m);
    R.drag = { type: 'erase' };
    return;
  }
  const vi = hitVertex(m);
  if (vi >= 0) {
    R.multi = [];
    R.sel = { type: 'vertex', i: vi };
    R.drag = { type: 'vertex', i: vi, roofSnap: JSON.stringify(state.roof) };
    draw();
    events.refresh();
    return;
  }
  const pi = hitPanel(m);
  if (pi >= 0) {
    if (R.multi.includes(pi)) {
      /* тащим всю группу */
      R.sel = null;
      R.drag = {
        type: 'multi',
        start: m,
        snaps: R.multi.map((i) => ({ x: state.panels[i].x, y: state.panels[i].y })),
      };
      draw();
      events.refresh();
      return;
    }
    R.multi = [];
    R.sel = { type: 'panel', i: pi };
    R.drag = {
      type: 'panel',
      i: pi,
      dx: m.x - state.panels[pi].x,
      dy: m.y - state.panels[pi].y,
      sx: state.panels[pi].x,
      sy: state.panels[pi].y,
    };
    draw();
    events.refresh();
    return;
  }
  const oi = hitObstacle(m);
  if (oi >= 0) {
    R.multi = [];
    R.sel = { type: 'obstacle', i: oi };
    R.drag = { type: 'obstacle', i: oi, dx: m.x - state.obstacles[oi].x, dy: m.y - state.obstacles[oi].y };
    draw();
    events.refresh();
    return;
  }
  /* Пустое место — рамка группового выделения */
  R.sel = null;
  R.multi = [];
  R.drag = { type: 'marquee', sx: e.clientX, sy: e.clientY };
  R.marquee = { x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY };
  draw();
  events.refresh();
}

function handleMove(e: PointerEvent): void {
  R.cursorM = s2m(e);
  el('stCoords').textContent = nf(R.cursorM.x, 1) + ' ; ' + nf(R.cursorM.y, 1) + ' м';
  if (state.tool === 'roof' && state.tempRoof.length && !R.drag) draw();

  /* Ghost-превью одиночной панели при наведении (без драга) */
  if (state.tool === 'panel' && !R.drag) {
    const d = panelDims();
    const r = { x: Math.round(R.cursorM.x / 0.25) * 0.25, y: Math.round(R.cursorM.y / 0.25) * 0.25, w: d.w, h: d.h };
    R.ghostPanel = { ...r, valid: validRect(r) };
    draw();
  } else if (R.ghostPanel) {
    R.ghostPanel = null;
    if (!R.drag) draw();
  }

  if (!R.drag) return;
  const m = s2m(e);
  const d = R.drag;
  switch (d.type) {
    case 'pan':
      R.view.ox = d.ox + (e.clientX - d.sx);
      R.view.oy = d.oy + (e.clientY - d.sy);
      draw();
      break;
    case 'paint':
      paintLine(d.last, m);
      d.last = m;
      break;
    case 'erase':
      eraseAt(m);
      break;
    case 'newOb':
      R.ghostOb = { x: Math.min(d.sx, m.x), y: Math.min(d.sy, m.y), w: Math.abs(m.x - d.sx), h: Math.abs(m.y - d.sy) };
      draw();
      break;
    case 'row': {
      const gap = clamp(num0(state.gap), 0, 2);
      const rects = computeRowRects(d.anchor, m, gap);
      R.ghostRow = { rects: rects.map((r) => ({ ...r, valid: validRect(r) })) };
      draw();
      break;
    }
    case 'multi': {
      const dx = m.x - d.start.x;
      const dy = m.y - d.start.y;
      R.multi.forEach((pi, k) => {
        const p = state.panels[pi];
        if (p && d.snaps[k]) {
          p.x = Math.round((d.snaps[k].x + dx) / 0.1) * 0.1;
          p.y = Math.round((d.snaps[k].y + dy) / 0.1) * 0.1;
        }
      });
      draw();
      break;
    }
    case 'marquee':
      R.marquee = { x1: d.sx, y1: d.sy, x2: e.clientX, y2: e.clientY };
      draw();
      break;
    case 'panel': {
      const p = state.panels[d.i];
      if (p) {
        p.x = Math.round((m.x - d.dx) / 0.1) * 0.1;
        p.y = Math.round((m.y - d.dy) / 0.1) * 0.1;
        draw();
      }
      break;
    }
    case 'obstacle': {
      const o = state.obstacles[d.i];
      if (o) {
        o.x = Math.round((m.x - d.dx) / 0.1) * 0.1;
        o.y = Math.round((m.y - d.dy) / 0.1) * 0.1;
        draw();
      }
      break;
    }
    case 'vertex': {
      const v = state.roof[d.i];
      if (v) {
        v.x = m.x;
        v.y = m.y;
        draw();
      }
      break;
    }
  }
}

function handleUp(e: PointerEvent): void {
  if (!R.drag) return;
  const d = R.drag;
  if (d.type === 'newOb' && R.ghostOb && R.ghostOb.w > 0.2 && R.ghostOb.h > 0.2) {
    state.obstacles.push({
      x: Math.round(R.ghostOb.x * 2) / 2,
      y: Math.round(R.ghostOb.y * 2) / 2,
      w: Math.round(R.ghostOb.w * 2) / 2,
      h: Math.round(R.ghostOb.h * 2) / 2,
      z: 1,
    });
    toast('Препятствие добавлено — задайте высоту в панели справа');
  }
  R.ghostOb = null;
  if (d.type === 'row') {
    if (R.ghostRow) {
      let placed = 0;
      for (const g of R.ghostRow.rects) {
        if (state.panels.length >= MAX_PANELS) {
          toast('Достигнут лимит ' + MAX_PANELS + ' панелей');
          break;
        }
        const r = { x: g.x, y: g.y, w: g.w, h: g.h };
        if (!validRect(r)) break; /* ряд встаёт до препятствия */
        state.panels.push(r);
        placed++;
      }
      R.ghostRow = null;
      if (placed) toast('Панелей в ряду: ' + placed);
      else toast('Позиция недоступна');
    }
  }
  if (d.type === 'multi') {
    let bad = false;
    for (const pi of R.multi) {
      const p = state.panels[pi];
      if (!p || !validRect(p, pi)) {
        bad = true;
        break;
      }
    }
    if (bad) {
      R.multi.forEach((pi, k) => {
        const p = state.panels[pi];
        if (p && d.snaps[k]) {
          p.x = d.snaps[k].x;
          p.y = d.snaps[k].y;
        }
      });
      toast('Позиция недоступна — группа возвращена');
    }
  }
  if (d.type === 'marquee') {
    const rect = cv.getBoundingClientRect();
    const x1 = (Math.min(d.sx, e.clientX) - rect.left - R.view.ox) / R.view.s;
    const y1 = (Math.min(d.sy, e.clientY) - rect.top - R.view.oy) / R.view.s;
    const x2 = (Math.max(d.sx, e.clientX) - rect.left - R.view.ox) / R.view.s;
    const y2 = (Math.max(d.sy, e.clientY) - rect.top - R.view.oy) / R.view.s;
    R.marquee = null;
    if (x2 - x1 < 0.3 && y2 - y1 < 0.3) {
      R.multi = []; /* простой клик — сброс выделения */
    } else {
      R.multi = panelsInRect(state.panels, { x: x1, y: y1, w: x2 - x1, h: y2 - y1 });
      if (R.multi.length) toast('Выделено панелей: ' + R.multi.length);
    }
  }
  if (d.type === 'panel') {
    const p = state.panels[d.i];
    if (p && !validRect(p, d.i)) {
      p.x = d.sx;
      p.y = d.sy;
      toast('Позиция недоступна — панель возвращена');
    }
  }
  if (d.type === 'vertex') {
    if (selfIntersects(state.roof)) {
      try {
        state.roof = JSON.parse(d.roofSnap) as Point[];
      } catch {
        /* ignore */
      }
      toast('Контур самопересекается — изменение отменено');
    } else {
      const removed = pruneInvalid();
      if (removed) toast('Удалено панелей вне крыши: ' + removed);
    }
  }
  if (d.type === 'obstacle') {
    const removed = pruneInvalid();
    if (removed) toast('Удалено перекрытых панелей: ' + removed);
  }
  R.drag = null;
  commit();
  events.refresh();
  draw();
}

export function setupCanvasInteractions(): void {
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    /* Средняя кнопка — панорама */
    if (e.pointerType === 'mouse' && e.button === 1) {
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      R.sel = null;
      R.multi = [];
      R.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: R.view.ox, oy: R.view.oy };
      draw();
      return;
    }
    try {
      cv.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    R.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (R.pointers.size === 2) {
      R.drag = null;
      R.ghostOb = null;
      R.sel = null;
      R.ghostRow = null;
      R.marquee = null;
      const pts = [...R.pointers.values()];
      R.pinch = {
        d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        s0: R.view.s,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        ox: R.view.ox,
        oy: R.view.oy,
      };
      draw();
      return;
    }
    if (R.pointers.size > 2) return;
    handleDown(e);
  });

  cv.addEventListener('pointermove', (e) => {
    if (R.pointers.has(e.pointerId)) R.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (R.pinch && R.pointers.size >= 2) {
      const pts = [...R.pointers.values()];
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const ns = clamp(R.pinch.s0 * (d / R.pinch.d0), 4, 140);
      const r = cv.getBoundingClientRect();
      const wx = (R.pinch.mid.x - r.left - R.pinch.ox) / R.pinch.s0;
      const wy = (R.pinch.mid.y - r.top - R.pinch.oy) / R.pinch.s0;
      R.view.s = ns;
      R.view.ox = mid.x - r.left - wx * ns;
      R.view.oy = mid.y - r.top - wy * ns;
      draw();
      return;
    }
    handleMove(e);
  });

  const pointerEnd = (e: PointerEvent): void => {
    R.pointers.delete(e.pointerId);
    if (R.pinch) {
      if (R.pointers.size < 2) R.pinch = null;
      return;
    }
    handleUp(e);
  };
  cv.addEventListener('pointerup', pointerEnd);
  cv.addEventListener('pointercancel', pointerEnd);

  cv.addEventListener('dblclick', () => {
    if (state.tool === 'roof') {
      const t = state.tempRoof;
      while (t.length > 3) {
        const a = t[t.length - 1];
        const b = t[t.length - 2];
        if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-6) t.pop();
        else break;
      }
      if (t.length >= 3) closeRoof();
    }
  });

  cv.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const ns = clamp(R.view.s * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 4, 140);
      R.view.ox = px - ((px - R.view.ox) * ns) / R.view.s;
      R.view.oy = py - ((py - R.view.oy) * ns) / R.view.s;
      R.view.s = ns;
      draw();
    },
    { passive: false },
  );

  cv.addEventListener('mouseleave', () => {
    R.cursorM = null;
    R.ghostPanel = null;
    if (!R.drag) draw();
  });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'y') {
      e.preventDefault();
      redo();
      return;
    }
    if (e.ctrlKey || e.metaKey) return;
    if (k === 'v') setTool('select');
    if (k === 'r' && !(R.sel && R.sel.type === 'panel')) setTool('roof');
    if (k === 'p') setTool('panel');
    if (k === 'f') setTool('row');
    if (k === 'o') setTool('obstacle');
    if (k === 'e') setTool('erase');
    if (k === 'r' && R.sel && R.sel.type === 'panel') rotateSel();
    if (k === ' ') {
      e.preventDefault();
      R.spaceDown = true;
    }
    if (k === 's') {
      state.showShadows = !state.showShadows;
      el<HTMLInputElement>('chkShade').checked = state.showShadows;
      draw();
    }
    if (k === 'x') {
      state.orth = !state.orth;
      updateOrthUI();
      toast('Прямые углы: ' + (state.orth ? 'вкл' : 'выкл'));
    }
    if (k === 'escape') {
      state.tempRoof = [];
      R.sel = null;
      R.calib = null;
      R.multi = [];
      R.marquee = null;
      R.ghostRow = null;
      draw();
      events.refresh();
    }
    if (k === 'enter' && state.tempRoof.length >= 3) closeRoof();
    if ((k === 'delete' || k === 'backspace') && R.multi.length) {
      e.preventDefault();
      R.multi
        .slice()
        .sort((a, b) => b - a)
        .forEach((i) => state.panels.splice(i, 1));
      R.multi = [];
      R.sel = null;
      commit();
      events.refresh();
      draw();
    }
    if ((k === 'delete' || k === 'backspace') && R.sel) {
      e.preventDefault();
      if (R.sel.type === 'panel') state.panels.splice(R.sel.i, 1);
      if (R.sel.type === 'obstacle') state.obstacles.splice(R.sel.i, 1);
      if (R.sel.type === 'vertex') {
        if (state.roof.length <= 3) {
          toast('У крыши должно остаться минимум 3 точки');
          return;
        }
        state.roof.splice(R.sel.i, 1);
      }
      R.sel = null;
      commit();
      events.refresh();
      draw();
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') R.spaceDown = false;
  });
}

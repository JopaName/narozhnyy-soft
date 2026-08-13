/* Контекстное меню панелей и препятствий (long-press на телефоне, ПКМ на десктопе) */

import { commit, events, R } from '../core/runtime';
import { state } from '../core/state';
import { el, toast } from '../core/utils';
import { validRect } from '../domain/geometry';
import { draw } from '../canvas/renderer';

export interface CtxTarget {
  type: 'panel' | 'obstacle';
  i: number;
}

/* Клик, завершающий long-press, не должен сразу закрывать меню */
let suppressClickUntil = 0;

export function openContextMenu(x: number, y: number, t: CtxTarget): void {
  suppressClickUntil = Date.now() + 400;
  const menu = el('ctxMenu');
  const isLocked = t.type === 'panel' && state.locked.includes(t.i);
  const items: { label: string; fn: () => void }[] = [];
  if (t.type === 'panel') {
    items.push({ label: '⟳ Повернуть', fn: () => rotatePanelAt(t.i) });
    items.push({ label: '⧉ Дублировать', fn: () => duplicatePanelAt(t.i) });
    items.push({ label: isLocked ? '🔓 Разблокировать' : '🔒 Заблокировать', fn: () => toggleLock(t.i) });
    items.push({ label: '✕ Удалить', fn: () => deletePanelAt(t.i) });
  } else {
    items.push({ label: '✕ Удалить препятствие', fn: () => deleteObstacleAt(t.i) });
  }

  menu.innerHTML = items
    .map((it, idx) => '<div class="ctx-item" data-idx="' + idx + '">' + it.label + '</div>')
    .join('');
  menu.style.left = Math.min(x, window.innerWidth - 200) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - items.length * 38 - 16) + 'px';
  menu.style.display = 'block';

  menu.querySelectorAll('.ctx-item').forEach((node) => {
    node.addEventListener('click', () => {
      const idx = Number((node as HTMLElement).dataset.idx);
      closeContextMenu();
      items[idx].fn();
    });
  });
}

export function closeContextMenu(): void {
  el('ctxMenu').style.display = 'none';
}

function rotatePanelAt(i: number): void {
  const p = state.panels[i];
  if (!p) return;
  if (state.locked.includes(i)) {
    toast('Панель заблокирована');
    return;
  }
  const w = p.w;
  const h = p.h;
  p.w = h;
  p.h = w;
  if (!validRect(p, i)) {
    p.w = w;
    p.h = h;
    toast('Повернуть нельзя — позиция станет невалидной');
    draw();
    return;
  }
  commit();
  events.refresh();
  draw();
}

function duplicatePanelAt(i: number): void {
  const p = state.panels[i];
  if (!p) return;
  /* Пробуем четыре стороны: справа, снизу, слева, сверху */
  const candidates = [
    { x: p.x + p.w + 0.3, y: p.y },
    { x: p.x, y: p.y + p.h + 0.3 },
    { x: p.x - p.w - 0.3, y: p.y },
    { x: p.x, y: p.y - p.h - 0.3 },
  ];
  for (const c of candidates) {
    const copy = { x: c.x, y: c.y, w: p.w, h: p.h };
    if (validRect(copy)) {
      state.panels.push(copy);
      commit();
      events.refresh();
      draw();
      toast('Панель продублирована');
      return;
    }
  }
  toast('Нет места рядом для копии');
}

function toggleLock(i: number): void {
  const idx = state.locked.indexOf(i);
  if (idx >= 0) {
    state.locked.splice(idx, 1);
    toast('Панель разблокирована');
  } else {
    state.locked.push(i);
    toast('Панель заблокирована — её нельзя сдвинуть или удалить');
  }
  draw();
}

function deletePanelAt(i: number): void {
  if (state.locked.includes(i)) {
    toast('Панель заблокирована — снимите блокировку');
    return;
  }
  state.panels.splice(i, 1);
  /* индексы блокировок сдвигаются */
  state.locked = state.locked.filter((l) => l !== i).map((l) => (l > i ? l - 1 : l));
  R.sel = null;
  commit();
  events.refresh();
  draw();
}

function deleteObstacleAt(i: number): void {
  state.obstacles.splice(i, 1);
  R.sel = null;
  commit();
  events.refresh();
  draw();
}

export function setupContextMenu(): void {
  el('ctxMenu').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => {
    if (Date.now() < suppressClickUntil) return;
    closeContextMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeContextMenu();
  });
}

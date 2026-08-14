import { MAX_PANELS } from '../core/data';
import { commit, events, R, redo, undo } from '../core/runtime';
import { state } from '../core/state';
import type { Tool } from '../core/types';
import { clamp, el, num0, toast } from '../core/utils';
import { panelDims, localPolyBBox, validRect } from '../domain/geometry';
import { cv } from '../canvas/canvas';
import { fitView } from '../canvas/view';

const ICONS: Record<string, string> = {
  select:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 3l7 17 2.5-7L21 10.5 4 3z"/></svg>',
  roof:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8l6-4 8 3 2 9-9 4-7-5 0-7z"/></svg>',
  panel:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M9 5v14M15 5v14M3 12h18"/></svg>',
  row:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="5" height="8" rx="1"/><rect x="9" y="8" width="5" height="8" rx="1"/><rect x="16" y="8" width="5" height="8" rx="1"/></svg>',
  obstacle:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M7 7l10 10M17 7L7 17"/></svg>',
  erase:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H8L3 15a2 2 0 010-3l9-9 9 9-8 8"/></svg>',
  hand:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11V5.5a1.5 1.5 0 013 0V11m0-4.5a1.5 1.5 0 013 0V11m0-3.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-2a5 5 0 01-4-2l-2-4a1.6 1.6 0 012.4-2L9 15V5.5z"/></svg>',
  ruler:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17L17 3l4 4L7 21l-4-4z"/><path d="M8 12l1.5 1.5M11 9l1.5 1.5M14 6l1.5 1.5"/></svg>',
  undo:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 110 12h-3"/></svg>',
  redo:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 100 12h3"/></svg>',
  orth:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 18V6h12"/><path d="M6 10h4v-4" opacity=".5"/></svg>',
};

const TOOL_NAMES: Record<Tool, string> = {
  select: 'Выбор',
  roof: 'Крыша',
  panel: 'Панель',
  row: 'Ряд панелей',
  obstacle: 'Препятствие',
  erase: 'Ластик',
  hand: 'Панорама',
  ruler: 'Линейка',
};

const HINTS: Record<Tool, string> = {
  select: 'рамка — выделить группу; тяните панели и вершины; Space — панорама',
  roof: 'клики/касания — точки; ⊥ прямые углы (Alt — свободно); двойной тап — замкнуть',
  panel: 'наведение показывает превью панели; тяните мышью или пальцем, закрашивая крышу',
  row: 'клик — одна панель; тяните — ровный ряд вдоль направления, встанет до препятствия',
  obstacle: 'растяните прямоугольник (труба, люк, дерево)',
  erase: 'коснитесь панели или препятствия, чтобы удалить',
  hand: 'тяните — перемещение по схеме/карте; колесо или два пальца — зум',
  ruler: 'два клика — расстояние в метрах; Esc — сброс',
};

export function buildToolbar(): void {
  const tb = el('toolbar');
  const tools: [Tool, string][] = [
    ['select', 'Выбор (V)'],
    ['roof', 'Контур крыши (R)'],
    ['panel', 'Панель (P)'],
    ['row', 'Ряд панелей (F)'],
    ['obstacle', 'Препятствие (O)'],
    ['erase', 'Ластик (E)'],
    ['hand', 'Панорама (H)'],
    ['ruler', 'Линейка (M)'],
  ];
  tools.forEach(([id, tt]) => {
    const b = document.createElement('button');
    b.className = 'toolbtn';
    b.title = tt;
    b.dataset.tool = id;
    b.innerHTML = ICONS[id];
    b.onclick = () => setTool(id);
    tb.appendChild(b);
  });

  const sep = document.createElement('div');
  sep.className = 'w-8 h-px bg-slate-800 my-1';
  tb.appendChild(sep);

  const ob = document.createElement('button');
  ob.className = 'toolbtn';
  ob.id = 'btnOrth';
  ob.title = 'Прямые углы при рисовании крыши (X)';
  ob.innerHTML = ICONS.orth;
  ob.onclick = () => {
    state.orth = !state.orth;
    updateOrthUI();
    toast('Прямые углы: ' + (state.orth ? 'вкл' : 'выкл'));
  };
  tb.appendChild(ob);

  const mk = (html: string, tt: string, fn: () => void): void => {
    const b = document.createElement('button');
    b.className = 'toolbtn';
    b.title = tt;
    b.innerHTML = html;
    b.onclick = fn;
    tb.appendChild(b);
  };
  mk(ICONS.undo, 'Отменить (Ctrl+Z)', undo);
  mk(ICONS.redo, 'Повторить (Ctrl+Y)', redo);
  mk('<span class="text-[15px]">⚡</span>', 'Автораскладка', () => autoLayout());
  mk('<span class="text-[15px]">⛶</span>', 'Вписать в экран', fitView);
}

export function updateOrthUI(): void {
  el<HTMLInputElement>('chkOrth').checked = state.orth;
  const b = document.getElementById('btnOrth');
  if (b) b.classList.toggle('active', state.orth);
}

export function setTool(t: Tool): void {
  state.tool = t;
  R.multi = [];
  R.ghostPanel = null;
  R.ghostRow = null;
  R.marquee = null;
  R.ruler = null;
  R.snapGuides = null;
  document.querySelectorAll('.toolbtn').forEach((b) => {
    const elBtn = b as HTMLElement;
    elBtn.classList.toggle('active', elBtn.dataset.tool === t);
  });
  updateOrthUI();
  cv.style.cursor = t === 'select' ? 'default' : t === 'hand' ? 'grab' : 'crosshair';
  el('stTool').textContent = TOOL_NAMES[t] || '';
  el('stHint').textContent = HINTS[t] || '';
}

export function autoLayout(): void {
  if (!state.roof.length) {
    toast('Сначала нарисуйте контур крыши');
    setTool('roof');
    return;
  }
  const d = panelDims();
  const gap = clamp(num0(state.gap), 0, 2);
  const mg = clamp(num0(state.margin), 0, 3);
  /* сетка идёт по локальному bbox крыши (массив может быть повёрнут) */
  const bb = localPolyBBox(state.roof, state.arrayAngle);
  state.panels = [];
  let guard = 0;
  for (let y = bb.minY + mg; y + d.h <= bb.maxY - mg + 1e-6 && guard < MAX_PANELS + 10; y += d.h + gap + 1e-9) {
    for (let x = bb.minX + mg; x + d.w <= bb.maxX - mg + 1e-6 && guard < MAX_PANELS + 10; x += d.w + gap + 1e-9) {
      guard++;
      const r = { x, y, w: d.w, h: d.h };
      if (validRect(r)) state.panels.push(r);
    }
  }
  if (state.panels.length > MAX_PANELS) {
    state.panels = state.panels.slice(0, MAX_PANELS);
    toast('Лимит ' + MAX_PANELS + ' панелей');
  }
  R.sel = null;
  commit();
  events.refresh();
  events.draw();
  toast('Панелей расставлено: ' + state.panels.length);
}

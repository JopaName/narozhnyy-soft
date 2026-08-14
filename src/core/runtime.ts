import { state } from './state';
import type { DragState, Obstacle, Point, Rect, Sel, SimResult, ViewState } from './types';
import { toast } from './utils';

export interface PinchState {
  d0: number;
  s0: number;
  mid: Point;
  ox: number;
  oy: number;
}

export const R = {
  view: { s: 22, ox: 80, oy: 60 } as ViewState,
  sel: null as Sel,
  drag: null as DragState,
  cursorM: null as Point | null,
  ghostOb: null as Rect | null,
  pinch: null as PinchState | null,
  pointers: new Map<number, Point>(),
  lastTap: null as { t: number; x: number; y: number } | null,
  activeTab: 'scheme' as string,
  sim: null as SimResult | null,
  calib: null as { stage: 1 | 2; p1: Point | null } | null,
  ghostPanel: null as ({ x: number; y: number; w: number; h: number; valid: boolean } | null),
  ghostRow: null as { rects: { x: number; y: number; w: number; h: number; valid: boolean }[] } | null,
  multi: [] as number[],
  marquee: null as { x1: number; y1: number; x2: number; y2: number } | null,
  spaceDown: false as boolean,
  mapMode: null as { lat: number; lng: number; zoom: number; regionId: string } | null,
  snapGuides: null as { x: number | null; y: number | null } | null,
  ruler: null as { p1: Point | null; p2: Point | null } | null,
};

export const events = {
  refresh: (): void => undefined,
  draw: (): void => undefined,
  scheduleShading: (): void => undefined,
};

export const hist: string[] = [];
export const redoStack: string[] = [];

export function geomJSON(): string {
  return JSON.stringify({ roof: state.roof, panels: state.panels, obstacles: state.obstacles });
}

export function commit(): void {
  const snap = geomJSON();
  if (hist.length && hist[hist.length - 1] === snap) return;
  hist.push(snap);
  if (hist.length > 60) hist.shift();
  redoStack.length = 0;
  events.scheduleShading();
}

export function applySnap(s: string): void {
  try {
    const o = JSON.parse(s) as Record<string, unknown>;
    state.roof = (o.roof as Point[]) || [];
    state.panels = (o.panels as Rect[]) || [];
    state.obstacles = (o.obstacles as Obstacle[]) || [];
  } catch {
    return;
  }
  R.sel = null;
  events.scheduleShading();
  events.refresh();
  events.draw();
}

export function undo(): void {
  if (hist.length < 2) {
    toast('Нечего отменять');
    return;
  }
  redoStack.push(hist.pop()!);
  applySnap(hist[hist.length - 1]);
  toast('Отменено');
}

export function redo(): void {
  if (!redoStack.length) {
    toast('Нечего повторить');
    return;
  }
  const s = redoStack.pop()!;
  hist.push(s);
  applySnap(s);
  toast('Повторено');
}

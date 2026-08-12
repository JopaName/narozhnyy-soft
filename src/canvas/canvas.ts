import { events } from '../core/runtime';
import { el } from '../core/utils';

export const cv = el<HTMLCanvasElement>('cv');
export const ctx = cv.getContext('2d')!;
export let dpr = 1;

export function resizeCanvas(): void {
  dpr = window.devicePixelRatio || 1;
  const r = el('canvasWrap').getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  events.draw();
}

export function initCanvasResizeObserver(): void {
  new ResizeObserver(() => requestAnimationFrame(resizeCanvas)).observe(el('canvasWrap'));
}

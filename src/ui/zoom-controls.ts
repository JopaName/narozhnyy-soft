/* Кнопки зума на канвасе: + / − / ⛶ (вписать или центр карты) */

import { events, R } from '../core/runtime';
import { el } from '../core/utils';
import { clamp } from '../core/utils';
import { cv, dpr } from '../canvas/canvas';
import { fitView } from '../canvas/view';
import { pixelsPerMeter, mercatorToMeters } from '../core/satellite';
import { syncMapCenterFromView } from './map-browser';

function zoomAtCenter(factor: number): void {
  const W = cv.width / dpr || 800;
  const H = cv.height / dpr || 500;
  const cx = W / 2;
  const cy = H / 2;
  const ns = clamp(R.view.s * factor, 2, 200);
  R.view.ox = cx - (cx - R.view.ox) * (ns / R.view.s);
  R.view.oy = cy - (cy - R.view.oy) * (ns / R.view.s);
  R.view.s = ns;
  if (R.mapMode) void syncMapCenterFromView();
  events.draw();
}

function zoomFit(): void {
  if (R.mapMode) {
    /* Карта: центрируем маркер и ставим комфортный зум */
    const { lat, lng } = R.mapMode;
    R.mapMode.zoom = 16;
    const m = mercatorToMeters(lat, lng);
    R.view.s = pixelsPerMeter(lat, 16);
    const W = cv.width / dpr || 800;
    const H = cv.height / dpr || 500;
    R.view.ox = W / 2 - m.x * R.view.s;
    R.view.oy = H / 2 - m.y * R.view.s;
  } else {
    fitView();
  }
  events.draw();
}

export function setupZoomControls(): void {
  el('btnZoomIn').addEventListener('click', () => zoomAtCenter(1.25));
  el('btnZoomOut').addEventListener('click', () => zoomAtCenter(1 / 1.25));
  el('btnZoomFit').addEventListener('click', zoomFit);
}

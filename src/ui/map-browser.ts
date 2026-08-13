/* Режим оффлайн-карты на канвасе: панорама/зум по локальным тайлам,
 * маркер в центре, «Использовать место» → спутниковая подложка для обводки крыши. */

import { events, R } from '../core/runtime';
import { state } from '../core/state';
import { el, toast } from '../core/utils';
import { getActiveId, flushSave } from '../core/projects';
import { setImage } from '../core/db';
import { getTile } from '../core/offline-maps';
import {
  downloadSatelliteImage,
  latLngToTile,
  mercatorToMeters,
  metersToMercator,
  pixelsPerMeter,
  tileZoomForScale,
} from '../core/satellite';
import { cv, dpr } from '../canvas/canvas';
import { setBgImage, syncBgUI } from './bg';

const tileCache = new Map<string, HTMLImageElement>();
const loading = new Set<string>();
const TILE_CACHE_MAX = 300;

export function getCachedTile(key: string): HTMLImageElement | null {
  return tileCache.get(key) ?? null;
}

export function ensureTile(regionId: string, z: number, x: number, y: number): void {
  const key = regionId + '/' + z + '/' + x + '/' + y;
  if (tileCache.has(key) || loading.has(key)) return;
  loading.add(key);
  void getTile(regionId, z, x, y).then((dataUrl) => {
    loading.delete(key);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      tileCache.set(key, img);
      while (tileCache.size > TILE_CACHE_MAX) {
        const first = tileCache.keys().next().value;
        if (first === undefined) break;
        tileCache.delete(first);
      }
      if (R.mapMode) events.draw();
    };
    img.src = dataUrl;
  });
}

/* ═══ Открытие / закрытие ═══ */

let lastMapCenter: { lat: number; lng: number; zoom: number } | null = null;

export async function openMapMode(lat: number, lng: number): Promise<void> {
  const regionId = (await findRegionCovering(lat, lng)) ?? '';
  R.mapMode = { lat, lng, zoom: lastMapCenter?.zoom ?? 15, regionId };
  const m = mercatorToMeters(lat, lng);
  R.view.s = pixelsPerMeter(lat, R.mapMode.zoom);
  const W = cv.width / dpr || 800;
  const H = cv.height / dpr || 500;
  R.view.ox = W / 2 - m.x * R.view.s;
  R.view.oy = H / 2 - m.y * R.view.s;
  el('btnMapUse').style.display = 'flex';
  el('stTool').textContent = 'Карта';
  el('stHint').textContent = 'тяните — панорама, колесо/два пальца — зум; 📌 — использовать место как фон';
  events.draw();
}

export function closeMapMode(): void {
  if (!R.mapMode) return;
  lastMapCenter = { ...R.mapMode };
  R.mapMode = null;
  el('btnMapUse').style.display = 'none';
  events.draw();
}

/** Обновляет lat/lng/zoom маркера из текущего view (после панорамы/зума) */
export function syncMapCenterFromView(): void {
  if (!R.mapMode) return;
  const W = cv.width / dpr || 800;
  const H = cv.height / dpr || 500;
  const wx = (W / 2 - R.view.ox) / R.view.s;
  const wy = (H / 2 - R.view.oy) / R.view.s;
  const { lat, lng } = metersToMercator(wx, wy);
  R.mapMode.lat = lat;
  R.mapMode.lng = lng;
  R.mapMode.zoom = tileZoomForScale(R.view.s, lat);
}

export function mapCoordsText(): string {
  if (!R.mapMode) return '';
  return R.mapMode.lat.toFixed(5) + '° ; ' + R.mapMode.lng.toFixed(5) + '° · z' + R.mapMode.zoom;
}

/* ═══ Использовать место как фон ═══ */

async function findRegionCovering(lat: number, lng: number): Promise<string | null> {
  try {
    const resp = await fetch('./regions.json');
    if (!resp.ok) return null;
    const data = (await resp.json()) as { regions: { id: string; bbox: number[] }[] };
    for (const r of data.regions) {
      const [w, s, e, n] = r.bbox;
      if (lng >= w && lng <= e && lat >= s && lat <= n) return r.id;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function useMapPlaceAsBackground(): Promise<void> {
  if (!R.mapMode) return;
  const { lat, lng, zoom } = R.mapMode;
  const projectId = getActiveId();
  if (!projectId) {
    toast('Сначала создайте проект');
    return;
  }
  const activeRegion = await findRegionCovering(lat, lng);
  const localTile = activeRegion ? await getTile(activeRegion, zoom, Math.floor(latLngToTile(lat, lng, zoom).x), Math.floor(latLngToTile(lat, lng, zoom).y)) : null;

  toast(localTile ? 'Собираю снимок из оффлайн-тайлов…' : 'Скачиваю снимок в высоком разрешении…');
  try {
    /* Для крыши нужен высокий зум: локально если есть, иначе сеть */
    const z = Math.min(19, Math.max(zoom, 18));
    const sat = await downloadSatelliteImage(lat, lng, z);
    await setImage(projectId, sat.dataUrl);
    const img = new Image();
    img.onload = () => {
      setBgImage(img);
      state.bg.visible = true;
      state.bg.opacity = 0.6;
      state.bg.calibS = sat.pxPerM;
      flushSave();
      syncBgUI();
      const W = cv.width / dpr || 800;
      const H = cv.height / dpr || 500;
      const worldX = sat.pixelX / sat.pxPerM;
      const worldY = sat.pixelY / sat.pxPerM;
      R.view.s = sat.pxPerM;
      R.view.ox = W / 2 - worldX * R.view.s;
      R.view.oy = H / 2 - worldY * R.view.s;
      closeMapMode();
      toast('Снимок готов — обводите крышу (R)');
      events.draw();
    };
    img.src = sat.dataUrl;
  } catch {
    toast('Не удалось получить снимок');
  }
}

export function setupMapButtons(): void {
  el('btnMapUse').addEventListener('click', () => void useMapPlaceAsBackground());
}

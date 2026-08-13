/* Режим оффлайн-карты на канвасе: панорама/зум по локальным тайлам,
 * маркер в центре, «Использовать место» → спутниковая подложка для обводки крыши. */

import { events, R } from '../core/runtime';
import { state } from '../core/state';
import { el, toast } from '../core/utils';
import { getActiveId, flushSave } from '../core/projects';
import { setImage } from '../core/db';
import { findRegionCovering, getTile, loadRegions, type RegionDef } from '../core/offline-maps';
import {
  downloadSatelliteImage,
  latLngToTile,
  mercatorToMeters,
  metersToMercator,
  pixelsPerMeter,
  stitchTiles,
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

/* ═══ Зоны регионов (для индикатора «вне оффлайн-зоны») ═══ */

let zonesPromise: Promise<RegionDef[]> | null = null;
function ensureZones(): Promise<RegionDef[]> {
  if (!zonesPromise) zonesPromise = loadRegions();
  return zonesPromise;
}

export function isPointCovered(lat: number, lng: number): boolean {
  const r = (R.mapMode?.regionId ?? '') as string;
  /* пока зоны не загружены — считаем по активному региону */
  return r !== '';
}

/* ═══ Открытие / закрытие ═══ */

let lastMapCenter: { lat: number; lng: number; zoom: number } | null = null;

export async function openMapMode(lat: number, lng: number): Promise<void> {
  const regions = await ensureZones();
  const region = findRegionCovering(lat, lng, regions);
  R.mapMode = { lat, lng, zoom: lastMapCenter?.zoom ?? 15, regionId: region?.id ?? '' };
  const m = mercatorToMeters(lat, lng);
  R.view.s = pixelsPerMeter(lat, R.mapMode.zoom);
  const W = cv.width / dpr || 800;
  const H = cv.height / dpr || 500;
  R.view.ox = W / 2 - m.x * R.view.s;
  R.view.oy = H / 2 - m.y * R.view.s;
  el('btnMapUse').style.display = 'flex';
  el('stTool').textContent = 'Карта';
  el('stHint').textContent = 'тяните — панорама, колесо/два пальца — зум; 📌 — использовать место как фон';
  if (!region) toast('Для этой зоны нет оффлайн-карты — скачайте пакет региона');
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
export async function syncMapCenterFromView(): Promise<void> {
  if (!R.mapMode) return;
  const W = cv.width / dpr || 800;
  const H = cv.height / dpr || 500;
  const wx = (W / 2 - R.view.ox) / R.view.s;
  const wy = (H / 2 - R.view.oy) / R.view.s;
  const { lat, lng } = metersToMercator(wx, wy);
  R.mapMode.lat = lat;
  R.mapMode.lng = lng;
  R.mapMode.zoom = tileZoomForScale(R.view.s, lat);
  /* обновляем зону, если заехали в другой регион */
  const regions = await ensureZones();
  const region = findRegionCovering(lat, lng, regions);
  R.mapMode.regionId = region?.id ?? '';
}

/* ═══ Использовать место как фон ═══ */

/** Максимальный локальный зум, доступный в точке */
async function bestLocalZoom(regionId: string, lat: number, lng: number, maxZ: number, minZ: number): Promise<number | null> {
  const t = latLngToTile(lat, lng, maxZ);
  const tx = Math.floor(t.x);
  const ty = Math.floor(t.y);
  for (let z = maxZ; z >= minZ; z--) {
    const scale = Math.pow(2, maxZ - z);
    const dataUrl = await getTile(regionId, z, Math.floor(tx / scale), Math.floor(ty / scale));
    if (dataUrl) return z;
  }
  return null;
}

function applySatelliteBg(sat: { dataUrl: string; pixelX: number; pixelY: number; pxPerM: number }): void {
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
}

export async function useMapPlaceAsBackground(): Promise<void> {
  if (!R.mapMode) return;
  const { lat, lng, zoom, regionId } = R.mapMode;
  const projectId = getActiveId();
  if (!projectId) {
    toast('Сначала создайте проект');
    return;
  }

  const targetZ = Math.min(19, Math.max(zoom, 18));
  const regions = await ensureZones();
  const region = regionId ? findRegionCovering(lat, lng, regions) ?? regions.find((r) => r.id === regionId) : null;

  /* 1. Оффлайн: склейка из локальных тайлов пакета */
  if (region) {
    const localZ = await bestLocalZoom(region.id, lat, lng, targetZ, region.minZoom);
    if (localZ !== null) {
      const localLoader = (z: number, x: number, y: number) => getTile(region.id, z, x, y);
      const sat = await stitchTiles(localLoader, lat, lng, localZ);
      await setImage(projectId, sat.dataUrl);
      applySatelliteBg(sat);
      if (localZ < 17) toast('Снимок из оффлайн-тайлов (грубее)');
      return;
    }
  }

  /* 2. Сеть: высокое разрешение */
  toast('Скачиваю снимок в высоком разрешении…');
  try {
    const sat = await downloadSatelliteImage(lat, lng, targetZ);
    await setImage(projectId, sat.dataUrl);
    applySatelliteBg(sat);
  } catch {
    /* 3. Сеть недоступна — последний шанс: локальные тайлы любого зума */
    if (region) {
      const localZ = await bestLocalZoom(region.id, lat, lng, targetZ, Math.max(1, region.minZoom - 1));
      if (localZ !== null) {
        const localLoader = (z: number, x: number, y: number) => getTile(region.id, z, x, y);
        const sat = await stitchTiles(localLoader, lat, lng, localZ);
        await setImage(projectId, sat.dataUrl);
        applySatelliteBg(sat);
        toast('Нет сети — снимок собран из оффлайн-тайлов');
        return;
      }
    }
    toast('Не удалось получить снимок — нет сети и локальных тайлов');
  }
}

export function setupMapButtons(): void {
  el('btnMapUse').addEventListener('click', () => void useMapPlaceAsBackground());
}

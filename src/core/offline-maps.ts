/* Оффлайн-пакеты карт: скачивание тайлов региона в локальное хранилище,
 * чтение локальных тайлов, статистика, удаление.
 * web: IndexedDB; native: Filesystem Directory.Data/tiles/<region>/<z>/<x>.jpg */

import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNative } from './native-storage';
import { latLngToTile } from './satellite';

export interface RegionDef {
  id: string;
  name: string;
  /** [запад, юг, восток, север] */
  bbox: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  streetsFile?: string;
}

export interface RegionStatus {
  region: RegionDef;
  tileCount: number;
  sizeEstimateMB: number;
  storedTiles: number;
  progress: { done: number; total: number; pct: number; running: boolean } | null;
}

const TILE_AVG_BYTES = 15000;
const DB_NAME = 'solarstudio-tiles';
const STORE = 'tiles';
const CONCURRENCY = 6;

/* ═══ Реестр регионов (кэшируется) ═══ */

let regionsCache: RegionDef[] | null = null;

export async function loadRegions(): Promise<RegionDef[]> {
  if (regionsCache) return regionsCache;
  try {
    const resp = await fetch('./regions.json');
    if (resp.ok) {
      const data = (await resp.json()) as { regions: RegionDef[] };
      if (Array.isArray(data.regions)) regionsCache = data.regions;
    }
  } catch {
    /* ignore */
  }
  return regionsCache ?? [];
}

export function findRegionCovering(lat: number, lng: number, regions: RegionDef[]): RegionDef | null {
  for (const r of regions) {
    const [w, s, e, n] = r.bbox;
    if (lng >= w && lng <= e && lat >= s && lat <= n) return r;
  }
  return null;
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tileKey(regionId: string, z: number, x: number, y: number): string {
  return regionId + '/' + z + '/' + x + '/' + y;
}

const tilePath = (regionId: string, z: number, x: number, y: number): string =>
  'tiles/' + regionId + '/' + z + '/' + x + '.jpg';

export function tileRangeForZoom(region: RegionDef, z: number): { x0: number; y0: number; x1: number; y1: number } {
  const [w, s, e, n] = region.bbox;
  const tl = latLngToTile(n, w, z);
  const br = latLngToTile(s, e, z);
  return { x0: Math.floor(tl.x), y0: Math.floor(tl.y), x1: Math.floor(br.x), y1: Math.floor(br.y) };
}

export function regionTileCount(region: RegionDef): number {
  let total = 0;
  for (let z = region.minZoom; z <= region.maxZoom; z++) {
    const r = tileRangeForZoom(region, z);
    total += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  }
  return total;
}

export function regionSizeEstimateMB(region: RegionDef): number {
  return Math.round((regionTileCount(region) * TILE_AVG_BYTES) / 1048576);
}

async function storeTile(regionId: string, z: number, x: number, y: number, blob: Blob): Promise<void> {
  if (isNative) {
    const buf = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    await Filesystem.writeFile({
      path: tilePath(regionId, z, x, y),
      data: btoa(binary),
      directory: Directory.Data,
      recursive: true,
    });
    return;
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, tileKey(regionId, z, x, y));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTile(regionId: string, z: number, x: number, y: number): Promise<string | null> {
  if (isNative) {
    try {
      const r = await Filesystem.readFile({ path: tilePath(regionId, z, x, y), directory: Directory.Data });
      const b64 = String(r.data);
      if (!b64) return null;
      return 'data:image/jpeg;base64,' + b64;
    } catch {
      return null;
    }
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(tileKey(regionId, z, x, y));
      req.onsuccess = () => {
        const blob = req.result as Blob | undefined;
        if (!blob) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function regionStoredTiles(regionId: string): Promise<number> {
  if (isNative) {
    try {
      const r = await Filesystem.readdir({ path: 'tiles/' + regionId, directory: Directory.Data });
      let count = 0;
      for (const entry of r.files || []) {
        if (entry.type === 'file') {
          count++;
        } else {
          try {
            const sub = await Filesystem.readdir({ path: 'tiles/' + regionId + '/' + entry.name, directory: Directory.Data });
            count += (sub.files || []).filter((f) => f.type === 'file').length;
          } catch {
            /* ignore */
          }
        }
      }
      return count;
    } catch {
      return 0;
    }
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      let count = 0;
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (String(cursor.key).startsWith(regionId + '/')) count++;
          cursor.continue();
        } else {
          resolve(count);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export async function deleteRegionTiles(regionId: string): Promise<void> {
  if (isNative) {
    try {
      const root = 'tiles/' + regionId;
      const r = await Filesystem.readdir({ path: root, directory: Directory.Data });
      for (const entry of r.files || []) {
        if (entry.type === 'directory') {
          await Filesystem.rmdir({ path: root + '/' + entry.name, directory: Directory.Data, recursive: true }).catch(
            () => undefined,
          );
        } else {
          await Filesystem.deleteFile({ path: root + '/' + entry.name, directory: Directory.Data }).catch(
            () => undefined,
          );
        }
      }
      await Filesystem.rmdir({ path: root, directory: Directory.Data, recursive: true }).catch(() => undefined);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          if (String(cursor.key).startsWith(regionId + '/')) cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

/* ═══ Скачивание с поддержкой докачки ═══ */

export interface DownloadState {
  regionId: string;
  done: number;
  total: number;
  running: boolean;
  failed: number;
}

let downloadRunning = false;
let downloadAborted = false;
let currentState: DownloadState | null = null;

export function isDownloading(): boolean {
  return downloadRunning;
}

export function getDownloadState(): DownloadState | null {
  return currentState;
}

export function abortDownload(): void {
  downloadAborted = true;
}

async function tileExists(regionId: string, z: number, x: number, y: number): Promise<boolean> {
  if (isNative) {
    try {
      await Filesystem.stat({ path: tilePath(regionId, z, x, y), directory: Directory.Data });
      return true;
    } catch {
      return false;
    }
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getKey(tileKey(regionId, z, x, y));
      req.onsuccess = () => resolve(req.result !== undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

export async function downloadRegion(
  region: RegionDef,
  onProgress?: (done: number, total: number) => void,
): Promise<{ downloaded: number; failed: number; skipped: number }> {
  if (downloadRunning) throw new Error('already downloading');
  downloadRunning = true;
  downloadAborted = false;

  const jobs: { z: number; x: number; y: number }[] = [];
  for (let z = region.minZoom; z <= region.maxZoom; z++) {
    const r = tileRangeForZoom(region, z);
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) jobs.push({ z, x, y });
    }
  }
  const total = jobs.length;
  currentState = { regionId: region.id, done: 0, total, running: true, failed: 0 };
  let done = 0;
  let failed = 0;
  let skipped = 0;

  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length && !downloadAborted) {
      const job = jobs[cursor++];
      try {
        /* Докачка: пропускаем уже скачанные тайлы */
        if (await tileExists(region.id, job.z, job.x, job.y)) {
          skipped++;
        } else {
          const url =
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' +
            job.z + '/' + job.y + '/' + job.x;
          const resp = await fetch(url);
          if (resp.ok) {
            const blob = await resp.blob();
            await storeTile(region.id, job.z, job.x, job.y, blob);
          } else failed++;
        }
      } catch {
        failed++;
      }
      done++;
      currentState = { regionId: region.id, done, total, running: !downloadAborted && done < total, failed };
      if (onProgress) onProgress(done, total);
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  currentState = null;
  downloadRunning = false;
  return { downloaded: done - failed - skipped, failed, skipped };
}

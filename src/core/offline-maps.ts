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
      return (r.files || []).length;
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
      const r = await Filesystem.readdir({ path: 'tiles/' + regionId, directory: Directory.Data });
      for (const f of r.files || []) {
        await Filesystem.deleteFile({ path: 'tiles/' + regionId + '/' + f.name, directory: Directory.Data }).catch(
          () => undefined,
        );
      }
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

let downloadRunning = false;
let downloadAborted = false;

export function isDownloading(): boolean {
  return downloadRunning;
}

export function abortDownload(): void {
  downloadAborted = true;
}

export async function downloadRegion(
  region: RegionDef,
  onProgress?: (done: number, total: number) => void,
): Promise<{ downloaded: number; failed: number }> {
  if (downloadRunning) throw new Error('already downloading');
  downloadRunning = true;
  downloadAborted = false;
  let done = 0;
  let failed = 0;
  const jobs: { z: number; x: number; y: number }[] = [];
  for (let z = region.minZoom; z <= region.maxZoom; z++) {
    const r = tileRangeForZoom(region, z);
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) jobs.push({ z, x, y });
    }
  }
  const total = jobs.length;

  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length && !downloadAborted) {
      const job = jobs[cursor++];
      try {
        const url =
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' +
          job.z + '/' + job.y + '/' + job.x;
        const resp = await fetch(url);
        if (resp.ok) {
          const blob = await resp.blob();
          await storeTile(region.id, job.z, job.x, job.y, blob);
        } else failed++;
      } catch {
        failed++;
      }
      done++;
      if (onProgress) onProgress(done, total);
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  downloadRunning = false;
  return { downloaded: done - failed, failed };
}

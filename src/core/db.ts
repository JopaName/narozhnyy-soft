/* Хранилище изображений проектов:
 * - web: IndexedDB
 * - native (Capacitor): Filesystem, файлы images/<projectId> в Directory.Data
 */
import { Directory, Filesystem } from '@capacitor/filesystem';
import { isNative } from './native-storage';

const DB_NAME = 'solarstudio-db';
const STORE = 'images';
let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

const imagePath = (key: string): string => 'images/' + key;

export async function getImage(key: string): Promise<string | null> {
  if (isNative) {
    try {
      const r = await Filesystem.readFile({ path: imagePath(key), directory: Directory.Data });
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
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function setImage(key: string, dataUrl: string): Promise<void> {
  if (isNative) {
    try {
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      await Filesystem.writeFile({ path: imagePath(key), data: base64, directory: Directory.Data, recursive: true });
    } catch (err) {
      console.warn('[storage] image write failed', err);
    }
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

export async function deleteImage(key: string): Promise<void> {
  if (isNative) {
    try {
      await Filesystem.deleteFile({ path: imagePath(key), directory: Directory.Data });
    } catch {
      /* файла может не быть */
    }
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* ignore */
  }
}

/* Абстракция KV-хранилища с двумя бэкендами:
 * - web (браузер/dev): localStorage (синхронно)
 * - native (Capacitor APK): Filesystem, файлы в Directory.Data + .bak-копии
 *
 * Синхронный интерфейс поверх асинхронного бэкенда:
 * чтение — из in-memory кэша (гидрируется при старте),
 * запись — в кэш сразу + debounce-флаш в файл.
 */
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

export const isNative = Capacitor.isNativePlatform();

/* Ключи, участвующие в миграции legacy localStorage → файлы */
const KNOWN_KEYS = ['solarstudio_v2', 'equipment_override'];

const memCache = new Map<string, string>();
const pending = new Map<string, string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function readFileSafe(key: string): Promise<string | null> {
  try {
    const r = await Filesystem.readFile({ path: key, directory: Directory.Data, encoding: Encoding.UTF8 });
    return String(r.data);
  } catch {
    return null;
  }
}

async function writeFileSafe(key: string, value: string): Promise<void> {
  try {
    /* Целостность: перед перезаписью сохраняем .bak */
    const existing = await readFileSafe(key);
    if (existing !== null) {
      await Filesystem.copy({ from: key, to: key + '.bak', directory: Directory.Data }).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }
  try {
    await Filesystem.writeFile({ path: key, data: value, directory: Directory.Data, encoding: Encoding.UTF8 });
  } catch (err) {
    console.warn('[storage] write failed for', key, err);
  }
}

export async function storageInit(): Promise<void> {
  if (!isNative) return;

  for (const key of KNOWN_KEYS) {
    /* 1. Основной файл, 2. .bak, 3. legacy localStorage (миграция) */
    let content = await readFileSafe(key);
    if (content === null) content = await readFileSafe(key + '.bak');
    if (content === null) {
      try {
        const legacy = localStorage.getItem(key);
        if (legacy !== null) content = legacy;
      } catch {
        /* ignore */
      }
    }
    if (content !== null) {
      memCache.set(key, content);
      pending.set(key, content);
    }
  }
  if (pending.size) await flushPending();
}

export function storageGet(key: string): string | null {
  if (!isNative) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  if (memCache.has(key)) return memCache.get(key) ?? null;
  /* На случай обращения до init: legacy как фолбэк */
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  if (!isNative) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
    return;
  }
  memCache.set(key, value);
  pending.set(key, value);
  scheduleFlush();
}

export function storageRemove(key: string): void {
  if (!isNative) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  memCache.delete(key);
  pending.set(key, '__REMOVE__');
  scheduleFlush();
}

function scheduleFlush(): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushPending();
  }, 600);
}

export async function storageFlush(): Promise<void> {
  if (!isNative) return;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushPending();
}

async function flushPending(): Promise<void> {
  if (!pending.size) return;
  const entries = [...pending.entries()];
  pending.clear();
  for (const [key, value] of entries) {
    if (value === '__REMOVE__') {
      try {
        await Filesystem.deleteFile({ path: key, directory: Directory.Data });
      } catch {
        /* ignore */
      }
      continue;
    }
    await writeFileSafe(key, value);
  }
}

/* Флаш при уходе приложения в фон / закрытии вкладки */
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void storageFlush();
  });
  window.addEventListener('pagehide', () => {
    void storageFlush();
  });
}

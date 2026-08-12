import { PANELS } from './data';
import { sanitize, state, toPersistable } from './state';

export interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: number;
  panelCount: number;
  capKw: number;
  data: Record<string, unknown>;
}

export interface ProjectsStore {
  activeId: string;
  list: ProjectRecord[];
}

const STORE_KEY = 'solarstudio_v2';
const LEGACY_KEY = 'solarstudio';

let store: ProjectsStore = { activeId: '', list: [] };

function loadStore(): ProjectsStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProjectsStore;
      if (Array.isArray(parsed.list)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { activeId: '', list: [] };
}

function saveStore(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function initProjects(): void {
  store = loadStore();
  /* Миграция старого одиночного проекта */
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy) as Record<string, unknown>;
      const rec = makeRecord(
        typeof data.project === 'string' && data.project ? data.project : 'Мой проект',
        data,
      );
      store.list.push(rec);
      store.activeId = rec.id;
      localStorage.removeItem(LEGACY_KEY);
      saveStore();
    }
  } catch {
    /* ignore */
  }
  if (!store.list.length) {
    store.list = [];
    store.activeId = '';
  }
}

function makeRecord(name: string, data: Record<string, unknown>): ProjectRecord {
  const panels = Array.isArray(data.panels) ? (data.panels as Array<{ w: number; h: number }>) : [];
  const panelIdx = clampInt(parseInt(String(data.panel), 10), PANELS.length);
  return {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name.slice(0, 80),
    updatedAt: Date.now(),
    panelCount: panels.length,
    capKw: Math.round(panels.length * PANELS[panelIdx].p * 100) / 100,
    data,
  };
}

function clampInt(v: number, len: number): number {
  if (isNaN(v) || v < 0) return 0;
  return Math.min(v, Math.max(0, len - 1));
}

export function listProjects(): ProjectRecord[] {
  return store.list.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveId(): string {
  return store.activeId;
}

export function getActiveRecord(): ProjectRecord | null {
  return store.list.find((r) => r.id === store.activeId) || null;
}

export function getRecord(id: string): ProjectRecord | null {
  return store.list.find((r) => r.id === id) || null;
}

function syncMeta(rec: ProjectRecord, data: Record<string, unknown>): void {
  const panels = Array.isArray(data.panels) ? (data.panels as Array<{ w: number; h: number }>) : [];
  const panelIdx = clampInt(parseInt(String(data.panel), 10), PANELS.length);
  rec.updatedAt = Date.now();
  rec.panelCount = panels.length;
  rec.capKw = Math.round(panels.length * PANELS[panelIdx].p * 100) / 100;
  rec.data = data;
}

export function flushSave(): void {
  if (!store.activeId) return;
  const rec = getActiveRecord();
  if (!rec) return;
  const data = toPersistable();
  rec.name = state.project || 'Без названия';
  syncMeta(rec, data);
  saveStore();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function queueSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 600);
}

export function createProject(name: string, data?: Record<string, unknown>): string {
  flushSave();
  const rec = makeRecord(name || 'Новый проект', data || toPersistable());
  store.list.push(rec);
  store.activeId = rec.id;
  saveStore();
  return rec.id;
}

export function setActive(id: string): ProjectRecord | null {
  flushSave();
  const rec = getRecord(id);
  if (!rec) return null;
  store.activeId = id;
  saveStore();
  return rec;
}

export function duplicateProject(id: string): string | null {
  const src = getRecord(id);
  if (!src) return null;
  const rec = makeRecord(src.name + ' (копия)', JSON.parse(JSON.stringify(src.data)) as Record<string, unknown>);
  store.list.push(rec);
  store.activeId = rec.id;
  saveStore();
  return rec.id;
}

export function renameProject(id: string, name: string): void {
  const rec = getRecord(id);
  if (!rec) return;
  rec.name = name.slice(0, 80);
  saveStore();
}

export function deleteProject(id: string): void {
  const idx = store.list.findIndex((r) => r.id === id);
  if (idx < 0) return;
  store.list.splice(idx, 1);
  if (store.activeId === id) {
    store.activeId = store.list.length ? store.list[store.list.length - 1].id : '';
  }
  saveStore();
}

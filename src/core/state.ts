import { BATTERIES, CITIES, INVERTERS, MAX_PANELS, PANELS } from './data';
import { clamp } from './utils';
import type { AppState, Point, Rect } from './types';

export const STORAGE_KEY = 'solarstudio';

export const state: AppState = {
  tool: 'select',
  city: 'krasnodar',
  panel: 1,
  inverter: 1,
  orientation: 'portrait',
  gap: 0.05,
  margin: 0.4,
  tilt: 45,
  azimuth: 180,
  consumption: 450,
  selfUse: 60,
  tariff: 6.5,
  exportRate: 2.5,
  project: 'Частный дом, ул. Солнечная 12',
  batteryEnabled: false,
  battery: 0,
  reserve: 20,
  financing: 'cash',
  down: 30,
  rate: 18,
  termMonths: 60,
  showShadows: true,
  shadeMonth: new Date().getMonth(),
  shadeHour: 10.5,
  shadeLoss: new Array(12).fill(0),
  orth: true,
  roof: [],
  panels: [],
  obstacles: [],
  tempRoof: [],
  bg: {
    visible: false,
    opacity: 0.5,
    calibS: 0,
    addr: '',
  },
  arrayAngle: 0,
  showStrings: false,
  showShadeMap: false,
  showGrid: true,
  showDims: true,
  showObstacles: true,
  locked: [],
};

const okPt = (p: unknown): p is Point => !!p && typeof p === 'object' && isFinite((p as Point).x) && isFinite((p as Point).y);
const okRect = (p: unknown): p is Rect => okPt(p) && isFinite((p as Rect).w) && isFinite((p as Rect).h) && (p as Rect).w > 0 && (p as Rect).h > 0;
type RectLike = Rect & { z?: unknown };
const okRectLike = (p: unknown): p is RectLike => okRect(p);

export function sanitize(o: Record<string, unknown>): AppState {
  const s: AppState = { ...state, shadeLoss: new Array(12).fill(0), roof: [], panels: [], obstacles: [], tempRoof: [] };
  s.roof = Array.isArray(o.roof) ? o.roof.filter(okPt).slice(0, 40) : [];
  if (s.roof.length < 3) s.roof = [];
  s.panels = Array.isArray(o.panels) ? o.panels.filter(okRect).slice(0, MAX_PANELS) : [];
  s.obstacles = Array.isArray(o.obstacles)
    ? o.obstacles
        .filter(okRectLike)
        .slice(0, 60)
        .map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h, z: clamp(parseFloat(String(p.z)) >= 0 ? Number(p.z) : 1, 0, 15) }))
    : [];
  s.city = CITIES[String(o.city)] ? String(o.city) : 'krasnodar';
  s.panel = clamp(parseInt(String(o.panel), 10) || 0, 0, PANELS.length - 1);
  s.inverter = clamp(parseInt(String(o.inverter), 10) || 0, 0, INVERTERS.length - 1);
  s.battery = clamp(parseInt(String(o.battery), 10) || 0, 0, BATTERIES.length - 1);
  s.batteryEnabled = o.batteryEnabled === true;
  s.gap = clamp(parseFloat(String(o.gap)), 0, 2) || 0.05;
  s.margin = clamp(parseFloat(String(o.margin)), 0, 3) || 0.4;
  s.tilt = clamp(parseFloat(String(o.tilt)), 0, 90) || 45;
  s.azimuth = clamp(parseFloat(String(o.azimuth)), 0, 359) || 180;
  s.consumption = clamp(parseFloat(String(o.consumption)), 0, 1e6) || 450;
  s.selfUse = clamp(parseFloat(String(o.selfUse)), 0, 100) || 60;
  s.tariff = clamp(parseFloat(String(o.tariff)), 0, 1e4) || 6.5;
  s.exportRate = clamp(parseFloat(String(o.exportRate)), 0, 1e4) || 2.5;
  s.reserve = clamp(parseFloat(String(o.reserve)), 0, 60) || 20;
  s.down = clamp(parseFloat(String(o.down)), 0, 100) || 30;
  s.rate = clamp(parseFloat(String(o.rate)), 0, 50) || 18;
  s.termMonths = clamp(parseFloat(String(o.termMonths)), 6, 300) || 60;
  s.financing = o.financing === 'loan' ? 'loan' : 'cash';
  s.showShadows = o.showShadows !== false;
  s.shadeMonth = clamp(parseInt(String(o.shadeMonth), 10) || new Date().getMonth(), 0, 11);
  s.shadeHour = clamp(parseFloat(String(o.shadeHour)) || 10.5, 5, 21);
  s.orth = o.orth !== false;
  s.orientation = o.orientation === 'landscape' ? 'landscape' : 'portrait';
  s.project = typeof o.project === 'string' ? o.project.slice(0, 80) : state.project;
  const bgRaw = (o.bg as Record<string, unknown> | undefined) || {};
  s.bg = {
    visible: bgRaw.visible === true,
    opacity: clamp(parseFloat(String(bgRaw.opacity)) || 0.5, 0.1, 1),
    calibS: Math.max(0, parseFloat(String(bgRaw.calibS)) || 0),
    addr: typeof bgRaw.addr === 'string' ? bgRaw.addr.slice(0, 120) : '',
  };
  s.arrayAngle = clamp(parseFloat(String(o.arrayAngle)) || 0, -45, 45);
  s.showStrings = o.showStrings === true;
  s.showShadeMap = o.showShadeMap === true;
  s.showGrid = o.showGrid !== false;
  s.showDims = o.showDims !== false;
  s.showObstacles = o.showObstacles !== false;
  s.locked = Array.isArray(o.locked)
    ? (o.locked as unknown[]).filter((v): v is number => typeof v === 'number' && isFinite(v))
    : [];
  return s;
}

export function toPersistable(): Record<string, unknown> {
  const { tempRoof, tool, ...rest } = state;
  return { ...rest };
}

export function saveLocal(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersistable()));
  } catch {
    /* localStorage может быть недоступен */
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function queueSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 600);
}

export function loadLocal(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

import type { BatteryData, BomItem, CityData, InverterData, PanelData } from './types';

export const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
export const MONTH_FULL = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
export const CUM_DAY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
export const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const SEASON = [1.28, 1.19, 1.08, 0.94, 0.84, 0.79, 0.81, 0.84, 0.93, 1.03, 1.12, 1.25];
export const MAX_PANELS = 1200;

export const CITIES: Record<string, CityData> = {
  krasnodar: { name: 'Краснодар', lat: 45.0, ghi: [1.4, 2.3, 3.6, 4.8, 5.8, 6.4, 6.5, 5.8, 4.4, 2.7, 1.3, 1.0] },
  moscow: { name: 'Москва', lat: 55.7, ghi: [0.9, 1.8, 3.0, 4.2, 5.1, 5.4, 5.2, 4.2, 2.8, 1.5, 0.7, 0.5] },
  spb: { name: 'Санкт-Петербург', lat: 59.9, ghi: [0.5, 1.3, 2.6, 4.0, 5.0, 5.4, 5.1, 3.8, 2.3, 1.1, 0.4, 0.2] },
  sochi: { name: 'Сочи', lat: 43.6, ghi: [1.8, 2.6, 3.7, 4.7, 5.6, 6.3, 6.6, 6.1, 4.8, 3.2, 1.9, 1.5] },
  rostov: { name: 'Ростов-на-Дону', lat: 47.2, ghi: [1.3, 2.2, 3.5, 4.7, 5.7, 6.3, 6.5, 5.7, 4.3, 2.6, 1.2, 0.9] },
  ekaterinburg: { name: 'Екатеринбург', lat: 56.8, ghi: [0.8, 1.7, 3.1, 4.4, 5.3, 5.6, 5.3, 4.2, 2.7, 1.4, 0.7, 0.4] },
  kazan: { name: 'Казань', lat: 55.8, ghi: [0.9, 1.8, 3.1, 4.4, 5.3, 5.5, 5.2, 4.2, 2.7, 1.5, 0.7, 0.5] },
  novosibirsk: { name: 'Новосибирск', lat: 55.0, ghi: [0.9, 1.9, 3.4, 4.7, 5.5, 5.9, 5.7, 4.6, 2.9, 1.5, 0.8, 0.5] },
  minsk: { name: 'Минск', lat: 53.9, ghi: [0.8, 1.6, 2.8, 4.1, 5.0, 5.4, 5.1, 4.1, 2.7, 1.4, 0.6, 0.4] },
  almaty: { name: 'Алматы', lat: 43.2, ghi: [1.6, 2.4, 3.7, 4.9, 5.8, 6.3, 6.4, 5.9, 4.7, 3.0, 1.7, 1.2] },
};

export const PANELS_DEFAULT: PanelData[] = [
  { name: 'JA Solar 410 Вт', w: 1.722, h: 1.134, p: 0.41, price: 11500, Vmp: 31.5, Voc: 37.9, Imp: 13.02, Isc: 13.9 },
  { name: 'Longi Hi-MO 450 Вт', w: 2.094, h: 1.134, p: 0.45, price: 12900, Vmp: 41.0, Voc: 49.5, Imp: 10.98, Isc: 11.6 },
  { name: 'Trina Vertex 550 Вт', w: 2.279, h: 1.134, p: 0.55, price: 15400, Vmp: 41.9, Voc: 50.0, Imp: 13.13, Isc: 13.96 },
  { name: 'Jinko Tiger Neo 575 Вт', w: 2.384, h: 1.134, p: 0.575, price: 17200, Vmp: 42.7, Voc: 51.2, Imp: 13.47, Isc: 14.2 },
  { name: 'Risen Titan 670 Вт', w: 2.465, h: 1.303, p: 0.67, price: 21800, Vmp: 40.1, Voc: 48.3, Imp: 16.7, Isc: 17.6 },
];

export const INVERTERS_DEFAULT: InverterData[] = [
  { name: 'Huawei SUN2000-5KTL-L1 (5 кВт)', p: 5, price: 92000, vmin: 90, vmax: 560, mppt: 2, imax: 12.5, hybrid: false },
  { name: 'Deye SUN-8K-SG04LP3 гибрид (8 кВт)', p: 8, price: 128000, vmin: 150, vmax: 650, mppt: 2, imax: 26, hybrid: true },
  { name: 'Huawei SUN2000-10KTL-M1 (10 кВт)', p: 10, price: 165000, vmin: 200, vmax: 1000, mppt: 2, imax: 26, hybrid: false },
  { name: 'Sungrow SG15RT (15 кВт)', p: 15, price: 215000, vmin: 180, vmax: 1100, mppt: 2, imax: 26, hybrid: false },
  { name: 'Sungrow SG25CX (25 кВт)', p: 25, price: 330000, vmin: 180, vmax: 1100, mppt: 4, imax: 32, hybrid: false },
  { name: 'Huawei SUN2000-50KTL-M3 (50 кВт)', p: 50, price: 495000, vmin: 200, vmax: 1100, mppt: 6, imax: 32, hybrid: false },
];

export const BATTERIES_DEFAULT: BatteryData[] = [
  { name: 'Pylontech US5000 — 4.8 кВт·ч', cap: 4.8, price: 89000 },
  { name: 'Deye SE-G5.1 Pro — 5.1 кВт·ч', cap: 5.12, price: 168000 },
  { name: 'Huawei LUNA2000-7 — 7.0 кВт·ч', cap: 7.0, price: 320000 },
  { name: 'BYD HVS — 7.7 кВт·ч', cap: 7.68, price: 355000 },
  { name: 'BYD HVM — 11.0 кВт·ч', cap: 11.04, price: 465000 },
  { name: 'Growatt Ark XH — 13.8 кВт·ч', cap: 13.82, price: 640000 },
];

export const BOM_DEFAULT: BomItem[] = [
  { id: 'rack', name: 'Система крепления на панель', per: 'panel', qty: 1, price: 2100, unit: 'шт' },
  { id: 'dc_cable', name: 'Кабель DC 6 мм²', per: 'string', qty: 15, price: 180, unit: 'м' },
  { id: 'ac_cable', name: 'Кабель AC 5×6 мм²', per: 'project', qty: 10, price: 350, unit: 'м' },
  { id: 'dc_breaker', name: 'Выключатель DC на стринг', per: 'string', qty: 1, price: 3500, unit: 'шт' },
  { id: 'spd_dc', name: 'УЗИП DC', per: 'project', qty: 1, price: 4800, unit: 'шт' },
  { id: 'ac_protection', name: 'Автомат + УЗО AC', per: 'project', qty: 1, price: 5200, unit: 'шт' },
  { id: 'meter', name: 'Счётчик двунаправленный', per: 'project', qty: 1, price: 9500, unit: 'шт' },
  { id: 'monitoring', name: 'Мониторинг Wi-Fi', per: 'project', qty: 1, price: 6500, unit: 'шт' },
];

export let PANELS: PanelData[] = [...PANELS_DEFAULT];
export let INVERTERS: InverterData[] = [...INVERTERS_DEFAULT];
export let BATTERIES: BatteryData[] = [...BATTERIES_DEFAULT];
export let BOM: BomItem[] = [...BOM_DEFAULT];

export async function loadEquipment(): Promise<void> {
  try {
    const resp = await fetch('/equipment.json');
    if (!resp.ok) return;
    const data = await resp.json() as Record<string, unknown[]>;
    if (Array.isArray(data.panels) && data.panels.length) {
      PANELS = data.panels as PanelData[];
    }
    if (Array.isArray(data.inverters) && data.inverters.length) {
      INVERTERS = data.inverters as InverterData[];
    }
    if (Array.isArray(data.batteries) && data.batteries.length) {
      BATTERIES = data.batteries as BatteryData[];
    }
    if (Array.isArray(data.bom) && data.bom.length) {
      BOM = data.bom as BomItem[];
    }
  } catch {
    /* падаем на дефолты, зашитые в коде */
  }
}

export function resetEquipment(): void {
  PANELS = [...PANELS_DEFAULT];
  INVERTERS = [...INVERTERS_DEFAULT];
  BATTERIES = [...BATTERIES_DEFAULT];
  BOM = [...BOM_DEFAULT];
}

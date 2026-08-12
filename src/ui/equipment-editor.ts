import { BATTERIES, BOM, INVERTERS, PANELS } from '../core/data';
import type { BatteryData, BomItem, InverterData, PanelData } from '../core/types';
import { el, nf, toast } from '../core/utils';
import { events } from '../core/runtime';
import { state } from '../core/state';

type EqType = 'panels' | 'inverters' | 'batteries' | 'bom';
let currentTab: EqType = 'panels';
const STORAGE_KEY = 'equipment_override';

function snapshot(): {
  panels: PanelData[];
  inverters: InverterData[];
  batteries: BatteryData[];
  bom: BomItem[];
} {
  return {
    panels: [...PANELS],
    inverters: [...INVERTERS],
    batteries: [...BATTERIES],
    bom: [...BOM],
  };
}

let edited = snapshot();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(edited));
  } catch {
    /* ignore */
  }
}

export function loadOverrides(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as {
      panels?: PanelData[];
      inverters?: InverterData[];
      batteries?: BatteryData[];
      bom?: BomItem[];
    };
    if (data.panels?.length) {
      PANELS.length = 0;
      PANELS.push(...data.panels);
    }
    if (data.inverters?.length) {
      INVERTERS.length = 0;
      INVERTERS.push(...data.inverters);
    }
    if (data.batteries?.length) {
      BATTERIES.length = 0;
      BATTERIES.push(...data.batteries);
    }
    if (data.bom?.length) {
      BOM.length = 0;
      BOM.push(...data.bom);
    }
  } catch {
    /* ignore */
  }
}

function repopulateSelects(): void {
  el('selPanel').innerHTML = PANELS.map((p, i) => '<option value="' + i + '">' + p.name + ' · ' + nf(p.price) + ' ₽</option>').join('');
  el('selInv').innerHTML = INVERTERS.map((v, i) => '<option value="' + i + '">' + v.name + ' · ' + nf(v.price) + ' ₽</option>').join('');
  el('selBat').innerHTML = BATTERIES.map((b, i) => '<option value="' + i + '">' + b.name + ' · ' + nf(b.price) + ' ₽</option>').join('');
  /* clamp state indices if now out of range */
  if (state.panel >= PANELS.length) {
    el<HTMLSelectElement>('selPanel').value = '0';
  } else {
    el<HTMLSelectElement>('selPanel').value = String(state.panel);
  }
  if (state.inverter >= INVERTERS.length) {
    el<HTMLSelectElement>('selInv').value = '0';
  } else {
    el<HTMLSelectElement>('selInv').value = String(state.inverter);
  }
  if (state.battery >= BATTERIES.length) {
    el<HTMLSelectElement>('selBat').value = '0';
  } else {
    el<HTMLSelectElement>('selBat').value = String(state.battery);
  }
}

export function openEditor(): void {
  edited = snapshot();
  currentTab = 'panels';
  renderEditor();
  el('eq-modal').style.display = 'flex';
}

function closeEditor(): void {
  el('eq-modal').style.display = 'none';
}

function renderEditor(): void {
  renderTabs();
  renderList();
}

function renderTabs(): void {
  const tabs: [EqType, string][] = [
    ['panels', 'Панели'],
    ['inverters', 'Инверторы'],
    ['batteries', 'Батареи'],
    ['bom', 'Смета'],
  ];
  el('eq-tabs').innerHTML = tabs
    .map(
      ([k, label]) =>
        '<button class="tab ' +
        (currentTab === k ? 'active' : '') +
        '" data-eqtab="' +
        k +
        '">' +
        label +
        ' (' +
        getCurrent(k).length +
        ')</button>',
    )
    .join('');

  el('eq-tabs').querySelectorAll('[data-eqtab]').forEach((b) => {
    b.addEventListener('click', () => {
      currentTab = (b as HTMLElement).dataset.eqtab as EqType;
      renderEditor();
    });
  });
}

function getCurrent(tab: EqType): PanelData[] | InverterData[] | BatteryData[] | BomItem[] {
  if (tab === 'panels') return edited.panels;
  if (tab === 'inverters') return edited.inverters;
  if (tab === 'bom') return edited.bom;
  return edited.batteries;
}

function renderList(): void {
  const items = getCurrent(currentTab) as unknown as Record<string, unknown>[];
  const container = el('eq-list');

  if (items.length === 0) {
    container.innerHTML = '<div class="text-slate-500 text-center py-8">Нет записей. Нажмите «+ Добавить».</div>';
    return;
  }

  container.innerHTML = items
    .map((item, i) => {
      const name = String(item.name || '');
      const fields = getFields(currentTab, item as unknown as PanelData | InverterData | BatteryData | BomItem);
      return (
        '<div class="card p-3 flex items-start gap-3 group">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="font-bold text-white text-[13px] truncate">' +
        name +
        '</div>' +
        '<div class="text-[11px] text-slate-400 mt-1">' +
        fields +
        '</div>' +
        '</div>' +
        '<div class="flex gap-1 shrink-0 eq-actions">' +
        '<button class="btn btn-ghost text-[11px] py-1 px-2 eq-edit" data-idx="' +
        i +
        '">✎</button>' +
        '<button class="btn text-[11px] py-1 px-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 eq-del" data-idx="' +
        i +
        '">✕</button>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  container.querySelectorAll('.eq-edit').forEach((b) => {
    b.addEventListener('click', () => editItem(Number((b as HTMLElement).dataset.idx)));
  });
  container.querySelectorAll('.eq-del').forEach((b) => {
    b.addEventListener('click', () => deleteItem(Number((b as HTMLElement).dataset.idx)));
  });
}

function getFields(tab: EqType, item: PanelData | InverterData | BatteryData | BomItem): string {
  if (tab === 'panels') {
    const p = item as PanelData;
    return p.p * 1000 + ' Вт · ' + nf(p.w, 2) + '×' + nf(p.h, 2) + ' м · ' + nf(p.price) + ' ₽ · Vmp ' + p.Vmp + ' В';
  }
  if (tab === 'bom') {
    const b = item as BomItem;
    return b.qty + ' ' + b.unit + ' × ' + nf(b.price) + ' ₽ · на ' + b.per + ' (' + b.id + ')';
  }
  if (tab === 'inverters') {
    const inv = item as InverterData;
    return (
      inv.p +
      ' кВт · ' +
      nf(inv.price) +
      ' ₽ · ' +
      inv.vmin +
      '–' +
      inv.vmax +
      ' В · ' +
      inv.mppt +
      ' MPPT' +
      (inv.hybrid ? ' · гибрид' : '')
    );
  }
  const bat = item as BatteryData;
  return bat.cap + ' кВт·ч · ' + nf(bat.price) + ' ₽';
}

function editItem(idx: number): void {
  const items = getCurrent(currentTab) as unknown as Record<string, unknown>[];
  const item = items[idx] as Record<string, unknown>;
  const newName = prompt('Название:', String(item.name || ''));
  if (newName === null) return;
  if (newName) item.name = newName;

  if (currentTab === 'panels') {
    const p = item as unknown as PanelData;
    askNum('Ширина, м', p.w, (v) => (p.w = v));
    askNum('Высота, м', p.h, (v) => (p.h = v));
    askNum('Мощность, кВт', p.p, (v) => (p.p = v));
    askNum('Цена, ₽', p.price, (v) => (p.price = v));
    askNum('Vmp, В', p.Vmp, (v) => (p.Vmp = v));
    askNum('Voc, В', p.Voc, (v) => (p.Voc = v));
    askNum('Imp, А', p.Imp, (v) => (p.Imp = v));
    askNum('Isc, А', p.Isc, (v) => (p.Isc = v));
  }
  if (currentTab === 'inverters') {
    const inv = item as unknown as InverterData;
    askNum('Мощность, кВт', inv.p, (v) => (inv.p = v));
    askNum('Цена, ₽', inv.price, (v) => (inv.price = v));
    askNum('Vmin, В', inv.vmin, (v) => (inv.vmin = v));
    askNum('Vmax, В', inv.vmax, (v) => (inv.vmax = v));
    askNumInt('MPPT', inv.mppt, (v) => (inv.mppt = v));
    askNum('Imax, А', inv.imax, (v) => (inv.imax = v));
    inv.hybrid = confirm('Гибридный инвертор?');
  }
  if (currentTab === 'batteries') {
    const bat = item as unknown as BatteryData;
    askNum('Ёмкость, кВт·ч', bat.cap, (v) => (bat.cap = v));
    askNum('Цена, ₽', bat.price, (v) => (bat.price = v));
  }
  if (currentTab === 'bom') {
    const b = item as unknown as BomItem;
    askNum('Количество', b.qty, (v) => (b.qty = v));
    askNum('Цена, ₽', b.price, (v) => (b.price = v));
    const unit = prompt('Единица (шт/м):', b.unit);
    if (unit !== null && unit) b.unit = unit;
    const per = prompt('На что считается (panel/string/project):', b.per);
    if (per === 'panel' || per === 'string' || per === 'project') b.per = per;
  }
  renderEditor();
}

function askNum(label: string, current: number, setter: (v: number) => void): void {
  const val = prompt(label, String(current));
  if (val === null) return;
  const n = parseFloat(val);
  if (!isNaN(n) && n > 0) setter(n);
}

function askNumInt(label: string, current: number, setter: (v: number) => void): void {
  const val = prompt(label, String(current));
  if (val === null) return;
  const n = parseInt(val, 10);
  if (!isNaN(n) && n > 0) setter(n);
}

function deleteItem(idx: number): void {
  if (!confirm('Удалить эту позицию?')) return;
  const items = getCurrent(currentTab);
  items.splice(idx, 1);
  renderEditor();
}

function addItem(): void {
  if (currentTab === 'panels') {
    edited.panels.push({
      name: 'Новая панель',
      w: 1.7,
      h: 1.1,
      p: 0.4,
      price: 10000,
      Vmp: 31,
      Voc: 38,
      Imp: 13,
      Isc: 14,
    });
  } else if (currentTab === 'inverters') {
    edited.inverters.push({
      name: 'Новый инвертор',
      p: 5,
      price: 80000,
      vmin: 90,
      vmax: 560,
      mppt: 2,
      imax: 12,
      hybrid: false,
    });
  } else if (currentTab === 'bom') {
    edited.bom.push({
      id: 'item_' + Date.now().toString(36),
      name: 'Новая позиция',
      per: 'project',
      qty: 1,
      price: 1000,
      unit: 'шт',
    });
  } else {
    edited.batteries.push({
      name: 'Новая батарея',
      cap: 5,
      price: 90000,
    });
  }
  renderEditor();
}

function saveEditor(): void {
  PANELS.length = 0;
  PANELS.push(...edited.panels);
  INVERTERS.length = 0;
  INVERTERS.push(...edited.inverters);
  BATTERIES.length = 0;
  BATTERIES.push(...edited.batteries);
  BOM.length = 0;
  BOM.push(...edited.bom);
  persist();
  toast('Каталог сохранён');
  closeEditor();
  repopulateSelects();
  events.refresh();
}

export function setupEditor(): void {
  el('eq-close').addEventListener('click', closeEditor);
  el('eq-add').addEventListener('click', addItem);
  el('eq-save').addEventListener('click', saveEditor);
  el('btnCatalog').addEventListener('click', openEditor);

  el('eq-modal').addEventListener('click', (e) => {
    if (e.target === el('eq-modal')) closeEditor();
  });
}

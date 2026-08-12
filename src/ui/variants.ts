import Chart from 'chart.js/auto';
import { addVariant, createProject, deleteVariant, getActiveId, listVariants, renameVariant } from '../core/projects';
import { state, toPersistable } from '../core/state';
import { el, nf, toast } from '../core/utils';
import { computeShading } from '../domain/solar';
import { simulate } from '../domain/simulation';
import type { SimResult } from '../core/types';
import type { VariantRecord } from '../core/types';

const PALETTE = ['#f59e0b', '#38bdf8', '#22c55e', '#a78bfa', '#f87171', '#2dd4bf', '#fbbf24', '#e879f9'];

/* Кэш метрик варианта: id → SimResult */
const metricsCache = new Map<string, SimResult>();

export function getVariantMetrics(v: VariantRecord): SimResult {
  const cached = metricsCache.get(v.id);
  if (cached) return cached;
  const data = v.data as Record<string, unknown>;
  const loss = computeShading(data as never);
  const overrides = { ...data, shadeLoss: loss } as never;
  const sim = simulate(overrides);
  metricsCache.set(v.id, sim);
  return sim;
}

export function clearVariantCache(): void {
  metricsCache.clear();
}

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
}

let openProjectHook: ((id: string) => void) | null = null;
export function setOpenProjectHook(fn: (id: string) => void): void {
  openProjectHook = fn;
}

export function renderVariants(): void {
  const variants = listVariants();
  renderList(variants);
  renderTable(variants);
  renderChart(variants);
}

function renderList(variants: VariantRecord[]): void {
  const container = el('variantList');
  if (!variants.length) {
    container.innerHTML =
      '<div class="card p-6 text-center text-[13px] text-slate-500">Вариантов нет. Настройте систему и нажмите «+ Сохранить текущий» — повторите для разных конфигураций.</div>';
    return;
  }
  container.innerHTML = variants
    .map((v) => {
      const sim = getVariantMetrics(v);
      return (
        '<div class="card p-3 flex items-center gap-3 group" data-id="' +
        v.id +
        '">' +
        '<div class="flex-1 min-w-0">' +
        '<div class="font-bold text-white text-[13px] truncate">' +
        v.name +
        '</div>' +
        '<div class="text-[11px] text-slate-400 mt-0.5">' +
        nf(sim.cap, 2) +
        ' кВт · ' +
        nf(sim.annualGen) +
        ' кВт·ч/год · CAPEX ' +
        nf(sim.capex) +
        ' ₽ · окупаемость ' +
        (isFinite(sim.payback) ? nf(sim.payback, 1) + ' лет' : '—') +
        ' · ' +
        fmtDate(v.createdAt) +
        '</div>' +
        '</div>' +
        '<div class="flex gap-1 shrink-0">' +
        '<button class="btn btn-ghost text-[11px] py-1 px-2 v-edit" data-id="' + v.id + '" title="Переименовать">✎</button>' +
        '<button class="btn btn-ghost text-[11px] py-1 px-2 v-dup" data-id="' + v.id + '" title="Дублировать в новый проект">⧉</button>' +
        '<button class="btn text-[11px] py-1 px-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 v-del" data-id="' + v.id + '" title="Удалить">✕</button>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');

  container.querySelectorAll('.v-edit').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.id!;
      const v = variants.find((x) => x.id === id);
      const name = prompt('Название варианта:', v?.name || '');
      if (name === null) return;
      if (name) {
        renameVariant(id, name);
        renderVariants();
      }
    });
  });
  container.querySelectorAll('.v-dup').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.id!;
      const v = variants.find((x) => x.id === id);
      if (!v) return;
      /* createProject сам делает новый проект активным (после flushSave старого) */
      const newId = createProject(v.name + ' (из варианта)', JSON.parse(JSON.stringify(v.data)) as Record<string, unknown>);
      toast('Создан проект из варианта. Фото крыши не переносится.');
      openProjectHook?.(newId);
    });
  });
  container.querySelectorAll('.v-del').forEach((b) => {
    b.addEventListener('click', () => {
      const id = (b as HTMLElement).dataset.id!;
      if (!confirm('Удалить вариант?')) return;
      deleteVariant(id);
      metricsCache.delete(id);
      renderVariants();
    });
  });
}

interface Row {
  label: string;
  fmt: (sim: SimResult) => string;
}

const ROWS: Row[] = [
  { label: 'Мощность', fmt: (s) => nf(s.cap, 2) + ' кВт' },
  { label: 'Выработка / год', fmt: (s) => nf(s.annualGen) + ' кВт·ч' },
  { label: 'CAPEX', fmt: (s) => nf(s.capex) + ' ₽' },
  { label: 'Экономия / год', fmt: (s) => nf(s.saveY) + ' ₽' },
  { label: 'Окупаемость', fmt: (s) => (isFinite(s.payback) ? nf(s.payback, 1) + ' лет' : '—') },
  { label: 'Выгода за 25 лет', fmt: (s) => nf(s.cash[25]) + ' ₽' },
];

function renderTable(variants: VariantRecord[]): void {
  const current = simulate();
  const cols: { name: string; sim: SimResult; panelCount: number }[] = [
    { name: state.project || 'Текущий проект', sim: current, panelCount: state.panels.length },
  ];
  variants.forEach((v) => {
    const panels = Array.isArray((v.data as Record<string, unknown>).panels)
      ? ((v.data as Record<string, unknown>).panels as unknown[]).length
      : 0;
    cols.push({ name: v.name, sim: getVariantMetrics(v), panelCount: panels });
  });

  const head =
    '<tr class="text-slate-500 text-[11px] uppercase">' +
    '<td class="py-2 pr-4"></td>' +
    cols.map((c) => '<td class="py-2 px-3 font-bold">' + c.name + '</td>').join('') +
    '</tr>';

  const panelRow =
    '<tr class="border-t border-slate-800">' +
    '<td class="py-2 pr-4 text-slate-400">Панелей</td>' +
    cols.map((c) => '<td class="py-2 px-3 text-white font-semibold">' + c.panelCount + ' шт</td>').join('') +
    '</tr>';

  const body = ROWS.map(
    (row) =>
      '<tr class="border-t border-slate-800">' +
      '<td class="py-2 pr-4 text-slate-400">' + row.label + '</td>' +
      cols.map((c) => '<td class="py-2 px-3 text-white font-semibold">' + row.fmt(c.sim) + '</td>').join('') +
      '</tr>',
  ).join('');

  el('variantTable').innerHTML = head + panelRow + body;
}

let chVariants: Chart | null = null;

function renderChart(variants: VariantRecord[]): void {
  const current = simulate();
  const labels = ['Старт', ...Array.from({ length: 25 }, (_, i) => i + 1)];
  const datasets = [
    {
      label: state.project || 'Текущий проект',
      data: current.cash,
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,.08)',
      fill: true,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2.5,
    },
    ...variants.map((v, i) => ({
      label: v.name,
      data: getVariantMetrics(v).cash,
      borderColor: PALETTE[(i + 1) % PALETTE.length],
      backgroundColor: 'rgba(0,0,0,0)',
      fill: false,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
    })),
  ];

  try {
    if (!chVariants) {
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.font.family = 'Manrope';
      chVariants = new Chart(el<HTMLCanvasElement>('chVariants'), {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6 } } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 13 } },
            y: { ticks: { callback: (v) => nf(Number(v) / 1000) + 'к' } },
          },
        },
      });
    } else {
      chVariants.data.datasets = datasets;
      chVariants.update();
    }
  } catch (err) {
    console.warn(err);
  }
}

export function setupVariants(): void {
  el('btnVariantAdd').addEventListener('click', () => {
    const defaultName = 'Вариант ' + (listVariants().length + 1);
    const name = prompt('Название варианта:', defaultName);
    if (name === null) return;
    if (!getActiveId()) {
      toast('Сначала создайте проект');
      return;
    }
    addVariant(name || defaultName, toPersistable());
    clearVariantCache();
    renderVariants();
    toast('Вариант сохранён: ' + (name || defaultName));
  });
}

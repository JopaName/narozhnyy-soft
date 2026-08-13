import { BATTERIES, CITIES, INVERTERS, MONTHS, PANELS } from '../core/data';
import { R } from '../core/runtime';
import { state } from '../core/state';
import { el, nf } from '../core/utils';
import { cv } from '../canvas/canvas';
import { draw } from '../canvas/renderer';
import { simulate } from '../domain/simulation';
import { getVariantMetrics } from './variants';
import { listVariants } from '../core/projects';

export function snapshot(): string {
  try {
    if (cv.width > 0) {
      /* Фото крыши и раскраска стрингов не попадают в КП */
      const wasVisible = state.bg.visible;
      const wasStrings = state.showStrings;
      if (wasVisible || wasStrings) {
        state.bg.visible = false;
        state.showStrings = false;
        draw();
      }
      const dataUrl = cv.toDataURL('image/png');
      if (wasVisible || wasStrings) {
        state.bg.visible = wasVisible;
        state.showStrings = wasStrings;
        draw();
      }
      return dataUrl;
    }
  } catch {
    /* canvas может быть tainted при внешних ресурсах */
  }
  return '';
}

export function renderProposalNumbers(): void {
  if (!R.sim) return;
  const sim = R.sim;
  const d = new Date();
  el('propDate').textContent = d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  el('propNum').textContent = 'SS-' + d.getFullYear() + '-' + String(d.getDate()).padStart(2, '0');
  el('propTitle').textContent = state.project;

  const facts: string[] = [
    '☀️ Город: <b>' + CITIES[state.city].name + '</b>',
    '🔋 Панелей: <b>' + state.panels.length + '</b> (' + nf(sim.cap, 2) + ' кВт)',
    '⚡ Выработка: <b>' + nf(sim.annualGen) + ' кВт·ч/год</b>',
    '🏠 Покрытие потребления: <b>' + nf(sim.coverage, 0) + '%</b>',
    '📐 Наклон / азимут: <b>' + state.tilt + '° / ' + state.azimuth + '°</b>',
  ];
  if (sim.shadeAvg > 0.3) facts.push('🌫 Потери от затенения: <b>' + nf(sim.shadeAvg, 1) + '% / год</b>');
  if (state.batteryEnabled) facts.push('🔌 Накопитель: <b>' + nf(sim.usable, 1) + ' кВт·ч</b>, резерв <b>' + nf(sim.backupH, 1) + ' ч</b>');
  facts.push('🌱 Снижение CO₂: <b>' + nf(sim.co2, 1) + ' т/год</b>');
  el('propFacts').innerHTML = facts.map((x) => '<li>' + x + '</li>').join('');

  const spec: [string, string][] = [
    ['Солнечный модуль', PANELS[state.panel].name + ' — ' + state.panels.length + ' шт'],
    ['Инвертор', INVERTERS[state.inverter].name],
  ];
  if (state.batteryEnabled) spec.push(['Накопитель энергии', BATTERIES[state.battery].name]);
  sim.bom.forEach((r) =>
    spec.push([r.name, nf(r.qty, 0) + ' ' + r.unit + ' × ' + nf(r.price) + ' ₽ = ' + nf(r.total) + ' ₽']),
  );
  spec.push(['Монтаж и пусконаладка', nf(sim.install) + ' ₽']);
  if (state.financing === 'loan')
    spec.push(['Финансирование', 'Кредит ' + nf(sim.fin.principal) + ' ₽, платёж ' + nf(sim.fin.monthlyPay) + ' ₽/мес × ' + sim.fin.loanMonths + ' мес']);
  el('propSpec').innerHTML = spec
    .map(
      (r) =>
        '<tr class="border-b border-slate-200"><td class="py-2 pr-4 text-slate-500">' +
        r[0] +
        '</td><td class="py-2 font-semibold text-slate-800">' +
        r[1] +
        '</td></tr>',
    )
    .join('');

  el('propGen').innerHTML = MONTHS.map(
    (m, i) =>
      '<div class="rounded-lg bg-slate-100 p-2 text-center"><div class="text-[10px] font-bold text-slate-400">' +
      m +
      '</div><div class="text-[12px] font-extrabold text-slate-800">' +
      nf(sim.gen[i]) +
      '</div></div>',
  ).join('');

  const fin =
    state.financing === 'loan'
      ? [
          ['Стоимость под ключ', nf(sim.capex) + ' ₽'],
          ['Первоначальный взнос', nf(sim.fin.ownFunds) + ' ₽'],
          ['Ежемесячный платёж', nf(sim.fin.monthlyPay) + ' ₽'],
          ['Выгода за 25 лет', nf(sim.cash[25]) + ' ₽'],
        ]
      : [
          ['Стоимость под ключ', nf(sim.capex) + ' ₽'],
          ['Экономия в год', nf(sim.saveY) + ' ₽'],
          ['Окупаемость', isFinite(sim.payback) ? nf(sim.payback, 1) + ' лет' : '—'],
          ['Выгода за 25 лет', nf(sim.cash[25]) + ' ₽'],
        ];
  el('propFin').innerHTML = fin
    .map(
      (x) =>
        '<div><div class="text-[10px] font-bold text-amber-700/70 uppercase">' +
        x[0] +
        '</div><div class="text-[15px] font-extrabold text-slate-900">' +
        x[1] +
        '</div></div>',
    )
    .join('');

  renderProposalVariants();
}

function renderProposalVariants(): void {
  const variants = listVariants();
  if (!variants.length) {
    el('propVariants').style.display = 'none';
    return;
  }
  el('propVariants').style.display = '';
  const current = simulate();
  const cols: { name: string; cap: number; panels: number; gen: number; capex: number; payback: string; profit: number }[] = [
    {
      name: state.project || 'Текущий проект',
      cap: current.cap,
      panels: state.panels.length,
      gen: current.annualGen,
      capex: current.capex,
      payback: isFinite(current.payback) ? nf(current.payback, 1) + ' лет' : '—',
      profit: current.cash[25],
    },
  ];
  variants.forEach((v) => {
    const sim = getVariantMetrics(v);
    const panels = Array.isArray((v.data as Record<string, unknown>).panels)
      ? ((v.data as Record<string, unknown>).panels as unknown[]).length
      : 0;
    cols.push({
      name: v.name,
      cap: sim.cap,
      panels,
      gen: sim.annualGen,
      capex: sim.capex,
      payback: isFinite(sim.payback) ? nf(sim.payback, 1) + ' лет' : '—',
      profit: sim.cash[25],
    });
  });

  const rows: [string, (c: (typeof cols)[number]) => string][] = [
    ['Мощность', (c) => nf(c.cap, 2) + ' кВт'],
    ['Панелей', (c) => c.panels + ' шт'],
    ['Выработка / год', (c) => nf(c.gen) + ' кВт·ч'],
    ['Стоимость', (c) => nf(c.capex) + ' ₽'],
    ['Окупаемость', (c) => c.payback],
    ['Выгода за 25 лет', (c) => nf(c.profit) + ' ₽'],
  ];

  const head =
    '<tr>' +
    '<td class="py-1.5 pr-2"></td>' +
    cols.map((c) => '<td class="py-1.5 px-2 font-extrabold text-[12px] text-slate-900">' + c.name + '</td>').join('') +
    '</tr>';
  const body = rows
    .map(
      ([label, fmt]) =>
        '<tr class="border-t border-slate-200">' +
        '<td class="py-1.5 pr-2 text-[11px] text-slate-500">' + label + '</td>' +
        cols.map((c) => '<td class="py-1.5 px-2 text-[12px] font-semibold text-slate-800">' + fmt(c) + '</td>').join('') +
        '</tr>',
    )
    .join('');
  el('propVariantsTbl').innerHTML = head + body;
}

import { BATTERIES, CITIES, INVERTERS, MONTHS, PANELS } from '../core/data';
import { R } from '../core/runtime';
import { state } from '../core/state';
import { el, nf } from '../core/utils';
import { cv } from '../canvas/canvas';
import { draw } from '../canvas/renderer';

export function snapshot(): string {
  try {
    if (cv.width > 0) {
      /* Фото крыши не попадает в КП */
      const wasVisible = state.bg.visible;
      if (wasVisible) {
        state.bg.visible = false;
        draw();
      }
      const dataUrl = cv.toDataURL('image/png');
      if (wasVisible) {
        state.bg.visible = true;
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
  spec.push(['Конструкции и крепёж', 'Анодированный алюминий, нержавеющий метиз']);
  spec.push(['Монтаж и пусконаладка', 'Включены в стоимость']);
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
}

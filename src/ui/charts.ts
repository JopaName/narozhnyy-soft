import Chart from 'chart.js/auto';
import { INVERTERS, MONTHS } from '../core/data';
import { R } from '../core/runtime';
import { state } from '../core/state';
import { el, nf, sumArr } from '../core/utils';

let chEnergy: Chart | null = null;
let chDonut: Chart | null = null;
let chCash: Chart | null = null;

export function renderEnergy(): void {
  if (!R.sim) return;
  const sim = R.sim;
  el('kGen').textContent = nf(sim.annualGen);
  el('kSpec').textContent = nf(sim.spec, 0);
  el('kCov').textContent = nf(sim.coverage, 0);
  el('kCovBat').textContent = '%' + (state.batteryEnabled ? ' · солнце+батарея: ' + nf(sim.coverageBat, 0) + '%' : '');
  el('kCo2').textContent = nf(sim.co2, 1);
  el('shadeAvg').textContent = 'среднегодовые: ' + nf(sim.shadeAvg, 1) + '%';
  const losses = state.shadeLoss || [];
  el('shadeGrid').innerHTML = MONTHS.map((m, i) => {
    const l = (losses[i] || 0) * 100;
    const cls = l < 0.5 ? 'text-slate-600' : l < 5 ? 'text-emerald-400' : l < 15 ? 'text-amber-400' : 'text-rose-400';
    return (
      '<div class="rounded-lg bg-slate-950 p-2 text-center"><div class="text-[10px] font-bold text-slate-500">' +
      m +
      '</div><div class="text-[13px] font-extrabold ' +
      cls +
      '">' +
      nf(l, 1) +
      '%</div></div>'
    );
  }).join('');
  try {
    if (!chEnergy) {
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.borderColor = 'rgba(148,163,184,.12)';
      Chart.defaults.font.family = 'Manrope';
      chEnergy = new Chart(el<HTMLCanvasElement>('chEnergy'), {
        type: 'bar',
        data: {
          labels: MONTHS,
          datasets: [
            { label: 'Выработка', data: sim.gen, backgroundColor: '#f59e0b', borderRadius: 4 },
            { label: 'Потребление', data: sim.cons, backgroundColor: '#38bdf8', borderRadius: 4 },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { labels: { usePointStyle: true, pointStyle: 'circle' } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true } },
        },
      });
      chDonut = new Chart(el<HTMLCanvasElement>('chDonut'), {
        type: 'doughnut',
        data: {
          labels: ['Прямое самопотребление', 'Заряд батареи', 'Экспорт в сеть'],
          datasets: [
            {
              data: [sumArr(sim.self), sim.batCharge, Math.max(0, sumArr(sim.exp) - sim.batCharge)],
              backgroundColor: ['#22c55e', '#2dd4bf', '#f59e0b'],
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 6 } } },
        },
      });
    } else {
      chEnergy.data.datasets[0].data = sim.gen;
      chEnergy.data.datasets[1].data = sim.cons;
      chEnergy.update();
      chDonut!.data.datasets[0].data = [sumArr(sim.self), sim.batCharge, Math.max(0, sumArr(sim.exp) - sim.batCharge)];
      chDonut!.update();
    }
  } catch (err) {
    console.warn(err);
  }
}

export function renderFinance(): void {
  if (!R.sim) return;
  const sim = R.sim;
  el('fCapex').textContent = nf(sim.capex);
  el('fSave').textContent = nf(sim.saveY);
  el('fPay').textContent = isFinite(sim.payback) ? nf(sim.payback, 1) : '—';
  el('fProfit').textContent = nf(sim.cash[25]);
  const rows: [string, number][] = [
    ['Панели (' + state.panels.length + ' шт)', sim.panelsCost],
    ['Инвертор', INVERTERS[state.inverter].price],
    ['Монтажные конструкции', sim.mount],
    ['Монтаж и пусконаладка', sim.install],
  ];
  if (state.batteryEnabled) rows.push(['Накопитель энергии', sim.batPrice]);
  el('capexList').innerHTML =
    rows
      .map(
        (r) =>
          '<div class="flex justify-between"><span class="text-slate-400">' +
          r[0] +
          '</span><b class="text-white">' +
          nf(r[1]) +
          ' ₽</b></div>',
      )
      .join('') +
    '<div class="flex justify-between pt-2 border-t border-slate-800"><span class="font-bold text-slate-200">Итого</span><b class="text-amber-400">' +
    nf(sim.capex) +
    ' ₽</b></div>';
  try {
    if (!chCash) {
      Chart.defaults.color = '#94a3b8';
      Chart.defaults.font.family = 'Manrope';
      chCash = new Chart(el<HTMLCanvasElement>('chCash'), {
        type: 'line',
        data: {
          labels: ['Старт', ...Array.from({ length: 25 }, (_, i) => i + 1)],
          datasets: [
            {
              label: 'Накопленный поток, ₽',
              data: sim.cash,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245,158,11,.12)',
              fill: true,
              tension: 0.25,
              pointRadius: 0,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 13 } },
            y: { ticks: { callback: (v) => nf(Number(v) / 1000) + 'к' } },
          },
        },
      });
    } else {
      chCash.data.datasets[0].data = sim.cash;
      chCash.update();
    }
  } catch (err) {
    console.warn(err);
  }
}

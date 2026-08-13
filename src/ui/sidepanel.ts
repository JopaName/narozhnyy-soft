import { BATTERIES, CITIES, INVERTERS, PANELS } from '../core/data';
import { commit, events, R } from '../core/runtime';
import { state } from '../core/state';
import { queueSave, flushSave } from '../core/projects';
import { azLabel, clamp, el, fmtHour, nf, toast } from '../core/utils';
import { rotateSel } from '../canvas/interactions';
import { draw } from '../canvas/renderer';
import { scheduleShading } from '../domain/solar';
import { downloadPdf } from './pdf';
import { stringCalc } from '../domain/simulation';
import { autoLayout, setTool, updateOrthUI } from './toolbar';
import { syncBgUI } from './bg';

export function bindNum(
  elInput: HTMLInputElement,
  key: keyof typeof state,
  opts: { min?: number; max?: number; norefresh?: boolean } = {},
): void {
  elInput.addEventListener('input', () => {
    const v = parseFloat(elInput.value);
    if (!isFinite(v)) return;
    (state as unknown as Record<string, unknown>)[key] = clamp(v, opts.min ?? 0, opts.max ?? 1e9);
    if (!opts.norefresh) events.refresh();
  });
  elInput.addEventListener('change', () => {
    elInput.value = String(state[key]);
  });
}

export function syncInputs(): void {
  el<HTMLInputElement>('inGap').value = String(state.gap);
  el<HTMLInputElement>('inMargin').value = String(state.margin);
  el('btnPort').className =
    'text-[12px] font-bold py-1.5 rounded-lg ' + (state.orientation === 'portrait' ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400');
  el('btnLand').className =
    'text-[12px] font-bold py-1.5 rounded-lg ' + (state.orientation === 'landscape' ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400');
  el<HTMLSelectElement>('selPanel').value = String(state.panel);
  el<HTMLSelectElement>('selInv').value = String(state.inverter);
  el<HTMLSelectElement>('selCity').value = state.city;
  el<HTMLInputElement>('inTilt').value = String(state.tilt);
  el('valTilt').textContent = state.tilt + '°';
  el<HTMLInputElement>('inAz').value = String(state.azimuth);
  el('valAz').textContent = azLabel(state.azimuth);
  el<HTMLInputElement>('inCons').value = String(state.consumption);
  el<HTMLInputElement>('inSelf').value = String(state.selfUse);
  el('valSelf').textContent = state.selfUse + '%';
  el<HTMLInputElement>('inTariff').value = String(state.tariff);
  el<HTMLInputElement>('inExport').value = String(state.exportRate);
  el<HTMLInputElement>('inProject').value = state.project;
  el<HTMLInputElement>('chkBat').checked = state.batteryEnabled;
  el<HTMLSelectElement>('selBat').value = String(state.battery);
  el<HTMLInputElement>('inReserve').value = String(state.reserve);
  el('valReserve').textContent = state.reserve + '%';
  el<HTMLInputElement>('inDown').value = String(state.down);
  el<HTMLInputElement>('inRate').value = String(state.rate);
  el<HTMLInputElement>('inTerm').value = String(state.termMonths);
  el<HTMLInputElement>('chkShade').checked = state.showShadows;
  el<HTMLSelectElement>('selShadeMonth').value = String(state.shadeMonth);
  el<HTMLInputElement>('rngHour').value = String(state.shadeHour);
  el('lblHour').textContent = fmtHour(state.shadeHour);
  el<HTMLInputElement>('inAngle').value = String(state.arrayAngle);
  el('valAngle').textContent = state.arrayAngle + '°';
  el<HTMLInputElement>('chkStrings').checked = state.showStrings;
  el<HTMLInputElement>('chkShadeMap').checked = state.showShadeMap;
  el<HTMLInputElement>('chkGrid').checked = state.showGrid;
  el<HTMLInputElement>('chkDims').checked = state.showDims;
  el<HTMLInputElement>('chkObstacles').checked = state.showObstacles;
  updateOrthUI();
  syncBgUI();
}

let loadSampleHook: (() => void) | null = null;
export function setLoadSampleHook(fn: () => void): void {
  loadSampleHook = fn;
}

export function bindInputs(): void {
  el<HTMLSelectElement>('selPanel').onchange = (e) => {
    state.panel = +(e.target as HTMLSelectElement).value;
    events.refresh();
  };
  el<HTMLSelectElement>('selInv').onchange = (e) => {
    state.inverter = +(e.target as HTMLSelectElement).value;
    events.refresh();
  };
  el<HTMLSelectElement>('selCity').onchange = (e) => {
    state.city = (e.target as HTMLSelectElement).value;
    state.tilt = Math.round(CITIES[state.city].lat);
    syncInputs();
    scheduleShading();
    events.refresh();
  };
  el('inTilt').addEventListener('input', (e) => {
    state.tilt = +(e.target as HTMLInputElement).value;
    el('valTilt').textContent = state.tilt + '°';
    events.refresh();
  });
  el('inTilt').addEventListener('change', () => commit());
  el('inAz').addEventListener('input', (e) => {
    state.azimuth = +(e.target as HTMLInputElement).value;
    el('valAz').textContent = azLabel(state.azimuth);
    events.refresh();
  });
  el('inAz').addEventListener('change', () => commit());
  el('inSelf').addEventListener('input', (e) => {
    state.selfUse = +(e.target as HTMLInputElement).value;
    el('valSelf').textContent = state.selfUse + '%';
    events.refresh();
  });
  el('inReserve').addEventListener('input', (e) => {
    state.reserve = +(e.target as HTMLInputElement).value;
    el('valReserve').textContent = state.reserve + '%';
    events.refresh();
  });
  el<HTMLInputElement>('chkShade').onchange = (e) => {
    state.showShadows = (e.target as HTMLInputElement).checked;
    draw();
  };
  el<HTMLInputElement>('chkShadeMap').onchange = (e) => {
    state.showShadeMap = (e.target as HTMLInputElement).checked;
    flushSave();
    draw();
  };
  el<HTMLInputElement>('chkGrid').onchange = (e) => {
    state.showGrid = (e.target as HTMLInputElement).checked;
    flushSave();
    draw();
  };
  el<HTMLInputElement>('chkDims').onchange = (e) => {
    state.showDims = (e.target as HTMLInputElement).checked;
    flushSave();
    draw();
  };
  el<HTMLInputElement>('chkObstacles').onchange = (e) => {
    state.showObstacles = (e.target as HTMLInputElement).checked;
    flushSave();
    draw();
  };
  el<HTMLInputElement>('chkStrings').onchange = (e) => {
    state.showStrings = (e.target as HTMLInputElement).checked;
    flushSave();
    draw();
  };
  el('inAngle').addEventListener('input', (e) => {
    state.arrayAngle = +(e.target as HTMLInputElement).value;
    el('valAngle').textContent = state.arrayAngle + '°';
    draw();
  });
  el('inAngle').addEventListener('change', () => {
    autoLayout();
    flushSave();
  });
  el<HTMLInputElement>('chkOrth').onchange = (e) => {
    state.orth = (e.target as HTMLInputElement).checked;
    updateOrthUI();
    queueSave();
  };
  el<HTMLSelectElement>('selShadeMonth').onchange = (e) => {
    state.shadeMonth = +(e.target as HTMLSelectElement).value;
    draw();
    events.refresh();
  };
  el('rngHour').addEventListener('input', (e) => {
    state.shadeHour = +(e.target as HTMLInputElement).value;
    el('lblHour').textContent = fmtHour(state.shadeHour);
    draw();
  });
  el('inObZ').addEventListener('input', (e) => {
    if (R.sel && R.sel.type === 'obstacle' && state.obstacles[R.sel.i]) {
      const v = parseFloat((e.target as HTMLInputElement).value);
      if (isFinite(v)) state.obstacles[R.sel.i].z = clamp(v, 0, 15);
      draw();
      scheduleShading();
    }
  });
  el('inObZ').addEventListener('change', () => commit());
  bindNum(el('inCons'), 'consumption', { min: 0, max: 1e6 });
  bindNum(el('inTariff'), 'tariff', { min: 0, max: 1e4 });
  bindNum(el('inExport'), 'exportRate', { min: 0, max: 1e4 });
  bindNum(el('inGap'), 'gap', { min: 0, max: 2, norefresh: true });
  bindNum(el('inMargin'), 'margin', { min: 0, max: 3, norefresh: true });
  bindNum(el('inDown'), 'down', { min: 0, max: 100 });
  bindNum(el('inRate'), 'rate', { min: 0, max: 50 });
  bindNum(el('inTerm'), 'termMonths', { min: 6, max: 300 });
  el('inProject').addEventListener('input', (e) => {
    state.project = (e.target as HTMLInputElement).value.slice(0, 80);
  });
  el('inProject').addEventListener('change', () => queueSave());
  el<HTMLInputElement>('chkBat').onchange = (e) => {
    state.batteryEnabled = (e.target as HTMLInputElement).checked;
    events.refresh();
  };
  el<HTMLSelectElement>('selBat').onchange = (e) => {
    state.battery = +(e.target as HTMLSelectElement).value;
    events.refresh();
  };
  el('btnCash').onclick = () => {
    state.financing = 'cash';
    events.refresh();
  };
  el('btnLoan').onclick = () => {
    state.financing = 'loan';
    events.refresh();
  };
  el('btnPort').onclick = () => {
    state.orientation = 'portrait';
    syncInputs();
    queueSave();
  };
  el('btnLand').onclick = () => {
    state.orientation = 'landscape';
    syncInputs();
    queueSave();
  };
  el('btnAuto').onclick = () => autoLayout();
  el('btnRotateSel').onclick = () => rotateSel();
  el('btnClearPanels').onclick = () => {
    if (!state.panels.length) return;
    state.panels = [];
    R.sel = null;
    commit();
    events.refresh();
    draw();
    toast('Панели удалены');
  };
  el('btnReset').onclick = () => {
    if (confirm('Сбросить весь проект?')) {
      state.roof = [];
      state.panels = [];
      state.obstacles = [];
      state.tempRoof = [];
      R.sel = null;
      commit();
      events.refresh();
      draw();
    }
  };
  el('btnSample').onclick = () => loadSampleHook?.();
  el('esSample').onclick = () => loadSampleHook?.();
  el('esDraw').onclick = () => setTool('roof');
  el('btnPrint').onclick = () => window.print();
  el('btnPdf').onclick = () => {
    downloadPdf((state.project || 'КП').replace(/[^\wа-яёА-ЯЁ-]+/gi, '_') + '.pdf');
  };
}

export function renderBattery(): void {
  const inv = INVERTERS[state.inverter];
  const bat = BATTERIES[state.battery];
  const on = state.batteryEnabled;
  if (!R.sim) return;
  el('batStats').innerHTML = on
    ? [
        ['Номинальная ёмкость', nf(bat.cap, 2) + ' кВт·ч'],
        ['Полезная (с учётом резерва)', nf(R.sim.usable, 2) + ' кВт·ч'],
        ['Энергия батареи за год', nf(R.sim.batOut) + ' кВт·ч'],
        ['Резерв при отключении сети', nf(R.sim.backupH, 1) + ' ч'],
        ['Стоимость', nf(bat.price) + ' ₽'],
      ]
        .map(
          (r) =>
            '<div class="flex justify-between"><span class="text-slate-400">' +
            r[0] +
            '</span><b class="text-white">' +
            r[1] +
            '</b></div>',
        )
        .join('')
    : '<div class="text-slate-500">Накопитель выключен. Включите, чтобы добавить резервное питание и вечернее самопотребление.</div>';
  el('batWarn').innerHTML = on && !inv.hybrid
    ? '<span class="text-amber-400">⚠ Для батареи нужен гибридный инвертор — выберите Deye SUN-8K</span>'
    : on
      ? '<span class="text-emerald-400">✓ Совместимо с выбранным инвертором</span>'
      : '';
  el<HTMLSelectElement>('selBat').disabled = !on;
  el<HTMLInputElement>('inReserve').disabled = !on;
  el<HTMLSelectElement>('selBat').className = 'inp mb-4' + (on ? '' : ' opacity-50');
  el('inReserve').className = 'w-full' + (on ? '' : ' opacity-50');
}

export function renderStrings(): void {
  const sc = stringCalc();
  if (!sc) {
    el('stringInfo').innerHTML = '<div class="text-slate-500">Добавьте панели на схеме, чтобы рассчитать стринги.</div>';
    el('stringIssues').innerHTML = '';
    return;
  }
  el('stringInfo').innerHTML = [
    ['Панелей в массиве', sc.N + ' шт'],
    ['Панелей в стринге', sc.per + ' <span class="text-slate-500">(допустимо ' + sc.minPer + '–' + sc.maxPer + ')</span>'],
    ['Стрингов', String(sc.strings)],
    ['Занято MPPT', sc.usedMppt + ' из ' + sc.inv.mppt],
    ['Стрингов на MPPT', String(sc.spm)],
    ['Ток стринга / лимит', sc.md.Imp + ' А / ' + sc.inv.imax + ' А'],
    ['Диапазон напряжения MPPT', sc.inv.vmin + '–' + sc.inv.vmax + ' В'],
  ]
    .map(
      (r) =>
        '<div class="flex justify-between"><span class="text-slate-400">' +
        r[0] +
        '</span><b class="text-white">' +
        r[1] +
        '</b></div>',
    )
    .join('');
  const issues: [string, string][] = [];
  if (!sc.curOK) issues.push(['rose', '✕ Ток панели превышает лимит входа MPPT — возьмите инвертор с большим током']);
  if (sc.strings < sc.inv.mppt) issues.push(['amber', '⚠ Стрингов меньше, чем MPPT: часть трекеров будет пустовать']);
  if (sc.spm > 3) issues.push(['amber', '⚠ Более 3 стрингов на MPPT — проверьте токи параллельных цепей']);
  if (!issues.length) issues.push(['emerald', '✓ Конфигурация стрингов корректна']);
  el('stringIssues').innerHTML = issues
    .map((i) => '<div class="text-[12px] font-semibold text-' + i[0] + '-400">' + i[1] + '</div>')
    .join('');
}

export function renderLoan(): void {
  if (!R.sim) return;
  const isLoan = state.financing === 'loan';
  el('btnCash').className = 'text-[12px] font-bold py-1.5 rounded-lg ' + (!isLoan ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400');
  el('btnLoan').className = 'text-[12px] font-bold py-1.5 rounded-lg ' + (isLoan ? 'bg-amber-500/15 text-amber-400' : 'text-slate-400');
  el('loanInputs').classList.toggle('hidden', !isLoan);
  if (!isLoan) {
    el('loanOut').innerHTML =
      '<div class="py-2 text-slate-400">Покупка без кредита: полная оплата ' + nf(R.sim.capex) + ' ₽. Экономия начинает окупать вложения сразу.</div>';
    return;
  }
  const f = R.sim.fin;
  el('loanOut').innerHTML = [
    ['Сумма кредита', nf(f.principal) + ' ₽'],
    ['Собственные средства (взнос)', nf(f.ownFunds) + ' ₽'],
    ['Ежемесячный платёж', nf(f.monthlyPay) + ' ₽'],
    ['Переплата за срок', nf(f.overpay) + ' ₽'],
    ['Средняя экономия в месяц', nf(R.sim.saveY / 12) + ' ₽'],
    ['Выйдет в плюс', f.positiveMonth ? 'через ' + f.positiveMonth + ' мес' : 'после погашения кредита'],
  ]
    .map(
      (r) =>
        '<div class="flex justify-between py-2"><span class="text-slate-400">' +
        r[0] +
        '</span><b class="text-white">' +
        r[1] +
        '</b></div>',
    )
    .join('');
}

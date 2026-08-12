import { MONTHS, PANELS } from '../core/data';
import { commit, events, R } from '../core/runtime';
import { loadLocal, queueSave, sanitize, state, toPersistable } from '../core/state';
import { clamp, el, nf, toast } from '../core/utils';
import { polyArea } from '../domain/geometry';
import { computeShading } from '../domain/solar';
import { simulate } from '../domain/simulation';
import { fitView } from '../canvas/view';
import { resizeCanvas } from '../canvas/canvas';
import { draw } from '../canvas/renderer';
import { renderEnergy, renderFinance } from './charts';
import { renderProposalNumbers, snapshot } from './proposal';
import { renderBattery, renderLoan, renderStrings, setLoadSampleHook, syncInputs } from './sidepanel';
import { autoLayout } from './toolbar';

let heavyQueued = false;

export function refresh(): void {
  R.sim = simulate();
  const sim = R.sim;
  el('stCount').textContent = String(state.panels.length);
  el('stCap').textContent = nf(sim.cap, 2) + ' кВт';
  el('stRoofArea').textContent = nf(polyArea(state.roof), 1) + ' м²';
  const ra = polyArea(state.roof);
  el('stUsed').textContent = nf(ra > 0 ? (sumPanelsArea() / ra) * 100 : 0, 0) + '%';
  const ld = clamp(sim.load, 0, 150);
  el('invBar').style.width = Math.min(100, ld / 1.5) + '%';
  el('invBar').className =
    'h-full rounded-full transition-all ' + (sim.load > 140 || (sim.load < 40 && sim.cap > 0) ? 'bg-rose-500' : sim.load > 120 ? 'bg-amber-500' : 'bg-emerald-500');
  el('invBarTxt').textContent = nf(sim.load, 0) + '%';
  const md = PANELS[state.panel];
  el('panelInfo').innerHTML =
    'Модуль: ' + nf(md.w, 2) + ' × ' + nf(md.h, 2) + ' м · ' + md.p * 1000 + ' Вт<br>Цена: ' + nf(md.price) + ' ₽/шт · Vmp ' + md.Vmp + ' В, Voc ' + md.Voc + ' В';
  el('invLoad2').textContent = nf(sim.load, 0) + '%';
  el('invLoadBar2').style.width = Math.min(100, sim.load / 1.5) + '%';
  el('invLoadBar2').className =
    'h-full ' + (sim.load > 140 || (sim.load < 40 && sim.cap > 0) ? 'bg-rose-500' : sim.load > 120 ? 'bg-amber-500' : 'bg-emerald-500');
  el('invWarn').textContent =
    sim.cap === 0
      ? 'Добавьте панели на схеме'
      : sim.load < 40
        ? 'Инвертор сильно недогружен'
        : sim.load > 140
          ? 'Перегрузка DC — возьмите инвертор мощнее'
          : '✓ Соотношение DC/AC в норме';
  el('sysCap').textContent = nf(sim.cap, 2) + ' кВт';
  el('sysGen').textContent = nf(sim.annualGen) + ' кВт·ч';
  el('sysCov').textContent = nf(sim.coverage, 0) + '%';
  el('sysPay').textContent = isFinite(sim.payback) ? nf(sim.payback, 1) + ' лет' : '—';
  const mLoss = (state.shadeLoss[state.shadeMonth] || 0) * 100;
  el('shadeInfo').innerHTML =
    'Потери от теней: <b class="text-white">' + nf(sim.shadeAvg, 1) + '% / год</b> · ' + MONTHS[state.shadeMonth] + ': <b class="text-white">' + nf(mLoss, 1) + '%</b>';
  const obSel = R.sel && R.sel.type === 'obstacle' ? state.obstacles[R.sel.i] : null;
  el('obZRow').classList.toggle('hidden', !obSel);
  if (obSel && document.activeElement !== el('inObZ')) el<HTMLInputElement>('inObZ').value = String(obSel.z || 1);
  renderBattery();
  renderStrings();
  renderLoan();
  if (!heavyQueued) {
    heavyQueued = true;
    requestAnimationFrame(() => {
      heavyQueued = false;
      try {
        if (R.activeTab === 'energy') renderEnergy();
        if (R.activeTab === 'finance') renderFinance();
        if (R.activeTab === 'proposal') renderProposalNumbers();
      } catch (err) {
        console.warn(err);
      }
    });
  }
  queueSave();
}

function sumPanelsArea(): number {
  return state.panels.reduce((a, p) => a + p.w * p.h, 0);
}

/* ═══ ВКЛАДКИ ═══ */
export function bindTabs(): void {
  document.querySelectorAll('.tab').forEach((b) => {
    b.addEventListener('click', () => {
      const elTab = b as HTMLElement;
      R.activeTab = elTab.dataset.tab || 'scheme';
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
      ['scheme', 'system', 'energy', 'finance', 'proposal'].forEach((v) => {
        el('view-' + v).hidden = v !== R.activeTab;
      });
      if (R.activeTab === 'scheme') requestAnimationFrame(() => {
        resizeCanvas();
        draw();
      });
      if (R.activeTab === 'proposal') {
        renderProposalNumbers();
        const s = snapshot();
        if (s) el('propSnap').setAttribute('src', s);
      }
      refresh();
    });
  });
}

/* ═══ СОХРАНЕНИЕ / ЗАГРУЗКА ═══ */
export function bindProjectIO(): void {
  el('btnSave').onclick = () => {
    try {
      const blob = new Blob([JSON.stringify(toPersistable(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (state.project || 'solar-project').replace(/[^\wа-яёА-ЯЁ-]+/gi, '_') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      toast('Проект сохранён в файл');
    } catch {
      toast('Ошибка сохранения');
    }
  };
  el('btnOpen').onclick = () => el<HTMLInputElement>('fileOpen').click();
  el<HTMLInputElement>('fileOpen').onchange = (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        loadFrom(JSON.parse(r.result as string) as Record<string, unknown>);
        toast('Проект открыт');
      } catch {
        toast('Не удалось прочитать файл');
      }
    };
    r.onerror = () => toast('Ошибка чтения файла');
    r.readAsText(f);
    (e.target as HTMLInputElement).value = '';
  };
}

export function loadFrom(obj: Record<string, unknown>): void {
  Object.assign(state, sanitize(obj));
  state.tempRoof = [];
  R.sel = null;
  syncInputs();
  computeShading();
  refresh();
  fitView();
  commit();
}

export function loadSample(): void {
  state.roof = [
    { x: 2, y: 2 },
    { x: 18, y: 2 },
    { x: 18, y: 10 },
    { x: 11, y: 10 },
    { x: 11, y: 15 },
    { x: 2, y: 15 },
  ];
  state.obstacles = [
    { x: 4, y: 4, w: 1, h: 1, z: 2 },
    { x: 13.5, y: 4, w: 1.2, h: 0.8, z: 2.5 },
  ];
  state.orientation = 'landscape';
  state.gap = 0.05;
  state.margin = 0.4;
  state.inverter = 1;
  state.batteryEnabled = true;
  state.battery = 1;
  state.financing = 'loan';
  state.showShadows = true;
  state.shadeHour = 10.5;
  state.orth = true;
  state.tempRoof = [];
  R.sel = null;
  syncInputs();
  autoLayout();
  fitView();
  toast('Пример проекта загружен ✨');
}

export function restoreOrSample(): void {
  const saved = loadLocal();
  if (saved && Array.isArray(saved.roof) && (saved.roof as unknown[]).length >= 3) {
    loadFrom(saved);
    toast('Проект восстановлен из автосохранения');
  } else {
    loadSample();
  }
}

import { BATTERIES, CITIES, DAYS, INVERTERS, PANELS, SEASON } from '../core/data';
import { state } from '../core/state';
import type { AppState, StringCalcResult } from '../core/types';
import { clamp, num0, sumArr } from '../core/utils';

export function resolveState(overrides?: Partial<AppState>): AppState {
  return { ...state, ...(overrides ?? {}) } as AppState;
}

export function stringCalc(overrides?: Partial<AppState>): StringCalcResult | null {
  const s = resolveState(overrides);
  const N = s.panels.length;
  const md = PANELS[s.panel];
  const inv = INVERTERS[s.inverter];
  if (!N) return null;
  const hotVmp = md.Vmp * 0.88;
  const coldVoc = md.Voc * 1.12;
  const minPer = Math.max(1, Math.ceil(inv.vmin / hotVmp));
  const maxPer = Math.max(minPer, Math.floor(inv.vmax / coldVoc));
  const per = clamp(Math.round((minPer + maxPer) / 2), minPer, maxPer);
  const strings = Math.ceil(N / per);
  return {
    N,
    md,
    inv,
    minPer,
    maxPer,
    per,
    strings,
    usedMppt: Math.min(strings, inv.mppt),
    spm: Math.ceil(strings / inv.mppt),
    curOK: md.Imp <= inv.imax,
  };
}

export function simulate(overrides?: Partial<AppState>) {
  const s = resolveState(overrides);
  const city = CITIES[s.city] || CITIES.krasnodar;
  const md = PANELS[s.panel] || PANELS[0];
  const inv = INVERTERS[s.inverter] || INVERTERS[0];
  const cons0 = Math.max(0, num0(s.consumption));
  const tariff = Math.max(0, num0(s.tariff));
  const expRate = Math.max(0, num0(s.exportRate));
  const cap = s.panels.length * md.p;
  const tf = Math.max(0.6, 1 - 0.006 * Math.abs(num0(s.tilt) - city.lat));
  const af = Math.max(0.6, 1 - 0.0022 * Math.abs(num0(s.azimuth) - 180));
  const K = 0.78 * tf * af;
  const lossArr = Array.isArray(s.shadeLoss) ? s.shadeLoss : [];
  const gen = city.ghi.map((g, i) => cap * g * 30.4 * K * (1 - clamp(lossArr[i] || 0, 0, 0.95)));
  const annualGen = sumArr(gen);
  const sSum = sumArr(SEASON) || 1;
  const cons = SEASON.map((c) => (cons0 * 12) / sSum * c);
  const annualCons = sumArr(cons);
  const su = clamp(num0(s.selfUse), 0, 100) / 100;
  const self = gen.map((g, i) => Math.min(g * su, cons[i]));
  const exp = gen.map((g, i) => Math.max(0, g - self[i]));

  let batCharge = 0;
  let batOut = 0;
  let usable = 0;
  let backupH = 0;
  let batPrice = 0;
  if (s.batteryEnabled) {
    const bat = BATTERIES[s.battery] || BATTERIES[0];
    batPrice = bat.price;
    usable = bat.cap * (1 - clamp(num0(s.reserve), 0, 90) / 100);
    let tot = 0;
    gen.forEach((g, i) => {
      const exd = Math.max(0, g - cons[i]) / DAYS[i];
      tot += Math.min(exd, usable) * DAYS[i];
    });
    batCharge = tot;
    batOut = tot * 0.92;
    const avgKw = cons0 / 720;
    backupH = avgKw > 0 ? usable / avgKw : 0;
  }

  const exportNet = Math.max(0, sumArr(exp) - batCharge);
  const saveY = sumArr(self) * tariff + exportNet * expRate + batOut * tariff;
  const mount = cap * 6500;
  const install = cap * 14000;
  const panelsCost = s.panels.length * md.price;
  const capex = panelsCost + inv.price + mount + install + batPrice;

  const fin = {
    monthlyPay: 0,
    principal: 0,
    ownFunds: capex,
    overpay: 0,
    loanMonths: 0,
    positiveMonth: null as number | null,
  };
  if (s.financing === 'loan' && capex > 0) {
    const down = clamp(num0(s.down), 0, 100) / 100;
    fin.principal = capex * (1 - down);
    fin.ownFunds = capex - fin.principal;
    const n = clamp(Math.round(num0(s.termMonths)), 6, 300);
    fin.loanMonths = n;
    const r = Math.max(0, num0(s.rate)) / 100 / 12;
    fin.monthlyPay = r > 0 ? (fin.principal * r) / (1 - Math.pow(1 + r, -n)) : fin.principal / n;
    fin.overpay = fin.monthlyPay * n - fin.principal;
    let c = 0;
    const mSave = saveY / 12;
    for (let m = 1; m <= n + 300; m++) {
      c += mSave - (m <= n ? fin.monthlyPay : 0);
      if (c >= 0) {
        fin.positiveMonth = m;
        break;
      }
    }
  }

  const cash: number[] = [-fin.ownFunds];
  for (let y = 1; y <= 25; y++) {
    const mInY = clamp(fin.loanMonths - 12 * (y - 1), 0, 12);
    cash.push(cash[cash.length - 1] + saveY * Math.pow(1.05, y - 1) * Math.pow(0.995, y - 1) - fin.monthlyPay * mInY);
  }

  const shadeAvg = s.panels.length ? (sumArr(lossArr) / 12) * 100 : 0;
  const annualSelf = sumArr(self);

  return {
    cap,
    gen,
    cons,
    annualGen,
    annualCons,
    self,
    exp,
    saveY,
    panelsCost,
    mount,
    install,
    batPrice,
    capex,
    cash,
    fin,
    batCharge,
    batOut,
    usable,
    backupH,
    shadeAvg,
    payback: saveY > 1 ? fin.ownFunds / saveY : Infinity,
    coverage: annualCons > 0 ? (annualGen / annualCons) * 100 : 0,
    coverageBat: annualCons > 0 ? Math.min(100, ((annualSelf + batOut) / annualCons) * 100) : 0,
    load: inv.p > 0 ? (cap / inv.p) * 100 : 0,
    spec: cap > 0 ? annualGen / cap : 0,
    co2: (annualGen * 0.45) / 1000,
  };
}

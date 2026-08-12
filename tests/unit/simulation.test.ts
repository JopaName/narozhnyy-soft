import { beforeEach, describe, expect, it } from 'vitest';
import { state } from '../../src/core/state';
import { simulate, stringCalc } from '../../src/domain/simulation';
import { defaultState } from './_setup';

beforeEach(() => Object.assign(state, structuredClone(defaultState)));

describe('stringCalc', () => {
  it('без панелей — null', () => {
    state.panels = [];
    expect(stringCalc()).toBeNull();
  });

  it('10 панелей JA Solar + Huawei 10KTL', () => {
    state.panel = 0; /* JA Solar 410 */
    state.inverter = 2; /* Huawei 10KTL */
    /* 10 панелей внутри крыши */
    state.roof = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    for (let i = 0; i < 10; i++) {
      state.panels.push({ x: i * 1.8, y: 1, w: 1.134, h: 1.722 });
    }
    const sc = stringCalc()!;
    expect(sc).not.toBeNull();
    expect(sc.N).toBe(10);
    /* hotVmp = 31.5*0.88 = 27.72, vmin=200 -> minPer = ceil(7.22) = 8 */
    expect(sc.minPer).toBeGreaterThanOrEqual(7);
    /* per в допустимом диапазоне */
    expect(sc.per).toBeGreaterThanOrEqual(sc.minPer);
    expect(sc.per).toBeLessThanOrEqual(sc.maxPer);
    /* стрингов >= 1 */
    expect(sc.strings).toBeGreaterThanOrEqual(1);
    /* MPPT использовано не больше доступных */
    expect(sc.usedMppt).toBeLessThanOrEqual(sc.inv.mppt);
  });

  it('50 панелей — несколько стрингов', () => {
    state.panel = 2; /* Trina 550 */
    state.inverter = 3; /* Sungrow 15RT */
    state.roof = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 30 },
      { x: 0, y: 30 },
    ];
    for (let i = 0; i < 50; i++) {
      state.panels.push({ x: i * 2.4, y: 1, w: 2.279, h: 1.134 });
    }
    const sc = stringCalc()!;
    expect(sc.N).toBe(50);
    expect(sc.strings).toBeGreaterThan(1);
  });

  it('проверка совместимости тока', () => {
    state.panel = 4; /* Risen Titan 670: Imp 16.7, Isc 17.6 */
    state.inverter = 0; /* Huawei 5KTL: imax 12.5 */
    state.roof = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    state.panels = [{ x: 1, y: 1, w: 2.465, h: 1.303 }];
    const sc = stringCalc()!;
    /* Ток панели 16.7 > 12.5 лимита инвертора */
    expect(sc.curOK).toBe(false);
  });
});

describe('simulate', () => {
  it('без панелей — cap = 0, выработка = 0', () => {
    const sim = simulate();
    expect(sim.cap).toBe(0);
    expect(sim.annualGen).toBe(0);
    expect(sim.saveY).toBe(0);
    expect(sim.capex).toBeGreaterThan(0); /* инвертор + монтаж */
  });

  it('с панелями — мощность > 0, выработка > 0', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
      { x: 5, y: 1, w: 1.134, h: 1.722 },
    ];
    const sim = simulate();
    expect(sim.cap).toBeCloseTo(3 * 0.45, 2); /* 3 × Longi 450 = 1.35 kW */
    expect(sim.annualGen).toBeGreaterThan(0);
    expect(sim.annualGen).toBeLessThan(5000);
    /* 12 месяцев */
    expect(sim.gen).toHaveLength(12);
    expect(sim.cons).toHaveLength(12);
    /* летом выработка выше */
    expect(sim.gen[5]).toBeGreaterThan(sim.gen[11]);
    /* покрытие */
    expect(sim.coverage).toBeGreaterThan(0);
    expect(sim.coverage).toBeLessThan(1000);
    /* окупаемость: CAPEX > 0, saveY > 0 */
    expect(sim.capex).toBeGreaterThan(0);
    expect(sim.saveY).toBeGreaterThan(0);
    expect(sim.payback).toBeGreaterThan(0);
    expect(sim.payback).toBeLessThan(100);
    /* нагрузка инвертора */
    expect(sim.load).toBeGreaterThan(0);
    expect(sim.load).toBeLessThan(200);
    /* CO2 */
    expect(sim.co2).toBeGreaterThan(0);
    /* cash: 26 точек (0..25 лет) */
    expect(sim.cash).toHaveLength(26);
  });

  it('Краснодар даёт больше выработки, чем Москва', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [{ x: 1, y: 1, w: 1.134, h: 1.722 }];

    state.city = 'krasnodar';
    const kr = simulate();
    state.city = 'moscow';
    const ms = simulate();

    expect(kr.annualGen).toBeGreaterThan(ms.annualGen);
  });

  it('наклон и азимут влияют на выработку', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];

    state.tilt = 45;
    state.azimuth = 180;
    const optimal = simulate();

    state.tilt = 90; /* вертикально */
    const vertical = simulate();

    expect(optimal.annualGen).toBeGreaterThan(vertical.annualGen);
  });

  it('зелёный тариф и самопотребление', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];
    state.selfUse = 100;
    state.exportRate = 10;
    const sim = simulate();
    /* exp — массив экспорта, при selfUse=100 должно быть почти всё самопотребление */
    expect(sim.self).toHaveLength(12);
    expect(sim.saveY).toBeGreaterThan(0);
  });

  it('с батареей — batCharge > 0, usable > 0', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];
    state.batteryEnabled = true;
    state.battery = 0; /* Pylontech 4.8 kWh */
    const sim = simulate();
    /* с батареей batPrice > 0, usable > 0 */
    expect(sim.usable).toBeGreaterThan(0);
    expect(sim.batPrice).toBeGreaterThan(0);
    /* coverageBat — валидное число от 0 до 100 */
    expect(sim.coverageBat).toBeGreaterThanOrEqual(0);
    expect(sim.coverageBat).toBeLessThanOrEqual(100);
  });

  it('большая система с батареей — прирост покрытия', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 40, y: 0 },
      { x: 40, y: 20 },
      { x: 0, y: 20 },
    ];
    state.consumption = 300; /* низкое потребление */
    /* много панелей → избыток генерации */
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        state.panels.push({ x: 1 + c * 2.5, y: 1 + r * 1.3, w: 2.094, h: 1.134 });
      }
    } /* 40 панелей Longi 450 → 18 kW */
    state.batteryEnabled = true;
    state.battery = 3; /* BYD HVS 7.7 kWh */
    state.selfUse = 40;
    const sim = simulate();
    expect(sim.batCharge).toBeGreaterThan(0);
    expect(sim.batOut).toBeGreaterThan(0);
    /* coverageBat закэпирован в 100, но батарея добавляет энергию */
    expect(sim.coverageBat).toBeLessThanOrEqual(100);
    expect(sim.coverageBat).toBeGreaterThan(0);
  });

  it('кредит: ежемесячный платёж > 0', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];
    state.financing = 'loan';
    state.down = 30;
    state.rate = 18;
    state.termMonths = 60;
    const sim = simulate();
    expect(sim.fin.principal).toBeGreaterThan(0);
    expect(sim.fin.monthlyPay).toBeGreaterThan(0);
    expect(sim.fin.ownFunds).toBeGreaterThan(0);
    expect(sim.fin.overpay).toBeGreaterThan(0);
    /* cash[0] отрицательный = -ownFunds */
    expect(sim.cash[0]).toBeLessThan(0);
  });

  it('без кредита: ownFunds = capex, monthlyPay = 0', () => {
    state.financing = 'cash';
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];
    const sim = simulate();
    expect(sim.fin.monthlyPay).toBe(0);
    expect(sim.fin.ownFunds).toBe(sim.capex);
  });

  it('shadeLoss влияет на выработку', () => {
    state.roof = [
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 8 },
      { x: 0, y: 8 },
    ];
    state.panels = [
      { x: 1, y: 1, w: 1.134, h: 1.722 },
      { x: 3, y: 1, w: 1.134, h: 1.722 },
    ];
    state.shadeLoss = new Array(12).fill(0);
    const clean = simulate();
    state.shadeLoss = new Array(12).fill(0.5); /* 50% потери */
    const shaded = simulate();
    expect(shaded.annualGen).toBeLessThan(clean.annualGen);
    expect(shaded.annualGen).toBeCloseTo(clean.annualGen * 0.5, -1); /* грубо */
  });
});

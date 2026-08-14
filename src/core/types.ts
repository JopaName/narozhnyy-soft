export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Obstacle extends Rect {
  z: number;
}

export interface PanelRect extends Rect {
  /** Индивидуальный поворот панели относительно массива, градусы */
  a?: number;
}

export type Tool = 'select' | 'roof' | 'panel' | 'row' | 'obstacle' | 'erase' | 'hand';
export type Orientation = 'portrait' | 'landscape';
export type Financing = 'cash' | 'loan';

export interface CityData {
  name: string;
  lat: number;
  ghi: number[];
}

export interface PanelData {
  name: string;
  w: number;
  h: number;
  p: number;
  price: number;
  Vmp: number;
  Voc: number;
  Imp: number;
  Isc: number;
}

export interface InverterData {
  name: string;
  p: number;
  price: number;
  vmin: number;
  vmax: number;
  mppt: number;
  imax: number;
  hybrid: boolean;
}

export interface BatteryData {
  name: string;
  cap: number;
  price: number;
}

export interface AppState {
  tool: Tool;
  city: string;
  panel: number;
  inverter: number;
  orientation: Orientation;
  gap: number;
  margin: number;
  tilt: number;
  azimuth: number;
  consumption: number;
  selfUse: number;
  tariff: number;
  exportRate: number;
  project: string;
  batteryEnabled: boolean;
  battery: number;
  reserve: number;
  financing: Financing;
  down: number;
  rate: number;
  termMonths: number;
  showShadows: boolean;
  shadeMonth: number;
  shadeHour: number;
  shadeLoss: number[];
  orth: boolean;
  roof: Point[];
  panels: PanelRect[];
  obstacles: Obstacle[];
  tempRoof: Point[];
  bg: {
    visible: boolean;
    opacity: number;
    calibS: number;
    addr: string;
  };
  arrayAngle: number;
  showStrings: boolean;
  showShadeMap: boolean;
  showGrid: boolean;
  showDims: boolean;
  showObstacles: boolean;
  locked: number[];
  snapEdges: boolean;
  welcomeDismissed: boolean;
}

export interface ViewState {
  s: number;
  ox: number;
  oy: number;
}

export type Sel =
  | { type: 'vertex'; i: number }
  | { type: 'panel'; i: number }
  | { type: 'obstacle'; i: number }
  | null;

export type DragState =
  | { type: 'pan'; sx: number; sy: number; ox: number; oy: number }
  | { type: 'paint'; last: Point }
  | { type: 'erase' }
  | { type: 'newOb'; sx: number; sy: number }
  | { type: 'panel'; i: number; lmx: number; lmy: number; sx: number; sy: number }
  | { type: 'obstacle'; i: number; dx: number; dy: number }
  | { type: 'vertex'; i: number; roofSnap: string }
  | { type: 'row'; anchor: Rect }
  | { type: 'multi'; start: Point; snaps: Point[] }
  | { type: 'marquee'; sx: number; sy: number }
  | null;

export interface FinResult {
  monthlyPay: number;
  principal: number;
  ownFunds: number;
  overpay: number;
  loanMonths: number;
  positiveMonth: number | null;
}

export interface SimResult {
  cap: number;
  gen: number[];
  cons: number[];
  annualGen: number;
  annualCons: number;
  self: number[];
  exp: number[];
  saveY: number;
  panelsCost: number;
  mount: number;
  install: number;
  batPrice: number;
  capex: number;
  cash: number[];
  fin: FinResult;
  batCharge: number;
  batOut: number;
  usable: number;
  backupH: number;
  shadeAvg: number;
  payback: number;
  coverage: number;
  coverageBat: number;
  load: number;
  spec: number;
  co2: number;
  bom: BomRow[];
}

export interface StringCalcResult {
  N: number;
  md: PanelData;
  inv: InverterData;
  minPer: number;
  maxPer: number;
  per: number;
  strings: number;
  usedMppt: number;
  spm: number;
  curOK: boolean;
}

export interface VariantRecord {
  id: string;
  name: string;
  createdAt: number;
  data: Record<string, unknown>;
}

export type BomPer = 'panel' | 'string' | 'project';

export interface BomItem {
  id: string;
  name: string;
  per: BomPer;
  qty: number;
  price: number;
  unit: string;
}

export interface BomRow {
  id: string;
  name: string;
  qty: number;
  unit: string;
  price: number;
  total: number;
}

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const num0 = (v: number): number => (isFinite(v) ? v : 0);
export const nf = (n: number, d = 0): string =>
  isFinite(n) ? Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d }) : '—';
export const sumArr = (a: number[]): number => a.reduce((x, y) => x + (isFinite(y) ? y : 0), 0);

export function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Элемент #${id} не найден`);
  return node as T;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;
export function toast(msg: string): void {
  const t = el('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

export function fmtHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

export function azLabel(a: number): string {
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  return dirs[Math.round((a % 360) / 45) % 8];
}

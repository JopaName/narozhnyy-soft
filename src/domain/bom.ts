import { BOM } from '../core/data';
import type { AppState, BomRow } from '../core/types';
import { resolveState, stringCalc } from './simulation';

/**
 * Детальная смета (BOM) как в OpenSolar:
 * количества считаются от числа панелей, стрингов и конфигурации проекта.
 * Позиции и цены — в каталоге (equipment.json → BOM).
 */
export function calcBom(overrides?: Partial<AppState>): BomRow[] {
  const s = resolveState(overrides);
  const sc = stringCalc(overrides);
  const strings = sc ? sc.strings : 0;
  const panels = s.panels.length;

  const rows: BomRow[] = [];
  for (const item of BOM) {
    let qty = 0;
    if (item.per === 'panel') qty = panels * item.qty;
    else if (item.per === 'string') qty = strings * item.qty;
    else if (item.per === 'project') qty = item.qty;
    if (qty <= 0) continue;
    /* Счётчик нужен только при продаже излишков в сеть */
    if (item.id === 'meter' && s.exportRate <= 0) continue;
    rows.push({
      id: item.id,
      name: item.name,
      qty: Math.round(qty * 100) / 100,
      unit: item.unit,
      price: item.price,
      total: Math.round(qty * item.price),
    });
  }
  return rows;
}

export function bomTotal(bom: BomRow[]): number {
  return bom.reduce((sum, r) => sum + r.total, 0);
}

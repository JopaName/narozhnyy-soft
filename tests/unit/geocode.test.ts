import { describe, expect, it } from 'vitest';
import { buildGeocodeQueries } from '../../src/core/geocode';

describe('buildGeocodeQueries', () => {
  it('обычный адрес — оригинал + фолбэк без номера', () => {
    expect(buildGeocodeQueries('Краснодар, ул. Красная 100')).toEqual([
      'Краснодар, ул. Красная 100',
      'Краснодар, ул. Красная',
    ]);
  });

  it('литера дома добавляет фолбэк без буквы', () => {
    const q = buildGeocodeQueries('Геленджик, ул Десантная 44б');
    expect(q[0]).toBe('Геленджик, ул Десантная 44б');
    expect(q[1]).toBe('Геленджик, ул Десантная 44');
  });

  it('без номера — третий фолбэк', () => {
    const q = buildGeocodeQueries('Геленджик, ул Десантная 44б');
    expect(q[2]).toBe('Геленджик, ул Десантная');
  });

  it('без дублей', () => {
    const q = buildGeocodeQueries('Сочи, Ленина 5');
    expect(new Set(q).size).toBe(q.length);
  });

  it('латинская литера тоже отрезается', () => {
    const q = buildGeocodeQueries('Москва, Тверская 1a');
    expect(q[1]).toBe('Москва, Тверская 1');
  });
});

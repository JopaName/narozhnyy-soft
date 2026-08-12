import { describe, expect, it } from 'vitest';
import { isNewer, parseVersion } from '../../src/core/version';

describe('parseVersion', () => {
  it('обычные версии', () => {
    expect(parseVersion('1.0.0')).toEqual([1, 0, 0]);
    expect(parseVersion('v2.3.4')).toEqual([2, 3, 4]);
    expect(parseVersion('10.0')).toEqual([10, 0]);
  });

  it('мусор на входе', () => {
    expect(parseVersion('abc')).toEqual([0]);
    expect(parseVersion('')).toEqual([0]);
  });

  it('предрелизные теги', () => {
    expect(parseVersion('v1.0.0-beta.1')).toEqual([1, 0, 0, 0, 1]);
  });
});

describe('isNewer', () => {
  it('мажорная версия', () => {
    expect(isNewer('2.0.0', '1.0.0')).toBe(true);
    expect(isNewer('1.0.0', '2.0.0')).toBe(false);
  });

  it('минорная версия', () => {
    expect(isNewer('1.2.0', '1.1.0')).toBe(true);
    expect(isNewer('1.1.0', '1.2.0')).toBe(false);
  });

  it('патч', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
    expect(isNewer('1.0.0', '1.0.1')).toBe(false);
  });

  it('одинаковые версии — не новее', () => {
    expect(isNewer('1.0.0', '1.0.0')).toBe(false);
  });

  it('двузначные сегменты', () => {
    expect(isNewer('1.10.0', '1.9.0')).toBe(true);
    expect(isNewer('1.9.0', '1.10.0')).toBe(false);
  });

  it('разная длина', () => {
    expect(isNewer('1.0.0.1', '1.0.0')).toBe(true);
    expect(isNewer('1.0', '1.0.0')).toBe(false);
  });
});

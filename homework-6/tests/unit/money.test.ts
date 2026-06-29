import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';
import { Money, formatMoney, isPositiveAmount, toMoney } from '../../src/lib/money';

describe('Money (isolated banker-rounding constructor)', () => {
  it('uses ROUND_HALF_EVEN without mutating the global Decimal', () => {
    expect(Money.rounding).toBe(Decimal.ROUND_HALF_EVEN); // 6
    // Global default is left untouched at ROUND_HALF_UP (4).
    expect(Decimal.rounding).toBe(Decimal.ROUND_HALF_UP);
  });

  it('rounds half-to-even at the final formatting step', () => {
    expect(formatMoney(new Money('2.345'))).toBe('2.34'); // drop 5, preceding 4 (even) → stays
    expect(formatMoney(new Money('2.355'))).toBe('2.36'); // drop 5, preceding 5 (odd) → up
    expect(formatMoney(new Money('1.005'))).toBe('1.00'); // drop 5, preceding 0 (even) → stays
  });

  it('global Decimal still rounds half-up (proving isolation)', () => {
    expect(new Decimal('2.5').toFixed(0)).toBe('3');
    expect(new Money('2.5').toFixed(0)).toBe('2'); // half-even
  });

  it('toMoney builds a Money value', () => {
    expect(toMoney('10.50').toFixed(2)).toBe('10.50');
  });

  describe('isPositiveAmount', () => {
    it.each([
      ['1.00', true],
      ['0.01', true],
      ['0', false],
      ['0.00', false],
      ['-100.00', false],
      ['not-a-number', false],
      ['', false],
    ])('isPositiveAmount(%s) === %s', (input, expected) => {
      expect(isPositiveAmount(input)).toBe(expected);
    });
  });
});

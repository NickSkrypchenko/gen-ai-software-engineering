import { describe, it, expect } from 'vitest';
import { Money, MAX_AMOUNT } from './money';

describe('Money.parse', () => {
  it('accepts a valid positive amount', () => {
    expect(Money.parse(100.50)).toBe(100.50);
  });

  it('accepts exactly MAX_AMOUNT', () => {
    expect(Money.parse(MAX_AMOUNT)).toBe(MAX_AMOUNT);
  });

  it('rejects amounts with 3 decimal places', () => {
    expect(() => Money.parse(1.001)).toThrow('2 decimal places');
  });

  it('rejects Infinity', () => {
    expect(() => Money.parse(Infinity)).toThrow('finite');
  });

  it('rejects NaN', () => {
    expect(() => Money.parse(NaN)).toThrow('finite');
  });

  it('rejects zero', () => {
    expect(() => Money.parse(0)).toThrow('positive');
  });

  it('rejects negative amounts', () => {
    expect(() => Money.parse(-1)).toThrow('positive');
  });

  it('rejects amounts above MAX_AMOUNT', () => {
    expect(() => Money.parse(MAX_AMOUNT + 1)).toThrow(`${MAX_AMOUNT}`);
  });

  it('rejects MAX_AMOUNT + 0.01', () => {
    expect(() => Money.parse(MAX_AMOUNT + 0.01)).toThrow(`${MAX_AMOUNT}`);
  });
});

describe('Money.add', () => {
  it('adds two amounts correctly', () => {
    expect(Money.add(1.10, 2.20)).toBe(3.30);
  });

  it('avoids float drift across 1000 small additions', () => {
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      sum = Money.add(sum, 0.10);
    }
    expect(sum).toBe(100.00);
  });

  it('rounds to 2 decimal places', () => {
    expect(Money.add(0.1, 0.2)).toBe(0.30);
  });
});

describe('Money.format', () => {
  it('formats USD amount', () => {
    expect(Money.format(1234.56, 'USD')).toMatch(/1,234\.56/);
  });

  it('formats EUR amount', () => {
    expect(Money.format(100, 'EUR')).toMatch(/100/);
  });
});

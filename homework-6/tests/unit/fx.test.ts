import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadFxTable, toUsd } from '../../src/domain/fx';
import { ALLOWED_CURRENCIES } from '../../src/domain/validation';
import type { FxSnapshot } from '../../src/types';

const ROOT = process.cwd();
const snapshot = JSON.parse(
  readFileSync(join(ROOT, 'config', 'fx-rates.json'), 'utf8'),
) as FxSnapshot;
const rates = loadFxTable(snapshot);

describe('FX normalization', () => {
  it('loadFxTable returns the rates map', () => {
    expect(rates.USD).toBe('1.00');
    expect(snapshot.as_of).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('toUsd converts non-USD via the rate (500 EUR @ 1.08 = 540.00)', () => {
    expect(toUsd('500.00', 'EUR', rates).toFixed(2)).toBe('540.00');
  });

  it('toUsd is identity for USD', () => {
    expect(toUsd('1500.00', 'USD', rates).toFixed(2)).toBe('1500.00');
  });

  it('throws (fail closed) when a currency has no rate', () => {
    expect(() => toUsd('1.00', 'ZZZ', rates)).toThrow(/No FX rate/);
  });

  it('FX ↔ allow-list parity: rate keys === ISO 4217 allow-list, 1:1', () => {
    const fxKeys = Object.keys(rates).sort();
    const allow = [...ALLOWED_CURRENCIES].sort();
    expect(fxKeys).toEqual(allow);
    expect(fxKeys).toHaveLength(7);
  });
});

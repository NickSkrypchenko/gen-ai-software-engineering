/**
 * FX normalization — pure core + a thin snapshot loader.
 *
 * The pure converter `toUsd` receives the rate table as an argument so it does no I/O.
 * `loadFxTable` only *reads* the static `config/fx-rates.json` snapshot into an `FxTable`.
 */
import { Money, type MoneyValue } from '../lib/money.js';
import type { FxSnapshot, FxTable } from '../types.js';

/** Extract the rate table from a parsed `config/fx-rates.json` snapshot. */
export function loadFxTable(snapshot: FxSnapshot): FxTable {
  return snapshot.rates;
}

/**
 * Convert a string `amount` in `currency` to its USD-equivalent `MoneyValue` (unrounded).
 * A missing rate for an allow-listed currency is a programming error (the parity test
 * guarantees keys === allow-list), so we throw rather than guess — fail closed.
 */
export function toUsd(amount: string, currency: string, rates: FxTable): MoneyValue {
  const rate = rates[currency];
  if (rate === undefined) {
    throw new Error(`No FX rate for currency "${currency}" (allow-list/FX parity violated)`);
  }
  return new Money(amount).times(new Money(rate));
}

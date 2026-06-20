/**
 * Isolated monetary Decimal constructor.
 *
 * `Decimal.clone(...)` returns a NEW, independent constructor with its own rounding mode;
 * the global `Decimal` is left at its default (`ROUND_HALF_UP`). We never call
 * `Decimal.set(...)` — that would mutate the global and leak across the process (and across
 * reused Vitest workers, making test order matter). Import `Money` everywhere money is
 * handled; keep amounts as strings; round (half-even) only at the final formatting step.
 *
 * (context7 /mikemcl/decimal.js — see research-notes.md, Query 1.)
 */
import Decimal from 'decimal.js';

/** Banker's-rounding Decimal constructor — the ONLY monetary type in this project. */
export const Money = Decimal.clone({ rounding: Decimal.ROUND_HALF_EVEN });

/** A monetary value (instance of the isolated `Money` constructor). */
export type MoneyValue = Decimal;

/** Build a `Money` from a string amount. Throws on an unparseable amount. */
export function toMoney(amount: string): MoneyValue {
  return new Money(amount);
}

/** True when `amount` parses to a finite, strictly-positive value. */
export function isPositiveAmount(amount: string): boolean {
  try {
    const d = new Money(amount);
    return d.isFinite() && d.greaterThan(0);
  } catch {
    return false;
  }
}

/** Format a monetary value to a fixed 2-dp string using half-even rounding (final step). */
export function formatMoney(value: MoneyValue): string {
  return value.toFixed(2);
}

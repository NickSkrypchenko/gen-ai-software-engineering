import { describe, test, expect } from 'vitest';
import { clock } from './clock';

describe('clock', () => {
  test('now() returns a Date', () => {
    expect(clock.now()).toBeInstanceOf(Date);
  });

  test('now() is approximately the current time', () => {
    const before = Date.now();
    const t = clock.now().getTime();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after + 5);
  });

  test('now() can be overridden for testing', () => {
    const fixed = new Date('2026-01-01');
    const original = clock.now;
    clock.now = () => fixed;
    expect(clock.now()).toEqual(fixed);
    clock.now = original;
  });
});

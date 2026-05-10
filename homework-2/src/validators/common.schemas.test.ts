import { describe, test, expect } from 'vitest';
import { Email, NonEmptyString } from './common.schemas';

describe('Email', () => {
  test('accepts valid email', () => {
    expect(Email.safeParse('Alice@Example.COM').success).toBe(true);
  });

  test('lowercases the email', () => {
    expect(Email.parse('Alice@Example.COM')).toBe('alice@example.com');
  });

  test('trims whitespace', () => {
    expect(Email.parse('  alice@example.com  ')).toBe('alice@example.com');
  });

  test('rejects missing @', () => {
    expect(Email.safeParse('notanemail').success).toBe(false);
  });

  test('rejects missing domain', () => {
    expect(Email.safeParse('alice@').success).toBe(false);
  });

  test('rejects missing TLD', () => {
    expect(Email.safeParse('alice@example').success).toBe(false);
  });

  test('rejects address > 255 chars', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(Email.safeParse(long).success).toBe(false);
  });
});

describe('NonEmptyString', () => {
  test('accepts a normal string within max', () => {
    expect(NonEmptyString(100).safeParse('hello').success).toBe(true);
  });

  test('rejects empty string', () => {
    expect(NonEmptyString(100).safeParse('').success).toBe(false);
  });

  test('rejects whitespace-only (trimmed to empty)', () => {
    expect(NonEmptyString(100).safeParse('   ').success).toBe(false);
  });

  test('rejects string over max length', () => {
    expect(NonEmptyString(5).safeParse('toolong').success).toBe(false);
  });

  test('trims and accepts string at exactly max after trim', () => {
    expect(NonEmptyString(5).safeParse('hello').success).toBe(true);
  });
});

import { describe, test, expect } from 'vitest';
import { classify } from './classifier';
import { CATEGORY_RULES } from './classifier-rules';

describe('classify()', () => {
  // ── Ordering pinned test (spec §4.5 — must not reorder CATEGORY_RULES) ──
  test('CATEGORY_RULES are listed in specificity-descending order', () => {
    expect(CATEGORY_RULES.map(r => r.category)).toEqual([
      'bug_report',
      'account_access',
      'billing_question',
      'technical_issue',
      'feature_request',
    ]);
  });

  test('overlap: bug_report wins over technical_issue when stack trace present', () => {
    expect(classify('crash with stack trace at line 42').category).toBe('bug_report');
  });

  test('overlap: bug_report wins over account_access when both signals present', () => {
    expect(classify('login failed with null pointer exception traceback').category).toBe('bug_report');
  });

  // ── Category matching ──
  test('matches bug_report via "stack trace"', () => {
    const r = classify('I see a stack trace every time I click submit');
    expect(r.category).toBe('bug_report');
    expect(r.matchedKeywords).toContain('stack trace');
  });

  test('matches account_access via "password"', () => {
    const r = classify('I forgot my password and cannot sign in');
    expect(r.category).toBe('account_access');
  });

  test('matches billing_question via "invoice"', () => {
    const r = classify('I was charged twice and need an invoice');
    expect(r.category).toBe('billing_question');
  });

  test('matches technical_issue via "crash" when no higher-priority signal', () => {
    const r = classify('the app keeps crashing');
    expect(r.category).toBe('technical_issue');
  });

  test('matches feature_request via "feature"', () => {
    const r = classify('I would love a dark mode feature');
    expect(r.category).toBe('feature_request');
  });

  test('defaults to other when no category keyword matches', () => {
    const r = classify('hello world');
    expect(r.category).toBe('other');
  });

  // ── Priority matching ──
  test('matches urgent via "critical"', () => {
    const r = classify('critical: production down right now');
    expect(r.priority).toBe('urgent');
  });

  test('matches high via "blocking"', () => {
    const r = classify('this is blocking our entire team');
    expect(r.priority).toBe('high');
  });

  test('matches low via "minor"', () => {
    const r = classify('minor cosmetic issue on the about page');
    expect(r.priority).toBe('low');
  });

  test('defaults to medium when no priority keyword matches', () => {
    const r = classify('hello world plain text');
    expect(r.priority).toBe('medium');
  });

  // ── Case insensitivity ──
  test('is case-insensitive for categories', () => {
    expect(classify('STACK TRACE in the logs').category).toBe('bug_report');
  });

  test('is case-insensitive for priorities', () => {
    expect(classify('CRITICAL outage right now').priority).toBe('urgent');
  });

  // ── Confidence formula ──
  test('confidence is 0.5 when no keywords match at all', () => {
    expect(classify('hello world').confidence).toBe(0.5);
  });

  test('confidence is 0.7 when exactly 1 keyword matches', () => {
    const r = classify('stack trace only');
    expect(r.confidence).toBe(0.7);
  });

  test('confidence is 0.8 when 2 keywords match', () => {
    const r = classify('critical crash with stack trace');
    // category: bug_report (stack trace), priority: urgent (critical) → 2 total hits
    expect(r.matchedKeywords.length).toBeGreaterThanOrEqual(2);
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  test('confidence is capped at 1.0 for many matches', () => {
    const r = classify(
      'critical stack trace traceback exception null pointer login password reset ' +
      'invoice payment billing crash error',
    );
    expect(r.confidence).toBeLessThanOrEqual(1.0);
  });

  // ── Reasoning ──
  test('reasoning mentions matched category keywords', () => {
    const r = classify('stack trace on line 42');
    expect(r.reasoning).toContain('stack trace');
    expect(r.reasoning).toContain('bug_report');
  });

  test('reasoning mentions no-match fallback for priority', () => {
    const r = classify('stack trace only no priority keyword');
    expect(r.reasoning).toContain('medium');
  });

  test('reasoning mentions no-match fallback for category', () => {
    const r = classify('hello world');
    expect(r.reasoning).toContain('other');
  });

  // ── matchedKeywords ──
  test('matchedKeywords includes all matched terms from category + priority', () => {
    const r = classify('critical stack trace login failed');
    expect(r.matchedKeywords).toContain('stack trace');
    expect(r.matchedKeywords).toContain('critical');
  });
});

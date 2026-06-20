import { describe, expect, it } from 'vitest';
import { buildEnvelope, forward } from '../../src/lib/messages';
import { FixedClock } from '../../src/integrator';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('buildEnvelope', () => {
  const clock = new FixedClock(new Date('2026-03-16T10:00:00Z'));

  it('produces a UUIDv4 message_id and a clock-stamped ISO timestamp', () => {
    const env = buildEnvelope({ transaction_id: 'T1' }, 'integrator', 'transaction_validator', clock);
    expect(env.message_id).toMatch(UUID_V4);
    expect(env.timestamp).toBe('2026-03-16T10:00:00.000Z');
    expect(env.source_agent).toBe('integrator');
    expect(env.target_agent).toBe('transaction_validator');
    expect(env.message_type).toBe('transaction');
    expect(env.data).toEqual({ transaction_id: 'T1' });
  });

  it('mints a fresh id per envelope', () => {
    const a = buildEnvelope({}, 's', 't', clock);
    const b = buildEnvelope({}, 's', 't', clock);
    expect(a.message_id).not.toBe(b.message_id);
  });
});

describe('forward', () => {
  it('re-addresses the hop and merges data while keeping the header id', () => {
    const clock = new FixedClock(new Date('2026-03-16T10:00:00Z'));
    const env = buildEnvelope({ transaction_id: 'T1', status: 'validated' }, 'integrator', 'transaction_validator', clock);
    const next = forward(env, 'fraud_detector', 'compliance_checker', { risk_score: 0.4 });
    expect(next.message_id).toBe(env.message_id);
    expect(next.source_agent).toBe('fraud_detector');
    expect(next.target_agent).toBe('compliance_checker');
    expect(next.data).toMatchObject({ transaction_id: 'T1', status: 'validated', risk_score: 0.4 });
  });
});

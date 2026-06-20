/**
 * Message envelope construction.
 *
 * `message_id` is a UUID v4 via the built-in `crypto.randomUUID()`. The header
 * (`message_id`, `timestamp`, `source_agent`, `target_agent`, `message_type`) is constant
 * across stages; each agent enriches `data`. The timestamp comes from an injected `Clock`
 * for deterministic tests.
 */
import { randomUUID } from 'node:crypto';
import type { Clock, Message } from '../types.js';

/** Build a standard transaction envelope with a fresh UUIDv4 id and a clock-stamped time. */
export function buildEnvelope<T extends Record<string, unknown>>(
  data: T,
  sourceAgent: string,
  targetAgent: string,
  clock: Clock,
): Message<T> {
  return {
    message_id: randomUUID(),
    timestamp: clock.now().toISOString(),
    source_agent: sourceAgent,
    target_agent: targetAgent,
    message_type: 'transaction',
    data,
  };
}

/** Return a copy of `envelope` re-addressed to the next hop with merged `data`. */
export function forward<T extends Record<string, unknown>>(
  envelope: Message,
  sourceAgent: string,
  targetAgent: string,
  dataPatch: T,
): Message {
  return {
    ...envelope,
    source_agent: sourceAgent,
    target_agent: targetAgent,
    data: { ...envelope.data, ...dataPatch },
  };
}

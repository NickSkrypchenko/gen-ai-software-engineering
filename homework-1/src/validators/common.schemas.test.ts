import { describe, it, expect } from 'vitest';
import {
  AccountId,
  ExternalAccount,
  AccountIdOrExternal,
  Currency,
  MoneySchema,
  FailureReason,
  MAX_AMOUNT,
} from './common.schemas';

describe('AccountId', () => {
  it('accepts valid account id', () => {
    expect(AccountId.safeParse('ACC-12345').success).toBe(true);
    expect(AccountId.safeParse('ACC-ABCDE').success).toBe(true);
    expect(AccountId.safeParse('ACC-A1B2C').success).toBe(true);
  });

  it('rejects lowercase letters', () => {
    const result = AccountId.safeParse('ACC-abcde');
    expect(result.success).toBe(false);
  });

  it('rejects wrong prefix', () => {
    expect(AccountId.safeParse('ACT-12345').success).toBe(false);
  });

  it('rejects too short', () => {
    expect(AccountId.safeParse('ACC-1234').success).toBe(false);
  });

  it('rejects too long', () => {
    expect(AccountId.safeParse('ACC-123456').success).toBe(false);
  });

  it('rejects EXTERNAL', () => {
    expect(AccountId.safeParse('EXTERNAL').success).toBe(false);
  });
});

describe('ExternalAccount', () => {
  it('accepts EXTERNAL', () => {
    expect(ExternalAccount.safeParse('EXTERNAL').success).toBe(true);
  });

  it('rejects non-EXTERNAL', () => {
    expect(ExternalAccount.safeParse('ACC-12345').success).toBe(false);
  });
});

describe('AccountIdOrExternal', () => {
  it('accepts ACC-XXXXX', () => {
    expect(AccountIdOrExternal.safeParse('ACC-12345').success).toBe(true);
  });

  it('accepts EXTERNAL', () => {
    expect(AccountIdOrExternal.safeParse('EXTERNAL').success).toBe(true);
  });

  it('rejects other strings', () => {
    expect(AccountIdOrExternal.safeParse('random').success).toBe(false);
  });
});

describe('Currency', () => {
  it('accepts whitelisted currencies', () => {
    for (const code of ['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD']) {
      expect(Currency.safeParse(code).success).toBe(true);
    }
  });

  it('rejects unknown currency code', () => {
    expect(Currency.safeParse('XYZ').success).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(Currency.safeParse('usd').success).toBe(false);
  });
});

describe('MoneySchema', () => {
  it('accepts a valid amount', () => {
    expect(MoneySchema.safeParse(100.50).success).toBe(true);
  });

  it('accepts exactly MAX_AMOUNT', () => {
    expect(MoneySchema.safeParse(MAX_AMOUNT).success).toBe(true);
  });

  it('rejects 3 decimal places', () => {
    const result = MoneySchema.safeParse(1.001);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 decimal/);
    }
  });

  it('rejects Infinity', () => {
    expect(MoneySchema.safeParse(Infinity).success).toBe(false);
  });

  it('rejects NaN', () => {
    expect(MoneySchema.safeParse(NaN).success).toBe(false);
  });

  it('rejects zero', () => {
    expect(MoneySchema.safeParse(0).success).toBe(false);
  });

  it('rejects negative', () => {
    expect(MoneySchema.safeParse(-1).success).toBe(false);
  });

  it('rejects MAX_AMOUNT + 0.01', () => {
    expect(MoneySchema.safeParse(MAX_AMOUNT + 0.01).success).toBe(false);
  });

  it('rejects amounts above MAX_AMOUNT', () => {
    const result = MoneySchema.safeParse(MAX_AMOUNT + 1);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/exceed/);
    }
  });
});

describe('FailureReason', () => {
  it('accepts INSUFFICIENT_FUNDS', () => {
    expect(FailureReason.safeParse('INSUFFICIENT_FUNDS').success).toBe(true);
  });

  it('rejects unknown reason', () => {
    expect(FailureReason.safeParse('TIMEOUT').success).toBe(false);
  });
});

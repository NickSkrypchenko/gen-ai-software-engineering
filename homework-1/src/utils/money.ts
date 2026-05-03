export const MAX_AMOUNT = 1_000_000;

export const Money = {
  parse(input: number): number {
    if (!Number.isFinite(input)) throw new Error('Amount must be finite');
    if (input <= 0) throw new Error('Amount must be a positive number');
    if (input > MAX_AMOUNT) throw new Error(`Amount must not exceed ${MAX_AMOUNT}`);
    if (Math.round(input * 100) !== input * 100)
      throw new Error('Amount supports max 2 decimal places');
    return input;
  },

  add(a: number, b: number): number {
    return Math.round((a + b) * 100) / 100;
  },

  format(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
      amount,
    );
  },
};

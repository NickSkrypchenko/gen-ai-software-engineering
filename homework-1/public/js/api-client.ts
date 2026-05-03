export const CURRENCIES = ['USD','EUR','GBP','JPY','CHF','CAD','AUD','SEK','NOK','DKK','PLN','CZK'] as const;
export type Currency = typeof CURRENCIES[number];
export type TransactionType = 'deposit' | 'withdrawal' | 'transfer';
export type TransactionStatus = 'completed' | 'failed';

export interface Transaction {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
  status: TransactionStatus;
  failureReason?: string;
  requestId: string;
  timestamp: string;
}

export interface CreateTransactionInput {
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
}

export interface Balance {
  currency: Currency;
  amount: number;
}

export interface BalancesResponse {
  accountId: string;
  balances: Balance[];
  asOf: string;
}

export interface CurrencySummary {
  currency: Currency;
  totalDeposits: number;
  totalWithdrawals: number;
  transactionCount: number;
  lastTransactionAt: string | null;
}

export interface SummaryResponse {
  accountId: string;
  perCurrency: CurrencySummary[];
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: string;
  code: string;
  details?: ApiErrorDetail[];
  requestId: string;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, options);
  const data = await res.json();
  if (!res.ok) {
    throw new ApiClientError(
      (data as ApiErrorBody).error ?? 'Request failed',
      res.status,
      data as ApiErrorBody,
    );
  }
  return data as T;
}

export const api = {
  createTransaction: (input: CreateTransactionInput) =>
    apiFetch<Transaction>('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),

  listTransactions: async (filters: {
    accountId?: string;
    type?: TransactionType;
    from?: string;
    to?: string;
  } = {}) => {
    const p = new URLSearchParams();
    if (filters.accountId) p.set('accountId', filters.accountId);
    if (filters.type)      p.set('type', filters.type);
    if (filters.from)      p.set('from', filters.from);
    if (filters.to)        p.set('to', filters.to);
    const qs = p.toString();
    const res = await apiFetch<{ data: Transaction[]; count: number }>(
      `/api/transactions${qs ? '?' + qs : ''}`,
    );
    return res.data;
  },

  getTransaction: (id: string) =>
    apiFetch<Transaction>(`/api/transactions/${id}`),

  getBalances: (accountId: string) =>
    apiFetch<BalancesResponse>(`/api/accounts/${accountId}/balance`),

  getSummary: (accountId: string) =>
    apiFetch<SummaryResponse>(`/api/accounts/${accountId}/summary`),

  health: () =>
    apiFetch<{ status: string; uptime: number; timestamp: string }>('/health'),

  exportCSVUrl: (filters: {
    accountId?: string;
    type?: TransactionType;
    from?: string;
    to?: string;
  } = {}) => {
    const p = new URLSearchParams();
    if (filters.accountId) p.set('accountId', filters.accountId);
    if (filters.type)      p.set('type', filters.type);
    if (filters.from)      p.set('from', filters.from);
    if (filters.to)        p.set('to', filters.to);
    const qs = p.toString();
    return `/api/transactions/export${qs ? '?' + qs : ''}`;
  },
};

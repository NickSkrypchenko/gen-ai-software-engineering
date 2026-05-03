import { ulid } from 'ulid';
import { Transaction, CreateTransactionInput, ListFilters, FailureReasonType } from '../models/transaction.types';
import { Clock, realClock } from '../utils/clock';

export class TransactionRepository {
  private byId = new Map<string, Transaction>();
  private byAccount = new Map<string, Set<string>>();

  constructor(private readonly clock: Clock = realClock) {}

  create(input: CreateTransactionInput, id: string, timestamp: Date): Transaction {
    const txn: Transaction = {
      id,
      fromAccount: input.fromAccount,
      toAccount: input.toAccount,
      amount: input.amount,
      currency: input.currency,
      type: input.type,
      timestamp: timestamp.toISOString(),
      status: 'pending',
      failureReason: null,
    };
    this.byId.set(id, txn);
    this.indexAccount(input.fromAccount, id);
    this.indexAccount(input.toAccount, id);
    return txn;
  }

  markCompleted(id: string): Transaction {
    const txn = this.requireById(id);
    const updated: Transaction = { ...txn, status: 'completed' };
    this.byId.set(id, updated);
    return updated;
  }

  markFailed(id: string, reason: FailureReasonType): Transaction {
    const txn = this.requireById(id);
    const updated: Transaction = { ...txn, status: 'failed', failureReason: reason };
    this.byId.set(id, updated);
    return updated;
  }

  getById(id: string): Transaction | undefined {
    return this.byId.get(id);
  }

  list(filters: ListFilters): Transaction[] {
    const candidates = this.getCandidates(filters.accountId);

    return candidates
      .filter(txn => this.matchesFilters(txn, filters))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  bulkLoad(transactions: Transaction[]): void {
    for (const txn of transactions) {
      this.byId.set(txn.id, txn);
      this.indexAccount(txn.fromAccount, txn.id);
      this.indexAccount(txn.toAccount, txn.id);
    }
  }

  private requireById(id: string): Transaction {
    const txn = this.byId.get(id);
    if (!txn) throw new Error(`Transaction ${id} not found`);
    return txn;
  }

  private indexAccount(accountId: string, txnId: string): void {
    if (accountId === 'EXTERNAL') return;
    if (!this.byAccount.has(accountId)) this.byAccount.set(accountId, new Set());
    this.byAccount.get(accountId)!.add(txnId);
  }

  private getCandidates(accountId?: string): Transaction[] {
    if (!accountId) return Array.from(this.byId.values());
    const ids = this.byAccount.get(accountId);
    if (!ids) return [];
    return Array.from(ids)
      .map(id => this.byId.get(id))
      .filter((t): t is Transaction => t !== undefined);
  }

  private matchesFilters(txn: Transaction, filters: ListFilters): boolean {
    if (
      txn.status === 'failed' &&
      filters.accountId &&
      txn.fromAccount !== filters.accountId
    ) {
      return false;
    }
    if (filters.type && txn.type !== filters.type) return false;
    if (filters.from && txn.timestamp < filters.from) return false;
    if (filters.to && txn.timestamp > filters.to) return false;
    return true;
  }
}

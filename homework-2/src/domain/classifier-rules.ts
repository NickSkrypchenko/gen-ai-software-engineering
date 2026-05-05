// Classifier rule data — no logic here.
// CATEGORY_RULES order is intentional and locked by a pinned test (Phase 1).
// Specificity-descending: most diagnostic signal first.
import type { TicketCategory, TicketPriority } from './ticket';

export interface CategoryRule {
  category: TicketCategory;
  keywords: string[];
}

export interface PriorityRule {
  priority: TicketPriority;
  keywords: string[];
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'bug_report',
    keywords: ['stack trace', 'stacktrace', 'traceback', 'exception', 'null pointer', 'segfault', 'reproduction steps', 'steps to reproduce', 'reproducible'],
  },
  {
    category: 'account_access',
    keywords: ['login', 'log in', 'password', '2fa', 'two-factor', 'authentication', 'sign in', 'account locked', 'forgot password', 'reset password', 'unauthorized'],
  },
  {
    category: 'billing_question',
    keywords: ['invoice', 'payment', 'charge', 'refund', 'subscription', 'billing', 'receipt', 'credit card', 'debit card', 'overcharged', 'pricing'],
  },
  {
    category: 'technical_issue',
    keywords: ['crash', 'error', 'bug', 'broken', 'not working', 'fails', 'failure', 'down', 'slow', 'timeout', 'performance', '500', '503'],
  },
  {
    category: 'feature_request',
    keywords: ['feature', 'request', 'suggest', 'suggestion', 'would be nice', 'wishlist', 'enhancement', 'add support', 'please add', 'can you add'],
  },
];

export const PRIORITY_RULES: PriorityRule[] = [
  {
    priority: 'urgent',
    keywords: ["can't access", 'cannot access', 'critical', 'production down', 'prod down', 'outage', 'security breach', 'data loss', 'urgent', 'emergency'],
  },
  {
    priority: 'high',
    keywords: ['important', 'blocking', 'asap', 'as soon as possible', 'high priority', 'blocker', 'impacting customers'],
  },
  {
    priority: 'low',
    keywords: ['minor', 'cosmetic', 'suggestion', 'nice to have', 'low priority', 'when you get a chance'],
  },
];

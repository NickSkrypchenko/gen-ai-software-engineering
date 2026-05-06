import type { Classification } from '../api-client.js';

const CATEGORY_LABELS: Record<string, string> = {
  account_access:   'Account access',
  technical_issue:  'Technical issue',
  billing_question: 'Billing question',
  feature_request:  'Feature request',
  bug_report:       'Bug report',
  other:            'Other',
};

function confidenceColor(conf: number): string {
  if (conf >= 0.9) return '#10b981';
  if (conf >= 0.7) return '#3b82f6';
  return '#64748b';
}

export function renderClassificationBadge(c: Classification): string {
  const pct = Math.round(c.confidence * 100);
  const color = confidenceColor(c.confidence);
  const label = CATEGORY_LABELS[c.category] ?? c.category;
  const keywords = (c.matched_keywords ?? [])
    .map(k => `<span class="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-[var(--muted)]">${k}</span>`)
    .join('');

  return `
    <div class="space-y-1.5" aria-label="Classification: ${label}, confidence ${pct}%">
      <div class="flex items-center justify-between text-xs">
        <span class="font-medium text-[var(--text)]">${label}</span>
        <span class="font-mono text-[var(--muted)]" style="color:${color}">${c.confidence.toFixed(2)}</span>
      </div>
      <div class="conf-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Confidence ${pct}%">
        <div class="conf-bar-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <div class="flex items-center gap-1 flex-wrap">
        <span class="text-[10px] text-[var(--muted)]">${c.priority}</span>
        ${keywords}
      </div>
    </div>`;
}

export function renderLatestClassification(classifications: Classification[]): string {
  if (!classifications.length) return '<p class="text-xs text-[var(--muted)]">Not classified yet.</p>';
  const latest = [...classifications].sort(
    (a, b) => new Date(b.classified_at).getTime() - new Date(a.classified_at).getTime(),
  )[0];
  return renderClassificationBadge(latest);
}

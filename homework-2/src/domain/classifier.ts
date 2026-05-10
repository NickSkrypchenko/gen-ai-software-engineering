// Pure classifier — no I/O, deterministic, case-insensitive substring match.
import type { TicketCategory, TicketPriority } from './ticket';
import { CATEGORY_RULES, PRIORITY_RULES } from './classifier-rules';

export interface ClassificationResult {
  category:        TicketCategory;
  priority:        TicketPriority;
  confidence:      number;
  reasoning:       string;
  matchedKeywords: string[];
}

function buildReasoning(
  c: { category: string; matched: string[] },
  p: { priority: string; matched: string[] },
): string {
  const parts: string[] = [];
  if (c.matched.length > 0)
    parts.push(`Category '${c.category}' matched keywords: ${c.matched.map(k => `"${k}"`).join(', ')}.`);
  else
    parts.push("No category keywords matched; defaulted to 'other'.");

  if (p.matched.length > 0)
    parts.push(`Priority '${p.priority}' matched keywords: ${p.matched.map(k => `"${k}"`).join(', ')}.`);
  else
    parts.push("No priority keywords matched; defaulted to 'medium'.");

  return parts.join(' ');
}

export function classify(text: string): ClassificationResult {
  const haystack = text.toLowerCase();

  const categoryHits = CATEGORY_RULES
    .map(r => ({ category: r.category, matched: r.keywords.filter(kw => haystack.includes(kw)) }))
    .filter(h => h.matched.length > 0);

  const priorityHits = PRIORITY_RULES
    .map(r => ({ priority: r.priority, matched: r.keywords.filter(kw => haystack.includes(kw)) }))
    .filter(h => h.matched.length > 0);

  const c = categoryHits[0] ?? { category: 'other' as const, matched: [] };
  const p = priorityHits[0] ?? { priority: 'medium' as const, matched: [] };

  const totalHits = c.matched.length + p.matched.length;
  const confidence = totalHits === 0 ? 0.5 : Math.min(1.0, 0.7 + (totalHits - 1) * 0.1);

  return {
    category:        c.category,
    priority:        p.priority,
    confidence:      Number(confidence.toFixed(2)),
    reasoning:       buildReasoning(c, p),
    matchedKeywords: [...c.matched, ...p.matched],
  };
}

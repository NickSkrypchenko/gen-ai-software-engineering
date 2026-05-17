# spec-conventions.md

> Conventions for writing and maintaining specifications in this repository.
> Apply when creating or editing any `specification.md`, `agents.md`, or design document.

---

## Stable requirement IDs (mandatory)

Every requirement carries a stable ID and is never renumbered:

| Prefix | Scope | Example |
|---|---|---|
| `HL-OBJ-N` | High-level objective | `HL-OBJ-1` |
| `ML-OBJ-N` | Mid-level (testable) objective | `ML-OBJ-3` |
| `NFR-PERF-NNN` | Performance non-functional req | `NFR-PERF-001` |
| `NFR-SEC-NNN` | Security non-functional req | `NFR-SEC-003` |
| `NFR-AUD-NNN` | Audit/logging non-functional req | `NFR-AUD-002` |
| `NFR-REL-NNN` | Reliability non-functional req | `NFR-REL-005` |
| `NFR-PRIV-NNN` | Privacy non-functional req | `NFR-PRIV-001` |
| `EDGE-NN` | Edge case / failure mode | `EDGE-07` |
| `TASK-NN` | Low-level implementation task | `TASK-12` |
| `ASM-NNN` | Assumption / open question | `ASM-003` |

When adding a new requirement: append the next integer. Never reuse a retired ID.

## Traceability matrix (mandatory)

Every `specification.md` must end with a traceability matrix (§12 by convention) mapping:

```
HL-OBJ → ML-OBJ → NFR IDs → Edge cases → Low-Level Tasks → Verification entries
```

Rules:
- Every `ML-OBJ-*` must appear in ≥1 TASK row and ≥1 Verification row.
- Every `NFR-*` must be referenced by ≥1 TASK.
- Every `EDGE-*` must link to ≥1 `ML-OBJ-*`.
- A spec that does not pass these checks is incomplete — do not mark it APPROVED.

## Edge cases live in a table (mandatory)

Edge cases are always a Markdown table with exactly these columns:

```
| ID | Trigger | User-visible behaviour | System behaviour | Audit/compliance implication | Linked ML-OBJ |
```

Minimum 12 rows per spec. Each row must be specific to the feature — no generic "network error" rows without a concrete trigger and expected behaviour.

## Performance numbers are measurable (mandatory)

- Always state latency as `< N ms` at a specific percentile (p50 / p95 / p99).
- Always state throughput as `N RPS` with connection count and duration.
- Always label hypothetical numbers as `assumed target` with a one-line justification.
- Never write "should be fast", "low latency", or "scalable" without a number.

## Every Low-Level Task names a file

Each TASK-NN block must contain:
- `**File to CREATE or UPDATE:**` — exact hypothetical path
- `**Functions / methods to CREATE or UPDATE:**` — specific names
- `**Acceptance criteria:**` — checkable list with `- [ ]` checkboxes

A task without a named file is not a task — it is a wish.

## Progressive disclosure — keep root files lean

- `agents.md`: max ~150 lines. Domain rules, permission tier, tech stack, skill order. No implementation details.
- `fintech-defaults.md` and `spec-conventions.md`: max ~150 lines each. Dense, imperative rules only.
- Long docs (architecture diagrams, data models, full NFR tables) go in `_design/` or `docs/` and are referenced by path.
- The agent loads `agents.md` on every session; it loads `.claude/rules/*.md` when entering the directory. Keep them short enough to be read in full.

## Spec versioning

- `specification.md` carries a `Version` field in §1 Metadata (semantic versioning: `MAJOR.MINOR.PATCH`).
- Increment `MINOR` for new requirements. Increment `PATCH` for clarifications. Increment `MAJOR` for scope changes.
- Status transitions: `DRAFT` → `IN_REVIEW` → `APPROVED`. Only `APPROVED` specs are handed to the implementing agent.
- When a requirement changes during implementation, update the spec first — then update the code.

---
name: test-agent
model: claude-sonnet-4-6
max_tokens: 4096
tools:
  - Read
  - Grep
skills:
  - test-skill
role: A test agent for unit tests.
inputs:
  - context/bugs/XXX/bug-context.md
outputs:
  - context/bugs/XXX/output.md
model_justification: |
  Routine read-only work; Sonnet 4.6 is sufficient.
---

You are a test agent. Read the bug context and report findings.

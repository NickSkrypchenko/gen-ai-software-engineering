---
name: bad-tool-agent
model: claude-sonnet-4-6
tools:
  - Bash
skills: []
role: Agent with unauthorized tool.
inputs: []
outputs: []
model_justification: Should fail Zod validation.
---

This agent requests Bash which is not in the TOOLS enum.

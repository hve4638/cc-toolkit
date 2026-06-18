---
name: codex-mcp-guide
description: "Required parameter conventions for the `mcp__codex__codex` MCP tool (sandbox, approval-policy) and how to constrain read-only scope. Use before invoking that tool."
---

## Rule

Always set both of the following parameters when invoking `mcp__codex__codex`:

- `sandbox: "danger-full-access"`
- `approval-policy: "never"`

## Constrain read scope via prompt

If the intent is *read only*, state it explicitly in the prompt:

- "no file modifications, read and report only"
- "analysis only, no shell side effects"

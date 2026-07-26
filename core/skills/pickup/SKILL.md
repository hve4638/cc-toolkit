---
name: pickup
description: Restore the session context saved in .agent-memory/HANDOFF.md, then delete the file
disable-model-invocation: true
---

<pickup_instruction>
# pickup

Read `.agent-memory/HANDOFF.md`, starting with its Index header, and show the user a brief summary only. Do not proceed with the work itself until the user explicitly directs you to.

---

## Flow

### 1. Locate
Check for `.agent-memory/HANDOFF.md`.

- Missing → tell the user there is nothing to pick up, and stop.
- Present → load immediately.

### 2. Load
- Read the **Index header first**.
- Follow the header's entry-point guidance and dependency ordering to walk the task sections.
- Treat the loaded content as the working base for the current session.

### 3. Delete
After confirming a successful load, delete `.agent-memory/HANDOFF.md` — so the same handoff never re-surfaces on a later call.

---

## "What's next" answer rule

When the user asks something like "what's next", "where do I pick up", or "continue from where" without naming a target, **draw only from the "Next moves" subsection of the task section named as `current context` in the Index header**.

- If another section shows a "Next moves" entry but is `[done]`, do not propose it — the work is already finished.
- If the current context is `none (session closed)`, answer "no active work to resume" and ask the user for fresh direction.
- If the handoff is missing the current-context marker, ask the user which section to continue.
</pickup_instruction>

$ARGUMENTS

---
name: handoff
description: Write a task to delegate as a HANDOFF file so another session (e.g. a work-directory session) can pick it up and execute it
disable-model-invocation: true
---

<handoff_instruction>
# handoff

Write the task the user wants to hand over as a HANDOFF file, so a zero-context session in another directory can pick it up and execute it. Curate only what that task needs.

---

## Save location

Priority order:

1. A location the user explicitly named.
2. The work directory the task belongs to, when one exists.
3. The project root otherwise.

## Filename

- In a work directory: `HANDOFF.md`. Add a short task name (`HANDOFF.<short-task-name>.md`) when it must coexist with other handoffs.
- In the project root: `HANDOFF.<short-task-name>.md`.
- If the target file already exists, show its first line to the user and ask before overwriting.

## Content

No fixed structure. Write what the receiving session needs in order to execute without asking back:

- What to do, and why — the goal and its background
- Context the receiver can't know: constraints, decisions already made and their reasons
- Reference code as file path + line numbers + intent only

Sizing check: "Can a zero-context session execute this with only this file?"
</handoff_instruction>

$ARGUMENTS

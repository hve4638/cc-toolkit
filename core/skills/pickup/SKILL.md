---
name: pickup
description: Find a HANDOFF file in the current directory, load the delegated task, then delete the file
disable-model-invocation: true
---

<pickup_instruction>
# pickup

Load a task another session handed over as a HANDOFF file, show the user a brief summary only, and wait for the user's explicit direction before starting the work.

---

## Flow

### 1. Locate
Look for `HANDOFF.md` and `HANDOFF.*.md` in the current working directory. A file or path the user named takes priority.

- None → tell the user there is nothing to pick up, and stop.
- Exactly one → load it.
- Two or more → list them and ask the user which one.

### 2. Load
Read the file and treat its content as the working base for this session.

### 3. Delete
After confirming a successful load, delete the file.
</pickup_instruction>

$ARGUMENTS

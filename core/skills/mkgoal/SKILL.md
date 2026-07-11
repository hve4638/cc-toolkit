---
name: mkgoal
description: Author a ready-to-paste /goal completion condition from a task description, grounding every verification command in the repo. Use when the user wants a goal condition written, or wants work to run under /goal until done.
argument-hint: "[task or goal description]"
---

<mkgoal_instruction>
# mkgoal

Turn the provided argument into one finished `/goal` condition line. Print the result to chat only; write no files. Running `/goal` is the user's action; the model cannot invoke it.

When the argument is empty, derive the task from the current conversation.

## Condition rules

- Write the condition as something Claude's own surfaced output can demonstrate. The evaluator that judges it after each turn is a small fast model that sees only the conversation.
- Write the condition so a fresh turn can start from it alone; the condition text is also the directive that starts the first turn.
- Keep the condition under 4,000 characters.

## Workflow

### Step 1 — Pin the end state

Extract one measurable end state from the task: a test result, a build exit code, a file count, an empty queue, a clean git status. When the task has no verifiable end state, ask one or two targeted questions before producing; when producing despite that, state each assumption made.

### Step 2 — Ground the checks in the repo

Verify every command named in the condition actually exists: read package.json scripts, Makefile, CI config, or the project's equivalent. Name commands exactly as they run (`pnpm test`, not "the tests"). When no existing command can prove the end state, either switch to an observable state (exit code, file count, `git status` output) or make creating the check the first criterion of the goal itself.

### Step 3 — Assemble the condition

In order:
1. The end state, with the exact command that proves it and the expected result.
2. Constraints that must hold on the way, such as "no other test file is modified".
3. A bound sized to the work, such as `or stop after 20 turns`. Omit only when the user explicitly wants the goal unbounded.

## Output

- The finished line in one fenced block, starting with `/goal `, ready to paste.
- A short note listing assumptions made and anything left for the user to confirm before pasting.
</mkgoal_instruction>

Task: $ARGUMENTS

---
name: mkgoal
description: Author a ready-to-paste /goal prompt (Goal/Context/Constraints/Done When) from a task description, grounding every verification command in the repo. Use when the user wants a goal condition written, or wants work to run under /goal until done.
argument-hint: "[task or goal description]"
---

<mkgoal_instruction>
# mkgoal

Turn the provided argument into one finished `/goal` prompt, printed to chat only. Running `/goal` is the user's action; the model cannot invoke it.

When the argument is empty, derive the task from the current conversation.

## Prompt structure

Four labeled sections, in order:

- `Goal:` — the concrete objective, pinned to one measurable end state.
- `Context:` — the files and directories the work starts from.
- `Constraints:` — architecture rules and technical constraints that must hold on the way, such as "no other test file is modified".
- `Done When:` — the completion criteria, test-pass conditions included: each with the exact command that proves it and the expected result. End with a bound sized to the work, such as `or stop after 20 turns`; omit only when the user explicitly wants the goal unbounded.

## Prompt rules

- Write every Done When criterion as something Claude's own surfaced output can demonstrate — command output, an exit code, a file listing — never as human observation ("the logs can be seen flowing"). The evaluator that judges the goal after each turn is a small fast model that sees only the conversation and weighs the prompt's entire text.
- Write the prompt as the directive that starts the first turn: a fresh turn must be able to start from it alone.
- Keep the whole prompt under 4,000 characters and Context lean.

## Workflow

### Step 1 — Pin the end state

Extract one measurable end state from the task: a test result, a build exit code, a file count, an empty queue, a clean git status. When the task has no verifiable end state, ask one or two targeted questions before producing; when producing despite that, state each assumption made.

### Step 2 — Ground the checks in the repo

Verify every command named in the prompt actually exists: read package.json scripts, Makefile, CI config, or the project's equivalent. Name commands exactly as they run (`pnpm test`, not "the tests"). When no existing command can prove the end state, either switch to an observable state (exit code, file count, `git status` output) or make creating the check the first criterion of the goal itself.

### Step 3 — Assemble the prompt

Fill the four sections per Prompt structure: the end state from Step 1 lands in Goal, the grounded commands from Step 2 in Done When.

## Output

- The finished prompt in one fenced block, starting with `/goal `, ready to paste.
- A short note listing assumptions made and anything left for the user to confirm before pasting.
</mkgoal_instruction>

Task: $ARGUMENTS

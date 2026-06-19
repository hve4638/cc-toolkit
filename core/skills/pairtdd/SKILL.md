---
name: pairtdd
description: Use this skill when the user asks to run an adversarial pair-TDD session. Spawns a single tdd-adversary tester in the background; the main session itself is the implementer.
argument-hint: "[task description]"
---

<pairtdd_instruction>

## Step 1: Spec acquisition

### 1.1 Slug derivation

Combine the user-provided task with the current conversation context to derive a short name (`[a-zA-Z0-9_-]`). Prefix the current time in `YYYYMMDD-HHMM` format to form the slug. Example: name `pricing-rules` → slug `20260601-1234-pricing-rules`. Proceed without user confirmation.

### 1.2 Spec writing

Self-judge whether the current conversation already holds enough context about the TDD target (requirements, domain, input/output shape).

- Enough → organize that context into a spec draft and have the user review/edit. Skip the interview.
- Not enough → run a brief 3–5 question interview and write the spec from the answers.

Save the finalized spec to `.agent-memory/tdd-spec/<slug>.md` (create the directory if absent). Format: natural language + I/O examples + boundary conditions.

## Step 2: Setup

Obtain the starting commit SHA (base-sha) via `git rev-parse HEAD`. Verify that git `user.name` / `user.email` are set; if not, notify the user and stop.

## Step 3: Spawn the tester

Spawn the tester only as a named background subagent:

- `Agent({name: "tdd-adversary", subagent_type: "tdd-adversary", run_in_background: true, prompt: "Working directory is <repo root>. Idle until the bootstrap SendMessage arrives."})`

The tester uses `core/agents/tdd-adversary.md` as-is. Do not spawn the implementer — main fills that role.

Reuse this same background subagent across all subsequent rounds. Step 4 and Step 5 SendMessages continue its accumulated context (prior SHAs, no-progress count, cheat suspicions). Do not call `Agent()` again.

## Step 4: Send the first signal

Send exactly this single line to the tester:

```
bootstrap: spec=<abs spec path> worktree=<repo root> base-sha=<base-sha> — produce first red
```

`abs spec path` is the absolute path of `.agent-memory/tdd-spec/<slug>.md`. The tester's definition reads the `worktree=` key as its working directory.

## Step 5: Round loop

Start `no_progress_count` at 0. Handle each tester return:

- `<sha>: <case>` (new red commit) → `no_progress_count = 0`. Main is this round's implementer:
  1. Read the failing test via `git show <sha>`.
  2. Write production code to make it pass. Follow the usual main-session flow (inlay, external rules).
  3. Actually run the full test suite and **verify everything is green** (no assumptions).
  4. Commit. The number of intermediate commits and the message format are free.
  5. Obtain the final green commit SHA via `git rev-parse HEAD` and `SendMessage(to: "tdd-adversary", message: "last-impl-sha=<sha>")`.
- `no-progress: <reason>` → `no_progress_count += 1`. If `>= 2`, go to Step 6 (`converged: 2 consecutive no-progress`). Otherwise `SendMessage(to: "tdd-adversary", message: "retry: try a new region or angle")`.
- `escalation: <issue>` → relay to the user as-is and wait for a decision. If the user chooses to continue, send that decision to the tester as `retry: <user directive>` and return to Step 5.

On a user stop signal, go to Step 6 immediately.

## Step 6: Termination

On convergence or user stop:
- Show the round summary via `git log --oneline`.

## Guardrails (core — invariant; the preserved tester depends on them)

- Do not modify or delete the tester's test files. Main touches production code only. Weakening the tests makes the tester meaningless.
- Before handing the turn back to the tester, HEAD MUST be a commit verified green by **actually running the full suite**.
- The spec lives at `.agent-memory/tdd-spec/<slug>.md` and is shared with the tester.
- Termination is decided by main based on the tester's consecutive no-progress signals.

## Recommendations (loose — not enforced)

- Avoid shortcuts like hardcoding test inputs or mirroring fixtures in a lookup. The tester will catch them with a counterexample on the next round and permanently encode it as a regression.

</pairtdd_instruction>

Task: $ARGUMENTS

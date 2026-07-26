---
name: handoff
description: Store the current session's work context as task sections in a single .agent-memory/HANDOFF.md for the next session to resume
disable-model-invocation: true
---

<handoff_instruction>
# handoff

Split the current session's work context by task and store it as sections of a single file, `.agent-memory/HANDOFF.md`. Write so a zero-context next-session Claude can resume immediately (not a human-style summary).

---

## Storage layout

- Path: `.agent-memory/HANDOFF.md` — one fixed file.
- If the file already exists, show its title line to the user and ask whether to overwrite before writing.
- Title line: `# Handoff — <title> (<timestamp>)`. The title captures the session's dominant theme; use `mixed` when the session is genuinely heterogeneous.
- Timestamp: obtain current time via `date +"%Y-%m-%dT%H%M"` or equivalent.

---

## Interaction protocol

A single invocation does not save immediately. **Only stages 1–2 are coordinated with the user**; once the grouping is confirmed, **stages 3–5 run automatically**.
During stages 1–2, expect repeated instructions ("exclude this", "expand that") and adjust on the fly.

### 1. Enumerate everything (user collaboration)
List **every** task context performed or discussed in the current session. The goal is to miss nothing.

### 2. Propose groupings (user collaboration)
Cluster by cohesion and present the proposal. Merge, split, drop, or add under the user's direction.

**Once the user confirms the grouping, stages 3–5 execute automatically without further confirmation.**

### 3. Auto-decide the title
Auto-select the title per the title-line rule in Storage layout. No user-approval step.

### 4. Auto-write the document
Auto-write the Index header and each task section. Empty subsections from the recommended list are auto-omitted.

### 5. Auto-save
Write immediately to `.agent-memory/HANDOFF.md` (after the overwrite check above). No separate final-approval step.

---

## Document structure

One file, two parts: an Index header at the top, followed by one `##` section per task.

### Index header

Always present. The next-session Claude's entry point.

- Task list (section name + one-line summary). Tag each entry with a `[done]` / `[active]` status marker. Exactly one `[active]` (or zero — when the session ends naturally).
- Priorities / dependencies
- Explicit guidance on where to begin reading
- Current context — name the single section marked `[active]`. **The sole source pickup uses to answer "what's next"**. If no active work, state `none (session closed)`.

### Task sections

- No fixed inner structure → split by task cohesion.
- Cohesive tasks = one section. Genuinely independent tasks = separate sections.
- Right sizing check: "Is each section understandable on its own to a zero-context next-session Claude?"

Suggested subsections per task (loose, omit when empty):
- Intent — what the user was trying to do, and why
- Progress so far — chronological trace
- Decisions and reasoning — options / the choice / the reason (guards against rollback)
- Open issues — unresolved / blockers / awaiting answer
- Next moves — immediately executable actions. **Record only on the single task that was active at session end.**

### Writing rules
- Reference code as **file path + line numbers + intent** only — no copied code blocks.
- Capture "why it was done / where it stands / next move", not just "what was done".

---

## Curate from session context only (soft rule)

Handoff curates only what the current session already knows.

Exceptions (filesystem exploration allowed):
- Resolving an ambiguity or contradiction
- When the user explicitly instructs exploration

---

## Memory promotion

If a piece of handoff content belongs to permanent project knowledge, promote it to memory (MEMORY.md) separately. Handoff itself is session-scoped.
</handoff_instruction>

$ARGUMENTS

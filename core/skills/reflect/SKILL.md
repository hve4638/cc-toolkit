---
name: reflect
disable-model-invocation: true
argument-hint: "[optional: slug hint or section title for the retrospection topic]"
---

<reflect_instruction>
# reflect

Extract user corrections and factual errors from the session, and add each item to an appropriate storage target (a skill or CLAUDE.md). In the next session, the same mistake is prevented.

Premise: a runtime with description-matching auto-trigger (Claude Code, Codex CLI, etc.) — this is the premise for `reflect-*` child skills to auto-fire. Without that mechanism, child skills behave as plain documents and the CLAUDE.md storage is simply loaded as text.

## reflect and outputs

- reflect: explicit invocation (`disable-model-invocation: true`). Performs retrospection thinking + storage decision + writing.
- Two kinds of outputs:
  - Skill `reflect-<slug>/SKILL.md` — auto-trigger candidate. Carries only future-facing instructions (no retrospective narration).
  - The `<reflection>...</reflection>` region inside CLAUDE.md — always loaded into context. `## sections` accumulate.

---

## Storage — four cells

Axis 1 (form) — at what moment must it fire to be effective?
- At the moment a specific tool/command is invoked → skill (auto-fires at that moment via description matching)
- Across the whole workflow / every session start → CLAUDE.md (always loaded into context)

Axis 2 (scope) — how far do you want it to reach?
- Every project → global
- This project only → project

| Cell | Path | Confirmation |
|---|---|---|
| Global skill | `~/.claude/skills/reflect-<slug>/SKILL.md` | User confirmation |
| Project skill | `.claude/skills/reflect-<slug>/SKILL.md` | Automatic |
| Global CLAUDE.md | `~/.claude/CLAUDE.md` | User confirmation |
| Project CLAUDE.md | `./CLAUDE.md` | Automatic |

User confirmation moments (three):

1. Cell selection — for items judged to land in a global cell, present the judgment result (cell + path) and confirm. On refusal, change cell or skip.
2. Merge decision — for a new item in a global cell that is a merge candidate with an existing rule, present the combined single line. Ask the user to choose merge / split / skip.
3. Overwrite (cell-agnostic) — if a skill with exactly the same slug already exists, confirm (no automatic overwrite).

For project cells, 1 and 2 are automatic; 3 is user-confirmed regardless of cell.

---

## Self-exploration principle

Retrospection extraction (Step 1) grounds itself in the session context alone. No git, grep, web, or file re-reads. Items requiring out-of-session information are excluded (purpose: block guesses and reinterpretation).

## Retrospection categories

Leave an axis blank if nothing fits — do not force-fill.

### 1. Points the user corrected

Extract from utterances where the user explicitly corrected, refuted, or redirected.

- Examples: "no, that's not it", "X is the right one", "not that way".
- Only corrections of the Agent's wrong action or assumption count. Plain priority changes or pivots are excluded.
- Praise or confirmations are excluded.

### 2. Misknown or outdated facts

Factual errors that became objectively evident inside the session.

- Calls to nonexistent functions/options/paths confirmed by errors.
- Assumptions about old behaviors of tools/APIs/models contradicted by actual output.
- Category 1 takes priority. If a user correction is itself a factual error, record it under 1 only (avoid duplication).

## Workflow

### Step 1. Extract retrospection items

Sweep the session context for items in either category. Use these four slots as internal thinking aids (do not put them in the child):

1. `Past action` — the prior action or assumption (one line)
2. `Signal` — how the mistake came to light (user utterance / error message / output mismatch)
3. `Correct form` — what is correct
4. `Generalization` — neighboring situations where the same mistake could recur

### Step 2. Storage decision

Assign each item to one of the four cells:

1. Does `Generalization`'s firing moment narrow down to a specific tool/command invocation? → skill. If it spans the whole workflow / every session → CLAUDE.md.
2. Do you want it applied as-is to other projects? → global. This project only? → project.

For global cells, ask the user. For project cells, proceed automatically.

### Step 3. Name decision

- Skill cell: English kebab-case slug, ≤30 chars, scoped to the narrowest trigger context.
  - Good: `git-rebase-no-edit-flag`, `bash-find-regex-order`, `tsx-jsx-key-prop`
  - Bad: `general-tips`, `mistakes`, `learning-20260430`
- CLAUDE.md cell: a concise noun phrase (Korean allowed). Form: `## Verify mechanism before asserting`.

### Step 4. Merge decision

Check whether a new item folds into the same guardrail as an existing rule in the same storage.

Criterion: when the two `Correct form` slots are combined into a single line, is neither side's correct answer lost and no meaning destroyed?

- Combines without meaning loss → merge candidate
- Combining blurs one side's correct answer → split

Merge candidate handling:

- Global cell → present the combined single line to the user and ask merge / split / skip.
- Project cell → automatic merge.

Overwrite safeguard (cell-agnostic):

- Skill: if a skill with exactly the same slug already exists, confirm (no automatic overwrite).
- CLAUDE.md: if a `## section` for the same discipline already exists inside `<reflection>`, update it (following the section-span replacement rule in Step 5).

#### Decision examples

| A's Correct form | B's Correct form | Combined single line | Decision |
|---|---|---|---|
| Confirm flag is valid for `git rebase` | Confirm flag is valid for `git rebase` | "Verify the flag belongs to `git rebase` before using it" | Merge |
| Use `'foo' in d` | Use `np.float64` | "Avoid deprecated APIs" | Split (single line drops both exact alternatives) |

### Step 5. Writing

Only `Correct form` and `Generalization` flow into storage. Include only items and mechanisms actually encountered in the session — outside general knowledge is forbidden. Mechanism abstractions (e.g., "verify it actually exists before calling it") are generalizations of session-observed cases and are allowed.

#### Skill cell

Write `reflect-<slug>/SKILL.md`. Skeleton:

```yaml
---
name: reflect-<slug>
description: "<trigger + WHY. Do not put rules here.>"
---

# Rule
<what to do / not to do. The body is the center.>

# Not a violation
<one or two cases where this rule does not apply. May be omitted entirely.>
```

When writing the description, apply the description rules from [writing-great-skill](../writing-great-skill/SKILL.md). The WHY clause is abstracted from the `Past action` / `Signal` slots as a failure-mode generalization. The WHY clause must be written as a *trigger condition for the failure mode* (the context to be encountered again), not as a *retrospective fact* (what happened during the session).

#### CLAUDE.md cell

Add a `## section` inside the `<reflection>...</reflection>` of the target file (global `~/.claude/CLAUDE.md` or project `./CLAUDE.md`).

- No `<reflection>` in the file → append a new block at the end of the file. The block begins with one guidance line + a blank line + the first `## section`.
- Already present → insert the new `## section` after the last `## section` inside the block.
- If a `## section` for the same discipline exists, replace that *section span*.

Span definitions:

- Preserved span — everything from the line after the `<reflection>` opening tag up to the line just before the first `## `. reflect does not touch this span (guidance line, user-added comments, blank lines — all preserved).
- Section span — from the corresponding `## <title>` to the line just before the next `## ` (or the line just before `</reflection>` for the last section). On update, the entire span is replaced with the new body.

Body format (on first creation):

```markdown
<reflection>
이 태그 내 목록은 실수할 가능성이 높거나, 사용자의 방향성과 맞지 않는 부분을 기록한 것으로 관련 작업 시 강하게 참고하여야 한다.

## <Section title>

<Discipline body — one paragraph or short bullets>
</reflection>
```

For subsequent additions to the same block, leave the preserved span untouched and append a new section after the last `## section`.

### Step 6. Report and stop

Report briefly to the user and stop. Do not propose further retrospection.

- N items → N outputs (K skills, M CLAUDE.md sections, P merged, L skipped)
- For each output: its location and a one-line summary

## Empty retrospection

If neither user corrections nor factual errors are present, write nothing and report that in one line. Form-filling retrospections accumulate as system noise.

## Notes

- Only the `<reflection>...</reflection>` region of CLAUDE.md is updated. The user-authored region outside it is never touched.
- Child skills (`reflect-*`) are auto-trigger candidates via description matching, so do not put `disable-model-invocation` in their frontmatter.

</reflect_instruction>

$ARGUMENTS

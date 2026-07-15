---
name: stage
description: Stage current changes by intent and recommend a consistent commit message. Does not commit.
disable-model-invocation: true
---

<stage_instruction>
Review git changes → stage by intent → propose a commit message that matches the repository's convention. **Never run the commit itself.**

## Procedure

1. Inspect changes with `git status` and `git diff`.
2. Stage by intent using explicit `git add <path>`.
   - Avoid `git add .` / `-A` — risk of pulling in `.env`, credentials, or build artifacts.
   - If a single change mixes two intents, propose splitting the staging.
3. Run `git log --oneline | head -n 10` to confirm the repository's convention (the repo log always wins).
4. Present commit-message candidate(s) that match the convention, then stop.

## Convention (repo log overrides)

header: `type(scope): subject`
- Omit `scope` when not needed.
- Common types: feat, fix, docs, refactor, test, chore, ci, etc.
- Keep `subject` short and concrete; no trailing period.
- Breaking changes use `!` (e.g., `feat(api)!: ...`).

Omit the body when the subject is sufficient.

**No Co-authored-by** — do not add it unless the user explicitly asks.

## Output

- Staging summary (`git status --short`)
- Recommended commit message (1–3 candidates if useful)
- Reason for any change deliberately left unstaged
</stage_instruction>

Task: $ARGUMENTS

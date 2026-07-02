---
name: context-guide
description: "Review context files (CLAUDE.md, AGENTS.md, SKILL.md, SKILL.ko.md) against the authoring checklist and fix violations. Use when the user asks to review, audit, or re-check a context or instruction file."
disable-model-invocation: true
argument-hint: "[file paths]"
---

# context-guide

1. Resolve the targets: the files the user names; when none are given, context files (CLAUDE.md / AGENTS.md / SKILL.md / SKILL.ko.md) with uncommitted changes (`git status --porcelain`).
2. For each target, read the checklist matching its basename:
   - `SKILL.md`, `SKILL.ko.md` → [assets/review-skill.ko.md](assets/review-skill.ko.md)
   - `CLAUDE.md`, `AGENTS.md` → [assets/review-context.ko.md](assets/review-context.ko.md)

   The `{{file}} 수정됨` opener line is hook-only — skip it. Apply the numbered items to the whole file, not just recent changes.
3. Fix violations directly, then report per item: `1 문제없음, 2 고침(내용), …`.

Task: $ARGUMENTS

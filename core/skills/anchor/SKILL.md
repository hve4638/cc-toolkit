---
name: anchor
description: Write ANCHOR.md, a project's list of invariants that feature proposals are checked against; amend it only on a real change of direction
disable-model-invocation: true
argument-hint: "[the project's invariants, roughly]"
---

<anchor_instruction>
# anchor

Write ANCHOR.md. ANCHOR.md is a project's list of invariants: the properties it must keep and the things it deliberately won't do.
Implementation state, rules, and plans are not ANCHOR.md's concern.

## No ANCHOR.md yet

Start from the items the user gives, roughly stated.

- Derive the goals and non-goals from the items the user gave.
- Have the user review them before finalizing.

The format:
```md
# ANCHOR

This document holds the project's goals and non-goals. When new work conflicts with a goal or a non-goal, ask the user to decide.

## Goal
- ...

## Non-Goal
- ...
```

## ANCHOR.md already exists

ANCHOR.md is frozen by default. Amend it only when an invariant itself changes. A moved implementation detail is not a reason to amend.

- Confirm it is a genuine change of direction before editing.
- Amend only the items that changed; leave the rest as written.

## Adding to CLAUDE.md

Add one line to the project's `CLAUDE.md` (create it if absent):
- When adding or modifying a feature, check the proposal against `ANCHOR.md` for conflicts.
</anchor_instruction>

$ARGUMENTS

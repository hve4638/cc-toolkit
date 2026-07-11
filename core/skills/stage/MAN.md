---
description: "Stage git changes by intent and get a convention-matched commit message, without committing"
---

# stage

## Purpose

Prepares a commit without making one. Sorts working-tree changes into intent-sized staging and recommends a commit message that matches the repository's existing convention, instead of everything landing in one lump with an invented message.

## Invocation

`/stage` — no argument required; free text after the command is passed in as task context.

The skill is also model-invocable: the agent may load it on its own when staging work comes up.

## Behaviour

1. Inspects changes with `git status` and `git diff`.
2. Stages by intent using explicit `git add <path>` — never `git add .` or `-A`, to avoid pulling in `.env`, credentials, or build artifacts. If one change mixes two intents, it proposes splitting the staging.
3. Reads the last 10 commit subjects to detect the repository's message convention; the repo log always wins over the built-in default.
4. Presents 1–3 commit-message candidates and stops. It never runs `git commit`.

## Outputs

- Staging summary (`git status --short`)
- Recommended commit message (1–3 candidates)
- Reason for any change deliberately left unstaged

## Caveats

- Mutates the git index (staging) as its side effect; it does not commit, push, or modify files.
- Built-in convention is `type(scope): subject` with no trailing period; a differing convention in the repo log overrides it.
- Adds no `Co-authored-by` trailer unless the user explicitly asks.

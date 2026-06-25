---
name: wt
description: "Drop a ./mkwt.sh into the project so the user can spin up git worktrees (branched off HEAD) with one command"
disable-model-invocation: true
---

<wt_instruction>
# wt — set up ./mkwt.sh

`/wt` is a one-time setup. It drops a self-contained `./mkwt.sh` into the project root and hides it from git. From then on the user creates worktrees themselves by running `./mkwt.sh <branch>`.

## Decide where the repo is, then assemble

You decide one thing: `<repo-rel>` — the path from the directory where `mkwt.sh` is dropped to the repo it drives. Pick the drop directory and `<repo-rel>` from the project shape:

- The project root is itself the repo → drop there, `<repo-rel>` is `.`
- The project root is a container holding the repo as a subfolder → drop at the container, `<repo-rel>` is that subfolder's name
- The user named a specific repo/location → use it

When it is ambiguous (several repos present, unclear which directory is the root), ask the user rather than guessing.

Then, from the chosen drop directory, run the assembler with that value:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-init.sh" <repo-rel>
```

`wt-init.sh` is mechanical: it bakes `<repo-rel>` and the `wt-land`/`wt-destroy` helpers (base64) into a self-contained `mkwt.sh`, makes it executable, and registers `/mkwt.sh` in `.git/info/exclude` when `<repo-rel>` is `.`. It decides nothing — if `<repo-rel>` doesn't point at a repo root it errors. Report its output to the user. To regenerate after a template change, remove `mkwt.sh` and re-run.

## What the user runs

```bash
./mkwt.sh <branch-name>     # e.g. ./mkwt.sh feat/login
```

It branches a new worktree off the repo's current HEAD. The branch keeps the name you give — `feat/login` stays `feat/login`; only the worktree folder is sanitized to a filesystem-safe slug (`/` → `-`, git-forbidden characters dropped) and always placed at `<repo>.worktrees/<slug>` next to the repo (e.g. `feat-login`). It drops `wt-land`/`wt-destroy` into the worktree.
- Inside tmux at an interactive terminal: opens a new tmux window rooted at the worktree, named after the branch.
- Otherwise (run non-interactively — output piped or captured): prints the worktree path to cd into.

`mkwt.sh` is primarily the user's command — relay it rather than running it unprompted (running it creates a branch + worktree). If you do run it, it is tmux-safe: with stdout not a terminal (a tool call or `$(...)`), it skips the tmux window and just prints the worktree path.

## Finish / discard

Each worktree carries the two helpers (hidden from `git status`); call them by path from outside the worktree:

```bash
<worktree>/wt-land -m "feat: ..."     # squash the worktree's commits onto the parent branch, then remove it
<worktree>/wt-destroy                 # discard the worktree (prints a confirmation key if it holds work)
```

When `wt-destroy` stops with a key, relay the warning and confirm intent with the user before re-running with the key. See README.md for the full wt-land / wt-destroy mechanics.
</wt_instruction>

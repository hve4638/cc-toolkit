---
name: wt
description: "Drop a ./mkwt.sh into the project so the user can spin up git worktrees (branched off HEAD) with one command"
disable-model-invocation: true
---

<wt_instruction>
# wt — set up ./mkwt.sh

`/wt` is a one-time setup: it drops a self-contained `./mkwt.sh` into the project root and hides it from git.

## Decide where the repo is, then assemble

You decide two things. First, `<repo-rel>` — the path from the directory where `mkwt.sh` is dropped to the repo it drives. Pick the drop directory and `<repo-rel>` from the project shape:

- The project root is itself the repo → drop there, `<repo-rel>` is `.`
- The project root is a container holding the repo as a subfolder → drop at the container, `<repo-rel>` is that subfolder's name
- The user named a specific repo/location → use it

When it is ambiguous (several repos present, unclear which directory is the root), ask the user rather than guessing.

Second, ask the user whether the tmux window mkwt opens should auto-launch `claude`. If yes, pass `claude` as the second argument below; if no, omit it.

Then, from the chosen drop directory, run the assembler:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-init.sh" <repo-rel> [claude]
```

`wt-init.sh` is mechanical: it bakes `<repo-rel>`, the claude choice, and the `wt-land`/`wt-destroy` helpers (base64) into a self-contained `mkwt.sh`; makes it executable; drops a shared `CLAUDE.md` into the `<repo>.worktrees/` group folder (kept if it already exists); and registers `/mkwt.sh` in `.git/info/exclude` when `<repo-rel>` is `.`. It decides nothing — if `<repo-rel>` doesn't point at a repo root it errors. Report its output to the user. To regenerate after a template change, remove `mkwt.sh` and re-run.

## After assembling

`mkwt.sh` is the user's command — relay it rather than running it unprompted (running it creates a branch + worktree). If you do run it, it is tmux-safe: with stdout not a terminal (a tool call or `$(...)`), it skips the tmux window and just prints the worktree path.

wt-init's output already states how to run `mkwt.sh`; relay that. The mkwt / wt-land / wt-destroy mechanics belong elsewhere, not here: README.md for maintainers, and the `CLAUDE.md` dropped into each worktree for the session working there.
</wt_instruction>

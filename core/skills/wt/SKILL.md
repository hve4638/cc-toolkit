---
name: wt
description: "Drop a ./mkwt.sh into the project so the user can spin up git worktrees (branched off HEAD) with one command"
disable-model-invocation: true
---

<wt_instruction>
# wt — set up ./mkwt.sh

`/wt` is a one-time setup: it drops a self-contained `./mkwt.sh` plus its `.wtrc`
into the project and hides them from git.

`mkwt.sh` runs on its own once `.wtrc` is filled in. Place the pair somewhere
sensible and fill in the parts that need a human answer.

## 1. Decide where the repo is, then assemble

Decide `<repo-rel>` — the path from the directory where `mkwt.sh` is dropped to
the repo it drives. Pick the drop directory and `<repo-rel>` from the project
shape:

- The project root is itself the repo → drop there, `<repo-rel>` is `.`
- The project root is a container holding the repo as a subfolder → drop at the
  container, `<repo-rel>` is that subfolder's name
- The user named a specific repo/location → use it

When it is ambiguous (several repos present, unclear which directory is the
root), ask the user rather than guessing.

Then, from the chosen drop directory, run the assembler:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-init.sh" <repo-rel>
```

`wt-init.sh` is mechanical: it bakes the per-worktree `wt` helper (base64) into a
self-contained `mkwt.sh`, runs `mkwt.sh init <repo-rel>` to write a starting
`.wtrc` and register the git excludes, then drops a shared `CLAUDE.md` into
whatever worktree folder that `.wtrc` names. It decides nothing — if
`<repo-rel>` doesn't point at a repo root it errors. Report its output to the
user. To regenerate after a template change, remove `mkwt.sh` and re-run.

## 2. Ask what a new worktree should open, then write the hook

`wt-init.sh` leaves `.wtrc`'s `post_create` commented out: what a new worktree
should open is a question only the user can answer, and it gets answered here,
once. The hook then behaves the same on every `mkwt.sh` run.

Ask the user:

1. Open a tmux window for each new worktree? (no → leave `post_create` out)
2. Start `claude` in that window?
3. Open it when an agent or a script runs `mkwt.sh` too, or only when the user
   runs it from a terminal?
4. A window-name prefix? (empty = branch name as-is)

Then edit `.wtrc` with their answers:

```sh
# Window-name prefix; empty = branch name as-is (win_prefix=wt: opens "wt:fix/x")
win_prefix=

post_create() {
  [ -n "${TMUX:-}" ] || return 0          # windows only exist inside tmux
  [ "$WT_INTERACTIVE" = 1 ] || return 0   # (3) terminal runs only; drop the line to open in every run
  win=$(tmux new-window -P -F '#{window_id}' -c "$WT_PATH" -n "${win_prefix}${WT_BRANCH}") || return 0
  tmux send-keys -t "$win" 'claude' Enter # (2) drop if claude should not start
}
```

Use `send-keys` rather than `tmux new-window <cmd>` — the latter runs a
non-interactive shell and would skip the user's aliases and functions.

If they want something else entirely (another multiplexer, an editor, a
notification), write that instead; the hook is plain shell and `.wtrc` documents
the variables it receives. A notification usually should fire in captured runs
too, where a window should not.

One rule holds for any hook: leave the worktree path to `mkwt.sh` — it prints the
path, and callers capture that.

## After assembling

`mkwt.sh` is the user's command — relay it rather than running it unprompted
(running it creates a branch + worktree). When running it anyway, capture with
`$(...)` — that yields the worktree path and sets `WT_INTERACTIVE=0`, so a hook
baked for terminal runs only leaves the user's terminal alone.

wt-init's output already states how to run `mkwt.sh`; relay that. For mkwt,
`.wtrc`, and `wt merge` / `wt land` / `wt destroy` mechanics, point at README.md
(maintainers) and the `CLAUDE.md` dropped into each worktree (the session
working there).
</wt_instruction>

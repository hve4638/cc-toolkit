---
name: wt
description: "Drop a ./mkwt.sh into the project so the user can spin up git worktrees (branched off HEAD) with one command"
disable-model-invocation: true
---

<wt_instruction>
# wt — set up ./mkwt.sh

`/wt` is a one-time setup: it drops a self-contained `./mkwt.sh` plus its `.wtrc`
into the project and hides them from git.

`mkwt.sh` runs on its own once `.wtrc` is filled in. Your job is to place the
pair somewhere sensible and fill in the parts that need a human answer.

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

## 2. Write the post_create hook

`wt-init.sh` deliberately leaves `.wtrc`'s `post_create` commented out, because
what a new worktree should open is a question only the user can answer. Ask
them, then edit `.wtrc` yourself.

Ask what should happen when a worktree is created. The common answer is a new
tmux window, optionally with `claude` started in it:

```sh
post_create() {
  [ "$WT_INTERACTIVE" = 1 ] || return 0
  win=$(tmux new-window -P -F '#{window_id}' -c "$WT_PATH" -n "$WT_BRANCH") || return 0
  tmux send-keys -t "$win" 'claude' Enter
}
```

Drop the `send-keys` line if they don't want `claude` launched. Use `send-keys`
rather than `tmux new-window <cmd>` — the latter runs a non-interactive shell and
would skip the user's aliases and functions.

If they want something else entirely (another multiplexer, an editor, a
notification), write that instead; the hook is plain shell and `.wtrc` documents
the variables it receives. Leave `post_create` out altogether if they want
nothing — `mkwt.sh` then just prints the path.

Two rules to keep whatever you write correct:

- **Guard terminal-only side effects with `WT_INTERACTIVE`.** It is `1` when a
  user is at a terminal and `0` when output is captured by a script or an agent.
  Opening a window in a captured run would spawn stray windows; a notification,
  by contrast, should usually fire either way — which is why the hook decides
  rather than mkwt.
- **Never write the worktree path yourself.** `mkwt.sh` prints it, and callers
  capture that.

## After assembling

`mkwt.sh` is the user's command — relay it rather than running it unprompted
(running it creates a branch + worktree). If you do run it, `$(...)` capture
gives you the worktree path and sets `WT_INTERACTIVE=0`, so a well-written hook
leaves the user's terminal alone.

wt-init's output already states how to run `mkwt.sh`; relay that. The mkwt,
`.wtrc`, and `wt merge` / `wt land` / `wt destroy` mechanics belong elsewhere, not here:
README.md for maintainers, and the `CLAUDE.md` dropped into each worktree for the
session working there.
</wt_instruction>

---
name: wtree
description: "Set up policy-based worktree management for a repo: a TUI pane (or fallback step scripts) composes the standalone wtree CLI's policy rules, settings, post-create hooks, and worktree CLAUDE.md"
disable-model-invocation: true
---

<wtree_instruction>
# wtree — set up the wtree policy for this repo

`/wtree` is a one-time setup for the standalone `wtree` CLI, run against the repo containing the cwd. It composes what the CLI cannot decide alone: the policy rules, the machine settings, post-create hooks, and a CLAUDE.md for the worktree folder.

Two routes. Inside tmux (`$TMUX` set), use the TUI pane. Outside tmux, do not fall back on your own: recommend re-running inside tmux, mention the step-script route as the alternative, and take it only when the user explicitly asks for it. When talking with the user in Korean, append `--ko` to whichever script you run.

## TUI route (default inside tmux)

The user answers directly in a showcase pane; deterministic work happens there, and prose work comes back to you through a handoff file.

1. From the repo directory, open the pane:

```bash
showcase exec node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/tui.mjs"
```

2. Tell the user to complete the prompts in the pane, then end your turn and wait. Do not poll or drive the pane — it is the user's.
3. When the user says the pane is done, read the handoff file and follow it — same tags as below:

```bash
cat "$(git rev-parse --path-format=absolute --git-common-dir)/wtree-setup-handoff.md"
```

The handoff hands you the review work, then an apply-pane command — the same open-wait-read loop once more. If the handoff file is missing or the pane closed at once, run the step route below to see the state.

## Step route (fallback)

The step scripts guide the whole run. Start below and follow each output.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/step1.mjs"
```

## Tag blocks

Script outputs and the handoff file both come as tagged blocks:

- `<status>` — first line of every output: `Required Answer` (fill the keys and re-run) | `Success` (the step's action is done) | `Blocked` (the environment prevents the setup) | `Error` (wrong input or route)
- `<info>` — state, results, and instructions; follow it
- `<require>` — keys the answer still needs, with value hints
- `<question>` — ask the user exactly this, via the AskUserQuestion tool
- `<alert>` — a warning to relay to the user
- `<error>` — what is wrong; nothing was changed
- `<next>` — the command to run next
- `<output cmd="...">` — raw output of that command

When a script or a `wtree` command fails it prints why — relay that to the user and stop.
</wtree_instruction>

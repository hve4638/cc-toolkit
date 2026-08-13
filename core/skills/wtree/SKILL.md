---
name: wtree
description: "Set up policy-based worktree management for a repo: step scripts walk through composing the standalone wtree CLI's policy rules, settings, post-create hooks, and worktree CLAUDE.md"
disable-model-invocation: true
---

<wtree_instruction>
# wtree — set up the wtree policy for this repo

`/wtree` is a one-time setup for the standalone `wtree` CLI, run against the repo containing the cwd. It composes what the CLI cannot decide alone: the policy rules, the machine settings, post-create hooks, and a CLAUDE.md for the worktree folder.

The step scripts guide the whole run. Start below and follow each output.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/step1.mjs"
```

Outputs come as tagged blocks:

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

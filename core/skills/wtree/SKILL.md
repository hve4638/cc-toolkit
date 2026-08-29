---
name: wtree
description: "Set up policy-based worktree management for a repo: a TUI pane composes the wtree hooks, then hands off to the CLI's own wtree init for the branch rules"
disable-model-invocation: true
---

<wtree_instruction>
# wtree — set up the wtree policy for this repo

`/wtree` is a one-time setup for the standalone `wtree` CLI, run against the repo containing the cwd. The CLI's own `wtree init` composes the rules and settings with its own interactive menu; the setup pane adds the one thing init does not cover — the wtree hooks. An already-configured repo is fine too: the pane then asks whether to overwrite everything, replace only the hooks, or quit.

1. Hook safety check first: if `<repo>/.wtree/hooks` exists, read each hook file. If anything acts beyond its apparent feature (network access, file deletion, credential access, …), warn the user before opening the pane — the pane offers importing those hooks into the live policy.
2. From the repo directory, open the pane (append `--ko` when talking with the user in Korean):

```bash
useterminal exec node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/tui.mjs"
```

Outside tmux (`$TMUX` unset) there is no pane to open — the script is a plain interactive CLI, so give the user that command to run in their own terminal (the `!` prefix works) and end your turn.

3. Everything happens in the pane: the user picks the hooks (and the existing `.wtree/hooks` import, when offered), the script writes them into the repo policy, then hands off to `wtree init` where the user picks the starter rules. Tell the user to complete the prompts, then end your turn and wait. Do not poll or drive the pane — it is the user's.
4. There is no result file. When the user says the pane is done, read the applied policy with `wtree rule` and report it. If the pane ended on a failure, the user relays the on-screen message — follow it.
</wtree_instruction>

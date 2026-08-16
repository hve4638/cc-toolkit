---
name: ut
description: "[useterminal] Opens and drives panes in the user's own tmux window so they can watch something happen. Use when the user asks for a demo or wants to see a program run live, or when output should land where the user can see it."
disable-model-invocation: true
---

<useterminal_instruction>
# useterminal

`useterminal` opens a terminal this session and the user look at together: a demo running, live output, a program being driven.

`useterminal` runs on tmux. Drive panes only through `useterminal`, never by calling `tmux` directly.

## Commands

| command | effect |
|---|---|
| `useterminal new` | open a pane running a shell; prints its KEY |
| `useterminal exec <command...>` | open a pane running the command; prints its KEY |
| `useterminal ls` | panes in this window: `KEY [WHERE] SIZE CMD` |
| `useterminal send KEY <text...>` | type text literally — no Enter appended |
| `useterminal key KEY <key...>` | press keys: `enter` `esc` `tab` `up` `c-c` `f5` …; modifiers `c-` `m-` `s-` |
| `useterminal read KEY [-n N \| --all] [--ansi]` | capture the screen; `-n N` adds the last N scrollback lines |
| `useterminal wait KEY` | block until the pane is gone — its command ended or it was closed; prints `closed` |
| `useterminal kill KEY` | close the pane |

Option detail beyond this table: `useterminal --help`.

## Rules

- A `new` pane stays until it is killed or its shell exits. Use it to carry a demo along, or to run several commands. Its shell starts without rc files, on a bare `$` prompt, so the user's aliases and functions are absent.
- An `exec` pane disappears the moment its command ends. Use it for one long-running program; a command that finishes at once can be gone before the pane is placed, and then the call fails.
- `exec` runs the command with no shell around it, so pipes and redirects need `exec sh -c '…'`.
- `wait` blocks with no timeout: run it with the Bash tool's `run_in_background` so the end arrives as a notification — a foreground call risks its own tool timeout, not the pane's command. It reports that the pane is gone, not how the command fared; outcome-sensitive runs belong in `vt`.
- Address panes by KEY only.
- The `ls` list holds panes this session did not open — another agent's, or the user's. Target only the KEYs this session opened.
- `kill` the panes this session opened once they have served their purpose.
- Terminal work the user has no reason to watch belongs in `vt`.
</useterminal_instruction>

$ARGUMENTS

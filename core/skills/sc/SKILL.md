---
name: sc
description: "[showcase] Opens and drives panes in the user's own tmux window so they can watch something happen. Use when the user asks for a demo or wants to see a program run live, or when output should land where the user can see it."
disable-model-invocation: true
---

<showcase_instruction>
# showcase

`showcase` opens a terminal this session and the user look at together: a demo running, live output, a program being driven.

`showcase` runs on tmux. Drive panes only through `showcase`, never by calling `tmux` directly.

## Commands

| command | effect |
|---|---|
| `showcase new` | open a pane running a shell; prints its KEY |
| `showcase exec <command...>` | open a pane running the command; prints its KEY |
| `showcase ls` | panes in this window: `KEY [WHERE] SIZE CMD` |
| `showcase send KEY <text...>` | type text literally — no Enter appended |
| `showcase key KEY <key...>` | press keys: `enter` `esc` `tab` `up` `c-c` `f5` …; modifiers `c-` `m-` `s-` |
| `showcase read KEY [-n N \| --all] [--ansi]` | capture the screen; `-n N` adds the last N scrollback lines |
| `showcase kill KEY` | close the pane |

Option detail beyond this table: `showcase --help`.

## Rules

- A `new` pane stays until it is killed or its shell exits. Use it to carry a demo along, or to run several commands. Its shell starts without rc files, on a bare `$` prompt, so the user's aliases and functions are absent.
- An `exec` pane disappears the moment its command ends. Use it for one long-running program; a command that finishes at once can be gone before the pane is placed, and then the call fails.
- `exec` runs the command with no shell around it, so pipes and redirects need `exec sh -c '…'`.
- Address panes by KEY only.
- The `ls` list holds panes this session did not open — another agent's, or the user's. Target only the KEYs this session opened.
- `kill` the panes this session opened once they have served their purpose.
- Terminal work the user has no reason to watch belongs in `vt`.
</showcase_instruction>

$ARGUMENTS

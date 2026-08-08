---
name: showcase
description: "Open panes next to you in the user's own tmux window, for demos and anything they should watch happen."
disable-model-invocation: true
---

<showcase_instruction>
# showcase

Put things where the user can watch them: a demo running, live output, a program
being driven. Panes open in the tmux window the session already sits in.

If `showcase` reports it is not inside tmux, say so to the user and stop. Do not
reach for another way to show them something.

## Commands

| command | effect |
|---|---|
| `showcase new [-- command...]` | open a pane; prints its KEY |
| `showcase ls` | panes in this window: `KEY [WHERE] SIZE CMD` |
| `showcase send KEY <text...>` | type text literally — no Enter appended |
| `showcase key KEY <key...>` | press keys: `enter` `esc` `tab` `up` `c-c` `f5` …; modifiers `c-` `m-` `s-` |
| `showcase read KEY [-n N \| --all] [--ansi]` | capture the screen; `-n N` adds the last N scrollback lines |
| `showcase kill KEY` | close the pane |

## Rules

- `new` with no command opens a shell; drive it with `send` + `key enter` so the
  user sees the typing. `new -- <command>` runs it straight away, and that pane
  disappears the moment the command exits.
- The first `new` opens a column beside the one you sit in; every later one is
  added at the bottom of that column and the column's rows are levelled out. Your
  own column is never used, whichever side of the window it is on. Panes share the
  column, so `new` eventually fails with `no space for new pane`.
- Address panes by KEY only. The `WHERE` column (`right-top`, `left`, …) is for
  telling the user where to look; it changes as panes come and go, and is absent
  whenever the layout is too tangled to describe.
- Your own pane is not listed and cannot be targeted.
- The user's cursor never moves — a new pane does not take focus, so tell them
  where the new pane is. A zoom they set is put back too, and `showcase` says so
  on stderr: the pane is then hidden behind it until they un-zoom, so say that.
- `kill` panes this session opened once the demo is over. Everything in the window
  is reachable, including panes the user opened themselves, so aim carefully.
- Terminal work the user has no reason to watch belongs in `vt`.
</showcase_instruction>

$ARGUMENTS

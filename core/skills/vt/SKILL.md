---
name: vt
description: "Drive terminal sessions via the vt CLI: run shell commands with captured output and exit codes, type into interactive programs (TUIs, REPLs, installers), and read the rendered screen as text. Use when work needs a persistent shell, keystrokes, or screen observation over time; for stateless one-shot commands, plain Bash suffices. Linux/macOS only."
---

<vt_instruction>
# vt

Run terminal work in key-addressed virtual-terminal sessions. A session is a persistent shell with a screen: run commands in it, type into interactive programs, read the screen back as text.

Supported on Linux/macOS (requires tmux). Not available on native Windows.

## Commands

Global:

| command | effect |
|---|---|
| `vt new [dir]` | create a session starting in dir (default: cwd); prints its 4-hex KEY |
| `vt ls` | list sessions: `KEY PANES IDLE PATH` |

Session (KEY from `vt new`):

| command | effect |
|---|---|
| `vt KEY run [--timeout N] <cmd>` | run cmd in the session shell, wait, print its output; exits with cmd's exit code (default timeout 60s) |
| `vt KEY send <text>` | type text literally — no Enter appended |
| `vt KEY key <key...>` | press keys: `enter` `esc` `tab` `up` `c-c` `f5` …; modifiers `c-` `m-` `s-` |
| `vt KEY read [-n N \| --all] [--ansi]` | capture the screen; `-n N` adds the last N scrollback lines, `--all` everything |
| `vt KEY panes` / `vt KEY split [-h]` / `vt KEY focus %N` / `vt KEY kill %N` | list panes / split (prints new pane ID) / set default pane / close one pane |
| `vt KEY status` | current path, running command, screen size |
| `vt KEY close` | end the session |

Option detail beyond this table: `vt --help`.

## Workflow

1. `vt new` — note the printed KEY; every session command needs it.
2. Shell commands: `vt KEY run '<cmd>'` — output and exit code return when the command finishes.
3. Interactive programs (TUI, REPL, prompt): `send`/`key` to type, `read` to observe; loop until the goal state is on screen.
4. `vt KEY close` — done when `vt ls` lists no session this run created.

## Rules

- `run` works only while the session shell sits at its prompt; while a program occupies the pane, drive it with `send`/`key`/`read`.
- `run` options go before the command; every token after the command's first word reaches the shell untouched.
- `run` rejects multi-line commands; deliver those with `send` + `key enter` line by line.
- When `run` reports a stuck or timed-out command, inspect with `read` and interrupt with `key c-c`.
- Sessions persist across turns until closed.
</vt_instruction>

$ARGUMENTS

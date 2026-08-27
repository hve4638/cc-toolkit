# addon

Addons are core's session extensions: features that run on Claude Code's hook events — at session start, around tool calls, when a turn stops. Some run always; others are gated behind a named rule that stays off until enabled. Enabling a rule changes what the agent is told or allowed to do in the sessions it covers — injected guidance, tool-call guards, and the like.

## Enabling

Rules are switched in agentaddon `event` files. One entry per line.

| File | Scope |
|---|---|
| `~/.config/agentaddon/event` | global — every session, read first |
| `<dir>/.config/agentaddon/event` | every ancestor directory of the session root, filesystem root first |
| `<session root>/.config/agentaddon/event` | closest — wins |

The files are concatenated in that order and read top to bottom; the **last matching line** decides an entry's state, so the layer closest to the session wins. The session root is where the session started (where `.claude` lives) and is fixed at session start — changing directories later does not move it. The ancestor layer exists for workspace-style nesting: one line in a workspace folder covers every repo and worktree opened under it.

## Line syntax

```
# turn on:
rule-name
# turn on with arguments (bare key = true):
rule-name@key=value,flag
# turn off:
!rule-name
# turn off everything listed so far, earlier layers included:
!*
```

- Blank lines and lines starting with `#` are ignored. There are no trailing comments — anything after the name on the same line makes the whole line silently invalid.
- Names use lowercase letters, digits, `-`, and `:`. A prefix like `rule:` in `rule:banaction` is a naming convention, not syntax.
- `*` is for negation only and matches any run of characters, anywhere in the pattern: `!know:*` turns off every name starting with `know:`; a name listed again after `!*` is back on.
- A later line replaces the earlier one **whole, arguments included** — argument sets are not merged key by key. Negation matches by name only, ignoring arguments.
- Unknown names are ignored — a typo silently does nothing.

## What can be enabled

The rule names this installation knows: run `/available-addon-rule`. What each rule does is that rule's own documentation (for example `/man-banaction` for `rule:banaction`).

## Always-on addons

Some addons run regardless of configuration. They have no rule name, do not appear in the available list, and `!*` does not reach them. When a behavior persists with everything negated, it is one of these.

## Switches only

agentaddon holds what to turn on, nothing else. A feature's actual configuration lives in its own file — enabling `rule:banaction` makes the session read `.banaction` files; the ban rules themselves never move into agentaddon. Arguments are small knobs attached to the switch, not a container for settings.

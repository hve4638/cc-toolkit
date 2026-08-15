# banaction

banaction is a tool-call guard shipped with the core plugin, running as an addon on the PreToolUse hook. Before Claude Code executes any tool call — Bash, Write, MCP tools, anything — it checks the call against rules in `.banaction` files and denies it on a match. Without a `.banaction` file it does nothing.

## Enabling

banaction runs only when an agentaddon `event` file turns it on. Write the line where it should apply:

```
# ~/.config/agentaddon/event — every session
# <dir>/.config/agentaddon/event — sessions under dir
rule:banaction
```

## Location

| File | Scope |
|---|---|
| `~/.banaction` | global — every session, read first |
| `<dir>/.banaction` | every ancestor directory of the session root, filesystem root first, session root last (session root = `CLAUDE_PROJECT_DIR`) |

All files are read and merged additively; a missing file is skipped. There is no un-ban syntax: a closer file cannot lift an outer rule.

## Rule format

One rule per line. Blank lines and lines starting with `#` are ignored.

| Line | Meaning |
|---|---|
| `<regex>` | Bash rule — denies Bash when the command matches |
| `<tool-matcher>: <regex>` | tool rule — denies matching tools when their input matches |

- Regexes are JavaScript syntax, case-sensitive, unanchored — `git push` matches anywhere in the command; anchor with `^`, `$`, or `\b` for precision.
- The tool matcher is itself a regex, matched against the whole tool name (`^…$` anchored): `Edit` does not match `MultiEdit`; `mcp__github__.*` bans an entire MCP server.
- The space after the colon is required, so a URL pattern like `http://x` stays a Bash rule. A Bash rule whose own text contains `: ` needs an explicit `Bash: ` prefix, or the part before the colon is taken as a tool matcher.
- What is matched: for Bash (bare lines and `Bash:` rules) only the command string — the human-readable description is ignored. For every other tool, every string value in the tool input, nested values included.
- Fallbacks: a pattern that fails to compile as a regex is used as a literal substring; a tool matcher that fails to compile falls back to exact tool-name comparison.

### Example

```
# Bash — bare lines
git push
git reset --hard
rm -rf

# tool-scoped
Write: \.env$
WebFetch: internal\.corp
mcp__github__.*: .*
```

## Deny message

The first matching rule denies the call; the model receives:

```
Blocked by BAN Action rule '<rule text>'. The user has banned this action. Do not retry or work around it; ask the user if it is truly required.
```

The rule text is included so the model stops retrying variants; the `.banaction` file name and path are not revealed.

## Failure behavior

banaction fails open: unreadable files, malformed lines, addon crashes, and the hook timeout (5s, shared with the event host) all let the tool call proceed rather than break the session. A catastrophically backtracking regex can push the hook past the timeout on every call, silently disabling the entire rule file.

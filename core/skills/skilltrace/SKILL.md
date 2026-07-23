---
name: skilltrace
description: "Scan local Claude Code transcripts (~/.claude/projects) and report usage statistics (skills, subagents, MCP tools, models/tokens, session paths) with date filters and period buckets."
argument-hint: "[period and/or question — e.g. 'last month, weekly' or 'which core skills are unused?']"
disable-model-invocation: true
---

<skilltrace_instruction>
# skilltrace

Answer usage questions about local Claude Code history through the `skilltrace` CLI. It scans every transcript under `~/.claude/projects` (subagent transcripts folded into their parent session, token usage deduplicated per API call).

## Invoke

`skilltrace` is on PATH (core exposes its `bin/`). If it is not found, fall back to:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/skilltrace/scripts/skilltrace.mjs" <command> …
```

## Commands

```
skilltrace scan   [--root DIR] [--since D] [--until D] [--out FILE]
skilltrace report [FILE|-] [--since D] [--until D] [--by day|week|month]
                  [--path SUBSTR] [--top N] [--format md|json] [--out FILE]
```

- `scan` emits one JSON line per session — the intermediate artifact.
- `report` aggregates scan lines. Given a FILE it reads that; given no input it scans fresh. `--format json` is the same report as md (same sections, rows, `--top` truncation), just serialized for machines.
- Dates: ISO (`2026-06-01`) or relative (`7d`, `4w`, `1m`, `1y`). All date filters and `--by` buckets go by each session's **last** activity timestamp.

## Workflow

1. Scan once into the scratchpad/tmp: `skilltrace scan --since 1m --out /tmp/…/scan.jsonl`.
2. Slice that artifact as many times as the question needs (`report FILE --since … --by week`, `--path <substr>` to focus one repo's sessions) — one scan serves every slice, and the jsonl reaches context only through report output.
3. Answer from the report output. If the user wants a file, pass `--out`.

## Reading the numbers

- The "Skills & commands" table merges two invocation channels per name: `user` (user-typed slash commands) and `model` (agent-made `Skill` tool calls), `total` = both. Builtin commands (`/compact` …) appear as user-only rows indistinguishable from skills — the table records occurrences, it does not classify them.
- To find *unused* items, start from what is currently defined — the target repo's `skills/`/`agents/` folders and configured MCP servers — and look each definition up in the report. Unmatched rows with a `plugin:` namespace are likely removed or renamed skills, not builtins.
- "Path tree" counts sessions at-or-under each branching directory; "(N exact)" is sessions whose cwd was exactly that node.
</skilltrace_instruction>

Task: $ARGUMENTS

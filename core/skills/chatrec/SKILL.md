---
name: chatrec
description: "Query and extract the current Claude Code session transcript by turn (count/search/clip/filter)"
argument-hint: "[what to extract or find — a task description or a question about the session]"
---

<chatrec_instruction>
# chatrec

Query the current session's transcript (the `.jsonl` log on disk) through the `chatrec` CLI. Locate a range, then extract just it — never load the whole transcript into context.

Work from chatrec's output, not in-context memory: a long session may have been summarized, so the file is the complete record while memory is lossy.

## Invoke

`chatrec` is on PATH (core exposes its `bin/`). If it is not found, fall back to:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/chatrec/scripts/chatrec.mjs" <command> …
```

It finds this session via `$CLAUDE_CODE_SESSION_ID` (cwd-independent → works in worktrees). First use builds an auto-cached slimmed copy; later calls reuse it (rebuilt only when the transcript has grown).

To target a different transcript (any command): `--session <id>` finds that session's `.jsonl` anywhere under `~/.claude/projects/`; `--source <jsonl>` reads an arbitrary transcript file directly. Caches don't clash — sessions key by id, sources by path.

## Records (flat jsonl, 4 roles)

```
{"t":N,"role":"user","text":…}
{"t":N,"role":"assistant","text":…}
{"t":N,"role":"tool_call","name":…,"tool_use_id":…,"input":{…}}
{"t":N,"role":"tool_result","name":…,"tool_use_id":…,"result":…,"is_error":…}
```

`t` = turn number (user-utterance ordinal). Content is preserved in full; thinking, attachments, and injected context are dropped.

## Commands

| command | output |
|---|---|
| `chatrec count` | total turns + role counts |
| `chatrec search [pat] [filters]` | matching turns → `T<t>  <role>  <snippet>` |
| `chatrec clip <from> [to]` | records of that turn range (jsonl) |
| `chatrec filter [filters]` | filtered records (jsonl) |

Filters (search·filter): `--role user,assistant,tool_call,tool_result` · `--tool Bash,Read` · `--match "text"` · `--from N --to M` · `--invert`.

`clip`/`filter` are jsonl→jsonl, so pipe them: `chatrec clip 4 8 | chatrec filter --tool Bash`. Add `--out <file>` to write a file instead of stdout.

## Workflow

1. `chatrec count` — gauge size.
2. Map the request to turns: `chatrec search "X"` (or `--tool` / `--role`) → matching `T<t>`.
3. Extract just that range: `chatrec clip <from> <to>`, narrowing with `filter`/pipe as needed.
4. Produce the deliverable:
   - "extract X" → the cleaned records of that range.
   - "what went wrong in X" → analyze that range and answer.
5. Write the result to a file and report its path (the user wants a file, not only chat output).

Keep outputs small — search snippets and narrow clips, never the whole transcript. The current turn (this call) may not be flushed yet, so target work that already happened.
</chatrec_instruction>

$ARGUMENTS

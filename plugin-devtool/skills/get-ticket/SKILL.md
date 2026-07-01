---
name: get-ticket
description: "Browse and open the global feedback tickets that core:ticket publishes (list/show)"
disable-model-invocation: true
argument-hint: "[list | show <ticket> | filters]"
---

<get_ticket_instruction>
# get-ticket

Query the global feedback-ticket store that `core:ticket` publishes. Tickets live under `~/.agent-memory/global/ticket/`: one `<sha256>.tar.gz` per ticket, plus one line in `index.jsonl` describing each.

## Invoke

There is no PATH launcher. Call the script directly:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/get-ticket/scripts/get-ticket.mjs" <command> …
```

## Commands

### `list [filters]`

Reads `index.jsonl` and prints an aligned table: short-sha, date, `plugin/skill_or_hook`, failure_type, severity, confidence, summary. Empty store prints `no tickets found`.

Filters combine with AND:

- `--plugin <name>`
- `--skill <name>`
- `--type <TECHNICAL_BUG|SPEC_MISMATCH|ENV_ISSUE>`
- `--severity <critical|high|medium|low>`
- `--confidence <CONFIRMED|SUSPECTED|SPECULATIVE>`
- `--match <text>` — case-insensitive substring of summary
- `--since <ISO date>` — keep `created_at >=` the value

### `show <selector> [--out <dir>]`

`<selector>` is a sha256 prefix or a ticket `id`. The script resolves it against the index, recomputes the archive's sha256 and checks it against the filename, extracts the tar.gz, and prints `report.md`. Paths to `session.jsonl` and `attachments/` are listed, not dumped. Extraction goes to `<out>/<sha-prefix>/` when `--out <dir>` is given, otherwise `~/.agent-memory/global/ticket/.unpacked/<sha-prefix>/`. Only that `<sha-prefix>` leaf is cleared, never the `--out` dir itself.

## Judgment

Reading a ticket and deciding what to fix in the named plugin is yours to weigh.
</get_ticket_instruction>

$ARGUMENTS

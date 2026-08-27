---
name: get-pluginissue
description: "Browse and open the global plugin issues that add-pluginissue publishes (list/show)"
disable-model-invocation: true
argument-hint: "[list | show <issue> | filters]"
---

<get_pluginissue_instruction>
# get-pluginissue

Query the global plugin-issue store that `add-pluginissue` publishes. Issues live under `~/.agent-memory/global/pluginissue/`: one `<sha256>.tar.gz` per issue, plus one line in `index.jsonl` describing each.

## Invoke

There is no PATH launcher. Call the script directly:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/get-pluginissue/scripts/get-pluginissue.mjs" <command> …
```

## Commands

### `list [filters]`

Reads `index.jsonl` and prints an aligned table: short-sha, date, `plugin/skill_or_hook`, failure_type, severity, confidence, summary. Empty store prints `no issues found`.

Filters combine with AND:

- `--plugin <name>`
- `--skill <name>`
- `--type <TECHNICAL_BUG|SPEC_MISMATCH|ENV_ISSUE>`
- `--severity <critical|high|medium|low>`
- `--confidence <CONFIRMED|SUSPECTED|SPECULATIVE>`
- `--match <text>` — case-insensitive substring of summary
- `--since <ISO date>` — keep `created_at >=` the value

### `show <selector> [--out <dir>]`

`<selector>` is a sha256 prefix or an issue `id`. The script resolves it against the index, recomputes the archive's sha256 and checks it against the filename, extracts the tar.gz, and prints `report.md`. Paths to `session.jsonl` and `attachments/` are listed, not dumped. Extraction goes to `<out>/<sha-prefix>/` when `--out <dir>` is given, otherwise `~/.agent-memory/global/pluginissue/.unpacked/<sha-prefix>/`. Only that `<sha-prefix>` leaf is cleared, never the `--out` dir itself.

## Judgment

Reading an issue and deciding what to fix in the named plugin is yours to weigh.
</get_pluginissue_instruction>

$ARGUMENTS

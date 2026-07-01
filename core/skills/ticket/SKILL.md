---
name: ticket
description: "Analyze a plugin (skill/hook) failure surfaced in the current session and archive it as a sealed feedback ticket"
disable-model-invocation: true
argument-hint: "[what went wrong — a description of the problem]"
---

<ticket_instruction>
# ticket

Analyze a plugin problem that surfaced in the current session and store it as a sealed feedback ticket. The archive is keyed by its own sha256, so once sealed it is immutable.

## Workflow

### 1. Locate the failure with ccrec

Use the `ccrec` skill to find the turns where the problem surfaced and extract just that span. That clip becomes `session.jsonl` in step 2, and its turn range fills `ccrec_range`.

### 2. Build the staging directory

Create `.agent-memory/ticket/<timestamp>_<slug>/` (project-local, gitignored; timestamp from `date +"%Y-%m-%dT%H%M"`, slug kebab-case). Inside it:

- `report.md` (required) — the frontmatter below plus prose.
- `session.jsonl` (required) — the `ccrec clip` output from step 1.
- `attachments/` (optional) — logs, repro files, screenshots.

### 3. Seal

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ticket/scripts/seal-ticket.mjs" <staging-dir>
```

It builds a tar.gz, computes its sha256, moves it to `~/.agent-memory/global/ticket/<sha256>.tar.gz`, appends one metadata line to `~/.agent-memory/global/ticket/index.jsonl`, and prints the final path and hash. Report those to the user.

## report.md frontmatter (fixed fields)

```yaml
id:               # e.g. tk-2026-06-30-001 (date-based, you assign)
created_at:       # ISO8601 UTC, immutable once written
taxonomy_version: "1.0"
plugin:           # plugin where it broke (best-guess + lower confidence if unsure)
skill_or_hook:    # skill/hook name (blank or a guess if unknown)
plugin_version:   # version from that plugin's .claude-plugin/plugin.json
failure_type:     # TECHNICAL_BUG | SPEC_MISMATCH | ENV_ISSUE
severity:         # critical | high | medium | low
confidence:       # CONFIRMED | SUSPECTED | SPECULATIVE
summary:          # one-line title (feature + behavior + result)
expected:         # intended behavior
actual:           # observed behavior
ccrec_range:      # "T<from>..T<to>"
```

Do not add a `content_hash` field. Integrity comes from the archive sha256 (the filename) and `index.jsonl`.

## report.md prose

Cover which feature broke and when, what, and why. Then, by `failure_type`:

- `TECHNICAL_BUG` — an implementation defect. Give repro conditions as a numbered list.
- `SPEC_MISMATCH` — the skill description and the actual behavior diverge. Show how it missed the user's intent.
- `ENV_ISSUE` — a dependency, version, or runtime condition. Name the condition.

End with `corrective_hint`: one line on how the next version should fix it. When a field is uncertain, say so and lower `confidence`.
</ticket_instruction>

$ARGUMENTS

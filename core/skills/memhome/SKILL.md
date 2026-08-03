---
name: memhome
description: "Relocate Claude Code auto memory into the repo via settings.local.json"
disable-model-invocation: true
argument-hint: "[custom memory path (optional)]"
---

<memhome_instruction>
# memhome

Move Claude Code auto memory from `~/.claude/projects/<slug>/memory/` into a directory that travels with the repo, by pointing `autoMemoryDirectory` in the project's `.claude/settings.local.json` at it.

## Workflow

### 1. Run the script

If the user provided a custom memory path, pass it as the argument; otherwise run with no argument (defaults to `<main-checkout>/.agent-memory/memory`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/memhome/scripts/relocate-memory.mjs" [custom-path]
```

### 2. Report

Relay the script's summary to the user in full: the memory target, the migrated file count, the settings change, and both follow-up notes.

### 3. On failure, stop

If the script exits non-zero, relay its output verbatim and wait for the user's decision. The script stays the sole actor for file moves and settings edits.
</memhome_instruction>

$ARGUMENTS

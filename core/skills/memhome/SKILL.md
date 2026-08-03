---
name: memhome
description: "Relocate Claude Code auto memory to a stable location via settings.local.json"
disable-model-invocation: true
argument-hint: "[custom memory path (optional)]"
---

<memhome_instruction>
# memhome

Move Claude Code auto memory from the path-dependent `~/.claude/projects/<slug>/memory/` to a stable location, by pointing `autoMemoryDirectory` in the project's `.claude/settings.local.json` at it.

## Workflow

### 1. Confirm the target

In a git repo, when the user did not specify a path, ask which destination to use and wait for the answer before running:

- Fixed path (default) — `~/.agent-memory/<repo-key>/memory`. Every worktree and clone of the same repo converges there, and the path stays valid wherever the repo moves.
- Inside the repo — `.agent-memory/memory` of the main checkout. Moves with the repo. If chosen, pass `.agent-memory/memory` as the argument (relative path arguments resolve against the main checkout root).

Outside git the target is `<project-root>/.agent-memory/memory`. The directory the script runs in becomes the project root, so run it from the project root.

### 2. Run the script

If the user provided a custom memory path or chose the in-repo option in step 1, pass that path as the argument; otherwise run with no argument:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/memhome/scripts/relocate-memory.mjs" [custom-path]
```

### 3. Report

Relay the script's summary to the user in full: the memory target, the migrated file counts per source, any warnings, the settings change, and both follow-up notes.

### 4. On failure, stop

If the script exits non-zero, relay its output verbatim and wait for the user's decision. When the output lists conflicting files, show that list to the user as-is, ask how they want the conflicts resolved, and wait for their decision. The script stays the sole actor for file moves and settings edits.
</memhome_instruction>

$ARGUMENTS

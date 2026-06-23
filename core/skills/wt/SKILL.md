---
name: wt
description: "Create a git worktree branched off the current branch (HEAD) in a separate folder"
disable-model-invocation: true
argument-hint: "[name] [base-ref]"
---

<wt_instruction>
# wt

Create a new git worktree branched off the current branch (HEAD), placed to match the project layout.

## Create

Run from the project root:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-new.sh" <name> [base-ref]
```

- `<name>` — worktree / branch slug. The script sanitizes whitespace and git-forbidden characters, and rejects a slug that reduces to empty.
- `[base-ref]` — start point to branch from. Defaults to current HEAD when omitted.

The script decides the location:
- Project root is a repo (git toplevel exists) → `<repo-parent>/<repo>.worktrees/<slug>/`
- Project root is a container holding a single repo → `<project-root>/<repo>-<slug>/`

The script prints only the new worktree's absolute path to stdout (progress goes to stderr). Report that path to the user, and suggest `cd <path>` to continue working there.

The created worktree also receives a `wt-destroy` executable for cleanup (hidden from `git status`).

## Cleanup

Each worktree carries a `wt-destroy` that removes that worktree and its branch. It acts on the worktree it lives in regardless of the current directory. Run it by path from outside the worktree (e.g. the project root) so the shell is not left in the just-deleted folder.

```bash
<worktree-path>/wt-destroy
```

- No uncommitted changes and the branch fully merged elsewhere (nothing to lose) → the worktree and branch are removed immediately.
- Uncommitted changes or unmerged commits exist → it removes nothing, prints a warning plus a confirmation key (derived from the current state), and stops.

When `wt-destroy` stops with a key, do not re-run with that key right away. Relay the warning to the user, confirm the intent to delete, and only then re-run with the key, using the command it prints. The key is bound to the worktree state at that moment, so if the state changes the old key is refused and a new one is shown.

Manual cleanup when the script is gone: `git worktree remove <path>` → `git worktree prune` → `git branch -d <slug>`.
</wt_instruction>

$ARGUMENTS

---
name: wt
description: "Create a git worktree branched off the current branch (HEAD) in a separate folder"
disable-model-invocation: true
argument-hint: "[name] [base-ref]"
---

<wt_instruction>
# wt

Create a new git worktree branched off the current branch (HEAD), placed to match the project layout. When the work is done, land it onto the parent branch as one squashed commit, or discard it.

## Create

Run from the project root:

```bash
"${CLAUDE_PLUGIN_ROOT}/skills/wt/scripts/wt-new.sh" <name> [base-ref]
```

- `<name>` — worktree / branch slug. The script sanitizes whitespace and git-forbidden characters, and rejects a slug that reduces to empty.
- `[base-ref]` — start point to branch from. Omitted: branch off current HEAD and record that current branch as the land target. Given: the parent is ambiguous, so wt-land then needs `--into`.

The script decides the location:
- Project root is a repo (git toplevel exists) → `<repo-parent>/<repo>.worktrees/<slug>/`
- Project root is a container holding a single repo → `<project-root>/<repo>-<slug>/`

The script prints only the new worktree's absolute path to stdout (progress goes to stderr). Report that path to the user. Unless told otherwise, the new worktree is the default workspace from here on, so `cd <path>` and work there.

The worktree carries `wt-land` and `wt-destroy` executables (hidden from `git status`).

## Finish — wt-land

After committing freely in the worktree, land the accumulated result onto the parent branch as one squashed commit and clean up. It acts on the worktree it lives in regardless of the current directory.

```bash
<worktree-path>/wt-land -m "feat: ..."                  # land into the recorded parent
<worktree-path>/wt-land -m "feat: ..." --into=<branch>  # land into another branch
```

- With no `-m` it prints usage.
- It squashes the worktree's commits onto the target as one commit carrying the `-m` message. The target branch's history gains only that single commit — no WIP commits, no merge commit. On success it removes this worktree and its branch.
- The target branch must be checked out cleanly somewhere (usually the main worktree). If it is dirty or not checked out, wt-land stops.

On a merge conflict wt-land touches nothing and stops, naming the conflicted files. Reconcile inside that worktree with `git merge <target>`, resolving so both intents survive — this worktree's work and whatever landed on the parent meanwhile. When it is genuinely ambiguous which side is right, defer to the user. After resolving, state what was merged and how, commit, and re-run wt-land.

## Discard — wt-destroy

Use this to throw away a worktree's work and remove it.

```bash
<worktree-path>/wt-destroy          # inspect, then delete if safe, else issue a key
<worktree-path>/wt-destroy <key>    # force-delete after the key is confirmed
```

- No new commits and no changes since it was created (an untouched worktree) → removed immediately.
- Otherwise it touches nothing, prints the refusal reason plus a confirmation key (derived from the current state), and stops. The key is bound to the worktree state at that moment, so if the state changes the old key is refused and a new one is shown.

When `wt-destroy` stops with a key, do not re-run with that key right away. Relay the warning to the user, confirm the intent to delete, and only then re-run with the command it prints.

Manual cleanup when the scripts are gone: `git worktree remove <path>` → `git worktree prune` → `git branch -d <slug>`.
</wt_instruction>

$ARGUMENTS

#!/usr/bin/env bash
#
# wt-destroy — remove THIS worktree (the one this script file lives in) and its
# branch, discarding its work. Dropped into each worktree by mkwt; self-locates,
# so it needs no path argument. To keep the work instead, use wt-land.
#
# Usage (call by path from outside the worktree; it self-locates via its own path):
#   <worktree>/wt-destroy        Inspect state. If nothing was done since the
#                         worktree was created (no new commits, clean working
#                         tree), remove it immediately. Otherwise print a
#                         state-bound confirmation key and stop without touching
#                         anything.
#   <worktree>/wt-destroy <key>  Force-destroy, but only when <key> matches the key
#                         recomputed from the CURRENT state. If the state moved
#                         since the key was shown, the keys differ and it stops
#                         with a fresh key.
#
# The confirmation key is sha256(current state)[:5]. It changes whenever HEAD, the
# tracked diff, or untracked (non-ignored) file contents change.

set -euo pipefail

die() { printf 'wt-destroy: %s\n' "$1" >&2; exit 1; }

# Target = the worktree this script sits in, not the caller's cwd.
script_dir="$(cd "$(dirname "$0")" && pwd)"
wt="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)" \
  || die "not inside a git worktree: $script_dir"

git_dir="$(cd "$(git -C "$wt" rev-parse --git-dir)" && pwd)"
common_dir="$(cd "$(git -C "$wt" rev-parse --git-common-dir)" && pwd)"
# A linked worktree has git-dir != git-common-dir. Refuse on the main worktree.
[ "$git_dir" != "$common_dir" ] \
  || die "this is the main worktree, not a linked one — refusing to self-destroy"

main_repo="$(dirname "$common_dir")"
branch="$(git -C "$wt" symbolic-ref --quiet --short HEAD || true)"
head="$(git -C "$wt" rev-parse HEAD)"
base="$(cat "$git_dir/wt-base" 2>/dev/null || true)"   # fork point recorded by mkwt

statekey() {
  local hash=sha256sum
  command -v sha256sum >/dev/null 2>&1 || hash="shasum -a 256"
  {
    git -C "$wt" rev-parse HEAD
    git -C "$wt" status --porcelain=v1
    git -C "$wt" diff HEAD
    # Hash each untracked file's path+content. A per-file loop avoids xargs -r
    # (GNU-only) and the `--` guards against a file named like an option.
    git -C "$wt" ls-files --others --exclude-standard -z \
      | ( cd "$wt" && while IFS= read -r -d '' f; do $hash -- "$f"; done )
  } | $hash | cut -c1-5
}

is_clean() { [ -z "$(git -C "$wt" status --porcelain)" ]; }

# True only when nothing was done since mkwt created this worktree: still on a
# branch at the recorded fork point with a clean tree (no commits, no changes). A
# detached HEAD never qualifies — it routes through the key path for a human look.
untouched() { [ -n "$branch" ] && [ -n "$base" ] && [ "$head" = "$base" ] && is_clean; }

destroy() { # $1 = force (0|1)
  cd "$main_repo"
  if [ "$1" = 1 ]; then git worktree remove --force "$wt"; else git worktree remove "$wt"; fi
  # Force-delete is safe here: the no-arg path runs only when untouched, and the
  # key path means the user explicitly confirmed.
  if [ -n "$branch" ] && git show-ref --verify --quiet "refs/heads/$branch"; then
    git branch -D "$branch"
  fi
  git worktree prune
  rmdir "$(dirname "$wt")" 2>/dev/null || true   # remove empty group folder (case A)
  printf 'destroyed worktree %s%s\n' "$wt" "${branch:+ (branch $branch)}"
}

key="$(statekey)"

# Phase 2: a key was supplied.
if [ $# -ge 1 ]; then
  if [ "$1" = "$key" ]; then
    destroy 1
    exit 0
  fi
  printf 'Confirmation key does not match the current state (it changed since the key was issued).\n'
  printf 'To delete anyway, re-run with the new key:\n'
  printf '    %s %s\n' "$0" "$key"
  exit 1
fi

# Phase 1: no args. Auto-remove only an untouched worktree.
if untouched; then
  destroy 0
  exit 0
fi

# Work was done here. Explain why, then emit the state-bound key.
if [ -z "$branch" ]; then
  reason="HEAD is detached, so commit safety can't be verified"
elif [ -z "$base" ]; then
  reason="its creation point is unknown, so commit safety can't be verified"
elif ! is_clean && [ "$head" != "$base" ]; then
  reason="it has uncommitted changes and commits made since it was created"
elif ! is_clean; then
  reason="it has uncommitted changes"
else
  reason="it has commits made since it was created"
fi

printf 'Refusing to destroy this worktree: %s; this would lose work.\n' "$reason"
printf 'To delete anyway, re-run with the confirmation key:\n'
printf '    %s %s\n' "$0" "$key"
exit 1

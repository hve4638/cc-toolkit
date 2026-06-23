#!/usr/bin/env bash
#
# wt-destroy — remove THIS worktree (the one this script file lives in) and its
# branch. Dropped into each worktree by wt-new; self-locates, so it needs no
# path argument.
#
# Usage (call by path from outside the worktree; it self-locates via its own path):
#   <worktree>/wt-destroy        Inspect state. If the working tree is clean AND the
#                         branch is fully merged elsewhere (nothing to lose),
#                         destroy immediately. Otherwise print a state-bound
#                         confirmation key and stop without touching anything.
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

statekey() {
  {
    git -C "$wt" rev-parse HEAD
    git -C "$wt" status --porcelain=v1
    git -C "$wt" diff HEAD
    git -C "$wt" ls-files --others --exclude-standard -z \
      | ( cd "$wt" && xargs -0 -r sha256sum )
  } | sha256sum | cut -c1-5
}

is_clean() { [ -z "$(git -C "$wt" status --porcelain)" ]; }

# Commits on this branch reachable from no other ref — they would be lost.
lost_count() {
  if [ -z "$branch" ]; then echo 1; return; fi   # detached HEAD: treat as unsafe
  local others
  others="$(git -C "$wt" for-each-ref --format='%(refname)' \
            refs/heads refs/remotes refs/tags | grep -vxF "refs/heads/$branch" || true)"
  git -C "$wt" rev-list --count "$branch" --not $others
}

destroy() { # $1 = force (0|1)
  cd "$main_repo"
  if [ "$1" = 1 ]; then git worktree remove --force "$wt"; else git worktree remove "$wt"; fi
  # Force-delete is safe here: the no-arg path already proved nothing is lost
  # (lost_count==0), and the key path means the user explicitly confirmed.
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

# Phase 1: no args.
if is_clean && [ "$(lost_count)" = 0 ]; then
  destroy 0
  exit 0
fi

# Not safe to destroy silently. Explain why, then emit the state-bound key.
if [ -z "$branch" ]; then
  reason="HEAD is detached, so commit safety can't be verified"
elif is_clean; then
  reason="the branch is not merged elsewhere"
elif [ "$(lost_count)" = 0 ]; then
  reason="the working tree has uncommitted changes"
else
  reason="the working tree has uncommitted changes and the branch is not merged elsewhere"
fi

printf 'Refusing to destroy this worktree: %s; this would lose work.\n' "$reason"
printf 'To delete anyway, re-run with the confirmation key:\n'
printf '    %s %s\n' "$0" "$key"
exit 1

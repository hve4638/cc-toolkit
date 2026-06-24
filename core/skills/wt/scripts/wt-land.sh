#!/usr/bin/env bash
#
# wt-land — squash-merge THIS worktree's branch into its parent (or an --into
# target) as a single commit, then remove the worktree and its branch. Dropped
# into each worktree by wt-new; self-locates via its own path, so it needs no
# path argument.
#
# Usage (call by path from outside the worktree; it self-locates via its own path):
#   <worktree>/wt-land -m "<message>"                  squash into the recorded parent
#   <worktree>/wt-land -m "<message>" --into=<branch>  squash into <branch> instead
#   <worktree>/wt-land                                 print usage
#
# The squash leaves a single clean commit on the target (no merge commit, no WIP
# history). On a merge conflict it changes nothing and stops, listing the
# conflicted files; reconcile inside this worktree (git merge <target>, resolve,
# commit) and re-run.

set -euo pipefail

usage() {
  cat >&2 <<EOF
usage: $0 -m "<commit message>" [--into=<branch>]

Squash-merge this worktree's branch into <branch> (default: the parent it was
branched from) as one commit, then remove this worktree and its branch.

  -m <message>     commit message for the squashed commit (required)
  --into=<branch>  land into <branch> instead of the recorded parent
EOF
  exit "${1:-1}"
}
die() { printf 'wt-land: %s\n' "$1" >&2; exit 1; }

# Target worktree = where this script file lives, not the caller's cwd.
script_dir="$(cd "$(dirname "$0")" && pwd)"
wt="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)" \
  || die "not inside a git worktree: $script_dir"

git_dir="$(cd "$(git -C "$wt" rev-parse --git-dir)" && pwd)"
common_dir="$(cd "$(git -C "$wt" rev-parse --git-common-dir)" && pwd)"
# A linked worktree has git-dir != git-common-dir. Refuse on the main worktree.
[ "$git_dir" != "$common_dir" ] \
  || die "this is the main worktree, not a linked one — nothing to land"

main_repo="$(dirname "$common_dir")"
feature="$(git -C "$wt" symbolic-ref --quiet --short HEAD)" \
  || die "HEAD is detached; cannot land a detached worktree"

# Parse args.
msg=""; into=""
while [ $# -gt 0 ]; do
  case "$1" in
    -m)        shift; [ $# -gt 0 ] || die "-m needs a message"; msg="$1" ;;
    -m*)       msg="${1#-m}" ;;
    --into)    shift; [ $# -gt 0 ] || die "--into needs a branch"; into="$1" ;;
    --into=*)  into="${1#--into=}" ;;
    -h|--help) usage 0 ;;
    *)         die "unknown argument: $1" ;;
  esac
  shift
done
[ -n "$msg" ] || usage 1

# Resolve the target branch.
if [ -n "$into" ]; then
  target="$into"
else
  target="$(cat "$git_dir/wt-parent" 2>/dev/null || true)"
  [ -n "$target" ] || die "no parent branch recorded; pass --into=<branch>"
fi
[ "$target" != "$feature" ] || die "target '$target' is this worktree's own branch"
git -C "$wt" show-ref --verify --quiet "refs/heads/$target" \
  || die "target branch '$target' does not exist"

# The squash-merge runs in whatever worktree has <target> checked out, and that
# worktree must be clean so the squash does not mix with unrelated work.
tw=""
while IFS= read -r line; do
  case "$line" in
    "worktree "*)                  cur="${line#worktree }" ;;
    "branch refs/heads/$target")   tw="$cur" ;;
  esac
done < <(git -C "$wt" worktree list --porcelain)
[ -n "$tw" ] || die "target '$target' is not checked out in any worktree; check it out first"
[ -z "$(git -C "$tw" status --porcelain)" ] \
  || die "target worktree '$tw' has uncommitted changes; commit or stash there first"

# The in-memory conflict precheck below needs git's modern merge-tree (>= 2.38).
# On older git it cannot run safely, so require it explicitly with a clear message.
read -r vmaj vmin < <(git version | sed -E 's/^git version ([0-9]+)\.([0-9]+).*/\1 \2/')
{ [ "${vmaj:-0}" -gt 2 ] || { [ "${vmaj:-0}" -eq 2 ] && [ "${vmin:-0}" -ge 38 ]; }; } \
  || die "needs git >= 2.38 for merge-tree --write-tree (found ${vmaj:-?}.${vmin:-?})"

# Conflict precheck: merge in memory, touching no working tree, index, or ref.
# The conflicted-file list is best-effort parsing; the authoritative signal is
# merge-tree's non-zero exit.
if ! merge_out="$(git -C "$tw" merge-tree --write-tree "$target" "$feature" 2>&1)"; then
  conflicted="$(printf '%s\n' "$merge_out" | sed -n '2,/^$/p' \
                | awk -F'\t' 'NF>1 {print $2}' | sort -u | paste -sd, -)"
  printf 'wt-land: merge into %s would conflict in: %s\n' "$target" "${conflicted:-?}" >&2
  printf '  reconcile here first:  git -C %s merge %s   (resolve, commit), then re-run\n' "$wt" "$target" >&2
  exit 1
fi

# Clean to merge. Squash the branch onto the target and commit as one. The target
# worktree was verified clean above, so on any mid-land failure we restore it to
# HEAD without clobbering the operator's work, leaving nothing half-merged.
restore() { git -C "$tw" reset -q --hard HEAD; git -C "$tw" clean -qfd; }
git -C "$tw" merge --squash "$feature" >/dev/null 2>&1 \
  || { restore; die "squash-merge into '$target' failed; target restored, nothing landed"; }
if git -C "$tw" diff --cached --quiet; then
  restore; die "nothing to land: '$feature' has no changes relative to '$target'"
fi
git -C "$tw" commit -q -m "$msg" \
  || { restore; die "commit in target worktree '$tw' failed (hook or signing?); target restored, nothing landed"; }
landed="$(git -C "$tw" rev-parse --short HEAD)"

# Landed — the content is now in <target>, so removing this worktree loses nothing.
cd "$main_repo"
git worktree remove --force "$wt"
git branch -D "$feature"
git worktree prune
rmdir "$(dirname "$wt")" 2>/dev/null || true   # remove empty group folder (case A)

printf 'landed %s onto %s as %s; removed worktree %s\n' "$feature" "$target" "$landed" "$wt"

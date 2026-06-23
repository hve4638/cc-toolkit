#!/usr/bin/env bash
#
# wt-new.sh — create a git worktree branched off the CURRENT HEAD (not main),
# placed according to the project layout. Prints the new worktree path on stdout.
#
# Usage: wt-new.sh <name> [base-ref]
#   <name>      worktree / branch slug (required)
#   [base-ref]  start point to branch from (default: HEAD = current branch tip)
#
# Run from the project root. Layout:
#   A. project root is inside a git repo  -> sibling group folder
#        <repo-parent>/<repo>.worktrees/<slug>
#   B. project root holds one repo subfolder -> flat sibling inside the root
#        <project-root>/<repo>-<slug>

set -euo pipefail

die() { printf 'wt: %s\n' "$1" >&2; exit 1; }

[ $# -ge 1 ] || die "usage: wt-new.sh <name> [base-ref]"
raw_name="$1"
base="${2:-HEAD}"
root="$PWD"

slug="$(printf '%s' "$raw_name" \
  | sed -E 's/[[:cntrl:]]+//g' \
  | sed -E 's/[[:space:]]+/-/g' \
  | sed -E 's/[~^:?*\\]+//g' \
  | sed -E 's/\[//g; s/\]//g' \
  | sed -E 's#/+#-#g' \
  | sed -E 's/\.\.+/./g' \
  | sed -E 's/-+/-/g' \
  | sed -E 's/^[-.]+//; s/[-.]+$//')"
[ -n "$slug" ] || die "name '$raw_name' reduces to an empty slug"

if toplevel="$(git -C "$root" rev-parse --show-toplevel 2>/dev/null)"; then
  # Case A: the project root is (inside) a repo.
  repo="$toplevel"
  repo_name="$(basename "$repo")"
  target="$(dirname "$repo")/${repo_name}.worktrees/$slug"
else
  # Case B: the project root is a container holding the repo.
  repo=""
  for d in "$root"/*/; do
    [ -d "$d" ] || continue
    if git -C "$d" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      [ -z "$repo" ] || die "multiple repos under '$root'; run from inside the repo"
      repo="${d%/}"
    fi
  done
  [ -n "$repo" ] || die "no git repo at or under '$root'"
  repo_name="$(basename "$repo")"
  target="$root/${repo_name}-${slug}"
fi

git -C "$repo" check-ref-format --branch "$slug" >/dev/null 2>&1 \
  || die "'$slug' is not a usable branch name"
[ -e "$target" ] && die "target already exists: $target"
if git -C "$repo" show-ref --verify --quiet "refs/heads/$slug"; then
  die "branch '$slug' already exists; pick another name or remove it first"
fi

mkdir -p "$(dirname "$target")"
if ! git -C "$repo" worktree add -b "$slug" "$target" "$base" 1>&2; then
  git -C "$repo" branch -D "$slug" 2>/dev/null || true   # drop a half-created branch
  die "git worktree add failed for '$slug'"
fi

# Drop a self-contained destroyer into the worktree and hide it from git status.
cp "$(dirname "$0")/wt-destroy.sh" "$target/wt-destroy"
chmod +x "$target/wt-destroy"
common_dir="$(cd "$repo" && cd "$(git rev-parse --git-common-dir)" && pwd)"
mkdir -p "$common_dir/info"
grep -qxF '/wt-destroy' "$common_dir/info/exclude" 2>/dev/null \
  || printf '/wt-destroy\n' >> "$common_dir/info/exclude"
printf 'dropped ./wt-destroy into the worktree\n' 1>&2

printf '%s\n' "$target"

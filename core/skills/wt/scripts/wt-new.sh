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
base_given=$([ $# -ge 2 ] && echo 1 || echo 0)
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
    git -C "$d" rev-parse --is-inside-work-tree >/dev/null 2>&1 || continue
    # Skip linked worktrees (git-dir != git-common-dir): the siblings wt-new
    # itself drops in this layout are not separate repos.
    gd="$(cd "$d" && cd "$(git rev-parse --git-dir)" && pwd)"
    cgd="$(cd "$d" && cd "$(git rev-parse --git-common-dir)" && pwd)"
    [ "$gd" = "$cgd" ] || continue
    [ -z "$repo" ] || die "multiple repos under '$root'; run from inside the repo"
    repo="${d%/}"
  done
  [ -n "$repo" ] || die "no git repo at or under '$root'"
  repo_name="$(basename "$repo")"
  target="$root/${repo_name}-${slug}"
fi

# Record the land target only when branching off the current branch (no explicit
# base-ref). An explicit base is ambiguous, so wt-land then requires --into.
if [ "$base_given" = 0 ]; then
  parent="$(git -C "$repo" symbolic-ref --quiet --short HEAD || true)"
else
  parent=""
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

# Drop the self-contained land/destroy helpers into the worktree and hide them.
src="$(dirname "$0")"
cp "$src/wt-land.sh"    "$target/wt-land";    chmod +x "$target/wt-land"
cp "$src/wt-destroy.sh" "$target/wt-destroy"; chmod +x "$target/wt-destroy"

# Record per-worktree metadata in its private git dir (not the working tree):
#   wt-base   = fork point, so wt-destroy can tell an untouched worktree apart.
#   wt-parent = land target, so wt-land knows where to squash-merge back.
wt_git_dir="$(git -C "$target" rev-parse --absolute-git-dir)"
git -C "$target" rev-parse HEAD > "$wt_git_dir/wt-base"
printf '%s\n' "$parent" > "$wt_git_dir/wt-parent"

common_dir="$(cd "$repo" && cd "$(git rev-parse --git-common-dir)" && pwd)"
mkdir -p "$common_dir/info"
for f in /wt-land /wt-destroy; do
  grep -qxF "$f" "$common_dir/info/exclude" 2>/dev/null \
    || printf '%s\n' "$f" >> "$common_dir/info/exclude"
done
printf 'dropped ./wt-land and ./wt-destroy into the worktree\n' 1>&2

# Operator hint on stderr (stdout stays the worktree path). Call these by path
# from outside the worktree so the shell is not left in a deleted folder.
if [ -n "$parent" ]; then
  printf 'to squash-merge the commits in this worktree onto %s, then remove it:\n    %s/wt-land -m "<message>"\n' "$parent" "$target" 1>&2
else
  printf 'to squash-merge the commits in this worktree onto a branch, then remove it:\n    %s/wt-land -m "<message>" --into=<branch>\n' "$target" 1>&2
fi
printf 'to discard the work in this worktree, then remove it:\n    %s/wt-destroy\n' "$target" 1>&2

printf '%s\n' "$target"

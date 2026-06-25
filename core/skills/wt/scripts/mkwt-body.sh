# === mkwt body (static) ===
# Assembled into ./mkwt.sh by wt-init.sh, which prepends a shebang and bakes:
#   REPO_REL         relative path from this script's dir to the repo
#   WT_LAND_B64      base64 of wt-land.sh
#   WT_DESTROY_B64   base64 of wt-destroy.sh
# Run (do not source): ./mkwt.sh <branch-name>
set -euo pipefail

die() { printf 'mkwt: %s\n' "$1" >&2; exit 1; }

[ $# -ge 1 ] || die "usage: ./mkwt.sh <branch-name>   e.g. ./mkwt.sh feat/login"
raw_name="$1"

# The repo is fixed relative to this script's own location, not the caller's cwd.
self_dir="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$self_dir/$REPO_REL" 2>/dev/null && pwd)" \
  || die "repo not found at $self_dir/$REPO_REL — re-run /wt to regenerate"
git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || die "no git repo at $repo"

# Branch name: clean to a usable ref but KEEP '/' so hierarchical names like
# feat/login stay intact. Folds whitespace to '-', strips control/git-forbidden
# chars, collapses and trims stray '/'; keeps other text (incl. non-ASCII) as is.
branch="$(printf '%s' "$raw_name" \
  | tr '\n\r' '  ' \
  | sed -E 's/[[:cntrl:]]+//g' \
  | sed -E 's/[[:space:]]+/-/g' \
  | sed -E 's/[~^:?*\\]+//g' \
  | sed -E 's/\[//g; s/\]//g' \
  | sed -E 's/[!"$&'"'"'();<>|{}`]+//g' \
  | sed -E 's/\.\.+/./g' \
  | sed -E 's/-+/-/g' \
  | sed -E 's#/+#/#g' \
  | sed -E 's/^[-.]+//; s/[-.]+$//' \
  | sed -E 's#^/+##; s#/+$##')"
[ -n "$branch" ] || die "name '$raw_name' reduces to an empty branch name"
# Reject names that pass check-ref-format but resolve to git magic (footguns).
case "$branch" in
  @|HEAD) die "name '$raw_name' makes a reserved ref name ('$branch')" ;;
esac

# Directory slug: a filesystem-safe rendering of the branch — only here do we fold
# '/' to '-' (a slash would otherwise nest the worktree under a subfolder).
slug="$(printf '%s' "$branch" | sed -E 's#/+#-#g; s/-+/-/g; s/^[-.]+//; s/[-.]+$//')"

# Worktree location is fixed: a "<repo>.worktrees/" group folder next to the repo.
repo_name="$(basename "$repo")"
target="$(dirname "$repo")/${repo_name}.worktrees/$slug"

git -C "$repo" check-ref-format --branch "$branch" >/dev/null 2>&1 \
  || die "'$branch' is not a usable branch name"
[ -e "$target" ] && die "target already exists: $target"
if git -C "$repo" show-ref --verify --quiet "refs/heads/$branch"; then
  die "branch '$branch' already exists; pick another name or remove it first"
fi

# Land target = the repo's current branch (mkwt always forks off HEAD).
parent="$(git -C "$repo" symbolic-ref --quiet --short HEAD || true)"

mkdir -p "$(dirname "$target")"
if ! git -C "$repo" worktree add -b "$branch" "$target" HEAD 1>&2; then
  git -C "$repo" branch -D "$branch" 2>/dev/null || true   # drop a half-created branch
  rmdir "$(dirname "$target")" 2>/dev/null || true       # remove the group folder if now empty
  die "git worktree add failed for '$branch'"
fi

# Drop the self-contained land/destroy helpers (carried inline as base64).
printf '%s' "$WT_LAND_B64"    | base64 -d > "$target/wt-land"    || die "could not write wt-land"
printf '%s' "$WT_DESTROY_B64" | base64 -d > "$target/wt-destroy" || die "could not write wt-destroy"
chmod +x "$target/wt-land" "$target/wt-destroy"

# Per-worktree metadata in its private git dir (not the working tree):
#   wt-base   = fork point, so wt-destroy can tell an untouched worktree apart.
#   wt-parent = land target, so wt-land knows where to squash-merge back.
wt_git_dir="$(git -C "$target" rev-parse --absolute-git-dir)"
git -C "$target" rev-parse HEAD > "$wt_git_dir/wt-base"
printf '%s\n' "$parent" > "$wt_git_dir/wt-parent"

# Hide the dropped helpers from git status (shared exclude covers every worktree).
common_dir="$(cd "$repo" && cd "$(git rev-parse --git-common-dir)" && pwd)"
mkdir -p "$common_dir/info"
for f in /wt-land /wt-destroy; do
  grep -qxF "$f" "$common_dir/info/exclude" 2>/dev/null \
    || printf '%s\n' "$f" >> "$common_dir/info/exclude"
done

printf 'worktree: %s  (branch %s off %s)\n' "$target" "$branch" "${parent:-HEAD}" >&2
if [ -n "$parent" ]; then
  printf 'land:    %s/wt-land -m "<message>"\n' "$target" >&2
else
  printf 'land:    %s/wt-land -m "<message>" --into=<branch>   (HEAD detached; no parent recorded)\n' "$target" >&2
fi
printf 'discard: %s/wt-destroy\n' "$target" >&2

# Interactive in tmux (stdout is a real terminal): open a new window rooted at the
# worktree, named after the branch. Otherwise — piped/captured/redirected, e.g. an
# agent tool call or $(...) — stdout is not a TTY, so print the path instead and
# leave the user's tmux untouched. (Same fallback if tmux refuses.)
if [ -n "${TMUX:-}" ] && [ -t 1 ] && tmux new-window -c "$target" -n "$branch" 2>/dev/null; then
  printf 'opened tmux window "%s"\n' "$branch" >&2
else
  printf '%s\n' "$target"
fi

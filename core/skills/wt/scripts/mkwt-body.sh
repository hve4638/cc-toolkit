# === mkwt body (static) ===
# Assembled into ./mkwt.sh by wt-init.sh, which prepends a shebang and bakes:
#   WT_B64  base64 of wt.sh (the per-worktree merge/destroy helper)
#
# Run (do not source):
#   ./mkwt.sh init [<repo-rel>]   one-time setup: write .wtrc, register excludes
#   ./mkwt.sh <branch-name>       create a worktree
#
# Everything else lives in `.wtrc` NEXT TO THIS FILE, which is sourced on every
# run: where the repo is, where worktrees go, and what to do once one exists.
# Nothing is baked in but the payload, so changing any of it is an edit rather
# than a regeneration.
#
# `.wtrc` is shell, not a declarative format, because its hook is code. That
# means it shares this script's namespace, so every name here that is NOT part of
# the contract is prefixed `mkwt_`. The contract — and the only unprefixed names
# this script reads — is `repo`, `worktree_dir`, and `post_create`.
set -euo pipefail

mkwt_die()  { printf 'mkwt: %s\n' "$1" >&2; exit 1; }
mkwt_warn() { printf 'mkwt: %s\n' "$1" >&2; }

mkwt_usage() {
  cat >&2 <<EOF
usage: $0 init [<repo-rel>]   one-time setup in this directory
       $0 <branch-name>       create a worktree, e.g. $0 feat/login

Configuration lives in .wtrc next to this script; \`init\` writes a starting one.
EOF
  exit "${1:-1}"
}

# Paths in .wtrc resolve against THIS FILE's directory, not the caller's cwd, so
# mkwt behaves the same from anywhere. Only a leading "/" means absolute; "a" and
# "./a" are both relative. (A leading "~" never reaches here — .wtrc is sourced,
# so the shell has already expanded it.)
mkwt_self_dir="$(cd "$(dirname "$0")" && pwd)"
mkwt_rc="$mkwt_self_dir/.wtrc"
mkwt_resolve() {
  local raw parent
  case "$1" in
    /*) raw="$1" ;;
    *)  raw="$mkwt_self_dir/$1" ;;
  esac
  # Normalize via the parent, which exists even when the target does not, so
  # "./x" and "../x" do not survive into every path this script prints.
  parent="$(cd "$(dirname "$raw")" 2>/dev/null && pwd)" || { printf '%s\n' "$raw"; return; }
  printf '%s/%s\n' "$parent" "$(basename "$raw")"
}

# Register a path in the repo's shared exclude, so the files mkwt drops do not
# show up in `git status`. The common dir covers every worktree at once.
mkwt_exclude() { # $1 = repo, $2 = "/path"
  local common_dir
  common_dir="$(cd "$1" && cd "$(git rev-parse --git-common-dir)" && pwd)"
  mkdir -p "$common_dir/info"
  grep -qxF "$2" "$common_dir/info/exclude" 2>/dev/null \
    || printf '%s\n' "$2" >> "$common_dir/info/exclude"
}

# ------------------------------------------------------------------------ init
#
# One-time setup, split out so the per-worktree path stays free of it: writing
# .wtrc and touching the repo's exclude file are things that should happen once,
# not on every create.
mkwt_init() {
  local rel="${1:-}" repo_abs name parent_abs wtd

  if [ -e "$mkwt_rc" ]; then
    printf 'kept existing %s\n' "$mkwt_rc" >&2
  else
    # With no argument, a repo right here is the overwhelmingly common case, so
    # fill the template in from it. Otherwise leave the keys empty rather than
    # guessing — mkwt refuses to run on an unfilled template, which is a clearer
    # failure than a wrong guess that half-works.
    [ -n "$rel" ] || { [ -d "$mkwt_self_dir/.git" ] && rel="."; } || true
    if [ -n "$rel" ]; then
      repo_abs="$(cd "$(mkwt_resolve "$rel")" 2>/dev/null && pwd)" || repo_abs=""
    else
      repo_abs=""
    fi
    if [ -n "$repo_abs" ]; then
      # Worktrees go in a "<repo>.worktrees" folder BESIDE the repo, never inside
      # it — a folder within the working tree would show up as untracked clutter
      # in every status and diff. Written relative to this file where that is
      # expressible, so the pair stays movable.
      name="$(basename "$repo_abs")"
      parent_abs="$(dirname "$repo_abs")"
      if [ "$parent_abs" = "$mkwt_self_dir" ]; then
        wtd="./${name}.worktrees"
      elif [ "$repo_abs" = "$mkwt_self_dir" ]; then
        wtd="../${name}.worktrees"
      else
        wtd="${parent_abs}/${name}.worktrees"
      fi
      mkwt_write_rc "$rel" "$wtd"
    else
      mkwt_write_rc "" ""
      printf 'no repo detected here — fill in repo= and worktree_dir= in %s\n' "$mkwt_rc" >&2
    fi
    printf 'wrote %s\n' "$mkwt_rc" >&2
  fi

  # Excludes need a repo to write into, which an unfilled .wtrc does not name.
  mkwt_load_rc
  if [ -n "${repo:-}" ] && repo_abs="$(cd "$(mkwt_resolve "$repo")" 2>/dev/null && pwd)" \
     && git -C "$repo_abs" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    # /wt is dropped into every worktree, so it is always hidden. mkwt.sh and
    # .wtrc only need hiding when they sit inside the repo's own working tree.
    mkwt_exclude "$repo_abs" "/wt"
    if [ "$repo_abs" = "$mkwt_self_dir" ]; then
      mkwt_exclude "$repo_abs" "/$(basename "$0")"
      mkwt_exclude "$repo_abs" "/.wtrc"
    fi
    printf 'registered excludes in %s\n' "$repo_abs" >&2
  else
    printf 'skipped excludes (no usable repo= yet)\n' >&2
  fi
}

mkwt_write_rc() { # $1 = repo value, $2 = worktree_dir value
  cat > "$mkwt_rc" <<EOF
# .wtrc — mkwt configuration. Sourced by ./mkwt.sh on every run, so it is shell,
# not a declarative format. Keep top-level statements cheap and side-effect free;
# put real work in the hook below.
#
# Paths: "a" and "./a" resolve against this file's directory; "/a" is absolute.

# The git repository worktrees are created from.
repo=$1

# Where worktrees are placed. Each one becomes <worktree_dir>/<branch-slug>.
worktree_dir=$2

# post_create runs once, right after a worktree is created. Optional — without it
# mkwt just prints the new worktree's path.
#
# Available to it:
#   WT_PATH         absolute path of the new worktree
#   WT_BRANCH       branch name
#   WT_PARENT       branch it was forked from
#   WT_REPO         absolute path of the repo
#   WT_INTERACTIVE  1 when a user is at a terminal, 0 when captured by a script
#                   or an agent — branch on this so terminal-only side effects
#                   (opening a window) stay out of automated runs while
#                   notifications still fire.
#
# Its stdout is redirected to stderr, so it cannot disturb the worktree path that
# mkwt prints. A failing hook is reported but does not undo the worktree.
#
#post_create() {
#  [ "\$WT_INTERACTIVE" = 1 ] || return 0
#  tmux new-window -c "\$WT_PATH" -n "\$WT_BRANCH"
#}
EOF
}

# .wtrc is a user file with no reason to know this script's shell options, so it
# is parsed first and then sourced with `-e` and `-u` off:
#
#   -e  an rc file's exit status is just whatever its last line returned. A
#       probe like `command -v tmux >/dev/null` at the top level is perfectly
#       reasonable and says nothing about whether the config loaded, so neither
#       aborting on it nor checking the status afterwards is right.
#   -u  the same file naturally reads environment that may be unset ($TMUX,
#       $SSH_TTY). Under -u that is fatal to the whole shell, not just the line.
#
# Syntax errors still fail loudly: `bash -n` catches them before anything runs,
# which is the failure worth reporting and the one a status check cannot tell
# apart from a benign non-zero line.
mkwt_load_rc() {
  [ -f "$mkwt_rc" ] || mkwt_die "no .wtrc next to $0 — run: $0 init"
  bash -n "$mkwt_rc" 2>/dev/null \
    || mkwt_die "error while reading $mkwt_rc — syntax error (check with: bash -n $mkwt_rc)"
  set +eu
  # shellcheck disable=SC1090
  . "$mkwt_rc"
  set -eu
}

# --------------------------------------------------------------------- dispatch

case "${1:-}" in
  init)      shift; mkwt_init "${1:-}"; exit 0 ;;
  -h|--help) mkwt_usage 0 ;;
  "")        mkwt_usage 1 ;;
esac
mkwt_raw_name="$1"

mkwt_load_rc

[ -n "${repo:-}" ] \
  || mkwt_die "repo= is not set in $mkwt_rc (run '$0 init' or fill it in)"
mkwt_repo="$(cd "$(mkwt_resolve "$repo")" 2>/dev/null && pwd)" \
  || mkwt_die "repo= points at a missing directory: $(mkwt_resolve "$repo")"
git -C "$mkwt_repo" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || mkwt_die "repo= is not a git repository: $mkwt_repo"

[ -n "${worktree_dir:-}" ] \
  || mkwt_die "worktree_dir= is not set in $mkwt_rc"
mkwt_wtdir="$(mkwt_resolve "$worktree_dir")"

# Branch name: clean to a usable ref but KEEP '/' so hierarchical names like
# feat/login stay intact. Folds whitespace to '-', strips control/git-forbidden
# chars, collapses and trims stray '/'; keeps other text (incl. non-ASCII) as is.
mkwt_branch="$(printf '%s' "$mkwt_raw_name" \
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
[ -n "$mkwt_branch" ] || mkwt_die "name '$mkwt_raw_name' reduces to an empty branch name"
# Reject names that pass check-ref-format but resolve to git magic (footguns).
case "$mkwt_branch" in
  @|HEAD) mkwt_die "name '$mkwt_raw_name' makes a reserved ref name ('$mkwt_branch')" ;;
esac

# Directory slug: a filesystem-safe rendering of the branch — only here do we fold
# '/' to '-' (a slash would otherwise nest the worktree under a subfolder).
mkwt_slug="$(printf '%s' "$mkwt_branch" | sed -E 's#/+#-#g; s/-+/-/g; s/^[-.]+//; s/[-.]+$//')"
mkwt_target="$mkwt_wtdir/$mkwt_slug"

git -C "$mkwt_repo" check-ref-format --branch "$mkwt_branch" >/dev/null 2>&1 \
  || mkwt_die "'$mkwt_branch' is not a usable branch name"
[ -e "$mkwt_target" ] && mkwt_die "target already exists: $mkwt_target"
if git -C "$mkwt_repo" show-ref --verify --quiet "refs/heads/$mkwt_branch"; then
  mkwt_die "branch '$mkwt_branch' already exists; pick another name or remove it first"
fi

# Merge target = the repo's current branch (mkwt always forks off HEAD).
mkwt_parent="$(git -C "$mkwt_repo" symbolic-ref --quiet --short HEAD || true)"

mkdir -p "$mkwt_wtdir"
if ! git -C "$mkwt_repo" worktree add -b "$mkwt_branch" "$mkwt_target" HEAD 1>&2; then
  git -C "$mkwt_repo" branch -D "$mkwt_branch" 2>/dev/null || true  # drop a half-created branch
  rmdir "$mkwt_wtdir" 2>/dev/null || true                           # remove the folder if now empty
  mkwt_die "git worktree add failed for '$mkwt_branch'"
fi

# Drop the self-contained per-worktree helper (carried inline as base64).
printf '%s' "$WT_B64" | base64 -d > "$mkwt_target/wt" || mkwt_die "could not write wt"
chmod +x "$mkwt_target/wt"

# Per-worktree metadata in its private git dir (not the working tree):
#   wt-parent = parent branch, so `wt merge` knows where to merge to and
#               `wt destroy` knows what to measure "was this already absorbed?"
#               against.
mkwt_wt_git_dir="$(git -C "$mkwt_target" rev-parse --absolute-git-dir)"
printf '%s\n' "$mkwt_parent" > "$mkwt_wt_git_dir/wt-parent"

printf 'worktree: %s  (branch %s off %s)\n' "$mkwt_target" "$mkwt_branch" "${mkwt_parent:-HEAD}" >&2
if [ -n "$mkwt_parent" ]; then
  printf 'merge:   %s/wt merge -m "<message>"\n' "$mkwt_target" >&2
  printf 'land:    %s/wt land -m "<message>"          (merge, then remove this worktree)\n' "$mkwt_target" >&2
else
  printf 'merge:   %s/wt merge -m "<message>" --into=<branch>   (HEAD detached; no parent recorded)\n' "$mkwt_target" >&2
fi
printf 'discard: %s/wt destroy\n' "$mkwt_target" >&2

# The hook decides what a new worktree should lead to — a terminal window, a
# notification, nothing. mkwt only reports whether a user is watching; deciding
# for the hook would rule out the cases that want to fire either way.
if type post_create >/dev/null 2>&1; then
  export WT_PATH="$mkwt_target" WT_BRANCH="$mkwt_branch" WT_PARENT="$mkwt_parent" \
         WT_REPO="$mkwt_repo"
  if [ -t 1 ]; then export WT_INTERACTIVE=1; else export WT_INTERACTIVE=0; fi
  # Same relaxation as loading .wtrc, for the same reason: the hook is the user's
  # code and should not have to satisfy this script's `-e`/`-u`. stdout goes to
  # stderr so a hook that prints cannot corrupt the path below, which callers
  # capture with $(...).
  set +eu
  post_create >&2
  mkwt_hook_status=$?
  set -eu
  [ "$mkwt_hook_status" -eq 0 ] \
    || mkwt_warn "post_create failed (exit $mkwt_hook_status; the worktree was still created)"
fi

# Always last, always stdout: the one machine-readable thing mkwt produces.
printf '%s\n' "$mkwt_target"

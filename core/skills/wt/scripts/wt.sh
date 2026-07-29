#!/usr/bin/env bash
#
# wt — worktree helper for THE WORKTREE THIS FILE LIVES IN. Dropped by mkwt into
# each worktree it creates; self-locates via its own path, so it needs no path
# argument and can be called from anywhere.
#
#   <worktree>/wt merge -m "<message>" [--into=<branch>]
#   <worktree>/wt destroy [<key>]
#   <worktree>/wt                                        print usage
#
# The two verbs are deliberately separate. `merge` publishes committed work to
# the parent and leaves the worktree in place; `destroy` disposes of the
# worktree. Bundling them would force one flag to mean both "don't clean up" and
# "keep my uncommitted work", which is how the earlier single `land` command
# ended up with a --keep flag that meant neither clearly. Split, each verb has
# one job and `destroy`'s existing safety check is what decides whether
# uncommitted work may be discarded.
#
# The usual sequence is `wt merge` then `wt destroy`: after a merge the branch
# sits exactly on the parent, so destroy sees nothing to lose and removes the
# worktree without asking.

set -euo pipefail

prog="wt"
die() { printf '%s: %s\n' "$prog" "$1" >&2; exit 1; }

usage() {
  cat >&2 <<EOF
usage: $0 <command>

  merge -m "<message>" [--into=<branch>]
        Land this worktree's committed work onto its parent branch as a single
        commit. Uncommitted changes are stashed for the duration and restored
        afterwards; they are never landed. The worktree stays in place — clean
        it up with \`destroy\` when the work is done.

  destroy [<key>]
        Remove this worktree and its branch. Refuses with a confirmation key if
        that would lose work; re-run with the key to confirm.
EOF
  exit "${1:-1}"
}

# ---------------------------------------------------------------- shared state

# The subject is the worktree this script FILE sits in, not the caller's cwd —
# that is what lets it be invoked by path from anywhere.
script_dir="$(cd "$(dirname "$0")" && pwd)"
wt="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null)" \
  || die "not inside a git worktree: $script_dir"

git_dir="$(cd "$(git -C "$wt" rev-parse --git-dir)" && pwd)"
common_dir="$(cd "$(git -C "$wt" rev-parse --git-common-dir)" && pwd)"
# A linked worktree has git-dir != git-common-dir. Refuse on the main worktree.
[ "$git_dir" != "$common_dir" ] \
  || die "this is the main worktree, not a linked one"

main_repo="$(dirname "$common_dir")"
# Empty when HEAD is detached. merge refuses that; destroy routes it to the key
# path, so this stays tolerant here and each verb decides.
branch="$(git -C "$wt" symbolic-ref --quiet --short HEAD || true)"
parent="$(cat "$git_dir/wt-parent" 2>/dev/null || true)"   # land target recorded by mkwt

require_git_2_38() {
  local vmaj vmin
  read -r vmaj vmin < <(git version | sed -E 's/^git version ([0-9]+)\.([0-9]+).*/\1 \2/')
  { [ "${vmaj:-0}" -gt 2 ] || { [ "${vmaj:-0}" -eq 2 ] && [ "${vmin:-0}" -ge 38 ]; }; } \
    || die "needs git >= 2.38 for merge-tree --write-tree (found ${vmaj:-?}.${vmin:-?})"
}

# --------------------------------------------------------------------- merge
#
# Every step runs in THIS worktree except the final fast-forward:
#   1. merge the target in memory; stop before touching anything if it conflicts
#   2. stash uncommitted work, so only committed work lands and the working
#      state survives the history rewrite
#   3. squash every commit since the target into one
#   4. rebase onto the target, making this branch a descendant of it
#   5. fast-forward the target
#   6. restore the stash
#
# The target is never merged into, only fast-forwarded. Its worktree therefore
# cannot end up half-merged and needs no cleanliness check: git refuses the
# fast-forward by itself when it would overwrite work in progress there, and
# leaves unrelated work in progress alone.
cmd_merge() {
  prog="wt merge"
  local msg="" into="" target tw="" cur line merge_out conflicted merge_base orig_head landed
  local stashed=0

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
  [ -n "$branch" ] || die "HEAD is detached; cannot merge from a detached worktree"

  if [ -n "$into" ]; then
    target="$into"
  else
    target="$parent"
    [ -n "$target" ] || die "no parent branch recorded; pass --into=<branch>"
  fi
  [ "$target" != "$branch" ] || die "target '$target' is this worktree's own branch"
  git -C "$wt" show-ref --verify --quiet "refs/heads/$target" \
    || die "target branch '$target' does not exist"

  # Where the target is checked out, if anywhere. Its files must move with the
  # fast-forward, so that is the worktree the merge runs in; an unchecked-out
  # target has no files to move, so moving the ref IS the fast-forward (step 5).
  while IFS= read -r line; do
    case "$line" in
      "worktree "*)                  cur="${line#worktree }" ;;
      "branch refs/heads/$target")   tw="$cur" ;;
    esac
  done < <(git -C "$wt" worktree list --porcelain)

  # Nothing to land is not a pipeline failure, so check before running any of it.
  if git -C "$wt" diff --quiet "$target...$branch" --; then
    die "nothing to merge: '$branch' adds no changes relative to '$target'"
  fi

  require_git_2_38

  # Step 1 — conflict precheck. merge-tree merges in memory, touching no working
  # tree, index, or ref. It reads only the two tips and their merge base, so it
  # predicts the step-4 rebase even though the squash has not run yet — which is
  # what lets it run first, before anything is modified. The conflicted-file list
  # is best-effort parsing; the authoritative signal is the non-zero exit.
  if ! merge_out="$(git -C "$wt" merge-tree --write-tree "$target" "$branch" 2>&1)"; then
    conflicted="$(printf '%s\n' "$merge_out" | sed -n '2,/^$/p' \
                  | awk -F'\t' 'NF>1 {print $2}' | sort -u | paste -sd, -)"
    printf '%s: merging onto %s would conflict in: %s\n' "$prog" "$target" "${conflicted:-?}" >&2
    printf '  reconcile here first:  git -C %s merge %s   (resolve, commit), then re-run\n' "$wt" "$target" >&2
    printf '  nothing was changed.\n' >&2
    exit 1
  fi

  # ---- past this point state changes; every failure path restores what it can ----

  # Step 2 — stash. Only committed work should land, and the squash and rebase
  # below rewrite history under the working tree, so uncommitted work is set
  # aside for the duration. -u carries untracked files along; the matching pop
  # uses --index to put the staged/unstaged split back exactly as it was.
  if [ -n "$(git -C "$wt" status --porcelain)" ]; then
    git -C "$wt" stash push -u -q -m "wt merge: $branch" \
      || die "could not stash uncommitted changes; nothing was changed"
    stashed=1
  fi

  unstash() {
    [ "$stashed" = 1 ] || return 0
    stashed=0
    # stdout is redirected as well as stderr: `stash pop` runs a merge internally
    # and that merge reports ("Already up to date.") even under -q, which reads
    # as an outcome of the merge rather than of the restore.
    if git -C "$wt" stash pop --index -q >/dev/null 2>&1; then return 0; fi
    printf '%s: could not restore your uncommitted changes automatically.\n' "$prog" >&2
    printf '  they are kept in the stash:  git -C %s stash list\n' "$wt" >&2
    printf '  recover with:                git -C %s stash pop --index\n' "$wt" >&2
  }

  # Steps 3 and 4 rewrite this branch, and a failure in the middle of either
  # would otherwise leave it half-rewritten while the target never moved — a
  # "nothing merged" that silently ate the branch's commits (a failed commit
  # leaves the squash reset applied; a conflicted rebase leaves the squash).
  # Putting the branch back on its original commit first makes every failure
  # below mean what it says. --keep rather than --hard because it refuses instead
  # of discarding if the tree somehow is not clean; the stash should have left it
  # so.
  orig_head="$(git -C "$wt" rev-parse HEAD)"
  restore_branch() {
    git -C "$wt" rebase --abort >/dev/null 2>&1 || true
    git -C "$wt" reset -q --keep "$orig_head" >/dev/null 2>&1 || true
  }
  bail() { restore_branch; unstash; die "$1"; }

  # Step 3 — squash. The merge base is computed, never read from a file, so after
  # a previous merge (which leaves branch and target on the same commit) it IS
  # that point: already-landed work falls outside the range and cannot be
  # replayed.
  merge_base="$(git -C "$wt" merge-base "$target" "$branch")" \
    || bail "no merge base between '$branch' and '$target'; nothing merged"
  git -C "$wt" reset -q --soft "$merge_base" \
    || bail "could not squash '$branch'; nothing merged"
  git -C "$wt" commit -q -m "$msg" \
    || bail "commit failed (hook or signing?); nothing merged"

  # Step 4 — rebase onto the target, so the target only ever fast-forwards. The
  # precheck cleared this, so a conflict here means the target moved in between.
  # restore_branch aborts the rebase, which matters beyond tidiness: a worktree
  # left mid-rebase has a detached HEAD, and that locks out both verbs until a
  # human finishes it by hand.
  git -C "$wt" rebase -q "$target" >/dev/null 2>&1 \
    || bail "rebase onto '$target' conflicted ('$target' moved since the precheck); re-run"

  # Step 5 — fast-forward the target.
  if [ -n "$tw" ]; then
    git -C "$tw" merge --ff-only "$branch" >/dev/null 2>&1 \
      || bail "could not fast-forward '$target' in $tw ('$target' moved, or work in progress there touches the same files); nothing merged"
  else
    git -C "$wt" merge-base --is-ancestor "$target" "$branch" \
      || bail "'$target' moved and can no longer fast-forward; nothing merged"
    git -C "$wt" update-ref -m "wt merge: $branch" "refs/heads/$target" "$branch" \
      || bail "could not move '$target'; nothing merged"
  fi
  landed="$(git -C "$wt" rev-parse --short HEAD)"

  # Step 6 — the worktree stays, so the stash always comes back.
  unstash

  printf 'merged %s onto %s as %s; worktree kept @ %s\n' "$branch" "$target" "$landed" "$wt"
  printf 'clean up with:  %s destroy\n' "$0"
}

# ------------------------------------------------------------------- destroy
#
# "Adds nothing to its parent" is measured against the parent branch itself, not
# against a fork point recorded at creation. That covers both ends of a
# worktree's life with one test: a fresh worktree still sits on the parent's tip,
# and a merged worktree has had its work absorbed into the parent. A recorded
# fork point could only ever recognize the first.
#
# The confirmation key is sha256(current state)[:5]. It changes whenever HEAD,
# the tracked diff, or untracked (non-ignored) file contents change.
cmd_destroy() {
  prog="wt destroy"
  local head key reason
  [ $# -le 1 ] || die "usage: $0 destroy [<key>]"
  case "${1:-}" in -h|--help) usage 0 ;; esac

  head="$(git -C "$wt" rev-parse HEAD)"

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

  parent_known() {
    [ -n "$parent" ] || return 1
    git -C "$wt" show-ref --verify --quiet "refs/heads/$parent"
  }

  # True when this branch adds no changes to the parent. The tests run
  # cheapest-first and any one is sufficient — they catch the same "already in
  # the parent" state reached by different routes. Assumes parent_known.
  commits_integrated() {
    local ptip merged
    ptip="$(git -C "$wt" rev-parse "$parent")"

    # 1. Same commit — a fresh worktree still on the parent's tip, and a worktree
    #    just merged, which leaves branch and parent equal.
    if [ "$head" = "$ptip" ]; then return 0; fi

    # 2. Ancestor — as above, but the parent has since moved on.
    if git -C "$wt" merge-base --is-ancestor "$branch" "$parent"; then return 0; fi

    # 3. Nothing added since the fork point. Note this measures FROM the merge
    #    base, so it says "this branch changed nothing", not "the parent already
    #    has this" — a squashed branch still looks like it added its own changes
    #    here, which is what test 4 is for.
    if git -C "$wt" diff --quiet "$parent...$branch" --; then return 0; fi

    # 4. Merging would add nothing: the merged tree equals the parent's tree as
    #    it stands. This is the one that recognizes content the parent absorbed
    #    under a different commit — a squash merge — and it keeps holding after
    #    the parent advances with unrelated changes. Needs merge-tree
    #    (git >= 2.38); where it is unavailable the check simply does not fire
    #    and the key path takes over.
    if merged="$(git -C "$wt" merge-tree --write-tree "$parent" "$branch" 2>/dev/null)"; then
      if [ "$merged" = "$(git -C "$wt" rev-parse "$parent^{tree}")" ]; then return 0; fi
    fi

    return 1
  }

  # True when removing this worktree loses nothing. A detached HEAD never
  # qualifies — it routes through the key path for a human look.
  integrated() {
    [ -n "$branch" ] || return 1
    parent_known || return 1
    is_clean || return 1
    commits_integrated
  }

  destroy() { # $1 = force (0|1)
    cd "$main_repo"
    if [ "$1" = 1 ]; then git worktree remove --force "$wt"; else git worktree remove "$wt"; fi
    # Force-delete is safe here: the no-arg path runs only when integrated, and
    # the key path means the user explicitly confirmed.
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
    printf '    %s destroy %s\n' "$0" "$key"
    exit 1
  fi

  # Phase 1: no args. Auto-remove only when nothing would be lost.
  if integrated; then
    destroy 0
    exit 0
  fi

  # Work would be lost. Explain why, then emit the state-bound key.
  if [ -z "$branch" ]; then
    reason="HEAD is detached, so it can't be checked against a parent branch"
  elif [ -z "$parent" ]; then
    reason="no parent branch is recorded, so its work can't be checked against one"
  elif ! parent_known; then
    reason="its parent branch '$parent' no longer exists, so its work can't be checked against it"
  elif ! is_clean && ! commits_integrated; then
    reason="it has uncommitted changes, and commits that are not in '$parent'"
  elif ! is_clean; then
    reason="it has uncommitted changes"
  else
    reason="it has commits that are not in '$parent'"
  fi

  printf 'Refusing to destroy this worktree: %s; this would lose work.\n' "$reason"
  printf 'To delete anyway, re-run with the confirmation key:\n'
  printf '    %s destroy %s\n' "$0" "$key"
  exit 1
}

# -------------------------------------------------------------------- dispatch

cmd="${1:-}"
[ $# -gt 0 ] && shift
case "$cmd" in
  merge)     cmd_merge "$@" ;;
  destroy)   cmd_destroy "$@" ;;
  -h|--help) usage 0 ;;
  # No verb is a usage error, not a help request — exit non-zero so a caller that
  # forgot the verb fails instead of looking like it succeeded.
  "")        usage 1 ;;
  *)         die "unknown command: $cmd  (expected: merge, destroy)" ;;
esac

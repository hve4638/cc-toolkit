#!/usr/bin/env bash
#
# wt — worktree helper for THE WORKTREE THIS FILE LIVES IN. Dropped by mkwt into
# each worktree it creates; self-locates via its own path, so it needs no path
# argument and can be called from anywhere.
#
#   <worktree>/wt merge -m "<message>" [--into=<branch>] [--no-squash]
#   <worktree>/wt land  -m "<message>" [--into=<branch>] [--no-squash]
#   <worktree>/wt destroy [<key>]
#   <worktree>/wt                                        print usage
#
# `merge` publishes committed work to the parent and leaves the worktree in
# place; `destroy` disposes of the worktree; `land` runs both for when the work
# is finished. The first two remain usable on their own, which is the point: an
# earlier version offered only the bundle, and its --keep flag had to mean both
# "don't clean up" and "keep my uncommitted work" at once. Separate, each verb
# has one job, and `destroy`'s safety check alone decides whether uncommitted
# work may be discarded.
#
# After a merge the branch sits exactly on the parent, so a following destroy
# sees nothing to lose and removes the worktree without asking.
#
# Nothing here writes to stdout. Every line it prints is status, not data, and a
# reader that stops early (`land … | less`, quit) would otherwise raise SIGPIPE
# on the first report — which under `land` lands between the merge and the
# destroy and would kill the script there, exactly the half-done state land
# exists to avoid. Leaving stdout unwritten removes that, for the default stream
# layout: `land … 2>&1 | …` pipes the reports back into the same hazard, and
# nothing short of ignoring SIGPIPE outright would help there.

set -euo pipefail

prog="wt"
die() { printf '%s: %s\n' "$prog" "$1" >&2; exit 1; }

usage() {
  cat >&2 <<EOF
usage: $0 <command>

  merge -m "<message>" [--into=<branch>] [--no-squash]
        Land this worktree's committed work onto its parent branch, squashed
        into a single commit unless --no-squash. Uncommitted changes are stashed
        for the duration and restored afterwards; they are never landed. The
        worktree stays in place — clean it up with \`destroy\` when the work is
        done.

        --no-squash  keep each commit instead of collapsing them into one;
                     -m then has nothing to name and is refused

  land -m "<message>" [--into=<branch>] [--no-squash]
        merge, then destroy. Refuses up front unless the worktree is clean, so
        it either does both or neither. With nothing left to merge it goes
        straight to the destroy.

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

# Set by `land` so merge can leave out the "now run destroy" hint, and so destroy
# weighs the branch against what merge actually resolved as its target.
in_land=0
merged_target=""

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
#   3. squash every commit since the target into one  (skipped by --no-squash)
#   4. rebase onto the target, making this branch a descendant of it
#   5. fast-forward the target
#   6. restore the stash
#
# --no-squash drops step 3 only. Step 4 still runs, so the target still only ever
# fast-forwards and the branch still ends up on the same commit as the target —
# the convergence the repeated-merge case depends on is a property of the rebase,
# not of the squash.
#
# The target is never merged into, only fast-forwarded. Its worktree therefore
# cannot end up half-merged and needs no cleanliness check: git refuses the
# fast-forward by itself when it would overwrite work in progress there, and
# leaves unrelated work in progress alone.
cmd_merge() {
  # Left alone under `land`, so errors are attributed to the verb that was typed.
  [ "$in_land" = 1 ] || prog="wt merge"
  local msg="" into="" target tw="" cur line merge_out conflicted merge_base orig_head landed ncommits
  local stashed=0 no_squash=0

  # A separated value that looks like a flag is a typo, not a value: `-m
  # --no-squash` would otherwise take the flag as the message, squash anyway, and
  # under `land` delete the branch whose commit boundaries were being asked for.
  # Whitespace settles the ambiguity the other way — no flag contains any, so a
  # dash-leading phrase is plainly the value. For the rest, the joined form is
  # the way to say a value that really does start with a dash, so the refusal
  # names it. (Defined here rather than at file scope for proximity; like
  # bail/unstash below it outlives the call, which nothing depends on.)
  flagval() { # $1 = flag, $2 = value, $3 = joined spelling to suggest
    case "$2" in
      *[[:space:]]*) return 0 ;;
      -*) die "$1 takes a value, but '$2' reads as a flag; write it as $3 if it is really the value" ;;
    esac
  }

  while [ $# -gt 0 ]; do
    case "$1" in
      -m)         shift; [ $# -gt 0 ] || die "-m needs a message"
                  flagval -m "$1" "-m$1"; msg="$1" ;;
      -m*)        msg="${1#-m}" ;;
      --into)     shift; [ $# -gt 0 ] || die "--into needs a branch"
                  flagval --into "$1" "--into=$1"; into="$1" ;;
      --into=*)   into="${1#--into=}" ;;
      --no-squash) no_squash=1 ;;
      -h|--help)  usage 0 ;;
      *)          die "unknown argument: $1" ;;
    esac
    shift
  done
  # Refused rather than ignored: a message that silently goes nowhere leaves the
  # caller believing they named the landed work.
  if [ "$no_squash" = 1 ]; then
    [ -z "$msg" ] || die "--no-squash keeps each commit as-is; -m has nothing to name"
  else
    [ -n "$msg" ] || usage 1
  fi
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
  merged_target="$target"

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
    # Under `land` it is not a failure at all: there is nothing to publish, so
    # the cleanup is the whole remaining job and destroy's own check decides
    # whether it is safe. Dying here would break the documented main flow —
    # merge while working, then land at the end — by stopping on the very state
    # a successful merge leaves behind.
    if [ "$in_land" = 1 ]; then
      # Guarded like the other reports: a failed write here would kill the script
      # before the return and skip the cleanup that is the whole remaining job.
      printf 'nothing to merge onto %s; going straight to destroy\n' "$target" >&2 || true
      return 0
    fi
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
  if [ "$no_squash" = 0 ]; then
    merge_base="$(git -C "$wt" merge-base "$target" "$branch")" \
      || bail "no merge base between '$branch' and '$target'; nothing merged"
    git -C "$wt" reset -q --soft "$merge_base" \
      || bail "could not squash '$branch'; nothing merged"
    git -C "$wt" commit -q -m "$msg" \
      || bail "commit failed (hook or signing?); nothing merged"
  fi

  # Step 4 — rebase onto the target, so the target only ever fast-forwards. The
  # precheck cleared this, so a conflict here means the target moved in between.
  # restore_branch aborts the rebase, which matters beyond tidiness: a worktree
  # left mid-rebase has a detached HEAD, and that locks out both verbs until a
  # human finishes it by hand.
  git -C "$wt" rebase -q "$target" >/dev/null 2>&1 \
    || bail "rebase onto '$target' conflicted ('$target' moved since the precheck); re-run"

  # Counted before step 5 moves the target: this is exactly what is about to land
  # (1 after a squash, and after a rebase that may have dropped emptied commits).
  ncommits="$(git -C "$wt" rev-list --count "$target..$branch")"

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

  # Reporting must not gate what follows it. The merge is already done here, and
  # under `land` a failed write — stderr closed (`land … 2>&-`) or full — would
  # otherwise abort before destroy and break the all-or-nothing promise. `|| true`
  # covers a write that fails; writing to stderr rather than stdout covers the
  # reader that quits, which no `||` can catch because SIGPIPE kills the shell
  # outright rather than failing the write.
  {
    # ncommits is 0 when the rebase dropped every commit as already applied. The
    # 3-dot precheck cannot see that (it measures from the merge base), so this
    # is the first point where "the target did not move" is known, and saying
    # "merged … as <sha>" here would name the target's pre-existing tip.
    if [ "$ncommits" = 0 ]; then
      printf 'nothing landed on %s: every commit was already there' "$target"
    elif [ "$no_squash" = 1 ]; then
      printf 'merged %s onto %s (%s commits, tip %s)' "$branch" "$target" "$ncommits" "$landed"
    else
      printf 'merged %s onto %s as %s' "$branch" "$target" "$landed"
    fi
    # Under `land` the worktree is about to go, so neither the "kept" note nor
    # the hint that follows it would be true.
    if [ "$in_land" = 1 ]; then
      printf '\n'
    else
      printf '; worktree kept @ %s\n' "$wt"
      printf 'clean up with:  %s destroy\n' "$0"
    fi
  } >&2 || true
}

# ---------------------------------------------------------------------- land
#
# merge and destroy in one call, for when the work is finished.
#
# The cleanliness check runs BEFORE the merge instead of being left to destroy's
# key path afterwards. Uncommitted work is the one thing that can still make
# destroy refuse once a merge has succeeded, and by then the merge has happened —
# stopping there would leave a land half-done. Checked up front, land either does
# both or neither, and the fix is the same either way: commit it, or run the two
# verbs separately.
cmd_land() {
  prog="wt land"
  case "${1:-}" in -h|--help) usage 0 ;; esac

  [ -z "$(git -C "$wt" status --porcelain)" ] \
    || die "worktree has uncommitted changes, which land would have to leave behind; commit them, or run \`merge\` and then \`destroy\`"

  in_land=1
  cmd_merge "$@"

  # destroy weighs this branch against the branch it was merged into. With --into
  # that is not the recorded parent, and without this it would refuse the land it
  # just completed.
  parent="$merged_target"
  cmd_destroy
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
  [ "$in_land" = 1 ] || prog="wt destroy"
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
    local landed_note="" branch_msg=""
    # Removal can still fail (a locked worktree, a busy path). Under `land` that
    # arrives after a successful merge, and git's own error says nothing about
    # the half that did work.
    [ "$in_land" = 0 ] || landed_note=" — the merge before it already succeeded"
    cd "$main_repo"
    { if [ "$1" = 1 ]; then git worktree remove --force "$wt"; else git worktree remove "$wt"; fi; } \
      || die "could not remove the worktree$landed_note"
    # Force-delete is safe here: the no-arg path runs only when integrated, and
    # the key path means the user explicitly confirmed.
    if [ -n "$branch" ] && git show-ref --verify --quiet "refs/heads/$branch"; then
      # Its "Deleted branch … (was <sha>)" line is worth keeping — that sha is
      # how the branch is recovered. Captured rather than redirected so the two
      # ways this can fail stay apart: the delete failing is real and must be
      # reported, while failing to print the confirmation is not and must not
      # turn a completed destroy into a non-zero exit.
      branch_msg="$(git branch -D "$branch" 2>&1)" \
        || die "could not delete branch '$branch'$landed_note: $branch_msg"
      printf '%s\n' "$branch_msg" >&2 || true
    fi
    git worktree prune
    rmdir "$(dirname "$wt")" 2>/dev/null || true   # remove empty group folder (case A)
    # As in merge: the work is done, so a failed write here must not turn a
    # completed destroy into a non-zero exit.
    printf 'destroyed worktree %s%s\n' "$wt" "${branch:+ (branch $branch)}" >&2 || true
  }

  key="$(statekey)"

  # Phase 2: a key was supplied.
  if [ $# -ge 1 ]; then
    if [ "$1" = "$key" ]; then
      destroy 1
      exit 0
    fi
    printf 'Confirmation key does not match the current state (it changed since the key was issued).\n' >&2
    printf 'To delete anyway, re-run with the new key:\n' >&2
    printf '    %s destroy %s\n' "$0" "$key" >&2
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

  printf 'Refusing to destroy this worktree: %s; this would lose work.\n' "$reason" >&2
  printf 'To delete anyway, re-run with the confirmation key:\n' >&2
  printf '    %s destroy %s\n' "$0" "$key" >&2
  exit 1
}

# -------------------------------------------------------------------- dispatch

cmd="${1:-}"
[ $# -gt 0 ] && shift
case "$cmd" in
  merge)     cmd_merge "$@" ;;
  land)      cmd_land "$@" ;;
  destroy)   cmd_destroy "$@" ;;
  -h|--help) usage 0 ;;
  # No verb is a usage error, not a help request — exit non-zero so a caller that
  # forgot the verb fails instead of looking like it succeeded.
  "")        usage 1 ;;
  *)         die "unknown command: $cmd  (expected: merge, land, destroy)" ;;
esac

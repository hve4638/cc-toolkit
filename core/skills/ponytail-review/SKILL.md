---
name: ponytail-review
description: "ponytail: diff 과잉 설계 정리"
disable-model-invocation: true
---

<ponytail-review>

Review diffs for unnecessary complexity. The diff's best outcome is getting
shorter. Read [`REVIEW_RULE.md`](REVIEW_RULE.md) in this folder first — the
finding tags and scope boundaries live there.

## Format

`L<line>: <tag> <what>. <replacement>.`, or `<file>:L<line>: ...` for
multi-file diffs.

## Examples

❌ "This EmailValidator class might be more complex than necessary, have you
considered whether all these validation rules are needed at this stage?"

✅ `L12-38: stdlib: 27-line validator class. "@" in email, 1 line, real validation is the confirmation mail.`

✅ `L4: native: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps.`

✅ `repo.py:L88: yagni: AbstractRepository with one implementation. Inline it until a second one exists.`

✅ `L52-71: delete: retry wrapper around an idempotent local call. Nothing replaces it.`

✅ `L30-44: shrink: manual loop builds dict. dict(zip(keys, values)), 1 line.`

## Scoring

End with the only metric that matters: `net: -<N> lines possible.`

If there is nothing to cut, say `Lean already. Ship.` and stop.

## Boundaries

Beyond `REVIEW_RULE.md`: a single smoke test or `assert`-based self-check is
the ponytail minimum, not bloat, never flag it for deletion.

</ponytail-review>

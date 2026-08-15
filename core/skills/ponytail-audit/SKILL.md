---
name: ponytail-audit
description: "ponytail 저장소 전체 스캔 모드"
disable-model-invocation: true
---

<ponytail-audit>

ponytail-review, repo-wide. Scan the whole tree instead of a diff. Rank
findings biggest cut first. Read [`REVIEW_RULE.md`](REVIEW_RULE.md) in this
folder first — the finding tags and scope boundaries live there.

## Hunt

Deps the stdlib or platform already ships, single-implementation interfaces,
factories with one product, wrappers that only delegate, files exporting one
thing, dead flags and config, hand-rolled stdlib.

## Output

One line per finding, ranked: `<tag> <what to cut>. <replacement>. [path]`.
End with `net: -<N> lines, -<M> deps possible.` Nothing to cut: `Lean already. Ship.`
One-shot.

</ponytail-audit>

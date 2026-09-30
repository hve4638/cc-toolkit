# Refine: from a rough approach to a reviewed proposal

Turn a visible problem and a fuzzy technical route into a proposal that is concrete enough to implement and focused enough to be one paper. Each round is one reviewer pass plus one revision; the user decides whether to run another.

## Contents

- Defaults
- Output structure
- Step 0: Freeze the Problem Anchor
- Step 1: Build the initial proposal
- Step 2: Reviewer round
- Step 3: Revise
- Step 4: Round gate
- Step 5: Finalize

## Defaults

- **OUTPUT_DIR**: `refine-logs/`. Created if missing.
- **MAX_LOCAL_PAPERS**: 15.
- **MAX_PRIMARY_CLAIMS**: 2. One dominant claim plus at most one supporting claim.
- **MAX_CORE_EXPERIMENTS**: 3 validation blocks inside the proposal. The full roadmap belongs to `plan.md`.
- **CONVERSATION**: `idea-refine`.

## Output structure

```text
refine-logs/
  round-0-proposal.md
  round-1-review.md
  round-1-revision.md
  round-2-review.md
  ...
  FINAL_PROPOSAL.md
```

Every `round-N-revision.md` contains the full proposal, not a diff.

## Step 0: Freeze the Problem Anchor

Before proposing anything, write the anchor. It is copied verbatim into every proposal and every revision.

- **Bottom-line problem**: the technical problem that must be solved
- **Must-solve bottleneck**: the specific weakness in current methods that is unacceptable
- **Non-goals**: what this project is explicitly not about
- **Constraints**: compute, data, time, tooling, venue, deployment
- **Success condition**: the evidence that would make the user say the problem is addressed

Reviewer feedback that would change the problem being solved is drift. It is recorded and pushed back on, not silently adopted.

## Step 1: Build the initial proposal

### 1.1 Grounding

Read the relevant parts of `papers/` and `literature/`, up to MAX_LOCAL_PAPERS. When local material is insufficient, search recent work in the field. Answer: what mechanism current methods use, where exactly they fail for this problem, and which recent techniques or representations are reusable. Read method sections and failure modes, not only abstracts.

### 1.2 Technical gap

1. **Current pipeline failure point**: where the baseline breaks
2. **Why naive fixes are insufficient**: more data, more capacity, more modules
3. **Smallest adequate intervention**: the least mechanism that could plausibly fix the bottleneck
4. **Modern alternative**: a route using current techniques of the field, if it matches the bottleneck better
5. **Core technical claim**: the mechanism claim that could survive review
6. **Required evidence**: the minimum proof for that claim

### 1.3 Choose the route

When two routes are plausible, compare the minimal route and the modern route on: which is more likely to become a strong paper under the constraints, which has the cleaner novelty story, and which avoids contribution sprawl. When both are weak, reframe instead of combining them.

### 1.4 Write `refine-logs/round-0-proposal.md`

```markdown
# Research Proposal: [Title]

## Problem Anchor
- Bottom-line problem:
- Must-solve bottleneck:
- Non-goals:
- Constraints:
- Success condition:

## Technical Gap
[Why current methods fail, why bigger systems are not enough, what mechanism is missing]

## Method Thesis
- One-sentence thesis:
- Why this is the smallest adequate intervention:

## Contribution Focus
- Dominant contribution:
- Optional supporting contribution:
- Explicit non-contributions:

## Proposed Method
### Complexity Budget
- Reused components:
- New components:
- Tempting additions intentionally not used:

### System Overview
[Step-by-step pipeline or ASCII graph]

### Core Mechanism
- Input / output:
- Model, algorithm, or policy:
- Objective or signal:
- Why this is the main novelty:

### Optional Supporting Component
- Only if truly necessary:
- Why it does not create contribution sprawl:

### Integration
[Where the new method attaches, what stays fixed, what is new, run-time order]

### Failure Modes and Diagnostics
- [Failure mode]: [how to detect] / [fallback]

### Novelty Argument
[Closest work, exact difference, why this is a mechanism-level contribution rather than a module pile-up]

## Claim-Driven Validation Sketch
### Claim 1: [Main claim]
- Minimal experiment:
- Baselines / ablations:
- Metric:
- Expected evidence:

### Claim 2: [Optional]
...

## Handoff to Plan
- Must-prove claims:
- Must-run ablations:
- Critical datasets / metrics:
- Highest-risk assumptions:

## Compute and Timeline Estimate (in numbers)
- Estimated compute:
- Data cost:
- Timeline:
```

The proposal answers "how would we actually build this". A method described only as "add a module" is not concrete enough.

## Step 2: Reviewer round

Write `refine-logs/round-N-review-bundle.md` with the prompt below, the field and venue, and the absolute path of the proposal to review (round 0 proposal, or the latest revision). Round 1 starts the conversation; later rounds continue it.

```text
codex_agent:                       # round 1
  name: idea-refine
  message: Read <absolute path to refine-logs/round-1-review-bundle.md> and follow all instructions in it.

codex_send:                        # round 2 and later
  name: idea-refine
  message: Read <absolute path to refine-logs/round-N-review-bundle.md> and follow all instructions in it.
```

Prompt to put in the bundle:

```text
You are a senior reviewer for <VENUE> in <FIELD>. This is an early-stage, method-first proposal.
Your job is to stress-test whether the method (1) still solves the anchored problem, (2) is concrete enough to implement, (3) is one focused contribution, (4) uses current techniques of the field where they are the natural fit.
Prefer the smallest adequate mechanism. Penalize parallel contributions. Ask for extra experiments only when needed to prove the core claims.
Read the Problem Anchor first. If a fix you suggest would change the problem being solved, label it as drift.

Proposal path (read this file yourself): <absolute path>

Score 1-10 on each: Problem Fidelity, Method Specificity, Contribution Quality, Feasibility, Validation Focus, Venue Readiness. Then an OVERALL score weighted toward the first three.
For each dimension below 7: the specific weakness, a concrete method-level fix, and priority CRITICAL / IMPORTANT / MINOR.
Then: Simplification Opportunities (1-3, or NONE), Drift Warning (NONE or explanation), Verdict READY / REVISE / RETHINK.
READY means overall 9 or more, no drift, one dominant contribution, no obvious bloat. RETHINK means the core mechanism or framing is off.
```

For round 2 and later, add to the bundle the list of key changes since the last review and the request to re-score the same dimensions and state whether the anchor is preserved.

Save the response verbatim to `refine-logs/round-N-review.md`.

## Step 3: Revise

1. Copy the Problem Anchor verbatim.
2. Anchor check: is the original bottleneck still solved, and which reviewer suggestions would cause drift.
3. Simplicity check: what the dominant contribution is now, what can be removed or merged, which suggestions add unnecessary complexity.
4. Process each reviewer point: valid ones sharpen or simplify the mechanism; debatable ones are revised with stated reasoning; wrong, drifting, or over-complicating ones are pushed back on with evidence from the papers and the anchor.

Write `refine-logs/round-N-revision.md`:

```markdown
# Round N Revision

## Problem Anchor
[verbatim from round 0]

## Anchor Check
- Original bottleneck:
- Why the revised method still addresses it:
- Reviewer suggestions rejected as drift:

## Simplicity Check
- Dominant contribution after revision:
- Components removed or merged:
- Reviewer suggestions rejected as unnecessary complexity:

## Changes Made
### 1. [section changed]
- Reviewer said:
- Action:
- Reasoning:

## Revised Proposal
[full proposal, same structure as round 0]
```

## Step 4: Round gate

Print the round summary and stop:

```text
Round N: overall X/10, verdict READY / REVISE / RETHINK, drift: NONE / <summary>
Changed: <1-3 lines>
Rejected: <1-3 lines>
Files: refine-logs/round-N-review.md, refine-logs/round-N-revision.md
Next: another round, or finalize?
```

Another round returns to Step 2 with the latest revision. Finalize goes to Step 5.

## Step 5: Finalize

Write `refine-logs/FINAL_PROPOSAL.md` with the latest full proposal and nothing else. If the last verdict was not READY, write the best current version and state the remaining weaknesses at the top in a short list.

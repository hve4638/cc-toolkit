# Plan: from a proposal to an experiment roadmap

Turn a proposal into a claim, evidence, run-order roadmap. Every experiment defends a claim; the output is a compact story, not a benchmark wishlist.

## Contents

- Defaults
- Step 0: Load the proposal
- Step 1: Freeze the claims
- Step 2: Build the storyline
- Step 3: Specify each block
- Step 4: Execution order
- Step 5: Write the outputs
- Rules

## Defaults

- **OUTPUT_DIR**: `refine-logs/`.
- **MAX_PRIMARY_CLAIMS**: 2.
- **MAX_CORE_BLOCKS**: 5.
- **MAX_BASELINE_FAMILIES**: 3.
- **DEFAULT_SEEDS**: 3 when variance matters and budget allows.

## Step 0: Load the proposal

Read `refine-logs/FINAL_PROPOSAL.md` and the latest `refine-logs/round-N-review.md` if they exist; otherwise take the same information from the user's request. Extract the Problem Anchor, the dominant contribution, the optional supporting contribution, the critical reviewer concerns, and the data, compute, and timeline constraints.

## Step 1: Freeze the claims

- **Primary claim**: the main mechanism-level contribution
- **Supporting claim**: only if it directly strengthens the story
- **Anti-claims to rule out**: for example "the gain comes only from more parameters" or "the gain comes only from a larger search space"
- **Minimum convincing evidence** per claim: what a strong reviewer would need to see

## Step 2: Build the storyline

Start from these blocks and delete the ones the claims do not need:

1. **Main result**: does the method solve the anchored bottleneck?
2. **Novelty isolation**: does the dominant contribution itself matter?
3. **Simplicity check**: the final method against an over-built variant or a tempting extra component the paper rejects
4. **Component necessity**: if one component is central, the chosen component against the strongest simpler alternative
5. **Failure analysis**: what the method still misses

Assign each block to main paper, appendix, or cut. Prefer one strong baseline family over many weak ones.

## Step 3: Specify each block

For every kept block:

- **Claim tested**
- **Why this block exists**
- **Dataset / split / task** (or channel model, scenario, and parameters)
- **Compared systems**: strongest baselines, ablations, and variants only
- **Metrics**: decisive first, secondary second
- **Setup details**: fixed and trained parts, key hyperparameters, budget, seeds
- **Success criterion**
- **Failure interpretation**: what a negative result means
- **Table / figure target**

## Step 4: Execution order

1. **Sanity**: data pipeline, metric correctness, one quick small-scale run
2. **Baseline**: reproduce the strongest baselines
3. **Main method**: the final method on the primary setting
4. **Decision**: the decisive ablations for novelty, simplicity, and necessity
5. **Polish**: robustness, qualitative figures, appendix extras

For each milestone estimate compute, turnaround, the stop or go gate, and the risk with its mitigation. Separate must-run from nice-to-have.

## Step 5: Write the outputs

`refine-logs/EXPERIMENT_PLAN.md`:

```markdown
# Experiment Plan

**Problem**: [problem]
**Method Thesis**: [one sentence]
**Date**: [today]

## Claim Map
| Claim | Why It Matters | Minimum Convincing Evidence | Linked Blocks |
|-------|----------------|-----------------------------|---------------|
| C1    | ...            | ...                         | B1, B2        |

## Paper Storyline
- Main paper must prove:
- Appendix can support:
- Experiments intentionally cut:

## Experiment Blocks

### Block 1: [Name]
- Claim tested:
- Why this block exists:
- Dataset / split / task:
- Compared systems:
- Metrics:
- Setup details:
- Success criterion:
- Failure interpretation:
- Table / figure target:
- Priority: MUST-RUN / NICE-TO-HAVE

### Block 2: [Name]
...

## Run Order and Milestones
| Milestone | Goal | Runs | Decision Gate | Cost | Risk |
|-----------|------|------|---------------|------|------|
| M0        | ...  | ...  | ...           | ...  | ...  |

## Compute and Data Budget
- Total estimated compute:
- Data preparation needs:
- Biggest bottleneck:

## Risks and Mitigations
- [Risk]: [Mitigation]

## Final Checklist
- [ ] Main paper tables are covered
- [ ] Novelty is isolated
- [ ] Simplicity is defended
- [ ] Nice-to-have runs are separated from must-run runs
```

`refine-logs/EXPERIMENT_TRACKER.md`:

```markdown
# Experiment Tracker

| Run ID | Milestone | Purpose | System / Variant | Split | Metrics | Priority | Status | Notes |
|--------|-----------|---------|------------------|-------|---------|----------|--------|-------|
| R001   | M0        | sanity  | ...              | ...   | ...     | MUST     | TODO   | ...   |
```

Then print: the must-run blocks, the highest-risk assumption, the first three runs to launch, and the two file paths.

## Rules

- The plan describes expected evidence. Results are never written here.

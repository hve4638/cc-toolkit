# Create: from a direction to ranked ideas

Turn a broad research direction into concrete, ranked idea candidates. The user gives a direction; this mode generates the ideas.

## Contents

- Defaults
- Step 1: Landscape survey
- Step 2: Structural gaps
- Step 3: Brainstorm with the reviewer
- Step 4: Mechanical consolidation
- Step 5: Ranking by the reviewer
- Step 6: Novelty check on the top picks
- Step 7: Report
- Rules

## Defaults

- **OUTPUT_DIR**: `idea-stage/`. Created if missing.
- **CANDIDATES**: 8 to 12 from the brainstorm.
- **TOP_PICKS**: 2 to 3 after ranking.
- **RESOURCES**: the compute and data the user named. When the request names none, ask before Step 3.

## Step 1: Landscape survey

1. Read the first 3 pages of relevant PDFs in `papers/` and `literature/`.
2. Search recent literature with WebSearch: top venues of the field in the last 2 years and preprints in the last 6 months. Use at least 5 query formulations and read the abstracts of the top 10 to 15 papers.
3. Group papers by sub-direction. Note what has been tried, recurring limitations in "Future Work" sections, and open problems stated by more than one paper.

## Step 2: Structural gaps

Go through the five lenses in order and write at least one gap per lens when one exists:

- **method-transfer**: works in setting A, untried in setting B
- **contradiction**: conflicting findings between papers
- **untested-assumption**: everyone assumes it, nobody measured it
- **scaling-regime**: a regime nobody explored
- **diagnostic**: a question nobody asked

Add a field-specific lens when the direction warrants one.

## Step 3: Brainstorm with the reviewer

Write `idea-stage/brainstorm_bundle.md` with the direction, the landscape map, the gaps, the field, and the prompt below. Then start the conversation:

```text
codex_agent:
  name: idea-brainstorm
  message: Read <absolute path to idea-stage/brainstorm_bundle.md> and follow all instructions in it.
```

Prompt to put in the bundle:

```text
You are a senior researcher in <FIELD> brainstorming research ideas.

Research direction: <direction>
Landscape: <landscape map>
Gaps: <gap list>
Resources: <compute, data, time>

Generate 8-12 concrete research ideas. For each idea give:
1. One-sentence summary
2. Core hypothesis (what you expect to find and why)
3. Minimum viable experiment (the cheapest test)
4. Contribution type: empirical finding / new method / theoretical result / diagnostic
5. Risk: LOW / MEDIUM / HIGH
6. Effort: days / weeks / months

Prioritize ideas that are testable with the stated resources, likely to give a clear positive or negative result, and simple at the core: one mechanism a colleague could restate after hearing it once.
"Apply X to Y" counts when the application reveals something non-obvious. A direct attack on a central problem counts when nobody has executed it well; proximity to strong work means the problem matters, not that it is taken.
Generate first, filter later. A bold idea with a named risk beats a hedged, complicated one.
```

Save the response verbatim to `idea-stage/brainstorm_response.md`.

## Step 4: Mechanical consolidation

1. Cluster near-identical ideas by hypothesis and keep one per cluster.
2. Drop an idea only on a resource fact: compute beyond the stated budget, or a dataset that is provably unavailable. Record the reason.
3. For every remaining idea attach three notes: `prior_work` (2 to 3 targeted searches, with links), `so_what` (why the result matters either way), `effort_note`.

Quality, novelty, and impact are judged in Step 5, not here.

## Step 5: Ranking by the reviewer

Write `idea-stage/triage_bundle.md` with the full annotated candidate set and the prompt below, then continue the conversation:

```text
codex_send:
  name: idea-brainstorm
  message: Read <absolute path to idea-stage/triage_bundle.md> and follow all instructions in it.
```

Prompt to put in the bundle:

```text
Here is the full annotated candidate set (deduplicated, within budget).
<candidates with prior_work / so_what / effort_note>

For each idea make the strongest case both ways:
- Best case for it: what would make this the paper people cite?
- Strongest objection a reviewer would raise
- Most likely failure mode
- Is the prior_work note a real novelty problem, or differentiable?

Rank all ideas by expected information and upside within the stated resources. Name the 2-3 you would actually work on and why.
Rank; do not rewrite. An objection is answered or recorded as a named risk, never absorbed by adding a module or a qualifier. If the top set is all LOW risk, name the high-upside idea that most deserves a slot and what result would convince you.
```

Save the response verbatim to `idea-stage/triage_response.md`. Ideas outside the top picks remain candidates in the report.

## Step 6: Novelty check on the top picks

Run `novelty.md` on each top pick. Carry its verdict and closest prior work into the report.

## Step 7: Report

Write `idea-stage/IDEA_REPORT.md`. For every recommended idea the method comes first, in plain language, before any hypothesis or score.

```markdown
# Research Idea Report

**Direction**: [direction]
**Field / venue**: [field, target venue]
**Generated**: [date]
**Ideas**: X generated, Y within budget, Z recommended

## Landscape Summary
[3-5 paragraphs]

## Recommended Ideas (ranked)

### Idea 1: [title]
- **Method (what we actually do)**: [2-4 concrete steps]
- **Hypothesis**: [one sentence]
- **Minimum experiment**: [concrete description]
- **Expected outcome**: [what success and failure look like]
- **Novelty**: [verdict from novelty.md] - closest work: [paper]
- **Feasibility**: [compute, data, implementation]
- **Risk**: LOW / MEDIUM / HIGH
- **Contribution type**: empirical / method / theory / diagnostic
- **Reviewer's strongest objection**: [from the ranking]
- **Why this one**: [1-2 sentences]

### Idea 2: [title]
...

## Other Candidates
| Idea | Rank | Reviewer's note |
|------|------|-----------------|

## Excluded on Resources
| Idea | Reason |
|------|--------|

## Suggested Order
1. [idea and why first]
2. [backup]
```

Then print a short summary: the top picks, one line each, and the report path.

## Rules

- The direction is the user's. The ideas are this mode's job.
- A broad direction (for example a whole subfield) is narrowed to 2 to 3 concrete frames in Step 1 before brainstorming.
- Excluded ideas stay in the report with their reason.

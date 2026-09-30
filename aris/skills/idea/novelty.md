# Novelty: has this been done?

Check one idea or method description against the literature and give a calibrated verdict.

## Defaults

- **CLAIMS**: 3 to 5 core technical claims.
- **QUERIES**: at least 3 formulations per claim.
- **WINDOW**: the last 2 years, plus the last 6 months of preprints checked separately.
- **DOSSIER**: `NOVELTY_DOSSIER.md` in the project root.

## Step 1: Extract the claims

From the description identify the claims that carry the delta: what the method is, what problem it solves, what the mechanism is, and what separates it from obvious baselines.

## Step 2: Search per claim

For each claim search with the lit skill's survey procedure (`${CLAUDE_PLUGIN_ROOT}/skills/lit/survey.md`, Steps 1 and 2): arXiv and Semantic Scholar scripts plus WebSearch. Read the abstract and related-work section of every paper that might overlap.

Run every candidate through `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/verify_papers.py` and tag each one `verified` or `UNVERIFIED`.

## Step 3: Cross-model verification

Write the dossier with the method description, the claims, the candidate papers with their tags, the field, the questions "Is this novel? What is the closest prior work? What is the delta?", and the verdict limits below verbatim. Then:

```text
codex_agent:
  name: idea-novelty
  message: Read <absolute path to NOVELTY_DOSSIER.md> and follow all instructions in it.
```

Save the response verbatim to `NOVELTY_RESPONSE.md`.

## Verdict limits

Copy this block verbatim into the dossier. The report in Step 4 is judged under it too.

```text
=== NOVELTY VERDICT LIMITS (these bound how you judge, never how widely you search) ===
Search exhaustively; judge calibrated. Two failures waste months equally:
passing an idea a published paper already contains, and killing a viable idea
because the territory has neighbors.
1. Proximity is information, not a verdict. Someone working nearby goes in the
   report; it is not by itself a reason to reject.
2. ABANDON has exactly one qualification: a specific published paper already
   contains this result - name that paper. No named paper, no ABANDON.
3. Crowded-but-deltaed is PROCEED: state the delta in one sentence a reviewer
   could verify. Thin or contested delta is PROCEED WITH CAUTION - say what
   would make it carry, not why it should die. CAUTION is not a safe middle:
   if you cannot name the specific thing that makes the delta thin, the
   verdict is PROCEED.
4. Concurrent or competing work is not a veto. That is a race - report it and
   let the user decide whether to run it.
5. A direct attack on a central problem is legitimate novelty when nobody has
   executed it well. "This area is hot" does not mean "this area is taken."
6. This check is an early gate, never the last one. A wrongly passed idea dies
   cheaply later; a wrongly killed idea is never seen again. When torn between
   two verdicts, choose the more permissive one.
Say plainly when an idea clears the check. Do not manufacture overlap.
```

## Step 4: Report

```markdown
## Novelty Check Report

### Proposed Method
[1-2 sentences]

### Core Claims
1. [Claim] - Closest: [paper] - What stays unknown or different: [delta]
2. ...

### Closest Prior Work
| Paper | Year | Venue | Overlap | Key Difference | Verified |
|-------|------|-------|---------|----------------|----------|

### Overall Novelty Assessment
- Score: X/10 (5/10 = clear neighbors but a defensible delta worth a pilot; 1-3 only for a result a named published paper already contains)
- Recommendation: PROCEED / PROCEED WITH CAUTION / ABANDON
- Key differentiator: [what makes this unique, if anything]
- Risk: [what a reviewer would cite as prior work]

### Suggested Positioning
[The delta in one sentence a reviewer could verify]
```

## Rules

- Judge the idea as a whole. Known parts arranged to reveal something unknown are novel even when every individual claim rates low.
- Check both the method and the experimental setting. If the method is known but the finding would be new, say so.
- If the reviewer's verdict and the search disagree, report both and the reason.

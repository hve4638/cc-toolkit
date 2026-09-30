# Kill: strongest rejection memo, then a ruling

Two independent reviewer conversations. The first writes the single strongest argument for rejecting the paper. The second rules, point by point, whether the current text answers it.

## Contents

- Defaults
- Step 1: Inventory the paper
- Step 2: Attack
- Step 3: Adjudicate
- Step 4: Verdict and report
- Rules

## Defaults

- **PAPER_DIR**: the directory the user named.
- **ATTACK_LENGTH**: about 200 words, never above 250.
- **POINTS**: 3 to 7 atomic rejection points in the ruling.
- **OUTPUT**: `KILL_ARGUMENT.md` in PAPER_DIR.
- **CONVERSATIONS**: `idea-attack` and `idea-adjudicate`, both started fresh with `codex_agent`. Nothing from earlier reviews, fix lists, or this session's summaries enters either prompt.

## Step 1: Inventory the paper

```bash
cd "PAPER_DIR"
grep -lE '^\\documentclass' *.tex | head -1        # entry point
find . -name "*.tex" -not -path "./.git/*"
find . -name "*.bib" -not -path "./.git/*"
ls *.pdf 2>/dev/null                               # compiled PDF, if any
```

When no compiled PDF exists, the prompts say so, and the reviewers work from the sources.

## Step 2: Attack

```text
codex_agent:
  name: idea-attack
  message: |
    You are simulating a hostile reviewer for <VENUE> in <FIELD>. Your task is not a balanced review but the single strongest argument for rejecting this paper.

    Files: entry <ENTRY>, all section files, macro files, compiled PDF <main.pdf or "none">. Read the sources yourself. Use no prior reviews or summaries.

    Write the worst-case rejection memo a senior area chair would produce, about 200 words, at most 250. One argument, not a list: pick the most damaging line and develop it. Choose from these axes, combining at most two:
    1. Claim-vs-evidence gap: is the evidence too narrow for the stated result?
    2. Scope overclaim: does the title or abstract sell more than the body proves?
    3. Assumption-vs-claim mismatch: does the body retreat to a narrower object than advertised?
    4. Missing obligation: is a lemma, bound, or condition the headline depends on invoked but not established?
    5. Theorem validity (theory papers): are central results proved as stated?
    6. Limit-order or regime ambiguity: are limits or operating regimes composed in a way the paper does not commit to?
    Cite file:line or equation numbers when accusing. Dispassionate, uncompromising, no hedging, no acknowledging mitigations elsewhere in the paper.
    Output the memo only.
```

Save the memo verbatim to `PAPER_DIR/KILL_ATTACK.md`.

## Step 3: Adjudicate

```text
codex_agent:
  name: idea-adjudicate
  message: |
    You are an independent area-chair adjudicator. Read the paper sources (same file list as above) and the rejection memo below. Rule, from the current sources alone, whether each point stands. Use no prior reviews or fix lists.

    Rejection memo:
    > <memo verbatim>

    Decompose the memo into 3-7 atomic rejection points. For each:
    ### Point P_n: <short label>
    **Attack claim**: <about 30 words>
    **Verdict**: answered_by_current_text | partially_answered | still_unresolved
    **Evidence (or lack of)**: <file:line, about 50 words>
    **Severity if unresolved**: critical | major | minor
    **If unresolved, recommended fix**: <one actionable sentence>

    Then:
    ## Summary: counts per verdict
    ## Net assessment: one paragraph. Would this paper survive a senior area chair reading the memo, given only the current sources?
    ## Top action items: at most 3, in priority order

    An author-chosen position (for example a deliberate title scope) is partially_answered with a note that it is intentional, plus whether it is sustainable under the attack. Keep severity honest; do not rationalize on the paper's behalf.
```

Save the ruling verbatim to `PAPER_DIR/KILL_ADJUDICATION.md`.

## Step 4: Verdict and report

The verdict is computed from the ruling's counts, not stated by the adjudicator:

| Verdict | Condition |
|---------|-----------|
| FAIL | any `still_unresolved` at critical |
| WARN | any `still_unresolved` at major or minor, or any `partially_answered` at critical or major |
| PASS | everything else |

Write `PAPER_DIR/KILL_ARGUMENT.md`:

```markdown
# Kill Argument Report - <paper title>

**Date**: <YYYY-MM-DD>
**Reviewer**: GPT via codex_agent, two fresh conversations
**Verdict**: PASS / WARN / FAIL

## Net assessment
<from the ruling>

## Attack memo (verbatim)
> <memo>

## Ruling (per point)
<verbatim from the ruling>

## Top action items
<from the ruling>
```

Print the verdict, the counts, the still-unresolved points with their severities, the action items, and the report path.

## Rules

- This mode reports; it edits no paper file.

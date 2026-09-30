# Review: external critical review

Get a critical review of a proposal, a draft, or a result set from the external reviewer, in rounds. Each round ends with the user deciding how to respond.

## Defaults

- **BRIEF**: `RESEARCH_REVIEW_REQUEST.md` in the project root. Later rounds use `RESEARCH_REVIEW_ROUND_N.md`.
- **OUTPUT**: `RESEARCH_REVIEW.md` in the project root.
- **CONVERSATION**: `idea-review`.

## Step 1: Gather the context

Read the narrative documents (for example STORY.md, README.md, drafts), notes on findings and experiment history, and the artifacts the reviewer should inspect. Identify the core claims, the methodology, the key results, and the known weaknesses.

## Step 2: Round 1

Write the brief with the full context, the specific questions, and the paths of the primary artifacts and raw results. State the known weaknesses; hiding them produces a weaker review. Then:

```text
codex_agent:
  name: idea-review
  message: |
    Read the review brief at <absolute path to RESEARCH_REVIEW_REQUEST.md>.
    Author notes are not evidence beyond the files they cite; verify the referenced artifacts before judging.
    Act as a senior reviewer for <VENUE> in <FIELD>. Start from the assumption that the work is broken somewhere and find where. Identify:
    1. Logical gaps or unjustified claims
    2. Missing experiments that would strengthen the story
    3. Narrative weaknesses
    4. Whether the contribution is sufficient for the venue
    Say plainly when something is correct. If, after genuinely trying to break it, the work holds up, say so.
```

Save the response verbatim to `RESEARCH_REVIEW_ROUND_1_RESPONSE.md`.

## Step 3: Round gate

Summarize the review in at most 10 lines: the criticisms by severity and the actionable requests. Then stop and ask the user which points to answer with evidence, which to push back on, and which follow-up to request. Useful follow-ups:

- "If we reframe X as Y, does that change your assessment?"
- "What is the minimum experiment to satisfy concern Z?"
- "Design the minimal additional experiment package with the highest acceptance lift per unit of compute."
- "Write a mock review for <VENUE> with scores."
- "Give a results-to-claims matrix for the possible outcomes of experiments X and Y."

## Step 4: Later rounds

Write `RESEARCH_REVIEW_ROUND_N.md` with the responses, counter-evidence, and follow-up questions the user chose, then:

```text
codex_send:
  name: idea-review
  message: |
    Read the updated brief at <absolute path to RESEARCH_REVIEW_ROUND_N.md>.
    Focus on the unresolved weaknesses and whether the responses actually resolve them.
```

Save the response verbatim and return to Step 3. Rounds converge when both sides agree on the core claims and their evidence requirements, a concrete experiment list exists, and the narrative structure is settled.

## Step 5: Document

Write `RESEARCH_REVIEW.md`, self-contained without the conversation:

- Round-by-round summary of criticisms and responses
- Final consensus on claims, narrative, and experiments
- Claims matrix: which claim is allowed under each possible outcome
- Prioritized to-do list with compute estimates
- Paper outline, if discussed

## Rules

- Every request to the reviewer asks for something actionable: an experiment, an outline, a matrix.

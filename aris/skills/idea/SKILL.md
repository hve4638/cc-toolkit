---
name: idea
description: Generate, check, refine, review, and plan research ideas with an external GPT reviewer.
disable-model-invocation: true
argument-hint: "[direction, idea, proposal path, or paper directory]"
---

# idea

## Modes

Each mode has its own document in this skill's directory.

| Mode | Document | Input | Output | Usually followed by |
|------|----------|-------|--------|---------------------|
| Create | `create.md` | a research direction | ranked idea candidates in `idea-stage/IDEA_REPORT.md` | Novelty, then Refine |
| Novelty | `novelty.md` | one idea or method description | novelty verdict with closest prior work | Refine |
| Refine | `refine.md` | a problem and a rough approach | a reviewed proposal in `refine-logs/FINAL_PROPOSAL.md` | Plan or Review |
| Review | `review.md` | a proposal, draft, or result set | a review document with agreed claims and a to-do list | Plan |
| Plan | `plan.md` | a proposal | `refine-logs/EXPERIMENT_PLAN.md` and a run tracker | running the experiments |
| Kill | `kill.md` | a paper directory | `KILL_ARGUMENT.md`: strongest rejection memo and a point-by-point ruling | fixing the paper |

## Choosing a mode

1. If the request is empty or asks what this skill can do, describe each mode in one line (input and output) and ask which one the user wants. Stop there.
2. If the request names a mode or matches exactly one row above, use that mode.
3. If the input is a paper directory with LaTeX sources, use Kill.
4. Otherwise write one line stating the mode, the input files, and the field and target venue to be used, then stop and wait for the user's approval. Reviewer calls start after the approval.

## Running the mode

Read the chosen document with the Read tool, then follow it. Its path is this skill's directory plus the file name.

## Rules for every mode

- Take the research field and the target venue from the request or from the project `CLAUDE.md`, and put them into every reviewer prompt. When neither states them, ask before the first reviewer call.
- The external reviewer is GPT through the core tools `codex_agent` (start a named conversation) and `codex_send` (continue it). Long inputs go into a file; the prompt carries the absolute path.
- A mode with rounds stops after each round and continues only when the user asks for another.
- Every cited paper passes `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/verify_papers.py`. An unverified paper stays in the output with an `UNVERIFIED` tag.

Request: $ARGUMENTS

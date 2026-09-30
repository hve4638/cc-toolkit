---
name: lit
description: Find, read, and survey research papers through arXiv, Semantic Scholar, AlphaXiv, and DeepXiv.
disable-model-invocation: true
argument-hint: "[topic, paper id/url, or request]"
---

# lit

## Modes

Each mode has its own document in this skill's directory.

| Mode | Document | Pick when the request |
|------|----------|-----------------------|
| arXiv search | `arxiv.md` | wants preprints, the latest work, or a PDF downloaded into the local paper folder |
| Published search | `semantic-scholar.md` | wants journal or conference papers, citation counts, or IEEE/ACM/Springer venues |
| Single paper | `alphaxiv.md` | gives one arXiv ID or URL and asks what the paper says |
| Progressive read | `deepxiv.md` | wants to read one section of a paper, or trending papers, without loading a full PDF |
| Survey | `survey.md` | asks for related work, a literature review, a landscape, or "what exists on X" across sources |

## Choosing a mode

1. If the request is empty or asks what this skill can do, describe each mode in one line (input and output) and ask which one the user wants. Stop there.
2. If the request names a source or matches exactly one row above, use that mode.
3. If the request is a single arXiv ID or URL with no other instruction, use Single paper.
4. Otherwise write one line stating the mode, the sources, the year window, and the result count, then stop and wait for the user's approval. Searches and scripts start after the approval.

Example of the line in rule 4:

```text
Plan: Survey. Sources: local papers/, arXiv, Semantic Scholar. Window: 2022 to now, plus a few foundational papers. Up to 10 per source. Proceed?
```

## Running the mode

Read the chosen document with the Read tool, then follow it. Its path is this skill's directory plus the file name.

## Rules for every mode

- Show the arXiv ID or DOI for every paper.
- Every ID, DOI, and title comes from a search result or the user's input. An unknown field stays empty and is marked as unknown.
- Distinguish preprints from peer-reviewed papers in every table.

Literature request: $ARGUMENTS

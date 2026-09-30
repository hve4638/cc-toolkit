# AlphaXiv single-paper lookup

Read one arXiv paper quickly through AlphaXiv's LLM-oriented summaries. Three tiers of depth, from a short overview to the LaTeX source. Not for topic search.

## Defaults

- **OVERVIEW_URL**: `https://alphaxiv.org/overview/{PAPER_ID}.md`
- **ABS_URL**: `https://alphaxiv.org/abs/{PAPER_ID}.md`
- **ARXIV_SRC_URL**: `https://arxiv.org/src/{PAPER_ID}`
- **ALPHAXIV_UA**: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36`. AlphaXiv may return 403 for non-browser user agents. Bump the version numbers if it starts blocking this value.

## Step 1: Extract the paper ID

Accept these forms and reduce them to a bare ID such as `2401.12345`:

- `https://arxiv.org/abs/2401.12345` or with `v2`
- `https://arxiv.org/pdf/2401.12345`
- `https://alphaxiv.org/overview/2401.12345`
- `https://alphaxiv.org/abs/2401.12345`
- `2401.12345` or `2401.12345v2`

Strip version suffixes.

## Step 2: Overview (tier 1)

```bash
curl -sL --max-time 15 -A "{ALPHAXIV_UA}" "https://alphaxiv.org/overview/{PAPER_ID}.md"
```

This is a structured report written for machine consumption. If it answers the user's question, stop here.

If the request fails (403 bot block, 404 not yet processed) or returns empty content, go to Step 3.

## Step 3: Full markdown (tier 2)

```bash
curl -sL --max-time 15 -A "{ALPHAXIV_UA}" "https://alphaxiv.org/abs/{PAPER_ID}.md"
```

Use when the user needs methodology details, experimental results, or a section the overview skipped. If this still does not answer the question, go to Step 4.

## Step 4: LaTeX source (tier 3)

Use for equations, proofs, appendix details, or implementation specifics. Download `https://arxiv.org/src/{PAPER_ID}` into a temporary directory under `/tmp`, extract the `.tar.gz`, and list the `.tex` files. Prefer Python stdlib for download and extraction so the step works on any platform.

Read only the files needed to answer the question, in this order:

1. Top-level `*.tex` files
2. Files pulled in by `\input{}` or `\include{}`
3. Appendices, tables, or sections related to the question

## Step 5: Present

```markdown
## [Paper Title]

- **arXiv**: [PAPER_ID] - https://arxiv.org/abs/[PAPER_ID]
- **Source depth**: overview | abs | src

### Summary
[2-3 sentence summary]

### Key Points
- [point 1]
- [point 2]
- [point 3]

### Answer to Your Question
[Direct answer if the user asked a specific question]
```

If the user asked for one specific detail, answer it directly and skip the template.

## Rules

- This mode reads markdown and LaTeX, not PDFs. For a PDF, offer the arXiv mode with download.
- On HTTP 429 from arXiv source download, wait 5 seconds and retry once. If still blocked, report it and offer the Progressive read mode.

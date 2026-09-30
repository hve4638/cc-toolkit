# arXiv search and download

Search arXiv by topic or ID, list results, download PDFs on request, and summarize.

## Defaults

- **PAPER_DIR**: `papers/` in the current project. Created if missing.
- **MAX_RESULTS**: 10.
- **SCRIPT**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py`

## Step 1: Parse the request

Identify the query or a bare arXiv ID. IDs look like `2301.07041` or `cs/0601001`. Strip a version suffix such as `v2`.

If the request is an ID, skip to Step 3.

## Step 2: Search

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" search "QUERY" --max MAX_RESULTS
```

The script prints JSON with id, title, authors, abstract, published date, categories, and URLs. Present the results as a table:

```text
| # | arXiv ID   | Title               | Authors        | Date       | Category |
|---|------------|---------------------|----------------|------------|----------|
| 1 | 2301.07041 | Attention Is All... | Vaswani et al. | 2017-06-12 | cs.LG    |
```

## Step 3: Fetch one paper

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" search "id:ARXIV_ID" --max 1
```

Show title, all authors, categories, full abstract, published date, PDF URL, and abstract URL.

## Step 4: Download PDFs

Only when the user asked for a download.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" download ARXIV_ID --dir PAPER_DIR
```

The script validates the file, waits between downloads, retries on HTTP 429, and skips an existing PDF. Report its output as is:

- `Downloaded: papers/2301.07041.pdf (842 KB)`
- `Skipped: papers/2301.07041.pdf already exists`
- Any error message the script printed

## Step 5: Summarize

For each paper the user asked about:

```markdown
## [Title]

- **arXiv**: [ID] - [abs_url]
- **Authors**: [full author list]
- **Date**: [published]
- **Categories**: [cs.LG, cs.AI, ...]
- **Abstract**: [full abstract]
- **Key contributions** (from the abstract):
  - [contribution 1]
  - [contribution 2]
  - [contribution 3]
- **Local PDF**: papers/[ID].pdf (if downloaded)
```

## Step 6: Report

- `Found N papers for "query"`
- One line per download
- Any warnings: rate limit, file too small, already exists

## Rules

- If the arXiv API is unreachable, report the error and offer the Survey mode with web search.

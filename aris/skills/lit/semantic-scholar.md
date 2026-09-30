# Semantic Scholar search

Search published journal and conference papers (IEEE, ACM, Springer, and others) through the Semantic Scholar API. This mode adds what arXiv lacks: venue names, citation counts, DOIs, and venue-only papers that have no preprint.

## Contents

- Defaults
- Step 1: Parse the request
- Step 2: Search
- Step 3: Fetch one paper
- Step 4: Mark arXiv overlap
- Step 5: Present results
- Step 6: Detailed summary
- Step 7: Report
- Rules

## Defaults

- **MAX_RESULTS**: 10.
- **SCRIPT**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py`
- **DEFAULT_FILTERS**: `--fields-of-study "Computer Science,Engineering" --publication-types JournalArticle,Conference`. Without these, results include unrelated disciplines.

## Step 1: Parse the request

Identify the query or a paper identifier:

- DOI: `10.1109/TWC.2024.1234567`
- Semantic Scholar ID: 40 hex characters
- arXiv: `ARXIV:2006.10685`
- Corpus: `CorpusId:219792180`

If the request is an identifier, skip to Step 3.

## Step 2: Search

Relevance search (default):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" search "QUERY" --max MAX_RESULTS \
  --fields-of-study "Computer Science,Engineering" \
  --publication-types JournalArticle,Conference
```

Bulk search, when the user asks for sorting by citations or date, or for more than 100 results:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" search-bulk "QUERY" --max MAX_RESULTS \
  --sort citationCount:desc \
  --fields-of-study "Computer Science" \
  --year "2020-"
```

Useful flag combinations:

| Goal | Flags |
|------|-------|
| High-quality journal papers | `--publication-types JournalArticle --min-citations 10` |
| CS/EE papers, recent | `--fields-of-study "Computer Science,Engineering" --year "2022-"` |
| Foundational, high impact | `search-bulk --sort citationCount:desc --fields-of-study "Computer Science"` |
| Conference papers only | `--publication-types Conference` |

`--venue` needs the exact venue name and returns nothing on a partial name, so filter by publication type and field of study instead.

## Step 3: Fetch one paper

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" paper "PAPER_ID"
```

PAPER_ID accepts any of the identifier forms from Step 1.

## Step 4: Mark arXiv overlap

For each result, check `externalIds.ArXiv`:

- Present: the paper is also on arXiv. Note the arXiv ID. Do not fetch it again.
- Absent: the paper is venue-only.

## Step 5: Present results

```text
| # | Title | Venue | Year | Citations | Authors | Type |
|---|-------|-------|------|-----------|---------|------|
| 1 | Deep Learning Enabled... | IEEE Trans. Signal Process. | 2021 | 1364 | Xie et al. | Journal |
```

## Step 6: Detailed summary

For each paper, or the top 5 when there are many:

```markdown
## [Title]

- **Venue**: [venue name] ([publicationVenue.type]: journal/conference)
- **Year**: [year] | **Citations**: [citationCount]
- **Authors**: [full author list]
- **DOI**: [doi link]
- **Fields**: [fieldsOfStudy]
- **TLDR**: [tldr.text, or the first sentence of the abstract when absent]
- **Abstract**: [abstract]
- **Open Access**: [openAccessPdf.url or "Not available"]
- **Also on arXiv**: [ArXiv ID if exists, else "No"]
```

## Step 7: Report

- `Found N published papers for "query"`
- `Filters applied: ...`
- `N papers are venue-only (not on arXiv)`

## Rules

- Keep the default filters unless the user removes them.
- Show citation counts prominently and use them to rank results.
- The API without a key allows about 1 request per second. The user may set `SEMANTIC_SCHOLAR_API_KEY` for higher limits.
- If the API is unreachable, report the error and offer the arXiv mode.

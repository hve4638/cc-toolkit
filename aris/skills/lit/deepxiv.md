# DeepXiv search and progressive reading

Search open-access papers through DeepXiv and read them in stages: brief, section map, then one section. Use it when only part of a paper matters.

## Defaults

- **MAX_RESULTS**: 10.
- **SCRIPT**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py`. It wraps the `deepxiv` CLI.

## Setup

DeepXiv is optional. If the CLI is missing, tell the user:

```bash
pip install deepxiv-sdk
```

On first use `deepxiv` registers a free token and stores it in `~/.env`.

## Step 1: Parse the request

Identify the query or an arXiv ID, and the depth the user wants:

- search by topic
- brief summary of one paper
- section map of one paper
- one named section of one paper
- trending papers, with a window of 7, 14, or 30 days
- DeepXiv web search

If the request is an arXiv ID with no depth stated, use brief.

## Step 2: Run the smallest command that answers

Search:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" search "QUERY" --max MAX_RESULTS
```

Brief:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" paper-brief ARXIV_ID
```

Section map:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" paper-head ARXIV_ID
```

One section:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" paper-section ARXIV_ID "SECTION_NAME"
```

Trending:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" trending --days 7 --max MAX_RESULTS
```

Web search:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" wsearch "QUERY"
```

## Step 3: Present

For a search:

```text
| # | ID | Title | Year | Citations | Notes |
|---|----|-------|------|-----------|-------|
```

For a paper read, show title, arXiv ID, authors, venue or date if available, TLDR or abstract summary, and the next depth the user can ask for.

## Step 4: Deepen only when needed

Progression: search, brief, section map, one section, full paper only if nothing else answers the question.

## Rules

- If DeepXiv is unavailable, give the install command and offer the arXiv mode.
- If a result is also a published paper found through Semantic Scholar, keep the richer venue metadata in the final summary.

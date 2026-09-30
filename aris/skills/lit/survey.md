# Literature survey

Find related work on a topic across several sources, verify that every candidate paper exists, and synthesize the landscape into a table and a narrative. For communications topics, apply the venue priority in the section below.

## Contents

- Defaults
- Step 0: What the user already has
- Step 1: External search
- Venue priority for communications topics
- Step 2: Verify that the candidates exist
- Step 3: Extract per paper
- Step 4: Synthesize
- Step 5: Output
- Step 6: Save
- Rules

## Defaults

- **PAPER_LIBRARY**: local PDFs, checked in this order: `papers/`, `literature/`, then a path the user named under a `## Paper Library` heading in the project `CLAUDE.md`.
- **MAX_LOCAL_PAPERS**: 20. If more are found, prioritize by filename relevance.
- **SOURCES**: local, arXiv, Semantic Scholar, web. DeepXiv joins only when the user asks.
- **WINDOW**: if the user gave no year range, collect a recent set (2022 to now) and a small foundational set (before 2022).
- **MAX_PER_SOURCE**: 10.
- **DOWNLOAD**: off. When the user asks, download up to 5 of the most relevant arXiv PDFs into PAPER_LIBRARY.
- **SCRIPTS**: `${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/` holds `arxiv_fetch.py`, `semantic_scholar_fetch.py`, `deepxiv_fetch.py`, and `verify_papers.py`.

## Step 0: What the user already has

Search the local library before going external.

1. Glob `papers/**/*.pdf` and `literature/**/*.pdf`, plus the CLAUDE.md path if any.
2. Keep the ones whose filename or first page matches the topic, up to MAX_LOCAL_PAPERS.
3. Read the first 3 pages of each. Extract title, authors, year, core contribution, and relevance.

If all library paths are missing, say so before moving on:

```text
WARN: no local PDFs found in papers/, literature/, or a configured paper library. Add a "## Paper Library" heading to CLAUDE.md followed by the directory path to include yours.
```

## Step 1: External search

Run each enabled source. Skip papers already found in Step 0. If a script fails, print its error and continue with the other sources. If every source fails, stop and report.

arXiv:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" search "QUERY" --max 10
```

Semantic Scholar:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/semantic_scholar_fetch.py" search "QUERY" --max 10 \
  --fields-of-study "Computer Science,Engineering" \
  --publication-types "JournalArticle,Conference"
```

DeepXiv, only when requested:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/deepxiv_fetch.py" search "QUERY" --max 10
```

Web: use WebSearch for arXiv, Semantic Scholar, Google Scholar, and publisher pages. Prefer primary pages (publisher, DOI, official conference site, author-hosted copy) over blog posts and tertiary summaries.

Merge rules:

- Match papers by arXiv ID first, DOI second, normalized title third.
- If a paper is on both arXiv and Semantic Scholar and Semantic Scholar shows a venue, use its venue, citation count, and DOI. Keep the arXiv link for the PDF.
- If Semantic Scholar shows no venue, keep the arXiv record as a preprint.
- Semantic Scholar results without `externalIds.ArXiv` are venue-only papers. Keep them.

Optional download, only when the user asked:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/arxiv_fetch.py" download ARXIV_ID --dir papers/
```

Download only the top 5 by relevance.

## Venue priority for communications topics

Apply this section when the topic is wireless, cellular, satellite or NTN, Wi-Fi, routing, scheduling, beamforming, rate or link adaptation, channel estimation, transport protocols, congestion control, or cross-layer design.

Search from the top tier down. Widen only when the higher tier is sparse or the topic clearly publishes elsewhere. The tiers are a soft ranking; treat Tier A as a hard filter only when the user says "top venues only".

Tier A. Journals: IEEE JSAC, IEEE/ACM ToN, IEEE TWC, IEEE TCOM. Conferences: ACM SIGCOMM, USENIX NSDI, ACM MobiCom, ACM CoNEXT, IEEE INFOCOM.

Tier B. Journals: IEEE TVT, IEEE WCL, IEEE Communications Letters, Computer Networks, Computer Communications, Ad Hoc Networks, Physical Communication. Conferences: IEEE ICC, IEEE GLOBECOM, IEEE WCNC, IEEE PIMRC, ACM MobiHoc.

Tier C. Other relevant IEEE transactions, Elsevier journals, ACM conferences and workshops, and topic-specific satellite, optical, vehicular, IoT, aerial, or edge venues.

Publication policy:

- Prefer peer-reviewed journals and major conferences.
- Label workshop papers as `workshop` and arXiv-only or author-hosted versions as `preprint`.
- If both a preprint and a formal version exist, cite the formal version first.
- If transport-layer rate control and PHY/MAC rate adaptation land in one group, say so.

## Step 2: Verify that the candidates exist

Run this on every candidate from Steps 0 and 1 before analysis.

```bash
mkdir -p .lit
cat > .lit/candidates.json <<'JSON'
[
  {"id": "p1", "arxiv_id": "2307.03172", "doi": null, "title": "Lost in the Middle"},
  {"id": "p2", "arxiv_id": null, "doi": "10.1145/...", "title": "..."},
  {"id": "p3", "arxiv_id": null, "doi": null, "title": "Some Paper Title"}
]
JSON
python3 "${CLAUDE_PLUGIN_ROOT}/skills/lit/scripts/verify_papers.py" \
  --input .lit/candidates.json --output .lit/verified.json
```

The script checks arXiv, then CrossRef, then Semantic Scholar by fuzzy title. Read the verdict and each paper's status from `.lit/verified.json`.

- Leave unknown fields `null`. The script falls through to title search.
- Tag every paper in the output: `verified (via arxiv|crossref|s2)`, `UNVERIFIED (reason)`, or `verify_pending`.
- Every candidate stays in the output with its tag, including unverified ones.
- If the verdict warns about a high hallucination rate, show the warning verbatim and suggest narrower queries.
- The user may set `ARIS_VERIFY_EMAIL=you@institution.edu` to lift CrossRef rate limits.

## Step 3: Extract per paper

For every paper in `.lit/verified.json`, regardless of status, record:

- **Problem**: the gap it addresses
- **Method**: the core technical contribution in 1 to 2 sentences
- **Results**: key numbers or claims
- **Limitation**: what it does not cover
- **Relevance**: how it relates to the user's topic
- **Source**: local, arxiv, semantic-scholar, deepxiv, or web
- **Verification**: the tag from Step 2

Favor concrete numbers, assumptions, and problem definitions over generic paraphrase.

## Step 4: Synthesize

- Group papers by technical approach, not by search order.
- Separate foundational from recent, formal from preprint, and what the user already had from what is new.
- Name where the field agrees and where it disagrees.
- Name the gaps the user's work could fill. If evidence is weak, say so.

## Step 5: Output

```text
| Paper | Venue | Year | Method | Key Result | Limitation | Relevance | Source | Verified |
|-------|-------|------|--------|------------|------------|-----------|--------|----------|
```

For communications topics add `Layer` and `Scenario` columns after `Year`.

After the table, write 3 to 5 paragraphs in this order:

1. What the field is mostly trying to solve
2. How the papers cluster into 2 to 4 approaches
3. What the user already had versus what was newly surfaced
4. Where the evidence is strong and where it is weak
5. What research gap remains

End with a short "Practical takeaway": the dominant current approach, the direction that looks saturated, and the promising open direction.

## Step 6: Save (only when asked)

- Save PDFs to PAPER_LIBRARY.
- Write the table and narrative to a file the user names.

## Rules

- Cite every paper with authors, year, and venue.
- Prefer the user's own sources first, but do not let them replace external validation.
- If the topic spans several layers, say that the literature itself is split across layers.

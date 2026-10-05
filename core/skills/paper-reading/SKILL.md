---
name: paper-reading
description: Paper reading in three stages (triage, map, deep dive) that produce study documents. Use when the user hands over a paper (PDF, arXiv link) to understand, asks for one of these stages, or asks about any part of a paper being read.
---

<paper-reading>
Reading a paper runs in three stages, each producing its own document. Run triage by default. Run map or deep dive when the user asks for it. A question about the paper runs the explain branch at any point.

## Source discipline

Applies to every stage and to the explain branch.

- Ground each claim in the paper and cite its location: section, page, figure, table, equation, or algorithm line.
- Label each statement that does not come from the paper by kind: interpretation, outside knowledge (name the source), or worked example (own calculation). In HTML, place it in a `<blockquote>` that opens with its label.
- When the paper gives no rationale for a choice such as a constant or a setting, state that it gives none; a guessed rationale carries the interpretation label.
- Declare what the PDF lacks: appendices or supplementary material the text refers to, and every point that could not be verified.
- Report each internal inconsistency of the paper (text vs. caption, abstract vs. results, section vs. section) with both locations.

## Stage 1: triage

Decides whether the paper deserves deeper reading. Length: A4 1–3 pages.

1. One-line summary.
2. Problem and motivation: what was broken or missing before this paper.
3. What the paper proposes: the key idea, with at most one key equation.
4. Main results, with the paper's own numbers.
5. Contribution versus prior work: a table with one row per aspect and the columns "prior" and "this paper".
6. Significance and links to related work.
7. Limitations.

Completion: all seven parts present, and every number traced to a location in the paper.

## Stage 2: map

A faithful map of the paper, section by section.

1. Header: authors, venue and year, and the version and page count the map is based on.
2. Table of contents with anchors.
3. One heading per section and subsection of the PDF, with the original numbering, the original-language title, and the original order, from Abstract through the appendices present in the PDF. References reduce to the entries needed to understand the paper.
4. Under each heading, what that section says, in the paper's terms.
5. Key equations and algorithms transcribed as text in code blocks.
6. Key figures cropped from the PDF into image files, viewed after cropping to confirm nothing is cut off, and captioned with the original figure number.
7. Large result tables reduced to excerpts that keep the rows behind the paper's claims, with the original table number.

Completion: every section and subsection of the PDF has a matching heading, and every figure and table used carries its original number.

## Stage 3: deep dive

The knowledge needed to judge the paper independently: why each design choice was made and how far each claim holds. No length limit.

1. Map of the paper's argument (problem, causes, proposals, evidence) as a diagram.
2. Lineage: each prior work the paper builds on, what it solved, and what it left open.
3. Background concepts the method assumes.
4. Dissection of each proposed component: mechanism, every constant with its rationale, and a worked example.
5. Comparison tables against the alternatives the paper replaces.
6. How to read the main results: what each column means, the patterns, and what the numbers show and do not show.
7. Limitations and open issues: assumptions, missing experiments, threats to validity, gaps between claims and evidence.
8. Influence after publication.
9. Glossary.
10. Self-check questions, each answer inside `<details>`.

Completion: all ten parts present, every component the paper proposes has a dissection, and every constant in the method is listed with its rationale or with the note that the paper gives none.

## Explain branch

- Location question ("where is this in the paper"): quote the original passage with its location, and mark where an earlier explanation simplified or reinterpreted it.
- Figure question: what the axes, panels, and line styles encode, then the two or three readings that matter, then caveats.
- Passage question: translate it piece by piece, then restate the idea.

Level: start at the user's level shown in the conversation. When the user does not follow, step down one notch, in this order: define every symbol first; split the passage into pieces and translate each; walk through it with concrete numbers; give an analogy and map each part of it back to the paper's term. Keep the paper's own term next to each plain one.

## Output

- Before writing the first document, invoke the `core:html` skill and follow it. Diagrams are inline SVG.
- Place files by the project's existing convention for notes; with no convention, next to the paper. This overrides the html skill's output location. Images go to `images/<paper-slug>/` beside the documents.
- Name each file after the paper's short title, suffixed with the stage name in the user's language.
- Before finishing, check tag balance and that every image path resolves, and declare whether the document was opened in a browser.

Paper or request:

$ARGUMENTS
</paper-reading>

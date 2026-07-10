---
name: writing-great-agents-md
description: Reference for writing and editing context files (CLAUDE.md, AGENTS.md) — what earns a place in an always-loaded file. Pass file paths to review them against it.
disable-model-invocation: true
argument-hint: "[file paths]"
---

A context file — `CLAUDE.md`, `AGENTS.md` — is loaded into every session: permanent **context load**, every line spending tokens and attention on every turn whether the turn needs it or not. The principles of skill writing apply here in their harshest form, because nothing in this file loads on demand.

**Bold terms** are defined in [`GLOSSARY.md`](GLOSSARY.md); look them up there for the full meaning.

## Two layers of rules

Every rule is one of two kinds, and the kind decides how it is written:

- A _guardrail_ is a structural constraint — who hands what to whom, output shape, module boundaries, verifiable artifacts. It holds regardless of model capability, so state it hard and concrete.
- _Guidance_ is a behavioural constraint — how the agent reasons, judges, interprets. Model capability erodes its usefulness, so keep it to a minimal recommendation and let it go cheaply.

A behavioural prescription often has a structural form waiting: **negation** ("don't do X") names X into the frame, while the positive target ("do Y") or transparency enforcement ("if X was done, declare it") steers without speaking the banned thing. When the recast exists, take it.

## What earns the body

Only what applies to every session belongs in an always-loaded file. A procedure used in one kind of situation belongs in a skill, which costs nothing until invoked. Within the file, **co-location** holds: one topic's rules under one heading, so reading one brings its neighbours.

## Steering

An instruction is judgeable when the agent can tell followed from not-followed; vague bounds ("appropriately", "as much as possible") become verifiable conditions or leave. One term per concept — a second name for the same thing splits recall. Prose stays in plain register: colloquial verbs from conversation stay in conversation, and bold marks glossary terms, not emphasis.

## Pruning

Run the **no-op** test on every line: would the agent behave differently if it were deleted? The usual casualties are instructions to do what happens by default anyway, and mentions of things the agent could never act on unaided ("no need to know this in advance"). Check **relevance**: a line about a file, skill, or rule that no longer exists is **sediment** — delete it. Keep each meaning in a **single source of truth**, one authoritative place, so a change is a one-place edit.

---

When file paths follow, review each against every section above — the whole file, every principle — and fix violations.

Task: $ARGUMENTS

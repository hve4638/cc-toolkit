---
name: demo-first
description: "Demo-driven work discipline: build large coding work as runnable demos under demo/."
disable-model-invocation: true
---

# demo-first

Build large coding work as demos under `demo/` that the user runs to follow the work's context.

## Two phases

- Phase 1 — present the demo candidates as a list: the question each resolves and what running it will show. The list is this phase's only output.
- Phase 2 — build, starting after the user approves the list. When they adjust it, revise and re-present before building.

## Demo decomposition

- Define each demo as one uncertainty to resolve — the question a person building by hand would check next (does the TUI launch at all, does a message from A reach B over the real transport, does the parsed record land in the database) — not as a unit of code structure.
- Derive the order from how a person would build and check by hand: it runs at all → components connect → data flows through → real data replaces dummy → it looks right → the whole works together. Reorder per project; independent demos may proceed in parallel, and when demos build on each other's outputs, state the dependency order.
- Cut a demo as a vertical slice when its question spans components.

## Demo artifacts

- Each demo lives in its own folder under `demo/<name>/`, self-contained and runnable with a single command (e.g. `./run.sh`); the folder itself is the demonstration.
- The demo's core is real — the seed of the product code: the code that answers its question (the transport library, the protocol wiring, the parsing) is written as the product will use it. Stubs and dummies stay at the periphery (payload contents, UI, a receiver that only prints).
- Record in each demo's README: the command that runs it, what to observe, what is stubbed, and the commit hash at which it last ran successfully.
- Keep demos working as the code evolves.

## Verdicts

- A demo may gate a technology or approach decision. When the demo shows the candidate unfit, record the verdict and reason in its README and stop — an unfit verdict is a valid completion. A pass obtained through a workaround is declared as such in the README.

## Boundary

- A passing demo is evidence for the paths it exercises, nothing more.
- A demo folder may carry its own tests as part of being self-verifying; project-wide unit testing, CI, and coverage policy stay their own layer.
- Pacing belongs to the user: present each demo as it becomes runnable and keep going; the user decides when to stop and observe.

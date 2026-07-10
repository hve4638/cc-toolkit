---
name: showcase
description: "Checkpoint-driven work discipline: plan large coding work as the sequence of checkpoints a person building it by hand would verify by eye, and attach an observable demo to each. Use when the user says 'showcase', asks to build a large feature with a demo at each step, or wants to verify progress by watching artifacts run."
---

# showcase

Plan large coding work as a sequence of checkpoints the user can verify by observation.

## Checkpoint decomposition

- Define each checkpoint as one question the user would want answered by eye at that point (does the TUI launch, do device and server connect, does mock data flow end to end), not as a unit of code structure.
- Derive the sequence from how a person would build and check by hand: it runs at all → the components connect → mock data flows through → real data replaces the mock → it looks right → the whole works together. Reorder and interleave per project; keep each checkpoint answering the question the user would ask next.
- Cut a checkpoint as a vertical slice when its question spans components. Checkpoints need not align with module boundaries, and the implementation structure need not mirror the checkpoint order.
- Isolate one question per checkpoint with mocks and stubs. When a demo relies on a mock, state what is mocked and which later checkpoint replaces it with the real thing. A later checkpoint may reintroduce a mock to isolate its own question even after the real thing is wired.
- When a checkpoint cannot be made observable, declare it before proceeding: either it answers nothing the user would check (drop it) or it bundles several questions (split it).

## Checkpoint loop

### Step 1 — Present the sequence

Before implementing, present the checkpoint list: the question each one answers and what its demo will show.

### Step 2 — Implement toward one checkpoint

Build what the current checkpoint needs to become observable; keep later concerns behind mocks.

### Step 3 — Attach a demo

Produce something the user can observe: a runnable demo script, e2e output, or a visual rendering. For checkpoints without UI, show input to output with a demo script or log.

### Step 4 — Present for observation

When declaring a checkpoint reached, state the demo artifact path, the command that runs it, what to observe, and what is still mocked.

### Step 5 — Pause or continue

Stop after presenting the demo so the user observes before the next checkpoint begins. When the user orders continuous progress, do not stop; still produce and keep every demo as an artifact.

## Demo artifacts

- Keep demos working as the code evolves.
- Record in each demo artifact the command that runs it and the commit hash at which it last ran successfully (e.g., note the hash when committing the demo or e2e test).
- Choose artifact location and format per project; only the recorded information above is mandatory.

## Boundary

- Present a passing demo as evidence for the paths it exercises, nothing more; defects can remain on paths it does not touch.
- Leave unit tests, CI, and coverage policy to their own layer.
- Pacing belongs to the user; showcase is not an approval gate.

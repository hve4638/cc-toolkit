---
name: showcase
description: "Work discipline that splits large coding work into modules sized for the user to understand at once and attaches an observable demo (runnable script, e2e log, or visual artifact) to each, so trust builds by observation. Use when the user says 'showcase', asks to build a large feature module by module with demos, or wants to verify progress by watching artifacts run."
---

# showcase

Split large coding work into modules the user can understand and verify one at a time, and make each module's behavior directly observable.

## Module decomposition

- Size each module by what the user can understand and verify in one sitting, not by code structure.
- Design every module to be demoable and testable independently at its boundary.
- When a module cannot be demoed independently, declare it before proceeding: either the code carries unnecessary coupling or the boundary is cut wrong. Name which one and propose the fix.

## Module loop

### Step 1 — Present the breakdown

Before implementing, present the module list: each module's scope and what its demo will show.

### Step 2 — Implement one module

Build the module, keeping it independently runnable at its boundary.

### Step 3 — Attach a demo

Produce something the user can observe: a runnable demo script, e2e output, or a visual rendering. For modules without UI, show input to output with a demo script or e2e log.

### Step 4 — Present for observation

When declaring a module complete, state the demo artifact path, the command that runs it, and what to observe.

### Step 5 — Pause or continue

Stop after presenting the demo so the user observes before the next module begins. When the user orders continuous progress, do not stop; still produce and keep every demo as an artifact.

## Demo artifacts

- Keep demos working as the code evolves; a demo is a maintained artifact, not a throwaway proof.
- Record in each demo artifact the command that runs it and the commit hash at which it last ran successfully (e.g., note the hash when committing the demo or e2e test).
- Choose artifact location and format per project; only the recorded information above is mandatory.

## Boundary

- A passing demo does not certify correctness; defects can remain on paths the demo does not touch. Do not present a demo as proof of absence of bugs.
- Unit tests, CI, and coverage policy are a separate layer. Do not impose coverage levels through showcase.
- Pacing belongs to the user; showcase is not an approval gate.

---
name: cleanharness
description: "Prune the work-steering harness — CLAUDE.md rules, skills, hooks, agent definitions — through per-item discussion with the user."
disable-model-invocation: true
argument-hint: "[optional: targets — skills, CLAUDE.md sections, hooks, agent definitions]"
---

<cleanharness_instruction>
# cleanharness

The harness is everything that steers the agent's work: CLAUDE.md/AGENTS.md rules, skills, hooks, agent definitions. cleanharness examines the harness together with the user and retires what no longer earns its load.

Every change follows a per-item user decision; an item without one stays untouched.

## Step 1. Targets

Work on the targets the user named. Given none, inventory the harness in scope — CLAUDE.md/AGENTS.md (project and global), skills, hooks, agent definitions — and present suspect candidates, each with a one-line reason; settle the target list with the user.

## Step 2. Investigation

Examine every target through all three lenses and record findings per target.

### Lens 1 — classification

- Planning harness — problem definitions, judgment criteria with their reasons, decision records: information the model cannot derive on its own. Preserved by default.
- Execution harness — control over how the model works: step ordering, format enforcement, behavioral rules, verification loops. The main cleaning pool.
- Other — reference documents, manuals, and the rest: judge by whether anything still reaches them.

### Lens 2 — bloat and conflicts

A project-history phenomenon, independent of model progress. Check each target against its neighbors in the same harness: rules that duplicate one another, rules that contradict each other, sediment grown past what anyone reads.

### Lens 3 — datedness

Ask of each execution-harness rule: does the model weakness it compensated for still exist — would the current model behave correctly with the rule gone? Era examples: external verification loops, RAG chunking, forced format scaffolds, prompt chains that pre-chew steps. The example list itself ages; judge by the question and treat the examples as snapshots of one era.

## Step 3. Discussion

Present findings item by item — evidence first, then a recommendation with its reason — and discuss until the user has decided each item's outcome:

- remove
- trim
- convert — an execution rule that exists to carry planning information is rewritten as context (criteria, a why-document) instead of behavior control
- keep

## Step 4. Apply

Apply exactly the decided outcomes and report per item: the decision and the change made.
</cleanharness_instruction>

$ARGUMENTS

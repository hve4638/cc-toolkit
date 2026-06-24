---
name: vision
description: Capture an abstract idea into a VISION.md anchor by interview; amend it only on a real change of direction
disable-model-invocation: true
argument-hint: "[what you want to build]"
---

<vision_instruction>
# vision

VISION.md records the intent a project began with: what it is, why it exists, and what it deliberately won't become. It works as an anchor. When a later proposal drifts from that direction, or grows past what the project is for, you hold the proposal against this document. Implementation state, rules, and plans live elsewhere (PLAN, specs, the code); VISION carries only the why, the what, and the what-not.

This skill writes that file, or amends it, through a short interview. It does not check current work against an existing vision; that reading happens in ordinary work, when a person consults the anchor.

## No VISION.md yet

Start from the user's rough "I want to build something like…" and draw the anchor out by interview.

- Ask one question at a time with `AskUserQuestion`. Stay at the level of direction; don't interrogate implementation or tech choices, which belong to a plan or spec.
- Spend most of the questions on the non-goals and the premises underneath. Those carry the anchor's weight later; the what and the why are usually the easy part.
- Stop when the shape is clear, not when every detail is settled. A vision may leave things open.

Then write `VISION.md` at the project root using the skeleton below.

## VISION.md already exists

It is frozen by default. The user comes back here only after hitting something that contradicts the vision and judging that the direction itself should change, not when an implementation detail moves.

- Confirm it is a genuine change of direction before editing the file.
- Interview only around the part that is changing, and re-anchor that part alone. Leave the rest as written.

## Skeleton

The structure is the constraint; section titles follow the project's own wording.

- An opening paragraph stating what the document is: the starting intent, frozen, not updated as the build evolves, kept as the anchor for judging drift and overkill.
- What it is: one paragraph defining the thing.
- Why / Goals: what it reaches for.
- Non-goals: what it won't do, on purpose. Required; this section carries the load.
- Premises (optional): the assumptions and principles underneath.
- Scenarios: a few concrete things it does.
- Open (optional): neither goal nor non-goal; settled later when the need is clear.

Write the file in the project's language. Keep the prose plain: no decorative bold, no em-dash asides, no rule of three.
</vision_instruction>

$ARGUMENTS

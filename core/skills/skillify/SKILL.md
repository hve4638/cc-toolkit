---
name: skillify
disable-model-invocation: true
argument-hint: "[optional: short description or slug of the skill to create]"
---

<skillify_instruction>
# skillify

Procedure for authoring a new skill following the [writing-great-skill](../writing-great-skill/SKILL.md) principles.

The principles themselves (description, information hierarchy, pruning, local conventions) live in [writing-great-skill](../writing-great-skill/SKILL.md). This skill holds only the *authoring procedure*.

---

## Input modes

- Argument or prior session context is sufficient → skip the interview, start from Step 2
- Insufficient → Step 1 interview

---

## Step 1. Interview (if needed)

Ask all 5 questions in a single bundle (no split):

1. What does this skill do (one sentence)?
2. When should it be invoked — trigger context?
3. Which failure, inefficiency, or confusion does it prevent (WHY)?
4. Storage location — project-local / global / plugin?
5. Is there an existing skill in a similar trigger category?

---

## Step 2. Name / slug decision

Agree with the user. The name is lowercase English and is the skill's **leading word** — the token the user types, the token the description front-loads, and the token the body repeats to anchor behaviour are all this one word.

- Reach for a word the model already holds, so the name recruits that prior — `stage`, `interview`, `handoff`, `prototype`
- Where no single word fits, coin a compound that still reads as one concept — `bughunt`, `memhome`, `pairtdd`

What makes a leading word strong, and how to hunt for one: the Leading words section of [writing-great-skill](../writing-great-skill/SKILL.md).

---

## Step 3. Write SKILL.ko.md

Apply every section of [writing-great-skill](../writing-great-skill/SKILL.md) and save the Korean draft to `<location>/<slug>/SKILL.ko.md`.

Invocation mode is decided here: default to user-invoked, and take model-invocation only where the Invocation section of [writing-great-skill](../writing-great-skill/SKILL.md) calls for it.

Where the procedure is deterministic — file operations, settings, checkable state transitions — build it as step scripts by [skillify-stepform](../skillify-stepform/SKILL.md) instead of body prose.

---

## Step 4. Review

Show the body to the user for confirmation. If changes are requested, update only SKILL.ko.md (the English version is not yet created).

---

## Step 5. English translation

Once confirmed, fill `SKILL.md` with a bulk English translation.

- The description is written in precise English for matching reliability.
- The body preserves the Korean meaning verbatim (no compression, no rewording).

---

## Step 6. Report

Report the slug, location, and a one-line description summary to the user.

---

## Empty case

If a skill in the same trigger category already exists, recommend adding rules to the existing skill rather than creating a new one (confirmed in Step 1 question 5).

---

## Invocation routing

- If the user wants *retrospection / crystallization of past mistakes*, route to reflect (not this skill).
- Otherwise, handle new skill creation in this skill.

</skillify_instruction>

$ARGUMENTS

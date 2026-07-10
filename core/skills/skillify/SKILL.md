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

Ask all 6 questions in a single bundle (no split):

1. What does this skill do (one sentence)?
2. When should it be invoked — trigger context?
3. Invocation mode — explicit-only / auto-trigger / both?
4. Which failure, inefficiency, or confusion does it prevent (WHY)?
5. Storage location — project-local / global / plugin / common (`common/skills/`)?
6. Is there an existing skill in a similar trigger category?

---

## Step 2. Name / slug decision

Agree with the user.

- kebab-case, ≤30 characters, English
- If a family exists, use a prefix (`reflect-*`, `rule-*`)
- Good: `git-rebase-no-edit-flag`, `codex-mcp-guide`
- Bad: `general-tips`, `mistakes`, `learning-20260430`

---

## Step 3. Write SKILL.ko.md

Apply every section of [writing-great-skill](../writing-great-skill/SKILL.md) and save the Korean draft to `<location>/<slug>/SKILL.ko.md`.

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

If a skill in the same trigger category already exists, recommend adding rules to the existing skill rather than creating a new one (confirmed in Step 1 question 6).

---

## Heavy case

Recommend invoking the plugin `skill-creator` if the skill matches:

- Multiple outputs + variability (output form changes substantially with input)
- Evaluation automation needed (eval/benchmark)
- Deeply coupled with external tools or environments

---

## Invocation routing

- If the user wants *retrospection / crystallization of past mistakes*, route to reflect (not this skill).
- If the user wants *a heavy workflow with eval/benchmark*, route to the plugin `skill-creator`.
- Otherwise, handle new skill creation in this skill.

</skillify_instruction>

$ARGUMENTS

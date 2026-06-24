---
name: skillify-guide
description: "Defines skill authoring and review conventions — frontmatter modes (auto-trigger, disable-model-invocation), description rules, body discipline. Use when writing a new SKILL.md / SKILL.ko.md or reviewing/refactoring an existing skill."
---

<skillify_guide_instruction>
# skillify-guide

Third person and the imperative throughout, in both the description and the body. No 1st/2nd person (`I`/`you`/`your`): in the description this is critical for matching reliability; in the body it keeps instructions impersonal for whatever model runs the skill.

## Frontmatter

Required: `name`, `description` (authoring rules in §Description). `description` ≤ 1024 chars, no XML tags.

Optional:
- `disable-model-invocation: true` — manual invocation only (`/<slug>`). Without it, the skill auto-triggers via description matching.
- `argument-hint: "[description]"` — when the skill takes an argument.

---

## Description

Follows the [Anthropic official guide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices).

1. `Length` — ≤ 1024 chars (frontmatter validation limit). Official examples average ~22 words / ~145 chars. Shorter is better.
2. `What + When structure` — two parts: *what the skill does* and *when to use it*. Official pattern: `"Generate X by Y. Use when ..."`.
3. `Include key terms` — name trigger-relevant tools, file extensions, commands, domain terms *concretely*. Do not abstract them away.
4. `Specificity` — both under- and over-trigger fail. Ambiguous trigger context degrades matching reliability.

### Strong prohibitions

- Vague descriptions ("helps with stuff", "processes things", "Helps with documents")
- Behavioral rules embedded in description (those belong in the body)
- Time-sensitive information ("after August 2025 ...")

### description vs body division

- description = discovery entry point (what + when)
- body = behavior after invocation

Do not include rules in the description.

### Examples

❌ 1st/2nd person (discovery fails):

```
"I can help you process Excel files and create pivot tables."
```

❌ Vague (weak trigger):

```
"Helps with documents."
```

❌ Rules embedded (body becomes meaningless):

```
"Use this skill when writing git rebase commands. The --no-edit flag is invalid — omit it."
```

⭕ what + when (official pattern):

```
"Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes."
```

---

## Body

### Instructions only

The body holds only *instructions* and *the targets of those instructions* (outputs, inputs, objects acted on). Do not include the following in the body:

- Meta about the skill itself (audience, prerequisites, importance)
- Rationale appended after a `—` on a bullet
- Adjacent-tool comparison tables
- Noun-phrase items without an imperative verb

Types:

- Guardrail type (behavior rules): `## Rule` + optional `## Not a violation`
- Workflow type (multi-step procedure): `### Step 1...N`
- Meta type (skill of skills, e.g. reflect): combination of workflow + principles + boundaries
- Reference type (knowledge storage): `## Category` / `## Items` — facts over rules

Add if needed:
- `## Reason` — tradeoffs or environmental premise
- `## Boundary` — distinction from adjacent skills (to avoid confusion)

### Separate deterministic from judgment

The body holds only *judgment-required parts*. *Deterministic* steps (computation, fixed transformation, set procedure) are separated:

- Code skills → extract into `scripts/<name>.{sh,mjs,py}` and have the body invoke them
- Manual / document skills → extract into a fixed template like `assets/<name>.md` and have the body reference it

### Length / splitting

- Keep SKILL.md body **under 500 lines** (Anthropic token-budget recommendation).
- When exceeding or when categories cleanly separate, extract into separate files; SKILL.md acts as the entry point (progressive disclosure).
- Reference chain stays **one level deep** from SKILL.md. Going deeper makes Claude do partial reads only.
- Reference files over 100 lines should include a table of contents at the top.

### Body discipline

- Do not use `**bold**` on the leading word of a bullet.
- Use bold sparingly, only on critical rules that change behavior.
- When a behavioral prescription ("do not do X") can be reframed as a structural guardrail ("if X is done, declare it"), prefer the guardrail form.
- Use forward slashes (`/`) only for file paths. Backslashes (`\`) are forbidden.
- Use one consistent term per concept (use `field` and don't mix in `box`/`element`).

</skillify_guide_instruction>

$ARGUMENTS

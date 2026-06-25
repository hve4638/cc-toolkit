---
name: meta
description: Generate a new prompt from a task description, or improve an existing prompt. Use when the user wants a prompt authored, refined, or optimized, such as 'write a prompt for ...', 'improve this prompt', 'meta prompt', or '프롬프트 만들어줘'.
argument-hint: "[task description | existing prompt to improve]"
---

<meta_instruction>
# meta

Turn the provided argument into a finished prompt. Print the result to chat only; write no files.

## Mode

Decide the mode from the argument:
- An existing prompt to refine indicates improve mode.
- A task or goal description indicates generate mode.

When it is unclear which, state the assumption before proceeding.

## Clarify first

Before producing anything, confirm the essentials are known: the task or goal, the intended audience or model, the required output format, and any hard constraints.

When an essential is missing or ambiguous, ask one or two targeted questions before producing. When producing despite an unanswered essential, state each assumption made.

## Generate

Build a vendor-neutral prompt. Include only the parts that earn their place:

1. Role line, when an expert persona sharpens the task.
2. Context and inputs, with `[bracketed placeholders]` for variables.
3. Task instructions in specific, unambiguous language, free of bland filler.
4. Reasoning ordered before results: reasoning steps first, conclusion last. When an example shows the conclusion first, reverse it.
5. Output format stated explicitly, covering structure, length, and syntax.
6. Examples, optional, reusing the same placeholders.

Avoid vendor-specific scaffolding such as XML tags or handlebars variables unless the user asks for it.

## Improve

Preserve the original intent and any extensive guidelines or examples the argument already carries. Keep changes minimal when the prompt is already simple; for a complex prompt, sharpen clarity and fill gaps without rewriting its structure. Apply the generate skeleton and reasoning order where they strengthen it.

## Output

- The finished prompt in one fenced block, ready to copy.
- A short note stating the mode used and any questions left open.
- For improve mode, a brief list of what changed and why.
</meta_instruction>

Task: $ARGUMENTS

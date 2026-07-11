---
name: man
description: "Read a skill's MAN.md, explain it, and answer questions. Called without an argument, index the documented skills"
disable-model-invocation: true
argument-hint: "[skill name | empty for the index]"
---

<man_instruction>
# man

Read the named skill's `MAN.md`, explain the skill's purpose and behaviour to the user, and answer follow-up questions. Do not execute the target skill.

---

## Resolution

- Look for `*/skills/<skill-name>/MAN.md` in the working repo first.
- If absent from the repo, look in the plugin cache: `skills/<skill-name>/MAN.md` under each plugin's `installPath` recorded in `~/.claude/plugins/installed_plugins.json`. Cache version folders outside those paths are stale history — do not match them.
- If the user wrote the `plugin:skill` form, match the plugin segment as well.
- If 2+ distinct skills match → present the list and ask the user to choose.
- If `MAN.md` is absent but the skill folder exists → first tell the user that this skill has no `MAN.md`, then note it can be generated with `/mkman <skill-name>`. If the user wants, explain on the spot from `SKILL.md`.
- If the skill itself does not exist → report that and stop.

## Index mode (no argument)

Collect the working repo's `*/skills/*/MAN.md` plus `skills/*/MAN.md` under each `installPath` in `installed_plugins.json`, and print a table of `skill name (plugin) — description`. If the same `plugin:skill` appears in both the repo and the cache, keep only the repo row (same as the resolution order). Read only the frontmatter description; for a `MAN.md` without one, substitute the first sentence of the body.

## Explain mode

Read `MAN.md` and explain summary-first: purpose → invocation → behaviour → caveats. Answer subsequent questions from `MAN.md`; for anything the document does not cover, check `SKILL.md` before answering.
</man_instruction>

$ARGUMENTS

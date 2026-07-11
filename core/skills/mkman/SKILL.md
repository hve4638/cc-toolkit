---
name: mkman
description: "Analyze a target skill and generate a MAN.md (user-facing manual) in its folder"
disable-model-invocation: true
argument-hint: "[skill name (e.g. stage, core:stage)]"
---

<mkman_instruction>
# mkman

Analyze the skill the user named and generate a user-facing manual `MAN.md` inside that skill's folder.

---

## 1. Resolve the target folder

- Look in the working repo's `*/skills/<skill-name>/` first.
- If absent from the repo, look in the plugin cache: `skills/<skill-name>/` under each plugin's `installPath` recorded in `~/.claude/plugins/installed_plugins.json`. Cache version folders outside those paths are stale history — do not match them.
- If the user wrote the `plugin:skill` form, match the plugin segment as well.
- 0 matches → report that the target does not exist and stop. 2+ distinct skills → present the list and ask the user to choose.
- If the target is a cache folder, state in the report that the generated file will disappear on plugin update.

## 2. Analyze

Read the target folder's `SKILL.md` plus the reference files and `scripts/` it links, and establish: purpose, invocation (arguments, modes), execution procedure, outputs, caveats.

Where the behaviour stays unclear from what was read, mark it "unverified" instead of describing it by guesswork.

## 3. Write MAN.md

The frontmatter requires `description` (one line for the index). Write the body in English, as manual prose for a human reader — not in the register of instructions to an executing model.

Section skeleton (omit sections that do not apply):

- Purpose — the problem this skill solves
- Invocation — arguments and modes
- Behaviour — what happens when it runs
- Outputs — generated files, report format
- Caveats — side effects, premises, limits

If a `MAN.md` already exists, confirm with the user before overwriting.

## 4. Report

Report the generated path and the one-line description.
</mkman_instruction>

$ARGUMENTS

---
name: skillify-stepform
description: Design rules for putting a deterministic procedure in scripts and making each step a form. Pass a path to review that skill against them.
disable-model-invocation: true
---

<skillify_stepform>
# skillify-stepform

Rules for building a skill where one step is one form. The procedure lives in the scripts rather than in SKILL prose, and the agent fills a form in and submits it.

Reach for this design when the procedure is deterministic — creating and moving files, writing settings, walking checkable state transitions. Where the output is prose and judgement is the substance, leave it in prose.

## Form and submission

A step moves only once `--answer` carries a complete answer. A call with no argument, and a call missing a key, change nothing and report the current state and what to do next.

Until the answer is complete, calling the same step any number of times stays a pure read, so a half-applied state has nowhere to form.

Where a key is missing, name what is empty in `<error>` and carry the `<question>` that fills it.

## One step, one action

A complete submission performs exactly one action and hands over the next form. Once the action is done, declare in `<info>` what was deleted, moved, and created.

## Role boundary

Creating, moving, deleting, and copying files belong to the script. The agent reads, asks, and edits content.

## The output is the instruction

Each output holds the current state, what to ask the user, and the exact command that comes next.

The SKILL body holds the instruction to run the first script and the meaning of the tags. How many steps there are and what the argument grammar is are told by the output at run time.

## Tags

Wrap each top-level block of the output in a tag, and write markdown inside it.

- `<status>` — the facts as they stand
- `<question>` — what to ask the user
- `<alert>` — a warning to relay to the user
- `<error>` — the script's mechanical verdict
- `<info>` — what was carried out
- `<next>` — the command to run next

## Questions

Present each option together with the JSON value it produces.

Where only one option exists, print the value that fills it.

Gate failures come out in one batch.

## Message files

Output prose lives in md files under `messages/`, and the script picks a file per variant. The script carries the branching and the md carries the prose.

`{KEY}` substitution is strict in both directions. A placeholder left in the md with no value supplied, and a supplied value the md never uses, both fail. A failure carries a `file:line` hint, instructs that an internal error be reported to the user, and exits non-zero.

## Extension points

One folder is one option. The script reads the listing and the one-line summary and knows nothing of the contents; adding a folder adds an option.

Options that differ per choice arrive as keys of the answer.

---

When a path follows, review that skill against every section above and fix what departs from them.
</skillify_stepform>

$ARGUMENTS

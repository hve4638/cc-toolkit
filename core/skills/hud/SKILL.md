---
name: hud
description: Install or remove the statusline
argument-hint: "[setup|uninstall]"
disable-model-invocation: true
---

<hud_instruction>
# hud

## Routing

Branch on the first word of the argument the user gave:

- `setup`, or nothing given → **Setup**
- `uninstall`, `remove` → **Uninstall**
- anything else → name the two commands and stop

## Setup

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-install.mjs"
```

When the script reports replacing an existing `statusLine`, pass that on.

Then ask which producers to turn on, with AskUserQuestion and multi-select:

- `hud` — directory, git branch, quota, context, model on one line
- `advertise` — a rotating one-line skill ad from plugins that offer one

Turn the picks on, one entry each:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-enable.mjs" feat:hud feat:advertise
```

Korean ad text is `feat:advertise@lang=ko`.

Tell the user to restart Claude Code.

## Uninstall

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-uninstall.mjs"
```

Tell the user to restart Claude Code. The plugin itself stays; removing it is `/plugin uninstall core@hve`.
</hud_instruction>

$ARGUMENTS

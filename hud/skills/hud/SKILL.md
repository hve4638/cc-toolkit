---
name: hud
description: Install or uninstall the HUD statusline
argument-hint: "[setup|uninstall]"
role: config-writer
scope: ~/.claude/**
---

# HUD

Manages the HUD statusline installation.

Arguments received: `$ARGUMENTS`

## Routing

Look at the first word of `$ARGUMENTS` (trimmed) and branch:

- `setup` / empty / nothing provided → run the **Setup** section
- `uninstall` / `remove` → run the **Uninstall** section
- any other value → show the table of commands under **Usage** and stop

## Setup

Execute the installer:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"
```

Then tell the user to restart Claude Code.

## Uninstall

Remove the wrapper and clear HUD-related keys from `settings.json`.

**Warning the user**: this also deletes any custom `hveHud` configuration (element toggles, thresholds). It does NOT uninstall the plugin itself — for that, use `/plugin uninstall hud@hve`.

Execute:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/uninstall.mjs"
```

Then tell the user to restart Claude Code.

## Usage

| Command | Action |
|---|---|
| `/hve:hud` or `/hve:hud setup` | Install wrapper and configure statusLine |
| `/hve:hud uninstall` | Remove wrapper, `statusLine`, and `hveHud` keys |

## Output (after setup + restart)

```
📁 cc-plugin | 🌿 main | ⏳ 5h:10%(4d12h) wk:40%(2d12h) | 📦 context:24% | 💻 Opus 4.7 (1M context)
```

## Configuration

Settings live in `~/.claude/settings.json` under `hveHud`:

```json
{
  "hveHud": {
    "elements": {
      "cwd": true, "gitBranch": true, "rateLimits": true,
      "contextBar": true, "model": true
    },
    "thresholds": { "contextWarning": 70, "contextCritical": 85 }
  }
}
```

Set any element to `false` to hide it.

## Troubleshooting

1. **Not showing** — Re-run `/hve:hud setup` and restart Claude Code.
2. **Stale output** — Run `/hve:hud uninstall` then `/hve:hud setup`.

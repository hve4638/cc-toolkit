---
name: core-setup
description: Install core runtime deps (@ast-grep/napi global, Codex CLI) and register Codex MCP server (user scope)
disable-model-invocation: true
---

# core setup

Run all steps in order. Report each step's result to the user.

## Step 1 — ast-grep native dep & agent teams flag

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/install.mjs"
```

Installs `@ast-grep/napi` globally via npm so `ast_grep_search` / `ast_grep_replace` tools resolve at runtime. Idempotent. LSP tools need no install — they spawn whichever language server is on `PATH` (`gopls`, `typescript-language-server`, `pyright`, …).

Also sets `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json` to enable Claude Code agent teams. Other keys are preserved; idempotent.

## Step 2 — Codex CLI

```bash
codex --version
```

- Version printed → already installed, skip to Step 3.
- Not found → install:

```bash
npm install -g @openai/codex
```

Then re-run `codex --version` to confirm.

## Step 3 — Codex MCP server (user scope)

```bash
claude mcp add codex -s user -- codex mcp-server
```

If already registered, ask the user before overwriting.

## Step 4 — Restart Claude Code

Tell the user to restart so the MCP servers and runtime hooks load fresh.

## Result summary

```
[core-setup]
- ast-grep:    ✅ (installed | already present)
- Agent teams: ✅ (enabled | already on)
- Codex CLI:   ✅ (version)
- Codex MCP:   ✅ (user scope)
```

Report failures with the cause and a manual recovery command. Common: npm EACCES on global install → suggest `sudo npm install -g …` or a user-level npm prefix.

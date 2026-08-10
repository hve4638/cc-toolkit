#!/usr/bin/env node
/**
 * statusline installer.
 *
 * - Copies the wrapper to <claude config dir>/statusline.mjs
 * - Points `statusLine` in settings.json at it, preserving every other key
 * - Idempotent; safe to re-run
 *
 * The wrapper is the only thing installed outside the plugin. It resolves the
 * newest core at run time, so a core upgrade needs no reinstall.
 *
 * Respects $CLAUDE_CONFIG_DIR.
 */

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getClaudeConfigDir } from './lib/config-dir.mjs';

const template = join(dirname(fileURLToPath(import.meta.url)), 'lib', 'statusline-wrapper-template.txt');
const configDir = getClaudeConfigDir();
const wrapperPath = join(configDir, 'statusline.mjs');
const settingsPath = join(configDir, 'settings.json');

if (!existsSync(template)) {
  console.error(`[statusline] ERROR: missing wrapper template ${template}`);
  process.exit(1);
}

// 1. Place the wrapper
mkdirSync(configDir, { recursive: true });
copyFileSync(template, wrapperPath);
if (process.platform !== 'win32') {
  try { chmodSync(wrapperPath, 0o755); } catch { /* best-effort */ }
}
console.log(`[statusline] Wrapper installed: ${wrapperPath}`);

// 2. Register statusLine, preserving the rest of the file
let settings = {};
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    console.error(`[statusline] ERROR: ${settingsPath} is not valid JSON: ${err.message}`);
    process.exit(1);
  }
}

// Only one statusLine can be registered, so installing takes the slot from
// whatever held it — say whose, rather than swapping it out silently.
const previous = settings.statusLine?.command;
if (typeof previous === 'string' && !previous.includes('statusline.mjs')) {
  console.log(`[statusline] Replacing the current statusLine: ${previous}`);
}

settings.statusLine = {
  type: 'command',
  // Shell expansion keeps the command correct under a relocated config dir.
  command: process.platform === 'win32'
    ? `node ${wrapperPath.split(sep).join('/')}`
    : 'node ${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline.mjs',
};
writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`[statusline] statusLine configured: ${settingsPath}`);

console.log('');
console.log('[statusline] Installation complete. Restart Claude Code to activate.');

#!/usr/bin/env node
/**
 * statusline uninstaller.
 *
 * - Removes <claude config dir>/statusline.mjs
 * - Clears `statusLine` from settings.json when it points at that wrapper,
 *   preserving every other key
 * - Idempotent; safe to re-run
 *
 * Respects $CLAUDE_CONFIG_DIR. Leaves the plugin cache alone — that belongs to
 * Claude Code's `/plugin uninstall`.
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getClaudeConfigDir } from './lib/config-dir.mjs';

const configDir = getClaudeConfigDir();
const wrapperPath = join(configDir, 'statusline.mjs');
const settingsPath = join(configDir, 'settings.json');

// 1. Remove the wrapper
if (existsSync(wrapperPath)) {
  rmSync(wrapperPath, { force: true });
  console.log(`[statusline] Removed: ${wrapperPath}`);
} else {
  console.log(`[statusline] Nothing to remove at ${wrapperPath}`);
}

// 2. Clear statusLine, but only this one
if (!existsSync(settingsPath)) {
  console.log(`[statusline] No settings.json at ${settingsPath}`);
} else {
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch (err) {
    console.error(`[statusline] ERROR: ${settingsPath} is not valid JSON: ${err.message}`);
    console.error('[statusline]   Skipping settings.json cleanup. Fix the file and re-run if needed.');
    process.exit(1);
  }

  const command = settings.statusLine?.command;
  if (typeof command === 'string' && command.includes('statusline.mjs')) {
    delete settings.statusLine;
    writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    console.log(`[statusline] Cleaned: ${settingsPath}`);
  } else if (command === undefined) {
    console.log('[statusline] settings.json already clean');
  } else {
    // Another statusline (hud's, or the user's own) holds the slot; taking it
    // out here would remove something this installer never put there.
    console.log(`[statusline] statusLine belongs to something else, left as is: ${command}`);
  }
}

console.log('');
console.log('[statusline] Uninstall complete. Restart Claude Code to apply.');

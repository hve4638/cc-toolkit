#!/usr/bin/env node
/**
 * Turns statusline producers on, by appending their entries to the global
 * agentaddon file at ~/.config/agentaddon/statusline.
 *
 *   node statusline-enable.mjs feat:hud feat:advertise@lang=ko
 *
 * Only adds. An entry the file already leaves on is reported and skipped, and
 * an entry the user did not ask for is left where it is — this file is theirs,
 * and turning something off is a line they write (`!feat:advertise`).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { load } from './lib/addon-config.mjs';

const NAMESPACE = 'statusline';
const ENTRY_RE = /^[a-z0-9-]+:[a-z0-9-]+(?:@\S+)?$/;

const requested = process.argv.slice(2);
if (requested.length === 0) {
  console.error('[statusline] usage: statusline-enable.mjs <kind>:<name>[@args] ...');
  process.exit(1);
}

const malformed = requested.filter((entry) => !ENTRY_RE.test(entry));
if (malformed.length > 0) {
  console.error(`[statusline] ERROR: not an agentaddon entry: ${malformed.join(' ')}`);
  process.exit(1);
}

const path = join(homedir(), '.config', 'agentaddon', NAMESPACE);
const already = load(null, NAMESPACE);

const additions = [];
for (const entry of requested) {
  const name = entry.split('@')[0];
  if (already.has(name)) {
    console.log(`[statusline] Already on: ${name}`);
    continue;
  }
  additions.push(entry);
}

if (additions.length > 0) {
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : '';
  const body = existing && !existing.endsWith('\n') ? `${existing}\n` : existing;
  const next = `${body}${additions.join('\n')}\n`;

  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, next);
  renameSync(tmp, path);

  for (const entry of additions) console.log(`[statusline] Turned on: ${entry}`);
}

// The file is edited by hand as well, so anything already on that this run was
// not asked about is worth naming rather than silently leaving behind.
const unasked = [...already.keys()].filter((name) => !requested.some((e) => e.split('@')[0] === name));
for (const name of unasked) {
  console.log(`[statusline] Left on: ${name} — turn it off with a "!${name}" line in ${path}`);
}

console.log(`[statusline] ${path}`);

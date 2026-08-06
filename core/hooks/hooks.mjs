#!/usr/bin/env node
// core hooks dispatcher — single entrypoint for skill-owned hook handlers.
//
// Invoked as: hooks.mjs <EventName>   (stdin = hook payload JSON)
//
// Scans sibling ../skills/*/hooks.mjs; a skill module that exports a function
// named exactly <EventName> (e.g. `export function PostToolUse(payload, ctx)`)
// is called. Handlers do their own side-effects and optionally return
// { context } (inject) and/or { block } (Stop refusal). Results are merged and
// emitted in the event's hook-output shape. Adding a skill hook requires no
// change here or in hooks.json — drop a hooks.mjs into the skill folder.
// Fail-open everywhere: any error → { continue:true, suppressOutput:true }.

import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(HERE, '..', 'skills');

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

function emitDefault() {
  emit({ continue: true, suppressOutput: true });
}

function readStdin() {
  return new Promise((resolveStdin) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolveStdin(data));
    process.stdin.on('error', () => resolveStdin(''));
  });
}

function mergeResults(results) {
  const contexts = [];
  const blocks = [];
  for (const r of results) {
    if (!r) continue;
    if (r.context) contexts.push(r.context);
    if (r.block) blocks.push(r.block);
  }
  return { context: contexts.join('\n\n'), block: blocks.join('\n\n') };
}

function emitForEvent(event, merged) {
  // Only Stop-family events can refuse via decision:'block'.
  if (merged.block && (event === 'Stop' || event === 'SubagentStop')) {
    return emit({ decision: 'block', reason: merged.block });
  }
  if (merged.context) {
    return emit({
      continue: true,
      hookSpecificOutput: { hookEventName: event, additionalContext: merged.context },
    });
  }
  return emitDefault();
}

async function main() {
  const event = process.argv[2] || '';
  if (!event) return emitDefault();

  const raw = await readStdin();
  let payload = {};
  try { payload = JSON.parse(raw); } catch { /* fail-open */ }

  // Global gate slot: plugin-wide preconditions go here and early-exit with
  // emitDefault() before the skill scan. None needed yet.

  let skillNames = [];
  try {
    skillNames = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      // Alias skills (.alias marker) are verbatim copies of their source skill,
      // hooks.mjs included — running both would fire the same handler twice.
      .filter((d) => !existsSync(join(SKILLS_DIR, d.name, '.alias')))
      .map((d) => d.name)
      .sort();
  } catch {
    return emitDefault();
  }

  const results = [];
  for (const name of skillNames) {
    const handlerPath = join(SKILLS_DIR, name, 'hooks.mjs');
    if (!existsSync(handlerPath)) continue;
    try {
      const mod = await import(pathToFileURL(handlerPath).href);
      const fn = mod[event];
      if (typeof fn !== 'function') continue; // skill doesn't handle this event
      const out = await fn(payload, { event, name });
      if (out) results.push(out);
    } catch {
      // One skill's failure must not break the others or block the hook.
    }
  }

  emitForEvent(event, mergeResults(results));
}

main().catch(() => emitDefault());

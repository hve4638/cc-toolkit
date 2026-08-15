#!/usr/bin/env node
// frame dispatcher.
//
// Invoked as: dispatch.mjs <EventName>   (stdin = hook payload JSON)
//
// For the event, each guardrail is gated on its marker (cwd→root upward walk).
// An active guardrail that has a handler at guardrails/<name>/hooks/<event>.mjs
// is imported and called with (payload, ctx); the handler does its own
// side-effects and optionally returns { context } (inject) and/or { block }
// (Stop refusal). Results are merged and emitted in the event's hook-output
// shape. Fail-open everywhere: any error → { continue:true, suppressOutput:true }.

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { findMarkerDir, resolveCwd } from './lib/markers.mjs';

// Each guardrail's marker. A guardrail handles only the events for which it
// ships a guardrails/<name>/hooks/<event>.mjs file.
const GUARDRAILS = [
  { name: 'inlay', marker: '.inlay' },
];

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const GUARDRAILS_DIR = join(SCRIPTS_DIR, '..', 'guardrails');

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

  const cwd = resolveCwd(payload);
  const handlerFile = `${event.toLowerCase()}.mjs`;
  const results = [];

  for (const g of GUARDRAILS) {
    const root = findMarkerDir(cwd, g.marker);
    if (!root) continue; // marker absent in cwd→root → guardrail off here
    const handlerPath = join(GUARDRAILS_DIR, g.name, 'hooks', handlerFile);
    if (!existsSync(handlerPath)) continue; // guardrail doesn't handle this event
    try {
      const mod = await import(pathToFileURL(handlerPath).href);
      const out = await mod.default(payload, { event, cwd, root, marker: g.marker, name: g.name });
      if (out) results.push(out);
    } catch {
      // One guardrail's failure must not break the others or block the hook.
    }
  }

  emitForEvent(event, mergeResults(results));
}

main().catch(() => emitDefault());

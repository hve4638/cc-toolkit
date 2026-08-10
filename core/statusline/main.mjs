/**
 * statusline host — builds the line out of the producers aiaddon turns on.
 *
 * Reached through <claude config dir>/statusline.mjs, the installed wrapper,
 * which resolves the newest core and imports this file.
 *
 * A producer owns whole lines: two of them never share one. So placement is a
 * single question — which line — answered by the module's own `priority` band
 * and, within a band, by the order the entries appear in the aiaddon file.
 *
 * Entry `<kind>:<name>` resolves to `<kind>/<name>.mjs` beside this file, and a
 * module the convention does not reach is simply not rendered — the same
 * "unknown entries are ignored" the aiaddon format is built on. Each module
 * exports:
 *
 *   render(context, args) -> string | null   (may be async)
 *   priority                                 'high' | 'medium' | 'low'
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from '../scripts/lib/aiaddon.mjs';
import { sanitize } from './lib/sanitize.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NAMESPACE = 'statusline';
const BANDS = ['high', 'medium', 'low'];
const DEFAULT_BAND = BANDS.indexOf('medium');
// The statusline sits directly above the input box, so its height is taken from
// the user's typing room.
const MAX_LINES = 10;

async function readStdin() {
  if (process.stdin.isTTY) return null;
  try {
    process.stdin.setEncoding('utf8');
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const raw = chunks.join('').trim();
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// The aiaddon local layer is keyed to the session root, the same basis that
// .agent-memory uses.
function projectRootOf(stdin) {
  return stdin?.workspace?.project_dir ?? stdin?.cwd ?? process.cwd();
}

function modulePathOf(entry) {
  const [kind, name] = entry.split(':');
  return join(HERE, kind, `${name}.mjs`);
}

async function importProducer(entry) {
  const path = modulePathOf(entry);
  if (!existsSync(path)) return null;
  try {
    const module = await import(pathToFileURL(path).href);
    return typeof module.render === 'function' ? module : null;
  } catch {
    return null;
  }
}

async function collectProducers(entries) {
  const producers = [];
  for (const [entry, args] of entries) {
    const module = await importProducer(entry);
    if (!module) continue;
    const band = BANDS.indexOf(module.priority);
    producers.push({ entry, args, module, band: band === -1 ? DEFAULT_BAND : band });
  }
  // Array#sort is stable, so entries of one band keep the order they were
  // written in.
  return producers.sort((a, b) => a.band - b.band);
}

async function renderLines(producers, context) {
  const lines = [];
  for (const producer of producers) {
    let output;
    try {
      output = await producer.module.render(context, producer.args);
    } catch {
      // One broken producer costs its own lines, not the statusline.
      continue;
    }
    if (typeof output === 'string' && output.trim()) lines.push(...output.split('\n'));
  }
  return lines;
}

// Claude Code hands the statusline its JSON on stdin; a bare terminal run means
// someone is checking the install by hand.
async function diagnose() {
  const entries = [...load(process.cwd(), NAMESPACE)];
  console.log(`[statusline] ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} in aiaddon ${NAMESPACE}`);
  for (const [entry] of entries) {
    const reached = existsSync(modulePathOf(entry));
    console.log(`  ${entry}  ${reached ? 'ok' : `no module at ${modulePathOf(entry)}`}`);
  }
}

async function main() {
  const stdin = await readStdin();
  if (!stdin) {
    await diagnose();
    return;
  }

  const projectRoot = projectRootOf(stdin);
  const producers = await collectProducers(load(projectRoot, NAMESPACE));
  const lines = await renderLines(producers, { stdin, projectRoot });
  if (!lines.length) return;

  const output = lines.slice(0, MAX_LINES).join('\n');
  // Windows terminals vary in what they do with the escapes a producer emits,
  // so there the statusline is reduced to what every one of them draws alike.
  console.log(process.platform === 'win32' ? sanitize(output) : output);
}

await main();

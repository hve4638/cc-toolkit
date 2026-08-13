/**
 * aiaddon reader — resolves which addon entries a namespace has turned on.
 * Format and rationale: AIADDON.md at the repository root.
 *
 * Two layers, concatenated in this order:
 *   1. ~/.config/aiaddon/<namespace>              (global)
 *   2. <projectRoot>/.config/aiaddon/<namespace>  (local)
 *
 * Lines:
 *   <kind>:<name>[@k=v,flag]  turn on; a later line replaces the whole entry
 *   !<pattern>                turn off what the pattern matches; `*` matches
 *                             any characters, `:` included
 *   blank / leading `#`       ignored
 *
 * Fail-open throughout: a missing file, an unknown namespace and a malformed
 * line all resolve to "nothing here" rather than an error, so a typo in a
 * config file can never take a hook down with it.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const NAMESPACES = ['event', 'statusline'];

const ENTRY_RE = /^([a-z0-9-]+:[a-z0-9-]+)(?:@(\S+))?$/;
const NEGATION_RE = /^!([a-z0-9:*-]+)$/;
const ARG_RE = /^([A-Za-z_][A-Za-z0-9_]*)(?:=([^\s,=]+))?$/;

/** Args of one entry, or null when any part is malformed (the line is then dropped). */
function parseArgs(spec) {
  // WHY: null 프로토타입 — 키가 사용자 입력이라 `__proto__` 같은 이름이 조회를
  // 오염시키지 않게 한다.
  const args = Object.create(null);
  for (const part of spec.split(',')) {
    const m = ARG_RE.exec(part);
    if (!m) return null;
    args[m[1]] = m[2] ?? true;
  }
  return args;
}

// NEGATION_RE 가 통과시키는 문자에는 `*` 말고 정규식 메타문자가 없어 이스케이프가 없다.
function toRegExp(pattern) {
  return new RegExp(`^${pattern.split('*').join('.*')}$`);
}

function readLayer(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/**
 * Entries the namespace leaves on, as a Map of `kind:name` → args object
 * (empty when the entry carries none). Entries that end up off are absent.
 *
 * A null `projectRoot` skips the local layer, leaving the global state alone —
 * what a tool editing the global file needs to see.
 */
export function load(projectRoot, namespace) {
  const entries = new Map();
  if (!NAMESPACES.includes(namespace)) return entries;

  const text = [
    readLayer(join(homedir(), '.config', 'aiaddon', namespace)),
    projectRoot ? readLayer(join(projectRoot, '.config', 'aiaddon', namespace)) : '',
  ].join('\n');

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const negation = NEGATION_RE.exec(line);
    if (negation) {
      const re = toRegExp(negation[1]);
      for (const name of entries.keys()) if (re.test(name)) entries.delete(name);
      continue;
    }

    const entry = ENTRY_RE.exec(line);
    if (!entry) continue;
    const args = entry[2] === undefined ? Object.create(null) : parseArgs(entry[2]);
    if (args) entries.set(entry[1], args);
  }

  return entries;
}

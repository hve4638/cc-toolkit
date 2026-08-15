/**
 * aiaddon reader — resolves which addon entries a namespace has turned on.
 * Format and rationale: AIADDON.md at the repository root.
 *
 * Layers, concatenated in this order (later lines win, so closer wins):
 *   1. ~/.config/aiaddon/<namespace>                (global — always first,
 *      wherever the home directory sits in the tree)
 *   2. <dir>/.config/aiaddon/<namespace> for every ancestor of projectRoot,
 *      root first, projectRoot itself last
 *
 * Lines:
 *   <name>[@k=v,flag]         turn on; a later line replaces the whole entry.
 *                             A name is lowercase letters, digits, `-` and `:`
 *                             — the colon is just a character (a `kind:name`
 *                             prefix is naming convention, not syntax)
 *   !<pattern>                turn off what the pattern matches; `*` matches
 *                             any characters, `:` included
 *   blank / leading `#`       ignored
 *
 * Fail-open throughout: a missing file, an unknown namespace and a malformed
 * line all resolve to "nothing here" rather than an error, so a typo in a
 * config file can never take a hook down with it.
 */

import { join } from 'node:path';
import { cascadePaths, readTextOr } from './corelib.mjs';

export const NAMESPACES = ['event', 'statusline'];

const ENTRY_RE = /^([a-z0-9:-]+)(?:@(\S+))?$/;
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

/**
 * Entries the namespace leaves on, as a Map of entry name → args object
 * (empty when the entry carries none). Entries that end up off are absent.
 *
 * A null `projectRoot` skips the ancestor layers, leaving the global state
 * alone — what a tool editing the global file needs to see.
 */
export function load(projectRoot, namespace) {
  const entries = new Map();
  if (!NAMESPACES.includes(namespace)) return entries;

  const text = cascadePaths(projectRoot, join('.config', 'aiaddon', namespace))
    .map((path) => readTextOr(path, ''))
    .join('\n');

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

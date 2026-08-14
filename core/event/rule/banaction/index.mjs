// @ts-check
/**
 * rule:banaction — denies tool calls matching rules in `.banaction` files.
 * Manual: core/skills/man-banaction/.
 *
 * Rule files, merged additively (a missing file is skipped, no un-ban syntax):
 *   ~/.banaction              global — always first, wherever home sits
 *   <dir>/.banaction          for every ancestor of the session root,
 *                             filesystem root first, session root last
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveProjectRoot } from '../../../scripts/lib/agent-memory.mjs';
import { create } from '../../lib/index.mjs';

// WHY: 콜론 뒤 공백을 요구해 `http://x` 같은 URL 패턴이 도구 스코프 규칙으로 오인되지 않게 한다.
const TOOL_RULE_RE = /^([^\s:]+):\s+(.+)$/;

/** @param {string} content */
function parseRules(content) {
  const rules = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = TOOL_RULE_RE.exec(line);
    if (m) rules.push({ matcher: m[1], pattern: m[2], raw: line });
    else rules.push({ matcher: 'Bash', pattern: line, raw: line });
  }
  return rules;
}

/** @param {string} projectRoot */
function rulePaths(projectRoot) {
  const globalPath = join(homedir(), '.banaction');
  const paths = [globalPath];
  const dirs = [];
  for (let dir = projectRoot; ; dir = dirname(dir)) {
    dirs.unshift(dir);
    if (dir === dirname(dir)) break;
  }
  for (const dir of dirs) {
    const path = join(dir, '.banaction');
    if (path !== globalPath) paths.push(path);
  }
  return paths;
}

/** @param {string} projectRoot */
function loadRules(projectRoot) {
  const rules = [];
  for (const path of rulePaths(projectRoot)) {
    let content;
    try { content = readFileSync(path, 'utf-8'); } catch { continue; }
    rules.push(...parseRules(content));
  }
  return rules;
}

/** @param {string} matcher @param {string} toolName */
function matchesTool(matcher, toolName) {
  try {
    return new RegExp(`^(?:${matcher})$`).test(toolName);
  } catch {
    return toolName === matcher;
  }
}

/** @param {string} pattern @param {string} subject */
function matchesPattern(pattern, subject) {
  try {
    return new RegExp(pattern).test(subject);
  } catch {
    return subject.includes(pattern);
  }
}

/** @param {unknown} value @param {string[]} out */
function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

/** @param {string} toolName @param {unknown} toolInput */
function subjectsFor(toolName, toolInput) {
  // WHY: Bash 는 command 만 본다 — description 의 "git push 전 확인" 같은 설명 문구 오탐 방지.
  if (toolName === 'Bash') {
    const command = /** @type {{command?: unknown}} */ (toolInput ?? {}).command;
    return typeof command === 'string' ? [command] : [];
  }
  return collectStrings(toolInput, []);
}

const a = create();

a.register('PreToolUse', { priority: 'high' }, (api, payload) => {
  const toolName = payload.tool_name ?? '';
  if (!toolName) return;
  const subjects = subjectsFor(toolName, payload.tool_input);
  for (const rule of loadRules(resolveProjectRoot(payload))) {
    if (!matchesTool(rule.matcher, toolName)) continue;
    if (subjects.some((s) => matchesPattern(rule.pattern, s))) {
      api.permission.deny(`Blocked by BAN Action rule '${rule.raw}'. The user has banned this action. Do not retry or work around it; ask the user if it is truly required.`);
      return;
    }
  }
});

export default a;

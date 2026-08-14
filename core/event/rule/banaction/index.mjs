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

import { cascadePaths, readTextOr, resolveProjectRoot } from '../../../scripts/lib/corelib.mjs';
import { create } from '../../lib/index.mjs';

// WHY: 콜론 뒤 공백을 요구해 `http://x` 같은 URL 패턴이 도구 스코프 규칙으로 오인되지 않게 한다.
const TOOL_RULE_RE = /^([^\s:]+):\s+(.+)$/;

// 한 줄 = 규칙 하나. `매처: 패턴` 이면 도구 규칙, bare line 은 Bash 규칙.
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

// cascade 경로 (홈 먼저, 조상을 루트부터 세션 루트까지) 순서대로 읽어
// 이어붙인다. 못 읽는 파일은 건너뜀 (fail-open).
/** @param {string} projectRoot */
function loadRules(projectRoot) {
  const rules = [];
  for (const path of cascadePaths(projectRoot, '.banaction')) {
    const content = readTextOr(path);
    if (content !== null) rules.push(...parseRules(content));
  }
  return rules;
}

// 도구명 전체에 anchored 매칭. 정규식이 안 되면 정확 일치 폴백.
/** @param {string} matcher @param {string} toolName */
function matchesTool(matcher, toolName) {
  try {
    return new RegExp(`^(?:${matcher})$`).test(toolName);
  } catch {
    return toolName === matcher;
  }
}

// unanchored 매칭. 정규식이 안 되면 substring 폴백.
/** @param {string} pattern @param {string} subject */
function matchesPattern(pattern, subject) {
  try {
    return new RegExp(pattern).test(subject);
  } catch {
    return subject.includes(pattern);
  }
}

// 중첩 배열·객체 속 문자열 값 전부 수집.
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

// 매 호출마다 규칙을 새로 읽고 위에서부터 순회 — 첫 매칭 규칙이 deny 하고 끝.
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

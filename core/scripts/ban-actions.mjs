#!/usr/bin/env node
/**
 * PreToolUse Hook: .banaction Guard
 *
 * Denies tool calls that match rules from `.banaction` files:
 *   1. <home>/.banaction           (global)
 *   2. <projectRoot>/.banaction    (project)
 * Both are merged additively; missing files are skipped.
 *
 * Rule format (one per line, `#` starts a comment):
 *   <regex>                  → Bash rule: blocks Bash when tool_input.command matches
 *   <tool-matcher>: <regex>  → tool rule: matcher is an anchored regex over tool_name,
 *                              pattern is matched against every string in tool_input.
 *                              The space after `:` is required.
 *
 * Hook contract (official hooks docs — PreToolUse permission decision):
 *   stdin  : JSON { tool_name, tool_input, cwd, ... }
 *   stdout : deny  → { hookSpecificOutput: { hookEventName, permissionDecision: "deny",
 *                                            permissionDecisionReason } }
 *            else  → { continue: true, suppressOutput: true }
 *   exit 0 : always (fail-open; run.cjs clamps timeouts)
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { readStdin } from './lib/stdin.mjs';

function getProjectRoot(data) {
  return process.env.CLAUDE_PROJECT_DIR ?? data?.cwd ?? process.cwd();
}

// WHY: 콜론 뒤 공백을 요구해 `http://x` 같은 URL 패턴이 도구 스코프 규칙으로 오인되지 않게 한다.
const TOOL_RULE_RE = /^([^\s:]+):\s+(.+)$/;

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

function loadRules(projectRoot) {
  const paths = [join(homedir(), '.banaction'), join(projectRoot, '.banaction')];
  const seen = new Set();
  const rules = [];
  for (const p of paths) {
    const key = resolve(p);
    if (seen.has(key)) continue;
    seen.add(key);
    let content;
    try { content = readFileSync(p, 'utf-8'); } catch { continue; }
    rules.push(...parseRules(content));
  }
  return rules;
}

function matchesTool(matcher, toolName) {
  try {
    return new RegExp(`^(?:${matcher})$`).test(toolName);
  } catch {
    return toolName === matcher;
  }
}

function matchesPattern(pattern, subject) {
  try {
    return new RegExp(pattern).test(subject);
  } catch {
    return subject.includes(pattern);
  }
}

function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const v of value) collectStrings(v, out);
  else if (value && typeof value === 'object') for (const v of Object.values(value)) collectStrings(v, out);
  return out;
}

function subjectsFor(toolName, toolInput) {
  // WHY: Bash 는 command 만 본다 — description 의 "git push 전 확인" 같은 설명 문구 오탐 방지.
  if (toolName === 'Bash') {
    return typeof toolInput?.command === 'string' ? [toolInput.command] : [];
  }
  return collectStrings(toolInput, []);
}

function pass() {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}

async function main() {
  const input = await readStdin(1000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty/invalid stdin — proceed */ }

  const toolName = data?.tool_name ?? '';
  if (!toolName) { pass(); return; }

  const rules = loadRules(getProjectRoot(data));
  if (rules.length === 0) { pass(); return; }

  const subjects = subjectsFor(toolName, data?.tool_input);

  for (const rule of rules) {
    if (!matchesTool(rule.matcher, toolName)) continue;
    if (subjects.some((s) => matchesPattern(rule.pattern, s))) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `Blocked by BAN Action rule '${rule.raw}'. The user has banned this action. Do not retry or work around it; ask the user if it is truly required.`,
        },
      }));
      return;
    }
  }
  pass();
}

main().catch(() => {
  pass();
});

#!/usr/bin/env node
/**
 * PreToolUse Hook: Rule Reminder Enforcer
 *
 * Injects a short `<system-reminder>` before each tool execution to keep
 * plugin-specific rules fresh in the model's active context.
 *
 * Customize `rulesForTool()` below — one rule per tool is usually enough.
 *
 * Identical reminders are throttled per session (SHA-256 of the message,
 * 5-min cooldown) so the same nudge is not re-injected on every tool call.
 * State: <projectRoot>/.agent-memory/pre-tool-advisory/<session_id>.json
 *
 * Hook contract (docs/claude-code-plugin-mechanics.md):
 *   stdin  : JSON { tool_name, tool_input, session_id, cwd, ... }
 *   stdout : JSON { continue, hookSpecificOutput: { hookEventName, additionalContext } }
 *   exit 0 : always (fail-open; run.cjs clamps timeouts)
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readStdin } from './lib/stdin.mjs';

function rulesForTool(toolName) {
  switch (toolName) {
    case 'Bash':
      return 'Prefer dedicated tools (Read, Grep, Glob, Edit) over shell equivalents.';
    case 'Read':
      return 'Read multiple files in parallel when possible.';
    case 'Grep':
      return 'Use Grep (ripgrep) — never shell grep/rg.';
    case 'Write':
    case 'Edit':
      return 'Verify the change after writing. Prefer Edit over Write for existing files.';
    default:
      return null;
  }
}

// --- advisory throttle (omc #3163) -------------------------------------------
const THROTTLE_SUBDIR = '.agent-memory/pre-tool-advisory';
const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

function cooldownMs() {
  const raw = Number.parseInt(process.env.FRAME_PRETOOL_ADVISORY_COOLDOWN_MS ?? '', 10);
  // 0 이하 → throttle 끔 (매 호출 발사)
  return Number.isFinite(raw) ? Math.max(0, raw) : DEFAULT_COOLDOWN_MS;
}

// WHY: 테스트가 시각을 주입해 쿨다운 경계를 결정적으로 검증할 수 있게 한다.
function nowMs() {
  const raw = Number.parseInt(process.env.FRAME_PRETOOL_ADVISORY_NOW_MS ?? '', 10);
  return Number.isFinite(raw) ? raw : Date.now();
}

function getProjectRoot(data) {
  return process.env.CLAUDE_PROJECT_DIR ?? data?.cwd ?? process.cwd();
}

function throttleStatePath(projectRoot, sessionId) {
  // WHY: sessionId 가 파일명에 들어가므로 경로 조작 방지로 화이트리스트.
  const safe = typeof sessionId === 'string' && /^[A-Za-z0-9._-]+$/.test(sessionId)
    ? sessionId
    : '_global';
  return join(projectRoot, THROTTLE_SUBDIR, `${safe}.json`);
}

// 발사해야 하면 true 를 돌려주며 상태를 갱신한다. 쿨다운 안이면 false.
// WHY: 우리 메시지는 정적 rulesForTool 결과뿐이라 키 수가 도구 종류로
//      제한된다 — 업스트림 같은 엔트리 pruning 없이도 파일이 커지지 않는다.
function shouldEmitAdvisory(statePath, message) {
  const cooldown = cooldownMs();
  if (cooldown <= 0) return true;

  const now = nowMs();
  const key = createHash('sha256').update(message).digest('hex');
  try {
    let entries = {};
    try {
      const parsed = JSON.parse(readFileSync(statePath, 'utf-8'));
      if (parsed?.entries && typeof parsed.entries === 'object') entries = parsed.entries;
    } catch { /* 없거나 깨진 상태 → 빈 것으로 시작 */ }

    const last = Number(entries[key]);
    // 처음이거나 · 시계 역행이거나 · 쿨다운 경과 시 발사
    const emit = !Number.isFinite(last) || last > now || now - last >= cooldown;
    if (!emit) return false;

    entries[key] = now;
    mkdirSync(dirname(statePath), { recursive: true });
    const tmp = `${statePath}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ entries }), { mode: 0o600 });
    renameSync(tmp, statePath);
    return true;
  } catch {
    // fail-open: 상태 IO 실패가 안전 출력을 침묵시켜선 안 된다. 차라리 재발사.
    return true;
  }
}

async function main() {
  const input = await readStdin(1000);
  let data = {};
  try { data = JSON.parse(input); } catch { /* empty/invalid stdin — proceed */ }

  const toolName = data?.tool_name ?? '';
  const rule = rulesForTool(toolName);

  if (!rule) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  const statePath = throttleStatePath(getProjectRoot(data), data?.session_id);
  if (!shouldEmitAdvisory(statePath, rule)) {
    process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: rule,
    },
  }));
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
});

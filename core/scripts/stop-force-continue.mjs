#!/usr/bin/env node
/**
 * Stop Hook: Force Continue when the last assistant segment ended on a tool_use
 * the harness did not continue. Tracks repeat occurrences per session and
 * applies a soft / hard rate limit to prevent runaway retry loops.
 *
 * State: <projectRoot>/.agent-memory/unexpected-stop/<session_id>.json
 *   { "stops": ["<ISO>", ...] }
 *
 * Debug: every Stop invocation that passes the guards saves the transcript
 *   tail to <projectRoot>/.agent-memory/stop/transcript_<epochMs>_<pid>.jsonl
 *   (rotation: oldest deleted when count exceeds STOP_DEBUG_MAX).
 *
 * Decision matrix (only when payload guards pass and an unexpected stop is
 * detected from the transcript tail):
 *   total >= HARD_LIMIT             → pass + additionalContext + stderr; clear state
 *   recent_in_5min >= SOFT_LIMIT    → block with extended alert; append state
 *   otherwise                       → block with base alert; append state
 *
 * Abnormal stop is detected when (a) the last substantive entry is an assistant
 * with stop_reason=tool_use, or (b) the last is a user tool_result paired with
 * a prior assistant stop_reason=tool_use AND its timestamp is fresh
 * (< TOOL_RESULT_RACE_GUARD_MS old) to avoid stale-tail false positives.
 *
 * Any pass that is not "no state op" (re-entry, missing session, missing
 * transcript) clears the state file. Atomic writes via tmp+rename.
 *
 * Tunables (env):
 *   FRAME_FORCE_CONTINUE_TAIL_LINES  transcript tail lines to scan (default: 50)
 */

import { execSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { readStdin } from './lib/stdin.mjs';

const TAIL_LINES_DEFAULT = 50;
const STATE_SUBDIR = '.agent-memory/unexpected-stop';
const SOFT_LIMIT = 5;
const SOFT_WINDOW_MS = 5 * 60 * 1000;
const HARD_LIMIT = 10;
const TOOL_RESULT_RACE_GUARD_MS = 100;

const STOP_DEBUG_SUBDIR = '.agent-memory/stop';
const STOP_DEBUG_MAX = 50;
const STOP_DEBUG_FILE_PATTERN = /^transcript_(\d+)(?:_\d+)?\.jsonl$/;

const NOISE_TYPES = new Set([
  'attachment',
  'ai-title',
  'permission-mode',
  'last-prompt',
  'file-history-snapshot',
  'system',
]);

const ALERT_REASON = `[UNEXPECTED STOP ALERT] Turn ended unexpectedly. KEEP GOING if work remains. Otherwise, notify the user that the work is complete.`;

function softLimitNote(recent) {
  return `Repeated unexpected stops (${recent} within 5 minutes). If this looks like a loop, call AskUserQuestion to halt and ask the user before continuing.`;
}

function hardStopNote(total) {
  return `Force-stopped after ${total} consecutive unexpected stops; retry counter cleared.`;
}

function ok() {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}

// WHY: hook payload.cwd 는 훅 발화 시점 cwd 라 사용자 cd 나 서브에이전트
//      호출 위치에 휩쓸려 캐시가 흩어진다. CLAUDE_PROJECT_DIR 는 세션
//      시작 시점에 박힌 절대경로라 안정적이므로 우선시한다.
function getProjectRoot(hookInput) {
  return process.env.CLAUDE_PROJECT_DIR
    ?? hookInput?.cwd
    ?? process.cwd();
}

function statePathFor(projectRoot, sessionId) {
  return join(projectRoot, STATE_SUBDIR, `${sessionId}.json`);
}

function readState(path) {
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.stops) ? { stops: parsed.stops.slice() } : { stops: [] };
  } catch {
    return { stops: [] };
  }
}

function atomicWriteState(path, state) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp.${process.pid}.${Date.now()}`;
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, path);
  } catch { /* fail open: state tracking is best-effort */ }
}

function deleteState(path) {
  try { unlinkSync(path); } catch { /* ENOENT or other: best-effort */ }
}

function tailLines(path, n) {
  try {
    return execSync(`tail -n ${n} ${JSON.stringify(path)}`, {
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return '';
  }
}

function findLastSubstantiveEntries(tailString, n) {
  const lines = tailString.split('\n');
  const out = [];
  for (let i = lines.length - 1; i >= 0 && out.length < n; i--) {
    const line = lines[i];
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry?.type || NOISE_TYPES.has(entry.type)) continue;
    if (entry.type === 'user' || entry.type === 'assistant') out.push(entry);
  }
  return out;
}

function saveDebugTail(projectRoot, tailContent) {
  try {
    const dir = join(projectRoot, STOP_DEBUG_SUBDIR);
    mkdirSync(dir, { recursive: true });
    const name = `transcript_${Date.now()}_${process.pid}.jsonl`;
    const tmp = join(dir, `${name}.tmp`);
    writeFileSync(tmp, tailContent);
    renameSync(tmp, join(dir, name));
    rotateDebugDir(dir);
  } catch { /* best-effort: 디버그 저장은 훅을 막지 않는다 */ }
}

function rotateDebugDir(dir) {
  try {
    const matched = [];
    for (const name of readdirSync(dir)) {
      const m = STOP_DEBUG_FILE_PATTERN.exec(name);
      // WHY: 화이트리스트 — 사용자가 둔 다른 파일 보호
      if (!m) continue;
      matched.push({ name, ts: parseInt(m[1], 10) });
    }
    if (matched.length <= STOP_DEBUG_MAX) return;
    matched.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < matched.length - STOP_DEBUG_MAX; i++) {
      try { unlinkSync(join(dir, matched[i].name)); } catch { /* race ok */ }
    }
  } catch { /* best-effort */ }
}

async function main() {
  const raw = await readStdin(1000);
  let data = {};
  try { data = JSON.parse(raw); } catch { return ok(); }

  // Guards (no state ops)
  if (data?.stop_hook_active) return ok();
  if (data?.hook_event_name !== 'Stop') return ok();
  if (!data?.session_id) return ok();

  const transcriptPath = data?.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) return ok();

  const projectRoot = getProjectRoot(data);
  // WHY: 워크스페이스 (.agent-memory 를 담을 상위 폴더) 가 이미 삭제된 경우
  //      (wt-destroy 등) mkdir -p 가 죽은 워크스페이스를 빈 폴더로 되살리지
  //      않도록 즉시 종료. 이후 디버그 tail 저장·상태 기록도 모두 건너뛴다.
  if (!existsSync(projectRoot)) return ok();

  const tailN = parseInt(process.env.FRAME_FORCE_CONTINUE_TAIL_LINES ?? '', 10) || TAIL_LINES_DEFAULT;
  const tailContent = tailLines(transcriptPath, tailN);
  saveDebugTail(projectRoot, tailContent);

  const [last, prev] = findLastSubstantiveEntries(tailContent, 2);

  const lastIsAssistantToolUse =
    last?.type === 'assistant' && last.message?.stop_reason === 'tool_use';

  // WHY: tail can race the JSONL writer — a fresh end_turn chunk may not be
  //      flushed yet when we read. Only treat tool_result pairs as abnormal
  //      when the timestamp is recent; older pairs almost certainly have a
  //      continuation we just haven't seen.
  const lastTs = Date.parse(last?.timestamp ?? '');
  const gap = Number.isFinite(lastTs) ? Date.now() - lastTs : 0;

  // WHY: harness ran tool then stopped; tool_result is last, assistant tool_use prior.
  const isToolResultPair =
    last?.type === 'user' &&
    Array.isArray(last.message?.content) &&
    last.message.content.some(c => c?.type === 'tool_result') &&
    prev?.type === 'assistant' &&
    prev.message?.stop_reason === 'tool_use' &&
    gap < TOOL_RESULT_RACE_GUARD_MS;

  const isAbnormal = lastIsAssistantToolUse || isToolResultPair;

  const statePath = statePathFor(projectRoot, data.session_id);

  if (!isAbnormal) {
    deleteState(statePath);
    return ok();
  }

  const state = readState(statePath);
  state.stops.push(new Date().toISOString());

  const total = state.stops.length;
  const cutoff = Date.now() - SOFT_WINDOW_MS;
  const recent = state.stops.reduce((acc, ts) => {
    const t = Date.parse(ts);
    return Number.isFinite(t) && t >= cutoff ? acc + 1 : acc;
  }, 0);

  if (total >= HARD_LIMIT) {
    deleteState(statePath);
    const note = hardStopNote(total);
    // WHY: Stop 훅 스키마는 hookSpecificOutput.Stop 미지원. HARD_LIMIT 도달 시
    //      force-continue 루프 자체를 끊는 게 의도라 decision:block 으로 깨우면
    //      안 됨. systemMessage 로 사용자 UI 알림 + stderr 로깅만.
    process.stdout.write(JSON.stringify({
      continue: true,
      systemMessage: note,
    }));
    process.stderr.write(`[force-continue] ${note}\n`);
    return;
  }

  atomicWriteState(statePath, state);

  let reason = ALERT_REASON;
  if (recent >= SOFT_LIMIT) {
    reason += `\n\n${softLimitNote(recent)}`;
  }
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

main().catch(() => ok());

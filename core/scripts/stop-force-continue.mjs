#!/usr/bin/env node
/**
 * Stop Hook: Force Continue when the last assistant segment ended on a tool_use
 * the harness did not continue. Tracks repeat occurrences per session and
 * applies a soft / hard rate limit to prevent runaway retry loops.
 *
 * State: <projectRoot>/.agent-memory/unexpected-stop/<session_id>.json
 *   { "stops": ["<ISO>", ...] }
 *   (IO via lib/agent-memory.mjs — 워크스페이스가 없으면 아무것도 만들지 않는다)
 *
 * Debug (opt-in): when FRAME_FORCE_CONTINUE_DEBUG is set, every Stop invocation
 *   that passes the guards saves the transcript tail to
 *   <projectRoot>/.agent-memory/stop/transcript_<epochMs>_<pid>.jsonl
 *   (rotation: oldest deleted when count exceeds STOP_DEBUG_MAX). Off by default
 *   so a live workspace does not accumulate a file every turn.
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
 *   FRAME_FORCE_CONTINUE_DEBUG       save transcript tail to .agent-memory/stop (default: off)
 */

import { closeSync, existsSync, fstatSync, openSync, readSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  readJson, removeFile, resolveProjectRoot, statePath, writeFileAtomic,
} from './lib/agent-memory.mjs';
import { readHookPayload } from './lib/corelib.mjs';

const TAIL_LINES_DEFAULT = 50;
const TAIL_CHUNK_BYTES = 256 * 1024;
const TAIL_CHUNK_MAX_BYTES = 8 * 1024 * 1024;
const STATE_SUBDIR = 'unexpected-stop';
const SOFT_LIMIT = 5;
const SOFT_WINDOW_MS = 5 * 60 * 1000;
const HARD_LIMIT = 10;
const TOOL_RESULT_RACE_GUARD_MS = 100;

const STOP_DEBUG_SUBDIR = 'stop';
const STOP_DEBUG_MAX = 50;
const STOP_DEBUG_FILE_PATTERN = /^transcript_(\d+)(?:_\d+)?\.jsonl$/;
// WHY: 디버그 tail 저장은 기본 OFF. 살아있는 워크스페이스가 매 턴
//      .agent-memory/stop 파일을 쌓지 않도록, env 가 켜졌을 때만 저장한다.
const STOP_DEBUG_ENABLED = /^(1|true|yes|on)$/i.test(process.env.FRAME_FORCE_CONTINUE_DEBUG ?? '');

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

function stateRelFor(sessionId) {
  return `${STATE_SUBDIR}/${sessionId}.json`;
}

function readState(projectRoot, relPath) {
  const parsed = readJson(projectRoot, relPath);
  return Array.isArray(parsed?.stops) ? { stops: parsed.stops.slice() } : { stops: [] };
}

// WHY: tail(1) 셸아웃은 Windows 에 tail 이 없어 기능 전체를 조용히 무력화했다.
//      순수 Node 로 파일 끝 청크만 읽는다. 바이트 오프셋으로 자른 첫 줄은
//      대부분 반토막이라 버려야 하므로, 온전한 n 줄이 나올 때까지 청크를
//      두 배씩 늘린다 (상한 도달 시 확보된 줄만으로 우아하게 축소).
function tailLines(path, n) {
  let fd;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    for (let chunk = TAIL_CHUNK_BYTES; ; chunk *= 2) {
      const start = Math.max(0, size - chunk);
      const buf = Buffer.alloc(size - start);
      const bytesRead = readSync(fd, buf, 0, buf.length, start);
      let text = buf.subarray(0, bytesRead).toString('utf-8');
      if (start > 0) {
        const nl = text.indexOf('\n');
        if (nl === -1) {
          if (chunk >= TAIL_CHUNK_MAX_BYTES) return '';
          continue;
        }
        text = text.slice(nl + 1);
      }
      const lines = text.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();
      if (start === 0 || lines.length >= n || chunk >= TAIL_CHUNK_MAX_BYTES) {
        return lines.length ? lines.slice(-n).join('\n') + '\n' : '';
      }
    }
  } catch {
    return '';
  } finally {
    if (fd !== undefined) {
      try { closeSync(fd); } catch { /* already closed */ }
    }
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
  const name = `transcript_${Date.now()}_${process.pid}.jsonl`;
  writeFileAtomic(projectRoot, `${STOP_DEBUG_SUBDIR}/${name}`, tailContent);
  rotateDebugDir(statePath(projectRoot, STOP_DEBUG_SUBDIR));
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
  const data = await readHookPayload(1000);
  if (data === null) return ok();

  // Guards (no state ops)
  if (data?.stop_hook_active) return ok();
  if (data?.hook_event_name !== 'Stop') return ok();
  if (!data?.session_id) return ok();

  const transcriptPath = data?.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) return ok();

  const projectRoot = resolveProjectRoot(data);
  // WHY: 죽은 워크스페이스 (wt destroy 등) 의 쓰기는 lib 가드가 이미 막지만,
  //      block 결정·디버그 tail 등 이후 작업 전체가 무의미하므로 즉시 종료.
  if (!existsSync(projectRoot)) return ok();

  const tailN = parseInt(process.env.FRAME_FORCE_CONTINUE_TAIL_LINES ?? '', 10) || TAIL_LINES_DEFAULT;
  const tailContent = tailLines(transcriptPath, tailN);
  if (STOP_DEBUG_ENABLED) saveDebugTail(projectRoot, tailContent);

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

  const stateRel = stateRelFor(data.session_id);

  if (!isAbnormal) {
    removeFile(projectRoot, stateRel);
    return ok();
  }

  const state = readState(projectRoot, stateRel);
  state.stops.push(new Date().toISOString());

  const total = state.stops.length;
  const cutoff = Date.now() - SOFT_WINDOW_MS;
  const recent = state.stops.reduce((acc, ts) => {
    const t = Date.parse(ts);
    return Number.isFinite(t) && t >= cutoff ? acc + 1 : acc;
  }, 0);

  if (total >= HARD_LIMIT) {
    removeFile(projectRoot, stateRel);
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

  writeFileAtomic(projectRoot, stateRel, JSON.stringify(state));

  let reason = ALERT_REASON;
  if (recent >= SOFT_LIMIT) {
    reason += `\n\n${softLimitNote(recent)}`;
  }
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

main().catch(() => ok());

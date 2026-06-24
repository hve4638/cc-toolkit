import { readFileSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { atomicWriteFileSync, ensureDirSync } from './atomic-write.mjs';

const CACHE_SUBDIR = '.agent-memory/inlay-cache';

// WHY: session_id = UUID v4, agent_id = 짧은 hex (≥6 자). 사용자가 수동으로
//      둔 다른 *.json 파일은 cleanup 대상에서 제외해야 한다.
const FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:-[0-9a-f]{6,})?\.json$/i;

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function emptyState() {
  return { hashes: {}, tracking: {}, stopHookFired: false };
}

function readJsonOrEmpty(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      hashes: parsed.hashes ?? {},
      tracking: parsed.tracking ?? {},
      stopHookFired: parsed.stopHookFired ?? false,
    };
  } catch {
    return emptyState();
  }
}

// WHY: 한 inlay 의 tracking 항목은 사이클 동안 codeTouched / inlayUpdated 두
//      플래그가 서로 다른 호출 (코드 수정 vs INLAY.md 수정) 에서 누적된다.
//      항목 단위로 얕게 병합해야 한 호출이 다른 호출의 플래그를 덮어쓰지 않는다.
function mergeTracking(into, from) {
  for (const [key, val] of Object.entries(from)) {
    into[key] = { ...into[key], ...val };
  }
  return into;
}

export function getCacheDir(projectRoot) {
  return join(projectRoot, CACHE_SUBDIR);
}

function baseFile(projectRoot, sessionId) {
  return join(getCacheDir(projectRoot), `${sessionId}.json`);
}

function ownFile(projectRoot, sessionId, agentId) {
  return join(getCacheDir(projectRoot), `${sessionId}-${agentId}.json`);
}

function targetFile(projectRoot, sessionId, agentId) {
  return agentId
    ? ownFile(projectRoot, sessionId, agentId)
    : baseFile(projectRoot, sessionId);
}

export function loadCache({ projectRoot, sessionId, agentId }) {
  const base = readJsonOrEmpty(baseFile(projectRoot, sessionId));
  if (!agentId) return base;

  const own = readJsonOrEmpty(ownFile(projectRoot, sessionId, agentId));
  // WHY: 서브에이전트는 base 를 read-only 로 보고 own 만 갱신한다.
  //      own 이 base 를 덮어써야 자기 변경이 우선 반영된다.
  return {
    hashes: { ...base.hashes, ...own.hashes },
    tracking: mergeTracking({ ...base.tracking }, own.tracking),
    stopHookFired: own.stopHookFired ?? false,
  };
}

export function loadOwnCache({ projectRoot, sessionId, agentId }) {
  // WHY: SubagentStop 은 자기 own 파일만 본다. 서브가 만진 inlay 는 서브 자신이
  //      책임지고 (SubagentStop 이 보고·정리), 메인 Stop 으로 전파되지 않는다.
  return readJsonOrEmpty(ownFile(projectRoot, sessionId, agentId));
}

export function saveCache(updates, { projectRoot, sessionId, agentId }) {
  // WHY: 서브에이전트는 own 파일만 atomic write. base 를 건드리면 메인과
  //      서브의 race window 가 생기고 격리 모델이 깨진다.
  const path = targetFile(projectRoot, sessionId, agentId);
  const cur = readJsonOrEmpty(path);
  if (updates.hashes) Object.assign(cur.hashes, updates.hashes);
  // WHY: resetTracking 은 tracking 을 통째로 비운다. 잔소리 set 과 stopHookFired
  //      기록을 한 번의 atomic write 로 묶어, 둘 사이에서 훅이 timeout 으로
  //      죽을 때 생기는 어긋난 상태 (tracking 만 비고 flag 미기록) 를 막는다.
  if (updates.resetTracking) cur.tracking = {};
  if (updates.tracking) mergeTracking(cur.tracking, updates.tracking);
  if (typeof updates.stopHookFired === 'boolean') cur.stopHookFired = updates.stopHookFired;
  atomicWriteFileSync(path, JSON.stringify(cur));
}

// WHY: 각 소유자 (메인=base, 서브에이전트=own) 는 자기 파일의 tracking 만 비운다.
//      메인이 서브 own 파일을 비우면 살아있는 백그라운드 서브에이전트의 미보고
//      기록을 지워 격리 모델 (saveCache 주석 참조) 을 깬다. 서브 own 정리는
//      각 SubagentStop 책임이고, 죽은 서브의 잔여 파일은 cleanupOrphans 가 회수.
export function clearTracking({ projectRoot, sessionId, agentId }) {
  saveCache({ resetTracking: true }, { projectRoot, sessionId, agentId });
}

export function compactReset({ projectRoot, sessionId, agentId }) {
  const path = targetFile(projectRoot, sessionId, agentId);
  const cur = readJsonOrEmpty(path);
  // WHY: 압축 후 inlay 메시지가 사라졌으므로 다음 PreToolUse 가 풀 chain
  //      을 다시 emit 해야 한다. stopHookFired 는 세션 자체 1 회 발화
  //      플래그라 압축 무관하게 보존.
  const next = { hashes: {}, tracking: {}, stopHookFired: cur.stopHookFired };
  atomicWriteFileSync(path, JSON.stringify(next));
}

export function ownFileExists(projectRoot, sessionId, agentId) {
  try {
    statSync(targetFile(projectRoot, sessionId, agentId));
    return true;
  } catch {
    return false;
  }
}

export function cleanupOrphans({ projectRoot, ttlMs = DEFAULT_TTL_MS }) {
  const dir = getCacheDir(projectRoot);
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - ttlMs;
  for (const name of entries) {
    // WHY: 화이트리스트로 가드 — 사용자가 수동으로 둔 .json 을
    //      삭제하면 inlay 가드를 넘어 데이터 손실로 이어진다.
    if (!FILE_PATTERN.test(name)) continue;
    const full = join(dir, name);
    try {
      if (statSync(full).mtimeMs < cutoff) unlinkSync(full);
    } catch {
      // WHY: 동시 삭제·접근 실패는 다음 회차에 다시 시도할 기회가 있다.
    }
  }
}

export function ensureCacheDir(projectRoot) {
  ensureDirSync(getCacheDir(projectRoot));
}

// WHY: hook payload.cwd 는 훅이 실제로 호출된 시점의 cwd 라 사용자 cd 나
//      서브에이전트의 호출 위치에 휩쓸려 캐시가 디렉터리별로 흩어진다.
//      CLAUDE_PROJECT_DIR 는 claude-code 가 세션 시작 시점에 박는
//      프로젝트 루트 절대경로라 한 세션 동안 안정적이므로 우선시한다.
export function resolveProjectRoot(hookInput) {
  return process.env.CLAUDE_PROJECT_DIR
    ?? hookInput?.cwd
    ?? process.cwd();
}

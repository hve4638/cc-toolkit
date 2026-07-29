/**
 * Project-scoped `.agent-memory` state IO — the single write path.
 *
 * Callers pass paths relative to `.agent-memory` (e.g. 'pre-tool-advisory/s1.json')
 * and never touch mkdir or the base directory themselves.
 *
 * 가드레일: 워크스페이스 (projectRoot) 가 이미 삭제됐으면 (wt destroy 등) 어떤
 * 쓰기도 하지 않는다 — mkdir -p 가 죽은 워크스페이스를 .agent-memory 만 담은
 * 빈 폴더로 되살리는 것을 이 모듈 한 곳에서 구조적으로 차단한다.
 * 새 상태 파일 경로를 만들 땐 반드시 이 모듈을 경유한다 (직접 mkdir 금지).
 *
 * 홈 기반 저장소 (~/.agent-memory/global 등) 는 베이스가 항상 존재하므로
 * 이 모듈의 범위 밖이다.
 */

import {
  appendFileSync, existsSync, mkdirSync, readFileSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const BASE_SUBDIR = '.agent-memory';

// WHY: hook payload.cwd 는 훅 발화 시점 cwd 라 사용자 cd 나 서브에이전트
//      호출 위치에 휩쓸려 상태가 디렉터리별로 흩어진다. CLAUDE_PROJECT_DIR 는
//      세션 시작 시점에 박힌 프로젝트 루트 절대경로라 안정적이므로 우선시한다.
export function resolveProjectRoot(hookInput) {
  return process.env.CLAUDE_PROJECT_DIR
    ?? hookInput?.cwd
    ?? process.cwd();
}

export function statePath(projectRoot, relPath) {
  return join(projectRoot, BASE_SUBDIR, relPath);
}

/** Parsed JSON, or null when missing/corrupted — 호출자는 빈 상태로 시작한다. */
export function readJson(projectRoot, relPath) {
  try {
    return JSON.parse(readFileSync(statePath(projectRoot, relPath), 'utf-8'));
  } catch {
    return null;
  }
}

/** File content as string, or null when missing/unreadable. */
export function readText(projectRoot, relPath) {
  try {
    return readFileSync(statePath(projectRoot, relPath), 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Atomic write (tmp + rename). Returns false without touching the filesystem
 * when the workspace is gone; IO 실패도 false (best-effort, fail-open 은 호출자 몫).
 */
export function writeFileAtomic(projectRoot, relPath, content) {
  if (!existsSync(projectRoot)) return false;
  try {
    const path = statePath(projectRoot, relPath);
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp.${process.pid}`;
    writeFileSync(tmp, content, { mode: 0o600 });
    renameSync(tmp, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Append one line (O_APPEND — 병렬 훅 프로세스 간에도 한 줄 단위 유실 없음).
 * Same workspace guard as writeFileAtomic.
 */
export function appendLine(projectRoot, relPath, line) {
  if (!existsSync(projectRoot)) return false;
  try {
    const path = statePath(projectRoot, relPath);
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${line}\n`, { mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}

/** Best-effort delete. 삭제는 아무것도 만들지 않으므로 가드 불필요. */
export function removeFile(projectRoot, relPath) {
  try { unlinkSync(statePath(projectRoot, relPath)); } catch { /* ENOENT ok */ }
}

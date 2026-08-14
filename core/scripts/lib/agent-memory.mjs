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
 *
 * IO 자체는 corelib 의 범용 함수다 — 이 모듈은 `.agent-memory` 경로 규약과
 * 워크스페이스 가드 (guardDir: projectRoot) 만 얹는다.
 */

import { join } from 'node:path';
import * as corelib from './corelib.mjs';

export { resolveProjectRoot } from './corelib.mjs';

const BASE_SUBDIR = '.agent-memory';

export function statePath(projectRoot, relPath) {
  return join(projectRoot, BASE_SUBDIR, relPath);
}

/** Parsed JSON, or null when missing/corrupted — 호출자는 빈 상태로 시작한다. */
export function readJson(projectRoot, relPath) {
  return corelib.readJsonOr(statePath(projectRoot, relPath));
}

/** File content as string, or null when missing/unreadable. */
export function readText(projectRoot, relPath) {
  return corelib.readTextOr(statePath(projectRoot, relPath));
}

/** Atomic write (tmp + rename). Returns false when the workspace is gone or IO fails. */
export function writeFileAtomic(projectRoot, relPath, content) {
  return corelib.writeFileAtomic(statePath(projectRoot, relPath), content, { guardDir: projectRoot });
}

/** Append one line. Same workspace guard as writeFileAtomic. */
export function appendLine(projectRoot, relPath, line) {
  return corelib.appendLine(statePath(projectRoot, relPath), line, { guardDir: projectRoot });
}

/** Guarded mkdir -p under .agent-memory. Returns false when the workspace is gone or IO fails. */
export function ensureDir(projectRoot, relPath) {
  return corelib.ensureDir(statePath(projectRoot, relPath), { guardDir: projectRoot });
}

/** Best-effort delete. 삭제는 아무것도 만들지 않으므로 가드 불필요. */
export function removeFile(projectRoot, relPath) {
  corelib.removeFile(statePath(projectRoot, relPath));
}

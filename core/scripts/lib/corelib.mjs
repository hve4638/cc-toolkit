// @ts-check
/**
 * corelib v1 — 훅 스크립트가 반복해서 쓰는 패턴 모음.
 *
 * 의존 계층의 뿌리: node 내장만 의존하는 self-contained 한 파일이고, core 의
 * lib·스크립트·event 모듈이 전부 이 위에 선다. 타 플러그인은 이 파일을 통째로
 * 복사해 쓴다 — 수정은 이 원본 (core/scripts/lib/corelib.mjs) 에서 하고,
 * 사본은 diff 로 동기화한다.
 *
 * 전부 fail-open: 읽기는 fallback 을, 쓰기는 false 를 돌려주고 던지지 않는다.
 * 훅이 죽으면 도구 호출·세션 시작이 같이 막히기 때문이다.
 */

import {
  appendFileSync, existsSync, mkdirSync, readFileSync, renameSync,
  unlinkSync, writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

// ── 경로 ────────────────────────────────────────────────────────────────

// WHY: hook payload.cwd 는 훅 발화 시점 cwd 라 사용자 cd 나 서브에이전트
//      호출 위치에 휩쓸려 상태가 디렉터리별로 흩어진다. CLAUDE_PROJECT_DIR 는
//      세션 시작 시점에 박힌 프로젝트 루트 절대경로라 안정적이므로 우선시한다.
/** @param {{cwd?: string} | null | undefined} [hookInput] */
export function resolveProjectRoot(hookInput) {
  return process.env.CLAUDE_PROJECT_DIR
    ?? hookInput?.cwd
    ?? process.cwd();
}

/**
 * `<dir>/<relPath>` 를 홈과 projectRoot 의 조상 디렉터리 전부에서 찾는
 * cascade 경로 목록.
 *
 * 순서: 홈이 맨 앞 (전역 층), 조상은 파일시스템 루트부터 projectRoot 까지 —
 * 이어붙여 해석하는 쪽의 "마지막이 이긴다" 가 곧 가까운 층이 이기게 되는
 * 순서다. 홈이 조상에 겹치면 걸러서 한 번만 넣는다 — 두 번 읽히면 사이에 낀
 * 층 때문에 해석 순서가 꼬인다. projectRoot 가 null 이면 홈 층만 남는다.
 *
 * @param {string | null} projectRoot
 * @param {string} relPath
 * @param {{home?: boolean}} [options] home: false 면 홈 층을 뺀다
 */
export function cascadePaths(projectRoot, relPath, { home = true } = {}) {
  const homePath = join(homedir(), relPath);
  const paths = home ? [homePath] : [];
  if (projectRoot) {
    const dirs = [];
    for (let dir = projectRoot; ; dir = dirname(dir)) {
      dirs.unshift(dir);
      if (dir === dirname(dir)) break;
    }
    for (const dir of dirs) {
      const path = join(dir, relPath);
      if (!home || path !== homePath) paths.push(path);
    }
  }
  return paths;
}

// ── fail-open 읽기 ──────────────────────────────────────────────────────

/** 파일 내용, 없거나 못 읽으면 fallback. */
export function readTextOr(path, fallback = null) {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return fallback;
  }
}

/** JSON 파싱 결과, 없거나 깨졌으면 fallback. */
export function readJsonOr(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return fallback;
  }
}

// ── 가드 쓰기 ───────────────────────────────────────────────────────────
//
// guardDir: 주어진 디렉터리가 사라졌으면 아무것도 만들지 않고 false.
// 삭제된 워크스페이스 (wt destroy 등) 가 훅의 mkdir -p 로 빈 폴더로
// 되살아나는 것을 막는 가드를 옵션 하나로 공유한다.

function guardGone(guardDir) {
  return guardDir !== undefined && !existsSync(guardDir);
}

/**
 * 원자적 쓰기 (tmp + rename). 실패는 false (best-effort, fail-open 은
 * 호출자 몫).
 * @param {{guardDir?: string, mode?: number}} [options]
 */
export function writeFileAtomic(path, content, { guardDir, mode = 0o600 } = {}) {
  if (guardGone(guardDir)) return false;
  try {
    mkdirSync(dirname(path), { recursive: true });
    const tmp = `${path}.tmp.${process.pid}`;
    writeFileSync(tmp, content, { mode });
    renameSync(tmp, path);
    return true;
  } catch {
    return false;
  }
}

/**
 * 한 줄 추가 (O_APPEND — 병렬 훅 프로세스 간에도 한 줄 단위 유실 없음).
 * @param {{guardDir?: string, mode?: number}} [options]
 */
export function appendLine(path, line, { guardDir, mode = 0o600 } = {}) {
  if (guardGone(guardDir)) return false;
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${line}\n`, { mode });
    return true;
  } catch {
    return false;
  }
}

/**
 * mkdir -p. 실패는 false.
 * @param {{guardDir?: string}} [options]
 */
export function ensureDir(path, { guardDir } = {}) {
  if (guardGone(guardDir)) return false;
  try {
    mkdirSync(path, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/** Best-effort 삭제. 아무것도 만들지 않으므로 가드가 없다. */
export function removeFile(path) {
  try { unlinkSync(path); } catch { /* ENOENT ok */ }
}

// ── 훅 stdin ────────────────────────────────────────────────────────────

/**
 * stdin 전부를 읽는다. 부모가 stdin 을 닫지 않으면 EOF 를 영원히 기다리게
 * 되므로 타임아웃을 안전망으로 두고, 시간이 다 되면 그때까지 온 것을
 * 돌려준다. 에러는 빈 문자열.
 * @param {number} [timeoutMs]
 * @returns {Promise<string>}
 */
export function readStdin(timeoutMs = 5000) {
  return new Promise((resolve) => {
    /** @type {Buffer[]} */
    const chunks = [];
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(value);
    };
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        process.stdin.removeAllListeners();
        process.stdin.destroy();
        resolve(Buffer.concat(chunks).toString('utf-8'));
      }
    }, timeoutMs);
    process.stdin.on('data', (chunk) => { chunks.push(chunk); });
    process.stdin.on('end', () => finish(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', () => finish(''));
    // 이미 닫힌 stdin (빈 파이프 등) 은 'end' 가 다시 뜨지 않는다.
    if (process.stdin.readableEnded) finish(Buffer.concat(chunks).toString('utf-8'));
  });
}

/**
 * 훅 payload: stdin 의 JSON 을 파싱해 돌려준다. 비었거나 깨졌으면 null.
 * @param {number} [timeoutMs]
 */
export async function readHookPayload(timeoutMs = 5000) {
  try {
    return JSON.parse(await readStdin(timeoutMs));
  } catch {
    return null;
  }
}

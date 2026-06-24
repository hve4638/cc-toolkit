// Mirrors oh-my-claudecode 4.9.3 scripts/lib/atomic-write.mjs.
// Self-contained, no external deps.

import { openSync, writeSync, fsyncSync, closeSync, renameSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { dirname, basename, join } from 'path';
import { randomUUID } from 'crypto';

export function ensureDirSync(dir) {
  if (existsSync(dir)) return;
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    // WHY: existsSync 와 mkdirSync 사이의 race 로 EEXIST 가 날 수 있다.
    //      이 경우는 정상 — 다른 호출자가 먼저 만든 것.
    if (err.code === 'EEXIST') return;
    throw err;
  }
}

export function atomicWriteFileSync(filePath, content) {
  const dir = dirname(filePath);
  const base = basename(filePath);
  const tempPath = join(dir, `.${base}.tmp.${randomUUID()}`);

  let fd = null;
  let success = false;

  try {
    ensureDirSync(dir);

    // WHY: 'wx' = O_CREAT | O_EXCL. 동시 다발 호출이 같은 temp path 를
    //      덮어쓰지 않도록 exclusive create. randomUUID 와 이중 안전망.
    fd = openSync(tempPath, 'wx', 0o600);
    writeSync(fd, content, 0, 'utf-8');

    // WHY: rename 전에 데이터를 디스크에 박아야 crash 시 빈 파일·부분
    //      본문이 남지 않는다. fsync 없으면 OS 캐시에 머무름.
    fsyncSync(fd);

    closeSync(fd);
    fd = null;

    renameSync(tempPath, filePath);
    success = true;

    // WHY: rename 은 디렉토리 엔트리 변경이라 디렉토리 자체도 fsync
    //      해야 crash safety 가 완성. 일부 플랫폼은 미지원.
    try {
      const dirFd = openSync(dir, 'r');
      try {
        fsyncSync(dirFd);
      } finally {
        closeSync(dirFd);
      }
    } catch {
      // WHY: 플랫폼 (예: Windows) 미지원이 정상 경로. 무시.
    }
  } finally {
    if (fd !== null) {
      try { closeSync(fd); } catch { /* WHY: finally 정리 — 닫기 실패는 본 작업 결과를 가릴 수 없다. */ }
    }
    if (!success) {
      try { unlinkSync(tempPath); } catch { /* WHY: temp 가 이미 사라졌거나 만들지 못한 경우 — 정리 자체 실패는 무시. */ }
    }
  }
}

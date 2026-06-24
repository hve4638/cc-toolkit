// Shared test scaffolding for the inlay guardrail handler/lib tests.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// WHY: resolveProjectRoot 가 CLAUDE_PROJECT_DIR 를 최우선으로 본다. 테스트는
//      payload.cwd 로 임시 루트를 지정하므로, 이 env 가 새면 캐시가 엉뚱한
//      디렉터리로 샌다. import 시점에 한 번 지운다.
delete process.env.CLAUDE_PROJECT_DIR;

export function makeTmpRoot() {
  return mkdtempSync(join(tmpdir(), 'inlay-test-'));
}

export function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true });
}

export function mkdirp(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function write(path, content) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
}

export function cacheDir(root) {
  return join(root, '.agent-memory', 'inlay-cache');
}

export function readCacheFile(root, name) {
  const path = join(cacheDir(root), name);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

export function cacheFiles(root) {
  try {
    return readdirSync(cacheDir(root)).filter((n) => n.endsWith('.json') && !n.startsWith('.'));
  } catch {
    return [];
  }
}

export { existsSync, statSync, join, writeFileSync, readFileSync };

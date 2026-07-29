import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendLine, readJson, readText, removeFile, resolveProjectRoot,
  statePath, writeFileAtomic,
} from '../lib/agent-memory.mjs';

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-memory-test-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test('writeFileAtomic creates dirs and writes under .agent-memory', async () => {
  await withTmpDir(async (dir) => {
    assert.equal(writeFileAtomic(dir, 'sub/a.json', '{"x":1}'), true);
    const path = statePath(dir, 'sub/a.json');
    assert.equal(readFileSync(path, 'utf-8'), '{"x":1}');
    // 상태 파일은 소유자 전용
    assert.equal(statSync(path).mode & 0o777, 0o600);
  });
});

// 가드레일 본체: 죽은 워크스페이스를 되살리지 않는다 (wt destroy 부활 방지)
test('writeFileAtomic on missing project root creates nothing', async () => {
  await withTmpDir(async (dir) => {
    const gone = join(dir, 'destroyed-worktree');
    assert.equal(writeFileAtomic(gone, 'sub/a.json', 'x'), false);
    assert.equal(existsSync(gone), false);
  });
});

test('appendLine on missing project root creates nothing', async () => {
  await withTmpDir(async (dir) => {
    const gone = join(dir, 'destroyed-worktree');
    assert.equal(appendLine(gone, 'flags/s1.jsonl', '{"a":1}'), false);
    assert.equal(existsSync(gone), false);
  });
});

test('appendLine accumulates one line per call', async () => {
  await withTmpDir(async (dir) => {
    appendLine(dir, 'flags/s1.jsonl', '{"a":1}');
    appendLine(dir, 'flags/s1.jsonl', '{"a":2}');
    assert.equal(readText(dir, 'flags/s1.jsonl'), '{"a":1}\n{"a":2}\n');
  });
});

// WHY: stop-context-hint 는 `=== null` 로 부재를 판정한다 — 빈 파일은 '' 여야 한다.
test('readText distinguishes missing (null) from empty string', async () => {
  await withTmpDir(async (dir) => {
    assert.equal(readText(dir, 'none.txt'), null);
    writeFileAtomic(dir, 'empty.txt', '');
    assert.equal(readText(dir, 'empty.txt'), '');
  });
});

test('readJson returns parsed value, null on missing or corrupted', async () => {
  await withTmpDir(async (dir) => {
    assert.equal(readJson(dir, 'none.json'), null);
    writeFileAtomic(dir, 'bad.json', 'not json {{{');
    assert.equal(readJson(dir, 'bad.json'), null);
    writeFileAtomic(dir, 'good.json', '{"x":1}');
    assert.deepEqual(readJson(dir, 'good.json'), { x: 1 });
  });
});

test('removeFile deletes and tolerates missing target', async () => {
  await withTmpDir(async (dir) => {
    writeFileAtomic(dir, 'a.json', 'x');
    removeFile(dir, 'a.json');
    assert.equal(existsSync(statePath(dir, 'a.json')), false);
    removeFile(dir, 'a.json'); // 두 번째 삭제도 조용히 통과
  });
});

test('resolveProjectRoot prefers CLAUDE_PROJECT_DIR over payload cwd', () => {
  const saved = process.env.CLAUDE_PROJECT_DIR;
  try {
    process.env.CLAUDE_PROJECT_DIR = '/from-env';
    assert.equal(resolveProjectRoot({ cwd: '/from-payload' }), '/from-env');
    delete process.env.CLAUDE_PROJECT_DIR;
    assert.equal(resolveProjectRoot({ cwd: '/from-payload' }), '/from-payload');
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = saved;
  }
});

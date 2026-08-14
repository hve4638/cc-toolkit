// corelib 단위 테스트 — cascade 경로, fail-open 읽기, 가드 쓰기, 훅 stdin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, parse } from 'node:path';
import {
  appendLine, cascadePaths, ensureDir, readJsonOr, readTextOr,
  removeFile, resolveProjectRoot, writeFileAtomic,
} from '../lib/corelib.mjs';

function withTemp(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'corelib-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withHome(home, fn) {
  const saved = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// ── cascadePaths ────────────────────────────────────────────────────────

test('cascadePaths: 홈이 맨 앞, 조상은 파일시스템 루트부터 projectRoot 까지', () => {
  withTemp((dir) => withHome(join(dir, 'home'), () => {
    const project = join(dir, 'ws', 'repo');
    const paths = cascadePaths(project, '.thing');
    assert.equal(paths[0], join(dir, 'home', '.thing'));
    assert.equal(paths[1], join(parse(project).root, '.thing'));
    assert.deepEqual(paths.slice(-3), [
      join(dir, '.thing'),
      join(dir, 'ws', '.thing'),
      join(project, '.thing'),
    ]);
  }));
});

test('cascadePaths: 홈 밑의 projectRoot 는 홈 층을 전역 위치에서 한 번만 넣는다', () => {
  withTemp((dir) => withHome(join(dir, 'home'), () => {
    const home = join(dir, 'home');
    const project = join(home, 'repo');
    const paths = cascadePaths(project, '.thing');
    assert.deepEqual(paths.filter((p) => p === join(home, '.thing')), [join(home, '.thing')]);
    assert.equal(paths[0], join(home, '.thing'));
    assert.equal(paths.at(-1), join(project, '.thing'));
  }));
});

test('cascadePaths: home:false 는 홈 층을 뺀다', () => {
  withTemp((dir) => withHome(join(dir, 'home'), () => {
    const project = join(dir, 'ws', 'repo');
    const paths = cascadePaths(project, '.thing', { home: false });
    assert.ok(!paths.includes(join(dir, 'home', '.thing')));
    assert.equal(paths.at(-1), join(project, '.thing'));
  }));
});

test('cascadePaths: projectRoot 가 null 이면 홈 층만 남는다', () => {
  withTemp((dir) => withHome(join(dir, 'home'), () => {
    assert.deepEqual(cascadePaths(null, '.thing'), [join(dir, 'home', '.thing')]);
    assert.deepEqual(cascadePaths(null, '.thing', { home: false }), []);
  }));
});

// ── fail-open 읽기 ──────────────────────────────────────────────────────

test('readTextOr / readJsonOr: 있으면 내용, 없거나 깨졌으면 fallback', () => {
  withTemp((dir) => {
    writeFileSync(join(dir, 't.txt'), 'hi');
    writeFileSync(join(dir, 'j.json'), '{"a":1}');
    writeFileSync(join(dir, 'broken.json'), '{');
    assert.equal(readTextOr(join(dir, 't.txt')), 'hi');
    assert.equal(readTextOr(join(dir, 'none')), null);
    assert.equal(readTextOr(join(dir, 'none'), ''), '');
    assert.deepEqual(readJsonOr(join(dir, 'j.json')), { a: 1 });
    assert.equal(readJsonOr(join(dir, 'broken.json')), null);
    assert.deepEqual(readJsonOr(join(dir, 'none'), {}), {});
  });
});

// ── 가드 쓰기 ───────────────────────────────────────────────────────────

test('writeFileAtomic: 중간 디렉터리를 만들며 쓴다', () => {
  withTemp((dir) => {
    const path = join(dir, 'a', 'b', 'f.txt');
    assert.equal(writeFileAtomic(path, 'v'), true);
    assert.equal(readFileSync(path, 'utf-8'), 'v');
  });
});

test('가드 쓰기: guardDir 가 사라졌으면 아무것도 만들지 않고 false', () => {
  withTemp((dir) => {
    const gone = join(dir, 'gone');
    const path = join(gone, 'sub', 'f.txt');
    assert.equal(writeFileAtomic(path, 'v', { guardDir: gone }), false);
    assert.equal(appendLine(path, 'l', { guardDir: gone }), false);
    assert.equal(ensureDir(join(gone, 'sub'), { guardDir: gone }), false);
    assert.equal(existsSync(gone), false);
  });
});

test('가드 쓰기: guardDir 가 살아 있으면 정상 동작', () => {
  withTemp((dir) => {
    const path = join(dir, 's', 'f.txt');
    assert.equal(writeFileAtomic(path, 'v', { guardDir: dir }), true);
    assert.equal(readFileSync(path, 'utf-8'), 'v');
  });
});

test('appendLine: 줄 단위로 쌓인다', () => {
  withTemp((dir) => {
    const path = join(dir, 'log.jsonl');
    assert.equal(appendLine(path, 'one'), true);
    assert.equal(appendLine(path, 'two'), true);
    assert.equal(readFileSync(path, 'utf-8'), 'one\ntwo\n');
  });
});

test('ensureDir 는 mkdir -p, removeFile 은 없는 파일에도 조용하다', () => {
  withTemp((dir) => {
    const sub = join(dir, 'x', 'y');
    assert.equal(ensureDir(sub), true);
    assert.equal(existsSync(sub), true);
    removeFile(join(dir, 'no-such'));
    const file = join(dir, 'f');
    writeFileSync(file, '1');
    removeFile(file);
    assert.equal(existsSync(file), false);
  });
});

// ── resolveProjectRoot ──────────────────────────────────────────────────

test('resolveProjectRoot: CLAUDE_PROJECT_DIR > payload.cwd > process.cwd()', () => {
  const saved = process.env.CLAUDE_PROJECT_DIR;
  try {
    process.env.CLAUDE_PROJECT_DIR = '/proj';
    assert.equal(resolveProjectRoot({ cwd: '/other' }), '/proj');
    delete process.env.CLAUDE_PROJECT_DIR;
    assert.equal(resolveProjectRoot({ cwd: '/other' }), '/other');
    assert.equal(resolveProjectRoot(undefined), process.cwd());
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = saved;
  }
});

// ── 훅 stdin (자식 프로세스로 실측) ─────────────────────────────────────

const CORELIB_URL = new URL('../lib/corelib.mjs', import.meta.url).href;

function runPayloadChild(stdin) {
  const script = `import { readHookPayload } from ${JSON.stringify(CORELIB_URL)};\n`
    + 'process.stdout.write(JSON.stringify(await readHookPayload(3000) ?? "NULL"));';
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    input: stdin,
    encoding: 'utf-8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('readHookPayload: stdin 의 JSON 을 객체로 돌려준다', () => {
  assert.equal(runPayloadChild('{"a":1}'), '{"a":1}');
});

test('readHookPayload: 깨진 stdin 과 빈 stdin 은 null', () => {
  assert.equal(runPayloadChild('JSON 아님'), '"NULL"');
  assert.equal(runPayloadChild(''), '"NULL"');
});

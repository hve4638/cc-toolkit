import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(__dirname, '..', 'lib', 'statusline-wrapper-template.txt');

// wrapper 는 자기 위치를 설정 디렉터리로 삼으므로, 임시 디렉터리에 놓기만 하면
// 그 안의 캐시만 보게 된다 — 실제 ~/.claude 는 건드리지 않는다.
function withConfigDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'statusline-wrapper-test-'));
  copyFileSync(TEMPLATE, join(dir, 'statusline.mjs'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function plantCore(base, version, body) {
  const dir = join(base, 'plugins', 'cache', 'hve', 'core', version, 'statusline');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'main.mjs'), body);
}

function plantVersionWithoutEntry(base, version) {
  mkdirSync(join(base, 'plugins', 'cache', 'hve', 'core', version), { recursive: true });
}

const prints = (text) => `process.stdout.write(${JSON.stringify(text)});\n`;
const throws = 'throw new Error("half-written build");\n';

function run(configDir, env = {}) {
  const result = spawnSync('node', [join(configDir, 'statusline.mjs')], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('runs the newest core', () => {
  withConfigDir((dir) => {
    plantCore(dir, '0.9.0', prints('old'));
    plantCore(dir, '0.10.0', prints('new'));
    assert.equal(run(dir), 'new');
  });
});

test('skips a version that has no statusline entry', () => {
  withConfigDir((dir) => {
    plantCore(dir, '1.0.0', prints('has entry'));
    plantVersionWithoutEntry(dir, '2.0.0');
    assert.equal(run(dir), 'has entry');
  });
});

test('a stable release outranks a prerelease of the same version', () => {
  withConfigDir((dir) => {
    plantCore(dir, '1.2.0', prints('stable'));
    plantCore(dir, '1.2.0-rc.1', prints('prerelease'));
    assert.equal(run(dir), 'stable');
  });
});

test('a core that throws falls through to the next oldest', () => {
  withConfigDir((dir) => {
    plantCore(dir, '1.0.0', prints('older but working'));
    plantCore(dir, '2.0.0', throws);
    assert.equal(run(dir), 'older but working');
  });
});

test('CORE_PLUGIN_ROOT wins over the cache', () => {
  withConfigDir((dir) => {
    plantCore(dir, '9.9.9', prints('cache'));
    const override = join(dir, 'worktree');
    mkdirSync(join(override, 'statusline'), { recursive: true });
    writeFileSync(join(override, 'statusline', 'main.mjs'), prints('override'));
    assert.equal(run(dir, { CORE_PLUGIN_ROOT: override }), 'override');
  });
});

test('reports in dim grey when no core is found', () => {
  withConfigDir((dir) => {
    const out = run(dir);
    assert.match(out, /^\x1b\[90mstatusline: no core with .*core@hve plugin\x1b\[0m\n$/);
  });
});

test('a load failure is reported as such, not as a missing core', () => {
  withConfigDir((dir) => {
    plantCore(dir, '1.0.0', throws);
    const out = run(dir);
    assert.match(out, /failed to load: half-written build/);
    // 한 줄 유지 — 오류 메시지의 줄바꿈이 statusline 을 밀어내지 않는다.
    assert.equal(out.trimEnd().includes('\n'), false);
  });
});

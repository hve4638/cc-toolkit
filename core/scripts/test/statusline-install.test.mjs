import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSTALL = join(__dirname, '..', 'statusline-install.mjs');
const UNINSTALL = join(__dirname, '..', 'statusline-uninstall.mjs');

// CLAUDE_CONFIG_DIR 로 설정 디렉터리를 임시 디렉터리에 묶어 실제 ~/.claude 를
// 건드리지 않는다 — 두 스크립트 모두 settings.json 을 쓰기 때문에 필수다.
function withConfigDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'statusline-install-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function run(script, configDir) {
  return spawnSync('node', [script], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
  });
}

const settingsOf = (dir) => JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'));
const writeSettings = (dir, value) => writeFileSync(join(dir, 'settings.json'), JSON.stringify(value));

test('install places the wrapper and registers statusLine', () => {
  withConfigDir((dir) => {
    const result = run(INSTALL, dir);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(dir, 'statusline.mjs')));
    assert.match(settingsOf(dir).statusLine.command, /statusline\.mjs$/);
    assert.equal(settingsOf(dir).statusLine.type, 'command');
  });
});

test('install preserves other settings keys', () => {
  withConfigDir((dir) => {
    writeSettings(dir, { model: 'opus', permissions: { allow: ['Bash'] } });
    run(INSTALL, dir);
    const settings = settingsOf(dir);
    assert.equal(settings.model, 'opus');
    assert.deepEqual(settings.permissions, { allow: ['Bash'] });
  });
});

test('install reports the statusLine it takes over', () => {
  withConfigDir((dir) => {
    writeSettings(dir, { statusLine: { type: 'command', command: 'node ~/.claude/hud/hud.mjs' } });
    const result = run(INSTALL, dir);
    assert.match(result.stdout, /Replacing the current statusLine: node ~\/\.claude\/hud\/hud\.mjs/);
  });
});

test('install refuses to write over invalid settings JSON', () => {
  withConfigDir((dir) => {
    writeFileSync(join(dir, 'settings.json'), '{ broken');
    const result = run(INSTALL, dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not valid JSON/);
    assert.equal(readFileSync(join(dir, 'settings.json'), 'utf8'), '{ broken');
  });
});

test('install is idempotent', () => {
  withConfigDir((dir) => {
    run(INSTALL, dir);
    const first = settingsOf(dir);
    const result = run(INSTALL, dir);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(settingsOf(dir), first);
  });
});

test('uninstall removes the wrapper and its statusLine', () => {
  withConfigDir((dir) => {
    writeSettings(dir, { model: 'opus' });
    run(INSTALL, dir);
    const result = run(UNINSTALL, dir);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(join(dir, 'statusline.mjs')), false);
    assert.equal(settingsOf(dir).statusLine, undefined);
    assert.equal(settingsOf(dir).model, 'opus');
  });
});

// hud 나 사용자가 직접 등록한 statusline 을 대신 지우지 않는다.
test('uninstall leaves a statusLine it did not install', () => {
  withConfigDir((dir) => {
    const foreign = { type: 'command', command: 'node ~/.claude/hud/hud.mjs' };
    writeSettings(dir, { statusLine: foreign });
    const result = run(UNINSTALL, dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /belongs to something else/);
    assert.deepEqual(settingsOf(dir).statusLine, foreign);
  });
});

test('uninstall is idempotent on a clean config dir', () => {
  withConfigDir((dir) => {
    const result = run(UNINSTALL, dir);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Nothing to remove/);
  });
});

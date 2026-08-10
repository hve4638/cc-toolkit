import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENABLE = join(__dirname, '..', 'statusline-enable.mjs');

// 스크립트는 HOME 아래 전역 파일만 건드린다. HOME 을 임시 디렉터리로 돌려
// 사용자의 실제 aiaddon 설정과 격리한다.
function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'statusline-enable-test-'));
  const path = join(home, '.config', 'aiaddon', 'statusline');

  const tools = {
    path,
    seed: (text) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    },
    read: () => (existsSync(path) ? readFileSync(path, 'utf-8') : null),
    run: (...args) => {
      const result = spawnSync('node', [ENABLE, ...args], {
        encoding: 'utf8',
        env: { ...process.env, HOME: home },
      });
      return { status: result.status, out: result.stdout, err: result.stderr };
    },
  };

  try {
    return fn(tools);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test('파일이 없으면 만들고 고른 항목을 적는다', () => {
  withHome((t) => {
    const { status, out } = t.run('feat:hud', 'feat:advertise');
    assert.equal(status, 0);
    assert.equal(t.read(), 'feat:hud\nfeat:advertise\n');
    assert.match(out, /Turned on: feat:hud/);
    assert.match(out, /Turned on: feat:advertise/);
  });
});

test('인자를 단 항목도 그대로 적는다', () => {
  withHome((t) => {
    t.run('feat:advertise@lang=ko');
    assert.equal(t.read(), 'feat:advertise@lang=ko\n');
  });
});

test('이미 켜진 항목은 다시 적지 않는다', () => {
  withHome((t) => {
    t.seed('feat:hud\n');
    const { out } = t.run('feat:hud');
    assert.equal(t.read(), 'feat:hud\n');
    assert.match(out, /Already on: feat:hud/);
  });
});

test('꺼둔 항목을 다시 고르면 뒤에 붙여 되살린다', () => {
  withHome((t) => {
    t.seed('feat:hud\n!feat:hud\n');
    t.run('feat:hud');
    assert.equal(t.read(), 'feat:hud\n!feat:hud\nfeat:hud\n');
  });
});

test('기존 내용과 주석을 보존하고 끝에 붙인다', () => {
  withHome((t) => {
    t.seed('# 내 설정\nfeat:advertise\n');
    t.run('feat:hud');
    assert.equal(t.read(), '# 내 설정\nfeat:advertise\nfeat:hud\n');
  });
});

test('줄바꿈으로 끝나지 않는 파일에도 줄을 나눠 붙인다', () => {
  withHome((t) => {
    t.seed('feat:advertise');
    t.run('feat:hud');
    assert.equal(t.read(), 'feat:advertise\nfeat:hud\n');
  });
});

test('고르지 않았는데 켜져 있는 항목은 끄지 않고 알린다', () => {
  withHome((t) => {
    t.seed('feat:advertise\n');
    const { out } = t.run('feat:hud');
    assert.match(out, /Left on: feat:advertise/);
    assert.match(t.read(), /^feat:advertise\nfeat:hud\n$/);
  });
});

test('항목 형식이 아니면 파일을 건드리지 않고 거부한다', () => {
  withHome((t) => {
    const { status, err } = t.run('feat:hud', 'Nope!');
    assert.equal(status, 1);
    assert.match(err, /not an aiaddon entry: Nope!/);
    assert.equal(t.read(), null);
  });
});

test('인자가 없으면 사용법을 낸다', () => {
  withHome((t) => {
    const { status, err } = t.run();
    assert.equal(status, 1);
    assert.match(err, /usage:/);
  });
});

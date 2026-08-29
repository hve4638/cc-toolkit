import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { moveIndex, occupiedRows, toggleIndex } from '../../skills/wtree/scripts/lib/prompt.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(__dirname, '..', '..', 'skills', 'wtree', 'scripts');
const TUI = join(SCRIPTS, 'tui.mjs');

// 실제 wtree CLI 는 머신마다 있을 수도 없을 수도 있다. 게이트의 `(gitwtree)`
// 문자열 검사만 흉내내는 shim 을 PATH 맨 앞에 둬서 테스트를 어느 머신에서든
// 같게 만든다.
function makeShimBin() {
  const bin = mkdtempSync(join(tmpdir(), 'wtree-shim-'));
  writeFileSync(join(bin, 'wtree'), '#!/bin/sh\n[ "$1" = --version ] && echo "wtree 0.0.0 (gitwtree)"\n');
  chmodSync(join(bin, 'wtree'), 0o755);
  return bin;
}
const SHIM_BIN = makeShimBin();

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-tui-'));
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  const g = (args) => spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  g(['init', '-q', '-b', 'main']);
  g(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init']);
  return { dir, repo };
}

// TUI 를 파이프 stdio 로 띄운다 — TTY 가 아니므로 게이트·인자 오류 같은
// 프롬프트 이전 경로만 지나간다. 대화 경로는 tmux pane 실측이 담당한다.
function runTui(argv, { cwd, wtree = true } = {}) {
  const r = spawnSync(process.execPath, [TUI, ...argv], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: wtree ? `${SHIM_BIN}:/usr/bin:/bin` : '/usr/bin:/bin' },
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

test('prompt: moveIndex 는 양방향으로 순환한다', () => {
  assert.equal(moveIndex(0, -1, 3), 2);
  assert.equal(moveIndex(2, 1, 3), 0);
  assert.equal(moveIndex(1, 1, 3), 2);
});

test('prompt: toggleIndex — 같은 group 은 배타, group 없는 항목은 독립', () => {
  const items = [
    { label: 'a', group: 'g' },
    { label: 'b', group: 'g' },
    { label: 'c' },
  ];
  const on = new Set();
  toggleIndex(on, 0, items);
  assert.deepEqual([...on], [0]);
  toggleIndex(on, 2, items); // group 없는 항목은 공존
  toggleIndex(on, 1, items); // 같은 group 의 0 이 꺼진다
  assert.deepEqual([...on].sort(), [1, 2]);
  toggleIndex(on, 1, items); // 재토글은 끄기
  assert.deepEqual([...on], [2]);
});

test('prompt: occupiedRows 는 재줄바꿈된 블록의 실점유 행수를 센다', () => {
  assert.equal(occupiedRows([10, 20, 30], 80), 3); // 넓으면 줄 수 그대로
  assert.equal(occupiedRows([90, 20], 60), 3); // 90폭 줄은 60폭에서 2행
  assert.equal(occupiedRows([130, 130], 60), 6); // 3행짜리 둘
  assert.equal(occupiedRows([0, 5], 60), 2); // 빈 줄도 1행
});

test('tui: wtree CLI 부재는 게이트에서 막힌다', () => {
  const { dir, repo } = makeRepo();
  const r = runTui([], { cwd: repo, wtree: false });
  assert.equal(r.status, 1);
  assert.match(r.out, /standalone wtree CLI not found/);
  rmSync(dir, { recursive: true, force: true });
});

test('tui: git repo 밖은 게이트에서 막힌다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-nogit-'));
  const r = runTui([], { cwd: dir });
  assert.equal(r.status, 1);
  assert.match(r.out, /not inside a git work tree/);
  rmSync(dir, { recursive: true, force: true });
});

test('tui: 이미 설정된 repo 는 게이트를 통과한다 — 차단이 아니라 3선택지 질문 대상', () => {
  const { dir, repo } = makeRepo();
  mkdirSync(join(repo, '.git', 'wtree'), { recursive: true });
  writeFileSync(join(repo, '.git', 'wtree', 'rules'), '[main]\n');
  const r = runTui([], { cwd: repo });
  // 게이트는 지났고, TTY 부재 거부까지 도달한다 — 3선택지 자체는 대화 경로다.
  assert.equal(r.status, 1);
  assert.match(r.err, /needs a terminal/);
  assert.ok(!r.out.includes('already configured'));
  rmSync(dir, { recursive: true, force: true });
});

test('tui: --ko 는 게이트 화면의 안내 문구를 한국어로 낸다', () => {
  const { dir, repo } = makeRepo();
  const r = runTui(['--ko'], { cwd: repo, wtree: false });
  assert.equal(r.status, 1);
  assert.match(r.out, /셋업 불가/);
  rmSync(dir, { recursive: true, force: true });
});

test('tui: TTY 없는 정상 repo 는 터미널이 필요하다고 거부한다', () => {
  const { dir, repo } = makeRepo();
  const r = runTui([], { cwd: repo });
  assert.equal(r.status, 1);
  assert.match(r.err, /needs a terminal/);
  // handoff 프로토콜은 폐기됐다 — 어떤 결말도 파일을 남기지 않는다.
  assert.ok(!existsSync(join(repo, '.git', 'wtree-setup-handoff.md')));
  rmSync(dir, { recursive: true, force: true });
});

test('tui: 잘못된 인자는 usage 로 거부한다 (exit 2)', () => {
  const { dir, repo } = makeRepo();
  for (const argv of [['--nope'], ['apply'], ['apply', '--path', 'x']]) {
    const r = runTui(argv, { cwd: repo });
    assert.equal(r.status, 2, `argv ${JSON.stringify(argv)}`);
    assert.match(r.err, /usage:/);
  }
  rmSync(dir, { recursive: true, force: true });
});

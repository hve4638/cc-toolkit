import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { moveIndex } from '../../skills/wtree/scripts/lib/prompt.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(__dirname, '..', '..', 'skills', 'wtree', 'scripts');
const TUI = join(SCRIPTS, 'tui.mjs');

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

const handoffOf = (repo) => join(repo, '.git', 'wtree-setup-handoff.md');

test('prompt: moveIndex 는 양방향으로 순환한다', () => {
  assert.equal(moveIndex(0, -1, 3), 2);
  assert.equal(moveIndex(2, 1, 3), 0);
  assert.equal(moveIndex(1, 1, 3), 2);
});

test('tui: TTY 없는 정상 repo 는 step 폴백을 안내하고 handoff 는 결과 미기록 페이지다', () => {
  const { dir, repo } = makeRepo();
  const r = runTui([], { cwd: repo });
  assert.equal(r.status, 1);
  assert.match(r.err, /needs a terminal/);
  // 시작 즉시 깔리는 "결과 미기록" 페이지 — 결말 없이 죽은 실행이 이전
  // 실행의 낡은 성공 페이지로 오독되는 것을 막는 장치다.
  const handoff = readFileSync(handoffOf(repo), 'utf8');
  assert.match(handoff, /no outcome has been recorded/);
  rmSync(dir, { recursive: true, force: true });
});

test('tui: 게이트 실패(기설정)는 TTY 없이도 handoff 에 Blocked 를 남긴다', () => {
  const { dir, repo } = makeRepo();
  mkdirSync(join(repo, '.git', 'wtree'), { recursive: true });
  writeFileSync(join(repo, '.git', 'wtree', 'rules'), '[main]\n');
  const r = runTui([], { cwd: repo });
  assert.equal(r.status, 1);
  const handoff = readFileSync(handoffOf(repo), 'utf8');
  assert.match(handoff, /<status>Blocked<\/status>/);
  assert.match(handoff, /already configured/);
  rmSync(dir, { recursive: true, force: true });
});

test('tui: apply 게이트 실패는 step2 문구의 Blocked 를 남긴다', () => {
  const { dir, repo } = makeRepo();
  mkdirSync(join(repo, '.git', 'wtree'), { recursive: true });
  writeFileSync(join(repo, '.git', 'wtree', 'rules'), '[main]\n');
  const r = runTui(['apply', '--path', join(repo, '.wtree')], { cwd: repo });
  assert.equal(r.status, 1);
  const handoff = readFileSync(handoffOf(repo), 'utf8');
  assert.match(handoff, /<status>Blocked<\/status>/);
  assert.match(handoff, /wtree info/);
  rmSync(dir, { recursive: true, force: true });
});

test('tui: --ko 는 handoff 도 한국어 페이지로 렌더한다', () => {
  const { dir, repo } = makeRepo();
  mkdirSync(join(repo, '.git', 'wtree'), { recursive: true });
  writeFileSync(join(repo, '.git', 'wtree', 'rules'), '[main]\n');
  runTui(['--ko'], { cwd: repo });
  const handoff = readFileSync(handoffOf(repo), 'utf8');
  assert.match(handoff, /<status>Blocked<\/status>/);
  rmSync(dir, { recursive: true, force: true });
});

test('tui: 잘못된 인자는 usage 로 거부한다 (exit 2)', () => {
  const { dir, repo } = makeRepo();
  for (const argv of [['apply'], ['--hooks', 'maybe', 'apply', '--path', 'x'], ['--nope'], ['apply', '--path', 'x', '--where', 'over-there']]) {
    const r = runTui(argv, { cwd: repo });
    assert.equal(r.status, 2, `argv ${JSON.stringify(argv)}`);
    assert.match(r.err, /usage:/);
  }
  rmSync(dir, { recursive: true, force: true });
});

// handoff 페이지들의 {KEY} 자리와 스크립트가 넘기는 값의 어긋남은 render 의
// 엄격 계약이 exit 2 로 터뜨린다 — 전 페이지를 실제 값 모양으로 렌더해 잡는다.
test('tui: handoff 페이지 전부가 엄격 치환을 통과한다 (en/ko)', () => {
  const script = `
import { render, setKo } from ${JSON.stringify(join(SCRIPTS, 'lib', 'setuplib.mjs'))};
const pages = () => {
  const next = render('frag-tui-next', { TUI: '/t/tui.mjs', WS: '/w', ARGS: ' --hooks composed', HANDOFF: '/h.md' });
  render('tui-done', { ACTIONS: '- a', BEFORE: '- b', NEXT: next });
  render('tui-cancelled', { STEP1: '/t/step1.mjs' });
  render('tui-failed', { DETAIL: 'boom', STEP1: '/t/step1.mjs' });
  render('tui-started', { STEP1: '/t/step1.mjs' });
};
pages();
setKo(true);
pages();
console.log('ok');
`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ok/);
});

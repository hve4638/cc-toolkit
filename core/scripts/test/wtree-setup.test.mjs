import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mergeHooks, planStep1, renderHook, shq } from '../../skills/wtree/scripts/lib/actions.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(__dirname, '..', '..', 'skills', 'wtree', 'scripts');
const STEP1 = join(SCRIPTS, 'step1.mjs');
const STEP2 = join(SCRIPTS, 'step2.mjs');
const TMUX_TPL = {
  name: 'tmux-window',
  dir: join(SCRIPTS, '..', 'templates', 'hooks', 'tmux-window'),
};

// 실제 wtree CLI 는 머신마다 있을 수도 없을 수도 있다. 게이트의 `(gitwtree)`
// 문자열 검사와 step2 의 `init --load` 만 흉내내는 shim 을 PATH 맨 앞에 둬서
// 테스트를 어느 머신에서든 같게 만든다.
function makeShimBin() {
  const bin = mkdtempSync(join(tmpdir(), 'wtree-shim-'));
  const shim = join(bin, 'wtree');
  writeFileSync(
    shim,
    `#!/bin/sh
case "$1" in
  --version) echo "wtree 0.0.0 (gitwtree)" ;;
  init)
    d="$(git rev-parse --path-format=absolute --git-common-dir)/wtree"
    mkdir -p "$d"
    [ -f "$3/rules" ] && cp "$3/rules" "$d/rules"
    [ -f "$3/settings" ] && cp "$3/settings" "$d/settings"
    echo "loaded rules from $3"
    ;;
  *) echo "shim: unknown verb $1" >&2; exit 1 ;;
esac
`,
  );
  chmodSync(shim, 0o755);
  return bin;
}

function makeRepo(branch = 'main') {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-setup-'));
  const repo = join(dir, 'repo');
  mkdirSync(repo);
  const g = (args) =>
    spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
  g(['init', '-q', '-b', branch]);
  g(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init']);
  return { dir, repo };
}

const SHIM_BIN = makeShimBin();

function run(script, { cwd, answer, argv = [], wtree = true } = {}) {
  const path = wtree
    ? `${SHIM_BIN}:/usr/bin:/bin`
    : '/usr/bin:/bin';
  const args = [script, ...argv];
  if (answer !== undefined) args.push('--answer', JSON.stringify(answer));
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, PATH: path },
  });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

// ---------------------------------------------------------------- step1 게이트

test('step1: wtree CLI 부재는 Blocked', () => {
  const { dir, repo } = makeRepo();
  const r = run(STEP1, { cwd: repo, wtree: false });
  assert.match(r.out, /<status>Blocked<\/status>/);
  assert.match(r.out, /standalone wtree CLI not found/);
  rmSync(dir, { recursive: true, force: true });
});

test('step1: git repo 밖은 Blocked', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-nogit-'));
  const r = run(STEP1, { cwd: dir });
  assert.match(r.out, /<status>Blocked<\/status>/);
  assert.match(r.out, /not inside a git work tree/);
  rmSync(dir, { recursive: true, force: true });
});

test('step1: 이미 설정된 repo 는 Blocked', () => {
  const { dir, repo } = makeRepo();
  mkdirSync(join(repo, '.git', 'wtree'), { recursive: true });
  writeFileSync(join(repo, '.git', 'wtree', 'rules'), '[main]\n');
  const r = run(STEP1, { cwd: repo });
  assert.match(r.out, /<status>Blocked<\/status>/);
  assert.match(r.out, /already configured/);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- step1 라운드

test('step1: 무인자 fresh 라운드는 path 만 요구한다', () => {
  const { dir, repo } = makeRepo();
  const r = run(STEP1, { cwd: repo });
  assert.match(r.out, /<status>Required Answer<\/status>/);
  assert.match(r.out, /- path: "\.wtree"/);
  assert.match(r.out, /root branch: main/);
  rmSync(dir, { recursive: true, force: true });
});

test('step1: path 만 답하면 나머지 키와 질문을 모아 알린다', () => {
  const { dir, repo } = makeRepo();
  const r = run(STEP1, { cwd: repo, answer: { path: '.wtree' } });
  assert.equal(r.status, 1);
  assert.match(r.out, /<status>Required Answer<\/status>/);
  assert.match(r.out, /- branch_shape: /);
  assert.match(r.out, /- hooks: /);
  assert.match(r.out, /- where: /);
  assert.match(r.out, /<question>/);
  assert.ok(!existsSync(join(repo, '.wtree')), 'incomplete answer must not create anything');
  rmSync(dir, { recursive: true, force: true });
});

test('step1: 모르는 키는 Error, 무변화', () => {
  const { dir, repo } = makeRepo();
  const r = run(STEP1, { cwd: repo, answer: { path: '.wtree', nope: 1 } });
  assert.match(r.out, /<status>Error<\/status>/);
  assert.match(r.out, /unknown key in --answer: nope/);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- step1 실행

test('step1: 완전한 answer 는 작업장을 만든다 (셰이프·settings)', () => {
  const { dir, repo } = makeRepo();
  const r = run(STEP1, {
    cwd: repo,
    answer: { path: '.wtree', branch_shape: 'main-work', hooks: [], where: '../' },
  });
  assert.match(r.out, /<status>Success<\/status>/);
  const rules = readFileSync(join(repo, '.wtree', 'rules'), 'utf8');
  assert.match(rules, /^\[main\]/m);
  const settings = readFileSync(join(repo, '.wtree', 'settings'), 'utf8');
  assert.match(settings, new RegExp(`worktree-dir = \\.\\./${basename(repo)}\\.worktrees`));
  assert.match(r.out, /step2\.mjs --answer/);
  rmSync(dir, { recursive: true, force: true });
});

test('step1: 템플릿 루트가 repo 루트 브랜치로 개명된다', () => {
  const { dir, repo } = makeRepo('trunk');
  const r = run(STEP1, {
    cwd: repo,
    answer: { path: '.wtree', branch_shape: 'main-work', hooks: [], where: '../' },
  });
  assert.match(r.out, /applied: root branch main -> trunk/);
  const rules = readFileSync(join(repo, '.wtree', 'rules'), 'utf8');
  assert.match(rules, /^\[trunk\]/m);
  assert.ok(!/^\[main\]/m.test(rules));
  rmSync(dir, { recursive: true, force: true });
});

test('step1: 훅 선택은 post-create 로 반영되고 step2 에 copy_hooks 가 실린다', () => {
  const { dir, repo } = makeRepo();
  const r = run(STEP1, {
    cwd: repo,
    answer: { path: '.wtree', branch_shape: 'main-work', hooks: ['tmux-window'], where: '../' },
  });
  assert.match(r.out, /<status>Success<\/status>/);
  assert.ok(existsSync(join(repo, '.wtree', 'hooks', 'post-create')));
  assert.match(r.out, /"copy_hooks":true/);
  rmSync(dir, { recursive: true, force: true });
});

test('step1: 기존 작업장은 .old 로 회전한다', () => {
  const { dir, repo } = makeRepo();
  mkdirSync(join(repo, '.wtree'));
  writeFileSync(join(repo, '.wtree', 'rules'), '[old-stuff]\n');
  const r = run(STEP1, {
    cwd: repo,
    answer: {
      path: '.wtree', allow_overwrite: true, branch_shape: 'main-work', hooks: [], where: '../',
    },
  });
  assert.match(r.out, /<status>Success<\/status>/);
  assert.match(readFileSync(join(repo, '.wtree.old', 'rules'), 'utf8'), /old-stuff/);
  assert.match(readFileSync(join(repo, '.wtree', 'rules'), 'utf8'), /^\[main\]/m);
  rmSync(dir, { recursive: true, force: true });
});

test('step1: 기존 .wtree 발견 라운드와 채택(adopt) handoff', () => {
  const { dir, repo } = makeRepo();
  mkdirSync(join(repo, '.wtree'));
  writeFileSync(join(repo, '.wtree', 'rules'), '[main]\nchildren = *\n');
  const round = run(STEP1, { cwd: repo });
  assert.match(round.out, /<status>Required Answer<\/status>/);
  assert.match(round.out, /disposal of the existing policy/);

  const adopt = run(STEP1, { cwd: repo, answer: { path: '.wtree', where: '../' } });
  assert.match(adopt.out, /<status>Success<\/status>/);
  assert.match(adopt.out, /adopted: .*\.wtree as-is/);
  assert.match(adopt.out, /"where":"\.\.\/"/);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- step2

test('step2: 적용 — init --load, settings 보완, CLAUDE.md', () => {
  const { dir, repo } = makeRepo();
  const step1 = run(STEP1, {
    cwd: repo,
    answer: { path: '.wtree', branch_shape: 'main-work', hooks: [], where: '../' },
  });
  assert.match(step1.out, /<status>Success<\/status>/);
  const r = run(STEP2, { cwd: repo, answer: { path: join(repo, '.wtree') } });
  assert.match(r.out, /<status>Success<\/status>/);
  assert.ok(existsSync(join(repo, '.git', 'wtree', 'rules')));
  const claude = join(dir, `${basename(repo)}.worktrees`, 'CLAUDE.md');
  assert.ok(existsSync(claude), 'worktree folder CLAUDE.md');
  rmSync(dir, { recursive: true, force: true });
});

test('step2: 훅 문법 오류는 아무것도 반영하지 않는다', () => {
  const { dir, repo } = makeRepo();
  const ws = join(repo, '.wtree');
  mkdirSync(join(ws, 'hooks'), { recursive: true });
  writeFileSync(join(ws, 'rules'), '[main]\nchildren = *\n');
  writeFileSync(join(ws, 'settings'), 'worktree-dir = ../x.worktrees\n');
  writeFileSync(join(ws, 'hooks', 'post-create'), '#!/bin/sh\nif then fi (\n');
  const r = run(STEP2, { cwd: repo, answer: { path: ws, copy_hooks: true } });
  assert.match(r.out, /<status>Error<\/status>/);
  assert.match(r.out, /failed `sh -n`/);
  assert.ok(!existsSync(join(repo, '.git', 'wtree')), 'nothing must be applied');
  rmSync(dir, { recursive: true, force: true });
});

test('step2: copy_hooks true 는 훅을 복사하고 실행 권한을 준다', () => {
  const { dir, repo } = makeRepo();
  const ws = join(repo, '.wtree');
  mkdirSync(join(ws, 'hooks'), { recursive: true });
  writeFileSync(join(ws, 'rules'), '[main]\nchildren = *\n');
  writeFileSync(join(ws, 'settings'), 'worktree-dir = ../x.worktrees\n');
  writeFileSync(join(ws, 'hooks', 'post-create'), '#!/bin/sh\ntrue\n');
  const r = run(STEP2, { cwd: repo, answer: { path: ws, copy_hooks: true } });
  assert.match(r.out, /<status>Success<\/status>/);
  const hook = join(repo, '.git', 'wtree', 'hooks', 'post-create');
  assert.ok(existsSync(hook));
  rmSync(dir, { recursive: true, force: true });
});

test('step2: answer 없는 호출은 정상 루트 이탈 오류다', () => {
  const { dir, repo } = makeRepo();
  const r = run(STEP2, { cwd: repo });
  assert.match(r.out, /<status>Error<\/status>/);
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- 훅 조립

// sh -n 으로 조립 결과가 유효한 셸인지 확인한다 — executeStep2 의 선검사와 같은 검사다.
function shOk(text) {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-hook-'));
  const f = join(dir, 'post-create');
  writeFileSync(f, text);
  const r = spawnSync('sh', ['-n', f], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return r.status === 0;
}

test('renderHook: 답이 없으면 스펙 기본값으로 조립된다', () => {
  const text = renderHook(TMUX_TPL);
  assert.match(text, /detach=-d\n\[ "\$\{WT_INTERACTIVE:-0\}" = 1 \] && detach=/);
  assert.match(text, /^prefix=''$/m);
  assert.match(text, /tmux send-keys -t "\$win" 'claude' Enter/);
  assert.ok(!/(?<!\$)\{[A-Z][A-Z0-9_]*\}/.test(text), 'no unfilled slot');
  assert.ok(shOk(text), 'passes sh -n');
});

test('renderHook: focus=always · command=none 답이 반영된다', () => {
  const text = renderHook(TMUX_TPL, { FOCUS: 'always', COMMAND: 'none' });
  assert.match(text, /# focus: always move\ndetach=\n/);
  assert.ok(!text.includes('&& detach='), 'no interactive branch line');
  assert.ok(!text.includes('send-keys'));
  assert.ok(!/\n{3,}/.test(text), 'no triple blank lines after an empty slot');
  assert.ok(shOk(text));
});

test('renderHook: input 값은 셸 인용을 거친다 (작은따옴표 포함)', () => {
  const text = renderHook(TMUX_TPL, {
    PREFIX: 'wt:',
    COMMAND: { id: 'custom', value: "echo 'hi'" },
  });
  assert.match(text, /^prefix='wt:'$/m);
  assert.ok(text.includes(`tmux send-keys -t "$win" ${shq("echo 'hi'")} Enter`));
  assert.ok(shOk(text));
});

// replaceAll 문자열 대치의 $ 패턴 해석과, 삽입된 내용이 다른 슬롯 치환에
// 재스캔되는 두 유출 경로의 회귀 테스트 — 인용된 입력은 바이트 그대로 남는다.
test('renderHook: $ 대치 패턴과 {KEY} 를 품은 입력도 인용된 그대로 남는다', () => {
  const evil = `echo $'hi' $& $$ \${X} {PRINT} {COMMAND}`;
  const text = renderHook(TMUX_TPL, {
    PREFIX: '{COMMAND}',
    COMMAND: { id: 'custom', value: evil },
  });
  assert.ok(text.includes(`tmux send-keys -t "$win" ${shq(evil)} Enter`));
  assert.match(text, /^prefix='\{COMMAND\}'$/m);
  assert.ok(shOk(text));
});

test('renderHook: 모르는 case id · 값 없는 input case 는 던진다', () => {
  assert.throws(() => renderHook(TMUX_TPL, { FOCUS: 'sometimes' }), /unknown case/);
  assert.throws(() => renderHook(TMUX_TPL, { COMMAND: 'custom' }), /needs a value/);
});

test('planStep1: 조립 실패는 plan 시점에 터진다 — 실행 전, 파일시스템 무변화', () => {
  assert.throws(
    () =>
      planStep1(
        { ws: '/tmp/none', hooks: ['tmux-window'], hookAnswers: { 'tmux-window': { FOCUS: 'nope' } }, where: '../' },
        { detRoot: 'main', hookTpls: [TMUX_TPL], primary: '/tmp/repo' },
      ),
    /unknown case/,
  );
});

test('mergeHooks: 렌더 결과를 서브셸로 격리해 병합한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-tpl-'));
  const plain = join(dir, 'plain');
  mkdirSync(plain);
  writeFileSync(join(plain, 'post-create'), '#!/bin/sh\ntrue\n');
  const merged = mergeHooks(
    [TMUX_TPL, { name: 'plain', dir: plain }],
    { 'tmux-window': { FOCUS: 'never', COMMAND: 'none' } },
  );
  assert.match(merged, /# === tmux-window ===\n\(/);
  assert.match(merged, /# === plain ===\n\(\ntrue\n\)/);
  assert.match(merged, /# focus: never move/);
  assert.ok(shOk(merged));
  rmSync(dir, { recursive: true, force: true });
});

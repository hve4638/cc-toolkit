import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HOOK_KINDS, clearInstalledHooks, mergeFeatures, readHookFiles } from '../../skills/wtree/scripts/lib/actions.mjs';
import { listHookVariants } from '../../skills/wtree/scripts/lib/setuplib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TPL_ROOT = join(__dirname, '..', '..', 'skills', 'wtree', 'templates', 'hooks');
const ALWAYS = join(TPL_ROOT, 'tmux-window', 'always');
const INTERACTIVE_ONLY = join(TPL_ROOT, 'tmux-window', 'interactive-only');
const CLEANUP = join(TPL_ROOT, 'tmux-window-cleanup', 'ask');

// ---------------------------------------------------------------- 템플릿 변형

// sh -n 으로 유효한 셸인지 확인한다 — tui 의 기록 선검사와 같은 검사다.
function shOk(text) {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-hook-'));
  const f = join(dir, 'hook');
  writeFileSync(f, text);
  const r = spawnSync('sh', ['-n', f], { encoding: 'utf8' });
  rmSync(dir, { recursive: true, force: true });
  return r.status === 0;
}

test('listHookVariants: tmux-window 두 변형이 같은 배타 그룹(feature)으로 열거된다', () => {
  const variants = listHookVariants().filter((v) => v.feature === 'tmux-window');
  assert.deepEqual(variants.map((v) => v.variant), ['always', 'interactive-only']);
  for (const v of variants) {
    assert.equal(v.name, `tmux-window · ${v.variant}`);
    assert.ok(v.summary.length > 0, 'INFO first line as summary');
  }
});

test('listHookVariants: 단일 변형 기능(tmux-window-cleanup)은 기능명만으로 열거된다', () => {
  const cleanup = listHookVariants().filter((v) => v.feature === 'tmux-window-cleanup');
  assert.equal(cleanup.length, 1);
  assert.equal(cleanup[0].name, 'tmux-window-cleanup'); // 변형 하나면 · 접미 없음
  assert.ok(cleanup[0].summary.length > 0);
});

test('템플릿 변형은 완성품이다 — 슬롯 없음, sh -n 통과', () => {
  const expected = {
    [ALWAYS]: ['post-create'],
    [INTERACTIVE_ONLY]: ['post-create'],
    [CLEANUP]: ['post-destroy'],
  };
  for (const [dir, kinds] of Object.entries(expected)) {
    const files = readHookFiles(dir);
    assert.deepEqual(Object.keys(files).sort(), kinds);
    for (const [kind, text] of Object.entries(files)) {
      assert.ok(!/(?<!\$)\{[A-Z][A-Z0-9_]*\}/.test(text), `${dir}/${kind}: no {KEY} slot`);
      assert.ok(shOk(text), `${dir}/${kind}: passes sh -n`);
    }
  }
});

test('always 변형: 항상 윈도우를 열고, 포커스는 interactive 실행일 때만 이동한다', () => {
  const text = readHookFiles(ALWAYS)['post-create'];
  assert.match(text, /detach=-d\n\[ "\$\{WTREE_INTERACTIVE:-0\}" = 1 \] && detach=/);
  assert.ok(!text.includes('|| exit 0   # non-interactive'), 'no creation gate');
  assert.ok(text.includes('tmux send-keys -t "$win" -l "$cmd"'));
});

test('interactive-only 변형: 비대화 실행은 윈도우를 아예 만들지 않는다', () => {
  const text = readHookFiles(INTERACTIVE_ONLY)['post-create'];
  assert.match(text, /\[ "\$\{WTREE_INTERACTIVE:-0\}" = 1 \] \|\| exit 0/);
  assert.ok(!text.includes('detach'), 'no detach branch — focus always moves when it runs');
  assert.ok(text.includes('tmux send-keys -t "$win" -l "$cmd"'));
});

test('post-create: -- 인자가 있으면 이스케이프된 초기 프롬프트로 claude 를 기동한다', () => {
  for (const dir of [ALWAYS, INTERACTIVE_ONLY]) {
    const text = readHookFiles(dir)['post-create'];
    assert.match(text, /\[ \$# -gt 0 \]/, 'gates on positional args');
    assert.ok(text.includes(`sed "s/'/'\\\\\\\\''/g"`), 'escapes inner single quotes');
    assert.ok(text.includes(`cmd="claude '$prompt'"`));
  }
});

test('두 변형의 post-create claude 기동부는 동일 사본이다 (드리프트 가드)', () => {
  const tail = (dir) =>
    readFileSync(join(dir, 'post-create'), 'utf8').split('# send-keys,')[1];
  assert.ok(tail(ALWAYS), 'always has the send-keys tail');
  assert.equal(tail(ALWAYS), tail(INTERACTIVE_ONLY));
});

test('clearInstalledHooks: 설치된 훅만 지우고 *.sample 과 훅 아닌 파일은 남긴다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-clear-'));
  writeFileSync(join(dir, 'post-create'), '#!/bin/sh\ntrue\n');
  writeFileSync(join(dir, 'pre-merge'), '#!/bin/sh\ntrue\n');
  writeFileSync(join(dir, 'post-create.sample'), '#!/bin/sh\ntrue\n');
  writeFileSync(join(dir, 'README'), 'not a hook\n');
  const removed = clearInstalledHooks(dir);
  assert.deepEqual(removed.sort(), ['post-create', 'pre-merge']);
  assert.deepEqual(readdirSync(dir).sort(), ['README', 'post-create.sample']);
  assert.deepEqual(clearInstalledHooks(dir), []); // 재호출은 무해
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------- 병합

test('mergeFeatures: $0 재호출 훅이 같은 종류에서 겹치면 조립을 거부한다', () => {
  // tmux-window-cleanup 의 post-destroy 는 $0 재호출 — 병합되면 재진입이 뒤 절까지 돈다.
  const a = { name: 'tmux-window-cleanup', files: readHookFiles(CLEANUP) };
  const b = { name: 'other', files: { 'post-destroy': '#!/bin/sh\ntrue\n' } };
  assert.throws(() => mergeFeatures([a, b]), /cannot be merged/);
});

test('mergeFeatures: 같은 종류만 서브셸 격리로 병합하고, 종류별 파일로 돌려준다', () => {
  const a = { name: 'tmux-window · always', files: readHookFiles(ALWAYS) };
  const b = { name: 'plain', files: { 'post-create': '#!/bin/sh\ntrue\n' } };
  const c = { name: 'tmux-window-cleanup', files: readHookFiles(CLEANUP) };
  const merged = mergeFeatures([a, b, c]);
  assert.match(merged['post-create'], /# === tmux-window · always ===\n\(/);
  assert.match(merged['post-create'], /# === plain ===\n\(\ntrue\n\)/);
  assert.ok(shOk(merged['post-create']));
  // post-destroy 는 cleanup 만 가지므로 병합 없이 단독 파일 그대로다.
  assert.ok(merged['post-destroy'].includes('kill-window'));
  assert.ok(!merged['post-destroy'].includes('# ==='));
});

test('mergeFeatures: 가져온 기존 훅(원시 파일)도 같은 모양으로 섞인다', () => {
  const imported = { name: '/repo/.wtree/hooks', files: { 'pre-merge': '#!/bin/sh\necho SHARED\n' } };
  const composed = { name: 'tmux-window · always', files: readHookFiles(ALWAYS) };
  const merged = mergeFeatures([imported, composed]);
  assert.equal(merged['pre-merge'], '#!/bin/sh\necho SHARED\n');
  assert.ok(merged['post-create'].includes('send-keys'));
  assert.deepEqual(Object.keys(merged).sort(), HOOK_KINDS.filter((k) => k in merged).sort());
});

// ---------------------------------------------------------------- post-destroy 가드

// post-destroy 가드 동작 — stub tmux 를 PATH 에 놓고 헤르메틱하게 돌린다.
// split-window 호출 여부가 관찰 대상이다 (ask pane 이 뜨는가/안 뜨는가).
function runPostDestroy({ panes, panesExit = 0, env = {} }) {
  const dir = mkdtempSync(join(tmpdir(), 'wtree-pd-'));
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  const log = join(dir, 'log');
  writeFileSync(log, '');
  writeFileSync(
    join(bin, 'tmux'),
    `#!/bin/sh
echo "$@" >> "$LOGF"
case "$1" in
  display-message)
    case "$*" in *window_name*) echo "\${WNAME:-work}" ;; *) echo @1 ;; esac
    exit 0 ;;
  list-panes) [ -n "\${PANES}" ] && printf '%s\\n' "\${PANES}"; exit "\${PANES_EXIT:-0}" ;;
  *) exit 0 ;;
esac
`,
  );
  chmodSync(join(bin, 'tmux'), 0o755);
  const hook = join(dir, 'post-destroy');
  writeFileSync(hook, readFileSync(join(CLEANUP, 'post-destroy'), 'utf8'));
  const r = spawnSync('sh', [hook], {
    encoding: 'utf8',
    env: {
      PATH: `${bin}:/usr/bin:/bin`,
      TMUX: 'fake,1,0',
      TMUX_PANE: '%9',
      WTREE_PATH: '/x/wt',
      WTREE_REPO: '/tmp',
      WTREE_BRANCH: 'feat/x',
      LOGF: log,
      PANES: panes,
      PANES_EXIT: String(panesExit),
      ...env,
    },
  });
  const calls = readFileSync(log, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, calls };
}

test('post-destroy: 모든 pane 이 죽은 경로면 [D] 표식 후 ask pane 을 띄운다 ((deleted) 접미사 포함)', () => {
  const r = runPostDestroy({ panes: '/x/wt (deleted)\n/x/wt/sub' });
  assert.match(r.calls, /rename-window -t @1 \[D\]work/);
  assert.match(r.calls, /split-window/);
  assert.ok(r.calls.indexOf('rename-window') < r.calls.indexOf('split-window'), 'mark lands before the ask');
});

test('post-destroy: 이미 [D] 인 이름은 다시 붙이지 않는다 (cascade / 재실행)', () => {
  const r = runPostDestroy({ panes: '/x/wt', env: { WNAME: '[D]work' } });
  assert.ok(!r.calls.includes('rename-window'));
  assert.match(r.calls, /split-window/);
});

test('post-destroy: 다른 경로 pane 이 하나라도 있으면 아무것도 하지 않는다', () => {
  const r = runPostDestroy({ panes: '/x/wt (deleted)\n/home/elsewhere' });
  assert.ok(!r.calls.includes('split-window'));
  assert.ok(!r.calls.includes('rename-window'), 'no mark on a window that still hosts other work');
  assert.equal(r.status, 0);
});

test('post-destroy: pane 목록 실패·빈 목록·계약 env 부재는 fail-closed', () => {
  assert.ok(!runPostDestroy({ panes: '/x/wt', panesExit: 1 }).calls.includes('split-window'));
  assert.ok(!runPostDestroy({ panes: '' }).calls.includes('split-window'));
  assert.ok(!runPostDestroy({ panes: '/x/wt', env: { WTREE_PATH: '' } }).calls.includes('split-window'));
});

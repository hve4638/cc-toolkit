#!/usr/bin/env node
// /wtree 셋업 step 2 — 적용. `--answer` JSON 이 완성됐을 때만 한 동작
// (settings 보완 → wtree init --load → 훅 복사 → 워크트리 폴더 CLAUDE.md)을
// 수행한다. 에이전트가 .git 내부를 직접 만지는 일은 없다.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import {
  SCRIPTS_DIR,
  fail,
  git,
  parseAnswer,
  render,
  run,
  say,
  sh,
} from './lib/setuplib.mjs';

const isFile = (p) => existsSync(p) && statSync(p).isFile();
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const SELF = join(SCRIPTS_DIR, 'step2.mjs');
const ALLOWED = ['path', 'copy_hooks', 'where'];

run(() => {
  const badAnswer = (p) => fail('bad-answer', { PROBLEM: p, ALLOWED: ALLOWED.join(', ') });
  const a = parseAnswer(ALLOWED, badAnswer);

  // ---- 게이트 (수집형) ----
  const problems = [];
  const alerts = [];
  const ver = sh('wtree', ['--version']);
  if (!ver.ok || !ver.stdout.includes('(gitwtree)')) {
    problems.push('standalone wtree CLI not found — `wtree --version` output lacks `(gitwtree)`');
    alerts.push('The wtree CLI is not installed, or the `wtree` on PATH is a different tool. This setup configures that CLI and cannot proceed without it. Do not attempt to install it.');
  }
  const gitOk = git(['rev-parse', '--is-inside-work-tree']).ok;
  let common = '';
  if (!gitOk) {
    problems.push('cwd is not inside a git work tree');
    alerts.push('/wtree sets up the repo the cwd belongs to. Confirm with the user which repo to set up and re-run inside it.');
  } else {
    common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).stdout;
    if (isFile(join(common, 'wtree', 'rules'))) {
      problems.push(`already configured — ${join(common, 'wtree', 'rules')} exists`);
      alerts.push('This repo already carries a wtree policy. Either step 2 already succeeded or the repo came configured — check the current policy with `wtree info`.');
    }
  }
  if (problems.length)
    fail('step2-blocked', {
      PROBLEMS: problems.join('\n'),
      ALERTS: alerts.map((s) => `- ${s}`).join('\n'),
    });

  const toplevel = git(['rev-parse', '--show-toplevel']).stdout;
  const primary = dirname(common);

  // ---- answer 없는 호출 — 정상 루트(step 1 이 완성 명령을 건네줌)를 벗어난 오류 ----
  if (!('path' in a)) fail('step2-no-answer', {});
  if (typeof a.path !== 'string' || !a.path) badAnswer('path must be a non-empty string');
  const ws = resolve(a.path);
  if (!existsSync(ws))
    fail('step2-bad', { PROBLEM: `${ws} does not exist — with no workspace, start from step 1` });
  if (!isDir(ws)) fail('step2-bad', { PROBLEM: `${ws} is not a directory` });
  if (!isFile(join(ws, 'rules')))
    fail('step2-bad', { PROBLEM: `${ws}/rules is missing — a custom shape needs its rules written` });

  // ---- answer 검증 (여기까지 어떤 변화도 없다) ----
  const wsHooks = join(ws, 'hooks');
  const hookFiles = isDir(wsHooks)
    ? readdirSync(wsHooks).sort().filter((f) => isFile(join(wsHooks, f)))
    : [];
  const hasSettings = isFile(join(ws, 'settings'));

  const requires = [];
  const questions = [];
  let n = 0;
  const ask = (frag, extra = {}) => {
    n += 1;
    questions.push(render(frag, { N: String(n), ...extra }).trimEnd());
  };
  const bad = (v) => ` — invalid value: ${JSON.stringify(v)}`;

  // copy_hooks 는 step 1 시점(작업장 검토)에서 정해져 answer 로 실려 온다 — 여기서 다시 묻지 않는다.
  if (hookFiles.length && !('copy_hooks' in a)) {
    requires.push('- copy_hooks: true | false — the hook decision made at step 1');
  } else if ('copy_hooks' in a && typeof a.copy_hooks !== 'boolean') {
    requires.push(`- copy_hooks: true | false${bad(a.copy_hooks)}`);
  }

  if (!hasSettings && !('where' in a)) {
    requires.push('- where: "../" | "./"');
    ask('q-where', { WORKTREES_NAME: `${basename(primary)}.worktrees` });
  } else if ('where' in a && a.where !== '../' && a.where !== './') {
    requires.push(`- where: "../" | "./"${bad(a.where)}`);
    ask('q-where', { WORKTREES_NAME: `${basename(primary)}.worktrees` });
  }

  if (requires.length) {
    say('step2-missing', {
      PARTIAL: JSON.stringify(a),
      REQUIRE: requires.join('\n'),
      QUESTION_BLOCK: questions.length ? `<question>\n${questions.join('\n\n')}\n</question>\n` : '',
      STEP2: SELF,
    });
    process.exit(1);
  }

  const copyHooks = hookFiles.length > 0 && a.copy_hooks === true;

  // ---- 실행 (완전한 answer — 훅 문법 선검사부터, 실패 시 아무것도 반영 안 됨) ----
  if (copyHooks)
    for (const f of hookFiles) {
      const check = sh('sh', ['-n', join(wsHooks, f)]);
      if (!check.ok)
        fail('step2-hook-invalid', { FILE: join(wsHooks, f), SH_OUTPUT: check.all });
    }

  const actions = [];
  const wsSettings = join(ws, 'settings');
  if (!hasSettings) {
    writeFileSync(
      wsSettings,
      `# wtree machine-local settings — written by the /wtree setup\nworktree-dir = ${a.where}${basename(primary)}.worktrees\n`,
    );
    actions.push(`- created: ${wsSettings} (worktree-dir = ${a.where}${basename(primary)}.worktrees)`);
  } else if ('where' in a) {
    actions.push(`- kept: ${wsSettings} already exists, so the where value was ignored`);
  }

  const load = sh('wtree', ['init', '--load', ws], { cwd: toplevel });
  if (!load.ok) fail('step2-load-failed', { DIR: ws, WTREE_OUTPUT: load.all });
  actions.push(`- applied: wtree init --load ${ws}`);

  // settings 가 .git/wtree 에 실리지 않는 wtree 버전 대비 — 없으면 복사로 보완.
  const liveSettings = join(common, 'wtree', 'settings');
  if (!isFile(liveSettings) || !/^\s*worktree-dir\s*=/m.test(readFileSync(liveSettings, 'utf8'))) {
    copyFileSync(wsSettings, liveSettings);
    actions.push(`- created: ${liveSettings} (copied from ${wsSettings} — init did not carry settings)`);
  }

  if (copyHooks) {
    const liveHooks = join(common, 'wtree', 'hooks');
    mkdirSync(liveHooks, { recursive: true });
    for (const f of hookFiles) {
      copyFileSync(join(wsHooks, f), join(liveHooks, f));
      chmodSync(join(liveHooks, f), 0o755);
      actions.push(`- copied: ${join(wsHooks, f)} -> ${join(liveHooks, f)} (made executable, passed sh -n)`);
    }
  } else if (hookFiles.length) {
    actions.push(`- skipped: ${wsHooks}/ not copied per copy_hooks:false`);
  }

  const raw = readFileSync(liveSettings, 'utf8').match(/^\s*worktree-dir\s*=\s*(.*)$/m);
  const value = raw ? raw[1].replace(/#.*$/, '').trim() : '';
  const wtDir = value
    ? isAbsolute(value)
      ? value
      : resolve(primary, value)
    : join(dirname(primary), `${basename(primary)}.worktrees`);
  mkdirSync(wtDir, { recursive: true });
  const claudeMd = join(wtDir, 'CLAUDE.md');
  if (isFile(claudeMd)) {
    actions.push(`- kept: ${claudeMd} (existing file preserved)`);
  } else {
    copyFileSync(join(SCRIPTS_DIR, 'worktree-claude.md'), claudeMd);
    actions.push(`- created: ${claudeMd}`);
  }

  say('step2-done', {
    ACTIONS: actions.join('\n'),
    WTREE_OUTPUT: load.all,
  });
});

#!/usr/bin/env node
// /wtree 셋업 step 2 — 적용. `--answer` JSON 이 완성됐을 때만 한 동작
// (settings 보완 → wtree init --load → 훅 복사 → 워크트리 폴더 CLAUDE.md)을
// 수행한다. 에이전트가 .git 내부를 직접 만지는 일은 없다.
// 결정적 동작은 lib/actions.mjs 와 공유한다 — 이 파일이 들고 있는 것은 폼
// 프로토콜(검증·페이지 출력)뿐이다.
import { existsSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { collectFacts, executeStep2, isDir, isFile, runGates } from './lib/actions.mjs';
import { SCRIPTS_DIR, fail, parseAnswer, render, run, say } from './lib/setuplib.mjs';

const SELF = join(SCRIPTS_DIR, 'step2.mjs');
const ALLOWED = ['path', 'copy_hooks', 'where'];

run(() => {
  const badAnswer = (p) => fail('bad-answer', { PROBLEM: p, ALLOWED: ALLOWED.join(', ') });
  const a = parseAnswer(ALLOWED, badAnswer);

  // ---- 게이트 (수집형) ----
  const gate = runGates(
    'This repo already carries a wtree policy. Either step 2 already succeeded or the repo came configured — check the current policy with `wtree info`.',
  );
  if (gate.problems.length)
    fail('step2-blocked', {
      PROBLEMS: gate.problems.join('\n'),
      ALERTS: gate.alerts.map((s) => `- ${s}`).join('\n'),
    });

  const { toplevel, primary } = collectFacts(gate.common);

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

  // ---- 실행 (완전한 answer — 훅 문법 선검사부터, 실패 시 아무것도 반영 안 됨) ----
  const result = executeStep2(
    { ws, copyHooks: a.copy_hooks === true, where: a.where, whereProvided: 'where' in a },
    { primary, toplevel },
  );
  if (!result.ok) fail(result.page, result.values);

  say('step2-done', {
    ACTIONS: result.actions.join('\n'),
    WTREE_OUTPUT: result.wtreeOutput,
  });
});

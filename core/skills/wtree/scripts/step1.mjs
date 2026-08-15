#!/usr/bin/env node
// /wtree 셋업 step 1 — 작업장 생성. `--answer` JSON 이 완성됐을 때만 한 동작
// (회전·생성·셰이프 반영·훅 병합·settings 기록)을 수행하고, 그 외 호출은 어떤
// 변화도 없이 현 상황과 채워야 할 키만 출력한다.
// 결정적 동작(게이트·사실 수집·실행)은 lib/actions.mjs 와 공유한다 — 이 파일이
// 들고 있는 것은 폼 프로토콜(라운드·검증·페이지 출력)뿐이다.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  collectFacts,
  executeStep1,
  isDir,
  isFile,
  planStep1,
  runGates,
} from './lib/actions.mjs';
import {
  SCRIPTS_DIR,
  SKILL_DIR,
  fail,
  parseAnswer,
  render,
  run,
  say,
  templateList,
} from './lib/setuplib.mjs';

const SELF = join(SCRIPTS_DIR, 'step1.mjs');
const STEP2 = join(SCRIPTS_DIR, 'step2.mjs');
const ALLOWED = ['path', 'allow_overwrite', 'branch_shape', 'hooks', 'root', 'drop', 'where', 'copy_hooks'];

run(() => {
  const badAnswer = (p) => fail('bad-answer', { PROBLEM: p, ALLOWED: ALLOWED.join(', ') });
  const a = parseAnswer(ALLOWED, badAnswer);

  // ---- 게이트 ----
  const gate = runGates(
    'This repo already carries a wtree policy, so there is nothing to set up. If the current policy is the question, `wtree info` is the starting point.',
  );
  if (gate.problems.length)
    fail('step1-blocked', {
      PROBLEMS: gate.problems.join('\n'),
      ALERTS: gate.alerts.map((s) => `- ${s}`).join('\n'),
    });

  // ---- 사실 수집 (읽기 전용) ----
  const {
    primary,
    dotwtree,
    detRoot,
    shapes,
    hookTpls,
    dwHooksDir,
    dwHookFiles,
    dwContents,
  } = collectFacts(gate.common);

  const facts = render('frag-facts', {
    WTREE_VERSION: gate.ver.stdout,
    PRIMARY: primary,
    COMMON: gate.common,
    ROOT: detRoot || 'detection failed',
    DOTWTREE_LINE: dotwtree ? `found — ${dotwtree} (${dwContents})` : 'none',
  }).trimEnd();

  // ---- path 미결 라운드 ----
  if (!('path' in a)) {
    if (!dotwtree) {
      say('step1-fresh', { FACTS: facts, STEP1: SELF });
      return;
    }
    const values = { FACTS: facts, DOTWTREE: dotwtree, STEP1: SELF };
    if (dwHookFiles.length) {
      say('step1-existing-hooks', {
        ...values,
        HOOK_FILES: dwHookFiles.map((f) => join(dwHooksDir, f)).join(' '),
      });
    } else {
      say('step1-existing', values);
    }
    process.exit(1);
  }

  // ---- answer 검증 (여기까지 어떤 변화도 없다) ----
  if (typeof a.path !== 'string' || !a.path) badAnswer('path must be a non-empty string');
  if ('allow_overwrite' in a && typeof a.allow_overwrite !== 'boolean')
    badAnswer('allow_overwrite must be a boolean');
  const ws = resolve(a.path);

  const requires = [];
  const questions = [];
  let n = 0;
  const ask = (frag, extra = {}) => {
    n += 1;
    questions.push(render(frag, { N: String(n), ...extra }).trimEnd());
  };
  const bad = (v) => ` — invalid value: ${JSON.stringify(v)}`;

  // ---- adopt 라운드: path 가 이미 유효한 작업장이면 만들지 않고 그대로 인정,
  //      step2 완성 명령을 건네준다. 작업장이 아닌 기존 경로는 오류다. ----
  if (existsSync(ws) && a.allow_overwrite !== true) {
    if (!isFile(join(ws, 'rules')) && !isFile(join(ws, 'settings'))) {
      say('step1-path-exists', { PATH: ws, STEP1: SELF });
      process.exit(1);
    }
    const adoptHooksDir = join(ws, 'hooks');
    const adoptHookFiles = isDir(adoptHooksDir)
      ? readdirSync(adoptHooksDir).filter((f) => isFile(join(adoptHooksDir, f)))
      : [];
    const adoptHasSettings = isFile(join(ws, 'settings'));

    if (adoptHookFiles.length && !('copy_hooks' in a)) {
      requires.push('- copy_hooks: true | false — the hook decision from the review');
    } else if ('copy_hooks' in a && typeof a.copy_hooks !== 'boolean') {
      requires.push(`- copy_hooks: true | false${bad(a.copy_hooks)}`);
    }
    if (!adoptHasSettings && !('where' in a)) {
      requires.push('- where: "../" | "./"');
      ask('q-where', { WORKTREES_NAME: `${basename(primary)}.worktrees` });
    } else if ('where' in a && a.where !== '../' && a.where !== './') {
      requires.push(`- where: "../" | "./"${bad(a.where)}`);
      ask('q-where', { WORKTREES_NAME: `${basename(primary)}.worktrees` });
    }
    for (const k of ['branch_shape', 'hooks', 'root', 'drop'])
      if (k in a)
        requires.push(`- ${k}: not a key when adopting an existing workspace — drop it and re-run`);

    if (requires.length) {
      say('step1-missing', {
        PARTIAL: JSON.stringify(a),
        REQUIRE: requires.join('\n'),
        QUESTION_BLOCK: questions.length ? `<question>\n${questions.join('\n\n')}\n</question>\n` : '',
        STEP1: SELF,
      });
      process.exit(1);
    }

    const step2Answer = {
      path: ws,
      ...(adoptHookFiles.length ? { copy_hooks: a.copy_hooks } : {}),
      ...(adoptHasSettings ? {} : { where: a.where }),
    };
    say('step1-adopted', {
      WS: ws,
      STEP2_CMD: `node ${STEP2} --answer '${JSON.stringify(step2Answer)}'`,
    });
    return;
  }

  if ('copy_hooks' in a)
    requires.push('- copy_hooks: only for adopting an existing workspace — drop it and re-run');

  const shapeHint = `${shapes.map((t) => `"${t.name}"`).join(' | ')} | "custom"`;
  const hookHint = `pick from [${hookTpls.map((t) => `"${t.name}"`).join(', ')}], [] for none`;

  const shapeTpl = shapes.find((t) => t.name === a.branch_shape);
  const shapeKnown = a.branch_shape === 'custom' || Boolean(shapeTpl);
  if (!('branch_shape' in a) || !shapeKnown) {
    requires.push(`- branch_shape: ${shapeHint}${'branch_shape' in a ? bad(a.branch_shape) : ''}`);
    ask('q-branch-shape', { SHAPES: templateList('shapes') });
  }

  const hooksOk =
    Array.isArray(a.hooks) && a.hooks.every((h) => hookTpls.find((t) => t.name === h));
  if (!('hooks' in a) || !hooksOk) {
    requires.push(`- hooks: ${hookHint}${'hooks' in a ? bad(a.hooks) : ''}`);
    ask('q-hooks', { HOOKS: templateList('hooks') });
  }

  if (!('where' in a) || (a.where !== '../' && a.where !== './')) {
    requires.push(`- where: "../" | "./"${'where' in a ? bad(a.where) : ''}`);
    ask('q-where', { WORKTREES_NAME: `${basename(primary)}.worktrees` });
  }

  if (a.branch_shape === 'custom') {
    for (const k of ['root', 'drop'])
      if (k in a) requires.push(`- ${k}: not a key for the custom shape — drop it and re-run`);
  } else if (shapeTpl) {
    if (!detRoot && !('root' in a)) {
      requires.push('- root: "<root branch name>" — detection failed, so it is required');
      ask('q-root');
    }
    if ('root' in a && (typeof a.root !== 'string' || !a.root))
      requires.push(`- root: non-empty string${bad(a.root)}`);
    if ('drop' in a) {
      const text = readFileSync(join(shapeTpl.dir, 'rules'), 'utf8');
      const sections = [...text.matchAll(/^\[([^\]]+)\]\s*$/gm)].map((m) => m[1]);
      if (!Array.isArray(a.drop) || a.drop.some((d) => !sections.includes(d)))
        requires.push(`- drop: array of this template's section names (${sections.join(', ')})${bad(a.drop)}`);
    }
  }

  if (requires.length) {
    say('step1-missing', {
      PARTIAL: JSON.stringify(a),
      REQUIRE: requires.join('\n'),
      QUESTION_BLOCK: questions.length ? `<question>\n${questions.join('\n\n')}\n</question>\n` : '',
      STEP1: SELF,
    });
    process.exit(1);
  }

  // ---- 실행 (완전한 answer — 여기서만 파일시스템이 변한다) ----
  const steps = planStep1(
    { ws, shapeTpl, root: a.root, drop: a.drop, hooks: a.hooks, where: a.where },
    { detRoot, hookTpls, primary },
  );
  const actions = executeStep1(steps);

  const chosenCount = a.hooks.length;
  const before = [];
  if (a.branch_shape === 'custom')
    before.push(render('frag-before-custom', { WS: ws, VOCAB: join(SKILL_DIR, 'vocabulary.md') }).trimEnd());
  if (chosenCount)
    before.push(render('frag-before-hooks', { HOOK_PATH: join(ws, 'hooks', 'post-create') }).trimEnd());
  before.push(render('frag-before-review', { RULES: join(ws, 'rules') }).trimEnd());

  const step2Answer = { path: ws, ...(chosenCount ? { copy_hooks: true } : {}) };
  say('step1-done', {
    ACTIONS: actions.join('\n'),
    BEFORE_STEP2: before.join('\n'),
    STEP2_CMD: `node ${STEP2} --answer '${JSON.stringify(step2Answer)}'`,
  });
});

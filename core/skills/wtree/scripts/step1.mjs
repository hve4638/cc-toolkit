#!/usr/bin/env node
// /wtree 셋업 step 1 — 작업장 생성. `--answer` JSON 이 완성됐을 때만 한 동작
// (회전·생성·셰이프 반영·훅 병합·settings 기록)을 수행하고, 그 외 호출은 어떤
// 변화도 없이 현 상황과 채워야 할 키만 출력한다.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import {
  SCRIPTS_DIR,
  SKILL_DIR,
  fail,
  git,
  listTemplates,
  parseAnswer,
  render,
  run,
  say,
  sh,
  templateList,
} from './lib/setuplib.mjs';

const isFile = (p) => existsSync(p) && statSync(p).isFile();
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const SELF = join(SCRIPTS_DIR, 'step1.mjs');
const STEP2 = join(SCRIPTS_DIR, 'step2.mjs');
const ALLOWED = ['path', 'allow_overwrite', 'branch_shape', 'hooks', 'root', 'drop', 'where', 'copy_hooks'];

// rules 텍스트에서 섹션 하나를 제거하고, 다른 섹션의 children 참조도 지운다.
function dropSection(text, name) {
  let skip = false;
  const kept = text.split('\n').filter((line) => {
    const h = line.match(/^\[([^\]]+)\]\s*$/);
    if (h) skip = h[1] === name;
    return !skip;
  });
  const cleaned = kept
    .map((l) => {
      const m = l.match(/^(\s*children\s*=\s*)(.*)$/);
      if (!m) return l;
      const items = m[2].split(',').map((s) => s.trim()).filter((s) => s && s !== name);
      return items.length ? m[1] + items.join(', ') : null;
    })
    .filter((l) => l !== null);
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n');
}

// 훅 기능 여러 개를 post-create 하나로 병합한다. 기능마다 서브셸로 격리해
// 한 기능의 exit 0 가드가 다음 기능을 삼키지 않게 한다.
function mergeHooks(tpls) {
  if (tpls.length === 1) return readFileSync(join(tpls[0].dir, 'post-create'), 'utf8');
  const bodies = tpls.map((t) => {
    const b = readFileSync(join(t.dir, 'post-create'), 'utf8').replace(/^#!.*\n/, '');
    return `# === ${t.name} ===\n(\n${b.trimEnd()}\n)`;
  });
  return `#!/bin/sh\n# wtree post-create — merged by the /wtree setup (per-feature subshell isolation)\n\n${bodies.join('\n\n')}\n`;
}

run(() => {
  const badAnswer = (p) => fail('bad-answer', { PROBLEM: p, ALLOWED: ALLOWED.join(', ') });
  const a = parseAnswer(ALLOWED, badAnswer);

  // ---- 게이트 (수집형: 문제를 전부 모아 한 번에) ----
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
      alerts.push('This repo already carries a wtree policy, so there is nothing to set up. If the current policy is the question, `wtree info` is the starting point.');
    }
  }
  if (problems.length)
    fail('step1-blocked', {
      PROBLEMS: problems.join('\n'),
      ALERTS: alerts.map((s) => `- ${s}`).join('\n'),
    });

  // ---- 사실 수집 (읽기 전용) ----
  const toplevel = git(['rev-parse', '--show-toplevel']).stdout;
  const primary = dirname(common);
  const candidates = [...new Set([toplevel, primary])].map((r) => join(r, '.wtree'));
  const dotwtree = candidates.find((d) => isFile(join(d, 'rules')) || isFile(join(d, 'settings')));

  let detRoot = git(['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']).stdout.replace(
    /^refs\/remotes\/origin\//,
    '',
  );
  if (!detRoot)
    detRoot =
      ['main', 'master'].find(
        (c) => git(['show-ref', '--verify', '--quiet', `refs/heads/${c}`]).ok,
      ) || '';
  if (!detRoot) detRoot = git(['branch', '--show-current']).stdout;

  const shapes = listTemplates('shapes');
  const hookTpls = listTemplates('hooks');

  const dwHooksDir = dotwtree ? join(dotwtree, 'hooks') : '';
  const dwHookFiles =
    dotwtree && isDir(dwHooksDir)
      ? readdirSync(dwHooksDir).filter((f) => isFile(join(dwHooksDir, f)))
      : [];
  const dwContents = dotwtree
    ? [
        isFile(join(dotwtree, 'rules')) ? 'rules' : null,
        isFile(join(dotwtree, 'settings')) ? 'settings' : null,
        dwHookFiles.length ? `hooks: ${dwHookFiles.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const facts = render('frag-facts', {
    WTREE_VERSION: ver.stdout,
    PRIMARY: primary,
    COMMON: common,
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
  const actions = [];
  if (existsSync(ws)) {
    const old = ws + '.old';
    if (existsSync(old)) {
      rmSync(old, { recursive: true });
      actions.push(`- deleted: ${old}/ (previous backup)`);
    }
    renameSync(ws, old);
    actions.push(`- moved: ${ws}/ -> ${old}/`);
  }
  mkdirSync(ws, { recursive: true });
  actions.push(`- created: ${ws}/`);

  if (shapeTpl) {
    let text = readFileSync(join(shapeTpl.dir, 'rules'), 'utf8');
    const tplRoot = text.match(/^\[([^\]]+)\]/m)[1];
    const effRoot = a.root || detRoot;
    if (effRoot !== tplRoot) {
      text = text.replace(`[${tplRoot}]`, `[${effRoot}]`);
      actions.push(`- applied: root branch ${tplRoot} -> ${effRoot}`);
    }
    for (const d of a.drop || []) {
      text = dropSection(text, d);
      actions.push(`- applied: dropped section ${d} and its references`);
    }
    writeFileSync(join(ws, 'rules'), text);
    actions.push(`- created: ${join(ws, 'rules')} (from templates/shapes/${shapeTpl.name})`);
  }

  const chosen = a.hooks.map((h) => hookTpls.find((t) => t.name === h));
  if (chosen.length) {
    mkdirSync(join(ws, 'hooks'));
    writeFileSync(join(ws, 'hooks', 'post-create'), mergeHooks(chosen));
    actions.push(
      `- created: ${join(ws, 'hooks', 'post-create')} (${chosen.map((t) => t.name).join(' + ')}${chosen.length > 1 ? ' merged' : ''})`,
    );
  }

  writeFileSync(
    join(ws, 'settings'),
    `# wtree machine-local settings — written by the /wtree setup\nworktree-dir = ${a.where}${basename(primary)}.worktrees\n`,
  );
  actions.push(`- created: ${join(ws, 'settings')} (worktree-dir = ${a.where}${basename(primary)}.worktrees)`);

  const before = [];
  if (a.branch_shape === 'custom')
    before.push(render('frag-before-custom', { WS: ws, VOCAB: join(SKILL_DIR, 'vocabulary.md') }).trimEnd());
  if (chosen.length)
    before.push(render('frag-before-hooks', { HOOK_PATH: join(ws, 'hooks', 'post-create') }).trimEnd());
  before.push(render('frag-before-review', { RULES: join(ws, 'rules') }).trimEnd());

  const step2Answer = { path: ws, ...(chosen.length ? { copy_hooks: true } : {}) };
  say('step1-done', {
    ACTIONS: actions.join('\n'),
    BEFORE_STEP2: before.join('\n'),
    STEP2_CMD: `node ${STEP2} --answer '${JSON.stringify(step2Answer)}'`,
  });
});

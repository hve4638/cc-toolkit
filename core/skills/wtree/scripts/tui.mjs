#!/usr/bin/env node
// /wtree 셋업 TUI — useterminal pane 에서 사용자가 직접 답하는 인라인 프롬프트
// (npm init 류: 흐르는 출력 + 방향키 선택). 결정적 동작은 step1/step2 와 같은
// lib/actions.mjs 를 쓰고, 에이전트와는 handoff 파일 하나로만 대화한다 —
// exec pane 은 종료 즉시 사라져 stdout 이 에이전트에게 돌아가지 않아서다.
//
// 두 국면: 무동사(collect)는 질문 수집과 작업장 생성까지 하고, 개입 구간
// (rules 검토·custom rules·훅 판정)이 오면 handoff 를 쓰고 끝난다. apply 는
// 에이전트 검토 뒤 두 번째 pane 으로 뜨며, 훅 더블 체크와 최종 확정을 받아
// 정책을 적용한다. handoff 내용은 폼 스크립트의 출력 페이지와 같은 태그
// 블록이라 에이전트 대면 프로토콜이 두 모드에서 갈라지지 않는다.
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import {
  collectFacts,
  executeStep1,
  executeStep2,
  hookOptionsOf,
  isDir,
  isFile,
  planStep1,
  runGates,
  worktreeDirOf,
} from './lib/actions.mjs';
import { input, multiselect, onCancel, paint, pause, select } from './lib/prompt.mjs';
import { SCRIPTS_DIR, SKILL_DIR, render, setKo } from './lib/setuplib.mjs';

const SELF = join(SCRIPTS_DIR, 'tui.mjs');
const STEP1 = join(SCRIPTS_DIR, 'step1.mjs');

// ---- 화면 문구 --------------------------------------------------------------
// 에이전트 대면 산문은 messages/ 페이지에 있지만, 이 표는 프롬프트에 끼워
// 넣는 화면 조각(커서·색과 함께 그려지는)이라 페이지가 되지 못한다.
const L = {
  en: {
    title: 'wtree policy setup',
    applyTitle: 'wtree policy setup — apply',
    rootLabel: 'root branch',
    rootUnknown: 'detection failed',
    sharedLabel: 'shared .wtree/',
    sharedNone: 'none',
    foundExisting: (d, c) => `This repo already carries a policy: ${d} (${c})`,
    qDisposal: 'existing policy — what to do with it?',
    dAdopt: 'adopt',
    dAdoptNote: 'use it as-is',
    dRebuild: 'rebuild',
    dRebuildNote: 'push it to .old and compose anew',
    dKeep: 'keep',
    dKeepNote: 'leave it untouched, build elsewhere',
    dRepath: 'different path',
    qPath: 'workspace path — the policy is composed here first:',
    pathNotWorkspace: (p) => `${p} already exists and is not a policy workspace — pick a fresh path.`,
    qPathWorkspace: (p) => `${p} is already a policy workspace — what to do with it?`,
    qShape: 'branch shape',
    customNote: 'compose the rules from scratch (with the agent, after this pane)',
    qHooks: 'post-create hooks',
    multiHint: '(enter/space toggles an item)',
    multiSubmit: 'submit selection',
    inputRequired: 'a value is required — Esc cancels the setup',
    qWhere: 'where do worktrees live?',
    whereBeside: (n) => `beside the repo — ../${n}`,
    whereInside: (n) => `inside the repo — ./${n}`,
    qRoot: 'root branch name (detection failed):',
    planTitle: 'about to do this:',
    planDeleteOld: (p) => `delete ${p}/ (previous backup)`,
    planRotate: (a, b) => `move ${a}/ -> ${b}/`,
    planCreate: (p) => `create ${p}/`,
    planRules: (tpl, from, to) => `write rules from templates/shapes/${tpl}${from !== to ? ` (root ${from} -> ${to})` : ''}`,
    planHooks: (names) => `write hooks/post-create (${names})`,
    planSettings: (v) => `write settings (worktree-dir = ${v})`,
    planSettingsKeep: 'keep the existing settings',
    planLoad: (ws) => `apply the policy: wtree init --load ${ws}`,
    planCopyHooks: (n) => `copy ${n} hook file(s) into the repo policy`,
    planSkipHooks: 'hooks: not copied',
    planClaude: (p) => `place CLAUDE.md in ${p}/`,
    qConfirm: 'proceed?',
    cApply: 'apply',
    cCancel: 'cancel',
    doneCreate: 'workspace created:',
    adoptNote: (ws) => `adopting ${ws} as-is — nothing will be created or modified in this pane.`,
    hookWarnTitle: 'CAUTION — hooks are executable code',
    hookWarnBody: (files) => [
      'A post-create hook runs as shell code on every worktree creation.',
      `File(s): ${files.join(', ')}`,
      'Copy them into the repo policy only if you trust what they do.',
    ],
    hookVerdictLine: (v) => `agent review verdict: ${v}`,
    hookVerdictYes: 'copy (--hooks yes)',
    hookVerdictNo: 'do not copy (--hooks no)',
    hookComposedNote: 'these hooks were assembled from your answers in the setup pane.',
    qHookCopy: 'copy the hooks into the repo policy?',
    hookNo: 'no — leave them out',
    hookYes: 'yes — copy them',
    applyDone: 'policy applied.',
    applyFailed: 'apply failed — nothing was applied:',
    blockedTitle: 'setup cannot proceed:',
    cancelledNote: 'cancelled — nothing was changed in this run.',
    doneCollectNote: 'Done here. Tell the agent this pane is finished — the review continues in the conversation.',
    doneAdoptNote: 'Done here. Tell the agent this pane is finished — the review continues in the conversation.',
    doneApplyNote: 'All applied. Tell the agent this pane is finished.',
    pressKey: 'press any key to close this pane',
    needTty: 'wtree TUI needs a terminal — fall back to the step scripts (step1.mjs)\n',
  },
  ko: {
    title: 'wtree 정책 셋업',
    applyTitle: 'wtree 정책 셋업 — 적용',
    rootLabel: '루트 브랜치',
    rootUnknown: '감지 실패',
    sharedLabel: '공유 .wtree/',
    sharedNone: '없음',
    foundExisting: (d, c) => `이 repo 에는 이미 정책이 있다: ${d} (${c})`,
    qDisposal: '기존 정책을 어떻게 할까?',
    dAdopt: '채택',
    dAdoptNote: '그대로 쓴다',
    dRebuild: '재구성',
    dRebuildNote: '.old 로 밀어두고 새로 짠다',
    dKeep: '보존',
    dKeepNote: '건드리지 않고 다른 곳에 짠다',
    dRepath: '다른 경로',
    qPath: '작업장 경로 — 정책은 먼저 여기서 조립된다:',
    pathNotWorkspace: (p) => `${p} 는 이미 있고 정책 작업장이 아니다 — 새 경로를 골라달라.`,
    qPathWorkspace: (p) => `${p} 는 이미 정책 작업장이다 — 어떻게 할까?`,
    qShape: '브랜치 셰이프',
    customNote: 'rules 를 처음부터 짠다 (이 pane 이후 에이전트와 함께)',
    qHooks: 'post-create 훅',
    multiHint: '(enter/space 로 항목을 켜고 끈다)',
    multiSubmit: '선택 확정',
    inputRequired: '값이 필요하다 — 취소는 Esc',
    qWhere: '워크트리를 어디에 둘까?',
    whereBeside: (n) => `repo 옆 — ../${n}`,
    whereInside: (n) => `repo 안 — ./${n}`,
    qRoot: '루트 브랜치 이름 (감지 실패):',
    planTitle: '이제 이렇게 한다:',
    planDeleteOld: (p) => `${p}/ 삭제 (이전 백업)`,
    planRotate: (a, b) => `${a}/ 를 ${b}/ 로 이동`,
    planCreate: (p) => `${p}/ 생성`,
    planRules: (tpl, from, to) => `templates/shapes/${tpl} 로 rules 작성${from !== to ? ` (루트 ${from} -> ${to})` : ''}`,
    planHooks: (names) => `hooks/post-create 작성 (${names})`,
    planSettings: (v) => `settings 작성 (worktree-dir = ${v})`,
    planSettingsKeep: '기존 settings 유지',
    planLoad: (ws) => `정책 적용: wtree init --load ${ws}`,
    planCopyHooks: (n) => `훅 파일 ${n}개를 repo 정책으로 복사`,
    planSkipHooks: '훅: 복사하지 않음',
    planClaude: (p) => `${p}/ 에 CLAUDE.md 배치`,
    qConfirm: '진행할까?',
    cApply: '적용',
    cCancel: '취소',
    doneCreate: '작업장을 만들었다:',
    adoptNote: (ws) => `${ws} 를 그대로 채택한다 — 이 pane 에서는 아무것도 만들거나 고치지 않는다.`,
    hookWarnTitle: '주의 — 훅은 실행 코드다',
    hookWarnBody: (files) => [
      'post-create 훅은 워크트리를 만들 때마다 셸 코드로 실행된다.',
      `파일: ${files.join(', ')}`,
      '무엇을 하는지 신뢰할 수 있을 때만 repo 정책으로 복사한다.',
    ],
    hookVerdictLine: (v) => `에이전트 검토 판정: ${v}`,
    hookVerdictYes: '복사 (--hooks yes)',
    hookVerdictNo: '복사 안 함 (--hooks no)',
    hookComposedNote: '이 훅은 셋업 pane 에서 사용자의 답으로 조립됐다.',
    qHookCopy: '훅을 repo 정책으로 복사할까?',
    hookNo: '아니오 — 빼고 간다',
    hookYes: '예 — 복사한다',
    applyDone: '정책을 적용했다.',
    applyFailed: '적용 실패 — 아무것도 반영되지 않았다:',
    blockedTitle: '셋업을 진행할 수 없다:',
    cancelledNote: '취소됨 — 이번 실행에서 바뀐 것은 없다.',
    doneCollectNote: '여기서는 끝. 에이전트에게 이 pane 이 끝났다고 알려달라 — 검토는 대화에서 이어진다.',
    doneAdoptNote: '여기서는 끝. 에이전트에게 이 pane 이 끝났다고 알려달라 — 검토는 대화에서 이어진다.',
    doneApplyNote: '전부 적용됐다. 에이전트에게 이 pane 이 끝났다고 알려달라.',
    pressKey: '아무 키나 누르면 이 pane 이 닫힌다',
    needTty: 'wtree TUI 는 터미널이 필요하다 — step 스크립트(step1.mjs)로 폴백하라\n',
  },
};

// ---- 인자 -------------------------------------------------------------------
function usage() {
  process.stderr.write(
    'usage: tui.mjs [--ko]\n' +
      '       tui.mjs apply --path <workspace> [--hooks yes|no|composed] [--where ../|./] [--ko]\n',
  );
  process.exit(2);
}

const argv = process.argv.slice(2);
let ko = false;
let phase = 'collect';
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const value = () => {
    const v = argv[++i];
    if (v === undefined || v.startsWith('--')) usage();
    return v;
  };
  if (a === '--ko') ko = true;
  else if (a === 'apply' && phase === 'collect') phase = 'apply';
  else if (a === '--path') opts.path = value();
  else if (a === '--hooks') opts.hooks = value();
  else if (a === '--where') opts.where = value();
  else usage();
}
if (phase === 'apply' && !opts.path) usage();
if (phase === 'collect' && ('path' in opts || 'hooks' in opts || 'where' in opts)) usage();
// composed 는 collect pane 이 넘긴다 — 훅이 사용자 답으로 조립됐다는 표식으로,
// 에이전트 판정(yes|no)과 구분해 apply 의 더블 체크 초기값을 정한다.
if ('hooks' in opts && !['yes', 'no', 'composed'].includes(opts.hooks)) usage();
if ('where' in opts && opts.where !== '../' && opts.where !== './') usage();
setKo(ko);
const lang = ko ? 'ko' : 'en';
const t = L[lang];

// ---- handoff ----------------------------------------------------------------
let handoffPath = null;
const writeHandoff = (body) => {
  if (handoffPath) writeFileSync(handoffPath, body);
};
const println = (s = '') => process.stdout.write(s + '\n');
const interactive = process.stdin.isTTY && process.stdout.isTTY;

async function closePane(code) {
  // 결과 페이지는 이미 확정됐다 — 닫기 대기 중의 Ctrl-C 가 취소 훅으로
  // 성공 handoff 를 "취소됨"으로 덮어쓰면 안 된다.
  onCancel(null);
  if (interactive) await pause(t.pressKey);
  process.exit(code);
}

async function cancelled() {
  writeHandoff(render('tui-cancelled', { STEP1 }));
  println('');
  println(paint.yellow(t.cancelledNote));
  await closePane(1);
}

// ---- 국면 -------------------------------------------------------------------
function banner(gate, facts, title) {
  println(paint.bold(title));
  println(paint.dim(`  repo: ${facts.primary}`));
  println(paint.dim(`  wtree: ${gate.ver.stdout}`));
  println(paint.dim(`  ${t.rootLabel}: ${facts.detRoot || t.rootUnknown}`));
  println('');
}

async function askWhere(facts) {
  const wn = `${basename(facts.primary)}.worktrees`;
  const wi = await select({
    message: t.qWhere,
    items: [
      { label: '../', note: t.whereBeside(wn) },
      { label: './', note: t.whereInside(wn) },
    ],
  });
  return wi === null ? null : wi === 0 ? '../' : './';
}

// 새 작업장 경로를 받는다. 반환: 경로 문자열(없는 경로 또는 재구성할 기존
// 작업장) | { adopt: 경로 }(기존 작업장을 채택) | null(취소).
async function askFreshPath(def) {
  for (;;) {
    const v = await input({ message: t.qPath, def });
    if (v === null) return null;
    const ws = resolve(v);
    if (!existsSync(ws)) return ws;
    if (isFile(join(ws, 'rules')) || isFile(join(ws, 'settings'))) {
      const d = await select({
        message: t.qPathWorkspace(ws),
        items: [
          { label: t.dAdopt, note: t.dAdoptNote },
          { label: t.dRebuild, note: t.dRebuildNote },
          { label: t.dRepath },
        ],
      });
      if (d === null) return null;
      if (d === 0) return { adopt: ws };
      if (d === 1) return ws;
      continue;
    }
    println(paint.red(t.pathNotWorkspace(ws)));
  }
}

const verdictArg = ' --hooks <yes|no — your verdict from the hook review>';
const koArg = () => (ko ? ' --ko' : '');

async function collectPhase(gate, facts) {
  banner(gate, facts, t.title);

  let ws = null;
  if (facts.dotwtree) {
    println(t.foundExisting(facts.dotwtree, facts.dwContents));
    println('');
    const d = await select({
      message: t.qDisposal,
      items: [
        { label: t.dAdopt, note: t.dAdoptNote },
        { label: t.dRebuild, note: t.dRebuildNote },
        { label: t.dKeep, note: t.dKeepNote },
      ],
    });
    if (d === null) return cancelled();
    if (d === 0) return adoptFlow(facts, facts.dotwtree);
    if (d === 1) ws = facts.dotwtree;
    else {
      const p = await askFreshPath('/tmp/wtree-setup');
      if (p === null) return cancelled();
      if (typeof p === 'object') return adoptFlow(facts, p.adopt);
      ws = p;
    }
  } else {
    const p = await askFreshPath('.wtree');
    if (p === null) return cancelled();
    if (typeof p === 'object') return adoptFlow(facts, p.adopt);
    ws = p;
  }

  const shapeItems = facts.shapes
    .map((tp) => ({ label: tp.name, note: tp.summary }))
    .concat([{ label: 'custom', note: t.customNote }]);
  const si = await select({ message: t.qShape, items: shapeItems });
  if (si === null) return cancelled();
  const shapeTpl = si < facts.shapes.length ? facts.shapes[si] : null;

  let hooks = [];
  const hookAnswers = {};
  if (facts.hookTpls.length) {
    const hi = await multiselect({
      message: t.qHooks,
      items: facts.hookTpls.map((tp) => ({ label: tp.name, note: tp.summary })),
      hint: t.multiHint,
      submitLabel: t.multiSubmit,
    });
    if (hi === null) return cancelled();
    hooks = hi.map((i) => facts.hookTpls[i].name);
    // 고른 훅마다 options.json 의 조정 지점을 그 자리에서 묻는다 — 조립은
    // renderHook 이 하고, 여기서는 답만 모은다.
    for (const i of hi) {
      const tp = facts.hookTpls[i];
      const ans = {};
      for (const o of hookOptionsOf(tp)) {
        const msg = `${tp.name} · ${o.label[lang]}`;
        if (o.type === 'select') {
          const ci = await select({
            message: msg,
            items: o.cases.map((c) => ({ label: c.label[lang], note: c.note ? c.note[lang] : '' })),
          });
          if (ci === null) return cancelled();
          const c = o.cases[ci];
          if (c.input) {
            let v = '';
            for (;;) {
              v = await input({ message: `${tp.name} · ${c.input[lang]}` });
              if (v === null) return cancelled();
              if (v) break;
              println(paint.red(t.inputRequired));
            }
            ans[o.key] = { id: c.id, value: v };
          } else ans[o.key] = c.id;
        } else {
          const v = await input({ message: msg, def: o.default ?? '' });
          if (v === null) return cancelled();
          ans[o.key] = v;
        }
      }
      hookAnswers[tp.name] = ans;
    }
  }

  const where = await askWhere(facts);
  if (where === null) return cancelled();

  let root;
  if (shapeTpl && !facts.detRoot)
    while (!root) {
      root = await input({ message: t.qRoot });
      if (root === null) return cancelled();
    }

  // ---- 확정 화면: 계획을 보여주고 나서야 파일시스템이 변한다 ----
  const steps = planStep1(
    { ws, shapeTpl, root, hooks, hookAnswers, where },
    { detRoot: facts.detRoot, hookTpls: facts.hookTpls, primary: facts.primary },
  );
  println('');
  println(paint.bold(t.planTitle));
  for (const s of steps) {
    const line =
      s.kind === 'delete-old' ? t.planDeleteOld(s.old)
      : s.kind === 'rotate' ? t.planRotate(s.ws, s.old)
      : s.kind === 'create' ? t.planCreate(s.ws)
      : s.kind === 'rules' ? t.planRules(s.tpl.name, s.tplRoot, s.effRoot)
      : s.kind === 'hooks' ? t.planHooks(s.chosen.map((x) => x.name).join(' + '))
      : t.planSettings(`${s.where}${basename(s.primary)}.worktrees`);
    println(`  - ${line}`);
  }
  println('');
  // 계획을 읽기 전에 도착해 있던 Enter 가 그대로 확정이 되지 않게 잠깐 키를 버린다
  const c = await select({ message: t.qConfirm, items: [{ label: t.cApply }, { label: t.cCancel }], delayMs: 400 });
  if (c === null || c === 1) return cancelled();

  const actions = executeStep1(steps);
  println('');
  println(`${paint.green('✔')} ${t.doneCreate}`);
  for (const a of actions) println(paint.dim(`  ${a}`));

  // 훅은 pane 에서 사용자 답으로 조립이 끝났다 — 에이전트 몫의 훅 검토·판정은
  // 없고, apply pane 의 복사 더블 체크만 남는다.
  const before = [];
  if (!shapeTpl)
    before.push(render('frag-before-custom', { WS: ws, VOCAB: join(SKILL_DIR, 'vocabulary.md') }).trimEnd());
  before.push(render('frag-before-review', { RULES: join(ws, 'rules') }).trimEnd());

  const args = (hooks.length ? ' --hooks composed' : '') + koArg();
  const next = render('frag-tui-next', { TUI: SELF, WS: ws, ARGS: args, HANDOFF: handoffPath }).trimEnd();
  writeHandoff(render('tui-done', { ACTIONS: actions.join('\n'), BEFORE: before.join('\n'), NEXT: next }));

  println('');
  println(t.doneCollectNote);
  await closePane(0);
}

async function adoptFlow(facts, ws) {
  const hooksDir = join(ws, 'hooks');
  const hookFiles = isDir(hooksDir)
    ? readdirSync(hooksDir).sort().filter((f) => isFile(join(hooksDir, f)))
    : [];
  const hasSettings = isFile(join(ws, 'settings'));

  println('');
  println(t.adoptNote(ws));
  println('');

  let where = null;
  if (!hasSettings) {
    where = await askWhere(facts);
    if (where === null) return cancelled();
  }

  const before = [render('frag-before-review', { RULES: join(ws, 'rules') }).trimEnd()];
  if (hookFiles.length) before.push(render('frag-tui-hooks', {}).trimEnd());
  const alertBlock = hookFiles.length
    ? render('frag-tui-hook-alert', { HOOK_FILES: hookFiles.map((f) => join(hooksDir, f)).join(' ') })
    : '';
  const args = (hookFiles.length ? verdictArg : '') + (where ? ` --where ${where}` : '') + koArg();
  const next = render('frag-tui-next', { TUI: SELF, WS: ws, ARGS: args, HANDOFF: handoffPath }).trimEnd();
  writeHandoff(render('tui-adopted', { WS: ws, BEFORE: before.join('\n'), ALERT_BLOCK: alertBlock, NEXT: next }));

  println(t.doneAdoptNote);
  await closePane(0);
}

async function applyPhase(gate, facts) {
  const ws = resolve(opts.path);
  const bad = async (problem) => {
    writeHandoff(render('step2-bad', { PROBLEM: problem }));
    println(paint.red(`${t.applyFailed}`));
    println(paint.red(`  ${problem}`));
    await closePane(1);
  };
  if (!existsSync(ws)) return bad(`${ws} does not exist — with no workspace, start from step 1`);
  if (!isDir(ws)) return bad(`${ws} is not a directory`);
  if (!isFile(join(ws, 'rules'))) return bad(`${ws}/rules is missing — a custom shape needs its rules written`);

  banner(gate, facts, t.applyTitle);
  println(paint.dim(`  workspace: ${ws}`));
  println('');

  const wsHooks = join(ws, 'hooks');
  const hookFiles = isDir(wsHooks)
    ? readdirSync(wsHooks).sort().filter((f) => isFile(join(wsHooks, f)))
    : [];
  const hasSettings = isFile(join(ws, 'settings'));

  let where = opts.where ?? null;
  if (!hasSettings && !where) {
    where = await askWhere(facts);
    if (where === null) return cancelled();
  }

  let copyHooks = false;
  if (hookFiles.length) {
    println(paint.redBold(t.hookWarnTitle));
    for (const line of t.hookWarnBody(hookFiles.map((f) => join(wsHooks, f)))) println(paint.red(`  ${line}`));
    if (opts.hooks === 'composed') println(`  ${t.hookComposedNote}`);
    else if (opts.hooks)
      println(`  ${t.hookVerdictLine(opts.hooks === 'yes' ? t.hookVerdictYes : t.hookVerdictNo)}`);
    println('');
    // 경고를 읽기 전의 반사적 Enter 를 막는 0.5초 — 그 사이의 키는 버려진다.
    // 초기값이 "복사"로 시작하는 것은 사용자 본인이 pane 에서 조립한 훅뿐이다 —
    // adopt 경로의 에이전트 판정(yes)은 이 더블 체크가 견제하는 대상이라 안 미리 고른다.
    const hi = await select({
      message: t.qHookCopy,
      items: [{ label: t.hookNo }, { label: t.hookYes }],
      initial: opts.hooks === 'composed' ? 1 : 0,
      danger: true,
      delayMs: 500,
    });
    if (hi === null) return cancelled();
    copyHooks = hi === 1;
    println('');
  }

  const wtDir = hasSettings
    ? worktreeDirOf(join(ws, 'settings'), facts.primary)
    : resolve(facts.primary, `${where}${basename(facts.primary)}.worktrees`);
  println(paint.bold(t.planTitle));
  if (!hasSettings) println(`  - ${t.planSettings(`${where}${basename(facts.primary)}.worktrees`)}`);
  else println(`  - ${t.planSettingsKeep}`);
  println(`  - ${t.planLoad(ws)}`);
  if (hookFiles.length) println(`  - ${copyHooks ? t.planCopyHooks(hookFiles.length) : t.planSkipHooks}`);
  println(`  - ${t.planClaude(wtDir)}`);
  println('');
  // 계획을 읽기 전에 도착해 있던 Enter 가 그대로 확정이 되지 않게 잠깐 키를 버린다
  const c = await select({ message: t.qConfirm, items: [{ label: t.cApply }, { label: t.cCancel }], delayMs: 400 });
  if (c === null || c === 1) return cancelled();

  const result = executeStep2(
    { ws, copyHooks, where: where ?? undefined, whereProvided: Boolean(where) },
    { primary: facts.primary, toplevel: facts.toplevel },
  );
  if (!result.ok) {
    writeHandoff(render(result.page, result.values));
    println('');
    println(paint.red(t.applyFailed));
    for (const [k, v] of Object.entries(result.values)) println(paint.red(`  ${k}: ${v}`));
    await closePane(1);
    return;
  }

  writeHandoff(render('step2-done', { ACTIONS: result.actions.join('\n'), WTREE_OUTPUT: result.wtreeOutput }));
  println('');
  println(`${paint.green('✔')} ${t.applyDone}`);
  for (const a of result.actions) println(paint.dim(`  ${a}`));
  println('');
  println(t.doneApplyNote);
  await closePane(0);
}

// ---- 진입 -------------------------------------------------------------------
async function main() {
  const gate = runGates(
    phase === 'apply'
      ? 'This repo already carries a wtree policy. Either the apply already succeeded or the repo came configured — check the current policy with `wtree info`.'
      : 'This repo already carries a wtree policy, so there is nothing to set up. If the current policy is the question, `wtree info` is the starting point.',
  );
  if (gate.common) handoffPath = join(gate.common, 'wtree-setup-handoff.md');

  // 시작 즉시 "결과 미기록" 페이지를 깔아 둔다 — SIGKILL·pane 강제 종료·훅
  // 없는 경로로 죽어도 에이전트가 이전 실행의 낡은 페이지를 현재 결과로
  // 오독하지 않는다. 아래의 모든 결말이 이 페이지를 덮어쓴다.
  writeHandoff(render('tui-started', { STEP1 }));

  if (gate.problems.length) {
    writeHandoff(
      render(phase === 'apply' ? 'step2-blocked' : 'step1-blocked', {
        PROBLEMS: gate.problems.join('\n'),
        ALERTS: gate.alerts.map((s) => `- ${s}`).join('\n'),
      }),
    );
    println(paint.red(t.blockedTitle));
    for (const p of gate.problems) println(paint.red(`  - ${p}`));
    await closePane(1);
    return;
  }

  if (!interactive) {
    process.stderr.write(t.needTty);
    process.exit(1);
  }

  onCancel(() => writeHandoff(render('tui-cancelled', { STEP1 })));
  const facts = collectFacts(gate.common);
  if (phase === 'apply') await applyPhase(gate, facts);
  else await collectPhase(gate, facts);
}

main().catch(async (e) => {
  writeHandoff(render('tui-failed', { DETAIL: e && e.stack ? e.stack : String(e), STEP1 }));
  process.stdout.write(`\n${paint.red(String(e && e.stack ? e.stack : e))}\n`);
  await closePane(2);
});

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
    foundExisting: (d, c) => `existing policy found: ${d} (${c})`,
    qDisposal: 'existing policy',
    dAdopt: 'adopt',
    dAdoptNote: 'use as-is',
    dRebuild: 'rebuild',
    dRebuildNote: 'back up to .old, compose anew',
    dRepath: 'different path',
    qPath: 'workspace path (where the policy is composed):',
    pathNotWorkspace: (p) => `unusable path: ${p} — exists and is not a policy workspace`,
    qPathWorkspace: (p) => `existing policy workspace: ${p}`,
    qShape: 'branch shape',
    customNote: 'write the rules by hand (with the agent, after this pane)',
    qHooks: 'wtree hooks',
    multiHint: '(enter/space: toggle)',
    multiSubmit: 'submit selection',
    inputRequired: 'value required — Esc cancels the setup',
    qWtdir: 'worktree folder (relative to the repo root, or absolute):',
    qRoot: 'root branch (detection failed):',
    planTitle: 'plan:',
    planDeleteOld: (p) => `delete ${p}/ (previous backup)`,
    planRotate: (a, b) => `move ${a}/ -> ${b}/`,
    planCreate: (p) => `create ${p}/`,
    planRules: (tpl, from, to) => `write rules from templates/shapes/${tpl}${from !== to ? ` (root ${from} -> ${to})` : ''}`,
    planHooks: (kinds, names) => `write hooks/ ${kinds} (${names})`,
    planSettings: (v) => `write settings (worktree-dir = ${v})`,
    planSettingsKeep: 'keep the existing settings',
    planLoad: (ws) => `apply the policy: wtree init --load ${ws}`,
    planCopyHooks: (n) => `copy ${n} hook file(s) into the repo policy`,
    planSkipHooks: 'hooks: not copied',
    planClaude: (p) => `place CLAUDE.md in ${p}/`,
    qConfirm: 'proceed',
    cApply: 'apply',
    cCancel: 'cancel',
    doneCreate: 'workspace created:',
    adoptNote: (ws) => `adopt: ${ws} — applying in this pane`,
    hookWarnTitle: 'CAUTION: hooks are executable code',
    hookWarnBody: (files) => [
      'a hook runs as shell code on wtree verbs (worktree create/merge/destroy)',
      `file(s): ${files.join(', ')}`,
      'copy only if you trust what they do',
    ],
    hookComposedNote: 'hooks assembled from the answers in this setup',
    qHookCopy: 'copy hooks into the repo policy',
    hookNo: 'do not copy',
    hookYes: 'copy',
    applyDone: 'policy applied',
    applyFailed: 'apply failed — nothing changed:',
    blockedTitle: 'setup blocked:',
    cancelledNote: 'cancelled — nothing changed',
    doneCollectNote: 'pane done — tell the agent; the review continues in the conversation',
    doneApplyNote: 'applied — tell the agent to wrap up',
    pressKey: 'any key: close pane',
    needTty: 'wtree TUI needs a terminal — use the step scripts (step1.mjs)\n',
  },
  ko: {
    title: 'wtree 정책 셋업',
    applyTitle: 'wtree 정책 셋업 — 적용',
    rootLabel: '루트 브랜치',
    rootUnknown: '감지 실패',
    sharedLabel: '공유 .wtree/',
    sharedNone: '없음',
    foundExisting: (d, c) => `기존 정책 발견: ${d} (${c})`,
    qDisposal: '기존 정책 처리',
    dAdopt: '채택',
    dAdoptNote: '그대로 사용',
    dRebuild: '재구성',
    dRebuildNote: '.old 로 백업 후 새로 구성',
    dRepath: '다른 경로',
    qPath: '작업장 경로 (정책 조립 위치):',
    pathNotWorkspace: (p) => `사용 불가 경로: ${p} — 이미 존재하며 정책 작업장이 아님`,
    qPathWorkspace: (p) => `기존 정책 작업장: ${p}`,
    qShape: '브랜치 셰이프',
    customNote: 'rules 직접 작성 (pane 종료 후 에이전트와 진행)',
    qHooks: 'wtree 훅',
    multiHint: '(enter/space: 토글)',
    multiSubmit: '선택 완료',
    inputRequired: '값 필요 — Esc 는 셋업 취소',
    qWtdir: '워크트리 폴더 (repo 루트 기준 상대 또는 절대):',
    qRoot: '루트 브랜치 (감지 실패):',
    planTitle: '실행 계획:',
    planDeleteOld: (p) => `${p}/ 삭제 (이전 백업)`,
    planRotate: (a, b) => `${a}/ 를 ${b}/ 로 이동`,
    planCreate: (p) => `${p}/ 생성`,
    planRules: (tpl, from, to) => `templates/shapes/${tpl} 로 rules 작성${from !== to ? ` (루트 ${from} -> ${to})` : ''}`,
    planHooks: (kinds, names) => `hooks/ ${kinds} 작성 (${names})`,
    planSettings: (v) => `settings 작성 (worktree-dir = ${v})`,
    planSettingsKeep: '기존 settings 유지',
    planLoad: (ws) => `정책 적용: wtree init --load ${ws}`,
    planCopyHooks: (n) => `훅 파일 ${n}개를 repo 정책으로 복사`,
    planSkipHooks: '훅: 복사하지 않음',
    planClaude: (p) => `${p}/ 에 CLAUDE.md 배치`,
    qConfirm: '진행',
    cApply: '적용',
    cCancel: '취소',
    doneCreate: '작업장 생성 완료:',
    adoptNote: (ws) => `채택: ${ws} — 이 pane 에서 바로 적용`,
    hookWarnTitle: '주의: 훅은 실행 코드',
    hookWarnBody: (files) => [
      '훅은 wtree 동사(워크트리 생성/병합/삭제) 때 셸로 실행됨',
      `파일: ${files.join(', ')}`,
      '내용을 신뢰할 수 있을 때만 복사',
    ],
    hookComposedNote: '이 셋업의 답변으로 조립된 훅',
    qHookCopy: '훅을 repo 정책으로 복사',
    hookNo: '복사 안 함',
    hookYes: '복사',
    applyDone: '정책 적용 완료',
    applyFailed: '적용 실패 — 변경 없음:',
    blockedTitle: '셋업 불가:',
    cancelledNote: '취소됨 — 변경 없음',
    doneCollectNote: 'pane 작업 완료 — 에이전트에게 알리면 검토가 대화에서 이어짐',
    doneApplyNote: '적용 완료 — 에이전트에게 알리면 셋업이 마무리됨',
    pressKey: '아무 키: pane 닫기',
    needTty: 'wtree TUI: 터미널 필요 — step 스크립트(step1.mjs) 사용\n',
  },
};

// ---- 인자 -------------------------------------------------------------------
function usage() {
  process.stderr.write(
    'usage: tui.mjs [--ko]\n' +
      '       tui.mjs apply --path <workspace> [--hooks composed] [--ko]\n',
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
  else usage();
}
if (phase === 'apply' && !opts.path) usage();
if (phase === 'collect' && ('path' in opts || 'hooks' in opts)) usage();
// composed 는 collect pane 이 넘긴다 — 훅이 사용자 답으로 조립됐다는 표식으로,
// apply 의 복사 더블 체크가 '복사'에서 시작한다.
if ('hooks' in opts && opts.hooks !== 'composed') usage();
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

// worktree-dir 값을 받는다 — 제안값(../<repo>.worktrees)을 버퍼에 미리 채워
// 그 자리에서 고쳐 쓴다. repo 폴더명이 곧 원하는 이름이 아닐 수 있어서다.
async function askWtdir(facts) {
  for (;;) {
    const v = await input({
      message: t.qWtdir,
      def: `../${basename(facts.primary)}.worktrees`,
      prefill: true,
    });
    if (v === null || v) return v;
    println(paint.red(t.inputRequired));
  }
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
      ],
    });
    if (d === null) return cancelled();
    if (d === 0) return adoptFlow(facts, facts.dotwtree);
    ws = facts.dotwtree;
  } else {
    // 기존 정책이 없으면 경로를 묻지 않는다 — 기본 위치 .wtree 로 바로 간다.
    // (그 자리에 정책 작업장이 아닌 무언가가 이미 있을 때만 새 경로를 묻는다.)
    ws = join(facts.toplevel, '.wtree');
    if (existsSync(ws) && !(isFile(join(ws, 'rules')) || isFile(join(ws, 'settings')))) {
      println(paint.red(t.pathNotWorkspace(ws)));
      const p = await askFreshPath('.wtree');
      if (p === null) return cancelled();
      if (typeof p === 'object') return adoptFlow(facts, p.adopt);
      ws = p;
    }
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

  const wtdir = await askWtdir(facts);
  if (wtdir === null) return cancelled();

  let root;
  if (shapeTpl && !facts.detRoot)
    while (!root) {
      root = await input({ message: t.qRoot });
      if (root === null) return cancelled();
    }

  // ---- 확정 화면: 계획을 보여주고 나서야 파일시스템이 변한다 ----
  const steps = planStep1(
    { ws, shapeTpl, root, hooks, hookAnswers, wtdir },
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
      : s.kind === 'hooks' ? t.planHooks(Object.keys(s.files).join(', '), s.chosen.map((x) => x.name).join(' + '))
      : t.planSettings(s.value);
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

// 기존 작업장 채택 — 이관 없이 이 pane 에서 곧바로 적용까지 간다. 훅 파일의
// 위험성 검토는 pane 을 열기 전 에이전트 몫이다 (SKILL 지시).
async function adoptFlow(facts, ws) {
  println('');
  println(t.adoptNote(ws));
  println('');
  await applyWorkspace(facts, ws, {});
}

// 작업장을 repo 정책으로 적용하는 공통 흐름 — 채택(수집 pane 안 즉시 적용)과
// apply 국면(조립 경로의 두 번째 pane)이 공유한다. 여기서 pane 이 끝난다.
async function applyWorkspace(facts, ws, { composed = false }) {
  const wsHooks = join(ws, 'hooks');
  const hookFiles = isDir(wsHooks)
    ? readdirSync(wsHooks).sort().filter((f) => isFile(join(wsHooks, f)))
    : [];
  const hasSettings = isFile(join(ws, 'settings'));

  let wtdir = null;
  if (!hasSettings) {
    wtdir = await askWtdir(facts);
    if (wtdir === null) return cancelled();
  }

  let copyHooks = false;
  if (hookFiles.length) {
    println(paint.redBold(t.hookWarnTitle));
    for (const line of t.hookWarnBody(hookFiles.map((f) => join(wsHooks, f)))) println(paint.red(`  ${line}`));
    if (composed) println(`  ${t.hookComposedNote}`);
    println('');
    // 경고를 읽기 전의 반사적 Enter 를 막는 0.5초 — 그 사이의 키는 버려진다.
    // 초기값이 "복사"로 시작하는 것은 사용자 본인이 pane 에서 조립한 훅뿐이다 —
    // 채택되는 기존 훅은 남의 코드일 수 있어 '복사 안 함'에서 시작한다.
    const hi = await select({
      message: t.qHookCopy,
      items: [{ label: t.hookNo }, { label: t.hookYes }],
      initial: composed ? 1 : 0,
      danger: true,
      delayMs: 500,
    });
    if (hi === null) return cancelled();
    copyHooks = hi === 1;
    println('');
  }

  const wtDir = hasSettings
    ? worktreeDirOf(join(ws, 'settings'), facts.primary)
    : resolve(facts.primary, wtdir);
  println(paint.bold(t.planTitle));
  if (!hasSettings) println(`  - ${t.planSettings(wtdir)}`);
  else println(`  - ${t.planSettingsKeep}`);
  println(`  - ${t.planLoad(ws)}`);
  if (hookFiles.length) println(`  - ${copyHooks ? t.planCopyHooks(hookFiles.length) : t.planSkipHooks}`);
  println(`  - ${t.planClaude(wtDir)}`);
  println('');
  // 계획을 읽기 전에 도착해 있던 Enter 가 그대로 확정이 되지 않게 잠깐 키를 버린다
  const c = await select({ message: t.qConfirm, items: [{ label: t.cApply }, { label: t.cCancel }], delayMs: 400 });
  if (c === null || c === 1) return cancelled();

  const result = executeStep2(
    { ws, copyHooks, wtdir: wtdir ?? undefined, whereProvided: Boolean(wtdir) },
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
  await applyWorkspace(facts, ws, { composed: opts.hooks === 'composed' });
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

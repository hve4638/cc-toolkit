#!/usr/bin/env node
// /wtree 셋업 TUI — useterminal pane 에서 사용자가 직접 답하는 인라인 프롬프트.
// 흐름은 한 줄이다: 훅 선택 → .git/wtree/hooks 기록 → `wtree init` 위임 →
// 종료 확인. rules·settings 는 CLI 의 init 이 자기 TUI(템플릿 메뉴)로 직접
// 받으므로, 이 스크립트는 init 이 다루지 않는 것 — 훅 — 만 조립한다.
//
// 훅을 init 보다 먼저 기록해도 안전하다: wtree init 은 .git/wtree/hooks 의
// 기존 파일을 보존하고 *.sample 만 옆에 추가한다 (실측 검증, 2026-08-27).
// handoff 파일은 없다 — 결과 확인은 에이전트가 `wtree rule` 로 직접 한다.
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { HOOK_KINDS, mergeFeatures, readHookFiles, runGates } from './lib/actions.mjs';
import { multiselect, paint, pause } from './lib/prompt.mjs';
import { git, isDir, isFile, listHookVariants, setKo, sh } from './lib/setuplib.mjs';

// ---- 화면 문구 --------------------------------------------------------------
const L = {
  en: {
    title: 'wtree policy setup',
    qHooks: 'wtree hooks',
    multiHint: '(enter/space: toggle)',
    multiSubmit: 'submit selection',
    importLabel: (d) => `import ${d}`,
    importNote: (files) => files.join(', '),
    importCaution: 'caution: imported hooks run as shell code on wtree verbs',
    shFail: (f) => `hook failed sh -n — nothing was written: ${f}`,
    mergeFail: 'hook assembly failed — nothing was written:',
    wroteHooks: (d) => `hooks written: ${d}`,
    handToInit: 'the branch rules come from the CLI itself — handing off to wtree init',
    initOk: 'setup complete',
    initFail: 'wtree init did not finish',
    hooksRemain: (d) => `the hooks written to ${d} remain — run \`wtree init\` in this repo to finish`,
    doneNote: 'pane done — tell the agent to wrap up',
    cancelledNote: 'cancelled — nothing changed',
    blockedTitle: 'setup blocked:',
    alreadyHint: 'the current policy is shown by `wtree info`',
    pressKey: 'any key: close pane',
    needTty: 'wtree TUI needs a terminal — run it in one (inside tmux, via a useterminal pane)\n',
  },
  ko: {
    title: 'wtree 정책 셋업',
    qHooks: 'wtree 훅',
    multiHint: '(enter/space: 토글)',
    multiSubmit: '선택 완료',
    importLabel: (d) => `${d} 가져오기`,
    importNote: (files) => files.join(', '),
    importCaution: '주의: 가져온 훅은 wtree 동사 때 셸로 실행됨',
    shFail: (f) => `훅이 sh -n 검사에 실패 — 아무것도 기록되지 않음: ${f}`,
    mergeFail: '훅 조립 실패 — 아무것도 기록되지 않음:',
    wroteHooks: (d) => `훅 기록 완료: ${d}`,
    handToInit: '브랜치 rules 는 CLI 자신의 것 — wtree init 으로 넘어감',
    initOk: '셋업 완료',
    initFail: 'wtree init 이 끝나지 않음',
    hooksRemain: (d) => `${d} 에 기록된 훅은 그대로 남음 — 이 repo 에서 \`wtree init\` 을 실행하면 셋업이 끝남`,
    doneNote: '작업 완료 — 에이전트에게 알리면 셋업이 마무리됨',
    cancelledNote: '취소됨 — 변경 없음',
    blockedTitle: '셋업 불가:',
    alreadyHint: '현재 정책은 `wtree info` 로 확인',
    pressKey: '아무 키: pane 닫기',
    needTty: 'wtree TUI: 터미널 필요 — tmux 안 useterminal pane 등 터미널에서 실행\n',
  },
};

// ---- 인자 -------------------------------------------------------------------
const argv = process.argv.slice(2);
let ko = false;
for (const a of argv) {
  if (a === '--ko') ko = true;
  else {
    process.stderr.write('usage: tui.mjs [--ko]\n');
    process.exit(2);
  }
}
setKo(ko);
const lang = ko ? 'ko' : 'en';
const t = L[lang];

const println = (s = '') => process.stdout.write(s + '\n');
const interactive = process.stdin.isTTY && process.stdout.isTTY;

async function closePane(code) {
  if (interactive) await pause(t.pressKey);
  process.exit(code);
}

async function cancelled() {
  println('');
  println(paint.yellow(t.cancelledNote));
  await closePane(1);
}

async function abort(lines) {
  println('');
  for (const line of lines) println(paint.red(line));
  await closePane(1);
}

// ---- 진입 -------------------------------------------------------------------
async function main() {
  const gate = runGates();
  if (gate.problems.length) {
    println(paint.red(t.blockedTitle));
    for (const p of gate.problems) println(paint.red(`  - ${p}`));
    if (gate.problems.some((p) => p.startsWith('already configured'))) println(paint.dim(`  ${t.alreadyHint}`));
    await closePane(1);
    return;
  }
  if (!interactive) {
    process.stderr.write(t.needTty);
    process.exit(1);
  }

  const common = gate.common;
  const primary = dirname(common);
  const toplevel = git(['rev-parse', '--show-toplevel']).stdout;

  println(paint.bold(t.title));
  println(paint.dim(`  repo: ${primary}`));
  println(paint.dim(`  wtree: ${gate.ver.stdout}`));
  println('');

  // ---- 훅 선택 ----
  // 템플릿은 완성품 변형이라 후속 질문이 없다 — 같은 기능의 변형끼리는
  // multiselect 의 배타 그룹(group)으로 하나만 켜진다.
  // init 의 --load 경로조차 .wtree/hooks 는 가져오지 않으므로(실측), 커밋된
  // 공유 훅의 반입은 온전히 이 목록의 몫이다. 후보는 toplevel 과 주 워크트리 —
  // 워크트리 안에서 실행돼도 공유 .wtree 를 찾는다.
  const hookTpls = listHookVariants();
  const dwHooksDir = [...new Set([toplevel, primary])]
    .map((r) => join(r, '.wtree', 'hooks'))
    .find((d) => isDir(d) && readdirSync(d).some((f) => isFile(join(d, f))));
  const dwFiles = dwHooksDir
    ? readdirSync(dwHooksDir).sort().filter((f) => isFile(join(dwHooksDir, f)))
    : [];

  const items = hookTpls.map((tp) => ({ label: tp.name, note: tp.summary, group: tp.feature }));
  if (dwHooksDir) items.push({ label: t.importLabel(dwHooksDir), note: t.importNote(dwFiles) });

  const features = [];
  if (items.length) {
    const hi = await multiselect({
      message: t.qHooks,
      items,
      hint: t.multiHint,
      submitLabel: t.multiSubmit,
    });
    if (hi === null) return cancelled();

    const pickedTpls = hi.filter((i) => i < hookTpls.length).map((i) => hookTpls[i]);
    const pickedImport = dwHooksDir && hi.includes(hookTpls.length);

    if (pickedImport) {
      // 가져오는 파일은 남이 쓴 셸일 수 있다 — 위험성 검토는 pane 을 열기 전
      // 에이전트 몫(SKILL 지시)이고, 여기서는 문법 선검사와 고지만 한다.
      println(paint.red(t.importCaution));
      const files = {};
      for (const f of dwFiles) {
        if (!HOOK_KINDS.includes(f)) continue; // README 등 훅 아닌 파일은 건너뛴다
        const p = join(dwHooksDir, f);
        const check = sh('sh', ['-n', p]);
        if (!check.ok) return abort([t.shFail(p), check.all]);
        files[f] = readFileSync(p, 'utf8');
      }
      features.push({ name: dwHooksDir, files });
    }
    for (const tp of pickedTpls) features.push({ name: tp.name, files: readHookFiles(tp.dir) });
  }

  // ---- 훅 기록 ----
  let hooksDir = null;
  if (features.length) {
    let merged;
    try {
      merged = mergeFeatures(features);
    } catch (e) {
      return abort([t.mergeFail, String(e.message || e)]);
    }
    // 병합 결과도 live 디렉터리에 닿기 전에 sh -n — 검사 실패가 반쯤 기록된
    // 상태를 남기지 않게 임시 파일에서 한다.
    const tmp = mkdtempSync(join(tmpdir(), 'wtree-hook-'));
    try {
      for (const [kind, text] of Object.entries(merged)) {
        writeFileSync(join(tmp, kind), text);
        const check = sh('sh', ['-n', join(tmp, kind)]);
        if (!check.ok) return abort([t.shFail(kind), check.all]);
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
    hooksDir = join(common, 'wtree', 'hooks');
    mkdirSync(hooksDir, { recursive: true });
    println('');
    println(`${paint.green('✔')} ${t.wroteHooks(hooksDir)}`);
    for (const [kind, text] of Object.entries(merged)) {
      writeFileSync(join(hooksDir, kind), text);
      chmodSync(join(hooksDir, kind), 0o755);
      println(paint.dim(`  - ${kind}`));
    }
  }

  // ---- wtree init 위임 ----
  println('');
  println(paint.dim(t.handToInit));
  println('');
  // 자식이 도는 동안 부모는 Ctrl-C 를 무시한다 — init 자신이 130 으로 정리하고
  // 나오면, 여기로 돌아와 종료 확인 화면까지 간다.
  const ignoreSigint = () => {};
  process.on('SIGINT', ignoreSigint);
  const init = spawnSync('wtree', ['init'], { stdio: 'inherit' });
  process.off('SIGINT', ignoreSigint);

  println('');
  if (init.status === 0 && isFile(join(common, 'wtree', 'rules'))) {
    println(`${paint.green('✔')} ${t.initOk}`);
    println(t.doneNote);
    await closePane(0);
  } else {
    println(paint.yellow(t.initFail));
    if (hooksDir) println(paint.dim(`  ${t.hooksRemain(hooksDir)}`));
    await closePane(1);
  }
}

main().catch(async (e) => {
  process.stdout.write(`\n${paint.red(String(e && e.stack ? e.stack : e))}\n`);
  await closePane(2);
});

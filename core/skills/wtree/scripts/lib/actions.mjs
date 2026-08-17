// /wtree 셋업의 결정적 동작부: 게이트, 사실 수집, step1/step2 가 파일시스템을
// 바꾸는 실행. 폼 스크립트(step1/step2)와 인라인 TUI(tui.mjs)가 이 한 구현을
// 공유한다 — 흐름과 질문은 각자의 것이고, 상태를 바꾸는 코드는 여기뿐이다.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { SCRIPTS_DIR, git, listTemplates, sh } from './setuplib.mjs';

export const isFile = (p) => existsSync(p) && statSync(p).isFile();
export const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

// ---- 게이트 (수집형: 문제를 전부 모아 한 번에) ------------------------------
// 셋째 게이트(이미 설정됨)의 alert 문구만 호출자마다 달라 인자로 받는다.
export function runGates(configuredAlert) {
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
      alerts.push(configuredAlert);
    }
  }
  return { problems, alerts, common, ver };
}

// ---- 사실 수집 (읽기 전용) --------------------------------------------------
export function collectFacts(common) {
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

  return { toplevel, primary, dotwtree, detRoot, shapes, hookTpls, dwHooksDir, dwHookFiles, dwContents };
}

// rules 텍스트에서 섹션 하나를 제거하고, 다른 섹션의 children 참조도 지운다.
export function dropSection(text, name) {
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

// ---- 훅 조립 ----------------------------------------------------------------
// 훅 템플릿은 {KEY} 슬롯을 둔 골격(wtree 훅 6종 중 가진 파일들)과 슬롯별
// 경우의 수를 선언한 options.json 으로 온다. 조립은 여기서만 일어난다 —
// TUI 는 답만 모으고, 답이 없는 슬롯은 스펙의 기본(첫 case / default)으로
// 채워진다. options 는 템플릿 전역이라 슬롯이 어느 파일에 있어도 된다.
export const HOOK_KINDS = ['pre-create', 'post-create', 'pre-merge', 'post-merge', 'pre-destroy', 'post-destroy'];

export function hookOptionsOf(tpl) {
  const p = join(tpl.dir, 'options.json');
  return isFile(p) ? JSON.parse(readFileSync(p, 'utf8')).options : [];
}

// 사용자 입력이 셸 소스로 들어가는 유일한 통로 — 항상 작은따옴표로 감싼다.
export const shq = (v) => `'${String(v).replaceAll("'", `'\\''`)}'`;

// answers[key]: select 는 case id (input 딸린 case 는 { id, value }), input 은 문자열.
// 반환은 { 훅이름: 조립된 텍스트 } — 템플릿이 가진 훅 파일 전부를 조립한다.
//
// 치환은 블록을 전부 만든 뒤 골격 위 단일 패스로만 한다. 문자열 replaceAll 의
// 대치 패턴($' $& $$)이 인용된 입력을 변형하지 않게 함수 대치를 쓰고, 삽입된
// 내용이 다른 슬롯 치환에 재스캔되지 않게 한다 — 사용자 입력 속 {KEY}·달러
// 시퀀스가 셸 소스로 새는 두 경로를 이 구조가 막는다.
export function renderHook(tpl, answers = {}) {
  const blocks = {};
  for (const o of hookOptionsOf(tpl)) {
    const a = answers[o.key];
    if (o.type === 'select') {
      const id = a === undefined ? o.cases[0].id : typeof a === 'object' ? a.id : a;
      const c = o.cases.find((x) => x.id === id);
      if (!c) throw new Error(`hook ${tpl.name}: unknown case "${id}" for ${o.key}`);
      if (c.input) {
        if (typeof a !== 'object' || !a.value)
          throw new Error(`hook ${tpl.name}: case "${id}" of ${o.key} needs a value`);
        blocks[o.key] = c.code.replaceAll('{VALUE}', () => shq(a.value));
      } else blocks[o.key] = c.code;
    } else {
      const v = a === undefined ? (o.default ?? '') : String(a);
      blocks[o.key] = o.template.replaceAll('{VALUE}', () => shq(v));
    }
  }
  const files = {};
  const used = new Set();
  for (const kind of HOOK_KINDS) {
    if (!isFile(join(tpl.dir, kind))) continue;
    const skeleton = readFileSync(join(tpl.dir, kind), 'utf8');
    // ${WTREE_BRANCH} 같은 셸 확장은 슬롯이 아니다 — $ 없는 {KEY} 만 잡는다.
    const text = skeleton.replace(/(?<!\$)\{([A-Z][A-Z0-9_]*)\}/g, (m, key) => {
      if (!(key in blocks)) throw new Error(`hook ${tpl.name}: unfilled slot ${m} in ${kind}`);
      used.add(key);
      return blocks[key];
    });
    files[kind] = text.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '\n');
  }
  if (!Object.keys(files).length) throw new Error(`hook ${tpl.name}: no hook file in template`);
  for (const key of Object.keys(blocks))
    if (!used.has(key)) throw new Error(`hook ${tpl.name}: no slot {${key}} in any hook file`);
  return files;
}

// 훅 기능 여러 개를 훅 종류별 파일 하나씩으로 병합한다. 같은 종류에 여러
// 기능이 오면 기능마다 서브셸로 격리해 한 기능의 exit 0 가드가 다음 기능을
// 삼키지 않게 한다. 반환은 { 훅이름: 텍스트 }.
export function mergeHooks(tpls, answersByName = {}) {
  const rendered = tpls.map((t) => ({ name: t.name, files: renderHook(t, answersByName[t.name] || {}) }));
  const out = {};
  for (const kind of HOOK_KINDS) {
    const have = rendered.filter((r) => kind in r.files);
    if (!have.length) continue;
    if (have.length === 1) {
      out[kind] = have[0].files[kind];
      continue;
    }
    const bodies = have.map((r) => {
      // $0 재호출(자기 파일을 다시 부르는 훅)은 병합하면 깨진다 — 재진입이
      // 자기 절만이 아니라 뒤 절 전부를 다시 돌리기 때문. 조용한 오동작
      // 대신 조립 시점에 거부한다.
      if (r.files[kind].includes('$0'))
        throw new Error(
          `hook ${r.name}: ${kind} re-invokes $0 and cannot be merged with another feature's ${kind}`,
        );
      const b = r.files[kind].replace(/^#!.*\n/, '');
      return `# === ${r.name} ===\n(\n${b.trimEnd()}\n)`;
    });
    out[kind] = `#!/bin/sh\n# wtree ${kind} — merged by the /wtree setup (per-feature subshell isolation)\n\n${bodies.join('\n\n')}\n`;
  }
  return out;
}

export const settingsBody = (wtdir) =>
  `# wtree machine-local settings — written by the /wtree setup\nworktree-dir = ${wtdir}\n`;

// ---- step1 계획/실행 --------------------------------------------------------
// 계획은 구조화된 단계 목록이다: TUI 가 확정 화면에 자기 말로 렌더할 수 있게
// 하고, 실행은 이 목록만 따라가므로 보여준 것과 하는 것이 어긋날 수 없다.
// worktree-dir 값은 두 형태로 온다: 폼(동결)은 where 접두어('../'|'./')를 주고
// 이름은 <repo>.worktrees 로 고정, TUI 는 wtdir 로 완성된 값을 준다.
export function planStep1({ ws, shapeTpl, root, drop, hooks, hookAnswers, where, wtdir }, { detRoot, hookTpls, primary }) {
  const steps = [];
  if (existsSync(ws)) {
    const old = ws + '.old';
    if (existsSync(old)) steps.push({ kind: 'delete-old', old });
    steps.push({ kind: 'rotate', ws, old });
  }
  steps.push({ kind: 'create', ws });
  if (shapeTpl) {
    const text = readFileSync(join(shapeTpl.dir, 'rules'), 'utf8');
    const tplRoot = text.match(/^\[([^\]]+)\]/m)[1];
    steps.push({ kind: 'rules', ws, tpl: shapeTpl, tplRoot, effRoot: root || detRoot, drops: drop || [] });
  }
  // 훅도 plan 시점에 끝까지 렌더한다 — rules 의 선례처럼, 조립 실패가
  // rotate/create 뒤가 아니라 어떤 파일시스템 변경보다 먼저 터지게.
  const chosen = (hooks || []).map((h) => hookTpls.find((t) => t.name === h));
  if (chosen.length) steps.push({ kind: 'hooks', ws, chosen, files: mergeHooks(chosen, hookAnswers || {}) });
  steps.push({ kind: 'settings', ws, value: wtdir || `${where}${basename(primary)}.worktrees` });
  return steps;
}

export function executeStep1(steps) {
  const actions = [];
  for (const s of steps) {
    switch (s.kind) {
      case 'delete-old':
        rmSync(s.old, { recursive: true });
        actions.push(`- deleted: ${s.old}/ (previous backup)`);
        break;
      case 'rotate':
        renameSync(s.ws, s.old);
        actions.push(`- moved: ${s.ws}/ -> ${s.old}/`);
        break;
      case 'create':
        mkdirSync(s.ws, { recursive: true });
        actions.push(`- created: ${s.ws}/`);
        break;
      case 'rules': {
        let text = readFileSync(join(s.tpl.dir, 'rules'), 'utf8');
        if (s.effRoot !== s.tplRoot) {
          text = text.replace(`[${s.tplRoot}]`, `[${s.effRoot}]`);
          actions.push(`- applied: root branch ${s.tplRoot} -> ${s.effRoot}`);
        }
        for (const d of s.drops) {
          text = dropSection(text, d);
          actions.push(`- applied: dropped section ${d} and its references`);
        }
        writeFileSync(join(s.ws, 'rules'), text);
        actions.push(`- created: ${join(s.ws, 'rules')} (from templates/shapes/${s.tpl.name})`);
        break;
      }
      case 'hooks':
        mkdirSync(join(s.ws, 'hooks'));
        for (const [kind, text] of Object.entries(s.files)) writeFileSync(join(s.ws, 'hooks', kind), text);
        actions.push(
          `- created: ${join(s.ws, 'hooks')}/ ${Object.keys(s.files).join(', ')} (${s.chosen.map((t) => t.name).join(' + ')}${s.chosen.length > 1 ? ' merged' : ''})`,
        );
        break;
      case 'settings':
        writeFileSync(join(s.ws, 'settings'), settingsBody(s.value));
        actions.push(`- created: ${join(s.ws, 'settings')} (worktree-dir = ${s.value})`);
        break;
    }
  }
  return actions;
}

// ---- step2 실행 -------------------------------------------------------------
// 훅 `sh -n` 선검사 → settings 보완 → wtree init --load → 훅 복사 → 워크트리
// 폴더 CLAUDE.md. 실패는 페이지 이름+값으로 알린다 — 렌더는 호출자의 몫이다
// (폼은 stdout 으로, TUI 는 화면과 handoff 파일로).
export function executeStep2({ ws, copyHooks, where, wtdir, whereProvided }, { primary, toplevel }) {
  const wsHooks = join(ws, 'hooks');
  const hookFiles = isDir(wsHooks)
    ? readdirSync(wsHooks).sort().filter((f) => isFile(join(wsHooks, f)))
    : [];
  const doCopy = hookFiles.length > 0 && copyHooks === true;

  if (doCopy)
    for (const f of hookFiles) {
      const check = sh('sh', ['-n', join(wsHooks, f)]);
      if (!check.ok)
        return { ok: false, page: 'step2-hook-invalid', values: { FILE: join(wsHooks, f), SH_OUTPUT: check.all } };
    }

  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).stdout;
  const actions = [];
  const wsSettings = join(ws, 'settings');
  const hasSettings = isFile(wsSettings);
  if (!hasSettings) {
    const value = wtdir || `${where}${basename(primary)}.worktrees`;
    writeFileSync(wsSettings, settingsBody(value));
    actions.push(`- created: ${wsSettings} (worktree-dir = ${value})`);
  } else if (whereProvided) {
    actions.push(`- kept: ${wsSettings} already exists, so the where value was ignored`);
  }

  const load = sh('wtree', ['init', '--load', ws], { cwd: toplevel });
  if (!load.ok) return { ok: false, page: 'step2-load-failed', values: { DIR: ws, WTREE_OUTPUT: load.all } };
  actions.push(`- applied: wtree init --load ${ws}`);

  // settings 가 .git/wtree 에 실리지 않는 wtree 버전 대비 — 없으면 복사로 보완.
  const liveSettings = join(common, 'wtree', 'settings');
  if (!isFile(liveSettings) || !/^\s*worktree-dir\s*=/m.test(readFileSync(liveSettings, 'utf8'))) {
    copyFileSync(wsSettings, liveSettings);
    actions.push(`- created: ${liveSettings} (copied from ${wsSettings} — init did not carry settings)`);
  }

  if (doCopy) {
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

  const wtDir = worktreeDirOf(liveSettings, primary);
  mkdirSync(wtDir, { recursive: true });
  const claudeMd = join(wtDir, 'CLAUDE.md');
  if (isFile(claudeMd)) {
    actions.push(`- kept: ${claudeMd} (existing file preserved)`);
  } else {
    copyFileSync(join(SCRIPTS_DIR, 'worktree-claude.md'), claudeMd);
    actions.push(`- created: ${claudeMd}`);
  }

  return { ok: true, actions, wtreeOutput: load.all };
}

// settings 파일의 worktree-dir 값으로 워크트리 폴더 절대 경로를 푼다. 값이
// 없으면 기본 배치(<repo 형제>/<repo>.worktrees)다. TUI 확정 화면의 예측에도
// 같은 해석을 쓴다 — executeStep2 의 실제 대상과 어긋나지 않게.
export function worktreeDirOf(settingsPath, primary) {
  const raw = isFile(settingsPath)
    ? readFileSync(settingsPath, 'utf8').match(/^\s*worktree-dir\s*=\s*(.*)$/m)
    : null;
  const value = raw ? raw[1].replace(/#.*$/, '').trim() : '';
  return value
    ? isAbsolute(value)
      ? value
      : resolve(primary, value)
    : join(dirname(primary), `${basename(primary)}.worktrees`);
}

// /wtree 셋업의 결정적 동작부: 게이트와 훅 조립. 화면 흐름은 tui.mjs 의
// 것이고, 상태를 만들어 내는 코드는 여기뿐이다.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { git, isFile, sh } from './setuplib.mjs';

// ---- 게이트 (수집형: 문제를 전부 모아 한 번에) ------------------------------
export function runGates() {
  const problems = [];
  const ver = sh('wtree', ['--version']);
  if (!ver.ok || !ver.stdout.includes('(gitwtree)')) {
    problems.push('standalone wtree CLI not found — `wtree --version` output lacks `(gitwtree)`');
  }
  const gitOk = git(['rev-parse', '--is-inside-work-tree']).ok;
  let common = '';
  let configured = false;
  if (!gitOk) {
    problems.push('cwd is not inside a git work tree');
  } else {
    common = git(['rev-parse', '--path-format=absolute', '--git-common-dir']).stdout;
    // rules 존재 = 구성 완료. 차단이 아니라 질문거리다 — tui 가 덮어쓰기·훅만
    // 교체·종료의 3선택지를 낸다. 훅만 있는 부분 상태는 평소 흐름이 이어서
    // 완주하므로 여기 들지 않는다.
    configured = isFile(join(common, 'wtree', 'rules'));
  }
  return { problems, common, ver, configured };
}

// 설치된 훅(*.sample 제외)을 지운다 — '교체'의 앞 단계. 지운 이름을 돌려준다.
export function clearInstalledHooks(dir) {
  const removed = [];
  for (const kind of HOOK_KINDS) {
    if (isFile(join(dir, kind))) {
      rmSync(join(dir, kind));
      removed.push(kind);
    }
  }
  return removed;
}

// ---- 훅 ---------------------------------------------------------------------
export const HOOK_KINDS = ['pre-create', 'post-create', 'pre-merge', 'post-merge', 'pre-destroy', 'post-destroy'];

// 템플릿 변형 폴더(또는 가져올 기존 hooks/ 디렉터리)에서 훅 파일들을 읽는다.
// 템플릿은 완성품이다 — 슬롯도 조정 지점도 없고, 조정은 설치된 파일을 직접
// 고치는 것으로 대신한다(INFO 안내).
export function readHookFiles(dir) {
  const files = {};
  for (const kind of HOOK_KINDS) if (isFile(join(dir, kind))) files[kind] = readFileSync(join(dir, kind), 'utf8');
  return files;
}

// 훅 기능 여러 개를 훅 종류별 파일 하나씩으로 병합한다. 같은 종류에 여러
// 기능이 오면 기능마다 서브셸로 격리해 한 기능의 exit 0 가드가 다음 기능을
// 삼키지 않게 한다. feature 는 { name, files: { 훅이름: 텍스트 } } — 템플릿
// 파일이든 기존 파일을 읽어 온 것이든 같은 모양으로 섞인다.
export function mergeFeatures(features) {
  const out = {};
  for (const kind of HOOK_KINDS) {
    const have = features.filter((r) => kind in r.files);
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


import { existsSync } from 'fs';
import { basename, dirname } from 'path';
import { execFileSync } from 'child_process';
import {
  loadCache,
  saveCache,
  clearTracking,
  ensureCacheDir,
  resolveProjectRoot,
} from '../lib/state-file.mjs';

function runGit(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf-8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function getInlayDiff(inlayRoot) {
  // WHY: inlay 디렉토리가 git work tree 안일 때만 diff 노출. 외부면 skip.
  const inside = runGit(inlayRoot, ['rev-parse', '--is-inside-work-tree']);
  if (!inside || inside.trim() !== 'true') return null;

  // WHY: full diff 는 모델이 방금 자기가 만든 변경이라 본문 중복. 파일별
  //      +/- 통계만 노출해 inlay 내 변동 스코프만 알린다.
  // WHY: INLAY.md 는 diff 에서 제외 — stale 판정은 이번 사이클 tracking 기준
  //      인데 diff 는 워킹트리 전체 기준이라, 이전 사이클에 이미 고친
  //      `INLAY.md | 2 +-` 가 "안 고쳤다" 알림에 같이 찍히는 자기모순이 생긴다.
  //      exclude pathspec 두 개로 최상위(INLAY.md)·중첩(**/INLAY.md) 을 정확히
  //      잡는다 (`*INLAY.md` 한 개는 MY-INLAY.md 류까지 과잉 제외 — 실증 확인).
  const stat = runGit(inlayRoot, [
    'diff', '--stat', '--', '.', ':(exclude)INLAY.md', ':(exclude)**/INLAY.md',
  ]);
  // WHY: git diff 는 untracked 신규 파일을 못 잡으므로 ls-files --others
  //      로 보완. inlay 안에 새로 생긴 파일도 변동 스코프의 일부.
  const others = runGit(inlayRoot, ['ls-files', '--others', '--exclude-standard', '--', '.']);

  const blocks = [];
  if (stat != null && stat.length > 0) blocks.push(stat.replace(/\n+$/, ''));
  if (others != null && others.trim().length > 0) {
    // WHY: untracked INLAY.md 도 diff 쪽과 같은 이유로 제외 (basename 필터로 충분).
    const newFiles = others.trim().split('\n').filter((p) => basename(p) !== 'INLAY.md');
    if (newFiles.length > 0) blocks.push(newFiles.map((p) => `[NEW] ${p}`).join('\n'));
  }
  return blocks.length === 0 ? null : blocks.join('\n');
}

function buildAlert(stale) {
  const lines = [
    '[INLAY ALERT] INLAY.md was not updated for the following inlay(s):',
    '',
    ...stale.map((p) => `- ${p}`),
    '',
    'If your code change affects the inlay boundary, entry point, or domain terms, update INLAY.md. Otherwise ignore.',
  ];

  for (const ctxPath of stale) {
    const inlayRoot = dirname(ctxPath);
    const diff = getInlayDiff(inlayRoot);
    if (diff == null) continue;
    lines.push('', `[DIFF IN INLAY] ${inlayRoot}`, diff);
  }

  return lines.join('\n');
}

export default async function stop(payload) {
  if (payload.hook_event_name && payload.hook_event_name !== 'Stop') return null;

  const { session_id } = payload;
  if (!session_id) return null;

  const projectRoot = resolveProjectRoot(payload);
  ensureCacheDir(projectRoot);
  const ctx = { projectRoot, sessionId: session_id };

  // WHY: 모든 Stop 진입은 작업 사이클의 끝 = tracking 을 비울 지점이다. 조기
  //      반환 경로 (continuation 재진입 / 이미 1회 발화) 도 base 를 비워야,
  //      continuation 윈도우에서 쓰인 inlayUpdated 같은 플래그가 다음 사이클로
  //      새어 정당한 잔소리를 억제하지 않는다. 코드 수정은 항상 stopHookFired
  //      =false 로 재무장하므로, 코드 변경이 있는 사이클은 이 조기 반환을 타지
  //      않는다 → doc-first 정탐 보존. base 만 비운다 (서브 own 정리는 SubagentStop).
  if (payload.stop_hook_active === true) {
    clearTracking(ctx);
    return null;
  }

  // WHY: 메인 Stop 은 base (메인 컨텍스트) tracking 만 본다. 서브에이전트가
  //      만진 inlay 는 서브의 SubagentStop 이 단독 책임 — 공유 own 파일을 union
  //      하지 않아, 메인은 자기가 만진 inlay 만 잔소리한다 (중복·조기·orphan
  //      재보고 없음).
  const cache = loadCache({ projectRoot, sessionId: session_id });
  if (cache.stopHookFired) {
    clearTracking(ctx);
    return null;
  }

  // WHY: codeTouched 인데 inlayUpdated 가 없는 inlay 만 = 코드는 고쳤는데
  //      INLAY.md 는 안 만진 것. mtime 비교를 버려 코드/문서 수정 순서에
  //      영향받지 않는다. existsSync 로 사라진 INLAY.md 는 추적에서 제외.
  const stale = [];
  for (const [ctxPath, info] of Object.entries(cache.tracking)) {
    if (info.codeTouched && !info.inlayUpdated && existsSync(ctxPath)) stale.push(ctxPath);
  }

  if (stale.length === 0) {
    clearTracking(ctx);
    return null;
  }

  // WHY: tracking 리셋 + 발화 플래그를 한 번의 atomic write 로 (둘 사이 timeout
  //      kill 시 어긋남 방지). 다음 PostToolUse 의 코드 수정이 stopHookFired
  //      =false 로 리셋하면 새 사이클에서 재발화 가능.
  saveCache({ resetTracking: true, stopHookFired: true }, ctx);

  // WHY: Stop 훅 스키마는 hookSpecificOutput 에 'Stop' 을 허용하지 않음
  //      (validator: PreToolUse / UserPromptSubmit / PostToolUse / PostToolBatch
  //      만 허용). 모델 컨텍스트로 주입하는 schema-valid 경로는
  //      `decision: 'block'` + `reason` 뿐. 디스패처가 { block } 을 그 형식으로
  //      변환한다. stopHookFired + stop_hook_active 두 가드로 1회 발화만
  //      보장하므로 사실상 1회 잔소리와 동치.
  return { block: buildAlert(stale) };
}

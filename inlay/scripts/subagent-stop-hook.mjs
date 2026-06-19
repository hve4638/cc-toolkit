#!/usr/bin/env node
import { existsSync } from 'fs';
import { dirname } from 'path';
import { execFileSync } from 'child_process';
import {
  loadOwnCache,
  saveCache,
  clearTracking,
  ensureCacheDir,
  resolveProjectRoot,
} from '../_build/src/lib/state-file.mjs';

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

function silent() {
  emit({ continue: true, suppressOutput: true });
}

function readStdin() {
  return new Promise((resolveStdin) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolveStdin(data));
  });
}

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
  const stat = runGit(inlayRoot, ['diff', '--stat', '--', '.']);
  // WHY: git diff 는 untracked 신규 파일을 못 잡으므로 ls-files --others
  //      로 보완. inlay 안에 새로 생긴 파일도 변동 스코프의 일부.
  const others = runGit(inlayRoot, ['ls-files', '--others', '--exclude-standard', '--', '.']);

  const blocks = [];
  if (stat != null && stat.length > 0) blocks.push(stat.replace(/\n+$/, ''));
  if (others != null && others.trim().length > 0) {
    blocks.push(others.trim().split('\n').map((p) => `[NEW] ${p}`).join('\n'));
  }
  return blocks.length === 0 ? null : blocks.join('\n');
}

function buildAlert(stale, agentId) {
  const lines = [
    `[INLAY ALERT] subagent ${agentId} touched the following inlay(s) but INLAY.md was not updated:`,
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

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return silent();
  }

  if (input.hook_event_name && input.hook_event_name !== 'SubagentStop') return silent();

  const { session_id, agent_id } = input;
  if (!session_id) return silent();
  // WHY: SubagentStop 은 자기 own 파일만 본다. agent_id 없으면 식별 불가라 silent.
  if (!agent_id) return silent();

  const projectRoot = resolveProjectRoot(input);
  ensureCacheDir(projectRoot);
  const ctx = { projectRoot, sessionId: session_id, agentId: agent_id };

  // WHY: 모든 SubagentStop 진입은 이 서브에이전트 작업 사이클의 끝 = own
  //      tracking 을 비울 지점. 조기 반환 경로 (continuation 재진입 / 이미 1회
  //      발화) 도 비워야, continuation 윈도우의 inlayUpdated 가 다음 사이클
  //      (재개된 백그라운드 서브에이전트 포함) 로 새지 않는다. 코드 수정은
  //      stopHookFired=false 로 재무장하므로 코드 변경 사이클은 조기 반환을
  //      타지 않는다 → doc-first 정탐 보존.
  if (input.stop_hook_active === true) {
    clearTracking(ctx);
    return silent();
  }

  const cache = loadOwnCache(ctx);
  if (cache.stopHookFired) {
    clearTracking(ctx);
    return silent();
  }

  // WHY: codeTouched 인데 inlayUpdated 가 없는 inlay 만 = 코드는 고쳤는데
  //      INLAY.md 는 안 만진 것. mtime 비교를 버려 수정 순서에 무관.
  //      existsSync 로 사라진 INLAY.md 는 추적에서 제외.
  const stale = [];
  for (const [ctxPath, info] of Object.entries(cache.tracking)) {
    if (info.codeTouched && !info.inlayUpdated && existsSync(ctxPath)) stale.push(ctxPath);
  }

  if (stale.length === 0) {
    clearTracking(ctx);
    return silent();
  }

  // WHY: own 파일에 tracking 리셋 + 발화 플래그를 한 번의 atomic write 로.
  //      다음 PostToolUse 의 코드 수정이 stopHookFired=false 로 리셋하면 재발화.
  saveCache({ resetTracking: true, stopHookFired: true }, ctx);

  // WHY: Stop 훅 스키마는 hookSpecificOutput 에 'Stop' 을 허용하지 않음
  //      (validator: PreToolUse / UserPromptSubmit / PostToolUse / PostToolBatch
  //      만 허용). 모델 컨텍스트로 주입하는 schema-valid 경로는
  //      `decision: 'block'` + `reason` 뿐. stopHookFired + stop_hook_active
  //      두 가드로 1회 발화만 보장하므로 사실상 1회 잔소리와 동치.
  emit({ decision: 'block', reason: buildAlert(stale, agent_id) });
}

main().catch(() => silent());

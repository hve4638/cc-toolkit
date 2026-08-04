import { readFileSync } from 'fs';
import { basename, dirname, resolve } from 'path';
import { createHash } from 'crypto';
import { findNearestContext } from '../lib/read-context.mjs';
import { saveCache, ensureCacheDir, resolveProjectRoot } from '../lib/state-file.mjs';
import { findMarkerDir } from '../../../scripts/lib/markers.mjs';
import { isTriggerFile } from '../lib/trigger-patterns.mjs';

const INTERCEPT = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function extractPath(toolName, toolInput) {
  if (!toolInput) return null;
  if (toolName === 'NotebookEdit') return toolInput.notebook_path ?? null;
  return toolInput.file_path ?? null;
}

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

export default async function posttooluse(payload) {
  const { session_id, agent_id, tool_name, tool_input } = payload;
  if (!session_id) return null;
  if (!INTERCEPT.has(tool_name)) return null;

  const filePath = extractPath(tool_name, tool_input);
  if (!filePath) return null;

  const resolved = resolve(filePath);

  // WHY: 천장은 편집 대상 파일에서 올라가며 찾은 .inlay 디렉터리. 파일 위에
  //      .inlay 가 없으면 그 파일은 어떤 inlay 스코프에도 안 속하므로 추적하지
  //      않는다.
  const ceiling = findMarkerDir(dirname(resolved), '.inlay');
  if (!ceiling) return null;

  const projectRoot = resolveProjectRoot(payload);
  ensureCacheDir(projectRoot);
  const ctx = { projectRoot, sessionId: session_id, agentId: agent_id };

  // WHY: INLAY.md 편집 부기는 트리거 패턴과 무관하게 유지 — 패턴 제외는
  //      "주입·codeTouched 트리거로서의 제외" 지 INLAY.md 부기의 제외가 아니다.
  //      이 분기가 패턴에 걸려 죽으면 INLAY.md 를 고쳤는데도 inlayUpdated 가
  //      안 박혀 Stop 훅이 stale 로 잡는 역오탐이 생긴다.
  if (basename(resolved) === 'INLAY.md') {
    // WHY: PreToolUse 의 self-edit 가드가 chain emit 을 막았기 때문에
    //      hash 도 갱신되지 않은 상태. 여기서 직접 새 본문을 읽어 hash 를
    //      박아야 다음 PreToolUse 가 silent skip 으로 빠진다.
    let content;
    try {
      content = readFileSync(resolved, 'utf-8');
    } catch {
      return null;
    }
    // WHY: 이번 사이클에 이 inlay 의 INLAY.md 가 갱신됐음을 표시. Stop 훅은
    //      codeTouched 이면서 inlayUpdated 가 아닌 inlay 만 잔소리하므로,
    //      코드 수정 전·후 어느 순서로 INLAY 를 갱신해도 오탐이 안 난다.
    saveCache(
      {
        hashes: { [resolved]: sha256(content) },
        tracking: { [resolved]: { inlayUpdated: true } },
      },
      ctx,
    );
    return null;
  }

  // WHY: 트리거 패턴에 안 걸리는 파일은 codeTouched 마킹도 stopHookFired
  //      리셋도 없다 — PreToolUse 의 주입 제외와 같은 판정을 써야 "주입은
  //      없었는데 잔소리는 오는" 비대칭이 안 생긴다.
  if (!isTriggerFile(resolved, ceiling)) return null;

  const nearest = findNearestContext(resolved, { ceiling });
  if (!nearest) return null;

  // WHY: 코드를 만진 inlay 를 이번 사이클의 codeTouched 로 표시. stopHookFired
  //      를 false 로 리셋해 "잔소리 무시하고 코드를 더 만진" 경우 다음 Stop
  //      훅이 재발화 가능하게 한다 (새 작업 사이클임을 표시).
  saveCache(
    {
      tracking: { [nearest]: { codeTouched: true } },
      stopHookFired: false,
    },
    ctx,
  );
  return null;
}

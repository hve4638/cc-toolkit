import { basename, dirname, resolve } from 'path';
import { readContextChain, formatForHook } from '../lib/read-context.mjs';
import {
  loadCache,
  saveCache,
  cleanupOrphans,
  ownFileExists,
  ensureCacheDir,
  resolveProjectRoot,
} from '../lib/state-file.mjs';
import { findMarkerDir } from '../../../scripts/lib/markers.mjs';

const INTERCEPT = new Set(['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function extractPath(toolName, toolInput) {
  if (!toolInput) return null;
  if (toolName === 'NotebookEdit') return toolInput.notebook_path ?? null;
  return toolInput.file_path ?? null;
}

export default async function pretooluse(payload) {
  const { session_id, agent_id, tool_name, tool_input } = payload;
  if (!session_id) return null;
  if (!INTERCEPT.has(tool_name)) return null;

  const filePath = extractPath(tool_name, tool_input);
  if (!filePath) return null;

  // WHY: INLAY.md 를 직접 수정하는 호출에서 chain 을 박으면 그 자기
  //      본문이 prompt 에 또 들어가 의미상 순환이 생긴다. Read 는 본문
  //      만 보여주므로 정상 chain 으로 다룬다.
  if (WRITE_TOOLS.has(tool_name) && basename(filePath) === 'INLAY.md') {
    return null;
  }

  // WHY: 천장은 편집 대상 파일에서 올라가며 찾은 .inlay 디렉터리. 파일 위에
  //      .inlay 가 없으면 그 파일은 어떤 inlay 스코프에도 안 속하므로 INLAY.md
  //      를 아예 보지 않는다 (주입·추적 없음).
  const ceiling = findMarkerDir(dirname(resolve(filePath)), '.inlay');
  if (!ceiling) return null;

  const projectRoot = resolveProjectRoot(payload);
  ensureCacheDir(projectRoot);

  // WHY: 메인 세션의 자기 캐시 파일이 아직 없을 때 = 세션의 첫 PreToolUse.
  //      이 시점에 한 번만 orphan cleanup 을 돌린다. 서브에이전트는 자기
  //      own 파일만 다루므로 cleanup 책임 안 짐.
  if (!agent_id && !ownFileExists(projectRoot, session_id, null)) {
    cleanupOrphans({ projectRoot });
  }

  const ctx = { projectRoot, sessionId: session_id, agentId: agent_id };
  const cache = loadCache(ctx);
  const startDir = dirname(resolve(filePath));
  const entries = readContextChain(startDir, { cache, ceiling });

  const changed = entries.some((e) => e.status !== 'unchanged');
  if (changed) saveCache({ hashes: cache.hashes }, ctx);

  const additionalContext = formatForHook(entries);
  if (!additionalContext) return null;

  // WHY: Claude Code 는 additionalContext 를 top-level 이 아니라
  //      hookSpecificOutput 안에 wrap 한 형태로만 LLM prompt 에 주입한다.
  //      여기선 디스패처가 그 wrapping 을 담당하므로 핸들러는 { context } 만 반환.
  return { context: additionalContext };
}

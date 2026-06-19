#!/usr/bin/env node
import { readFileSync, statSync } from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { createHash } from 'crypto';
import { saveCache, ensureCacheDir, resolveProjectRoot } from '../_build/src/lib/state-file.mjs';

const INTERCEPT = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
  process.exit(0);
}

function readStdin() {
  return new Promise((resolveStdin) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolveStdin(data));
  });
}

function extractPath(toolName, toolInput) {
  if (!toolInput) return null;
  if (toolName === 'NotebookEdit') return toolInput.notebook_path ?? null;
  return toolInput.file_path ?? null;
}

function sha256(s) {
  return createHash('sha256').update(s).digest('hex');
}

function findNearestContext(startPath) {
  let dir = dirname(resolve(startPath));
  while (true) {
    const candidate = join(dir, 'INLAY.md');
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // not here, walk up
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function main() {
  const raw = await readStdin();
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return emit({ continue: true });
  }

  const { session_id, agent_id, cwd, tool_name, tool_input } = input;
  if (!session_id) return emit({ continue: true });
  if (!INTERCEPT.has(tool_name)) return emit({ continue: true });

  const filePath = extractPath(tool_name, tool_input);
  if (!filePath) return emit({ continue: true });

  const projectRoot = resolveProjectRoot(input);
  ensureCacheDir(projectRoot);
  const ctx = { projectRoot, sessionId: session_id, agentId: agent_id };
  const resolved = resolve(filePath);

  if (basename(resolved) === 'INLAY.md') {
    // WHY: PreToolUse 의 self-edit 가드가 chain emit 을 막았기 때문에
    //      hash 도 갱신되지 않은 상태. 여기서 직접 새 본문을 읽어 hash 를
    //      박아야 다음 PreToolUse 가 silent skip 으로 빠진다.
    let content;
    try {
      content = readFileSync(resolved, 'utf-8');
    } catch {
      return emit({ continue: true });
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
    return emit({ continue: true });
  }

  const nearest = findNearestContext(resolved);
  if (!nearest) return emit({ continue: true });

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
  emit({ continue: true });
}

main().catch(() => emit({ continue: true }));

// PostToolUse handler, loaded by the core skill-hook dispatcher (core/hooks/hooks.mjs).
// Flags SKILL.md / SKILL.ko.md edits to a session flag file; the Stop hook
// (core/scripts/stop-context-hint.mjs) consumes it and hints the user to review.
// Fires for subagent tool calls too — session_id stays the main session's.

import { basename } from 'node:path';
import { appendLine, resolveProjectRoot } from '../../scripts/lib/agent-memory.mjs';

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const TARGETS = new Set(['SKILL.md', 'SKILL.ko.md']);
const HINT_COMMAND = '/writing-great-skill';

export function PostToolUse(payload) {
  try {
    if (!EDIT_TOOLS.has(payload?.tool_name)) return;
    const filePath = payload?.tool_input?.file_path;
    if (typeof filePath !== 'string' || !TARGETS.has(basename(filePath))) return;
    if (!payload?.session_id) return;
    // WHY: 한 턴의 병렬 편집로 훅 프로세스가 경합해도 O_APPEND 한 줄 추가는
    //      유실 없이 안전하다 — read-modify-write JSON 재작성은 쓰지 않는다.
    //      워크스페이스 부재 가드는 appendLine 안에 있다.
    appendLine(
      resolveProjectRoot(payload),
      `context-hint/${payload.session_id}.jsonl`,
      JSON.stringify({ cmd: HINT_COMMAND, path: filePath }),
    );
  } catch { /* fail open: hint flagging must never break the hook chain */ }
}

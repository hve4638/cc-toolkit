#!/usr/bin/env node
/**
 * Stop Hook: Context-file review hint (user-only).
 *
 * Consumes flag lines appended by skill PostToolUse handlers
 * (core/skills/writing-great-skill/hooks.mjs, core/skills/writing-great-agents-md/hooks.mjs)
 * to <projectRoot>/.agent-memory/context-hint/<session_id>.jsonl — one JSON
 * line { cmd, path } per detected context-file edit. On Stop: read, delete the
 * flag file, dedupe, and emit one hint line per command via systemMessage
 * (shown to the user only; never enters the model context).
 *
 * Paths are shown relative to the project root (where .agent-memory lives);
 * paths outside it stay absolute.
 *
 * Fail-open everywhere: any error → { continue:true, suppressOutput:true }.
 */

import { basename, isAbsolute, relative } from 'node:path';
import { readText, removeFile, resolveProjectRoot } from './lib/agent-memory.mjs';
import { readHookPayload } from './lib/corelib.mjs';

const FLAG_SUBDIR = 'context-hint';

function ok() {
  process.stdout.write(JSON.stringify({ continue: true, suppressOutput: true }));
}

function displayPath(projectRoot, p) {
  if (!isAbsolute(p)) return p;
  const rel = relative(projectRoot, p);
  return rel && !rel.startsWith('..') ? rel : p;
}

async function main() {
  const data = await readHookPayload(1000);
  if (data === null) return ok();

  if (data?.hook_event_name !== 'Stop') return ok();
  if (!data?.session_id) return ok();

  const projectRoot = resolveProjectRoot(data);
  const flagRel = `${FLAG_SUBDIR}/${data.session_id}.jsonl`;
  const flagContent = readText(projectRoot, flagRel);
  if (flagContent === null) return ok();
  const lines = flagContent.split('\n');
  // WHY: 메시지 구성 전에 지운다 — 이후 어디서 실패하든 낡은 플래그가
  //      다음 Stop 마다 같은 힌트를 반복하지 않는다.
  removeFile(projectRoot, flagRel);

  const groups = new Map();
  for (const line of lines) {
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (typeof entry?.cmd !== 'string' || typeof entry?.path !== 'string') continue;
    if (!groups.has(entry.cmd)) groups.set(entry.cmd, new Set());
    groups.get(entry.cmd).add(displayPath(projectRoot, entry.path));
  }
  if (groups.size === 0) return ok();

  const hints = [];
  for (const [cmd, paths] of groups) {
    const names = [...new Set([...paths].map((p) => basename(p)))].join(', ');
    hints.push(`[hint] ${names} modified. Consider running ${cmd}. (${[...paths].join(', ')})`);
  }

  process.stdout.write(JSON.stringify({
    continue: true,
    suppressOutput: true,
    systemMessage: hints.join('\n'),
  }));
}

main().catch(() => ok());

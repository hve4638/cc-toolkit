// context-guide skill hook — PostToolUse review trigger.
//
// After a successful Write/Edit/MultiEdit on a context file (CLAUDE.md,
// AGENTS.md, SKILL.md, SKILL.ko.md), injects the review instruction from
// assets/ so the editing model checks its own just-landed change.
//
// Instruction assets (author-editable, injected verbatim):
//   assets/review-skill.ko.md   — SKILL.md / SKILL.ko.md edits
//   assets/review-context.ko.md — CLAUDE.md / AGENTS.md edits
// An empty asset means "draft not written yet" → stay silent. The token
// {{file}} inside an asset is replaced with the edited file's absolute path.
//
// Throttle: same (session, agent, file) is suppressed for THROTTLE_MS after an
// injection, so the fix-up edits prompted by the review don't re-trigger it.
// State lives in os.tmpdir(), not the project — core fires in every project
// and must not pollute repos. Throttle I/O failures fail open (inject).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);
const THROTTLE_MS = 10 * 60 * 1000;
const STATE_DIR = join(tmpdir(), 'cc-core-hooks');

const ASSET_BY_BASENAME = {
  'CLAUDE.md': 'review-context.ko.md',
  'AGENTS.md': 'review-context.ko.md',
  'SKILL.md': 'review-skill.ko.md',
  'SKILL.ko.md': 'review-skill.ko.md',
};

function loadInstruction(assetName, filePath) {
  let text;
  try {
    text = readFileSync(join(HERE, 'assets', assetName), 'utf-8').trim();
  } catch {
    return null;
  }
  if (!text) return null;
  return text.replaceAll('{{file}}', filePath);
}

// True when this (session, agent, file) already got an injection within the
// window. On pass, records the injection time — call only when about to inject.
function throttled(sessionId, key) {
  const stateFile = join(STATE_DIR, `${encodeURIComponent(sessionId)}.json`);
  const now = Date.now();
  let state = {};
  try { state = JSON.parse(readFileSync(stateFile, 'utf-8')); } catch { /* first hit */ }

  const last = state?.contextGuide?.[key];
  if (typeof last === 'number' && now - last < THROTTLE_MS) return true;

  try {
    mkdirSync(STATE_DIR, { recursive: true });
    state.contextGuide = { ...(state.contextGuide || {}), [key]: now };
    writeFileSync(stateFile, JSON.stringify(state));
  } catch { /* fail-open: 기록 실패면 다음 편집에 한 번 더 주입될 뿐 */ }
  return false;
}

export function PostToolUse(payload) {
  const { session_id, tool_name, tool_input, agent_id } = payload ?? {};
  if (!session_id || !TOOLS.has(tool_name)) return null;

  const filePath = tool_input?.file_path;
  if (!filePath) return null;

  const assetName = ASSET_BY_BASENAME[basename(filePath)];
  if (!assetName) return null;

  const resolved = resolve(filePath);
  const instruction = loadInstruction(assetName, resolved);
  if (!instruction) return null;

  if (throttled(session_id, `${agent_id || 'main'}:${resolved}`)) return null;

  return { context: instruction };
}

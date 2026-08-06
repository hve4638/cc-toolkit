import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DISPATCHER_PATH = join(__dirname, '..', '..', 'hooks', 'hooks.mjs');

function flagPathFor(projectDir, sessionId) {
  return join(projectDir, '.agent-memory', 'context-hint', `${sessionId}.jsonl`);
}

function runDispatcher(event, payload, projectDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [DISPATCHER_PATH, event], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve({ stdout }));

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function withTmpDir(fn) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'hooks-dispatcher-test-'));
  return Promise.resolve(fn(tmpDir)).finally(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
}

// WHY: wgs/wga are .alias copies of writing-great-skill/-agents-md, hooks.mjs
//      included. Without the .alias skip the same handler fires twice per event
//      and appends duplicate flag lines. One SKILL.md edit must yield exactly
//      one flag line.
test('dispatcher skips .alias skill copies — no duplicate handler runs', async () => {
  await withTmpDir(async (tmpDir) => {
    await runDispatcher('PostToolUse', {
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_input: { file_path: '/x/a/SKILL.md' },
      session_id: 'alias-1',
    }, tmpDir);

    const lines = readFileSync(flagPathFor(tmpDir, 'alias-1'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines, [
      { cmd: '/writing-great-skill', path: '/x/a/SKILL.md' },
    ]);
  });
});

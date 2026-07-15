import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostToolUse as skillPostToolUse } from '../../skills/writing-great-skill/hooks.mjs';
import { PostToolUse as agentsMdPostToolUse } from '../../skills/writing-great-agents-md/hooks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '..', 'stop-context-hint.mjs');

function flagPathFor(projectDir, sessionId) {
  return join(projectDir, '.agent-memory', 'context-hint', `${sessionId}.jsonl`);
}

// WHY: 핸들러는 호출 시점의 CLAUDE_PROJECT_DIR 를 읽는다 — 테스트 프로세스
//      전역 env 를 잠시 바꾸고 반드시 복원한다.
function withProjectEnv(projectDir, fn) {
  const saved = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = projectDir;
  try {
    return fn();
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = saved;
  }
}

function runHook(sessionId, projectDir, eventName = 'Stop') {
  const payload = JSON.stringify({
    hook_event_name: eventName,
    session_id: sessionId,
    cwd: projectDir,
  });

  return new Promise((resolve, reject) => {
    const child = spawn('node', [SCRIPT_PATH], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve({ stdout, stderr }));

    child.stdin.write(payload);
    child.stdin.end();
  });
}

function withTmpDir(fn) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'context-hint-test-'));
  return Promise.resolve(fn(tmpDir)).finally(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });
}

test('skill handler flags SKILL.md edits, ignores others', async () => {
  await withTmpDir(async (tmpDir) => {
    withProjectEnv(tmpDir, () => {
      skillPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/x/a/SKILL.md' }, session_id: 's1' });
      skillPostToolUse({ tool_name: 'Write', tool_input: { file_path: '/x/a/SKILL.ko.md' }, session_id: 's1' });
      skillPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/x/a/CLAUDE.md' }, session_id: 's1' });
      skillPostToolUse({ tool_name: 'Bash', tool_input: { file_path: '/x/a/SKILL.md' }, session_id: 's1' });
      skillPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/x/src/index.ts' }, session_id: 's1' });
    });
    const lines = readFileSync(flagPathFor(tmpDir, 's1'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines, [
      { cmd: '/writing-great-skill', path: '/x/a/SKILL.md' },
      { cmd: '/writing-great-skill', path: '/x/a/SKILL.ko.md' },
    ]);
  });
});

test('agents-md handler flags CLAUDE.md / AGENTS.md edits only', async () => {
  await withTmpDir(async (tmpDir) => {
    withProjectEnv(tmpDir, () => {
      agentsMdPostToolUse({ tool_name: 'Write', tool_input: { file_path: '/x/CLAUDE.md' }, session_id: 's2' });
      agentsMdPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/x/AGENTS.md' }, session_id: 's2' });
      agentsMdPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/x/a/SKILL.md' }, session_id: 's2' });
    });
    const lines = readFileSync(flagPathFor(tmpDir, 's2'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines, [
      { cmd: '/writing-great-agents-md', path: '/x/CLAUDE.md' },
      { cmd: '/writing-great-agents-md', path: '/x/AGENTS.md' },
    ]);
  });
});

test('Stop consumes flags into per-command hint lines and deletes the file', async () => {
  await withTmpDir(async (tmpDir) => {
    const flagPath = flagPathFor(tmpDir, 'sess-1');
    withProjectEnv(tmpDir, () => {
      skillPostToolUse({ tool_name: 'Edit', tool_input: { file_path: join(tmpDir, 'core/skills/foo/SKILL.md') }, session_id: 'sess-1' });
      agentsMdPostToolUse({ tool_name: 'Write', tool_input: { file_path: join(tmpDir, 'CLAUDE.md') }, session_id: 'sess-1' });
    });

    const { stdout } = await runHook('sess-1', tmpDir);
    const parsed = JSON.parse(stdout);
    const lines = parsed.systemMessage.split('\n');
    assert.deepEqual(lines, [
      '[hint] SKILL.md modified. Consider running /writing-great-skill. (core/skills/foo/SKILL.md)',
      '[hint] CLAUDE.md modified. Consider running /writing-great-agents-md. (CLAUDE.md)',
    ]);
    assert.equal(parsed.decision, undefined);
    assert.ok(!existsSync(flagPath), 'flag file must be deleted after consumption');

    const second = JSON.parse((await runHook('sess-1', tmpDir)).stdout);
    assert.equal(second.systemMessage, undefined);
  });
});

test('duplicate edits dedupe; paths outside the project root stay absolute', async () => {
  await withTmpDir(async (tmpDir) => {
    withProjectEnv(tmpDir, () => {
      for (let i = 0; i < 3; i++) {
        skillPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/outside/SKILL.ko.md' }, session_id: 'sess-2' });
      }
    });
    const { stdout } = await runHook('sess-2', tmpDir);
    const parsed = JSON.parse(stdout);
    assert.equal(
      parsed.systemMessage,
      '[hint] SKILL.ko.md modified. Consider running /writing-great-skill. (/outside/SKILL.ko.md)',
    );
  });
});

test('non-Stop events leave the flag file untouched', async () => {
  await withTmpDir(async (tmpDir) => {
    const flagPath = flagPathFor(tmpDir, 'sess-3');
    withProjectEnv(tmpDir, () => {
      agentsMdPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/x/AGENTS.md' }, session_id: 'sess-3' });
    });
    const { stdout } = await runHook('sess-3', tmpDir, 'PostToolUse');
    assert.equal(JSON.parse(stdout).systemMessage, undefined);
    assert.ok(existsSync(flagPath), 'flag file must survive non-Stop events');
  });
});

test('malformed flag lines are skipped; all-bad file stays silent', async () => {
  await withTmpDir(async (tmpDir) => {
    const flagPath = flagPathFor(tmpDir, 'sess-4');
    withProjectEnv(tmpDir, () => {
      skillPostToolUse({ tool_name: 'Edit', tool_input: { file_path: '/x/SKILL.md' }, session_id: 'sess-4' });
    });
    writeFileSync(flagPath, `not-json\n{"cmd":123}\n${readFileSync(flagPath, 'utf-8')}`);
    const good = JSON.parse((await runHook('sess-4', tmpDir)).stdout);
    assert.ok(good.systemMessage?.includes('/x/SKILL.md'));

    writeFileSync(flagPath, 'garbage\n\n');
    const bad = JSON.parse((await runHook('sess-4', tmpDir)).stdout);
    assert.equal(bad.systemMessage, undefined);
  });
});

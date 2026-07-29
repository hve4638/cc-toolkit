import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '..', 'pre-tool-enforcer.mjs');

// Spawn the hook with an injected clock so cooldown boundaries are deterministic.
// projectDir + sessionId are shared across calls in a test to persist throttle state.
function runHook({ toolName, sessionId, projectDir, nowMs, cooldownMs }) {
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    session_id: sessionId,
    cwd: projectDir,
  });

  const env = {
    ...process.env,
    CLAUDE_PROJECT_DIR: projectDir,
    FRAME_PRETOOL_ADVISORY_NOW_MS: String(nowMs),
  };
  if (cooldownMs !== undefined) env.FRAME_PRETOOL_ADVISORY_COOLDOWN_MS = String(cooldownMs);

  return new Promise((resolve, reject) => {
    const child = spawn('node', [SCRIPT_PATH], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.on('error', reject);
    child.on('close', () => resolve(JSON.parse(stdout)));
    child.stdin.write(payload);
    child.stdin.end();
  });
}

function withTmpDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pretool-test-'));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

const emitted = (r) => r.hookSpecificOutput?.additionalContext;
const throttleDir = (dir) => join(dir, '.agent-memory', 'pre-tool-advisory');

test('first matching call emits the rule', async () => {
  await withTmpDir(async (dir) => {
    const r = await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    assert.equal(r.continue, true);
    assert.match(emitted(r), /Prefer dedicated tools/);
  });
});

test('identical call within cooldown is suppressed', async () => {
  await withTmpDir(async (dir) => {
    await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    const r = await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_001_000 });
    assert.equal(r.suppressOutput, true);
    assert.equal(emitted(r), undefined);
  });
});

test('same message re-emits after cooldown elapses', async () => {
  await withTmpDir(async (dir) => {
    await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    const r = await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 + 5 * 60 * 1000 });
    assert.match(emitted(r), /Prefer dedicated tools/);
  });
});

test('different message (Read vs Bash) has an independent key', async () => {
  await withTmpDir(async (dir) => {
    await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    const r = await runHook({ toolName: 'Read', sessionId: 's1', projectDir: dir, nowMs: 1_000_500 });
    assert.match(emitted(r), /Read multiple files in parallel/);
  });
});

// WHY: Write/Edit 는 rulesForTool 에서 같은 문자열을 반환하므로 해시 키가 같다.
//      throttle 은 메시지별이라 둘은 서로를 억제한다 — 의도된 동작임을 고정한다.
test('Write and Edit share one throttle key (same message)', async () => {
  await withTmpDir(async (dir) => {
    const w = await runHook({ toolName: 'Write', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    assert.match(emitted(w), /Verify the change after writing/);
    const e = await runHook({ toolName: 'Edit', sessionId: 's1', projectDir: dir, nowMs: 1_000_500 });
    assert.equal(e.suppressOutput, true);
    assert.equal(emitted(e), undefined);
  });
});

test('clock regression re-emits (previous timestamp in the future)', async () => {
  await withTmpDir(async (dir) => {
    await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 2_000_000 });
    const r = await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    assert.match(emitted(r), /Prefer dedicated tools/);
  });
});

test('non-matching tool is suppressed', async () => {
  await withTmpDir(async (dir) => {
    const r = await runHook({ toolName: 'WebFetch', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    assert.equal(r.suppressOutput, true);
    assert.equal(emitted(r), undefined);
  });
});

test('cooldown of 0 disables throttle (emits every call)', async () => {
  await withTmpDir(async (dir) => {
    const opts = { toolName: 'Bash', sessionId: 's1', projectDir: dir, cooldownMs: 0 };
    await runHook({ ...opts, nowMs: 1_000_000 });
    const r = await runHook({ ...opts, nowMs: 1_000_001 });
    assert.match(emitted(r), /Prefer dedicated tools/);
  });
});

test('session_id with path separators falls back to _global (no traversal)', async () => {
  await withTmpDir(async (dir) => {
    const r = await runHook({ toolName: 'Bash', sessionId: '../../etc/passwd', projectDir: dir, nowMs: 1_000_000 });
    assert.match(emitted(r), /Prefer dedicated tools/);
    // state landed in the fixed dir under _global.json, not anywhere the id pointed
    assert.ok(existsSync(join(throttleDir(dir), '_global.json')));
    assert.equal(existsSync(join(dir, '.agent-memory', 'pre-tool-advisory', '..', '..', 'etc', 'passwd.json')), false);
  });
});

// 가드레일: wt destroy 등으로 사라진 워크스페이스를 mkdir -p 로 되살리지 않는다.
test('missing project root emits but creates nothing (no dead-workspace revival)', async () => {
  await withTmpDir(async (dir) => {
    const gone = join(dir, 'destroyed-worktree');
    const r = await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: gone, nowMs: 1_000_000 });
    assert.match(emitted(r), /Prefer dedicated tools/);
    assert.equal(existsSync(gone), false);
  });
});

test('corrupted state file still emits (fail-open)', async () => {
  await withTmpDir(async (dir) => {
    mkdirSync(throttleDir(dir), { recursive: true });
    writeFileSync(join(throttleDir(dir), 's1.json'), 'not json {{{');
    const r = await runHook({ toolName: 'Bash', sessionId: 's1', projectDir: dir, nowMs: 1_000_000 });
    assert.match(emitted(r), /Prefer dedicated tools/);
  });
});

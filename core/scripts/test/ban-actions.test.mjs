import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = join(__dirname, '..', 'ban-actions.mjs');

// HOME/USERPROFILE 을 항상 임시 디렉터리로 격리 — 실제 사용자 홈의 .banaction 가
// 테스트 결과에 새어 들어오지 않게 한다.
function runHook({ toolName, toolInput, projectDir, homeDir }) {
  const payload = JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    cwd: projectDir,
  });

  const env = {
    ...process.env,
    CLAUDE_PROJECT_DIR: projectDir,
    HOME: homeDir,
    USERPROFILE: homeDir,
  };

  return new Promise((resolve, reject) => {
    const child = spawn('node', [SCRIPT_PATH], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.on('error', reject);
    // WHY: deny-via-JSON 계약은 exit 0 에서만 유효 — 테스트가 exit code 도 검증할 수 있게 함께 돌려준다.
    child.on('close', (code) => resolve({ code, body: JSON.parse(stdout) }));
    child.stdin.write(payload);
    child.stdin.end();
  });
}

// projectDir 와 homeDir 를 한 임시 루트 아래 분리 생성한다.
function withDirs(fn) {
  const root = mkdtempSync(join(tmpdir(), 'ban-actions-test-'));
  const projectDir = join(root, 'project');
  const homeDir = join(root, 'home');
  mkdirSync(projectDir);
  mkdirSync(homeDir);
  return Promise.resolve(fn({ projectDir, homeDir }))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

const denied = (r) => r.body.hookSpecificOutput?.permissionDecision === 'deny';
const reason = (r) => r.body.hookSpecificOutput?.permissionDecisionReason ?? '';

test('no .banaction file → continue, not denied', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    const r = await runHook({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(r.code, 0);
    assert.equal(r.body.continue, true);
    assert.equal(denied(r), false);
  });
});

test('bare rule denies matching Bash command with rule text in reason', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git push\n');
    const r = await runHook({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(r.code, 0);
    assert.equal(denied(r), true);
    assert.match(reason(r), /BAN Action rule 'git push'/);
    // WHY: 사유가 규칙 파일의 존재 (이름·경로) 를 모델에 노출하지 않아야 한다 — 이 변경의 요지.
    assert.ok(!reason(r).includes('.banaction'));
    assert.ok(!reason(r).includes(projectDir));
  });
});

test('bare rule does not apply to non-Bash tools', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git push\n');
    const r = await runHook({
      toolName: 'Write',
      toolInput: { file_path: '/x/notes.md', content: 'run git push later' },
      projectDir, homeDir,
    });
    assert.equal(denied(r), false);
  });
});

test('Bash description field is not matched, only command', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git push\n');
    const r = await runHook({
      toolName: 'Bash',
      toolInput: { command: 'git status', description: 'git push 전 확인' },
      projectDir, homeDir,
    });
    assert.equal(denied(r), false);
  });
});

test('tool-scoped rule matches tool_input strings', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Write: \\.env$\n');
    const hit = await runHook({
      toolName: 'Write', toolInput: { file_path: '/x/.env', content: 'A=1' }, projectDir, homeDir,
    });
    assert.equal(denied(hit), true);
    const miss = await runHook({
      toolName: 'Write', toolInput: { file_path: '/x/notes.md', content: 'A=1' }, projectDir, homeDir,
    });
    assert.equal(denied(miss), false);
  });
});

test('tool matcher is a regex over tool_name (mcp server-wide ban)', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'mcp__github__.*: .*\n');
    const r = await runHook({
      toolName: 'mcp__github__delete_repo', toolInput: { repo: 'me/x' }, projectDir, homeDir,
    });
    assert.equal(denied(r), true);
  });
});

test('comments and blank lines are ignored', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), '# git push\n\n   \n# Write: .*\n');
    const r = await runHook({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(r), false);
  });
});

test('invalid regex falls back to literal substring match', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git clean -f(d\n');
    const hit = await runHook({
      toolName: 'Bash', toolInput: { command: 'git clean -f(d && echo done' }, projectDir, homeDir,
    });
    assert.equal(denied(hit), true);
    const miss = await runHook({
      toolName: 'Bash', toolInput: { command: 'git clean -fd' }, projectDir, homeDir,
    });
    assert.equal(denied(miss), false);
  });
});

test('home and project .banaction merge additively', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(homeDir, '.banaction'), 'git push\n');
    writeFileSync(join(projectDir, '.banaction'), 'Write: \\.env$\n');
    const fromHome = await runHook({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(fromHome), true);
    const fromProject = await runHook({
      toolName: 'Write', toolInput: { file_path: '/x/.env', content: '' }, projectDir, homeDir,
    });
    assert.equal(denied(fromProject), true);
  });
});

test('nested tool_input strings are matched for non-Bash tools', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'SomeTool: secret-token\n');
    const r = await runHook({
      toolName: 'SomeTool',
      toolInput: { outer: { list: [42, { inner: 'contains secret-token here' }] } },
      projectDir, homeDir,
    });
    assert.equal(denied(r), true);
  });
});

test('tool matcher is anchored — Edit rule does not match MultiEdit', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Edit: .*\n');
    const r = await runHook({
      toolName: 'MultiEdit', toolInput: { file_path: '/x/a.txt' }, projectDir, homeDir,
    });
    assert.equal(denied(r), false);
  });
});

test('tool-scoped Bash rule also checks only command', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Bash: git push\n');
    const r = await runHook({
      toolName: 'Bash',
      toolInput: { command: 'git status', description: 'git push 전 확인' },
      projectDir, homeDir,
    });
    assert.equal(denied(r), false);
  });
});

test('invalid tool matcher regex falls back to exact tool name match', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Wri(te: x\n');
    const hit = await runHook({
      toolName: 'Wri(te', toolInput: { file_path: '/x/file' }, projectDir, homeDir,
    });
    assert.equal(denied(hit), true);
    const miss = await runHook({
      toolName: 'Write', toolInput: { file_path: '/x/file' }, projectDir, homeDir,
    });
    assert.equal(denied(miss), false);
  });
});

test('CRLF line endings parse correctly', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), '# comment\r\ngit push\r\nWrite: \\.env$\r\n');
    const bash = await runHook({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(bash), true);
    const write = await runHook({
      toolName: 'Write', toolInput: { file_path: '/x/.env' }, projectDir, homeDir,
    });
    assert.equal(denied(write), true);
  });
});

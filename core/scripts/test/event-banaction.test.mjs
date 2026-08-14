import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import addon from '../../event/rule/banaction/index.mjs';
import { dispatch, toHookOutput } from '../../event/lib/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// projectDir 와 homeDir 를 한 임시 루트 아래 분리 생성한다. root 는 project 의
// 조상이기도 해서 cascade 테스트의 조상 층 자리로 쓴다.
function withDirs(fn) {
  const root = mkdtempSync(join(tmpdir(), 'event-banaction-test-'));
  const projectDir = join(root, 'project');
  const homeDir = join(root, 'home');
  mkdirSync(projectDir);
  mkdirSync(homeDir);
  return Promise.resolve(fn({ root, projectDir, homeDir }))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

// HOME/CLAUDE_PROJECT_DIR 을 임시 디렉터리로 격리해 실제 사용자의 .banaction 이
// 결과에 새어 들어오지 않게 한다. 모듈은 매 dispatch 마다 파일을 다시 읽는다.
async function run({ toolName, toolInput, projectDir, homeDir }) {
  const saved = {
    HOME: process.env.HOME,
    USERPROFILE: process.env.USERPROFILE,
    CLAUDE_PROJECT_DIR: process.env.CLAUDE_PROJECT_DIR,
  };
  process.env.HOME = homeDir;
  process.env.USERPROFILE = homeDir;
  process.env.CLAUDE_PROJECT_DIR = projectDir;
  try {
    const payload = { tool_name: toolName, tool_input: toolInput, cwd: projectDir };
    return toHookOutput('PreToolUse', await dispatch('PreToolUse', payload, [{ addon, args: {} }]));
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const denied = (out) => out.hookSpecificOutput?.permissionDecision === 'deny';
const reason = (out) => out.hookSpecificOutput?.permissionDecisionReason ?? '';

test('no .banaction file → empty output, not denied', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    const out = await run({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.deepEqual(out, {});
  });
});

test('bare rule denies matching Bash command with rule text in reason', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git push\n');
    const out = await run({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(out), true);
    assert.match(reason(out), /BAN Action rule 'git push'/);
    // WHY: 사유가 규칙 파일의 존재 (이름·경로) 를 모델에 노출하지 않아야 한다.
    assert.ok(!reason(out).includes('.banaction'));
    assert.ok(!reason(out).includes(projectDir));
  });
});

test('bare rule does not apply to non-Bash tools', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git push\n');
    const out = await run({
      toolName: 'Write',
      toolInput: { file_path: '/x/notes.md', content: 'run git push later' },
      projectDir, homeDir,
    });
    assert.equal(denied(out), false);
  });
});

test('Bash description field is not matched, only command', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git push\n');
    const out = await run({
      toolName: 'Bash',
      toolInput: { command: 'git status', description: 'git push 전 확인' },
      projectDir, homeDir,
    });
    assert.equal(denied(out), false);
  });
});

test('tool-scoped rule matches tool_input strings', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Write: \\.env$\n');
    const hit = await run({
      toolName: 'Write', toolInput: { file_path: '/x/.env', content: 'A=1' }, projectDir, homeDir,
    });
    assert.equal(denied(hit), true);
    const miss = await run({
      toolName: 'Write', toolInput: { file_path: '/x/notes.md', content: 'A=1' }, projectDir, homeDir,
    });
    assert.equal(denied(miss), false);
  });
});

test('tool matcher is a regex over tool_name (mcp server-wide ban)', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'mcp__github__.*: .*\n');
    const out = await run({
      toolName: 'mcp__github__delete_repo', toolInput: { repo: 'me/x' }, projectDir, homeDir,
    });
    assert.equal(denied(out), true);
  });
});

test('comments and blank lines are ignored', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), '# git push\n\n   \n# Write: .*\n');
    const out = await run({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(out), false);
  });
});

test('invalid regex falls back to literal substring match', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'git clean -f(d\n');
    const hit = await run({
      toolName: 'Bash', toolInput: { command: 'git clean -f(d && echo done' }, projectDir, homeDir,
    });
    assert.equal(denied(hit), true);
    const miss = await run({
      toolName: 'Bash', toolInput: { command: 'git clean -fd' }, projectDir, homeDir,
    });
    assert.equal(denied(miss), false);
  });
});

test('home and project .banaction merge additively', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(homeDir, '.banaction'), 'git push\n');
    writeFileSync(join(projectDir, '.banaction'), 'Write: \\.env$\n');
    const fromHome = await run({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(fromHome), true);
    const fromProject = await run({
      toolName: 'Write', toolInput: { file_path: '/x/.env', content: '' }, projectDir, homeDir,
    });
    assert.equal(denied(fromProject), true);
  });
});

test('an ancestor .banaction applies to sessions below it', async () => {
  await withDirs(async ({ root, projectDir, homeDir }) => {
    writeFileSync(join(root, '.banaction'), 'git push\n');
    const out = await run({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(out), true);
  });
});

test('nested tool_input strings are matched for non-Bash tools', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'SomeTool: secret-token\n');
    const out = await run({
      toolName: 'SomeTool',
      toolInput: { outer: { list: [42, { inner: 'contains secret-token here' }] } },
      projectDir, homeDir,
    });
    assert.equal(denied(out), true);
  });
});

test('tool matcher is anchored — Edit rule does not match MultiEdit', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Edit: .*\n');
    const out = await run({
      toolName: 'MultiEdit', toolInput: { file_path: '/x/a.txt' }, projectDir, homeDir,
    });
    assert.equal(denied(out), false);
  });
});

test('tool-scoped Bash rule also checks only command', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Bash: git push\n');
    const out = await run({
      toolName: 'Bash',
      toolInput: { command: 'git status', description: 'git push 전 확인' },
      projectDir, homeDir,
    });
    assert.equal(denied(out), false);
  });
});

test('invalid tool matcher regex falls back to exact tool name match', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), 'Wri(te: x\n');
    const hit = await run({
      toolName: 'Wri(te', toolInput: { file_path: '/x/file' }, projectDir, homeDir,
    });
    assert.equal(denied(hit), true);
    const miss = await run({
      toolName: 'Write', toolInput: { file_path: '/x/file' }, projectDir, homeDir,
    });
    assert.equal(denied(miss), false);
  });
});

test('CRLF line endings parse correctly', async () => {
  await withDirs(async ({ projectDir, homeDir }) => {
    writeFileSync(join(projectDir, '.banaction'), '# comment\r\ngit push\r\nWrite: \\.env$\r\n');
    const bash = await run({
      toolName: 'Bash', toolInput: { command: 'git push origin main' }, projectDir, homeDir,
    });
    assert.equal(denied(bash), true);
    const write = await run({
      toolName: 'Write', toolInput: { file_path: '/x/.env' }, projectDir, homeDir,
    });
    assert.equal(denied(write), true);
  });
});

// aiaddon 배선의 e2e — core 배치를 임시 트리에 재현하고 실제 main.mjs 를 띄워,
// rule:banaction 이 aiaddon 에 적혀 있을 때만 도는 것을 본다.
test('enabled via aiaddon the module denies; without the entry it is silent', () => {
  const EVENT_SRC = join(__dirname, '..', '..', 'event');
  const LIB_SRC = join(__dirname, '..', 'lib');
  const dir = mkdtempSync(join(tmpdir(), 'event-banaction-e2e-'));
  try {
    const eventDir = join(dir, 'core', 'event');
    const libDir = join(dir, 'core', 'scripts', 'lib');
    mkdirSync(join(eventDir, 'lib'), { recursive: true });
    mkdirSync(join(eventDir, 'rule', 'banaction'), { recursive: true });
    mkdirSync(libDir, { recursive: true });
    for (const name of ['main.mjs', 'collect.mjs']) {
      copyFileSync(join(EVENT_SRC, name), join(eventDir, name));
    }
    copyFileSync(join(EVENT_SRC, 'lib', 'index.mjs'), join(eventDir, 'lib', 'index.mjs'));
    copyFileSync(
      join(EVENT_SRC, 'rule', 'banaction', 'index.mjs'),
      join(eventDir, 'rule', 'banaction', 'index.mjs'),
    );
    for (const name of ['aiaddon.mjs', 'agent-memory.mjs', 'corelib.mjs']) {
      copyFileSync(join(LIB_SRC, name), join(libDir, name));
    }

    const project = join(dir, 'project');
    const home = join(dir, 'home');
    mkdirSync(join(project, '.config', 'aiaddon'), { recursive: true });
    mkdirSync(home, { recursive: true });
    writeFileSync(join(project, '.banaction'), 'git push\n');

    const runMain = () => {
      const { CLAUDE_PROJECT_DIR: _drop, ...env } = process.env;
      const result = spawnSync('node', [join(eventDir, 'main.mjs'), 'PreToolUse'], {
        encoding: 'utf8',
        input: JSON.stringify({ cwd: project, tool_name: 'Bash', tool_input: { command: 'git push' } }),
        env: { ...env, HOME: home, USERPROFILE: home },
      });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };

    assert.deepEqual(runMain(), {});

    writeFileSync(join(project, '.config', 'aiaddon', 'event'), 'rule:banaction\n');
    const out = runMain();
    assert.equal(out.hookSpecificOutput?.permissionDecision, 'deny');
    assert.match(out.hookSpecificOutput?.permissionDecisionReason ?? '', /git push/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

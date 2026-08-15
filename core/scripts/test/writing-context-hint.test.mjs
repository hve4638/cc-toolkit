import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import decl from '../../addon/writing-context-hint/addon.mjs';
import { apiFor, dispatch, emptyDraft } from '../../event/lib/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAIN = join(__dirname, '..', '..', 'event', 'main.mjs');

function withProject(fn) {
  const projectDir = mkdtempSync(join(tmpdir(), 'writing-context-hint-test-'));
  return Promise.resolve(fn(projectDir))
    .finally(() => rmSync(projectDir, { recursive: true, force: true }));
}

// CLAUDE_PROJECT_DIR 을 임시 프로젝트로 격리 — resolveProjectRoot 가 env 를
// payload.cwd 보다 먼저 본다.
async function edit(projectDir, { toolName = 'Edit', filePath, sessionId = 'sess-1' }) {
  const saved = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = projectDir;
  try {
    const payload = {
      tool_name: toolName,
      tool_input: { file_path: filePath },
      session_id: sessionId,
      cwd: projectDir,
    };
    const loaded = { decl, rules: {} };
    await dispatch('PostToolUse', payload, [loaded]);
  } finally {
    if (saved === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = saved;
  }
}

function flagLines(projectDir, sessionId = 'sess-1') {
  const path = join(projectDir, '.agent-memory', 'context-hint', `${sessionId}.jsonl`);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
}

test('declaration: 규칙 없는 상시 애드온으로 PostToolUse 만 잡는다', () => {
  assert.equal(decl.rules, undefined);
  assert.deepEqual(Object.keys(decl.handlers), ['PostToolUse']);
});

test('SKILL.md 편집이 /writing-great-skill 플래그 줄을 남긴다', async () => {
  await withProject(async (projectDir) => {
    await edit(projectDir, { filePath: '/x/a/SKILL.md' });
    assert.deepEqual(flagLines(projectDir), [
      { cmd: '/writing-great-skill', path: '/x/a/SKILL.md' },
    ]);
  });
});

test('CLAUDE.md 편집이 /writing-great-agents-md 플래그 줄을 남긴다', async () => {
  await withProject(async (projectDir) => {
    await edit(projectDir, { toolName: 'Write', filePath: '/x/CLAUDE.md' });
    assert.deepEqual(flagLines(projectDir), [
      { cmd: '/writing-great-agents-md', path: '/x/CLAUDE.md' },
    ]);
  });
});

test('편집이 쌓이면 줄이 쌓인다 — 파일당 한 줄', async () => {
  await withProject(async (projectDir) => {
    await edit(projectDir, { filePath: '/x/SKILL.ko.md' });
    await edit(projectDir, { toolName: 'MultiEdit', filePath: '/y/AGENTS.md' });
    assert.deepEqual(flagLines(projectDir), [
      { cmd: '/writing-great-skill', path: '/x/SKILL.ko.md' },
      { cmd: '/writing-great-agents-md', path: '/y/AGENTS.md' },
    ]);
  });
});

// 애드온은 자기 try/catch 를 갖지 않는다 — 호스트의 per-addon 격리에 맡긴다.
// 그 결정이 성립하려면 험한 payload 에도 핸들러 자신은 던지지 않아야 한다.
test('험한 payload 형태에 직접 호출로도 던지지 않는다', () => {
  const hostile = [
    { tool_name: 'Edit' },
    { tool_name: 'Edit', tool_input: 'not-an-object' },
    { tool_input: { file_path: '/x/SKILL.md' } },
    {},
  ];
  for (const payload of hostile) {
    const api = apiFor('PostToolUse', emptyDraft(), payload);
    assert.doesNotThrow(() => decl.handlers.PostToolUse(api, payload));
  }
});

// 실제 호스트 배선의 e2e — 커밋된 manifest 와 진짜 addon.mjs 를 그대로 쓴다.
// fail-open 이라 배선이 끊겨도 증상이 없으므로, 여기가 그걸 잡는 자리다.
// HOME 을 임시 디렉터리로 돌려 실제 사용자의 agentaddon 설정이 새지 않게 한다.
test('e2e: 설정 없이 main.mjs 경유로 플래그가 남고, 상시라 !부정으로도 안 꺼진다', async () => {
  await withProject(async (projectDir) => {
    const home = join(projectDir, 'home');
    mkdirSync(home);
    const run = () => {
      const { CLAUDE_PROJECT_DIR: _drop, ...env } = process.env;
      const result = spawnSync('node', [MAIN, 'PostToolUse'], {
        encoding: 'utf8',
        input: JSON.stringify({
          tool_name: 'Edit',
          tool_input: { file_path: '/x/SKILL.md' },
          session_id: 'e2e-1',
          cwd: projectDir,
        }),
        env: { ...env, HOME: home, CLAUDE_PROJECT_DIR: projectDir },
      });
      assert.equal(result.status, 0, result.stderr);
      return result;
    };

    run();
    assert.deepEqual(flagLines(projectDir, 'e2e-1'), [
      { cmd: '/writing-great-skill', path: '/x/SKILL.md' },
    ]);

    // 이름이 없으니 부정도 !* 도 닿지 않는다 — 끄는 길 없음이 설계다.
    rmSync(join(projectDir, '.agent-memory'), { recursive: true, force: true });
    mkdirSync(join(projectDir, '.config', 'agentaddon'), { recursive: true });
    writeFileSync(join(projectDir, '.config', 'agentaddon', 'event'), '!writing-context-hint\n!*\n');
    run();
    assert.deepEqual(flagLines(projectDir, 'e2e-1'), [
      { cmd: '/writing-great-skill', path: '/x/SKILL.md' },
    ]);
  });
});

test('대상이 아닌 파일·도구는 아무것도 남기지 않는다', async () => {
  await withProject(async (projectDir) => {
    await edit(projectDir, { filePath: '/x/README.md' });
    await edit(projectDir, { toolName: 'Read', filePath: '/x/SKILL.md' });
    await edit(projectDir, { filePath: '/x/SKILL.md', sessionId: '' });
    assert.equal(flagLines(projectDir), null);
    assert.equal(flagLines(projectDir, ''), null);
  });
});

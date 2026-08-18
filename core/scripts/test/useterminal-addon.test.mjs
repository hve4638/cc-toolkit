import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import decl from '../../addon/useterminal/addon.mjs';
import { dispatch, toHookOutput } from '../../event/lib/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAIN = join(__dirname, '..', '..', 'event', 'main.mjs');

const DEFAULT_STATES = { 'useterminal-proactive': { trigger: false } };
const PROACTIVE_ON = { 'useterminal-proactive': { trigger: true } };

async function contextFor(source, tmux, ruleStates = DEFAULT_STATES) {
  const saved = process.env.TMUX;
  if (tmux === undefined) delete process.env.TMUX;
  else process.env.TMUX = tmux;
  try {
    const draft = await dispatch('SessionStart', { source }, [{ decl, rules: ruleStates }]);
    return toHookOutput('SessionStart', draft).hookSpecificOutput?.additionalContext;
  } finally {
    if (saved === undefined) delete process.env.TMUX;
    else process.env.TMUX = saved;
  }
}

const TMUX = '/tmp/tmux-0/default,123,0';

test('declaration: alwaysEvents 상시 + opt-in 규칙 useterminal-proactive', () => {
  assert.deepEqual(Object.keys(decl.rules), ['useterminal-proactive']);
  assert.deepEqual([...decl.rules['useterminal-proactive'].events], ['SessionStart']);
  assert.deepEqual([...decl.alwaysEvents], ['SessionStart']);
  assert.deepEqual(Object.keys(decl.handlers), ['SessionStart']);
});

test('tmux 안 (TMUX env 존재) 에서만 <useterminal> 블록을 주입한다', async () => {
  const ctx = await contextFor('startup', TMUX);
  assert.ok(ctx?.startsWith('<useterminal>'), String(ctx).slice(0, 80));
  assert.ok(ctx.trimEnd().endsWith('</useterminal>'));
  assert.ok(ctx.includes('core:useterminal'));

  assert.equal(await contextFor('startup', undefined), undefined);
});

test('proactive 규칙이 켜지면 hint 를 대체한다', async () => {
  const hint = await contextFor('startup', TMUX);
  assert.ok(!hint.includes('used actively to explain'), hint);

  const proactive = await contextFor('startup', TMUX, PROACTIVE_ON);
  assert.ok(proactive.includes('used actively to explain'), proactive);
});

test('resume·fork 는 tmux 안이어도 건너뛴다 — 트랜스크립트 복원이 이전 주입분을 되살린다', async () => {
  assert.equal(await contextFor('resume', TMUX), undefined);
  assert.equal(await contextFor('fork', TMUX), undefined);
});

// 실제 호스트 배선의 e2e — 커밋된 manifest 와 진짜 addon.mjs 를 그대로 쓴다.
// fail-open 이라 배선이 끊겨도 증상이 없으므로, 여기가 그걸 잡는 자리다.
// HOME 을 임시 디렉터리로 돌려 실제 사용자의 agentaddon 설정이 새지 않게 하고,
// instruction 애드온의 상시 주입과 겹치지 않게 useterminal 블록만 본다.
test('e2e: 설정 없이 hint, useterminal-proactive 로 격상, 부정하면 hint 로 복귀', () => {
  const projectDir = mkdtempSync(join(tmpdir(), 'useterminal-addon-test-'));
  try {
    const home = join(projectDir, 'home');
    mkdirSync(home);
    const configDir = join(projectDir, '.config', 'agentaddon');
    mkdirSync(configDir, { recursive: true });
    const run = (tmux) => {
      const { TMUX: _tmux, ...env } = process.env;
      if (tmux !== undefined) env.TMUX = tmux;
      const result = spawnSync('node', [MAIN, 'SessionStart'], {
        encoding: 'utf8',
        input: JSON.stringify({ session_id: 'e2e-1', cwd: projectDir, source: 'startup' }),
        env: { ...env, HOME: home, CLAUDE_PROJECT_DIR: projectDir },
      });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout).hookSpecificOutput?.additionalContext ?? '';
    };

    const hint = run(TMUX);
    assert.ok(hint.includes('<useterminal>'), hint.slice(0, 120));
    assert.ok(!hint.includes('used actively to explain'));
    assert.ok(!run(undefined).includes('<useterminal>'));

    writeFileSync(join(configDir, 'event'), 'useterminal-proactive\n');
    assert.ok(run(TMUX).includes('used actively to explain'));
    assert.ok(!run(undefined).includes('<useterminal>'));

    // 부정은 proactive 규칙만 끈다 — hint 는 상시라 돌아온다.
    writeFileSync(join(configDir, 'event'), 'useterminal-proactive\n!useterminal-proactive\n');
    const back = run(TMUX);
    assert.ok(back.includes('<useterminal>'));
    assert.ok(!back.includes('used actively to explain'));
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

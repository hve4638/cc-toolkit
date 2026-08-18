import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import decl from '../../skills/ponytail/addon.mjs';
import { dispatch, toHookOutput } from '../../event/lib/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAIN = join(__dirname, '..', '..', 'event', 'main.mjs');

test('declaration: ponytail 은 SessionStart 를 명시 켜기로 구독한다', () => {
  assert.deepEqual(Object.keys(decl.rules), ['ponytail']);
  assert.deepEqual([...decl.rules.ponytail.events], ['SessionStart']);
  // alwaysEvents 가 없어야 규칙 게이트가 산다 — 켜기 전에는 침묵.
  assert.equal(decl.alwaysEvents, undefined);
});

test('dispatch: 스킬 본문이 frontmatter 없이 주입된다', async () => {
  const loaded = { decl, rules: { ponytail: { trigger: true } } };
  const draft = await dispatch('SessionStart', {}, [loaded]);
  const out = toHookOutput('SessionStart', draft);
  const ctx = out.hookSpecificOutput?.additionalContext;
  assert.equal(typeof ctx, 'string');
  assert.ok(ctx.startsWith('PONYTAIL MODE ACTIVE\n\n<ponytail>'), ctx.slice(0, 80));
  assert.ok(ctx.trimEnd().endsWith('</ponytail>'));
  // frontmatter 의 메타 필드가 새지 않는다.
  assert.ok(!ctx.includes('description:'));
  assert.ok(!ctx.includes('license:'));
});

// 실제 호스트 배선의 e2e — 커밋된 manifest 와 진짜 addon.mjs 를 그대로 쓴다.
// fail-open 이라 배선이 끊겨도 증상이 없으므로, 여기가 그걸 잡는 자리다.
// HOME 을 임시 디렉터리로 돌려 실제 사용자의 agentaddon 설정이 새지 않게 한다.
test('e2e: 설정 없이는 침묵, agentaddon 의 ponytail 줄이 켠다', () => {
  const projectDir = mkdtempSync(join(tmpdir(), 'ponytail-addon-test-'));
  try {
    const home = join(projectDir, 'home');
    mkdirSync(home);
    const run = () => {
      const { CLAUDE_PROJECT_DIR: _drop, ...env } = process.env;
      const result = spawnSync('node', [MAIN, 'SessionStart'], {
        encoding: 'utf8',
        input: JSON.stringify({ session_id: 'e2e-1', cwd: projectDir }),
        env: { ...env, HOME: home, CLAUDE_PROJECT_DIR: projectDir },
      });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };

    // 명시 켜기 규칙 — 줄이 없으면 발화하지 않아야 한다.
    assert.deepEqual(run(), {});

    mkdirSync(join(projectDir, '.config', 'agentaddon'), { recursive: true });
    writeFileSync(join(projectDir, '.config', 'agentaddon', 'event'), 'ponytail\n');
    const on = run();
    assert.ok(
      on.hookSpecificOutput?.additionalContext?.startsWith('PONYTAIL MODE ACTIVE'),
      JSON.stringify(on).slice(0, 120),
    );
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

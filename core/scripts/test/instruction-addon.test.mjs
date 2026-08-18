import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import decl, { createDecl, parseFragment } from '../../addon/instruction/addon.mjs';
import { dispatch, toHookOutput } from '../../event/lib/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MAIN = join(__dirname, '..', '..', 'event', 'main.mjs');

async function contextFor(source, target = decl, ruleStates = {}) {
  const loaded = { decl: target, rules: ruleStates };
  const draft = await dispatch('SessionStart', { source }, [loaded]);
  return toHookOutput('SessionStart', draft).hookSpecificOutput?.additionalContext;
}

async function withFixtureDir(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'instruction-fragments-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('declaration: alwaysEvents 로 SessionStart 게이트를 뺀다 — 배포 조각에 rule 이 없어 규칙도 없다', () => {
  assert.deepEqual(decl.rules, {});
  assert.deepEqual([...decl.alwaysEvents], ['SessionStart']);
  assert.deepEqual(Object.keys(decl.handlers), ['SessionStart']);
});

test('parseFragment: frontmatter 없으면 rule·tag 없음, 필드는 떼어져 body 에 남지 않는다', () => {
  assert.deepEqual(parseFragment('a.md', 'plain body\n'), { rule: null, tag: null, body: 'plain body' });
  assert.deepEqual(parseFragment('b.md', '---\nrule: my-toggle\n---\nbody here\n'), {
    rule: 'my-toggle',
    tag: null,
    body: 'body here',
  });
});

test('parseFragment: name 필드가 태그명이 된다 — rule 과 같이도 온다', () => {
  assert.deepEqual(parseFragment('b.md', '---\nname: pretty_tag\n---\nbody\n'), {
    rule: null,
    tag: 'pretty_tag',
    body: 'body',
  });
  assert.deepEqual(parseFragment('b.md', '---\nrule: my-toggle\nname: pretty_tag\n---\nbody\n'), {
    rule: 'my-toggle',
    tag: 'pretty_tag',
    body: 'body',
  });
  // 태그는 <...> 안에 그대로 들어간다 — 구조를 깨는 문자는 거부.
  assert.throws(() => parseFragment('b.md', '---\nname: a>b\n---\nbody\n'), /태그명/);
});

// 구조 오류 (CRLF·미종결·중복·문법 밖 줄) 의 본검증은 addonlib.test.mjs —
// 여기는 허용 필드 목록과 파일 접두어가 lib 로 배선됐는지만 핀한다.
test('parseFragment: 구조 오류는 addonlib throw 가 파일 접두어째 통과한다', () => {
  assert.throws(() => parseFragment('c.md', '---\nrul: x\n---\nbody\n'), /instructions\/c\.md.*rul: x/);
});

test('createDecl: 조각 rule 이 규칙으로 선언되고, 켜짐 상태에 따라 조각별로 주입된다', async () => {
  await withFixtureDir(async (dir) => {
    writeFileSync(join(dir, 'a_plain.md'), 'always block\n');
    writeFileSync(join(dir, 'b_ruled.md'), '---\nrule: extra-block\n---\nruled block\n');
    writeFileSync(join(dir, 'b_ruled.ko.md'), '번역 페어 — 주입 금지\n');
    const fixture = createDecl(dir);
    assert.deepEqual(Object.keys(fixture.rules), ['extra-block']);
    assert.deepEqual([...fixture.alwaysEvents], ['SessionStart']);

    // 규칙이 꺼져 있어도 (alwaysEvents 로 불린 상태) 상시 조각은 실린다.
    const base = await contextFor('startup', fixture, { 'extra-block': { trigger: false } });
    assert.equal(base, '<a_plain>\nalways block\n</a_plain>');

    // 규칙이 켜지면 파일명 정렬 순으로 둘 다.
    const both = await contextFor('startup', fixture, { 'extra-block': { trigger: true } });
    assert.equal(
      both,
      '<a_plain>\nalways block\n</a_plain>\n\n<b_ruled>\nruled block\n</b_ruled>',
    );
  });
});

test('createDecl: name 필드가 파일명 대신 태그가 되고, 태그가 겹치면 던진다', async () => {
  await withFixtureDir(async (dir) => {
    writeFileSync(join(dir, 'a_file.md'), '---\nname: renamed\n---\nbody\n');
    const fixture = createDecl(dir);
    const ctx = await contextFor('startup', fixture, { instruction: { trigger: true } });
    assert.equal(ctx, '<renamed>\nbody\n</renamed>');

    // 다른 파일이 같은 태그를 달면 조립이 죽는다.
    writeFileSync(join(dir, 'b_file.md'), '---\nname: renamed\n---\nother\n');
    assert.throws(() => createDecl(dir), /renamed/);
  });
});

test('createDecl: 빈 본문 조각은 통째로 건너뛴다 — 빈 태그 블록이 새지 않는다', async () => {
  await withFixtureDir(async (dir) => {
    writeFileSync(join(dir, 'a_real.md'), 'real\n');
    writeFileSync(join(dir, 'b_blank.md'), '\n');
    writeFileSync(join(dir, 'c_fm_only.md'), '---\nrule: ghost\n---\n');
    const fixture = createDecl(dir);
    // 건너뛴 조각의 규칙도 선언되지 않는다.
    assert.deepEqual(Object.keys(fixture.rules), []);
    const ctx = await contextFor('startup', fixture);
    assert.equal(ctx, '<a_real>\nreal\n</a_real>');
  });
});

test('startup·compact·clear: 실제 조각이 파일명 태그로 감싸여 주입된다', async () => {
  for (const source of ['startup', 'compact', 'clear']) {
    const ctx = await contextFor(source);
    assert.equal(typeof ctx, 'string', source);
    // 블록 본문이 그대로 실린다 — 태그 재조립·trim 이 내용을 건드리지 않는다.
    assert.ok(ctx.startsWith('<codex_support>\nCodex is available,'), ctx.slice(0, 80));
    assert.ok(ctx.includes('</codex_support>'));
    // ko 번역 페어는 실리지 않는다 — 같은 지시의 중복 주입 방지.
    assert.ok(!ctx.includes('.ko'));
    assert.ok(!ctx.includes('Codex 를'));
  }
});

test('resume·fork 는 건너뛴다 — 트랜스크립트 복원이 이전 주입분을 되살린다', async () => {
  assert.equal(await contextFor('resume'), undefined);
  assert.equal(await contextFor('fork'), undefined);
});

// 구식 훅 (scripts/session-start-inject.mjs) 은 배선째 남아 있고, core 에
// instruction.md 가 다시 생기면 그대로 되살아나 같은 블록이 두 번 주입된다.
// personal 의 패턴을 복붙해 오는 게 그 자연스러운 사고 경로라, 부재를 못박는다.
test('core/instruction.md 는 존재하지 않는다 — 되살리면 이중 주입', () => {
  assert.ok(!existsSync(join(__dirname, '..', '..', 'instruction.md')));
});

// 실제 호스트 배선의 e2e — 커밋된 manifest 와 진짜 addon.mjs 를 그대로 쓴다.
// fail-open 이라 배선이 끊겨도 증상이 없으므로, 여기가 그걸 잡는 자리다.
// HOME 을 임시 디렉터리로 돌려 실제 사용자의 agentaddon 설정이 새지 않게 한다.
test('e2e: 설정 없이도 startup 에서 주입되고, 부정 줄로도 꺼지지 않는다 — 상시다', () => {
  const projectDir = mkdtempSync(join(tmpdir(), 'instruction-addon-test-'));
  try {
    const home = join(projectDir, 'home');
    mkdirSync(home);
    const run = (source) => {
      // TMUX 를 떼어 useterminal 애드온의 주입이 섞이지 않게 격리한다.
      const { TMUX: _tmux, ...env } = process.env;
      const result = spawnSync('node', [MAIN, 'SessionStart'], {
        encoding: 'utf8',
        input: JSON.stringify({ session_id: 'e2e-1', cwd: projectDir, source }),
        env: { ...env, HOME: home, CLAUDE_PROJECT_DIR: projectDir },
      });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    };

    const on = run('startup');
    assert.ok(
      on.hookSpecificOutput?.additionalContext?.includes('<codex_support>'),
      JSON.stringify(on).slice(0, 120),
    );
    assert.deepEqual(run('resume'), {});

    mkdirSync(join(projectDir, '.config', 'agentaddon'), { recursive: true });
    writeFileSync(join(projectDir, '.config', 'agentaddon', 'event'), '!*\n');
    assert.ok(run('startup').hookSpecificOutput?.additionalContext?.includes('<codex_support>'));
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

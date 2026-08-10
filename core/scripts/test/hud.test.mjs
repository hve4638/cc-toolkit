import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

import { contextPercentOf, modelNameOf, rateLimitsOf } from '../../statusline/lib/hud/stdin.mjs';
import {
  formatResetTime,
  renderContext,
  renderCwd,
  renderCwdMissing,
  renderLimits,
  renderModel,
} from '../../statusline/lib/hud/elements.mjs';
import { renderGit, worktreeRootOf } from '../../statusline/lib/hud/git.mjs';
import { render as renderHud, priority } from '../../statusline/feat/hud.mjs';
import { sanitize } from '../../statusline/lib/sanitize.mjs';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

// ── stdin ────────────────────────────────────────────────────────────────

test('contextPercentOf: 페이로드가 준 퍼센트를 반올림해 쓴다', () => {
  assert.equal(contextPercentOf({ context_window: { used_percentage: 36.6 } }), 37);
});

test('contextPercentOf: 범위를 벗어난 값은 0-100 으로 자른다', () => {
  assert.equal(contextPercentOf({ context_window: { used_percentage: 140 } }), 100);
  assert.equal(contextPercentOf({ context_window: { used_percentage: -5 } }), 0);
});

test('contextPercentOf: 퍼센트가 없으면 토큰 비율로 계산한다', () => {
  const stdin = {
    context_window: {
      context_window_size: 1000,
      current_usage: { input_tokens: 200, cache_creation_input_tokens: 50 },
    },
  };
  assert.equal(contextPercentOf(stdin), 25);
});

test('contextPercentOf: 근거가 아무것도 없으면 0', () => {
  assert.equal(contextPercentOf({}), 0);
  assert.equal(contextPercentOf(null), 0);
});

test('rateLimitsOf: 두 버킷이 모두 없으면 null', () => {
  assert.equal(rateLimitsOf({}), null);
  assert.equal(rateLimitsOf({ rate_limits: {} }), null);
});

test('rateLimitsOf: 주간 버킷이 없으면 그 자리만 빈다', () => {
  const limits = rateLimitsOf({ rate_limits: { five_hour: { used_percentage: 19 } } });
  assert.equal(limits.fiveHourPercent, 19);
  assert.equal(limits.weeklyPercent, undefined);
  assert.equal(limits.fiveHourResetsAt, null);
});

test('rateLimitsOf: 리셋 시각은 초·밀리초·ISO 문자열을 모두 받는다', () => {
  const epochSeconds = 1786392894;
  const bySeconds = rateLimitsOf({ rate_limits: { five_hour: { used_percentage: 1, resets_at: epochSeconds } } });
  const byMillis = rateLimitsOf({ rate_limits: { five_hour: { used_percentage: 1, resets_at: epochSeconds * 1000 } } });
  const byIso = rateLimitsOf({ rate_limits: { five_hour: { used_percentage: 1, resets_at: '2026-08-11T09:40:00Z' } } });

  assert.equal(bySeconds.fiveHourResetsAt.getTime(), epochSeconds * 1000);
  assert.equal(byMillis.fiveHourResetsAt.getTime(), epochSeconds * 1000);
  assert.equal(byIso.fiveHourResetsAt.toISOString(), '2026-08-11T09:40:00.000Z');
});

test('modelNameOf: 표시 이름이 우선, 없으면 id, 둘 다 없으면 null', () => {
  assert.equal(modelNameOf({ model: { display_name: 'Opus 5', id: 'claude-opus-5' } }), 'Opus 5');
  assert.equal(modelNameOf({ model: { id: 'claude-opus-5' } }), 'claude-opus-5');
  assert.equal(modelNameOf({ model: {} }), null);
});

// ── elements ─────────────────────────────────────────────────────────────

test('renderCwd: 체크아웃 이름만 보여준다', () => {
  assert.equal(renderCwd('/tmp/work/cc-toolkit'), '📁 cc-toolkit');
  assert.equal(renderCwd(homedir()), '📁 ~');
  assert.equal(renderCwd('/'), '📁 /');
  assert.equal(renderCwd(''), null);
});

test('renderCwdMissing: 사라진 디렉터리는 빨간 표식', () => {
  assert.equal(renderCwdMissing(), `📁 ${RED}missing\x1b[0m`);
});

test('renderModel: 이름이 없으면 자리를 비운다', () => {
  assert.equal(renderModel('Opus 5'), '💻 Opus 5');
  assert.equal(renderModel(null), null);
});

test('renderContext: 20 미만 초록, 20-49 노랑, 50 이상 빨강', () => {
  assert.ok(renderContext(19).includes(GREEN));
  assert.ok(renderContext(20).includes(YELLOW));
  assert.ok(renderContext(49).includes(YELLOW));
  assert.ok(renderContext(50).includes(RED));
});

test('renderContext: 퍼센트는 반올림해 0-100 안에 둔다', () => {
  assert.ok(renderContext(36.6).includes('37%'));
  assert.ok(renderContext(120).includes('100%'));
});

test('formatResetTime: 하루가 넘으면 일·시간, 아니면 시간·분', () => {
  const inHours = new Date(Date.now() + (3 * 60 + 42) * 60_000);
  const inDays = new Date(Date.now() + (2 * 24 + 5) * 60 * 60_000);
  assert.equal(formatResetTime(inHours), '3h42m');
  assert.equal(formatResetTime(inDays), '2d5h');
});

test('formatResetTime: 이미 지난 시각은 null', () => {
  assert.equal(formatResetTime(new Date(Date.now() - 60_000)), null);
  assert.equal(formatResetTime(null), null);
});

test('renderLimits: 아직 한도가 안 온 세션은 기다리는 중이라고 알린다', () => {
  assert.equal(renderLimits(null), `⏳ \x1b[2mloading...\x1b[0m`);
});

test('renderLimits: 주간 버킷이 없으면 5시간만 낸다', () => {
  const line = renderLimits({ fiveHourPercent: 19, fiveHourResetsAt: null });
  assert.equal(line, `⏳ 5h:${GREEN}19%\x1b[0m`);
});

test('renderLimits: 70 부터 노랑, 90 부터 빨강', () => {
  assert.ok(renderLimits({ fiveHourPercent: 69 }).includes(GREEN));
  assert.ok(renderLimits({ fiveHourPercent: 70 }).includes(YELLOW));
  assert.ok(renderLimits({ fiveHourPercent: 90 }).includes(RED));
});

test('renderLimits: 리셋까지 남은 시간을 붙인다', () => {
  const line = renderLimits({
    fiveHourPercent: 19,
    fiveHourResetsAt: new Date(Date.now() + 90 * 60_000),
    weeklyPercent: 41,
    weeklyResetsAt: null,
  });
  assert.ok(line.includes('(1h30m)'));
  assert.ok(line.includes('wk:'));
});

// ── git ──────────────────────────────────────────────────────────────────

function withRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'hud-git-test-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe', encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'test');
  writeFileSync(join(dir, 'file.txt'), 'hello\n');
  git('add', '.');
  git('commit', '-qm', 'first');
  try {
    return fn({ dir, git });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('renderGit: 원격이 없으면 로컬 체크아웃 이름과 브랜치', () => {
  withRepo(({ dir }) => {
    const line = renderGit(dir);
    assert.ok(line.startsWith('🌿 '), line);
    assert.ok(line.includes(`(main)`), line);
  });
});

test('renderGit: 원격이 있으면 그 이름을 쓴다', () => {
  withRepo(({ dir, git }) => {
    git('remote', 'add', 'origin', 'git@github.com:someone/my-repo.git');
    assert.ok(renderGit(dir).includes('my-repo(main)'));
  });
});

test('renderGit: detached HEAD 는 짧은 커밋 해시', () => {
  withRepo(({ dir, git }) => {
    const head = git('rev-parse', '--short=7', 'HEAD').trim();
    git('checkout', '-q', '--detach');
    assert.ok(renderGit(dir).includes(`(${head})`));
  });
});

test('renderGit: 저장소 밖이면 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hud-nogit-test-'));
  try {
    assert.equal(renderGit(dir), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('worktreeRootOf: 하위 디렉터리에서도 체크아웃 루트를 답한다', () => {
  withRepo(({ dir }) => {
    const sub = join(dir, 'a', 'b');
    mkdirSync(sub, { recursive: true });
    // macOS 의 /tmp 심볼릭 링크 때문에 경로 문자열이 아니라 이름으로 비교한다.
    assert.equal(worktreeRootOf(sub).split('/').pop(), dir.split('/').pop());
  });
});

test('worktreeRootOf: 저장소 밖이면 준 디렉터리 그대로', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hud-nogit-test-'));
  try {
    assert.equal(worktreeRootOf(dir), dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── producer ─────────────────────────────────────────────────────────────

test('hud 생산자는 맨 위 밴드', () => {
  assert.equal(priority, 'high');
});

test('hud: 있는 조각을 파이프로 잇는다', () => {
  withRepo(({ dir }) => {
    const line = renderHud({
      stdin: {
        cwd: dir,
        model: { display_name: 'Opus 5' },
        context_window: { used_percentage: 37 },
        rate_limits: { five_hour: { used_percentage: 19 } },
      },
    });
    const segments = line.split(' | ');
    assert.equal(segments.length, 5);
    assert.ok(segments[0].startsWith('📁 '));
    assert.ok(segments[1].startsWith('🌿 '));
    assert.ok(segments[2].startsWith('⏳ '));
    assert.ok(segments[3].startsWith('📦 '));
    assert.ok(segments[4].startsWith('💻 '));
  });
});

test('hud: 한도가 아직 안 왔어도 그 칸은 자리를 지킨다', () => {
  withRepo(({ dir }) => {
    const line = renderHud({ stdin: { cwd: dir, context_window: { used_percentage: 5 } } });
    assert.equal(line.split(' | ').length, 4);
    assert.ok(line.includes('⏳'));
  });
});

test('hud: 시작 디렉터리가 사라졌으면 cwd·git 대신 missing 하나', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hud-gone-test-'));
  rmSync(dir, { recursive: true, force: true });

  const line = renderHud({ stdin: { cwd: dir, model: { display_name: 'Opus 5' } } });
  const segments = line.split(' | ');
  assert.equal(segments.length, 4);
  assert.ok(segments[0].includes('missing'));
  assert.ok(!line.includes('🌿'));
});

// ── sanitize ─────────────────────────────────────────────────────────────

test('sanitize: 색은 남기고 커서 조작은 지운다', () => {
  assert.equal(sanitize('\x1b[2J\x1b[H\x1b[32mok\x1b[0m'), '\x1b[32mok\x1b[0m');
  assert.equal(sanitize('\x1b[?25lhide'), 'hide');
});

test('sanitize: OSC 하이퍼링크와 단순 이스케이프를 지운다', () => {
  assert.equal(sanitize('\x1b]8;;file:///tmp\x1b\\name\x1b]8;;\x1b\\'), 'name');
  assert.equal(sanitize('\x1bMup'), 'up');
});

test('sanitize: 블록 문자를 ASCII 로 바꾼다', () => {
  assert.equal(sanitize('[███░░▒▓]'), '[###---=]');
});

test('sanitize: 줄 끝 공백을 턴다', () => {
  assert.equal(sanitize('a  \nb\t'), 'a\nb');
});

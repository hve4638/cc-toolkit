import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVENT_SRC = join(__dirname, '..', '..', 'event');
const LIB_SRC = join(__dirname, '..', 'lib');

// main.mjs 는 자기 옆의 <종류>/<이름>/index.mjs 를 부르고 ../scripts/lib 을
// import 하므로, core 의 배치를 임시 디렉터리에 그대로 재현해야 한다.
function withTree(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'event-main-test-'));
  const eventDir = join(dir, 'core', 'event');
  const libDir = join(dir, 'core', 'scripts', 'lib');
  mkdirSync(join(eventDir, 'lib'), { recursive: true });
  mkdirSync(libDir, { recursive: true });
  for (const name of ['main.mjs', 'collect.mjs']) {
    copyFileSync(join(EVENT_SRC, name), join(eventDir, name));
  }
  copyFileSync(join(EVENT_SRC, 'lib', 'index.mjs'), join(eventDir, 'lib', 'index.mjs'));
  for (const name of ['aiaddon.mjs', 'agent-memory.mjs', 'corelib.mjs']) {
    copyFileSync(join(LIB_SRC, name), join(libDir, name));
  }

  const project = join(dir, 'project');
  const home = join(dir, 'home');
  mkdirSync(join(project, '.config', 'aiaddon'), { recursive: true });
  mkdirSync(home, { recursive: true });

  const tree = {
    project,
    entries: (text) => writeFileSync(join(project, '.config', 'aiaddon', 'event'), text),
    module: (kind, name, body) => {
      mkdirSync(join(eventDir, kind, name), { recursive: true });
      writeFileSync(join(eventDir, kind, name, 'index.mjs'), body);
    },
    run: (event, options = {}) => {
      const { CLAUDE_PROJECT_DIR: _drop, ...env } = process.env;
      const result = spawnSync('node', [join(eventDir, 'main.mjs'), ...(event ? [event] : [])], {
        encoding: 'utf8',
        input: options.stdin === undefined
          ? JSON.stringify({ cwd: project, ...options.payload })
          : options.stdin,
        // 기본 cwd 를 상위로 둬 세션 루트가 payload 에서 온다는 것을 드러낸다.
        cwd: dir,
        env: { ...env, HOME: home, ...options.env },
      });
      assert.equal(result.status, 0, result.stderr);
      return JSON.parse(result.stdout);
    },
  };

  try {
    return fn(tree);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 이벤트 하나를 잡아 api 를 한 번 부르는 모듈. */
function catcher(event, body) {
  return `
    import { create } from '../../lib/index.mjs';
    const a = create();
    a.register('${event}', {}, (api, payload) => { ${body} });
    export default a;
  `;
}

test('모르는 이벤트 이름은 빈 JSON', () => {
  withTree((tree) => {
    tree.module('feat', 'one', catcher('PreToolUse', "api.permission.deny('막아');"));
    tree.entries('feat:one\n');
    assert.deepEqual(tree.run('NotAnEvent'), {});
  });
});

test('이벤트 이름이 아예 없어도 빈 JSON', () => {
  withTree((tree) => {
    assert.deepEqual(tree.run(''), {});
  });
});

test('켜진 게 없으면 빈 JSON', () => {
  withTree((tree) => {
    assert.deepEqual(tree.run('PreToolUse'), {});
  });
});

test('stdin 이 JSON 이 아니면 빈 JSON 이고 종료 코드는 0', () => {
  withTree((tree) => {
    tree.module('feat', 'one', catcher('PreToolUse', "api.permission.deny('막아');"));
    tree.entries('feat:one\n');
    assert.deepEqual(tree.run('PreToolUse', { stdin: 'JSON 아님' }), {});
  });
});

test('deny 가 훅 규약 JSON 으로 나간다', () => {
  withTree((tree) => {
    tree.module('feat', 'guard', catcher('PreToolUse', `
      if (payload.tool_name === 'Bash') api.permission.deny('bash 는 막혀 있다');
    `));
    tree.entries('feat:guard\n');

    assert.deepEqual(tree.run('PreToolUse', { payload: { tool_name: 'Bash' } }), {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'bash 는 막혀 있다',
      },
    });
  });
});

test('payload 를 보고 아무것도 안 하면 빈 JSON', () => {
  withTree((tree) => {
    tree.module('feat', 'guard', catcher('PreToolUse', `
      if (payload.tool_name === 'Bash') api.permission.deny('bash 는 막혀 있다');
    `));
    tree.entries('feat:guard\n');
    assert.deepEqual(tree.run('PreToolUse', { payload: { tool_name: 'Read' } }), {});
  });
});

test('여러 모듈의 결과가 한 JSON 으로 합쳐진다', () => {
  withTree((tree) => {
    tree.module('feat', 'denier', catcher('PreToolUse', "api.permission.deny('첫째');"));
    tree.module('feat', 'asker', catcher('PreToolUse', `
      api.permission.ask('묻기');
      api.injectContext('배경 한 줄');
    `));
    tree.entries('feat:denier\nfeat:asker\n');

    const out = tree.run('PreToolUse');
    // deny 가 ask 를 이기고, 진 종류의 사유는 버려진다.
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(out.hookSpecificOutput.permissionDecisionReason, '첫째');
    assert.equal(out.hookSpecificOutput.additionalContext, '배경 한 줄');
  });
});

test('모듈 하나가 던져도 나머지 결과는 나간다', () => {
  withTree((tree) => {
    tree.module('feat', 'broken', catcher('PreToolUse', "throw new Error('터짐');"));
    tree.module('feat', 'fine', catcher('PreToolUse', "api.notify('멀쩡하다');"));
    tree.entries('feat:broken\nfeat:fine\n');

    assert.deepEqual(tree.run('PreToolUse'), { systemMessage: '멀쩡하다' });
  });
});

test('args 가 모듈에 전달된다', () => {
  withTree((tree) => {
    tree.module('feat', 'one', catcher('PreToolUse', "api.notify(api.args.mode);"));
    tree.entries('feat:one@mode=strict\n');
    assert.deepEqual(tree.run('PreToolUse'), { systemMessage: 'strict' });
  });
});

test('Stop 의 keepGoing 은 최상위 decision 으로 나간다', () => {
  withTree((tree) => {
    tree.module('feat', 'nag', catcher('Stop', "api.turn.keepGoing('아직 안 끝났다');"));
    tree.entries('feat:nag\n');

    assert.deepEqual(tree.run('Stop', { payload: { stop_hook_active: false } }), {
      decision: 'block',
      reason: '아직 안 끝났다',
    });
  });
});

test('CLAUDE_PROJECT_DIR 이 payload.cwd 보다 앞선다', () => {
  withTree((tree) => {
    tree.module('feat', 'one', catcher('PreToolUse', "api.notify('켜졌다');"));
    tree.entries('feat:one\n');

    // 세션 루트를 형제 디렉터리로 돌리면 조상 walk 에도 설정이 없어 아무것도
    // 안 켜진다 (하위 디렉터리는 cascade 로 설정이 보이므로 못 쓴다).
    assert.deepEqual(tree.run('PreToolUse', { env: { CLAUDE_PROJECT_DIR: tree.project } }), {
      systemMessage: '켜졌다',
    });
    assert.deepEqual(tree.run('PreToolUse', { env: { CLAUDE_PROJECT_DIR: join(tree.project, '..', 'elsewhere') } }), {});
  });
});

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

// main.mjs 는 collect 를 거쳐 manifest.json 과 플러그인 루트의 addon.mjs 를
// 보고 ../scripts/lib 을 import 하므로, core 의 배치를 임시 디렉터리에 그대로
// 재현해야 한다.
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
  for (const name of ['addon-config.mjs', 'corelib.mjs']) {
    copyFileSync(join(LIB_SRC, name), join(libDir, name));
  }

  const project = join(dir, 'project');
  const home = join(dir, 'home');
  mkdirSync(join(project, '.config', 'agentaddon'), { recursive: true });
  mkdirSync(home, { recursive: true });

  const manifestEntries = [];

  const tree = {
    project,
    entries: (text) => writeFileSync(join(project, '.config', 'agentaddon', 'event'), text),
    /**
     * addon.mjs 를 core/addon/<이름>/ 에 심고 manifest 항목을 등록한다.
     * ruleEvents 값은 이벤트 배열, 또는 manifest 항목 그대로의 객체.
     * alwaysEvents 를 주면 항목의 events (설정 무관 통과 목록) 로 실린다.
     */
    install: (name, ruleEvents, source, alwaysEvents) => {
      mkdirSync(join(dir, 'core', 'addon', name), { recursive: true });
      writeFileSync(join(dir, 'core', 'addon', name, 'addon.mjs'), source);
      const rules = Object.fromEntries(
        Object.entries(ruleEvents).map(([rule, spec]) => [
          rule,
          Array.isArray(spec) ? { events: spec } : spec,
        ]),
      );
      const entry = { path: `addon/${name}/addon.mjs`, rules };
      if (alwaysEvents !== undefined) entry.events = alwaysEvents;
      manifestEntries.push(entry);
    },
    run: (event, options = {}) => {
      writeFileSync(join(eventDir, 'manifest.json'), JSON.stringify({ addons: manifestEntries }));
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

/** 규칙 하나를 구독하고 이벤트 하나를 잡는 애드온 소스. */
function catcher(rule, event, body) {
  return `
    export default {
      rules: { '${rule}': { events: ['${event}'] } },
      handlers: { ${event}(api, payload, rules) { ${body} } },
    };
  `;
}

test('모르는 이벤트 이름은 빈 JSON', () => {
  withTree((tree) => {
    tree.install('one', { 'guard-bash': ['PreToolUse'] }, catcher('guard-bash', 'PreToolUse', "api.permission.deny('막아');"));
    tree.entries('guard-bash\n');
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
    tree.install('one', { 'guard-bash': ['PreToolUse'] }, catcher('guard-bash', 'PreToolUse', "api.permission.deny('막아');"));
    tree.entries('guard-bash\n');
    assert.deepEqual(tree.run('PreToolUse', { stdin: 'JSON 아님' }), {});
  });
});

test('평평한 규칙 이름의 deny 가 훅 규약 JSON 으로 나간다', () => {
  withTree((tree) => {
    tree.install('guard', { 'guard-bash': ['PreToolUse'] }, catcher('guard-bash', 'PreToolUse', `
      if (payload.tool_name === 'Bash') api.permission.deny('bash 는 막혀 있다');
    `));
    tree.entries('guard-bash\n');

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
    tree.install('guard', { 'guard-bash': ['PreToolUse'] }, catcher('guard-bash', 'PreToolUse', `
      if (payload.tool_name === 'Bash') api.permission.deny('bash 는 막혀 있다');
    `));
    tree.entries('guard-bash\n');
    assert.deepEqual(tree.run('PreToolUse', { payload: { tool_name: 'Read' } }), {});
  });
});

test('여러 애드온의 결과가 한 JSON 으로 합쳐진다', () => {
  withTree((tree) => {
    tree.install('denier', { 'rule:deny': ['PreToolUse'] }, catcher('rule:deny', 'PreToolUse', "api.permission.deny('첫째');"));
    tree.install('asker', { 'rule:ask': ['PreToolUse'] }, catcher('rule:ask', 'PreToolUse', `
      api.permission.ask('묻기');
      api.injectContext('배경 한 줄');
    `));
    tree.entries('rule:deny\nrule:ask\n');

    const out = tree.run('PreToolUse');
    // deny 가 ask 를 이기고, 진 종류의 사유는 버려진다.
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(out.hookSpecificOutput.permissionDecisionReason, '첫째');
    assert.equal(out.hookSpecificOutput.additionalContext, '배경 한 줄');
  });
});

test('애드온 하나가 던져도 나머지 결과는 나간다', () => {
  withTree((tree) => {
    tree.install('broken', { 'rule-broken': ['PreToolUse'] }, catcher('rule-broken', 'PreToolUse', "throw new Error('터짐');"));
    tree.install('fine', { 'rule-fine': ['PreToolUse'] }, catcher('rule-fine', 'PreToolUse', "api.notify('멀쩡하다');"));
    tree.entries('rule-broken\nrule-fine\n');

    assert.deepEqual(tree.run('PreToolUse'), { systemMessage: '멀쩡하다' });
  });
});

test('args 가 규칙 상태로 핸들러에 온다', () => {
  withTree((tree) => {
    tree.install('one', { 'rule-one': ['PreToolUse'] }, catcher('rule-one', 'PreToolUse', "api.notify(rules['rule-one'].mode);"));
    tree.entries('rule-one@mode=strict\n');
    assert.deepEqual(tree.run('PreToolUse'), { systemMessage: 'strict' });
  });
});

test('직렬화 불가 값을 낸 애드온이 있어도 유효한 JSON 과 다른 애드온의 deny 가 나간다', () => {
  withTree((tree) => {
    tree.install('cyclic', { 'rule-cyclic': ['PreToolUse'] }, catcher('rule-cyclic', 'PreToolUse', `
      const cyclic = {}; cyclic.self = cyclic;
      api.tool.rewrite(cyclic);
    `));
    tree.install('denier', { 'rule-deny': ['PreToolUse'] }, catcher('rule-deny', 'PreToolUse', "api.permission.deny('막아');"));
    tree.entries('rule-cyclic\nrule-deny\n');

    // run 이 exit 0 과 JSON.parse 가능한 stdout 을 이미 단언한다.
    const out = tree.run('PreToolUse');
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal('updatedInput' in out.hookSpecificOutput, false);
  });
});

test('Stop 의 keepGoing 은 최상위 decision 으로 나간다', () => {
  withTree((tree) => {
    tree.install('nag', { 'rule-nag': ['Stop'] }, catcher('rule-nag', 'Stop', "api.turn.keepGoing('아직 안 끝났다');"));
    tree.entries('rule-nag\n');

    assert.deepEqual(tree.run('Stop', { payload: { stop_hook_active: false } }), {
      decision: 'block',
      reason: '아직 안 끝났다',
    });
  });
});

test('alwaysEvents 애드온은 설정 없이 발화하고, 규칙을 켜면 핸들러 분기가 바뀐다', () => {
  withTree((tree) => {
    tree.install('ctx', { 'cwd-context': ['SessionStart'] }, `
      export default {
        rules: { 'cwd-context': { events: ['SessionStart'] } },
        alwaysEvents: ['SessionStart'],
        handlers: {
          SessionStart(api, payload, rules) {
            api.injectContext(rules['cwd-context'].trigger ? '켜진 안내' : '기본 안내');
          },
        },
      };
    `, ['SessionStart']);

    // 설정 파일이 아예 없다 — 규칙은 꺼진 채 기본 분기가 돈다.
    assert.deepEqual(tree.run('SessionStart'), {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: '기본 안내',
      },
    });

    tree.entries('cwd-context\n');
    assert.equal(tree.run('SessionStart').hookSpecificOutput.additionalContext, '켜진 안내');
  });
});

test('CLAUDE_PROJECT_DIR 이 payload.cwd 보다 앞선다', () => {
  withTree((tree) => {
    tree.install('one', { 'rule-one': ['PreToolUse'] }, catcher('rule-one', 'PreToolUse', "api.notify('켜졌다');"));
    tree.entries('rule-one\n');

    // 세션 루트를 형제 디렉터리로 돌리면 조상 walk 에도 설정이 없어 아무것도
    // 안 켜진다 (하위 디렉터리는 cascade 로 설정이 보이므로 못 쓴다).
    assert.deepEqual(tree.run('PreToolUse', { env: { CLAUDE_PROJECT_DIR: tree.project } }), {
      systemMessage: '켜졌다',
    });
    assert.deepEqual(tree.run('PreToolUse', { env: { CLAUDE_PROJECT_DIR: join(tree.project, '..', 'elsewhere') } }), {});
  });
});

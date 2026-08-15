import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_COLLECT = join(__dirname, '..', '..', 'event', 'collect.mjs');
const SRC_LIB = join(__dirname, '..', '..', 'event', 'lib', 'index.mjs');
const SRC_ADDON_CONFIG = join(__dirname, '..', 'lib', 'addon-config.mjs');
const SRC_CORELIB = join(__dirname, '..', 'lib', 'corelib.mjs');

// collect 는 자기 옆의 manifest.json 과 플러그인 루트 기준 상대 경로의 addon.mjs
// 를 보므로, core 의 배치를 임시 디렉터리에 그대로 재현해야 한다.
async function withTree(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'event-collect-test-'));
  const eventDir = join(dir, 'core', 'event');
  mkdirSync(join(eventDir, 'lib'), { recursive: true });
  mkdirSync(join(dir, 'core', 'scripts', 'lib'), { recursive: true });
  copyFileSync(SRC_COLLECT, join(eventDir, 'collect.mjs'));
  copyFileSync(SRC_LIB, join(eventDir, 'lib', 'index.mjs'));
  copyFileSync(SRC_ADDON_CONFIG, join(dir, 'core', 'scripts', 'lib', 'addon-config.mjs'));
  copyFileSync(SRC_CORELIB, join(dir, 'core', 'scripts', 'lib', 'corelib.mjs'));

  const project = join(dir, 'project');
  const home = join(dir, 'home');
  mkdirSync(join(project, '.config', 'agentaddon'), { recursive: true });
  mkdirSync(home, { recursive: true });

  // 임시 디렉터리마다 URL 이 달라 ESM 캐시가 테스트끼리 섞이지 않는다.
  const { collect } = await import(pathToFileURL(join(eventDir, 'collect.mjs')).href);

  // install 로 심은 애드온에서 manifest 를 자동으로 굽되, manifest() 로 직접
  // 덮어써 낡은·깨진 manifest 시나리오도 만들 수 있게 한다.
  const autoEntries = [];
  let manualManifest = null;

  const tree = {
    project,
    entries: (text) => writeFileSync(join(project, '.config', 'agentaddon', 'event'), text),
    /**
     * addon.mjs 를 심고 manifest 항목을 등록한다. base 는 'addon' 또는 'skills'.
     * ruleEvents 값은 이벤트 배열, 또는 manifest 항목 그대로의 객체
     * ({ events, enabledByDefault }).
     */
    install: (base, name, ruleEvents, source) => {
      mkdirSync(join(dir, 'core', base, name), { recursive: true });
      writeFileSync(join(dir, 'core', base, name, 'addon.mjs'), source);
      const rules = Object.fromEntries(
        Object.entries(ruleEvents).map(([rule, spec]) => [
          rule,
          Array.isArray(spec) ? { events: spec } : spec,
        ]),
      );
      autoEntries.push({ path: `${base}/${name}/addon.mjs`, rules });
    },
    manifest: (obj) => { manualManifest = obj; },
    collect: (event) => {
      const manifest = manualManifest ?? { addons: autoEntries };
      writeFileSync(join(eventDir, 'manifest.json'), JSON.stringify(manifest));
      return collect(project, event);
    },
  };

  const savedHome = process.env.HOME;
  process.env.HOME = home;
  try {
    return await fn(tree);
  } finally {
    if (savedHome === undefined) delete process.env.HOME;
    else process.env.HOME = savedHome;
    rmSync(dir, { recursive: true, force: true });
  }
}

/** 규칙 하나를 구독하고 이벤트 하나를 잡는 애드온 소스. */
function catcher(rule, event, body = '') {
  return `
    export default {
      rules: { '${rule}': { events: ['${event}'] } },
      handlers: { ${event}(api, payload, rules) { ${body} } },
    };
  `;
}

test('켜진 게 없으면 빈 배열', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'one', { 'rule-one': ['PreToolUse'] }, catcher('rule-one', 'PreToolUse'));
    assert.deepEqual(await tree.collect('PreToolUse'), []);
  });
});

test('manifest 가 없으면 빈 배열', async () => {
  await withTree(async (tree) => {
    tree.entries('rule-one\n');
    tree.manifest(null); // JSON 'null' — addons 배열이 없다
    assert.deepEqual(await tree.collect('PreToolUse'), []);
  });
});

test('켜진 규칙이 애드온을 불러오고 rules 상태가 붙어 온다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'one', { 'rule-one': ['PreToolUse'] }, catcher('rule-one', 'PreToolUse'));
    tree.entries('rule-one\n');

    const loaded = await tree.collect('PreToolUse');
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].rules, { 'rule-one': { trigger: true } });
    assert.equal(typeof loaded[0].decl.handlers.PreToolUse, 'function');
  });
});

test('규칙 이름과 무관한 위치의 스킬 애드온도 불러온다', async () => {
  await withTree(async (tree) => {
    // 이름상 아무 관련 없는 skills/zxcv 가 규칙 abcd 를 구독한다.
    tree.install('skills', 'zxcv', { abcd: ['Stop'] }, catcher('abcd', 'Stop'));
    tree.entries('abcd\n');

    const loaded = await tree.collect('Stop');
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].rules, { abcd: { trigger: true } });
  });
});

test('이번 이벤트를 선언하지 않은 규칙만 켜져 있으면 안 불러온다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'one', { 'rule-one': ['Stop'] }, catcher('rule-one', 'Stop'));
    tree.entries('rule-one\n');
    assert.deepEqual(await tree.collect('PreToolUse'), []);
  });
});

test('꺼진 형제 규칙은 trigger:false 로 실려 온다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'showcase', {
      'showcase-light': ['SessionStart'],
      'showcase-heavy': ['SessionStart', 'PreToolUse'],
    }, `
      export default {
        rules: {
          'showcase-light': { events: ['SessionStart'] },
          'showcase-heavy': { events: ['SessionStart', 'PreToolUse'] },
        },
        handlers: { SessionStart() {}, PreToolUse() {} },
      };
    `);
    tree.entries('showcase-light\n');

    const [atStart] = await tree.collect('SessionStart');
    assert.deepEqual(atStart.rules, {
      'showcase-light': { trigger: true },
      'showcase-heavy': { trigger: false },
    });

    // PreToolUse 는 heavy 만 선언했고 heavy 는 꺼져 있다 — 애드온이 안 불린다.
    assert.deepEqual(await tree.collect('PreToolUse'), []);
  });
});

test('항목의 args 가 규칙 상태로 오고 trigger 인자는 무시된다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'one', { 'rule-one': ['Stop'] }, catcher('rule-one', 'Stop'));
    tree.entries('rule-one@mode=strict,trigger=no\n');

    const [loaded] = await tree.collect('Stop');
    assert.deepEqual(loaded.rules, { 'rule-one': { mode: 'strict', trigger: true } });
  });
});

test('manifest 가 가리키는 파일이 없으면 건너뛴다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'real', { 'rule-real': ['Stop'] }, catcher('rule-real', 'Stop'));
    tree.manifest({
      addons: [
        { path: 'addon/nothing-here/addon.mjs', rules: { 'rule-ghost': { events: ['Stop'] } } },
        { path: 'addon/real/addon.mjs', rules: { 'rule-real': { events: ['Stop'] } } },
      ],
    });
    tree.entries('rule-ghost\nrule-real\n');

    assert.equal((await tree.collect('Stop')).length, 1);
  });
});

test('import 이 던지는 애드온은 건너뛴다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'broken', { 'rule-broken': ['Stop'] }, 'throw new Error("import 중에 터짐");');
    tree.install('addon', 'real', { 'rule-real': ['Stop'] }, catcher('rule-real', 'Stop'));
    tree.entries('rule-broken\nrule-real\n');

    assert.equal((await tree.collect('Stop')).length, 1);
  });
});

test('선언을 default 로 내놓지 않는 애드온은 건너뛴다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'no-default', { 'rule-a': ['Stop'] }, 'export const something = 1;');
    tree.install('addon', 'wrong-shape', { 'rule-b': ['Stop'] }, 'export default { rules: "객체가 아님", handlers: {} };');
    tree.entries('rule-a\nrule-b\n');

    assert.deepEqual(await tree.collect('Stop'), []);
  });
});

test('manifest 가 낡아 선언과 어긋나면 그 애드온은 빠진다', async () => {
  await withTree(async (tree) => {
    // manifest 는 rule-old 가 Stop 을 선언한다고 하지만, 실제 선언은 rule-new 다.
    tree.install('addon', 'renamed', { 'rule-old': ['Stop'] }, catcher('rule-new', 'Stop'));
    tree.entries('rule-old\n');
    assert.deepEqual(await tree.collect('Stop'), []);
  });
});

test('한 규칙을 두 애드온이 구독하면 둘 다 온다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'first', { shared: ['Stop'] }, catcher('shared', 'Stop'));
    tree.install('skills', 'second', { shared: ['Stop'] }, catcher('shared', 'Stop'));
    tree.entries('shared\n');

    assert.equal((await tree.collect('Stop')).length, 2);
  });
});

test('이번 이벤트에 안 걸린 애드온은 import 조차 안 된다', async () => {
  await withTree(async (tree) => {
    // import 시점 부수효과는 애드온에게 금지지만, 여기서는 "안 불릴 애드온은
    // import 자체가 없다" 를 관측하는 프로브로 쓴다.
    const marker = join(tree.project, 'probe-marker');
    tree.install('addon', 'probe', { 'rule-off': ['Stop'] }, `
      import { writeFileSync } from 'node:fs';
      writeFileSync(${JSON.stringify(marker)}, 'imported');
      export default { rules: { 'rule-off': { events: ['Stop'] } }, handlers: { Stop() {} } };
    `);
    tree.install('addon', 'live', { 'rule-live': ['Stop'] }, catcher('rule-live', 'Stop'));
    tree.entries('rule-live\n');

    const loaded = await tree.collect('Stop');
    assert.equal(loaded.length, 1);
    assert.equal(existsSync(marker), false);
  });
});

/** 기본 켜짐 규칙 하나를 구독하는 애드온 소스. */
function defaultCatcher(rule, event) {
  return `
    export default {
      rules: { '${rule}': { events: ['${event}'], enabledByDefault: true } },
      handlers: { ${event}() {} },
    };
  `;
}

const DEFAULT_ON = (event) => ({ events: [event], enabledByDefault: true });

test('기본 켜짐 규칙은 설정이 아예 없어도 불려 온다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'ctx', { 'cwd-context': DEFAULT_ON('SessionStart') },
      defaultCatcher('cwd-context', 'SessionStart'));

    const loaded = await tree.collect('SessionStart');
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].rules, { 'cwd-context': { trigger: true } });
  });
});

test('부정이 기본 켜짐 규칙을 끈다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'ctx', { 'cwd-context': DEFAULT_ON('SessionStart') },
      defaultCatcher('cwd-context', 'SessionStart'));
    tree.entries('!cwd-context\n');

    assert.deepEqual(await tree.collect('SessionStart'), []);
  });
});

test('부정 뒤에 다시 켠 줄이 이긴다 — 인자도 실린다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'ctx', { 'cwd-context': DEFAULT_ON('SessionStart') },
      defaultCatcher('cwd-context', 'SessionStart'));
    tree.entries('!cwd-*\ncwd-context@lang=ko\n');

    const [loaded] = await tree.collect('SessionStart');
    assert.deepEqual(loaded.rules, { 'cwd-context': { lang: 'ko', trigger: true } });
  });
});

test('부정된 기본 켜짐 애드온은 import 조차 안 된다 — manifest 사전 필터가 판정을 공유', async () => {
  await withTree(async (tree) => {
    const marker = join(tree.project, 'probe-marker');
    tree.install('addon', 'probe', { 'cwd-context': DEFAULT_ON('SessionStart') }, `
      import { writeFileSync } from 'node:fs';
      writeFileSync(${JSON.stringify(marker)}, 'imported');
      export default {
        rules: { 'cwd-context': { events: ['SessionStart'], enabledByDefault: true } },
        handlers: { SessionStart() {} },
      };
    `);
    tree.entries('!cwd-context\n');

    assert.deepEqual(await tree.collect('SessionStart'), []);
    assert.equal(existsSync(marker), false);
  });
});

test('manifest 만 기본 켜짐이라 해도 선언이 아니면 안 불린다 — 선언이 기준', async () => {
  await withTree(async (tree) => {
    // manifest 는 낡아서 기본 켜짐이라 하지만 실제 선언은 아니다.
    tree.install('addon', 'ctx', { 'cwd-context': DEFAULT_ON('SessionStart') },
      catcher('cwd-context', 'SessionStart'));

    assert.deepEqual(await tree.collect('SessionStart'), []);
  });
});

test('선언만 기본 켜짐이고 manifest 에 플래그가 빠졌으면 못 찾는다 — 낡은 manifest 의 한계', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'ctx', { 'cwd-context': ['SessionStart'] },
      defaultCatcher('cwd-context', 'SessionStart'));

    assert.deepEqual(await tree.collect('SessionStart'), []);
  });
});

test('!패턴 으로 끈 규칙은 불러오지 않는다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'one', { 'rule-one': ['Stop'] }, catcher('rule-one', 'Stop'));
    tree.install('addon', 'two', { 'rule-two': ['Stop'] }, catcher('rule-two', 'Stop'));
    tree.entries('rule-one\nrule-two\n!rule-one\n');

    const loaded = await tree.collect('Stop');
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].rules, { 'rule-two': { trigger: true } });
  });
});

// 규칙 없는 상시 애드온 — manifest 항목은 { path, events } 형태다.
test('상시 애드온은 설정이 비어 있어도 로드되고 규칙 상태는 빈 객체다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'always', {}, `
      export default { handlers: { PostToolUse() {} } };
    `);
    tree.manifest({ addons: [{ path: 'addon/always/addon.mjs', events: ['PostToolUse'] }] });

    const loaded = await tree.collect('PostToolUse');
    assert.equal(loaded.length, 1);
    assert.deepEqual(loaded[0].rules, {});

    // 이벤트가 안 맞으면 사전 필터에서 빠진다.
    assert.deepEqual(await tree.collect('Stop'), []);
  });
});

test('상시 애드온은 부정 줄로도 꺼지지 않는다 — 이름이 없다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'always', {}, `
      export default { handlers: { PostToolUse() {} } };
    `);
    tree.manifest({ addons: [{ path: 'addon/always/addon.mjs', events: ['PostToolUse'] }] });
    tree.entries('!*\n');
    assert.equal((await tree.collect('PostToolUse')).length, 1);
  });
});

test('낡은 manifest: 상시 항목인데 선언이 규칙형이면 선언이 이긴다 — 안 켜져 있으면 빠진다', async () => {
  await withTree(async (tree) => {
    tree.install('addon', 'ruled', {}, `
      export default {
        rules: { 'some-rule': { events: ['PostToolUse'] } },
        handlers: { PostToolUse() {} },
      };
    `);
    tree.manifest({ addons: [{ path: 'addon/ruled/addon.mjs', events: ['PostToolUse'] }] });
    // 사전 필터는 통과하지만 selectRules 가 null — 켜진 규칙이 없다.
    assert.deepEqual(await tree.collect('PostToolUse'), []);
  });
});

test('낡은 manifest: 기본 켜짐 규칙형 항목인데 선언이 상시면 — 재생성 전에는 부정 줄이 사전 필터를 막는다', async () => {
  await withTree(async (tree) => {
    // 이번 전환이 개발 중 실제로 만드는 방향: 선언은 상시로 바꿨는데 manifest
    // 는 아직 기본 켜짐 규칙형. 낡음의 한계를 문서화한다 — 낡은 manifest 는
    // event-manifest.test.mjs 의 실스캔 diff 가 잡는다.
    tree.install('addon', 'always', {}, `
      export default { handlers: { PostToolUse() {} } };
    `);
    tree.manifest({
      addons: [{
        path: 'addon/always/addon.mjs',
        rules: { 'old-name': { events: ['PostToolUse'], enabledByDefault: true } },
      }],
    });

    // 설정이 없으면 기본 켜짐으로 사전 필터를 통과하고, 선언(상시)이 로드를 정한다.
    assert.equal((await tree.collect('PostToolUse')).length, 1);
    // 부정 줄은 사전 필터에서 옛 이름을 죽여 상시인데도 안 불린다 — 낡음의 대가.
    tree.entries('!old-name\n');
    assert.deepEqual(await tree.collect('PostToolUse'), []);
  });
});

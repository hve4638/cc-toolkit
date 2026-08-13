import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC_COLLECT = join(__dirname, '..', '..', 'event', 'collect.mjs');
const SRC_LIB = join(__dirname, '..', '..', 'event', 'lib', 'index.mjs');
const SRC_AIADDON = join(__dirname, '..', 'lib', 'aiaddon.mjs');

// collect 는 자기 옆의 <종류>/<이름>/index.mjs 를 부르므로, 가짜 모듈을 심으려면
// core 의 배치를 임시 디렉터리에 그대로 재현해야 한다.
async function withTree(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'event-collect-test-'));
  const eventDir = join(dir, 'core', 'event');
  mkdirSync(join(eventDir, 'lib'), { recursive: true });
  mkdirSync(join(dir, 'core', 'scripts', 'lib'), { recursive: true });
  copyFileSync(SRC_COLLECT, join(eventDir, 'collect.mjs'));
  copyFileSync(SRC_LIB, join(eventDir, 'lib', 'index.mjs'));
  copyFileSync(SRC_AIADDON, join(dir, 'core', 'scripts', 'lib', 'aiaddon.mjs'));

  const project = join(dir, 'project');
  const home = join(dir, 'home');
  mkdirSync(join(project, '.config', 'aiaddon'), { recursive: true });
  mkdirSync(home, { recursive: true });

  // 임시 디렉터리마다 URL 이 달라 ESM 캐시가 테스트끼리 섞이지 않는다.
  const { collect } = await import(pathToFileURL(join(eventDir, 'collect.mjs')).href);

  const tree = {
    entries: (text) => writeFileSync(join(project, '.config', 'aiaddon', 'event'), text),
    module: (kind, name, body) => {
      mkdirSync(join(eventDir, kind, name), { recursive: true });
      writeFileSync(join(eventDir, kind, name, 'index.mjs'), body);
    },
    collect: () => collect(project),
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

/** 이벤트 하나를 잡고 컨텍스트 한 줄을 적는 모듈. */
function catcher(event, text) {
  return `
    import { create } from '../../lib/index.mjs';
    const a = create();
    a.register('${event}', {}, (api) => api.injectContext('${text}'));
    export default a;
  `;
}

test('켜진 게 없으면 빈 배열', async () => {
  await withTree(async (tree) => {
    assert.deepEqual(await tree.collect(), []);
  });
});

test('켜진 모듈을 적힌 순서대로 불러온다', async () => {
  await withTree(async (tree) => {
    tree.module('feat', 'first', catcher('PreToolUse', '첫째'));
    tree.module('rule', 'second', catcher('PreToolUse', '둘째'));
    tree.entries('feat:first\nrule:second\n');

    const modules = await tree.collect();
    assert.equal(modules.length, 2);
    assert.deepEqual(
      modules.map((m) => m.addon.registrations[0].event),
      ['PreToolUse', 'PreToolUse'],
    );
  });
});

test('항목의 args 가 모듈에 붙어 온다', async () => {
  await withTree(async (tree) => {
    tree.module('feat', 'one', catcher('Stop', '아무거나'));
    tree.entries('feat:one@mode=strict,quiet\n');

    const [module] = await tree.collect();
    assert.deepEqual({ ...module.args }, { mode: 'strict', quiet: true });
  });
});

test('파일이 없는 항목은 건너뛴다', async () => {
  await withTree(async (tree) => {
    tree.module('feat', 'real', catcher('Stop', '있다'));
    tree.entries('feat:nothing-here\nfeat:real\n');

    assert.equal((await tree.collect()).length, 1);
  });
});

test('import 이 던지는 모듈은 건너뛴다', async () => {
  await withTree(async (tree) => {
    tree.module('feat', 'broken', 'throw new Error("import 중에 터짐");');
    tree.module('feat', 'real', catcher('Stop', '있다'));
    tree.entries('feat:broken\nfeat:real\n');

    assert.equal((await tree.collect()).length, 1);
  });
});

test('addon 을 default 로 내놓지 않는 모듈은 건너뛴다', async () => {
  await withTree(async (tree) => {
    tree.module('feat', 'no-default', 'export const something = 1;');
    tree.module('feat', 'wrong-shape', 'export default { registrations: "배열이 아님" };');
    tree.entries('feat:no-default\nfeat:wrong-shape\n');

    assert.deepEqual(await tree.collect(), []);
  });
});

test('다른 이벤트를 잡는 모듈도 그대로 실려온다 — 거르는 것은 dispatch 다', async () => {
  await withTree(async (tree) => {
    tree.module('feat', 'stopper', catcher('Stop', '멈춤'));
    tree.entries('feat:stopper\n');

    const modules = await tree.collect();
    assert.equal(modules.length, 1);

    const { dispatch } = await import('../../event/lib/index.mjs');
    assert.deepEqual((await dispatch('PreToolUse', {}, modules)).context, []);
    assert.deepEqual(
      (await dispatch('Stop', { stop_hook_active: false }, modules)).context,
      ['멈춤'],
    );
  });
});

test('!패턴 으로 끈 항목은 불러오지 않는다', async () => {
  await withTree(async (tree) => {
    tree.module('feat', 'one', catcher('Stop', '하나'));
    tree.module('feat', 'two', catcher('Stop', '둘'));
    tree.entries('feat:one\nfeat:two\n!feat:one\n');

    const modules = await tree.collect();
    assert.equal(modules.length, 1);
    assert.equal(modules[0].addon.registrations.length, 1);
  });
});

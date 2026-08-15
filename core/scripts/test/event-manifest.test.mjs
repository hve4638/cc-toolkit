import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildManifest } from '../../event/build-manifest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = join(__dirname, '..', '..');

// addon.mjs 를 고치고 생성기를 안 돌리면 collect 가 낡은 표를 보고 조용히
// 어긋난다 — 증상이 없는 그 실패를 여기서 잡는다.
test('커밋된 manifest.json 이 실스캔과 같다', async () => {
  const committed = JSON.parse(readFileSync(join(CORE_ROOT, 'event', 'manifest.json'), 'utf-8'));
  assert.deepEqual(
    committed,
    await buildManifest(CORE_ROOT),
    'manifest.json 이 낡았다 — node core/event/build-manifest.mjs 를 돌려 갱신하라',
  );
});

async function withRoot(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'event-manifest-test-'));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function install(root, base, name, source) {
  mkdirSync(join(root, base, name), { recursive: true });
  writeFileSync(join(root, base, name, 'addon.mjs'), source);
}

const DECL = `
  export default {
    rules: { 'some-rule': { events: ['Stop'] } },
    handlers: { Stop() {} },
  };
`;

test('addon 과 skills 두 트리를 훑고 경로·규칙을 적는다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'one', DECL);
    install(root, 'skills', 'two', `
      export default {
        rules: { abcd: { events: ['PreToolUse', 'Stop'] } },
        handlers: { PreToolUse() {} },
      };
    `);

    assert.deepEqual(await buildManifest(root), {
      addons: [
        { path: 'addon/one/addon.mjs', rules: { 'some-rule': { events: ['Stop'] } } },
        { path: 'skills/two/addon.mjs', rules: { abcd: { events: ['PreToolUse', 'Stop'] } } },
      ],
    });
  });
});

test('addon.mjs 가 없는 폴더와 없는 트리는 조용히 지나간다', async () => {
  await withRoot(async (root) => {
    mkdirSync(join(root, 'addon', 'empty'), { recursive: true });
    install(root, 'addon', 'real', DECL);
    // skills 트리 자체가 없다.
    const manifest = await buildManifest(root);
    assert.deepEqual(manifest.addons.map((a) => a.path), ['addon/real/addon.mjs']);
  });
});

test('던지는 addon.mjs 는 생성기를 그대로 죽인다 — 런타임과 달리 strict', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'broken', 'throw new Error("import 중에 터짐");');
    await assert.rejects(buildManifest(root));
  });
});

test('선언이 아닌 default 는 경고하고 건너뛴다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'bad', 'export default { rules: 1, handlers: {} };');
    install(root, 'addon', 'good', DECL);
    const manifest = await buildManifest(root);
    assert.deepEqual(manifest.addons.map((a) => a.path), ['addon/good/addon.mjs']);
  });
});

test('.alias 스킬은 건너뛴다 — 같은 핸들러가 두 번 돌지 않게', async () => {
  await withRoot(async (root) => {
    install(root, 'skills', 'original', DECL);
    install(root, 'skills', 'copy', DECL);
    writeFileSync(join(root, 'skills', 'copy', '.alias'), 'original');
    const manifest = await buildManifest(root);
    assert.deepEqual(manifest.addons.map((a) => a.path), ['skills/original/addon.mjs']);
  });
});

test('폴더 이름순으로 훑어 결과가 결정적이다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'zebra', DECL);
    install(root, 'addon', 'alpha', DECL);
    const manifest = await buildManifest(root);
    assert.deepEqual(manifest.addons.map((a) => a.path), ['addon/alpha/addon.mjs', 'addon/zebra/addon.mjs']);
  });
});

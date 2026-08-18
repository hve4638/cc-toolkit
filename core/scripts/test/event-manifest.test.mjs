import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { availableRulesText, buildManifest } from '../../event/build-manifest.mjs';

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

// /available-addon-rule 스킬이 그대로 보여주는 파일 — 낡으면 사용자가 없는
// 규칙을 안내받거나 새 규칙을 못 본다.
test('커밋된 available-rules.txt 가 실스캔과 같다', async () => {
  const committed = readFileSync(
    join(CORE_ROOT, 'skills', 'available-addon-rule', 'available-rules.txt'),
    'utf-8',
  );
  assert.equal(
    committed,
    availableRulesText(await buildManifest(CORE_ROOT)),
    'available-rules.txt 가 낡았다 — node core/event/build-manifest.mjs 를 돌려 갱신하라',
  );
});

test('availableRulesText 는 규칙 이름을 정렬·중복 제거해 한 줄에 하나씩 담는다', () => {
  const manifest = {
    addons: [
      { path: 'addon/z/addon.mjs', rules: { zebra: { events: ['Stop'] }, alpha: { events: ['Stop'] } } },
      { path: 'skills/a/addon.mjs', rules: { alpha: { events: ['SessionStart'] } } },
    ],
  };
  assert.equal(availableRulesText(manifest), 'alpha\nzebra\n');
});

test('availableRulesText 는 alwaysEvents 애드온의 규칙도 싣는다 — 규칙은 전부 켤 수 있는 플래그다', () => {
  const manifest = {
    addons: [
      {
        path: 'addon/a/addon.mjs',
        rules: { alpha: { events: ['SessionStart'] } },
        events: ['SessionStart'],
      },
    ],
  };
  assert.equal(availableRulesText(manifest), 'alpha\n');
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

test('alwaysEvents 선언은 항목의 events 로 실린다 — 규칙과 나란히', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'always-rule', `
      export default {
        rules: { 'my-flag': { events: ['SessionStart'] } },
        alwaysEvents: ['SessionStart'],
        handlers: { SessionStart() {} },
      };
    `);
    assert.deepEqual(await buildManifest(root), {
      addons: [{
        path: 'addon/always-rule/addon.mjs',
        rules: { 'my-flag': { events: ['SessionStart'] } },
        events: ['SessionStart'],
      }],
    });
  });
});

test('규칙 0개 + alwaysEvents 도 규칙 애드온 형태로 실린다 — 데이터 조립 선언은 규칙 개수가 오간다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'data-driven', `
      export default {
        rules: {},
        alwaysEvents: ['SessionStart'],
        handlers: { SessionStart() {} },
      };
    `);
    assert.deepEqual(await buildManifest(root), {
      addons: [{ path: 'addon/data-driven/addon.mjs', rules: {}, events: ['SessionStart'] }],
    });
  });
});

test('규칙 선언의 모르는 최상위 키는 생성기를 죽인다 — alwaysEvents 오타가 게이트를 조용히 남기는 것 방지', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'typo-always', `
      export default {
        rules: { 'my-flag': { events: ['SessionStart'] } },
        alwaysEvent: ['SessionStart'],
        handlers: { SessionStart() {} },
      };
    `);
    await assert.rejects(buildManifest(root), /alwaysEvent/);
  });
});

test('rules 없이 alwaysEvents 만 쓴 선언은 생성기를 죽인다 — 상시 애드온의 다른 철자다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'redundant', `
      export default {
        alwaysEvents: ['SessionStart'],
        handlers: { SessionStart() {} },
      };
    `);
    await assert.rejects(buildManifest(root), /alwaysEvents 는 무의미/);
  });
});

test('형식이 틀린 alwaysEvents 는 생성기를 죽인다 — 런타임은 없음으로 취급해 무증상이다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'bad-shape', `
      export default {
        rules: { r: { events: ['SessionStart'] } },
        alwaysEvents: 'SessionStart',
        handlers: { SessionStart() {} },
      };
    `);
    await assert.rejects(buildManifest(root), /alwaysEvents/);
  });
  await withRoot(async (root) => {
    install(root, 'addon', 'bad-name', `
      export default {
        rules: { r: { events: ['SessionStart'] } },
        alwaysEvents: ['Sessionstart'],
        handlers: { SessionStart() {} },
      };
    `);
    await assert.rejects(buildManifest(root), /Sessionstart/);
  });
});

test('핸들러 없는 이벤트를 alwaysEvents 에 적으면 생성기를 죽인다 — 영영 안 발화하는 무증상 실패', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'dead-always', `
      export default {
        rules: { r: { events: ['SessionStart'] } },
        alwaysEvents: ['SessionStart', 'Stop'],
        handlers: { SessionStart() {} },
      };
    `);
    await assert.rejects(buildManifest(root), /Stop/);
  });
});

test('agentaddon 이름 문법을 벗어난 규칙 이름은 생성기를 죽인다', async () => {
  await withRoot(async (root) => {
    // 설정 줄로 켤 수도 끌 수도 없는 이름 — 영영 안 켜지는 오타다.
    install(root, 'addon', 'typo', `
      export default {
        rules: { cwd_context: { events: ['SessionStart'] } },
        handlers: { SessionStart() {} },
      };
    `);
    await assert.rejects(buildManifest(root), /cwd_context/);
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
    install(root, 'addon', 'alpha', `
      export default {
        rules: { 'other-rule': { events: ['Stop'] } },
        handlers: { Stop() {} },
      };
    `);
    const manifest = await buildManifest(root);
    assert.deepEqual(manifest.addons.map((a) => a.path), ['addon/alpha/addon.mjs', 'addon/zebra/addon.mjs']);
  });
});

// 규칙 없는 상시 애드온의 manifest 항목은 { path, events } — 이벤트는 핸들러 키.
test('규칙 없는 선언은 events 항목으로 실린다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'always', `
      export default { handlers: { PostToolUse() {}, Stop() {} } };
    `);
    assert.deepEqual(await buildManifest(root), {
      addons: [{ path: 'addon/always/addon.mjs', events: ['PostToolUse', 'Stop'] }],
    });
  });
});

test('상시 애드온의 오타 난 핸들러 키는 생성기를 죽인다 — 영영 안 발화하는 무증상 실패', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'typo', `
      export default { handlers: { Sessionstart() {} } };
    `);
    await assert.rejects(buildManifest(root), /Sessionstart/);
  });
});

test('두 애드온이 같은 규칙 이름을 선언하면 생성기를 죽인다 — 한 줄이 둘 다 켜는 조용한 겹침 방지', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'one', DECL);
    install(root, 'skills', 'two', DECL);
    await assert.rejects(buildManifest(root), /some-rule.*addon\/one\/addon\.mjs/);
  });
});

test('availableRulesText 는 상시 애드온을 싣지 않는다 — 이름이 없다', () => {
  const manifest = {
    addons: [
      { path: 'addon/a/addon.mjs', rules: { alpha: { events: ['Stop'] } } },
      { path: 'addon/b/addon.mjs', events: ['PostToolUse'] },
    ],
  };
  assert.equal(availableRulesText(manifest), 'alpha\n');
});

test('상시 선언의 모르는 최상위 키는 생성기를 죽인다 — rules 오타가 상시로 뒤집히는 것 방지', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'typo-rules', `
      export default {
        rule: { 'my-rule': { events: ['PostToolUse'] } },
        handlers: { PostToolUse() {} },
      };
    `);
    await assert.rejects(buildManifest(root), /rule/);
  });
});

test('핸들러 0개인 상시 선언은 manifest 에 실리지 않는다', async () => {
  await withRoot(async (root) => {
    install(root, 'addon', 'zero', 'export default { handlers: {} };');
    install(root, 'addon', 'real', DECL);
    const manifest = await buildManifest(root);
    assert.deepEqual(manifest.addons.map((a) => a.path), ['addon/real/addon.mjs']);
  });
});

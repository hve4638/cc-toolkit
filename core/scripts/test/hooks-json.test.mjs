import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isEventName } from '../../event/lib/index.mjs';

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hooksJson = JSON.parse(readFileSync(join(PLUGIN_ROOT, 'hooks', 'hooks.json'), 'utf-8'));

function commands() {
  return Object.entries(hooksJson.hooks).flatMap(([event, groups]) =>
    groups.flatMap((group) => group.hooks.map((hook) => ({ event, command: hook.command }))));
}

// run.cjs 도 main.mjs 도 대상을 못 찾으면 조용히 종료 코드 0 으로 빠진다. 경로
// 오타는 그래서 아무 증상 없이 훅을 죽이므로, 여기서 잡는다.
test('hooks.json 이 가리키는 파일이 전부 있다', () => {
  for (const { event, command } of commands()) {
    for (const path of command.match(/\$\{CLAUDE_PLUGIN_ROOT\}"?(\/[\w./-]+)/g) ?? []) {
      const relative = path.replace(/^\$\{CLAUDE_PLUGIN_ROOT\}"?\//, '');
      assert.ok(existsSync(join(PLUGIN_ROOT, relative)), `${event}: ${relative} 가 없다`);
    }
  }
});

test('event 호스트에 넘기는 이름이 실제 이벤트고 훅 이름과 같다', () => {
  const registered = commands().filter(({ command }) => command.includes('/event/main.mjs'));
  assert.ok(registered.length > 0, 'event 호스트가 하나도 안 걸려 있다');

  for (const { event, command } of registered) {
    const passed = command.trim().split(/\s+/).at(-1);
    assert.ok(isEventName(passed), `${event}: ${passed} 는 lib 이 모르는 이벤트다`);
    assert.equal(passed, event);
  }
});

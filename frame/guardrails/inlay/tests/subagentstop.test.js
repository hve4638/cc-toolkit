import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import subagentstop from '../hooks/subagentstop.mjs';
import stop from '../hooks/stop.mjs';
import posttooluse from '../hooks/posttooluse.mjs';
import { makeTmpRoot, cleanup, write, readCacheFile, cacheFiles } from './helpers.mjs';

const SID = '11111111-1111-1111-1111-111111111111';
const AID = 'abc123';

function seed(root) {
  write(join(root, 'proj', '.inlay'), '');
  return write(join(root, 'proj', 'INLAY.md'), 'PROJ');
}

function subEdit(root) {
  return posttooluse({
    session_id: SID, agent_id: AID, cwd: root, tool_name: 'Edit',
    tool_input: { file_path: join(root, 'proj', 'src', 'a.js') },
    hook_event_name: 'PostToolUse',
  });
}

test('subagent stop alerts on its own touched-but-not-updated inlay, naming the agent', async () => {
  const root = makeTmpRoot();
  try {
    const inlay = seed(root);
    await subEdit(root);
    const out = await subagentstop({ session_id: SID, agent_id: AID, cwd: root, hook_event_name: 'SubagentStop' });
    assert.ok(out && out.block);
    assert.ok(out.block.includes(`subagent ${AID}`), 'alert names the subagent');
    assert.ok(out.block.includes(inlay));
    // own file got the firing flag, base untouched
    const own = readCacheFile(root, `${SID}-${AID}.json`);
    assert.equal(own.stopHookFired, true);
    assert.deepEqual(own.tracking, {});
  } finally {
    cleanup(root);
  }
});

test('subagent isolation: subagent edit does NOT leak into the main Stop', async () => {
  const root = makeTmpRoot();
  try {
    seed(root);
    await subEdit(root); // writes to own file only
    // main Stop reads base only; base has no tracking from the subagent
    const out = await stop({ session_id: SID, cwd: root, hook_event_name: 'Stop' });
    assert.equal(out, null, 'main must not nag about what a subagent touched');
  } finally {
    cleanup(root);
  }
});

test('missing agent_id returns null (cannot attribute to an owner)', async () => {
  const root = makeTmpRoot();
  try {
    seed(root);
    const out = await subagentstop({ session_id: SID, cwd: root, hook_event_name: 'SubagentStop' });
    assert.equal(out, null);
  } finally {
    cleanup(root);
  }
});

test('stop_hook_active=true short-circuits and clears own tracking', async () => {
  const root = makeTmpRoot();
  try {
    seed(root);
    await subEdit(root);
    const out = await subagentstop({
      session_id: SID, agent_id: AID, cwd: root, hook_event_name: 'SubagentStop', stop_hook_active: true,
    });
    assert.equal(out, null);
    const own = readCacheFile(root, `${SID}-${AID}.json`);
    assert.deepEqual(own.tracking, {});
  } finally {
    cleanup(root);
  }
});

test('event mismatch returns null', async () => {
  const root = makeTmpRoot();
  try {
    const out = await subagentstop({ session_id: SID, agent_id: AID, cwd: root, hook_event_name: 'Stop' });
    assert.equal(out, null);
  } finally {
    cleanup(root);
  }
});

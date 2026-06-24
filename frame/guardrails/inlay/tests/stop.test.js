import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import stop from '../hooks/stop.mjs';
import posttooluse from '../hooks/posttooluse.mjs';
import { saveCache, ensureCacheDir } from '../lib/state-file.mjs';
import { makeTmpRoot, cleanup, write, readCacheFile } from './helpers.mjs';

const SID = '11111111-1111-1111-1111-111111111111';

function stopPayload(root, overrides = {}) {
  return { session_id: SID, cwd: root, hook_event_name: 'Stop', ...overrides };
}

// Set up a scope where code was touched but INLAY.md was not updated.
function seedStale(root) {
  write(join(root, 'proj', '.inlay'), '');
  const inlay = write(join(root, 'proj', 'INLAY.md'), 'PROJ');
  return inlay;
}

test('alerts (block) when code touched but INLAY.md not updated', async () => {
  const root = makeTmpRoot();
  try {
    const inlay = seedStale(root);
    await posttooluse({
      session_id: SID, cwd: root, tool_name: 'Edit',
      tool_input: { file_path: join(root, 'proj', 'src', 'a.js') },
      hook_event_name: 'PostToolUse',
    });
    const out = await stop(stopPayload(root));
    assert.ok(out && out.block, 'returns { block }');
    assert.ok(out.block.includes('[INLAY ALERT]'));
    assert.ok(out.block.includes(inlay), 'names the stale INLAY.md path');
    // firing flag set, tracking reset
    const cache = readCacheFile(root, `${SID}.json`);
    assert.equal(cache.stopHookFired, true);
    assert.deepEqual(cache.tracking, {});
  } finally {
    cleanup(root);
  }
});

test('no alert when inlayUpdated alongside codeTouched (doc-first true-negative)', async () => {
  const root = makeTmpRoot();
  try {
    const inlay = seedStale(root);
    // code edit
    await posttooluse({
      session_id: SID, cwd: root, tool_name: 'Edit',
      tool_input: { file_path: join(root, 'proj', 'src', 'a.js') },
      hook_event_name: 'PostToolUse',
    });
    // INLAY.md edit -> inlayUpdated
    await posttooluse({
      session_id: SID, cwd: root, tool_name: 'Edit',
      tool_input: { file_path: inlay }, hook_event_name: 'PostToolUse',
    });
    const out = await stop(stopPayload(root));
    assert.equal(out, null, 'updated inlay must not nag');
  } finally {
    cleanup(root);
  }
});

test('stop_hook_active=true short-circuits to null and clears tracking', async () => {
  const root = makeTmpRoot();
  try {
    seedStale(root);
    await posttooluse({
      session_id: SID, cwd: root, tool_name: 'Edit',
      tool_input: { file_path: join(root, 'proj', 'src', 'a.js') },
      hook_event_name: 'PostToolUse',
    });
    const out = await stop(stopPayload(root, { stop_hook_active: true }));
    assert.equal(out, null);
    const cache = readCacheFile(root, `${SID}.json`);
    assert.deepEqual(cache.tracking, {}, 'tracking cleared on continuation re-entry');
  } finally {
    cleanup(root);
  }
});

test('already-fired (stopHookFired) cycle stays silent and clears tracking', async () => {
  const root = makeTmpRoot();
  try {
    seedStale(root);
    ensureCacheDir(root);
    const ctx = { projectRoot: root, sessionId: SID };
    saveCache({ tracking: { [join(root, 'proj', 'INLAY.md')]: { codeTouched: true } }, stopHookFired: true }, ctx);
    const out = await stop(stopPayload(root));
    assert.equal(out, null, 'one nag per cycle');
    const cache = readCacheFile(root, `${SID}.json`);
    assert.deepEqual(cache.tracking, {});
  } finally {
    cleanup(root);
  }
});

test('hook_event_name mismatch returns null', async () => {
  const root = makeTmpRoot();
  try {
    const out = await stop(stopPayload(root, { hook_event_name: 'SubagentStop' }));
    assert.equal(out, null);
  } finally {
    cleanup(root);
  }
});

test('re-arming: a code edit after firing resets stopHookFired so the next cycle can nag again', async () => {
  const root = makeTmpRoot();
  try {
    const inlay = seedStale(root);
    const edit = {
      session_id: SID, cwd: root, tool_name: 'Edit',
      tool_input: { file_path: join(root, 'proj', 'src', 'a.js') },
      hook_event_name: 'PostToolUse',
    };
    await posttooluse(edit);
    const first = await stop(stopPayload(root));
    assert.ok(first.block, 'first nag fires');

    // a fresh code edit re-arms (stopHookFired -> false) and re-tracks
    await posttooluse(edit);
    const second = await stop(stopPayload(root));
    assert.ok(second && second.block, 'second cycle nags again');
    assert.ok(second.block.includes(inlay));
  } finally {
    cleanup(root);
  }
});

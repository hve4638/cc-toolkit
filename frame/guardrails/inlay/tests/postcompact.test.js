import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import postcompact from '../hooks/postcompact.mjs';
import { saveCache, ensureCacheDir } from '../lib/state-file.mjs';
import { makeTmpRoot, cleanup, readCacheFile } from './helpers.mjs';

const SID = '11111111-1111-1111-1111-111111111111';

test('postcompact clears hashes + tracking but preserves stopHookFired', async () => {
  const root = makeTmpRoot();
  try {
    ensureCacheDir(root);
    const ctx = { projectRoot: root, sessionId: SID };
    saveCache({
      hashes: { '/x/INLAY.md': 'h' },
      tracking: { '/x/INLAY.md': { codeTouched: true } },
      stopHookFired: true,
    }, ctx);

    const out = await postcompact({ session_id: SID, cwd: root, hook_event_name: 'PostCompact' });
    assert.equal(out, null);

    const cache = readCacheFile(root, `${SID}.json`);
    assert.deepEqual(cache.hashes, {}, 'hashes cleared so next PreToolUse re-emits chain');
    assert.deepEqual(cache.tracking, {});
    assert.equal(cache.stopHookFired, true, 'session-level firing flag preserved across compact');
  } finally {
    cleanup(root);
  }
});

test('missing session_id returns null', async () => {
  const root = makeTmpRoot();
  try {
    const out = await postcompact({ cwd: root, hook_event_name: 'PostCompact' });
    assert.equal(out, null);
  } finally {
    cleanup(root);
  }
});

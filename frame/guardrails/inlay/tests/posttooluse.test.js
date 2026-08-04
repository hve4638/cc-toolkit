import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import posttooluse from '../hooks/posttooluse.mjs';
import { makeTmpRoot, cleanup, write, cacheFiles, readCacheFile } from './helpers.mjs';

const SID = '11111111-1111-1111-1111-111111111111';

function payload(root, filePath, overrides = {}) {
  return {
    session_id: SID,
    cwd: root,
    tool_name: 'Edit',
    tool_input: { file_path: filePath },
    hook_event_name: 'PostToolUse',
    ...overrides,
  };
}

test('code edit under a .inlay marks nearest INLAY.md as codeTouched, resets stopHookFired', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    const inlay = write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    const out = await posttooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.equal(out, null, 'posttool is side-effect only');
    const cache = readCacheFile(root, `${SID}.json`);
    assert.equal(cache.tracking[inlay].codeTouched, true);
    assert.equal(cache.stopHookFired, false);
  } finally {
    cleanup(root);
  }
});

test('code edit with NO .inlay ancestor returns null and writes no tracking', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', 'INLAY.md'), 'PROJ'); // present but no .inlay marker
    const out = await posttooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.equal(out, null);
    assert.deepEqual(cacheFiles(root), [], 'no cache file written when out of inlay scope');
  } finally {
    cleanup(root);
  }
});

test('ceiling bounds findNearestContext: INLAY.md only above the .inlay dir => not tracked', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'INLAY.md'), 'ABOVE'); // above ceiling
    write(join(root, 'proj', '.inlay'), ''); // ceiling, no INLAY.md here
    const out = await posttooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.equal(out, null);
    // ensureCacheDir may have created the dir, but no tracking entry should exist
    const files = cacheFiles(root);
    if (files.length) {
      const cache = readCacheFile(root, files[0]);
      assert.deepEqual(cache.tracking, {}, 'nothing tracked above the ceiling');
    }
  } finally {
    cleanup(root);
  }
});

test('editing INLAY.md itself refreshes its hash and marks inlayUpdated', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    const inlay = write(join(root, 'proj', 'INLAY.md'), 'NEW BODY');
    const out = await posttooluse(payload(root, inlay));
    assert.equal(out, null);
    const cache = readCacheFile(root, `${SID}.json`);
    const expectHash = createHash('sha256').update('NEW BODY').digest('hex');
    assert.equal(cache.hashes[inlay], expectHash, 'hash refreshed to new body');
    assert.equal(cache.tracking[inlay].inlayUpdated, true);
  } finally {
    cleanup(root);
  }
});

test('trigger-excluded file: no codeTouched, no stopHookFired reset', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '!*.md\n');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    // seed stopHookFired=true so a reset would be observable
    const { saveCache, ensureCacheDir } = await import('../lib/state-file.mjs');
    ensureCacheDir(root);
    saveCache({ stopHookFired: true }, { projectRoot: root, sessionId: SID });
    const out = await posttooluse(payload(root, join(root, 'proj', 'docs', 'a.md')));
    assert.equal(out, null);
    const cache = readCacheFile(root, `${SID}.json`);
    assert.deepEqual(cache.tracking, {}, 'excluded file is not tracked');
    assert.equal(cache.stopHookFired, true, 'stopHookFired not reset by excluded file');
  } finally {
    cleanup(root);
  }
});

test('INLAY.md edit still marks inlayUpdated even under "!*.md"', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '!*.md\n');
    const inlay = write(join(root, 'proj', 'INLAY.md'), 'NEW BODY');
    const out = await posttooluse(payload(root, inlay));
    assert.equal(out, null);
    const cache = readCacheFile(root, `${SID}.json`);
    assert.equal(cache.tracking[inlay].inlayUpdated, true, 'INLAY.md bookkeeping is pattern-independent');
  } finally {
    cleanup(root);
  }
});

test('non-write tool returns null', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    const out = await posttooluse(payload(root, join(root, 'proj', 'a.js'), { tool_name: 'Read' }));
    assert.equal(out, null);
  } finally {
    cleanup(root);
  }
});

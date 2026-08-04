import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import pretooluse from '../hooks/pretooluse.mjs';
import { makeTmpRoot, cleanup, write, mkdirp, cacheFiles, readCacheFile } from './helpers.mjs';

function payload(root, filePath, overrides = {}) {
  return {
    session_id: '11111111-1111-1111-1111-111111111111',
    cwd: root,
    tool_name: 'Read',
    tool_input: { file_path: filePath },
    hook_event_name: 'PreToolUse',
    ...overrides,
  };
}

test('injects INLAY.md content as context when a .inlay ancestor exists', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ CONTEXT');
    mkdirp(join(root, 'proj', 'src'));
    const out = await pretooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.ok(out && out.context, 'returns { context }');
    assert.ok(out.context.includes('PROJ CONTEXT'));
    assert.ok(out.context.includes('<inlay-context path='));
  } finally {
    cleanup(root);
  }
});

test('returns null (skipped) when the edited file has NO .inlay ancestor', async () => {
  const root = makeTmpRoot();
  try {
    // INLAY.md present but no .inlay marker anywhere above the file.
    write(join(root, 'proj', 'INLAY.md'), 'PROJ CONTEXT');
    mkdirp(join(root, 'proj', 'src'));
    const out = await pretooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.equal(out, null, 'no .inlay above file => no injection');
    // and no cache file written
    assert.deepEqual(cacheFiles(root), []);
  } finally {
    cleanup(root);
  }
});

test('ceiling caps the chain: INLAY.md above the .inlay dir is not injected', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'INLAY.md'), 'ABOVE CEILING');
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'AT CEILING');
    write(join(root, 'proj', 'src', 'INLAY.md'), 'UNDER CEILING');
    mkdirp(join(root, 'proj', 'src'));
    const out = await pretooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.ok(out.context.includes('AT CEILING'));
    assert.ok(out.context.includes('UNDER CEILING'));
    assert.ok(!out.context.includes('ABOVE CEILING'), 'never look above the .inlay dir');
  } finally {
    cleanup(root);
  }
});

test('nearest .inlay wins when nested', async () => {
  const root = makeTmpRoot();
  try {
    // outer .inlay at proj, inner .inlay at proj/sub -> inner is the ceiling
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'OUTER');
    write(join(root, 'proj', 'sub', '.inlay'), '');
    write(join(root, 'proj', 'sub', 'INLAY.md'), 'INNER');
    mkdirp(join(root, 'proj', 'sub', 'src'));
    const out = await pretooluse(payload(root, join(root, 'proj', 'sub', 'src', 'a.js')));
    assert.ok(out.context.includes('INNER'));
    assert.ok(!out.context.includes('OUTER'), 'nearest .inlay caps the walk');
  } finally {
    cleanup(root);
  }
});

test('self-edit of INLAY.md by a write tool is left alone (no chain injection)', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    const out = await pretooluse(payload(root, join(root, 'proj', 'INLAY.md'), {
      tool_name: 'Edit',
      tool_input: { file_path: join(root, 'proj', 'INLAY.md') },
    }));
    assert.equal(out, null, 'writing INLAY.md must not re-inject its own body');
  } finally {
    cleanup(root);
  }
});

test('Reading INLAY.md is silent too (INLAY.md never triggers, regardless of tool)', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ BODY');
    const out = await pretooluse(payload(root, join(root, 'proj', 'INLAY.md'), {
      tool_name: 'Read',
    }));
    assert.equal(out, null, 'Read of INLAY.md must not inject the chain');
  } finally {
    cleanup(root);
  }
});

test('non-intercepted tool returns null', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    const out = await pretooluse(payload(root, join(root, 'proj', 'a.js'), { tool_name: 'Bash', tool_input: {} }));
    assert.equal(out, null);
  } finally {
    cleanup(root);
  }
});

test('missing session_id returns null', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    const out = await pretooluse(payload(root, join(root, 'proj', 'a.js'), { session_id: undefined }));
    assert.equal(out, null);
  } finally {
    cleanup(root);
  }
});

test('second identical PreToolUse is silent (unchanged), no re-injection', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    mkdirp(join(root, 'proj', 'src'));
    const p = payload(root, join(root, 'proj', 'src', 'a.js'));
    const first = await pretooluse(p);
    assert.ok(first.context.includes('PROJ'));
    const second = await pretooluse(p);
    assert.equal(second, null, 'unchanged chain => no context');
  } finally {
    cleanup(root);
  }
});

test('trigger patterns: "!*.md" in .inlay silences md edits', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '!*.md\n');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    mkdirp(join(root, 'proj', 'docs'));
    const out = await pretooluse(payload(root, join(root, 'proj', 'docs', 'a.md'), {
      tool_name: 'Edit',
      tool_input: { file_path: join(root, 'proj', 'docs', 'a.md') },
    }));
    assert.equal(out, null, 'excluded file gets no injection');
    assert.deepEqual(cacheFiles(root), [], 'and no cache write');
  } finally {
    cleanup(root);
  }
});

test('trigger patterns: a pattern-matched file still injects as before', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '*.js\n');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ CONTEXT');
    mkdirp(join(root, 'proj', 'src'));
    const hit = await pretooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.ok(hit && hit.context.includes('PROJ CONTEXT'), 'matched file injects');
    const miss = await pretooluse(payload(root, join(root, 'proj', 'src', 'a.md')));
    assert.equal(miss, null, 'unmatched file is silent');
  } finally {
    cleanup(root);
  }
});

test('first PreToolUse for the main session cleans up orphan cache files', async () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', '.inlay'), '');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    mkdirp(join(root, 'proj', 'src'));
    // plant an orphan cache file with a valid session-uuid name and old mtime
    const orphanName = '22222222-2222-2222-2222-222222222222.json';
    const orphan = write(join(root, '.agent-memory', 'inlay-cache', orphanName), '{}');
    const old = Date.now() / 1000 - 60 * 24 * 60 * 60; // 60 days ago (secs)
    const { utimesSync } = await import('node:fs');
    utimesSync(orphan, old, old);

    await pretooluse(payload(root, join(root, 'proj', 'src', 'a.js')));
    assert.ok(!cacheFiles(root).includes(orphanName), 'stale orphan removed on first PreToolUse');
  } finally {
    cleanup(root);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readContextChain, findNearestContext, formatForHook } from '../lib/read-context.mjs';
import { makeTmpRoot, cleanup, write, mkdirp } from './helpers.mjs';

test('readContextChain collects INLAY.md from leaf up to (and including) the ceiling, never above', () => {
  const root = makeTmpRoot();
  try {
    // root/INLAY.md          <- ABOVE ceiling, must NOT be collected
    // root/proj/INLAY.md     <- ceiling dir (.inlay lives here), collected
    // root/proj/a/INLAY.md   <- under ceiling, collected
    // edited file: root/proj/a/b/file.js  -> startDir = root/proj/a/b
    write(join(root, 'INLAY.md'), 'ROOT');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    write(join(root, 'proj', 'a', 'INLAY.md'), 'A');
    mkdirp(join(root, 'proj', 'a', 'b'));

    const ceiling = join(root, 'proj');
    const cache = { hashes: {} };
    const entries = readContextChain(join(root, 'proj', 'a', 'b'), { cache, ceiling });

    const contents = entries.map((e) => e.content);
    assert.deepEqual(contents, ['PROJ', 'A'], 'top-down order, ROOT excluded');
    assert.ok(!contents.includes('ROOT'), 'must never look above the ceiling');
  } finally {
    cleanup(root);
  }
});

test('readContextChain stops exactly at ceiling even when startDir === ceiling', () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'INLAY.md'), 'ROOT');
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    const ceiling = join(root, 'proj');
    const cache = { hashes: {} };
    const entries = readContextChain(join(root, 'proj'), { cache, ceiling });
    assert.deepEqual(entries.map((e) => e.content), ['PROJ']);
  } finally {
    cleanup(root);
  }
});

test('readContextChain without ceiling walks to filesystem root (legacy behavior preserved)', () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    write(join(root, 'proj', 'a', 'INLAY.md'), 'A');
    mkdirp(join(root, 'proj', 'a', 'b'));
    const cache = { hashes: {} };
    const entries = readContextChain(join(root, 'proj', 'a', 'b'), { cache });
    // No ceiling: collects every INLAY.md up the tree (PROJ + A here).
    assert.deepEqual(entries.map((e) => e.content), ['PROJ', 'A']);
  } finally {
    cleanup(root);
  }
});

test('readContextChain marks new/updated/unchanged via cache hashes', () => {
  const root = makeTmpRoot();
  try {
    const ctxPath = write(join(root, 'proj', 'INLAY.md'), 'V1');
    mkdirp(join(root, 'proj', 'a'));
    const ceiling = join(root, 'proj');
    const cache = { hashes: {} };

    let entries = readContextChain(join(root, 'proj', 'a'), { cache, ceiling });
    assert.equal(entries[0].status, 'new');

    // second pass with same content -> unchanged
    entries = readContextChain(join(root, 'proj', 'a'), { cache, ceiling });
    assert.equal(entries[0].status, 'unchanged');

    // edit content -> updated
    write(ctxPath, 'V2');
    entries = readContextChain(join(root, 'proj', 'a'), { cache, ceiling });
    assert.equal(entries[0].status, 'updated');
  } finally {
    cleanup(root);
  }
});

test('findNearestContext finds nearest INLAY.md bounded by ceiling', () => {
  const root = makeTmpRoot();
  try {
    write(join(root, 'proj', 'INLAY.md'), 'PROJ');
    write(join(root, 'proj', 'a', 'INLAY.md'), 'A');
    const ceiling = join(root, 'proj');
    const found = findNearestContext(join(root, 'proj', 'a', 'b', 'file.js'), { ceiling });
    assert.equal(found, join(root, 'proj', 'a', 'INLAY.md'), 'nearest wins');
  } finally {
    cleanup(root);
  }
});

test('findNearestContext returns null when no INLAY.md between file and ceiling', () => {
  const root = makeTmpRoot();
  try {
    // INLAY.md only ABOVE the ceiling -> must be treated as not found.
    write(join(root, 'INLAY.md'), 'ROOT');
    mkdirp(join(root, 'proj', 'a'));
    const ceiling = join(root, 'proj');
    const found = findNearestContext(join(root, 'proj', 'a', 'file.js'), { ceiling });
    assert.equal(found, null);
  } finally {
    cleanup(root);
  }
});

test('formatForHook omits unchanged, wraps updated with (updated)', () => {
  const entries = [
    { path: '/x/INLAY.md', status: 'new', content: 'NEW' },
    { path: '/y/INLAY.md', status: 'unchanged', content: 'OLD' },
    { path: '/z/INLAY.md', status: 'updated', content: 'UPD' },
  ];
  const out = formatForHook(entries);
  assert.ok(out.includes('<inlay-context path="/x/INLAY.md">\nNEW\n</inlay-context>'));
  assert.ok(!out.includes('OLD'), 'unchanged dropped');
  assert.ok(out.includes('(updated)\nUPD'));
});

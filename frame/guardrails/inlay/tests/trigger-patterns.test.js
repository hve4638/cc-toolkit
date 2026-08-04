import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { isTriggerFile } from '../lib/trigger-patterns.mjs';
import { makeTmpRoot, cleanup, write, mkdirp } from './helpers.mjs';

// ceiling 에 .inlay 를 content 로 만들고 판정을 돌리는 헬퍼.
function judge(root, markerContent, relPath) {
  write(join(root, '.inlay'), markerContent);
  return isTriggerFile(join(root, relPath), root);
}

test('empty .inlay: everything triggers except INLAY.md', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, '', 'a.js'), true);
    assert.equal(judge(root, '', 'docs/a.md'), true);
    assert.equal(judge(root, '', 'INLAY.md'), false, 'INLAY.md never triggers');
    assert.equal(judge(root, '', 'sub/INLAY.md'), false, 'nested INLAY.md never triggers');
  } finally {
    cleanup(root);
  }
});

test('missing .inlay defaults to all-trigger', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(isTriggerFile(join(root, 'a.js'), root), true);
    assert.equal(isTriggerFile(join(root, 'INLAY.md'), root), false);
  } finally {
    cleanup(root);
  }
});

test('.inlay as a directory defaults to all-trigger', () => {
  const root = makeTmpRoot();
  try {
    mkdirp(join(root, '.inlay'));
    assert.equal(isTriggerFile(join(root, 'a.js'), root), true);
  } finally {
    cleanup(root);
  }
});

test('last-match-wins: "a.md" then "!*.md" excludes a.md', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, 'a.md\n!*.md\n', 'a.md'), false, 'negation on the later line wins');
    assert.equal(judge(root, 'a.md\n!*.md\n', 'b.md'), false, 'other md unmatched-positive => excluded');
    assert.equal(judge(root, 'a.md\n!*.md\n', 'a.js'), false, 'unmatched => no trigger');
  } finally {
    cleanup(root);
  }
});

test('last-match-wins: "!*.md" then "a.md" triggers only a.md', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, '!*.md\na.md\n', 'a.md'), true, 'later positive line wins');
    assert.equal(judge(root, '!*.md\na.md\n', 'b.md'), false);
    assert.equal(judge(root, '!*.md\na.md\n', 'sub/a.md'), true, 'slash-less pattern matches basename at depth');
  } finally {
    cleanup(root);
  }
});

test('comments and blank lines are skipped; comment-only file defaults to all-trigger', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, '# comment\n\n  \n', 'a.js'), true, 'no valid pattern => default *');
    assert.equal(judge(root, '# comment\n*.js\n', 'a.js'), true);
    assert.equal(judge(root, '# comment\n*.js\n', 'a.md'), false);
  } finally {
    cleanup(root);
  }
});

test('basename vs anchored: slash-containing patterns anchor to the ceiling', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, '*.md\n', 'docs/a.md'), true, 'no slash => basename match at any depth');
    assert.equal(judge(root, 'src/*.js\n', 'src/a.js'), true);
    assert.equal(judge(root, 'src/*.js\n', 'other/src/a.js'), false, 'anchored: no match deeper');
    assert.equal(judge(root, 'src/*.js\n', 'src/sub/a.js'), false, '* does not cross /');
    assert.equal(judge(root, '/a.md\n', 'a.md'), true, 'leading / stripped, anchored to ceiling');
    assert.equal(judge(root, '/a.md\n', 'sub/a.md'), false, 'leading / means top-level only');
  } finally {
    cleanup(root);
  }
});

test('** matches across directories', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, 'src/**/*.js\n', 'src/a/b/c.js'), true);
    assert.equal(judge(root, '**/gen.js\n', 'gen.js'), true, '**/ also matches zero directories');
    assert.equal(judge(root, '**/gen.js\n', 'a/b/gen.js'), true);
    assert.equal(judge(root, 'src/**\n', 'src/a/b.md'), true);
    assert.equal(judge(root, 'src/**\n', 'other/b.md'), false);
  } finally {
    cleanup(root);
  }
});

test('trailing-slash directory pattern matches everything under the directory', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, 'src/\n', 'src/a.js'), true);
    assert.equal(judge(root, 'src/\n', 'src/deep/b.js'), true, 'src/ covers all depths under it');
    assert.equal(judge(root, 'src/\n', 'other.js'), false);
    // contrast with the slash-less basename form: `src` matches only files named src
    assert.equal(judge(root, 'src\n', 'src/a.js'), false, 'basename pattern src != directory pattern src/');
  } finally {
    cleanup(root);
  }
});

test('non-slash-delimited ** behaves like a single * (does not cross /)', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, 'src/a**b/x.js\n', 'src/aQb/x.js'), true);
    assert.equal(judge(root, 'src/a**b/x.js\n', 'src/aQ/deep/b/x.js'), false, 'a**b must not cross /');
    assert.equal(judge(root, 'src/**b/x.js\n', 'src/a/deep/b/x.js'), false, '**b (no / after) is a plain *');
    assert.equal(judge(root, 'src/**b/x.js\n', 'src/ab/x.js'), true);
  } finally {
    cleanup(root);
  }
});

test('? matches one non-slash character; regex specials are escaped', () => {
  const root = makeTmpRoot();
  try {
    assert.equal(judge(root, 'a?.js\n', 'ab.js'), true);
    assert.equal(judge(root, 'a?.js\n', 'a.js'), false);
    assert.equal(judge(root, 'a.js\n', 'aXjs'), false, 'dot is literal, not regex any-char');
  } finally {
    cleanup(root);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from '../lib/aiaddon.mjs';

// HOME 을 임시 디렉터리로 격리 — 실제 사용자의 ~/.config/aiaddon 이 결과에 새어
// 들어오지 않게 한다. os.homedir() 는 호출 시점의 $HOME 을 본다.
function withLayers({ global: globalText, local: localText }, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'aiaddon-test-'));
  const home = join(dir, 'home');
  const project = join(dir, 'project');
  for (const [base, text] of [[home, globalText], [project, localText]]) {
    if (text === undefined) continue;
    mkdirSync(join(base, '.config', 'aiaddon'), { recursive: true });
    writeFileSync(join(base, '.config', 'aiaddon', 'event'), text);
  }
  const saved = process.env.HOME;
  process.env.HOME = home;
  try {
    return fn(project);
  } finally {
    if (saved === undefined) delete process.env.HOME;
    else process.env.HOME = saved;
    rmSync(dir, { recursive: true, force: true });
  }
}

const on = (opts) => withLayers(opts, (project) => load(project, 'event'));

test('reads entries, skipping blanks and comments', () => {
  const entries = on({ global: '# a comment\n\nknow:rust-embedded\n  rule:conventional-commit  \n' });
  assert.deepEqual([...entries.keys()], ['know:rust-embedded', 'rule:conventional-commit']);
});

test('missing files resolve to nothing', () => {
  assert.equal(on({}).size, 0);
});

test('an unknown namespace resolves to nothing', () => {
  withLayers({ global: 'know:x\n' }, (project) => {
    assert.equal(load(project, 'statusline').size, 0);
    assert.equal(load(project, 'nonesuch').size, 0);
  });
});

test('local is read after global, so it decides', () => {
  const entries = on({ global: 'feat:inlay\nfeat:ponytail\n', local: '!feat:inlay\n' });
  assert.deepEqual([...entries.keys()], ['feat:ponytail']);
});

test('negation matches across the colon', () => {
  const entries = on({ global: 'know:a\nknow:b\nrule:c\n!know:*\n' });
  assert.deepEqual([...entries.keys()], ['rule:c']);
});

test('!* clears the file, and lines below it turn back on', () => {
  const entries = on({ global: 'know:a\nrule:b\n!*\nknow:c\n' });
  assert.deepEqual([...entries.keys()], ['know:c']);
});

// 전역 끝의 !* 는 로컬 선언보다 먼저 읽히므로 로컬이 살아남는다.
test('a global !* does not reach local declarations', () => {
  const entries = on({ global: 'know:a\n!*\n', local: 'know:b\n' });
  assert.deepEqual([...entries.keys()], ['know:b']);
});

test('negation before a declaration leaves it on', () => {
  const entries = on({ global: '!know:a\nknow:a\n' });
  assert.deepEqual([...entries.keys()], ['know:a']);
});

test('args parse as named values, a bare key meaning true', () => {
  const entries = on({ global: 'feat:hud@lang=ko,simplify\n' });
  assert.deepEqual({ ...entries.get('feat:hud') }, { lang: 'ko', simplify: true });
});

test('an entry without args carries an empty set', () => {
  assert.deepEqual({ ...on({ global: 'feat:hud\n' }).get('feat:hud') }, {});
});

test('a later line replaces the whole arg set', () => {
  const entries = on({ global: 'feat:hud@lang=ko,simplify\n', local: 'feat:hud@lang=en\n' });
  assert.deepEqual({ ...entries.get('feat:hud') }, { lang: 'en' });
});

test('args do not reach the object prototype', () => {
  const entries = on({ global: 'feat:hud@__proto__=x\n' });
  assert.equal(entries.get('feat:hud').polluted, undefined);
  assert.equal({}.x, undefined);
});

test('negation ignores args', () => {
  assert.equal(on({ global: 'feat:hud@lang=ko\n!feat:*\n' }).size, 0);
});

test('malformed lines are ignored', () => {
  const entries = on({
    global: [
      'Know:upper',        // 대문자
      'noKind',            // 종류 없음
      'feat:*',            // 켜는 쪽의 와일드카드
      'feat:a@1bad=x',     // 숫자로 시작하는 키
      'feat:b@k=has space', // 값의 공백
      'feat:c@=v',         // 이름 없는 인자
      'feat:ok',
    ].join('\n'),
  });
  assert.deepEqual([...entries.keys()], ['feat:ok']);
});

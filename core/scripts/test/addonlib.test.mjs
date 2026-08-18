import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseFrontmatter } from '../lib/addonlib.mjs';

const FIELDS = ['rule', 'name'];

test('frontmatter 없으면 필드 전부 null, body 는 trim 된다', () => {
  assert.deepEqual(parseFrontmatter('x.md', 'plain body\n', FIELDS), {
    fields: { rule: null, name: null },
    body: 'plain body',
  });
});

test('허용 필드가 값으로 채워지고, 안 적힌 필드는 null 로 남는다', () => {
  assert.deepEqual(parseFrontmatter('x.md', '---\nrule: my-toggle\n---\nbody\n', FIELDS), {
    fields: { rule: 'my-toggle', name: null },
    body: 'body',
  });
  assert.deepEqual(parseFrontmatter('x.md', '---\nrule: a\nname: b\n---\nbody\n', FIELDS), {
    fields: { rule: 'a', name: 'b' },
    body: 'body',
  });
});

test('허용 밖 필드·문법 밖 줄은 던진다 — 오타가 조용히 넘어가지 않는다', () => {
  assert.throws(() => parseFrontmatter('x.md', '---\nrul: x\n---\nbody\n', FIELDS), /rul: x/);
  assert.throws(() => parseFrontmatter('x.md', '---\nwhen: tmux\n---\nbody\n', FIELDS), /when: tmux/);
  // 값에 공백이 섞인 줄은 문법 밖이다 — 값은 한 토큰.
  assert.throws(() => parseFrontmatter('x.md', '---\nname: a b\n---\nbody\n', FIELDS), /name: a b/);
  // 에러 메시지가 허용 필드를 열거한다 — 저자가 고칠 방향을 준다.
  assert.throws(() => parseFrontmatter('x.md', '---\nrul: x\n---\nbody\n', FIELDS), /'rule: <값>'·'name: <값>'/);
  // 프로토타입 이름 키는 "허용 밖" 으로 거절돼야 한다 — includes 가드가
  // fields[key] 접근보다 앞이라는 순서에 안전이 걸려 있어 핀한다.
  assert.throws(() => parseFrontmatter('x.md', '---\nconstructor: v\n---\nbody\n', FIELDS), /constructor: v/);
});

test('같은 필드 두 번이면 던진다', () => {
  assert.throws(() => parseFrontmatter('x.md', '---\nrule: a\nrule: b\n---\nbody\n', FIELDS), /두 번/);
  assert.throws(() => parseFrontmatter('x.md', '---\nname: a\nname: b\n---\nbody\n', FIELDS), /두 번/);
});

test('CRLF 원문도 frontmatter 를 알아본다', () => {
  assert.deepEqual(parseFrontmatter('x.md', '---\r\nrule: foo\r\n---\r\nbody\r\n', FIELDS), {
    fields: { rule: 'foo', name: null },
    body: 'body',
  });
});

test('닫는 --- 가 없으면 던진다 — body 로 흘리면 원문이 샌다', () => {
  assert.throws(() => parseFrontmatter('x.md', '---\nrule: foo\nbody\n', FIELDS), /닫는/);
  assert.throws(() => parseFrontmatter('x.md', '---\n', FIELDS), /닫는/);
});

test('에러 메시지는 label 로 시작한다 — 어느 파일인지 바로 보인다', () => {
  assert.throws(() => parseFrontmatter('instructions/a.md', '---\nbad line\n---\nbody\n', FIELDS), /^Error: instructions\/a\.md:/);
});

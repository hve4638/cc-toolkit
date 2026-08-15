import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectRules } from '../../event/lib/index.mjs';

// light 는 SessionStart 만, heavy 는 SessionStart 와 PreToolUse 를 선언한다.
const DECL = {
  rules: {
    'showcase-light': { events: ['SessionStart'] },
    'showcase-heavy': { events: ['SessionStart', 'PreToolUse'] },
  },
  handlers: {},
};

const on = (...entries) => new Map(entries);

test('켜진 규칙이 하나면 이벤트를 선언한 규칙 전부가 실린다 — 꺼진 것 포함', () => {
  const rules = selectRules(DECL, 'SessionStart', on(['showcase-light', {}]));
  assert.deepEqual(rules, {
    'showcase-light': { trigger: true },
    'showcase-heavy': { trigger: false },
  });
});

test('이벤트를 선언하지 않은 규칙은 실리지 않는다', () => {
  const rules = selectRules(DECL, 'PreToolUse', on(['showcase-heavy', {}]));
  assert.deepEqual(rules, { 'showcase-heavy': { trigger: true } });
});

test('선언 규칙이 하나도 안 켜져 있으면 null — 애드온이 불리지 않는다', () => {
  assert.equal(selectRules(DECL, 'SessionStart', on(['other-rule', {}])), null);
  assert.equal(selectRules(DECL, 'SessionStart', on()), null);
});

test('꺼진 규칙만 이벤트를 선언했으면 null', () => {
  // light 는 켜졌지만 PreToolUse 를 선언하지 않았다.
  assert.equal(selectRules(DECL, 'PreToolUse', on(['showcase-light', {}])), null);
});

test('이벤트를 선언한 규칙이 아예 없으면 null', () => {
  assert.equal(selectRules(DECL, 'PostToolUse', on(['showcase-light', {}])), null);
});

test('항목의 args 가 규칙 상태에 실린다', () => {
  const rules = selectRules(DECL, 'PreToolUse', on(['showcase-heavy', { mode: 'strict', quiet: true }]));
  assert.deepEqual(rules, {
    'showcase-heavy': { mode: 'strict', quiet: true, trigger: true },
  });
});

test('trigger 는 예약 키 — 사용자 인자의 trigger 는 조용히 덮인다', () => {
  const rules = selectRules(DECL, 'PreToolUse', on(['showcase-heavy', { trigger: 'no' }]));
  assert.equal(rules['showcase-heavy'].trigger, true);
});

test('null 프로토타입 args 도 그대로 실린다', () => {
  const args = Object.create(null);
  args.lang = 'ko';
  const rules = selectRules(DECL, 'PreToolUse', on(['showcase-heavy', args]));
  assert.deepEqual(rules, { 'showcase-heavy': { lang: 'ko', trigger: true } });
});

// cwd-context 는 기본 켜짐, showcase-light 는 아니다.
const DEFAULT_DECL = {
  rules: {
    'cwd-context': { events: ['SessionStart'], enabledByDefault: true },
    'showcase-light': { events: ['SessionStart'] },
  },
  handlers: {},
};

test('enabledByDefault 규칙은 설정에 줄이 없어도 trigger:true — 인자는 없다', () => {
  const rules = selectRules(DEFAULT_DECL, 'SessionStart', on());
  assert.deepEqual(rules, {
    'cwd-context': { trigger: true },
    'showcase-light': { trigger: false },
  });
});

test('부정이 매치한 기본 켜짐 규칙은 꺼진다', () => {
  const negated = (name) => name === 'cwd-context';
  assert.equal(selectRules(DEFAULT_DECL, 'SessionStart', on(), negated), null);
});

test('부정 뒤에 다시 켠 줄은 enabled 로 들어와 이긴다 — 인자도 실린다', () => {
  const negated = () => true;
  const rules = selectRules(DEFAULT_DECL, 'SessionStart', on(['cwd-context', { lang: 'ko' }]), negated);
  assert.deepEqual(rules, {
    'cwd-context': { lang: 'ko', trigger: true },
    'showcase-light': { trigger: false },
  });
});

test('enabledByDefault 가 true 가 아닌 값이면 기본 켜짐이 아니다', () => {
  const decl = {
    rules: { odd: { events: ['Stop'], enabledByDefault: 'yes' } },
    handlers: {},
  };
  assert.equal(selectRules(decl, 'Stop', on()), null);
});

// 규칙 없는 상시 애드온 — 설정과 무관하게 핸들러 유무만 본다.
test('규칙 없는 선언은 이벤트 핸들러가 있으면 빈 규칙 상태로 발화한다', () => {
  const decl = { handlers: { PostToolUse() {} } };
  assert.deepEqual(selectRules(decl, 'PostToolUse', on()), {});
  // 설정에 뭐가 있든 영향 없다.
  assert.deepEqual(selectRules(decl, 'PostToolUse', on(['other', {}])), {});
});

test('규칙 없는 선언도 핸들러가 없는 이벤트에서는 null', () => {
  const decl = { handlers: { PostToolUse() {} } };
  assert.equal(selectRules(decl, 'Stop', on()), null);
});

test('빈 rules 객체도 규칙 없는 선언으로 친다', () => {
  const decl = { rules: {}, handlers: { Stop() {} } };
  assert.deepEqual(selectRules(decl, 'Stop', on()), {});
});

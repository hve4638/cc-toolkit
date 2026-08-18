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

// alwaysEvents — 규칙 게이트를 이벤트 단위로 빼는 스위치.
const ALWAYS_DECL = {
  rules: { 'showcase-light': { events: ['SessionStart'] } },
  alwaysEvents: ['SessionStart'],
  handlers: {},
};

test('alwaysEvents 이벤트는 규칙이 다 꺼져 있어도 발화한다 — 전부 trigger:false 로 실린다', () => {
  assert.deepEqual(selectRules(ALWAYS_DECL, 'SessionStart', on()), {
    'showcase-light': { trigger: false },
  });
});

test('alwaysEvents 에 없는 이벤트는 규칙 게이트 그대로다', () => {
  const decl = {
    rules: { 'showcase-heavy': { events: ['PreToolUse'] } },
    alwaysEvents: ['SessionStart'],
    handlers: {},
  };
  assert.equal(selectRules(decl, 'PreToolUse', on()), null);
});

test('alwaysEvents 이벤트를 선언한 규칙이 없으면 빈 상태로 발화한다', () => {
  const decl = {
    rules: { 'showcase-heavy': { events: ['PreToolUse'] } },
    alwaysEvents: ['SessionStart'],
    handlers: {},
  };
  assert.deepEqual(selectRules(decl, 'SessionStart', on()), {});
  // 같은 선언의 규칙 게이트 이벤트는 독립이다 — 켜면 상태가 실린다.
  assert.deepEqual(selectRules(decl, 'PreToolUse', on(['showcase-heavy', {}])), {
    'showcase-heavy': { trigger: true },
  });
});

test('배열이 아닌 alwaysEvents 는 없음으로 본다', () => {
  const decl = {
    // 문자열도 includes 를 갖는다 — 우연히 참이 되면 안 된다.
    rules: { 'stop-rule': { events: ['Stop'] } },
    alwaysEvents: 'Stop',
    handlers: {},
  };
  assert.equal(selectRules(decl, 'Stop', on()), null);
});

test('켜진 규칙과 alwaysEvents 가 겹쳐도 결과는 같다 — trigger 는 설정에서 온다', () => {
  const rules = selectRules(ALWAYS_DECL, 'SessionStart', on(['showcase-light', {}]));
  assert.deepEqual(rules, { 'showcase-light': { trigger: true } });
});

test('rules:{} + alwaysEvents 는 목록의 이벤트만 발화한다 — 상시로 새지 않는다', () => {
  // instruction 의 배포 형태: 데이터 조립이라 규칙이 0개일 수 있다. 핸들러가
  // 더 있어도 alwaysEvents 밖 이벤트는 잠긴 채여야 한다.
  const decl = {
    rules: {},
    alwaysEvents: ['SessionStart'],
    handlers: { SessionStart() {}, Stop() {} },
  };
  assert.deepEqual(selectRules(decl, 'SessionStart', on()), {});
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

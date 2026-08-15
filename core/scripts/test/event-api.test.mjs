import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apiFor, emptyDraft, toHookOutput } from '../../event/lib/index.mjs';

test('notify·injectContext 는 쌓인다', () => {
  const draft = emptyDraft();
  const api = apiFor('Stop', draft, { stop_hook_active: false });
  api.notify('하나');
  api.notify('둘');
  api.injectContext('배경');
  assert.deepEqual(draft.notify, ['하나', '둘']);
  assert.deepEqual(draft.context, ['배경']);
});

test('deny 가 여럿이면 사유가 모인다', () => {
  const draft = emptyDraft();
  apiFor('PreToolUse', draft, {}).permission.deny('첫째');
  apiFor('PreToolUse', draft, {}).permission.deny('둘째');
  assert.deepEqual(draft.permission, { kind: 'deny', reasons: ['첫째', '둘째'] });
});

test('deny 가 ask 를 이긴다 — 순서와 무관하게', () => {
  const before = emptyDraft();
  const api1 = apiFor('PreToolUse', before, {});
  api1.permission.ask('물어봐');
  api1.permission.deny('막아');
  assert.deepEqual(before.permission, { kind: 'deny', reasons: ['막아'] });

  const after = emptyDraft();
  const api2 = apiFor('PreToolUse', after, {});
  api2.permission.deny('막아');
  api2.permission.ask('물어봐');
  assert.deepEqual(after.permission, { kind: 'deny', reasons: ['막아'] });
});

test('진 종류의 사유는 버려진다', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', draft, {});
  api.permission.ask('사라질 사유');
  api.permission.deny('남을 사유');
  assert.deepEqual(draft.permission.reasons, ['남을 사유']);
});

test('권한과 치환과 턴은 각각 다른 슬롯이다', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', draft, {});
  api.permission.deny('막아');
  api.tool.rewrite({ command: 'ls' });
  api.turn.halt('그만');
  assert.equal(draft.permission.kind, 'deny');
  assert.deepEqual(draft.patch, { kind: 'input', value: { command: 'ls' } });
  assert.equal(draft.turn.kind, 'halt');
});

test('PostToolUse 의 feedback 은 block 으로 적히고 halt 에 진다', () => {
  const draft = emptyDraft();
  const api = apiFor('PostToolUse', draft, {});
  api.turn.feedback('되돌려라');
  api.turn.halt('그만');
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('halt 를 먼저 불러도 feedback 이 못 뒤집는다', () => {
  const draft = emptyDraft();
  const api = apiFor('PostToolUse', draft, {});
  api.turn.halt('그만');
  api.turn.feedback('되돌려라');
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('watchPaths 는 여러 애드온 것이 합쳐지고 reloadSkills 는 플래그다', () => {
  const draft = emptyDraft();
  apiFor('SessionStart', draft, {}).session.watchPaths('/a', '/b');
  const second = apiFor('SessionStart', draft, {});
  second.session.watchPaths('/c');
  second.session.reloadSkills();
  assert.deepEqual(draft.watchPaths, ['/a', '/b', '/c']);
  assert.equal(draft.reloadSkills, true);
});

test('setTitle 은 슬롯이고 빈 문자열도 값이라 안 덮인다', () => {
  const draft = emptyDraft();
  const api = apiFor('SessionStart', draft, {});
  api.session.setTitle('');
  api.session.setTitle('나중');
  assert.equal(draft.title, '');
});

test('injectUserMessage 는 선착 슬롯', () => {
  const draft = emptyDraft();
  const api = apiFor('SessionStart', draft, {});
  api.injectUserMessage('먼저');
  api.injectUserMessage('나중');
  assert.equal(draft.userMessage, '먼저');
});

test('tool.rewrite 는 선착 — 둘째 호출은 무시된다', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', draft, {});
  api.tool.rewrite({ command: 'a' });
  api.tool.rewrite({ command: 'b' });
  assert.deepEqual(draft.patch, { kind: 'input', value: { command: 'a' } });
});

test('rewriteOutput 은 output 치환 슬롯에 적힌다', () => {
  const draft = emptyDraft();
  const api = apiFor('PostToolUse', draft, {});
  api.tool.rewriteOutput('가려진 출력');
  assert.deepEqual(draft.patch, { kind: 'output', value: '가려진 출력' });
});

test('직렬화 불가 값의 rewrite 는 그 자리에서 던진다 — per-addon 격리로 넘어간다', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', draft, {});
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => api.tool.rewrite(cyclic));
  assert.equal(draft.patch, null);
});

test('stop_hook_active 면 keepGoing 이 무시된다', () => {
  const draft = emptyDraft();
  const api = apiFor('Stop', draft, { stop_hook_active: true });
  api.turn.keepGoing('더 해라');
  assert.equal(draft.turn, null);
});

test('stop_hook_active 여도 halt 는 먹는다', () => {
  const draft = emptyDraft();
  const api = apiFor('Stop', draft, { stop_hook_active: true });
  api.turn.halt('그만');
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('api 부터 JSON 까지 한 번에', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', draft, {});
  api.permission.deny('strict 모드에서는 Bash 를 안 쓴다');
  api.injectContext('.banaction 규칙 3번');
  api.notify('규칙 3번이 걸렸다');

  assert.deepEqual(toHookOutput('PreToolUse', draft), {
    systemMessage: '규칙 3번이 걸렸다',
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: 'strict 모드에서는 Bash 를 안 쓴다',
      additionalContext: '.banaction 규칙 3번',
    },
  });
});

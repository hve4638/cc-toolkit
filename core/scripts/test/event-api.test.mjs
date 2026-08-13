import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apiFor, emptyDraft, toHookOutput } from '../../event/lib/index.mjs';

const NO_ARGS = Object.freeze({});

test('notify·injectContext 는 쌓인다', () => {
  const draft = emptyDraft();
  const api = apiFor('Stop', NO_ARGS, draft, { stop_hook_active: false });
  api.notify('하나');
  api.notify('둘');
  api.injectContext('배경');
  assert.deepEqual(draft.notify, ['하나', '둘']);
  assert.deepEqual(draft.context, ['배경']);
});

test('args 는 모듈마다 그 모듈 것이 온다', () => {
  const draft = emptyDraft();
  const a = apiFor('PreToolUse', { mode: 'strict' }, draft, {});
  const b = apiFor('PreToolUse', { quiet: true }, draft, {});
  assert.deepEqual(a.args, { mode: 'strict' });
  assert.deepEqual(b.args, { quiet: true });
});

test('deny 가 여럿이면 사유가 모인다', () => {
  const draft = emptyDraft();
  apiFor('PreToolUse', NO_ARGS, draft, {}).permission.deny('첫째');
  apiFor('PreToolUse', NO_ARGS, draft, {}).permission.deny('둘째');
  assert.deepEqual(draft.permission, { kind: 'deny', reasons: ['첫째', '둘째'] });
});

test('deny 가 ask 를 이긴다 — 순서와 무관하게', () => {
  const before = emptyDraft();
  const api1 = apiFor('PreToolUse', NO_ARGS, before, {});
  api1.permission.ask('물어봐');
  api1.permission.deny('막아');
  assert.deepEqual(before.permission, { kind: 'deny', reasons: ['막아'] });

  const after = emptyDraft();
  const api2 = apiFor('PreToolUse', NO_ARGS, after, {});
  api2.permission.deny('막아');
  api2.permission.ask('물어봐');
  assert.deepEqual(after.permission, { kind: 'deny', reasons: ['막아'] });
});

test('진 종류의 사유는 버려진다', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', NO_ARGS, draft, {});
  api.permission.ask('사라질 사유');
  api.permission.deny('남을 사유');
  assert.deepEqual(draft.permission.reasons, ['남을 사유']);
});

test('권한과 치환과 턴은 각각 다른 슬롯이다', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', NO_ARGS, draft, {});
  api.permission.deny('막아');
  api.tool.rewrite({ command: 'ls' });
  api.turn.halt('그만');
  assert.equal(draft.permission.kind, 'deny');
  assert.deepEqual(draft.patch, { kind: 'input', value: { command: 'ls' } });
  assert.equal(draft.turn.kind, 'halt');
});

test('PostToolUse 의 feedback 은 block 으로 적히고 halt 에 진다', () => {
  const draft = emptyDraft();
  const api = apiFor('PostToolUse', NO_ARGS, draft, {});
  api.turn.feedback('되돌려라');
  api.turn.halt('그만');
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('halt 를 먼저 불러도 feedback 이 못 뒤집는다', () => {
  const draft = emptyDraft();
  const api = apiFor('PostToolUse', NO_ARGS, draft, {});
  api.turn.halt('그만');
  api.turn.feedback('되돌려라');
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('watchPaths 는 여러 모듈 것이 합쳐지고 reloadSkills 는 플래그다', () => {
  const draft = emptyDraft();
  apiFor('SessionStart', NO_ARGS, draft, {}).session.watchPaths('/a', '/b');
  const second = apiFor('SessionStart', NO_ARGS, draft, {});
  second.session.watchPaths('/c');
  second.session.reloadSkills();
  assert.deepEqual(draft.watchPaths, ['/a', '/b', '/c']);
  assert.equal(draft.reloadSkills, true);
});

test('setTitle 은 슬롯이고 빈 문자열도 값이라 안 덮인다', () => {
  const draft = emptyDraft();
  const api = apiFor('SessionStart', NO_ARGS, draft, {});
  api.session.setTitle('');
  api.session.setTitle('나중');
  assert.equal(draft.title, '');
});

test('stop_hook_active 면 keepGoing 이 무시된다', () => {
  const draft = emptyDraft();
  const api = apiFor('Stop', NO_ARGS, draft, { stop_hook_active: true });
  api.turn.keepGoing('더 해라');
  assert.equal(draft.turn, null);
});

test('stop_hook_active 여도 halt 는 먹는다', () => {
  const draft = emptyDraft();
  const api = apiFor('Stop', NO_ARGS, draft, { stop_hook_active: true });
  api.turn.halt('그만');
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('api 부터 JSON 까지 한 번에', () => {
  const draft = emptyDraft();
  const api = apiFor('PreToolUse', { mode: 'strict' }, draft, {});
  api.permission.deny(`${api.args.mode} 모드에서는 Bash 를 안 쓴다`);
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

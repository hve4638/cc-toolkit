import { test } from 'node:test';
import assert from 'node:assert/strict';

import { create, dispatch } from '../../event/lib/index.mjs';

/** 모듈 하나를 흉내낸다. */
function mod(register, args = {}) {
  const addon = create();
  register(addon);
  return { addon, args };
}

const PRE = { tool_name: 'Bash', tool_input: { command: 'ls' } };

test('등록이 없으면 빈 Draft', async () => {
  const draft = await dispatch('PreToolUse', PRE, []);
  assert.equal(draft.permission, null);
  assert.deepEqual(draft.context, []);
});

test('다른 이벤트 등록은 안 돈다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('Stop', {}, (api) => api.turn.keepGoing('안 돌아야 함'))),
  ]);
  assert.equal(draft.turn, null);
});

test('밴드 순으로 돈다 — high 가 medium 보다 먼저', async () => {
  const order = [];
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('PreToolUse', {}, (api) => {
      order.push('medium');
      api.permission.deny('medium');
    })),
    mod((a) => a.register('PreToolUse', { priority: 'high' }, (api) => {
      order.push('high');
      api.permission.deny('high');
    })),
  ]);
  assert.deepEqual(order, ['high', 'medium']);
  assert.deepEqual(draft.permission.reasons, ['high', 'medium']);
});

test('같은 밴드면 적힌 순서를 지킨다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('PreToolUse', {}, (api) => api.injectContext('첫째'))),
    mod((a) => a.register('PreToolUse', {}, (api) => api.injectContext('둘째'))),
  ]);
  assert.deepEqual(draft.context, ['첫째', '둘째']);
});

test('한 모듈이 같은 이벤트를 두 번 잡아도 둘 다 돈다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => {
      a.register('PreToolUse', {}, (api) => api.injectContext('하나'));
      a.register('PreToolUse', {}, (api) => api.injectContext('둘'));
    }),
  ]);
  assert.deepEqual(draft.context, ['하나', '둘']);
});

test('모듈마다 자기 args 를 받는다', async () => {
  const seen = [];
  await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('PreToolUse', {}, (api) => seen.push(api.args)), { mode: 'strict' }),
    mod((a) => a.register('PreToolUse', {}, (api) => seen.push(api.args)), { quiet: true }),
  ]);
  assert.deepEqual(seen, [{ mode: 'strict' }, { quiet: true }]);
});

test('던진 핸들러는 자기가 적은 것을 전부 잃는다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('PreToolUse', {}, (api) => {
      api.injectContext('사라져야 함');
      api.permission.deny('사라져야 함');
      throw new Error('터짐');
    })),
    mod((a) => a.register('PreToolUse', {}, (api) => {
      api.injectContext('남아야 함');
      api.permission.ask('남아야 함');
    })),
  ]);
  assert.deepEqual(draft.context, ['남아야 함']);
  assert.deepEqual(draft.permission, { kind: 'ask', reasons: ['남아야 함'] });
});

test('던진 핸들러가 슬롯을 선점하지 못한다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('PreToolUse', { priority: 'high' }, (api) => {
      api.permission.deny('고장난 모듈');
      throw new Error('터짐');
    })),
    mod((a) => a.register('PreToolUse', {}, (api) => api.permission.ask('멀쩡한 모듈'))),
  ]);
  assert.deepEqual(draft.permission, { kind: 'ask', reasons: ['멀쩡한 모듈'] });
});

test('async 핸들러를 기다리고 순서를 지킨다', async () => {
  const order = [];
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('PreToolUse', {}, async (api) => {
      await new Promise((r) => setTimeout(r, 20));
      order.push('느린 것');
      api.injectContext('느린 것');
    })),
    mod((a) => a.register('PreToolUse', {}, (api) => {
      order.push('빠른 것');
      api.injectContext('빠른 것');
    })),
  ]);
  assert.deepEqual(order, ['느린 것', '빠른 것']);
  assert.deepEqual(draft.context, ['느린 것', '빠른 것']);
});

test('던진 async 핸들러도 격리된다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    mod((a) => a.register('PreToolUse', {}, async (api) => {
      api.injectContext('사라져야 함');
      await Promise.reject(new Error('터짐'));
    })),
    mod((a) => a.register('PreToolUse', {}, (api) => api.injectContext('남아야 함'))),
  ]);
  assert.deepEqual(draft.context, ['남아야 함']);
});

test('모듈 사이에서도 halt 가 block 을 이긴다', async () => {
  const draft = await dispatch('PostToolUse', { tool_name: 'Write' }, [
    mod((a) => a.register('PostToolUse', {}, (api) => api.turn.feedback('되돌려라'))),
    mod((a) => a.register('PostToolUse', {}, (api) => api.turn.halt('그만'))),
  ]);
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('Stop 의 stop_hook_active 가 dispatch 를 거쳐도 걸린다', async () => {
  const draft = await dispatch('Stop', { stop_hook_active: true }, [
    mod((a) => a.register('Stop', {}, (api) => api.turn.keepGoing('더 해라'))),
  ]);
  assert.equal(draft.turn, null);
});

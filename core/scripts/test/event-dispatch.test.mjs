import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dispatch } from '../../event/lib/index.mjs';

/**
 * 불러온 애드온 하나를 흉내낸다. dispatch 는 handlers·priority 와 LoadedAddon
 * 의 rules 만 보므로 decl.rules 는 비워 둔다.
 */
function loaded(handlers, { priority, rules = {} } = {}) {
  return { decl: { rules: {}, ...(priority ? { priority } : {}), handlers }, rules };
}

const PRE = { tool_name: 'Bash', tool_input: { command: 'ls' } };

test('애드온이 없으면 빈 Draft', async () => {
  const draft = await dispatch('PreToolUse', PRE, []);
  assert.equal(draft.permission, null);
  assert.deepEqual(draft.context, []);
});

test('이 이벤트의 핸들러가 없는 애드온은 건너뛴다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    loaded({ Stop: (api) => api.turn.keepGoing('안 돌아야 함') }),
  ]);
  assert.equal(draft.turn, null);
});

test('밴드 순으로 돈다 — high 가 medium 보다 먼저', async () => {
  const order = [];
  const draft = await dispatch('PreToolUse', PRE, [
    loaded({ PreToolUse: (api) => { order.push('medium'); api.permission.deny('medium'); } }),
    loaded(
      { PreToolUse: (api) => { order.push('high'); api.permission.deny('high'); } },
      { priority: { PreToolUse: 'high' } },
    ),
  ]);
  assert.deepEqual(order, ['high', 'medium']);
  assert.deepEqual(draft.permission.reasons, ['high', 'medium']);
});

test('모르는 밴드 값은 medium 으로 떨어진다', async () => {
  const order = [];
  await dispatch('PreToolUse', PRE, [
    loaded({ PreToolUse: () => { order.push('low'); } }, { priority: { PreToolUse: 'low' } }),
    loaded({ PreToolUse: () => { order.push('urgent'); } }, { priority: { PreToolUse: 'urgent' } }),
    loaded({ PreToolUse: () => { order.push('high'); } }, { priority: { PreToolUse: 'high' } }),
  ]);
  assert.deepEqual(order, ['high', 'urgent', 'low']);
});

test('priority 는 이벤트별이다 — 다른 이벤트의 밴드는 안 본다', async () => {
  const order = [];
  await dispatch('PreToolUse', PRE, [
    loaded({ PreToolUse: () => { order.push('first') } }),
    loaded(
      { PreToolUse: () => { order.push('stop-high') } },
      { priority: { Stop: 'high' } },
    ),
  ]);
  // Stop 의 high 는 PreToolUse 순서에 영향이 없어 입력 순서대로 남는다.
  assert.deepEqual(order, ['first', 'stop-high']);
});

test('핸들러는 자기 애드온의 rules 를 셋째 인자로 받는다', async () => {
  const seen = [];
  await dispatch('PreToolUse', PRE, [
    loaded({ PreToolUse: (api, payload, rules) => seen.push(rules) }, {
      rules: { 'rule-a': { trigger: true, mode: 'strict' } },
    }),
    loaded({ PreToolUse: (api, payload, rules) => seen.push(rules) }, {
      rules: { 'rule-b': { trigger: false } },
    }),
  ]);
  assert.deepEqual(seen, [
    { 'rule-a': { trigger: true, mode: 'strict' } },
    { 'rule-b': { trigger: false } },
  ]);
});

test('던진 핸들러는 자기가 적은 것을 전부 잃는다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    loaded({
      PreToolUse: (api) => {
        api.injectContext('사라져야 함');
        api.permission.deny('사라져야 함');
        throw new Error('터짐');
      },
    }),
    loaded({
      PreToolUse: (api) => {
        api.injectContext('남아야 함');
        api.permission.ask('남아야 함');
      },
    }),
  ]);
  assert.deepEqual(draft.context, ['남아야 함']);
  assert.deepEqual(draft.permission, { kind: 'ask', reasons: ['남아야 함'] });
});

test('던진 핸들러가 슬롯을 선점하지 못한다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    loaded(
      {
        PreToolUse: (api) => {
          api.permission.deny('고장난 애드온');
          throw new Error('터짐');
        },
      },
      { priority: { PreToolUse: 'high' } },
    ),
    loaded({ PreToolUse: (api) => api.permission.ask('멀쩡한 애드온') }),
  ]);
  assert.deepEqual(draft.permission, { kind: 'ask', reasons: ['멀쩡한 애드온'] });
});

test('async 핸들러를 기다리고 순서를 지킨다', async () => {
  const order = [];
  const draft = await dispatch('PreToolUse', PRE, [
    loaded(
      {
        PreToolUse: async (api) => {
          await new Promise((r) => setTimeout(r, 20));
          order.push('느린 것');
          api.injectContext('느린 것');
        },
      },
      { priority: { PreToolUse: 'high' } },
    ),
    loaded({
      PreToolUse: (api) => {
        order.push('빠른 것');
        api.injectContext('빠른 것');
      },
    }),
  ]);
  assert.deepEqual(order, ['느린 것', '빠른 것']);
  assert.deepEqual(draft.context, ['느린 것', '빠른 것']);
});

test('던진 async 핸들러도 격리된다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    loaded({
      PreToolUse: async (api) => {
        api.injectContext('사라져야 함');
        await Promise.reject(new Error('터짐'));
      },
    }),
    loaded({ PreToolUse: (api) => api.injectContext('남아야 함') }),
  ]);
  assert.deepEqual(draft.context, ['남아야 함']);
});

test('애드온 사이에서도 halt 가 block 을 이긴다', async () => {
  const draft = await dispatch('PostToolUse', { tool_name: 'Write' }, [
    loaded({ PostToolUse: (api) => api.turn.feedback('되돌려라') }),
    loaded({ PostToolUse: (api) => api.turn.halt('그만') }),
  ]);
  assert.deepEqual(draft.turn, { kind: 'halt', reasons: ['그만'] });
});

test('선착 슬롯은 애드온 사이에서도 먼저 돈 쪽이 이긴다 — 밴드가 순서를 정한다', async () => {
  const draft = await dispatch('PreToolUse', PRE, [
    loaded({ PreToolUse: (api) => api.tool.rewrite({ command: 'medium' }) }),
    loaded(
      { PreToolUse: (api) => api.tool.rewrite({ command: 'high' }) },
      { priority: { PreToolUse: 'high' } },
    ),
  ]);
  assert.deepEqual(draft.patch, { kind: 'input', value: { command: 'high' } });
});

test('userMessage·title 도 애드온 사이 선착이다', async () => {
  const draft = await dispatch('SessionStart', {}, [
    loaded({
      SessionStart: (api) => {
        api.injectUserMessage('먼저');
        api.session.setTitle('첫 제목');
      },
    }),
    loaded({
      SessionStart: (api) => {
        api.injectUserMessage('나중');
        api.session.setTitle('둘째 제목');
      },
    }),
  ]);
  assert.equal(draft.userMessage, '먼저');
  assert.equal(draft.title, '첫 제목');
});

test('직렬화 불가 rewrite 애드온은 통째로 무효화되고 다른 애드온의 deny 는 남는다', async () => {
  const cyclic = {};
  cyclic.self = cyclic;
  const draft = await dispatch('PreToolUse', PRE, [
    loaded({
      PreToolUse: (api) => {
        api.injectContext('사라져야 함');
        api.tool.rewrite(cyclic);
      },
    }),
    loaded({ PreToolUse: (api) => api.permission.deny('막아') }),
  ]);
  assert.deepEqual(draft.permission, { kind: 'deny', reasons: ['막아'] });
  assert.equal(draft.patch, null);
  assert.deepEqual(draft.context, []);
});

test('Stop 의 stop_hook_active 가 dispatch 를 거쳐도 걸린다', async () => {
  const draft = await dispatch('Stop', { stop_hook_active: true }, [
    loaded({ Stop: (api) => api.turn.keepGoing('더 해라') }),
  ]);
  assert.equal(draft.turn, null);
});

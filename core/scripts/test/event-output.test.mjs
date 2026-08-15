import { test } from 'node:test';
import assert from 'node:assert/strict';

import { emptyDraft, toHookOutput } from '../../event/lib/index.mjs';

function draft(fields) {
  return { ...emptyDraft(), ...fields };
}

test('아무도 아무것도 안 부르면 빈 객체', () => {
  assert.deepEqual(toHookOutput('Stop', draft({})), {});
});

test('notify 는 최상위 systemMessage', () => {
  assert.deepEqual(toHookOutput('Stop', draft({ notify: ['한 줄'] })), {
    systemMessage: '한 줄',
  });
});

test('여러 모듈의 notify·injectContext 는 줄바꿈으로 이어붙는다', () => {
  const out = toHookOutput('SessionStart', draft({
    context: ['첫째', '둘째'],
    notify: ['하나', '둘'],
  }));
  assert.equal(out.systemMessage, '하나\n둘');
  assert.equal(out.hookSpecificOutput.additionalContext, '첫째\n둘째');
});

test('permission 판정은 hookSpecificOutput 안으로', () => {
  assert.deepEqual(toHookOutput('PreToolUse', draft({
    permission: { kind: 'deny', reasons: ['생성물이다'] },
  })), {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: '생성물이다',
    },
  });
});

test('사유가 둘 이상이면 번호 태그로 감싼다', () => {
  const out = toHookOutput('PreToolUse', draft({
    permission: { kind: 'deny', reasons: ['생성물이다', '감사 로그가 꺼져 있다'] },
  }));
  assert.equal(
    out.hookSpecificOutput.permissionDecisionReason,
    '<reason_1>생성물이다</reason_1>\n<reason_2>감사 로그가 꺼져 있다</reason_2>',
  );
});

test('사유가 없으면 reason 필드를 안 만든다', () => {
  const out = toHookOutput('PreToolUse', draft({
    permission: { kind: 'allow', reasons: [] },
  }));
  assert.equal(out.hookSpecificOutput.permissionDecision, 'allow');
  assert.equal('permissionDecisionReason' in out.hookSpecificOutput, false);
});

test('block 은 최상위 decision 으로', () => {
  assert.deepEqual(toHookOutput('Stop', draft({
    turn: { kind: 'block', reasons: ['아직 안 끝났다'] },
  })), {
    decision: 'block',
    reason: '아직 안 끝났다',
  });
});

test('halt 는 continue:false 와 stopReason 으로', () => {
  assert.deepEqual(toHookOutput('PreToolUse', draft({
    turn: { kind: 'halt', reasons: ['설정이 없다'] },
  })), {
    continue: false,
    stopReason: '설정이 없다',
  });
});

test('권한과 턴은 다른 슬롯이라 같이 나간다', () => {
  const out = toHookOutput('PreToolUse', draft({
    permission: { kind: 'deny', reasons: ['막는다'] },
    turn: { kind: 'halt', reasons: ['그만'] },
  }));
  assert.equal(out.continue, false);
  assert.equal(out.stopReason, '그만');
  assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
});

test('판정과 치환도 다른 슬롯이라 같이 실린다', () => {
  const out = toHookOutput('PreToolUse', draft({
    permission: { kind: 'ask', reasons: ['경로를 고쳤다'] },
    patch: { kind: 'input', value: { command: 'rm -rf ./build' } },
  }));
  assert.deepEqual(out.hookSpecificOutput, {
    hookEventName: 'PreToolUse',
    permissionDecision: 'ask',
    permissionDecisionReason: '경로를 고쳤다',
    updatedInput: { command: 'rm -rf ./build' },
  });
});

test('출력 치환은 updatedToolOutput', () => {
  const out = toHookOutput('PostToolUse', draft({
    patch: { kind: 'output', value: '가려진 출력' },
  }));
  assert.equal(out.hookSpecificOutput.updatedToolOutput, '가려진 출력');
});

test('SessionStart 의 네 칸이 전부 실린다', () => {
  assert.deepEqual(toHookOutput('SessionStart', draft({
    userMessage: '시작하자',
    title: 'cc-toolkit',
    watchPaths: ['/repo/AGENTADDON.md'],
    reloadSkills: true,
  })), {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      initialUserMessage: '시작하자',
      sessionTitle: 'cc-toolkit',
      watchPaths: ['/repo/AGENTADDON.md'],
      reloadSkills: true,
    },
  });
});

test('빈 문자열도 값이라 실린다', () => {
  const out = toHookOutput('SessionStart', draft({ title: '' }));
  assert.equal(out.hookSpecificOutput.sessionTitle, '');
});

test('reloadSkills 를 안 부르면 필드가 아예 없다', () => {
  assert.deepEqual(toHookOutput('SessionStart', draft({ reloadSkills: false })), {});
});

test('hookSpecificOutput 에 넣을 게 없으면 그 키를 안 만든다', () => {
  const out = toHookOutput('PostToolUse', draft({
    turn: { kind: 'block', reasons: ['되돌려라'] },
    notify: ['알림'],
  }));
  assert.equal('hookSpecificOutput' in out, false);
});

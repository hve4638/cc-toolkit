// @ts-check
/**
 * useterminal — 세션이 useterminal 을 쓸 수 있을 때 그 사실을 알린다.
 *
 * 훅 프로세스는 세션이 도는 pane 의 TMUX env 를 물려받는다 (실측 확인) —
 * 없으면 pane 을 열 창 자체가 없으니 어느 규칙이 켜져 있어도 침묵한다.
 *
 * 두 수위가 있다: 기본은 존재만 알리는 hint.md 고 (alwaysEvents 상시 — 끄는
 * 스위치 없음), opt-in 규칙 `useterminal-proactive` 를 켜면 시키지 않아도
 * 먼저 pane 을 열라는 proactive.md 가 hint 를 대체한다.
 *
 * 본문 파일은 import 시점에 읽고 없으면 던진다 — 패키징 실수는
 * build-manifest·테스트에서 죽어 드러나고, 런타임은 collect 의 fail-open 이
 * 이 애드온만 뺀다.
 *
 * startup·compact·clear 에서만 주입한다 — resume·fork 는 트랜스크립트
 * 복원이 이전 주입분을 되살려 중복이다.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTextOr } from '../../scripts/lib/corelib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const INJECT_SOURCES = new Set(['startup', 'compact', 'clear']);

/** @param {string} name */
function loadBody(name) {
  const text = (readTextOr(join(HERE, name)) ?? '').trim();
  if (text === '') throw new Error(`addon/useterminal/${name}: 없거나 비었다`);
  return text;
}

const HINT = loadBody('hint.md');
const PROACTIVE = loadBody('proactive.md');

/** @type {import('../../event/lib/index.mjs').AddonDecl} */
export default {
  rules: {
    'useterminal-proactive': { events: ['SessionStart'] },
  },
  alwaysEvents: ['SessionStart'],
  handlers: {
    SessionStart(api, payload, rules) {
      if (!INJECT_SOURCES.has(payload.source)) return;
      if (!process.env.TMUX) return;
      const body = rules['useterminal-proactive']?.trigger ? PROACTIVE : HINT;
      api.injectContext(`<useterminal>\n${body}\n</useterminal>`);
    },
  },
};

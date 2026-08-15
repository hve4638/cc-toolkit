#!/usr/bin/env node
// @ts-check
/**
 * event 호스트 — 훅이 부르는 진입점.
 *
 *     main.mjs <EventName>        stdin = 훅 payload JSON
 *
 * 이번 이벤트에 불릴 애드온을 찾아(collect) 차례로 돌리고(dispatch) 그 결과를
 * 훅 규약의 JSON 으로 뱉는다(toHookOutput). 판정 규칙은 core/event/README.md.
 *
 * 어디서 무엇이 잘못돼도 stdout 은 나가고 종료 코드는 0 이다. 훅이 죽으면
 * 도구 호출이나 세션 시작이 같이 막히므로, 이 파일에서 실패는 "아무 말도
 * 하지 않음" 이지 오류가 아니다.
 */

import { isEventName, dispatch, toHookOutput } from './lib/index.mjs';
import { readHookPayload, resolveProjectRoot } from '../scripts/lib/corelib.mjs';
import { collect } from './collect.mjs';

async function main() {
  const event = process.argv[2] ?? '';
  if (!isEventName(event)) return {};

  const payload = await readHookPayload();
  // payload 없이는 어느 모듈도 판단할 수 없다.
  if (payload === null) return {};

  const addons = await collect(resolveProjectRoot(payload), event);
  return toHookOutput(event, await dispatch(event, payload, addons));
}

let output = {};
try {
  output = await main();
} catch { /* fail-open */ }
let text = '{}';
try {
  // api 가 직렬화를 앞서 강제하지만, 최후의 stringify 실패도 훅을 죽여서는
  // 안 된다 — exit 0 과 유효한 JSON 이 이 파일의 계약이다.
  text = JSON.stringify(output) ?? '{}';
} catch { /* fail-open */ }
process.stdout.write(text);

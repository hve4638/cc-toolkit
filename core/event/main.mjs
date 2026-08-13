#!/usr/bin/env node
// @ts-check
/**
 * event 호스트 — 훅이 부르는 진입점.
 *
 *     main.mjs <EventName>        stdin = 훅 payload JSON
 *
 * 켜진 모듈을 불러(collect) 차례로 돌리고(dispatch) 그 결과를 훅 규약의
 * JSON 으로 뱉는다(toHookOutput). 판정 규칙은 core/event/README.md.
 *
 * 어디서 무엇이 잘못돼도 stdout 은 나가고 종료 코드는 0 이다. 훅이 죽으면
 * 도구 호출이나 세션 시작이 같이 막히므로, 이 파일에서 실패는 "아무 말도
 * 하지 않음" 이지 오류가 아니다.
 */

import { isEventName, dispatch, toHookOutput } from './lib/index.mjs';
import { resolveProjectRoot } from '../scripts/lib/agent-memory.mjs';
import { collect } from './collect.mjs';

/** @returns {Promise<string>} */
function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

async function main() {
  const event = process.argv[2] ?? '';
  if (!isEventName(event)) return {};

  const raw = await readStdin();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    // payload 없이는 어느 모듈도 판단할 수 없다.
    return {};
  }

  const modules = await collect(resolveProjectRoot(payload));
  return toHookOutput(event, await dispatch(event, payload, modules));
}

let output = {};
try {
  output = await main();
} catch { /* fail-open */ }
process.stdout.write(JSON.stringify(output));

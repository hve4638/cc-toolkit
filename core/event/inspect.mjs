// @ts-check
/**
 * 애드온 스위치 상태 점검 도구 — import 없이 메타데이터만 읽는다.
 *
 *   node inspect.mjs [세션루트]     (생략 시 현재 디렉터리)
 *
 * manifest.json (규칙 → 이벤트 표) 과 agentaddon `event` 설정 층을 대조해
 * 세 가지를 보고한다: 사용 가능한 규칙, 현 설정으로 켜진 항목 (manifest 에
 * 없는 이름은 경고 — 런타임은 조용히 무시하므로 여기서만 드러난다),
 * 이벤트별로 발화하는 애드온과 그 이유 (상시 / 어느 규칙).
 *
 * 자기 파일 위치 기준 상대 경로라, 저장소 사본을 실행하면 저장소를,
 * 배포 캐시 사본을 실행하면 그 설치본을 조사한다 (collect.mjs 와 같은 패턴).
 * addon.mjs 는 import 하지 않는다 — manifest 가 선언과 어긋난 경우는 잡지
 * 못하지만, 그 낡음은 event-manifest.test.mjs 가 개발 시점에 잡는다.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from '../scripts/lib/addon-config.mjs';
import { readJsonOr } from '../scripts/lib/corelib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// lib 의 EVENT_SET 과 같은 네 이벤트. 출력 순서를 위해 배열로 둔다.
const EVENTS = ['SessionStart', 'PreToolUse', 'PostToolUse', 'Stop'];

const projectRoot = resolve(process.argv[2] ?? process.cwd());
const manifest = readJsonOr(join(HERE, 'manifest.json'));
const entries = Array.isArray(manifest?.addons) ? manifest.addons : [];
const enabled = load(projectRoot, 'event');

/** addon/banaction/addon.mjs → banaction */
function addonName(path) {
  return typeof path === 'string' ? dirname(path).split('/').pop() : '?';
}

function formatArgs(args) {
  const parts = Object.entries(args).map(([k, v]) => (v === true ? k : `${k}=${v}`));
  return parts.length ? `@${parts.join(',')}` : '';
}

// ── 사용 가능한 규칙 ────────────────────────────────────────────────────
const ruleRows = [];
for (const entry of entries) {
  for (const [name, rule] of Object.entries(entry.rules ?? {})) {
    if (Array.isArray(rule?.events)) ruleRows.push([name, rule.events]);
  }
}

console.log(`세션 루트: ${projectRoot}`);
console.log(`manifest : ${join(HERE, 'manifest.json')}${entries.length ? '' : ' ⚠ 없거나 비어 있음'}`);

console.log('\n사용 가능한 규칙:');
if (!ruleRows.length) console.log('  (없음)');
const nameWidth = Math.max(0, ...ruleRows.map(([name]) => name.length));
for (const [name, events] of ruleRows) {
  console.log(`  ${name.padEnd(nameWidth)}  → ${events.join(', ')}`);
}

// ── 현 설정으로 켜진 항목 ──────────────────────────────────────────────
const knownRules = new Set(ruleRows.map(([name]) => name));

console.log('\n현 설정으로 켜진 항목:');
if (!enabled.size) console.log('  (없음)');
for (const [name, args] of enabled) {
  const warn = knownRules.has(name) ? '' : '  ⚠ manifest 에 없는 이름 — 아무 효과 없음';
  console.log(`  ${name}${formatArgs(args)}${warn}`);
}

// ── 이벤트별 발화 ──────────────────────────────────────────────────────
console.log('\n이벤트별 발화 (현 상태 적용 시):');
for (const event of EVENTS) {
  const firing = [];
  for (const entry of entries) {
    const reasons = [];
    if (Array.isArray(entry.events) && entry.events.includes(event)) reasons.push('상시');
    for (const [name, rule] of Object.entries(entry.rules ?? {})) {
      if (Array.isArray(rule?.events) && rule.events.includes(event) && enabled.has(name)) {
        reasons.push(`${name} 에 의해`);
      }
    }
    if (reasons.length) firing.push(`${addonName(entry.path)} (${reasons.join(', ')})`);
  }
  console.log(`  ${event.padEnd(12)}: ${firing.length ? firing.join(', ') : '(없음)'}`);
}

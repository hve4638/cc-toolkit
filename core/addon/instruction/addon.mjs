// @ts-check
/**
 * instruction — 세션 시작 시 instructions/ 의 md 블록들을 컨텍스트로 주입한다.
 *
 * 파일 하나가 블록 하나다: instructions/<name>.md 의 내용을 <name>…</name> 으로
 * 감싸 파일명 정렬 순으로 이어붙인다. 종전의 core/instruction.md (한 파일에
 * 태그를 손으로 적던 방식) 를 대체한다 — scripts/session-start-inject.mjs 훅
 * 자체는 남아 있지만 core 는 instruction.md 를 더 두지 않아 발화하지 않는다.
 * 주입되는 것은 영문 블록만 — <name>.ko.md 는 번역 페어라 건너뛴다 (실으면
 * 같은 지시가 두 번 들어간다).
 *
 * 조각별 조건: frontmatter 에 `rule: <이름>` 을 적은 조각은 그 규칙이
 * agentaddon 에 켜진 프로젝트에서만 주입된다. frontmatter 없는 조각은 상시다 —
 * alwaysEvents 로 규칙 게이트를 빼서 규칙이 다 꺼져 있어도 핸들러가 불리고,
 * 상시 조각은 조건 없이 주입된다. `name: <태그>` 는 파일명 대신 쓸 태그명이다.
 * 규칙 선언은 import 시점의 폴더 스캔으로 조립되므로 조각을 더하거나 rule 을
 * 바꿨으면 manifest 를 재생성한다.
 *
 * startup·compact·clear 에서만 주입한다 (구식 matcher 와 같은 집합) —
 * resume·fork 는 트랜스크립트 복원이 이전 주입분을 되살려 중복이고, 앞으로
 * 생길 새 source 도 기본 제외다.
 */

import { readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../../scripts/lib/addonlib.mjs';
import { readTextOr } from '../../scripts/lib/corelib.mjs';

const DEFAULT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'instructions');

const INJECT_SOURCES = new Set(['startup', 'compact', 'clear']);

/**
 * 조각 원문에서 frontmatter 를 떼어 { rule, tag, body } 로 나눈다.
 *
 * frontmatter 는 `rule: <이름>` (주입 조건 규칙) 과 `name: <태그>` (파일명 대신
 * 쓸 태그명) 두 필드만 허용한다. 구조 파싱과 형식 오류 throw (오타가 조각을
 * 조용히 상시로 만드는 것의 방지) 는 addonlib 의 parseFrontmatter 가 맡고,
 * 여기는 값의 의미 검증만 남는다. 런타임에서 throw 는 collect 의 fail-open
 * 에 잡힌다.
 *
 * @param {string} name
 * @param {string} raw
 * @returns {{rule: string | null, tag: string | null, body: string}}
 */
export function parseFragment(name, raw) {
  const { fields, body } = parseFrontmatter(`instructions/${name}`, raw, ['rule', 'name']);
  // 태그는 <...> 안에 그대로 들어간다 — '>' 등이 섞이면 블록 구조가 깨진다.
  if (fields.name !== null && !/^[a-zA-Z0-9_-]+$/.test(fields.name)) {
    throw new Error(`instructions/${name}: 태그명 '${fields.name}' 은 영숫자·'_'·'-' 만 쓸 수 있다`);
  }
  return { rule: fields.rule, tag: fields.name, body };
}

/**
 * 폴더를 스캔해 선언을 조립한다. 기본 폴더로 만든 결과가 default export 고,
 * 인자를 받는 것은 테스트가 픽스처 폴더로 같은 조립을 검증하기 위함이다.
 *
 * @param {string} dir
 * @returns {import('../../event/lib/index.mjs').AddonDecl}
 */
export function createDecl(dir = DEFAULT_DIR) {
  let files = [];
  try {
    files = readdirSync(dir)
      .filter((n) => n.endsWith('.md') && !n.endsWith('.ko.md'))
      .sort();
  } catch {
    // 폴더 부재 → 조각 없음 (fail-open).
  }
  const fragments = [];
  const seenTags = new Set();
  for (const name of files) {
    const raw = readTextOr(join(dir, name), null);
    if (raw === null) continue;
    const { rule, tag, body } = parseFragment(name, raw);
    // 빈 본문 (빈 파일·frontmatter 만 있는 파일) 은 빈 태그 블록만 남긴다 —
    // 자리표시자 파일이 컨텍스트에 새지 않게 조각째 건너뛴다.
    if (body === '') continue;
    const finalTag = tag ?? basename(name, '.md');
    // name 재지정으로 두 조각이 같은 태그를 달 수 있다 — 같은 이름의 블록
    // 두 개는 저자 실수라 여기서 죽인다.
    if (seenTags.has(finalTag)) {
      throw new Error(`instructions/${name}: 태그 '${finalTag}' 가 다른 조각과 겹친다`);
    }
    seenTags.add(finalTag);
    fragments.push({ tag: finalTag, rule, body });
  }

  /** @type {NonNullable<import('../../event/lib/index.mjs').AddonDecl['rules']>} */
  const rules = {};
  for (const f of fragments) {
    if (f.rule !== null) rules[f.rule] = { events: ['SessionStart'] };
  }

  return {
    rules,
    // 상시 조각 때문에 규칙이 다 꺼져 있어도 (규칙이 없어도) 핸들러는 불린다.
    alwaysEvents: ['SessionStart'],
    handlers: {
      SessionStart(api, payload, ruleStates) {
        if (!INJECT_SOURCES.has(payload.source)) return;
        const blocks = fragments
          .filter((f) => f.rule === null || ruleStates[f.rule]?.trigger)
          .map((f) => `<${f.tag}>\n${f.body}\n</${f.tag}>`);
        if (blocks.length === 0) return;
        api.injectContext(blocks.join('\n\n'));
      },
    },
  };
}

export default createDecl();

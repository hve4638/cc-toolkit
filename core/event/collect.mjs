// @ts-check
/**
 * 켜진 규칙이 가리키는 애드온을 manifest 로 찾아 불러온다.
 *
 * 규칙 이름과 애드온 위치는 무관하다 — 어느 addon.mjs 가 어느 규칙을 구독하는지는
 * manifest.json (생성물, build-manifest.mjs 로 굽는다) 이 말해 준다. 덕분에
 * 이번 이벤트에 불릴 애드온만 import 하고, 나머지는 파일이 있어도 건드리지 않는다.
 *
 * manifest 는 길잡이일 뿐 판정의 기준이 아니다 — 규칙 상태(trigger)는 import 한
 * 선언(decl)의 rules 로 다시 고른다(selectRules). manifest 가 낡아 선언과 어긋나면
 * 그 애드온은 조용히 빠진다.
 *
 * 항목이 없거나, manifest 가 깨졌거나, import 가 던지거나, default 가 애드온
 * 선언이 아니면 조용히 빠진다 — config 오타나 모듈 하나의 고장이 훅 전체를
 * 죽이지 않게 하는 agentaddon 의 fail-open 을 그대로 따른다.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadState } from '../scripts/lib/addon-config.mjs';
import { readJsonOr } from '../scripts/lib/corelib.mjs';
import { isAddonDecl, selectRules } from './lib/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(HERE);
const NAMESPACE = 'event';

/**
 * manifest 항목만 보고 "이번 이벤트에 켜진 규칙이 하나라도 있는가" 를 미리
 * 거른다. import 없이 걸러내는 것이 manifest 의 존재 이유다. 기본 켜짐
 * (enabledByDefault) 규칙은 설정에 줄이 없어도 켜진 것으로 치되, 부정이
 * 매치한 적 있으면 꺼진 것으로 본다 — selectRules 와 같은 판정이다.
 *
 * 규칙 없는 상시 애드온의 항목은 rules 대신 events 를 갖는다 — 설정과 무관하게
 * 이벤트만 맞으면 통과한다.
 *
 * @param {unknown} entry
 * @param {import('./lib/index.mjs').EventName} event
 * @param {ReadonlyMap<string, import('./lib/index.mjs').Args>} enabled
 * @param {(name: string) => boolean} negated
 */
function manifestSelects(entry, event, enabled, negated) {
  const { rules, events: alwaysEvents } =
    /** @type {{rules?: unknown, events?: unknown}} */ (entry ?? {});
  if (Array.isArray(alwaysEvents)) return alwaysEvents.includes(event);
  if (!rules || typeof rules !== 'object') return false;
  for (const [name, rule] of Object.entries(rules)) {
    const { events, enabledByDefault } =
      /** @type {{events?: unknown, enabledByDefault?: unknown}} */ (rule ?? {});
    if (!Array.isArray(events) || !events.includes(event)) continue;
    if (enabled.has(name)) return true;
    if (enabledByDefault === true && !negated(name)) return true;
  }
  return false;
}

/**
 * @param {unknown} relPath manifest 가 적어둔 플러그인 루트 기준 상대 경로
 * @returns {Promise<import('./lib/index.mjs').AddonDecl | null>}
 */
async function importDecl(relPath) {
  if (typeof relPath !== 'string') return null;
  try {
    const module = await import(pathToFileURL(join(PLUGIN_ROOT, relPath)).href);
    const decl = module.default;
    return isAddonDecl(decl) ? decl : null;
  } catch {
    return null;
  }
}

/**
 * 이번 이벤트에서 불릴 애드온들. 순서는 manifest 에 적힌 순서다 — 같은 밴드
 * 안의 실행 순서는 어차피 정의하지 않는다.
 *
 * @param {string} projectRoot 로컬 층을 읽을 세션 루트
 * @param {import('./lib/index.mjs').EventName} event
 * @returns {Promise<import('./lib/index.mjs').LoadedAddon[]>}
 */
export async function collect(projectRoot, event) {
  // 설정이 비어 있어도 조기 반환하지 않는다 — 기본 켜짐 규칙은 설정 없이 돈다.
  const { entries: enabled, negated } = loadState(projectRoot, NAMESPACE);

  const manifest = readJsonOr(join(HERE, 'manifest.json'));
  const entries = Array.isArray(manifest?.addons) ? manifest.addons : [];

  const loaded = [];
  for (const entry of entries) {
    if (!manifestSelects(entry, event, enabled, negated)) continue;
    const decl = await importDecl(entry.path);
    if (!decl) continue;
    const rules = selectRules(decl, event, enabled, negated);
    if (rules) loaded.push({ decl, rules });
  }
  return loaded;
}

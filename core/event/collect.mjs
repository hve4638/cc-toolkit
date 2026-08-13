// @ts-check
/**
 * 켜진 이벤트 모듈을 불러온다.
 *
 * 항목 `<kind>:<name>` 은 이 파일 옆의 `<kind>/<name>/index.mjs` 로 간다.
 * 그 자리에 없거나, import 가 던지거나, addon 을 default 로 내놓지 않는
 * 항목은 조용히 빠진다 — config 오타나 모듈 하나의 고장이 훅 전체를
 * 죽이지 않게 하는 aiaddon 의 fail-open 을 그대로 따른다.
 *
 * 어느 이벤트를 잡는지는 여기서 거르지 않는다. 그건 import 를 마쳐야 알 수
 * 있어 걸러도 아낄 것이 없고, dispatch 가 어차피 이벤트로 추린다.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load } from '../scripts/lib/aiaddon.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NAMESPACE = 'event';

// WHY: aiaddon 의 ENTRY_RE 가 `[a-z0-9-]+:[a-z0-9-]+` 만 통과시켜 콜론은 하나고
//      `.` 도 `/` 도 못 들어온다. 설정에서 온 문자열로 경로를 짓지만 상위로
//      새어나갈 수 없다.
/** @param {string} entry */
function modulePathOf(entry) {
  const [kind, name] = entry.split(':');
  return join(HERE, kind, name, 'index.mjs');
}

/**
 * @param {string} entry
 * @returns {Promise<import('./lib/index.mjs').Addon | null>}
 */
async function importAddon(entry) {
  try {
    const module = await import(pathToFileURL(modulePathOf(entry)).href);
    const addon = module.default;
    return Array.isArray(addon?.registrations) ? addon : null;
  } catch {
    return null;
  }
}

/**
 * aiaddon 이 켜둔 순서 그대로.
 *
 * @param {string} projectRoot 로컬 층을 읽을 세션 루트
 * @returns {Promise<import('./lib/index.mjs').LoadedModule[]>}
 */
export async function collect(projectRoot) {
  const modules = [];
  for (const [entry, args] of load(projectRoot, NAMESPACE)) {
    const addon = await importAddon(entry);
    if (addon) modules.push({ addon, args });
  }
  return modules;
}

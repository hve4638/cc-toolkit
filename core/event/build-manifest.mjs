#!/usr/bin/env node
// @ts-check
/**
 * manifest.json 생성기 — 개발 도구.
 *
 *     node core/event/build-manifest.mjs
 *
 * core/addon/<이름>/addon.mjs 와 core/skills/<이름>/addon.mjs 를 전부 import 해
 * 각 선언의 rules 를 표로 굽고, 같은 스캔에서 사용자용 규칙 이름 목록
 * skills/available-addon-rule/available-rules.txt 도 같이 쓴다 (/available-addon-rule
 * 스킬이 그대로 보여주는 파일). addon.mjs 를 만들거나 rules 선언을 바꿨으면
 * 다시 돌려 두 생성물을 같이 커밋한다 — 낡은 생성물은
 * event-manifest.test.mjs 가 실스캔과 diff 해서 잡는다.
 *
 * 런타임(collect.mjs)과 달리 fail-open 이 아니다: import 가 던지면 그대로
 * 죽는다. 개발 시점에는 고장이 보여야 한다. default 가 선언이 아닌 파일만
 * 경고하고 건너뛴다.
 */

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isAddonDecl, isEventName } from './lib/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const SCAN_DIRS = ['addon', 'skills'];

// agentaddon 항목 이름 문법 (addon-config.mjs 의 ENTRY_RE 와 같은 집합).
// 벗어난 이름은 설정 줄로 켤 수도 끌 수도 없다 — 보통 규칙이면 영영 안 켜지는
// 오타고, enabledByDefault 규칙이면 부정이 닿지 않아 끌 수 없는 훅이 된다.
// 어느 쪽도 런타임에서는 증상이 없으므로 여기서 죽여 개발 시점에 드러낸다.
const RULE_NAME_RE = /^[a-z0-9:-]+$/;

/**
 * 항목은 두 형태다: 규칙 애드온은 { path, rules }, 규칙 없는 상시 애드온은
 * { path, events } (핸들러 키에서 얻은 이벤트 목록).
 *
 * @param {string} pluginRoot
 * @returns {Promise<{addons: ({path: string, rules: Record<string, {events: string[], enabledByDefault?: true}>} | {path: string, events: string[]})[]}>}
 */
export async function buildManifest(pluginRoot) {
  const addons = [];
  for (const base of SCAN_DIRS) {
    let names = [];
    try {
      names = readdirSync(join(pluginRoot, base), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
    } catch {
      continue;
    }
    for (const name of names) {
      const abs = join(pluginRoot, base, name, 'addon.mjs');
      if (!existsSync(abs)) continue;
      // alias 스킬은 원본 폴더의 verbatim 사본이라 addon.mjs 까지 딸려온다.
      // 둘 다 실으면 같은 규칙에 같은 핸들러가 두 번 돈다.
      if (base === 'skills' && existsSync(join(pluginRoot, base, name, '.alias'))) continue;
      const decl = (await import(pathToFileURL(abs).href)).default;
      const rel = `${base}/${name}/addon.mjs`;
      if (!isAddonDecl(decl)) {
        process.stderr.write(`skip ${rel}: default export 가 애드온 선언이 아니다\n`);
        continue;
      }
      const ruleEntries = Object.entries(decl.rules ?? {});
      if (ruleEntries.length === 0) {
        // rules 키의 오타 (rule, Rules 등) 는 검증을 통과한 채 여기로 떨어져
        // 저자의 opt-in 의도가 조용히 상시로 뒤집힌다 — 상시 선언에 모르는
        // 최상위 키가 있으면 죽여 개발 시점에 드러낸다.
        const KNOWN_KEYS = new Set(['rules', 'priority', 'handlers']);
        const unknown = Object.keys(decl).find((k) => !KNOWN_KEYS.has(k));
        if (unknown !== undefined) {
          throw new Error(`${rel}: 규칙 없는 상시 선언에 모르는 키 '${unknown}' — rules 의 오타면 의도가 상시로 뒤집힌다`);
        }
        // 규칙 없는 상시 애드온 — 이벤트 출처가 핸들러 키뿐이라, 오타 난 키는
        // 영영 발화하지 않고 런타임 증상도 없다. 규칙 이름 문법처럼 여기서 죽인다.
        const events = Object.keys(decl.handlers);
        for (const event of events) {
          if (!isEventName(event)) {
            throw new Error(`${rel}: 상시 애드온의 핸들러 키 '${event}' 는 이벤트 이름이 아니다`);
          }
        }
        // 핸들러가 0개면 영영 안 불릴 항목이다 — manifest 에 싣지 않는다.
        if (events.length === 0) continue;
        addons.push({ path: rel, events });
        continue;
      }
      for (const [ruleName] of ruleEntries) {
        if (!RULE_NAME_RE.test(ruleName)) {
          throw new Error(`${rel}: 규칙 이름 '${ruleName}' 이 agentaddon 이름 문법 (소문자·숫자·'-'·':') 을 벗어난다`);
        }
      }
      addons.push({
        path: rel,
        rules: Object.fromEntries(
          ruleEntries.map(([ruleName, rule]) => [
            ruleName,
            rule.enabledByDefault === true
              ? { events: [...rule.events], enabledByDefault: true }
              : { events: [...rule.events] },
          ]),
        ),
      });
    }
  }
  return { addons };
}

/**
 * 켤 수 있는 규칙 이름 목록 — 한 줄에 이름 하나, 정렬·중복 제거.
 * 상시 애드온은 이름이 없으니 실리지 않는다.
 * @param {Awaited<ReturnType<typeof buildManifest>>} manifest
 */
export function availableRulesText(manifest) {
  const names = new Set();
  for (const addon of manifest.addons) {
    for (const name of Object.keys('rules' in addon ? addon.rules : {})) names.add(name);
  }
  return `${[...names].sort().join('\n')}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await buildManifest(dirname(HERE));
  writeFileSync(join(HERE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const rulesTxt = join(dirname(HERE), 'skills', 'available-addon-rule', 'available-rules.txt');
  writeFileSync(rulesTxt, availableRulesText(manifest));
  const ruleCount = manifest.addons.reduce(
    (n, a) => n + Object.keys('rules' in a ? a.rules : {}).length,
    0,
  );
  // 상시 개수를 요약에 드러낸다 — 의도치 않게 상시가 된 선언이 눈에 띄게.
  const alwaysCount = manifest.addons.filter((a) => 'events' in a).length;
  process.stdout.write(`manifest.json + available-rules.txt: 애드온 ${manifest.addons.length}개 (상시 ${alwaysCount}개), 규칙 ${ruleCount}개\n`);
}

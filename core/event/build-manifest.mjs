#!/usr/bin/env node
// @ts-check
/**
 * manifest.json 생성기 — 개발 도구.
 *
 *     node core/event/build-manifest.mjs
 *
 * core/addon/<이름>/addon.mjs 와 core/skills/<이름>/addon.mjs 를 전부 import 해
 * 각 선언의 rules 를 표로 굽는다. addon.mjs 를 만들거나 rules 선언을 바꿨으면
 * 다시 돌려 manifest.json 을 같이 커밋한다 — 낡은 manifest 는
 * event-manifest.test.mjs 가 실스캔과 diff 해서 잡는다.
 *
 * 런타임(collect.mjs)과 달리 fail-open 이 아니다: import 가 던지면 그대로
 * 죽는다. 개발 시점에는 고장이 보여야 한다. default 가 선언이 아닌 파일만
 * 경고하고 건너뛴다.
 */

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isAddonDecl } from './lib/index.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

const SCAN_DIRS = ['addon', 'skills'];

/**
 * @param {string} pluginRoot
 * @returns {Promise<{addons: {path: string, rules: Record<string, {events: string[]}>}[]}>}
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
      addons.push({
        path: rel,
        rules: Object.fromEntries(
          Object.entries(decl.rules).map(([ruleName, rule]) => [ruleName, { events: [...rule.events] }]),
        ),
      });
    }
  }
  return { addons };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await buildManifest(dirname(HERE));
  writeFileSync(join(HERE, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const ruleCount = manifest.addons.reduce((n, a) => n + Object.keys(a.rules).length, 0);
  process.stdout.write(`manifest.json: 애드온 ${manifest.addons.length}개, 규칙 ${ruleCount}개\n`);
}

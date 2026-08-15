// @ts-check
/**
 * ponytail — 세션 시작 시 ponytail 규율 (같은 폴더 SKILL.md 본문) 을
 * 컨텍스트로 주입해 세션 내내 lazy 모드를 유지한다.
 *
 * frame 플러그인의 .ponytail 마커 가드레일을 이관한 것 — 켜기는 마커 파일
 * 대신 agentaddon `event` 파일의 `ponytail` 줄이다.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTextOr } from '../../scripts/lib/corelib.mjs';

const SKILL_PATH = join(dirname(fileURLToPath(import.meta.url)), 'SKILL.md');

/** @type {import('../../event/lib/index.mjs').AddonDecl} */
export default {
  rules: {
    ponytail: { events: ['SessionStart'] },
  },
  handlers: {
    SessionStart(api) {
      const raw = readTextOr(SKILL_PATH, null);
      // SKILL.md 부재·읽기 실패 → 주입할 게 없으니 침묵 (fail-open).
      if (raw === null) return;
      // frontmatter 는 스킬 로더용 메타데이터지 지시가 아니다 — 떼고 주입.
      const body = raw.replace(/^---[\s\S]*?---\s*/, '');
      api.injectContext(`PONYTAIL MODE ACTIVE\n\n${body}`);
    },
  },
};

// @ts-check
/**
 * writing-context-hint — 컨텍스트 문서 편집을 세션 플래그 파일에 적는다.
 *
 * SKILL.md·CLAUDE.md 류가 편집되면 <projectRoot>/.agent-memory/context-hint/
 * <session_id>.jsonl 에 { cmd, path } 한 줄을 남기고, Stop 훅
 * (scripts/stop-context-hint.mjs) 이 그걸 소비해 사용자에게 리뷰 힌트를 띄운다.
 * 서브에이전트의 도구 호출에도 발화한다 — session_id 는 메인 세션 것이 유지된다.
 *
 * 구식 스킬 훅 (skills/writing-great-skill·writing-great-agents-md 의
 * hooks.mjs) 을 합쳐 이관한 것. 규칙 없는 상시 애드온 — 켜고 끄는 개념 없이
 * 항상 돈다 (구식 훅과 같은 성격의 배관).
 */

import { basename } from 'node:path';
import { appendLine, resolveProjectRoot } from '../../scripts/lib/agent-memory.mjs';

const EDIT_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

// 대상 파일 → 리뷰를 권할 스킬 명령.
const HINT_COMMANDS = new Map([
  ['SKILL.md', '/writing-great-skill'],
  ['SKILL.ko.md', '/writing-great-skill'],
  ['CLAUDE.md', '/writing-great-agents-md'],
  ['AGENTS.md', '/writing-great-agents-md'],
]);

/** @type {import('../../event/lib/index.mjs').AddonDecl} */
export default {
  handlers: {
    PostToolUse(api, payload) {
      if (!EDIT_TOOLS.has(payload.tool_name)) return;
      const filePath = payload.tool_input?.file_path;
      if (typeof filePath !== 'string') return;
      const cmd = HINT_COMMANDS.get(basename(filePath));
      if (!cmd || !payload.session_id) return;
      // WHY: 한 턴의 병렬 편집로 훅 프로세스가 경합해도 O_APPEND 한 줄 추가는
      //      유실 없이 안전하다 — read-modify-write JSON 재작성은 쓰지 않는다.
      //      워크스페이스 부재 가드는 appendLine 안에 있다.
      appendLine(
        resolveProjectRoot(payload),
        `context-hint/${payload.session_id}.jsonl`,
        JSON.stringify({ cmd, path: filePath }),
      );
    },
  },
};

# claude-code-plugin-mechanics

플러그인 hook 메커니즘에 대해 검증된 사실 기록. hook 재설계(run.cjs 제거, `hooks/hooks.mjs` 단일 진입점, 스킬 hook 순회) 전에 확인했다. 각 항목은 사실 → 증거 → 재현 방법 순서.

검증일: 2026-07-02. 공식 문서 출처:
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/plugins-reference

## 1. hook 설정의 인식 경로는 두 가지뿐이다

Claude Code는 (a) 플러그인 루트의 `hooks/hooks.json`, (b) `plugin.json`의 `hooks` 필드(인라인 객체 또는 경로)만 hook 설정으로 읽는다. `hooks/` 폴더 안의 다른 파일은 자동 실행되지 않고, manifest의 `command` 문자열이 명시적으로 가리킬 때만 실행된다. 추가 파일이 있어도 에러 없이 무시된다.

- 증거: plugins-reference "Location: `hooks/hooks.json` in plugin root, or inline in plugin.json". 예시 레이아웃의 `security-hooks.json`(Additional)은 plugin.json `hooks` 배열에 경로를 적어야 로드됨.
- repo 실례: core/frame/wiki 는 `hooks/hooks.json`, inlay 는 plugin.json 인라인(`inlay/.claude-plugin/plugin.json:17`).
- 함의: `hooks/` 안에 진입점 `.mjs` 를 둬도 자동 발화하지 않으므로 안전하다. `skills/<skill>/hooks.mjs` 도 마찬가지로 inert 한 supporting file 이다.

## 2. `CLAUDE_PLUGIN_ROOT` 는 버전 경로이며 업데이트 시 바뀐다

hook 실행 시 주입되는 환경변수로, 설치 디렉터리 절대경로다(예: `~/.claude/plugins/cache/hve/core/0.17.0`). 플러그인 업데이트 시 경로가 바뀌고, 이전 버전 디렉터리는 약 7일 뒤 정리된다. 세션 도중 업데이트되면 hook 은 `/reload-plugins` 전까지 이전 경로를 계속 쓴다.

- 증거: plugins-reference §635 "This path changes when the plugin updates. The previous version's directory remains on disk for about seven days", §637 "hook commands ... keep using the previous version's path. Run /reload-plugins to switch".
- 함의: `hooks/`·`scripts/` 코드 변경은 핫리로드 안 됨. `/reload-plugins` 또는 재시작 필요. `SKILL.md` 본문 변경만 즉시 반영.

## 3. hooks.json 의 `node` 절대경로 패치는 존재하지 않는다

run.cjs 도크스트링의 "setup patches the absolute node path in" 은 vendoring 출처(oh-my-claudecode)의 동작 설명이고, 이 repo 에는 그 패치 단계가 이식되지 않았다. 설치 캐시의 hooks.json 도 bare `node` 그대로이며, 이 환경에서 정상 작동한다.

- 증거: `~/.claude/plugins/cache/hve/core/<ver>/hooks/hooks.json` 의 command 가 `node "$CLAUDE_PLUGIN_ROOT"/...` (bare). repo 전체에 패치 코드(execPath 치환, find-node) 없음.
- 재현: `grep -o 'command": "[^"]*' ~/.claude/plugins/cache/hve/core/*/hooks/hooks.json` → 전부 bare `node`. 세션에서 enforcer 리마인더가 뜨는 것이 작동 증거.
- 함의: run.cjs 를 제거하고 직접호출로 바꿔도 잃는 패치가 없다. bare `node` 의존은 run.cjs 유무와 무관하게 이미 있던 조건이다(맨 앞 `node` 도 bare 이므로 run.cjs 자신도 같은 조건에서 뜬다).

## 4. run.cjs 는 런처이지 라우터가 아니다

`process.argv[2]` 로 받은 타깃 하나를 `spawnSync(process.execPath, ...)` 로 띄울 뿐, 이벤트 이름을 모르고 stdin 도 파싱하지 않는다(`stdio:'inherit'` 통과). 역할은 넷: 자식용 node 바이너리 보증, stale `CLAUDE_PLUGIN_ROOT` 복구(resolveTarget), hooks.json timeout 의 자식 reaping, fail-open. 이벤트 분기는 core 는 hooks.json 에서 타깃 파일로, frame 은 `dispatch.mjs <Event>` 인자로 한다.

- 증거: `core/scripts/run.cjs` (frame/wiki 에 vendored 사본). inlay 는 run.cjs 없이 `node .../scripts/*.mjs` 직접호출로 등록되어 작동 중 — 직접호출 선례.
- 비용: hook 발화마다 node 프로세스 2회 기동(run.cjs → 타깃).

## 5. Edit/Write 계열의 hook payload 에는 파일 경로가 온다

`tool_input` 은 해당 도구의 입력 파라미터를 그대로 담는다. Edit/Write/MultiEdit 는 `tool_input.file_path`, NotebookEdit 는 `tool_input.notebook_path`.

- 증거: 운영 중인 inlay 핸들러가 이 필드로 동작한다 — `frame/guardrails/inlay/hooks/pretooluse.mjs:16-19`, `posttooluse.mjs:10-14` 의 `extractPath()`. hooks 문서의 payload 예시(`tool_input: { command: "npm test" }`)도 도구 파라미터 미러링을 보여준다.
- 함의: hook 에서 편집 대상 파일의 basename/경로 필터링이 가능하다.

## 6. `additionalContext` 는 PreToolUse·PostToolUse 모두에서 모델에 주입된다

hook 이 `{ hookSpecificOutput: { hookEventName, additionalContext } }` 를 stdout 으로 내면, Claude Code 가 system-reminder 로 감싸 대화에 삽입한다. PreToolUse 는 도구 호출 시점에, PostToolUse 는 tool result 옆에 삽입된다.

- 증거: hooks 문서 "additionalContext field passes a string from your hook into Claude's context window. Claude Code wraps the string in a system reminder and inserts it into the conversation at the point where the hook fired", "PostToolUse: next to the tool result".
- 실증: core enforcer(PreToolUse)의 리마인더가 매 세션 관찰됨. 주입 형식은 `PreToolUse:<ToolName> hook additional context: <text>`.
- 주의: top-level 이 아니라 `hookSpecificOutput` 안에 wrap 해야 주입된다(`frame/guardrails/inlay/hooks/pretooluse.mjs:64-66` WHY 주석, frame `dispatch.mjs:62-66` 의 emit 형식).

## 7. hooks.json 의 `timeout` 은 Claude Code 가 직접 강제한다

hook 항목의 `timeout`(초) 초과 시 Claude Code 가 그 command 프로세스를 취소한다. command 타입 기본값 600초 (UserPromptSubmit 은 30초).

- 증거: hooks 문서 "timeout — Seconds before canceling. Defaults: 600 for command...".
- 함의: run.cjs 의 자식 reaping 없이도 직접호출 프로세스에 timeout 이 걸린다. 단일 프로세스면 네이티브 취소로 충분하다.

## 8. Pre/PostToolUse hook 은 subagent 의 도구호출에도 발화한다

subagent(Task/Agent 도구로 띄운 에이전트)가 도구를 쓸 때도 플러그인 hook 이 발화하고, 주입 context 는 그 subagent 의 컨텍스트에 도달한다. payload 에는 `agent_id`(subagent 내부 발화일 때만 존재)와 `agent_type` 이 추가된다.

- 증거 (문서): hooks 문서 "agent_id — Present only when the hook fires inside a subagent call. Use this to distinguish subagent hook calls from main-thread calls."
- 증거 (코드): inlay 가 `agent_id` 로 main/subagent 캐시를 분리한다 — `frame/guardrails/inlay/hooks/pretooluse.mjs:46-53`.
- 증거 (실증, 2026-07-02): haiku subagent 에게 tmp 파일 Write→Edit→Read 를 시키고 받은 리마인더를 verbatim 보고하게 한 결과, 세 호출 모두에서 enforcer 주입 문구를 원문 그대로 인용했다(`Verify the change after writing. Prefer Edit over Write for existing files.` / `Read multiple files in parallel when possible.` = `core/scripts/pre-tool-enforcer.mjs:21,23,28`). subagent 가 미리 알 수 없는 문자열이므로 발화·도달의 결정적 증거.
- 재현: 임의 subagent 에 "임시 파일을 Write→Edit→Read 하고, 각 호출에서 받은 system-reminder/hook additional context 를 글자 그대로 보고하라(없으면 none)" 프롬프트를 주고, 보고된 문구를 활성 hook 의 주입 문구와 대조한다.

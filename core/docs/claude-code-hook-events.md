# claude-code-hook-events

훅 이벤트와 그 반환 규약에 대한 검증된 사실 기록. `core/event/` 의 addon lib 이 이벤트별 api 를 제공하려면 어느 이벤트가 무엇을 낼 수 있는지가 단일 출처로 있어야 해서 정리했다.

검증일: 2026-08-11. 출처:
- https://code.claude.com/docs/en/hooks
- 설치된 CLI 바이너리 `/root/.local/share/claude/versions/2.1.226`

문서와 바이너리가 어긋나는 곳은 바이너리를 기준으로 적고 그 사실을 명시했다. 표의 "반환" 은 그 이벤트가 **자기만** 낼 수 있는 필드이고, 모든 이벤트에 공통인 필드는 5절에 따로 있다.

## 1. 이벤트는 31종이고 문서 목록은 하나를 빠뜨렸다

바이너리에 정본 배열이 그대로 들어 있다.

```
["PreToolUse","PostToolUse","PostToolUseFailure","PostToolBatch","Notification",
 "UserPromptSubmit","UserPromptExpansion","SessionStart","SessionEnd","Stop",
 "StopFailure","SubagentStart","SubagentStop","PreCompact","PostCompact",
 "PermissionRequest","PermissionDenied","Setup","TeammateIdle","TaskCreated",
 "TaskCompleted","Elicitation","ElicitationResult","ConfigChange","WorktreeCreate",
 "WorktreeRemove","InstructionsLoaded","CwdChanged","FileChanged","DirectoryAdded",
 "MessageDisplay"]
```

문서 페이지의 열거는 30종이며 `SessionEnd` 가 빠져 있다. 바이너리에는 `hook_event_name:"SessionEnd"` 로 발화하는 코드가 있고 matcher 로 `reason` 을 쓴다.

- 재현: `grep -aoE '\["PreToolUse"[^]]{0,700}\]' <바이너리> | head -1`
- 재현(개별 존재 확인): `grep -aoc '"SessionEnd"' <바이너리>` → 7

## 2. 반환 패턴은 8가지로 갈린다

이벤트마다 "차단" 이나 "주입" 의 표현이 다르므로, api 를 이벤트별로 나눠야 하는 근거가 이 분류다.

| 패턴 | 필드 | 해당 이벤트 |
|---|---|---|
| 컨텍스트 주입 | `hookSpecificOutput.additionalContext` | SessionStart, Setup, SubagentStart, UserPromptSubmit, UserPromptExpansion, PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, SubagentStop |
| 최상위 차단 | `{ decision: "block", reason }` | UserPromptSubmit, UserPromptExpansion, PostToolUse, PostToolUseFailure, PostToolBatch, Stop, SubagentStop, ConfigChange, PreCompact, TaskCreated, TaskCompleted |
| 권한 결정 | `hookSpecificOutput.permissionDecision` 계열 | PreToolUse, PermissionRequest |
| 재시도 허용 | `hookSpecificOutput.retry` | PermissionDenied |
| 내용 치환 | `updatedInput` / `updatedToolOutput` / `displayContent` | PreToolUse, PostToolUse, PostToolUseFailure, MessageDisplay |
| 경로 반환 | stdout 의 경로 또는 `hookSpecificOutput.worktreePath` | WorktreeCreate |
| elicitation 응답 | `hookSpecificOutput.action` + `content` | Elicitation, ElicitationResult |
| 출력 무시 | — | StopFailure, InstructionsLoaded, WorktreeRemove, PermissionDenied(exit code), MessageDisplay(exit code) |

## 3. 이벤트별 규약

payload 는 모든 이벤트가 `session_id`, `transcript_path`, `cwd`, `hook_event_name` 을 공통으로 받는다. 아래 "payload" 열은 그 외에 추가로 오는 것만 적었다.

| 이벤트 | payload | 반환 | exit 2 | matcher |
|---|---|---|---|---|
| SessionStart | `source`(startup/resume/clear/compact/fork), `model`(보장 안 됨) | `additionalContext`, `initialUserMessage`, `watchPaths`, `sessionTitle`, `reloadSkills` | stderr 를 사용자에게만 | source |
| SessionEnd | `reason` | 미확인 (문서 미기재) | 미확인 | reason |
| Setup | `flag`(init/maintenance) | `additionalContext` | stderr 를 사용자에게만 | — |
| UserPromptSubmit | `prompt`, `prompt_id`, `permission_mode` | `decision:"block"`+`reason`, `additionalContext` | 프롬프트를 막고 지운다 | — |
| UserPromptExpansion | `command_name`, `expanded_prompt` | `decision:"block"` | 확장을 막는다 | command name |
| PreToolUse | `tool_name`, `tool_input`, `tool_use_id`, `effort`, `agent_id`?, `agent_type`? | `permissionDecision`(allow/deny/ask/defer), `permissionDecisionReason`, `updatedInput`, `additionalContext` | 도구 호출을 막는다 | tool name |
| PermissionRequest | 위 + `matching_rule` | `decision:{ behavior, updatedInput, rule }` | 권한을 거부한다 | — |
| PermissionDenied | `tool_name`, `tool_input`, `tool_use_id` | `retry`(bool) | 무시 (이미 거부됨) | tool name |
| PostToolUse | `tool_output` 외 PreToolUse 와 동일 | `decision:"block"`, `updatedToolOutput`, `additionalContext` | stderr 를 Claude 에게 (도구는 이미 실행됨) | tool name |
| PostToolUseFailure | `tool_error` 외 동일 | `decision:"block"`, `updatedToolOutput`, `additionalContext` | stderr 를 Claude 에게 | tool name |
| PostToolBatch | `tool_calls[]` | `decision:"block"`, `additionalContext` | 다음 모델 호출 전에 루프를 끊는다 | — |
| Stop | `last_assistant_message` | `decision:"block"`, `additionalContext` | 멈추지 못하게 하고 대화를 잇는다 | 없음 (항상 발화) |
| StopFailure | `error_type`, `error_message` | 없음 | 무시 | error type |
| SubagentStart | `agent_id`, `agent_type` | `additionalContext` | stderr 를 사용자에게만 | agent type |
| SubagentStop | `agent_id`, `agent_type`, `last_assistant_message` | `decision:"block"`, `additionalContext` | 서브에이전트가 멈추지 못하게 한다 | agent type |
| TaskCreated | `task_title`, `task_description` | `decision:"block"` | 태스크 생성을 되돌린다 | — |
| TaskCompleted | `task_id`, `task_title` | `decision:"block"` | 완료 표시를 막는다 | — |
| TeammateIdle | `agent_id`, `agent_type` | `continue:false` | 팀메이트가 idle 로 가지 못하게 한다 | — |
| Notification | `notification_type`, `message` | 없음 | stderr 를 사용자에게만 | notification type |
| MessageDisplay | `message_text` | `displayContent` (화면만 교체, transcript 는 원본 유지) | 무시 | 없음 (항상 발화) |
| InstructionsLoaded | `file_path`, `load_reason` | 없음 | 무시 | load reason |
| ConfigChange | `source`, `file_path` | `decision:"block"` | 설정 변경을 막는다 (`policy_settings` 는 예외) | source |
| CwdChanged | `previous_cwd`, `new_cwd` | 없음 | stderr 를 사용자에게만 | 없음 |
| DirectoryAdded | `directory_path`, `source` | 없음 | stderr 를 디버그 로그로 | source |
| FileChanged | `file_path`, `change_type` | 없음 | stderr 를 사용자에게만 | 감시할 파일명 |
| WorktreeCreate | `branch`, `repo_root` | stdout 에 경로 (HTTP 훅은 `worktreePath`) | 비0이면 워크트리 생성 실패 | — |
| WorktreeRemove | `worktree_path` | 없음 | 디버그 모드에서만 기록 | — |
| PreCompact | `trigger`(manual/auto) | `decision:"block"` | compaction 을 막는다 | trigger |
| PostCompact | `trigger` | 없음 | stderr 를 사용자에게만 | trigger |
| Elicitation | `mcp_server`, `tool_name`, `elicitation_type`, `form_fields[]` | `action`(accept/decline/cancel), `content` | elicitation 을 거부한다 | mcp server |
| ElicitationResult | `mcp_server`, `tool_name`, `action`, `content` | `action`, `content` (사용자 응답을 덮어쓴다) | 응답을 막는다 (action 이 decline 이 된다) | mcp server |

`SessionEnd` 의 반환 규약은 문서에 없어 미확인이다. 바이너리에서는 어떤 분기가 `SessionStart`·`Setup` 과 같은 묶음으로 다루는 것만 확인했다.

## 4. 타임아웃 기본값이 낮은 이벤트가 둘 있다

command/http/mcp_tool 훅 기준이다.

- UserPromptSubmit — 30초
- MessageDisplay — 10초

## 5. 공통 필드

```json
{
  "continue": true,
  "stopReason": "continue 가 false 일 때 사용자에게 보일 이유",
  "suppressOutput": false,
  "systemMessage": "사용자에게만 보이는 경고 — 모델 컨텍스트에 안 들어간다",
  "terminalSequence": "OSC 이스케이프 시퀀스",
  "hookSpecificOutput": { "hookEventName": "<이벤트 이름>" }
}
```

다섯 필드 전부 바이너리에 존재를 확인했다. 다만 문서가 "Limited (context only)" 로 표시한 이벤트(Notification, PostCompact, CwdChanged, FileChanged, InstructionsLoaded, StopFailure 등)에서는 일부만 먹는다.

- 재현: `grep -aoc terminalSequence <바이너리>` 식으로 필드마다 확인

## 6. 실수하기 쉬운 지점 셋

### 6.1 `defer` 는 print 모드 전용이다

`permissionDecision: "defer"` 는 대화형 세션에서 조용히 무시된다. 바이너리에 경고 문구가 그대로 있다.

```
returned permissionDecision=defer in interactive mode; ignoring (defer is print-mode only)
```

- 재현: `grep -aoE '.{60}permissionDecision[^,]{0,120}' <바이너리>`

### 6.2 PreToolUse 에서 최상위 `decision` 은 deprecated 다

같은 "차단" 이라도 이벤트마다 자리가 다르다. Stop 계열은 최상위 `decision`, PreToolUse 는 `hookSpecificOutput.permissionDecision` 이다. 바이너리 문구:

```
top-level decision field for hooks (deprecated for PreToolUse, use hookSpecificOutput.permissionDecision instead)
```

### 6.3 exit 2 의 의미가 이벤트마다 다르다

같은 종료 코드가 어디서는 사용자에게 stderr 를 보이는 것으로 끝나고, 어디서는 동작을 되돌린다. 3절 표의 "exit 2" 열이 이벤트별 의미다.

## 7. 저장소 현황 (2026-08-11 기준)

등록해 쓰는 이벤트는 7종이다.

| 이벤트 | core | frame | personal | usefable |
|---|---|---|---|---|
| SessionStart | 3 | 1 | 1 | 1 |
| PreToolUse | 1 | 1 | | |
| PostToolUse | 1 | 1 | | |
| Stop | 2 | 1 | | |
| UserPromptSubmit | | 1 | | |
| PostCompact | | 1 | | |
| SubagentStop | | 1 | | |

`core/hooks/hooks.mjs` 와 `frame/scripts/dispatch.mjs` 는 둘 다 Stop 계열에서만 `decision:"block"` 을 낼 수 있게 짜여 있어 규약의 부분집합만 구현한다. 2절 표 기준으로는 PostToolUse·PostToolUseFailure·PostToolBatch·UserPromptSubmit·UserPromptExpansion·ConfigChange·PreCompact·TaskCreated·TaskCompleted 도 같은 방식으로 막을 수 있다.

저장소 어디서도 쓰지 않는 반환 필드: `updatedInput`, `updatedToolOutput`, `displayContent`, `initialUserMessage`, `watchPaths`, `sessionTitle`, `reloadSkills`, `retry`, `terminalSequence`.

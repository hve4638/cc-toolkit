# core/event

훅 이벤트를 애드온에 배달하는 호스트가 사는 곳. 애드온 자체는 `core/addon/<이름>/addon.mjs` 와 `core/skills/<이름>/addon.mjs` 에 살고, 어느 규칙을 켤지는 agentaddon 의 `event` 네임스페이스가 정한다.

```
~/.config/agentaddon/event                  전역 (가장 약함)
<조상 디렉터리>/.config/agentaddon/event    루트부터 아래로
<세션 루트>/.config/agentaddon/event        가장 가까움 (이김)
```

`lib/index.mjs` 와 `lib/index.d.mts` 는 생성물이다. 원본은 `core/_build/src/event/index.mts` 고 `_build` 에서 `pnpm build:event` 로 뽑는다.

lib 은 파일시스템도 프로세스도 건드리지 않는다 — 타입·api·`selectRules`·`dispatch`·`toHookOutput` 뿐이다. IO 는 lib 밖의 손으로 쓴 `.mjs` 가 한다. `collect.mjs` 가 이번 이벤트에 불릴 애드온을 찾아오고, 훅이 부르는 진입점은 `main.mjs` 다.

```
main.mjs <EventName>    stdin = 훅 payload JSON, stdout = 훅 규약 JSON
```

`hooks/hooks.json` 이 네 이벤트 전부에 매처 `*` 로 걸어둔다. `source` 나 `tool_name` 으로 좁히는 것은 애드온이 payload 를 보고 직접 한다. 종료 코드는 언제나 0 이고, 모르는 이벤트 이름·깨진 stdin·예외는 전부 `{}` 로 떨어진다.

## 애드온 하나

`core/addon/<이름>/addon.mjs` 또는 `core/skills/<이름>/addon.mjs` 에 놓는다. 폴더 이름은 동작과 무관하다 — 규칙 이름과 애드온을 잇는 것은 선언과 manifest 다.

```js
// @ts-check
/** @type {import('../../event/lib/index.mjs').AddonDecl} */
export default {
  rules: {
    'showcase-light': { events: ['SessionStart'] },
    'showcase-heavy': { events: ['SessionStart', 'PreToolUse'] },
  },
  priority: { PreToolUse: 'high' },
  handlers: {
    SessionStart(api, payload, rules) {
      if (rules['showcase-heavy'].trigger) api.injectContext('무거운 안내');
    },
    PreToolUse(api, payload, rules) { /* … */ },
  },
};
```

- `rules` 는 구독 선언이다: 규칙 이름 → 그 규칙이 트리거되는 이벤트 목록. 규칙 이름은 agentaddon `event` 파일의 항목 이름과 문자열로만 이어진다. 이름은 평평하게 짓는다 — `rule:banaction` 의 `종류:` 접두어는 초기 관례의 잔재다.
- 핸들러는 **이벤트당 하나**다. 이벤트 E 의 핸들러는 E 를 선언한 자기 규칙 중 하나라도 켜져 있거나 E 가 `alwaysEvents` 에 있을 때 불리고, E 를 선언한 규칙 전부를 셋째 인자로 받는다 — 꺼진 것은 `trigger: false` 로. 규칙별 분기는 핸들러가 이 객체를 보고 한다.
- 규칙 상태에는 그 항목의 인자도 실린다: `showcase-heavy@mode=strict` → `rules['showcase-heavy']` 는 `{ mode: 'strict', trigger: true }`. `trigger` 는 호스트가 채우는 예약 키라 인자로 같은 이름을 적어도 조용히 무시된다.
- `priority` 는 이벤트별 실행 밴드다. 생략·모르는 값은 medium.
- 핸들러는 아무것도 반환하지 않는다. 훅이 낼 것은 전부 api 호출로 적는다. 첫 줄의 `// @ts-check` 와 `@type` 주석이 있어야 타입 오류가 에디터에 뜬다.

### alwaysEvents — 규칙 게이트 빼기

`alwaysEvents` 에 적은 이벤트는 자기 규칙이 다 꺼져 있어도 핸들러가 불린다 — 규칙은 순수 플래그가 되고, 기본 동작은 핸들러 코드가 정한다 (설정 없이 항상 돌면서 규칙으로 수위만 바꾸는 훅용).

```js
rules: { 'useterminal-proactive': { events: ['SessionStart'] } },
alwaysEvents: ['SessionStart'],
```

목록에 없는 이벤트는 규칙 게이트 그대로다. 형식 검증 (배열·이벤트 이름·핸들러 존재) 은 build-manifest 가 개발 시점에 한다 — 런타임은 틀린 값을 없음으로 취급해 무증상이다.

### 규칙 없는 상시 애드온

`rules` 를 아예 생략 (또는 빈 객체) 하면 상시 애드온이다 — `handlers` 가 잡는 이벤트에 설정과 무관하게 항상 발화하고, 핸들러의 셋째 인자는 빈 객체다. 이름이 없으니 agentaddon 으로 끌 수 없고 `!*` 도 닿지 않으며, available-rules.txt 에도 실리지 않는다. 켜고 끄는 개념 자체가 없는 배관성 훅 (예: writing-context-hint) 용이고, 켜고 끌 플래그가 필요한 기능이면 규칙 (+ 필요 시 alwaysEvents) 을 쓴다.

manifest 항목은 규칙 대신 이벤트 목록으로 실리는데, 이벤트 출처가 핸들러 키뿐이라 오타 난 키는 영영 발화하지 않는 무증상 실패가 된다 — 생성기가 키를 검사해 개발 시점에 죽인다.

## manifest

`manifest.json` 은 생성물이다 — 규칙 이름 → 애드온 경로·이벤트 목록의 표. 항목의 `events` 는 설정과 무관하게 통과하는 이벤트 목록으로, 상시 애드온 (핸들러 키 유래) 과 alwaysEvents 가 같은 자리에 실린다. `collect.mjs` 는 이 표와 켜진 규칙만 보고 이번 이벤트에 불릴 애드온을 고르므로, 존재하는 애드온을 전부 import 하지 않는다.

addon.mjs 를 만들거나 `rules` 선언을 바꿨으면 재생성해 같이 커밋한다 — 선언을 데이터에서 조립하는 애드온 (instruction 의 조각 frontmatter) 은 그 데이터를 바꿔도 해당된다 (사용자용 규칙 이름 목록 `skills/available-addon-rule/available-rules.txt` 도 같은 실행이 함께 갱신한다):

```bash
node core/event/build-manifest.mjs
```

낡은 manifest 는 `event-manifest.test.mjs` 가 실스캔과 diff 해서 잡는다. 배포된 플러그인은 버전별 캐시 디렉터리에 얼어 있어 필드에서 낡을 일이 없다.

manifest 는 길잡이일 뿐 판정의 기준이 아니다 — trigger 판정은 import 한 선언의 `rules` 로 다시 한다. 어긋나면 그 애드온은 조용히 빠진다.

## api 의 층

무엇에 영향을 주는지로 묶는다. 이벤트가 달라도 축은 그대로다.

| 층 | 뜻 | 가진 이벤트 |
|---|---|---|
| 평평 | 정보만 준다 — `notify`·`injectContext` | 넷 다 |
| `permission` | 권한 판정 | PreToolUse |
| `tool` | 도구 호출을 건드린다 | PreToolUse(인자)·PostToolUse(결과) |
| `turn` | 턴 자체를 건드린다 | 넷 다 |
| `session` | 세션 설정을 건드린다 | SessionStart |

`turn` 은 이벤트마다 멤버가 다르다. SessionStart·PreToolUse 는 `halt` 만, PostToolUse 는 `feedback`+`halt`, Stop 은 `keepGoing`+`halt`.

## 합침 규칙

여러 애드온이 같은 이벤트에서 불리면 priority 밴드 순 (high → medium → low) 으로 돈다. 같은 밴드 안의 순서는 정의하지 않는다. 결과는 네 방식으로 합쳐진다.

| 방식 | 해당 | 규칙 |
|---|---|---|
| 이어붙임 | `injectContext`·`notify`·`session.watchPaths` | 부른 순서대로 전부 남는다 |
| 플래그 | `session.reloadSkills` | 하나라도 부르면 켜진다 |
| 등급 슬롯 | `permission.*`, `turn.*` | 제한적인 쪽이 이긴다 |
| 선착 슬롯 | `tool.*`, `injectUserMessage`, `session.setTitle` | 먼저 부른 쪽이 이긴다 |

등급 슬롯의 순서는 이렇다. 부른 순서와 무관하다.

```
permission   deny > ask > allow
turn         halt > block(feedback·keepGoing)
```

같은 등급끼리는 사유를 모은다. 진 등급의 사유는 버린다 — `ask` 를 원한 애드온의 사유는 `deny` 앞에서 의미가 없다. 사유가 하나면 그대로 나가고, 둘 이상이면 번호를 붙여 감싼다.

```
<reason_1>생성물이다</reason_1>
<reason_2>감사 로그가 꺼져 있다</reason_2>
```

슬롯이 서로 다르면 같이 나간다. `permission.deny()` 와 `tool.rewrite()` 도, `permission.deny()` 와 `turn.halt()` 도 둘 다 실린다. 권한은 `hookSpecificOutput` 안이고 `halt` 는 최상위라 자리가 안 겹친다.

한 핸들러가 던지면 그 핸들러가 적은 것만 버리고 나머지는 계속 돈다. 애드온마다 새 Draft 를 주고 무사히 끝났을 때만 옮겨 적으므로, 도중에 터진 애드온이 슬롯을 선점해 뒤 애드온의 판정을 묻어버리는 일이 없다.

## 이벤트별 주의사항

### PreToolUse

`tool.rewrite()` 는 병합이 아니라 교체다. 넘긴 객체가 그 도구의 완전한 입력이어야 하고 도구 스키마로 검증된다 — 고칠 키만 넘기면 통째로 거부된다.

```js
api.tool.rewrite({ ...payload.tool_input, command: fixed });
```

거부되면 이 문구가 뜬다: `PreToolUse hook for <도구> returned updatedInput that failed schema validation`.

모델은 인자가 바뀐 걸 모른다. 알리려면 `injectContext()` 를 같이 부른다.

`updatedInput` 을 낸 것만으로 권한 프롬프트를 건너뛰는 경로가 있다 (`Hook satisfied user interaction for <도구> via updatedInput, bypassing permission prompt`). 발동 조건은 추적 안 했다.

### PostToolUse

도구가 이미 실행된 뒤다. `turn.feedback()` 은 되돌리는 게 아니라 뒷수습을 시키는 것이다. reason 은 `hook feedback:` 을 달고 모델에게 전달되고, 모델은 "막히면 다른 방법을 찾으라" 고 안내받는다. 무엇이 잘못됐는지와 함께 어떻게 하면 되는지를 적는다.

### Stop

`payload.stop_hook_active` 가 true 면 lib 이 `turn.keepGoing()` 을 무시한다. 이미 훅이 막아서 이어진 턴이라 또 막으면 무한 루프가 된다. 핸들러가 직접 확인할 필요는 없다.

Stop 에서는 `injectContext()` 도 턴을 잇는다. 스키마 설명이 이렇게 못 박는다.

> Hook-specific output for the Stop event. additionalContext is non-error feedback delivered to the model; the conversation continues so the model can act on it.

`turn.keepGoing()` 과 결과가 같고, error 로 취급되지 않는다는 것만 다르다.

### SessionStart

`session.watchPaths()` 로 등록한 파일이 바뀌면 FileChanged 이벤트가 뜬다. FileChanged 를 잡는 api 는 아직 없어서 등록만 되고 받을 데가 없다.

`session.reloadSkills()` 는 훅이 스킬을 설치했을 때 쓴다. 스캔이 이미 끝난 뒤라 다시 훑지 않으면 그 스킬은 다음 세션부터 보인다.

## raw 대응표

api 가 내는 필드와 스키마 설명 원문. 이벤트 31종 전체 규약은 `core/docs/claude-code-hook-events.md`.

| api | raw | 스키마 설명 |
|---|---|---|
| `notify` | 최상위 `systemMessage` | Warning message shown to the user |
| `injectContext` | `hookSpecificOutput.additionalContext` | |
| `injectUserMessage` | `hookSpecificOutput.initialUserMessage` | |
| `session.setTitle` | `hookSpecificOutput.sessionTitle` | Set the session title |
| `session.watchPaths` | `hookSpecificOutput.watchPaths` | Absolute paths to watch for FileChanged hooks |
| `session.reloadSkills` | `hookSpecificOutput.reloadSkills` | Re-scan skill and command directories after SessionStart hooks complete, so skills installed by the hook are available in the same session |
| `permission.deny/ask` | `hookSpecificOutput.permissionDecision` + `permissionDecisionReason` | |
| `tool.rewrite` | `hookSpecificOutput.updatedInput` | Modified tool input to use |
| `tool.rewriteOutput` | `hookSpecificOutput.updatedToolOutput` | Replaces the tool output before it is sent to the model |
| `turn.feedback` / `turn.keepGoing` | 최상위 `decision: "block"` + `reason` | Explanation for the decision |
| `turn.halt` | 최상위 `continue: false` + `stopReason` | Message shown when continue is false |

## 열지 않은 필드

규약에는 있지만 api 로 내보내지 않은 것.

| 필드 | 이벤트 | 이유 |
|---|---|---|
| `permissionDecision: "allow"` | PreToolUse | 사용자 권한 설정을 무력화하는 쪽이고 그 사실이 화면에 안 뜬다. 쓸 데가 생기면 연다 |
| `permissionDecision: "defer"` | PreToolUse | 대화형 세션에서 무시된다. print 모드 전용 |
| `updatedMCPToolOutput` | PostToolUse | MCP 도구 전용. 스키마 설명이 `updatedToolOutput` 을 권한다 |
| `suppressOutput` | 공통 | 이 lib 은 stdout 에 제어 JSON 만 뱉어 실효가 불분명하다 |
| `terminalSequence` | 공통 | 데스크톱 알림·창 제목·비프. 어느 OSC 가 먹는지가 터미널마다 달라 lib 이 고를 수 없다 |
| `decision: "approve"` / 최상위 `decision` | PreToolUse | PreToolUse 에서는 deprecated |

## 애드온은 import 될 때 선언만 한다

manifest 생성기는 addon.mjs 를 전부 import 해서 선언을 읽고, 호스트도 불릴 애드온을 import 한다. import 시점에 무거운 일을 하면 그 값을 선언 읽기와 관계없는 이벤트까지 치른다. 파일 읽기든 프로세스 띄우기든 핸들러 안으로 미룬다.

## manifest 가 캐시를 되살린 이유

규칙 이름과 애드온 위치가 무관해지면서, 표가 없으면 "어느 애드온이 이 규칙을 구독하나" 를 알기 위해 존재하는 addon.mjs 전부를 매 이벤트마다 import 해야 한다 — import 수가 켜진 개수가 아니라 존재하는 개수에 비례하게 된다. 예전에 캐시를 미뤘던 근거 (켜진 것만 import 하니 모듈당 0.3 ms 뿐) 가 정확히 그 지점에서 깨져서, 그 discovery 를 개발 시점의 생성기로 옮기고 런타임은 표만 읽는다.

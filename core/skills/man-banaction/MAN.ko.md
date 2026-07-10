# banaction

banaction 은 core 플러그인에 포함된 PreToolUse 훅이다. Claude Code 가 도구 호출 — Bash, Write, MCP 도구 등 전부 — 을 실행하기 직전에 `.banaction` 파일의 규칙과 대조해, 매칭되면 그 호출을 거부한다. `.banaction` 파일이 없으면 아무것도 하지 않는다.

## 위치

| 파일 | 범위 |
|---|---|
| `~/.banaction` | 글로벌 — 모든 프로젝트 |
| `<프로젝트 루트>/.banaction` | 해당 프로젝트 (프로젝트 루트 = `CLAUDE_PROJECT_DIR`) |

두 파일을 모두 읽어 합산 병합하며, 없는 파일은 건너뛴다. 해제 문법은 없다: 프로젝트 파일이 글로벌 규칙을 풀 수 없다.

## 규칙 형식

한 줄에 규칙 하나. 빈 줄과 `#` 로 시작하는 줄은 무시한다.

| 줄 | 의미 |
|---|---|
| `<regex>` | Bash 규칙 — command 가 매칭되면 Bash 를 거부 |
| `<도구 매처>: <regex>` | 도구 규칙 — 매칭되는 도구의 입력이 매칭되면 거부 |

- 정규식은 JavaScript 문법, 대소문자 구분, unanchored — `git push` 는 command 어디에 있어도 매칭된다. 정밀하게 잡으려면 `^`, `$`, `\b` 로 앵커한다.
- 도구 매처 자체도 정규식이며 도구 이름 전체에 매칭된다 (`^…$` anchored): `Edit` 는 `MultiEdit` 에 매칭되지 않고, `mcp__github__.*` 는 MCP 서버 하나를 통째로 금지한다.
- 콜론 뒤 공백이 필수라 `http://x` 같은 URL 패턴은 Bash 규칙으로 남는다. 규칙 텍스트 자체에 `: ` 가 들어가는 Bash 규칙은 `Bash: ` 접두사를 명시해야 하며, 안 그러면 콜론 앞부분이 도구 매처로 해석된다.
- 매칭 대상: Bash (무접두사 줄과 `Bash:` 규칙) 는 command 문자열만 — 사람용 description 은 검사하지 않는다. 그 외 도구는 도구 입력 안의 모든 문자열 값 (중첩 포함).
- 폴백: 정규식으로 컴파일되지 않는 패턴은 리터럴 substring 으로 사용하고, 컴파일되지 않는 도구 매처는 도구명 정확 일치로 폴백한다.

### 예시

```
# Bash — bare lines
git push
git reset --hard
rm -rf

# tool-scoped
Write: \.env$
WebFetch: internal\.corp
mcp__github__.*: .*
```

## 거부 메시지

첫 번째로 매칭된 규칙이 호출을 거부하고, 모델은 다음을 받는다:

```
Blocked by BAN Action rule '<rule text>'. The user has banned this action. Do not retry or work around it; ask the user if it is truly required.
```

규칙 원문을 포함하는 것은 모델이 표현만 바꿔 재시도하는 것을 막기 위해서이고, `.banaction` 파일의 이름·경로는 노출하지 않는다.

## 실패 동작

banaction 은 fail-open 이다: 읽을 수 없는 파일, 잘못된 줄, 훅 크래시, 훅 타임아웃 (3s) 은 모두 세션을 깨는 대신 도구 호출을 통과시킨다. 백트래킹이 심한 정규식은 매 호출마다 훅을 타임아웃으로 몰아 규칙 파일 전체를 조용히 무력화할 수 있다.

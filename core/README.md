# core

기본 번들 — 런타임 훅·MCP 서버·범용 에이전트 카탈로그·공통 슬래시 스킬을 한 플러그인으로 제공.

## 설치

```bash
/plugin marketplace add https://github.com/hve4638/hve-cc-marketplace
/plugin install core@hve

# 클로드 재실행 후
/core-setup

# 클로드 재실행
```

`/core-setup` 은 `@ast-grep/napi` 글로벌 설치 + Codex CLI 설치 + Codex MCP user 스코프 등록까지 한 번에 끝낸다.

---

## 슬래시 스킬

| 카테고리 | 슬래시 명령 | 용도 |
|---|---|---|
| 셋업 | `/core-setup` | ast-grep + Codex CLI 설치 + Codex MCP user 스코프 등록 |
| 커밋·PR | `/stage` | 의도 단위 스테이징 + 컨벤션 맞춤 커밋 메시지 추천. 커밋은 하지 않음 |
| | `/draft-pr` | 셀프 PR 본문 양식 작성 (WHY 중심). 실제 PR 은 하지 않음 |
| 리뷰·분석 | `/cross-review` | codex MCP + subagent 교차 리뷰 (기본 1-1, 동일 작업) |
| | `/reverse-engineer` | 프로젝트 분석 → `_report/<date>-project-analysis/` 에 8 산출물 (INDEX, overview, tech-stack, directory-structure, data-flow, core-implementation, constraints, insights) |
| 작업 위임 | `/handoff` | 위임할 작업을 HANDOFF 파일로 저장 — 작업 디렉토리 또는 프로젝트 루트, 기존 파일 있으면 덮어쓰기 확인 |
| | `/pickup` | 현재 디렉토리의 HANDOFF 파일 로드 후 삭제 |
| 외부 docs | `/docs-claude` | Claude Code llms.txt 링크 |
| | `/docs-skills` | Claude Code skills 작성·배포 docs 링크 |
| 스킬 설명서 | `/man` | 스킬의 `MAN.md` 를 읽고 설명·질의응답. 인자 없으면 문서화된 스킬 색인 |
| | `/mkman` | 스킬을 분석해 그 폴더에 `MAN.md` (사용자용 설명서) 생성 |
| 도메인 지식 | `/man-banaction` | banaction 가드 매뉴얼 — `.banaction` 규칙 형식·위치·거부 동작 안내 |
| 작업 모드 | `/r` | 읽기 우선 모드 — 명시적 작업 요청 전까지 정보 수집·보고만 수행 |
| 스펙 | `/interview` | 계획·결정·아이디어를 질문 하나씩 + 추천 답으로 집요하게 인터뷰. 종료는 사용자가 선언, 요약 파일은 opt-in |

## 자동 규약

`user-invokable: false` 로 설정돼 사용자 직접 호출은 차단되며, description 매칭으로 모델이 필요할 때 자동 로드한다.

| 규약 | 강제 사항 |
|---|---|
| `rule-python` | `uv` 패키지 매니저 강제 |
| `rule-nodejs` | `pnpm` + 지정 보일러플레이트 강제 |

---

## 런타임 기능

### 1. 범용 에이전트 카탈로그

11 개 plugin-independent 서브에이전트. 다른 플러그인·스킬에서 `Agent(subagent_type="<name>", ...)` 로 호출 가능.

| 카테고리 | 에이전트 |
|---|---|
| 탐색·분석 | code-analyzer |
| 구현 | executor |
| 검증 | verifier, critic, code-reviewer, security-reviewer, tdd-adversary |
| 기타 | docs-researcher |

### 2. 코드 인텔리전스 (LSP)

**메커니즘**: MCP 서버 `t` (`bridge/mcp-server.cjs`, `.mcp.json` 으로 등록)

언어 서버 기반 12 개 툴: `hover`, `goto_definition`, `find_references`, `document_symbols`, `workspace_symbols`, `diagnostics`, `diagnostics_directory`, `servers`, `prepare_rename`, `rename`, `code_actions`, `code_action_resolve`.

**의존**: 사용자 `PATH` 의 언어 서버 (`gopls`, `typescript-language-server`, `pyright` 등). 설치 안 된 언어는 해당 LSP 호출 시 에러 반환.

### 3. 구조 검색·치환 (AST Grep)

**메커니즘**: MCP 서버 `t` (#2 와 동일 서버 공유)

AST 패턴 기반 2 개 툴: `ast_grep_search`, `ast_grep_replace`. 정규식의 구문 인식 한계를 극복.

### 4. GPT 대화 (Codex)

**메커니즘**: MCP 서버 `t` (#2 와 동일 서버 공유), `codex exec` 래핑

이름 기반 GPT 대화 2 개 툴: `codex_agent` (생성), `codex_send` (이어가기). 이름 → codex 세션 UUID·모델 매핑을 `<프로젝트>/.agent-memory/codex/<세션ID>/<이름>.json` 에 저장하므로 `claude --resume` 후에도 대화가 이어진다. resume 시 저장된 모델을 매번 `-m` 으로 재지정한다 (codex 는 세션 모델을 유지하지 않고 config 기본값으로 폴백).

**의존**: 사용자 `PATH` 의 Codex CLI (`/core-setup` 으로 설치). 샌드박스 우회 플래그 내장 — 이미 격리된 환경에서의 사용을 전제.

### 5. 액션 차단 (.banaction)

**메커니즘**: 애드온 (`addon/banaction/`), aiaddon `event` 파일에 `rule:banaction` 을 적어야 돈다

`~/.banaction` 과 세션 루트의 각 조상 디렉터리의 `.banaction` (루트부터 세션 루트까지) 의 규칙을 병합해, 매칭되는 도구 호출을 실행 전에 deny 한다. 차단 시 규칙 원문이 사유로 모델에 전달되며, 규칙 파일의 이름·경로는 노출하지 않는다. 파일이 없으면 아무것도 하지 않는다.

```
# 주석
git push --force
Write: \.env$
mcp__github__.*: .*
```

| 줄 형식 | 의미 |
|---|---|
| `<정규식>` | Bash `command` 가 매칭되면 차단 |
| `<도구 매처>: <정규식>` | 도구명이 매처 (anchored 정규식) 에 맞고 `tool_input` 의 문자열 값 중 하나가 패턴에 매칭되면 차단. 콜론 뒤 공백 필수. 대상 도구가 Bash 면 `command` 만 검사 |
| `# ...` | 주석 |

잘못된 정규식은 폴백한다 — 패턴은 리터럴 substring 매칭, 도구 매처는 도구명 정확 일치. 백트래킹이 심한 정규식 규칙은 훅 타임아웃 (5s) 에 걸려 파일 전체가 조용히 무력화될 수 있다.

---

## 부록 — 개발자용

### 애드온 시스템 (`event/` + `addon/` + `skills/*/addon.mjs`)

훅 이벤트를 잡는 애드온의 호스트. 애드온은 `addon/<이름>/addon.mjs` 나 `skills/<이름>/addon.mjs` 에 두고, 구독할 규칙 이름과 트리거 이벤트를 스스로 선언한다 — 규칙 이름과 파일 위치는 무관하며, 연결은 생성물 `event/manifest.json` 이 담당한다 (`node core/event/build-manifest.mjs` 로 재생성). 선언 형식·합침 규칙은 `event/README.md`.

### corelib (`scripts/lib/corelib.mjs`)

훅 스크립트 공용 패턴의 뿌리 lib. cascade 경로 (`cascadePaths`), fail-open 읽기 (`readTextOr`/`readJsonOr`), 워크스페이스 가드 쓰기 (`writeFileAtomic`/`appendLine`/`ensureDir` 의 `guardDir` 옵션), 훅 stdin (`readStdin`/`readHookPayload`), `resolveProjectRoot`. node 내장만 의존하는 한 파일이라 타 플러그인은 파일째 복사해 쓴다 — 수정은 원본에서 하고, 사본은 diff 로 동기화한다. core 안의 lib (`agent-memory.mjs`, `aiaddon.mjs`)·스크립트·애드온·event 호스트는 전부 이 위에 선다.

### 러너 (`scripts/run.cjs`)

모든 훅의 실제 진입점 (`hooks.json` 이 호출).

- `process.execPath` 로 Node 직접 spawn — PATH / 셸 의존 제거
- `CLAUDE_PLUGIN_ROOT` 가 stale 이면 캐시 디렉터리 스캔 후 최신 버전 스크립트로 폴백
- `hooks.json` 의 `timeout` 파싱 후 자식 프로세스에 적용
- 모든 에러 경로 fail-open (exit 0)

### MCP 재빌드

`_build/src/` 에 MCP 서버 TypeScript 소스 포함. 툴 추가·제외 시 `_build/src/mcp/tool-registry.ts` 편집 후:

```bash
cd _build
pnpm install
node build-mcp-server.mjs
```

출력: `bridge/mcp-server.cjs`.

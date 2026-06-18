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
| | `/make-commit` | git 변경 → `type(scope): subject` 컨벤션 커밋. 일관성 우선, Co-authored-by 금지 |
| | `/draft-pr` | 셀프 PR 본문 양식 작성 (WHY 중심). 실제 PR 은 하지 않음 |
| 리뷰·분석 | `/cross-review` | codex MCP + subagent 교차 리뷰 (기본 1-1, 동일 작업) |
| | `/reverse-engineer` | 프로젝트 분석 → `_report/<date>-project-analysis/` 에 8 산출물 (INDEX, overview, tech-stack, directory-structure, data-flow, core-implementation, constraints, insights) |
| 세션 인계 | `/handoff` | 현재 세션을 task-unit 문서로 `.agent-memory/handoff/<timestamp>_<slug>/` 에 보관 |
| | `/pickup` | 이전 handoff 복원 후 `_archive/` 로 이동 |
| 외부 docs | `/docs-claude` | Claude Code llms.txt 링크 |
| | `/docs-skills` | Claude Code skills 작성·배포 docs 링크 |
| 도메인 지식 | `/knowledge-fsonl` | FSONL (Function-Styled Object Notation Lines) 포맷 스펙 |
| 작업 모드 | `/r` | 읽기 우선 모드 — 명시적 작업 요청 전까지 정보 수집·보고만 수행 |
| 스펙 | `/interview` | Socratic 질의응답으로 모호한 아이디어 → spec 파일. brownfield/greenfield 판정에 `explore` 에이전트 사용 |

## 자동 규약

`user-invokable: false` 로 설정돼 사용자 직접 호출은 차단되며, description 매칭으로 모델이 필요할 때 자동 로드한다.

| 규약 | 강제 사항 |
|---|---|
| `rule-python` | `uv` 패키지 매니저 강제 |
| `rule-nodejs` | `pnpm` + 지정 보일러플레이트 강제 |

---

## 런타임 기능

### 1. 범용 에이전트 카탈로그

19 개 plugin-independent 서브에이전트. 다른 플러그인·스킬에서 `Task(subagent_type="<name>", ...)` 로 호출 가능.

| 카테고리 | 에이전트 |
|---|---|
| 탐색·계획 | explore, analyst, planner, architect |
| 구현 | executor, code-simplifier, designer, writer |
| 검증 | verifier, critic, code-reviewer, security-reviewer, test-engineer |
| 디버깅·분석 | debugger, tracer, qa-tester, scientist |
| 기타 | document-specialist, git-master |

### 2. 툴 사용 규율 리마인더

**메커니즘**: PreToolUse 훅 (`scripts/pre-tool-enforcer.mjs`, matcher `*`, timeout 3s)

모든 툴 호출 직전 `<system-reminder>` 주입. dedup 없음 — 매 호출마다 주입.

| 툴 | 주입되는 규칙 |
|---|---|
| `Bash` | Prefer dedicated tools (Read, Grep, Glob, Edit) over shell equivalents. |
| `Read` | Read multiple files in parallel when possible. |
| `Grep` | Use Grep (ripgrep) — never shell grep/rg. |
| `Write` / `Edit` | Verify the change after writing. Prefer Edit over Write for existing files. |
| 그 외 | 주입 없음 (`suppressOutput`) |

### 3. 컨텍스트 가드

**메커니즘**: Stop 훅 (`scripts/context-guard-stop.mjs`, matcher `*`, timeout 5s)

세션 Stop 지점에서 트랜스크립트 파일 크기 측정.

- `CORE_CONTEXT_GUARD_BYTES` (기본 500000) 초과 → `additionalContext` 로 경고 주입
- 컴팩터·사용자 취소 stop → 간섭 없음
- 스크립트 내 `BLOCK_WHEN_OVER = true` 로 바꾸면 Stop 차단

### 4. 코드 인텔리전스 (LSP)

**메커니즘**: MCP 서버 `t` (`bridge/mcp-server.cjs`, `.mcp.json` 으로 등록)

언어 서버 기반 12 개 툴: `hover`, `goto_definition`, `find_references`, `document_symbols`, `workspace_symbols`, `diagnostics`, `diagnostics_directory`, `servers`, `prepare_rename`, `rename`, `code_actions`, `code_action_resolve`.

**의존**: 사용자 `PATH` 의 언어 서버 (`gopls`, `typescript-language-server`, `pyright` 등). 설치 안 된 언어는 해당 LSP 호출 시 에러 반환.

### 5. 구조 검색·치환 (AST Grep)

**메커니즘**: MCP 서버 `t` (#4 와 동일 서버 공유)

AST 패턴 기반 2 개 툴: `ast_grep_search`, `ast_grep_replace`. 정규식의 구문 인식 한계를 극복.

---

## 부록 — 개발자용

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

# cc-toolkit

Claude Code 용 개인 플러그인 마켓플레이스.

## 플러그인

| 이름 | 설명 |
|---|---|
| [`core`](./core) | 기본 번들 — 범용 에이전트 13 + 훅 (규칙 리마인더·컨텍스트 가드) + MCP 서버 (LSP·AST Grep·Codex) + 공통 슬래시 스킬 (commit/PR, review, handoff, docs, rules) |
| [`frame`](./frame) | 코드 작업 가드레일 — 프로젝트별 마커 (`.inlay`/`.ponytail`/`.showcase`) 로 켜고, dispatcher 하나가 훅 이벤트를 활성 가드레일에 라우팅 |
| [`expert`](./expert) | 고급·특수 툴 — Python REPL MCP. 향후 ralph 같은 무거운 워크플로 스킬 예정 |
| [`hud`](./hud) | statusline — cwd/git/ctx%/rate-limit/모델명 |
| [`oc-browser`](./oc-browser) | Docker 격리 headed Chromium — `oc-as <name> browser <action>`, host/vnc/headless 표시 모드, 프로젝트별 컨테이너 |
| [`research`](./research) | 리서치 워크플로 (journal, plan, report, commit) |
| [`aris`](./aris) | 학술 논문 자동화 (Autonomous Research In Sleep) |
| [`usefable`](./usefable) | Fable 티어 에이전트 — core 의 executor·리뷰/검수 계열을 fable- prefix 최상위 모델 변형으로 제공 |
| [`plugin-devtool`](./plugin-devtool) | 이 마켓플레이스 저작용 도구 — core:ticket 이 발행한 피드백 티켓 조회 (`get-ticket`). 일반 세션엔 불필요 |

## 설치

```bash
# 1. 마켓플레이스 추가
/plugin marketplace add https://github.com/hve4638/cc-toolkit

# 2. 원하는 플러그인 설치
/plugin install core@hve
/plugin install frame@hve
/plugin install expert@hve
/plugin install hud@hve
/plugin install oc-browser@hve
/plugin install research@hve
/plugin install aris@hve
/plugin install usefable@hve
/plugin install plugin-devtool@hve
```

## 설치 후 설정

| 플러그인 | 후속 명령 |
|---|---|
| core | `/core-setup` — `@ast-grep/napi@0.41.1` 글로벌 설치 + Codex CLI 설치 + Codex MCP 등록 (user 스코프) |
| hud | `/hud setup` — statusline wrapper + settings.json 등록 |
| oc-browser | `/oc-setup` — Docker 이미지 빌드 + `oc-as`/`oc-list`/`oc-rm`/`oc` PATH 배치 |

## 갱신

```bash
/plugin marketplace update hve
```

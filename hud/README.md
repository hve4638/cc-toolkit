# hud

Claude Code statusline — 세션 하단에 현재 디렉토리·브랜치·rate limit·context %·모델명을
표시한다. 모든 값은 Claude Code 가 보내주는 stdin 과 git 에서 읽으며, 워크스페이스에
파일을 쓰지 않는다.

## 설치

```bash
/plugin marketplace add https://github.com/hve4638/hve-cc-marketplace
/plugin install hud@hve
/hve:hud setup
```

마지막 단계가 wrapper 를 `~/.claude/hud/hud.mjs` 에 배치하고 `~/.claude/settings.json` 의
`statusLine` 을 등록한다. Claude Code 를 재시작하면 statusline 에 표시된다.

## 출력 예시

```
📁 cc-plugin | 🌿 main | ⏳ 5h:10%(4d12h) wk:40%(2d12h) | 📦 context:24% | 💻 Opus 4.7 (1M context)
```

표시 요소:

| 요소 | 내용 |
|---|---|
| `📁 {cwd}` | 현재 디렉토리 basename (`$HOME` 은 `~` 로 치환). 실행 베이스 cwd 가 사라졌으면 (워크트리 삭제 등) `📁 missing` 으로 표시하고 브랜치는 생략 |
| `🌿 {branch}` | Git 브랜치. detached HEAD 면 커밋 해시 7자 |
| `⏳ 5h:… wk:…` | 5시간 / 7일 rate limit 사용률과 남은 시간 |
| `📦 context:{pct}%` | context window 사용률 |
| `💻 {model}` | Claude Code 가 보내주는 모델 display_name |

## 제거

```bash
/hve:hud uninstall     # wrapper + statusLine + hveHud 설정 모두 삭제
/plugin uninstall hud@hve
```

## 설정

`~/.claude/settings.json` 의 `hveHud` 키 아래:

```json
{
  "hveHud": {
    "elements": {
      "cwd": true, "gitBranch": true, "rateLimits": true,
      "contextBar": true, "model": true
    },
    "thresholds": { "contextWarning": 70, "contextCritical": 85 }
  }
}
```

필요 없는 요소는 `false` 로 숨긴다.

## 개발

```bash
cd hud/
pnpm install
pnpm run build        # src/ → dist/ (tsc)
pnpm run dev          # watch 모드
```

로컬 테스트: 프로젝트의 `.claude/settings.local.json` 에서 `statusLine.command` 를
직접 `dist/hud/index.js` 로 지정하면 wrapper 우회 가능.

## 구조

```
src/hud/         엔진 본체 (entry: index.ts)
src/hud/elements/  디스플레이 요소 (cwd, git, model, limits, context)
src/lib/         파일 I/O (atomic-write, file-lock, worktree-paths)
src/utils/       공통 유틸 (string-width, config-dir, ssrf-guard)
src/platform/    OS 감지 (isWSL, isProcessAlive)
scripts/install.mjs    설치 스크립트 (skill이 호출)
scripts/uninstall.mjs  제거 스크립트
scripts/lib/           wrapper 템플릿 + 의존성
```

## 기반

[oh-my-claudecode](https://github.com/hve4638/oh-my-claudecode) 의 HUD 엔진을 추출,
OMC 의존성을 제거해 독립 플러그인화했다.

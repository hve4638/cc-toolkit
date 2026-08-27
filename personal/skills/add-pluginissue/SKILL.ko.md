---
name: add-pluginissue
description: "현재 세션에서 드러난 플러그인(skill/hook) 문제를 분석해 봉인된 플러그인 이슈로 보관한다"
disable-model-invocation: true
argument-hint: "[무엇이 잘못됐나 — 문제 설명]"
---

<add_pluginissue_instruction>
# add-pluginissue

현재 세션에서 드러난 플러그인 문제를 분석해 봉인된 플러그인 이슈로 보관한다. 아카이브는 자신의 sha256으로 키를 잡으므로, 한 번 봉인하면 불변이다.

## 워크플로우

### 1. chatrec로 실패 구간 특정

`chatrec` 스킬로 문제가 드러난 턴을 찾아 그 구간만 추출한다. 그 clip이 2단계의 `session.jsonl`이 되고, 턴 범위는 `chatrec_range`에 들어간다.

### 2. 스테이징 디렉토리 빌드

`.agent-memory/pluginissue/<timestamp>_<slug>/`를 만든다(프로젝트 로컬, gitignored; timestamp는 `date +"%Y-%m-%dT%H%M"`, slug은 kebab-case). 그 안에:

- `report.md` (필수) — 아래 frontmatter + 산문.
- `session.jsonl` (필수) — 1단계의 `chatrec clip` 결과.
- `attachments/` (선택) — 로그, 재현 파일, 스크린샷.

### 3. 봉인

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/add-pluginissue/scripts/add-pluginissue.mjs" <스테이징-디렉토리>
```

tar.gz를 만들고, sha256을 계산하고, `~/.agent-memory/global/pluginissue/<sha256>.tar.gz`로 옮기고, `~/.agent-memory/global/pluginissue/index.jsonl`에 메타 한 줄을 append하고, 최종 경로와 해시를 출력한다. 그 출력을 사용자에게 보고한다.

## report.md frontmatter (고정 필드)

```yaml
id:               # 예: pi-2026-06-30-001 (날짜 기반, 직접 부여)
created_at:       # ISO8601 UTC, 작성 후 불변
taxonomy_version: "1.0"
plugin:           # 문제 발생 플러그인 (모르면 best-guess + confidence 낮춤)
skill_or_hook:    # skill/hook 이름 (모르면 빈 값 또는 추측)
plugin_version:   # 해당 플러그인 .claude-plugin/plugin.json의 version
failure_type:     # TECHNICAL_BUG | SPEC_MISMATCH | ENV_ISSUE
severity:         # critical | high | medium | low
confidence:       # CONFIRMED | SUSPECTED | SPECULATIVE
summary:          # 한 줄 제목 (기능 + 행위 + 결과)
expected:         # 기대 동작
actual:           # 실제 동작
chatrec_range:      # "T<from>..T<to>"
```

`content_hash` 필드는 두지 않는다. 무결성은 아카이브 sha256(파일명)과 `index.jsonl`로 일원화한다.

## report.md 산문

어느 기능에서 났는지, 언제·무엇이·왜를 적는다. 그다음 `failure_type`별로:

- `TECHNICAL_BUG` — 구현 결함. 재현 조건을 번호 목록으로.
- `SPEC_MISMATCH` — skill 설명과 실제 동작이 어긋남. 사용자 의도와 어떻게 빗나갔는지.
- `ENV_ISSUE` — 의존성·버전·실행 조건. 그 조건을 명시.

끝에 `corrective_hint`: 다음 버전에서 어떻게 고칠지 한 줄. 불확실한 필드는 추측임을 밝히고 `confidence`를 낮춘다.
</add_pluginissue_instruction>

$ARGUMENTS

---
name: get-pluginissue
description: "add-pluginissue 가 발행한 글로벌 플러그인 이슈를 조회·열람 (list/show)"
disable-model-invocation: true
argument-hint: "[list | show <issue> | filters]"
---

<get_pluginissue_instruction>
# get-pluginissue

`add-pluginissue` 가 발행한 글로벌 플러그인 이슈 저장소를 조회한다. 이슈는 `~/.agent-memory/global/pluginissue/` 아래에 있다: 이슈당 `<sha256>.tar.gz` 하나와, 각 이슈를 설명하는 `index.jsonl` 한 줄.

## 호출

PATH 런처는 없다. 스크립트를 직접 부른다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/get-pluginissue/scripts/get-pluginissue.mjs" <command> …
```

## 명령

### `list [filters]`

`index.jsonl` 을 읽어 정렬된 표를 출력한다: short-sha, 날짜, `plugin/skill_or_hook`, failure_type, severity, confidence, summary. 저장소가 비면 `no issues found` 를 출력한다.

필터는 AND 로 결합된다:

- `--plugin <name>`
- `--skill <name>`
- `--type <TECHNICAL_BUG|SPEC_MISMATCH|ENV_ISSUE>`
- `--severity <critical|high|medium|low>`
- `--confidence <CONFIRMED|SUSPECTED|SPECULATIVE>`
- `--match <text>` — summary 부분문자열(대소문자 무시)
- `--since <ISO date>` — `created_at >=` 값인 것만 남김

### `show <selector> [--out <dir>]`

`<selector>` 는 sha256 접두사 또는 이슈 `id`. 스크립트가 인덱스에서 그것을 해석하고, 아카이브의 sha256 을 재계산해 파일명과 대조한 뒤, tar.gz 를 풀고 `report.md` 를 출력한다. `session.jsonl` 과 `attachments/` 는 경로만 안내하고 내용은 덤프하지 않는다. 추출 위치는 `--out <dir>` 가 있으면 `<out>/<sha-prefix>/`, 없으면 `~/.agent-memory/global/pluginissue/.unpacked/<sha-prefix>/`. 비우는 건 그 `<sha-prefix>` leaf 뿐이고 `--out` 디렉토리 자체는 건드리지 않는다.

## 판단

이슈를 읽고 해당 플러그인에서 무엇을 고칠지 가늠하는 건 재량에 맡긴다.
</get_pluginissue_instruction>

$ARGUMENTS

---
name: skilltrace
description: "Scan local Claude Code transcripts (~/.claude/projects) and report usage statistics (skills, subagents, MCP tools, models/tokens, session paths) with date filters and period buckets."
argument-hint: "[period and/or question — e.g. 'last month, weekly' or 'which core skills are unused?']"
disable-model-invocation: true
---

<skilltrace_instruction>
# skilltrace

로컬 Claude Code 히스토리에 대한 사용량 질문을 `skilltrace` CLI 로 답한다. `~/.claude/projects` 아래 모든 transcript 를 스캔한다 (서브에이전트 transcript 는 부모 세션에 합산, 토큰 사용량은 API 호출 단위로 중복 제거).

## 호출

`skilltrace` 는 PATH 에 있다 (core 가 `bin/` 을 노출). 없으면 다음으로 대체:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/skilltrace/scripts/skilltrace.mjs" <command> …
```

## 명령

```
skilltrace scan   [--root DIR] [--since D] [--until D] [--out FILE]
skilltrace report [FILE|-] [--since D] [--until D] [--by day|week|month]
                  [--path SUBSTR] [--top N] [--format md|json] [--out FILE]
```

- `scan` 은 세션당 JSON 한 줄을 낸다 — 중간 산출물.
- `report` 는 scan 라인들을 집계한다. FILE 을 주면 그것을 읽고, 입력이 없으면 새로 스캔한다. `--format json` 은 md 와 동일한 리포트 (같은 섹션·행·`--top` 절삭) 의 기계용 직렬화다.
- 날짜: ISO (`2026-06-01`) 또는 상대 (`7d`, `4w`, `1m`, `1y`). 모든 날짜 필터와 `--by` 버킷은 각 세션의 **마지막** 활동 timestamp 기준.

## 워크플로

1. 스캔은 scratchpad/tmp 에 한 번만: `skilltrace scan --since 1m --out /tmp/…/scan.jsonl`.
2. 질문이 요구하는 만큼 그 산출물을 여러 번 슬라이스한다 (`report FILE --since … --by week`, 특정 repo 세션만 보려면 `--path <substr>`) — 스캔 한 번이 모든 슬라이스를 감당하고, jsonl 은 report 출력을 통해서만 컨텍스트에 들어온다.
3. report 출력으로 답한다. 사용자가 파일을 원하면 `--out` 을 쓴다.

## 숫자 읽는 법

- "Skills & commands" 표는 이름별로 두 호출 채널을 병합한다: `user` (사용자가 직접 친 슬래시 커맨드) 와 `model` (에이전트의 `Skill` 도구 호출), `total` = 둘의 합. 빌트인 커맨드 (`/compact` 등) 는 스킬과 구분 없이 user-only 행으로 나타난다 — 표는 발생을 기록할 뿐 분류하지 않는다.
- *미사용* 항목을 찾을 때는 지금 정의된 것 — 대상 repo 의 `skills/`·`agents/` 폴더와 설정된 MCP 서버 — 에서 출발해 각 정의를 리포트에서 찾아본다. 미매칭 행 중 `plugin:` 네임스페이스가 있는 것은 빌트인이 아니라 제거·개명된 스킬일 가능성이 높다.
- "Path tree" 는 분기 디렉터리마다 그 아래(포함) 세션 수를 세고, "(N exact)" 는 cwd 가 정확히 그 노드였던 세션 수다.
</skilltrace_instruction>

Task: $ARGUMENTS

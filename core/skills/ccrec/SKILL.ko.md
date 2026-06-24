---
name: ccrec
description: "현재 Claude Code 세션 transcript를 턴 단위로 조회·추출 (count/search/clip/filter)"
disable-model-invocation: true
argument-hint: "[추출·검색 대상 — 작업 설명이나 세션에 대한 질문]"
---

<ccrec_instruction>
# ccrec

현재 세션 transcript(디스크의 `.jsonl` 로그)를 `ccrec` CLI로 조회한다. 구간을 찾고, 그 구간만 추출한다 — transcript 전체를 컨텍스트에 올리지 않는다.

컨텍스트 기억이 아니라 ccrec 출력에서 작업한다. 긴 세션은 요약됐을 수 있어 기억은 손실되지만, transcript 파일은 전체 기록이다.

## 호출

`ccrec`는 PATH에 있다(core가 `bin/`을 노출). 못 찾으면 다음으로 대체:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ccrec/scripts/ccrec.mjs" <command> …
```

`$CLAUDE_CODE_SESSION_ID`로 이 세션을 찾는다(cwd 무관 → 워크트리에서도 동작). 첫 호출에서 자동 캐시된 슬림본을 만들고, 이후 호출은 재사용한다(transcript가 자랐을 때만 재빌드).

## 레코드 (평탄 jsonl, role 4종)

```
{"t":N,"role":"user","text":…}
{"t":N,"role":"assistant","text":…}
{"t":N,"role":"tool_call","name":…,"tool_use_id":…,"input":{…}}
{"t":N,"role":"tool_result","name":…,"tool_use_id":…,"result":…,"is_error":…}
```

`t` = 턴 번호(user 발화 순번). 내용은 절단 없이 전부 보존. thinking·attachment·주입된 컨텍스트는 버림.

## 명령

| 명령 | 출력 |
|---|---|
| `ccrec count` | 총 턴 수 + role 분포 |
| `ccrec search [pat] [filters]` | 매칭 턴 → `T<t>  <role>  <스니펫>` |
| `ccrec clip <from> [to]` | 그 턴 구간의 레코드 (jsonl) |
| `ccrec filter [filters]` | 거른 레코드 (jsonl) |

필터(search·filter): `--role user,assistant,tool_call,tool_result` · `--tool Bash,Read` · `--match "문구"` · `--from N --to M` · `--invert`.

`clip`/`filter`는 jsonl→jsonl이라 파이프로 잇는다: `ccrec clip 4 8 | ccrec filter --tool Bash`. `--out <파일>`을 붙이면 stdout 대신 파일로 쓴다.

## 워크플로우

1. `ccrec count` — 규모 파악.
2. 요청을 턴에 대응: `ccrec search "X"`(또는 `--tool` / `--role`) → 매칭 `T<t>`.
3. 그 구간만 추출: `ccrec clip <from> <to>`, 필요하면 `filter`/파이프로 좁힘.
4. 산출물 생성:
   - "X를 추출해" → 그 구간의 정제된 레코드.
   - "X에서 뭐가 문제였지" → 그 구간을 분석해 답한다.
5. 결과를 파일로 쓰고 경로를 보고한다(사용자는 채팅 출력만이 아니라 파일을 원한다).

출력은 작게 유지한다 — 검색 스니펫과 좁은 clip, transcript 전체는 안 된다. 현재 turn(이 호출)은 아직 flush되지 않았을 수 있으니, 이미 일어난 작업을 대상으로 한다.
</ccrec_instruction>

$ARGUMENTS

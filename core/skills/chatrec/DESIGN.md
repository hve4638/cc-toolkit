# chatrec — 설계

현재 Claude Code 세션의 transcript(`.jsonl`)를 정제·조회·추출하는 도구. 결정론적 CLI(`chatrec`)가 엔진이고, 사람이 직접 또는 에이전트가 자연어로 호출한다.

## 가드레일

실행 모델은 transcript를 — 원본이든 정제본이든 — 통째로 컨텍스트에 로드하지 않는다. 서브커맨드의 작은 출력만 소비한다.

## 배치

- 진입점명 `chatrec`.
- `core/bin/chatrec` — 1급 CLI. core가 `<루트>/bin`을 PATH에 자동 노출하므로 어디서나 `chatrec …`.
- skill 폴더(`core/skills/chatrec/`)에 엔진(`scripts/chatrec.mjs`)을 두고, bin은 그것을 부르는 얇은 런처. `node` 외 추가 의존성 0.

## 데이터 모델 — 평탄 jsonl (role 4종)

```jsonl
{"t":1,"role":"user","text":…}
{"t":1,"role":"assistant","text":…}
{"t":1,"role":"tool_call","name":…,"tool_use_id":…,"input":{…}}
{"t":1,"role":"tool_result","name":…,"tool_use_id":…,"result":…,"is_error":…}
```

- `t` = 턴 번호(user 발화 순번, 1-based). 라인 순 = 시간 순.
- `tool_call`/`tool_result`는 호출 하나당 독립 레코드. `tool_use_id`로 짝짓기(호출 단위 고유).
- 전체 보존(절단 없음). thinking·attachment·isMeta·system 메타·file-history-snapshot·`caller`는 버림.
- `name`은 build가 `tool_use_id`↔호출을 한 번 풀어 `tool_result`에도 박아둠(역추적 불필요).

## 캐시 — 자동·불변

- 정제본을 `~/.cache/chatrec/<session>.slim.jsonl`에 자동 관리(`XDG_CACHE_HOME` 존중).
- 호출 시 원본과 mtime 비교 → stale이면 자동 재빌드, 아니면 재사용.
- 불변 — search/clip/filter는 읽기만. 버전 스택·rewind·undo 없음.
- `t` 인라인이라 별도 인덱스 사이드카 불필요(캐시는 파일 하나).

## 서브커맨드

```
chatrec [--session <id> | --source <jsonl>] <command> [args]
```

| 명령 | 종류 | 입력 | 출력 |
|---|---|---|---|
| `build` | — | 원본(자동/`--source`) | 캐시 갱신 + 선택 `--out` |
| `count` | 조회 | 캐시 | 총 턴 수 + role 분포 |
| `search [pat]` | 조회 | 캐시/stdin | 매칭 `T<t> <role> <스니펫>` |
| `clip <from> [to]` | 변환 | 캐시/stdin | 구간 jsonl (stdout/`--out`) |
| `filter` | 변환 | 캐시/stdin | 거른 jsonl (stdout/`--out`) |

공통 필터 축(search·filter):

- `--role user,assistant,tool_call,tool_result`
- `--tool Bash,Read` (도구명; tool_call·tool_result의 `name`)
- `--match "문구"` (role별 본문: text / input / result, 대소문자 무시)
- `--from N --to M` (턴 범위)
- `--invert` (전체 매칭 반전)

`build` 대상 미지정 = 현재 세션. `clip` 대상 필수(`to` 생략 = 단일 턴).

## 파이프 (확장)

- 변환기(`clip`/`filter`): `jsonl→jsonl`. stdin이 파이프로 오면 그걸, 아니면 캐시를 입력.
  - `chatrec clip 4 8 | chatrec filter --tool Bash`
- 조회(`search`/`count`): 사람이 읽는 요약. 체인 끝/단독.
- 새 변환 도구는 `jsonl→jsonl` 하나만 만들면 파이프로 합류.

## 세션 탐색

`$CLAUDE_CODE_SESSION_ID` 자동(cwd 무관, 파일명 검색 → 워크트리 OK). `--session`/`--source` 우회.

## 역할 분담

- chatrec(결정론): 파싱·슬림화·캐시·count·search·clip·filter.
- skill/에이전트(자연어층): "X 작업부터 확인해" → 커맨드 조합(search→clip/filter) 번역 + 결과 가공.

전형 흐름: `search "X"` → 턴 확인 → `clip 4 8`(또는 `| filter …`) → 작업.

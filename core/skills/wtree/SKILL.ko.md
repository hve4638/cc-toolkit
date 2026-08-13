---
name: wtree
description: "repo 에 정책 기반 워크트리 관리를 셋업한다: 단계 스크립트의 안내를 따라 스탠드얼론 wtree CLI 의 정책 rules·settings·post-create 훅·워크트리 CLAUDE.md 를 구성"
disable-model-invocation: true
---

<wtree_instruction>
# wtree — 이 repo 에 wtree 정책 셋업

`/wtree` 는 cwd 가 속한 repo 를 대상으로 하는 스탠드얼론 `wtree` CLI 의 1회 셋업이다. CLI 가 스스로 정할 수 없는 것을 구성한다: 정책 rules, 머신 settings, post-create 훅, 워크트리 폴더의 CLAUDE.md.

셋업은 단계 스크립트가 안내한다. 아래로 시작해 각 출력을 따른다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/step1.mjs"
```

출력은 태그 블록으로 온다:

- `<status>` — 모든 출력의 첫 줄: `Required Answer` (키를 채워 재실행) | `Success` (그 스텝의 동작 완료) | `Blocked` (환경이 셋업을 막음) | `Error` (잘못된 입력이나 경로)
- `<info>` — 상태·수행 결과·지시; 그대로 따른다
- `<require>` — answer 에 아직 채워야 할 키와 값 힌트
- `<question>` — 사용자에게 그대로 물을 사항 — AskUserQuestion 도구로 묻는다
- `<alert>` — 사용자에게 전달할 경고
- `<error>` — 무엇이 잘못됐는지; 아무것도 바뀌지 않았다
- `<next>` — 다음에 실행할 명령
- `<output cmd="...">` — 그 명령의 실행 출력 원문

스크립트나 `wtree` 명령이 실패하면 사유를 출력한다 — 그대로 사용자에게 전달하고 중단한다.
</wtree_instruction>

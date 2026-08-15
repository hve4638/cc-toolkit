---
name: wtree
description: "repo 에 정책 기반 워크트리 관리를 셋업한다: TUI pane(또는 폴백 단계 스크립트)으로 스탠드얼론 wtree CLI 의 정책 rules·settings·post-create 훅·워크트리 CLAUDE.md 를 구성"
disable-model-invocation: true
---

<wtree_instruction>
# wtree — 이 repo 에 wtree 정책 셋업

`/wtree` 는 cwd 가 속한 repo 를 대상으로 하는 스탠드얼론 `wtree` CLI 의 1회 셋업이다. CLI 가 스스로 정할 수 없는 것을 구성한다: 정책 rules, 머신 settings, post-create 훅, 워크트리 폴더의 CLAUDE.md.

경로는 둘이다. tmux 안(`$TMUX` 있음)에서는 TUI pane 을 쓴다. tmux 밖이면 임의로 폴백하지 말 것: tmux 안에서 다시 실행하기를 권하고, 대안으로 단계 스크립트 경로가 있다고 알리되, 사용자가 명시적으로 요청할 때만 그 경로를 탄다. 사용자와 한국어로 대화 중이면 어느 스크립트든 `--ko` 를 붙인다.

## TUI 경로 (tmux 안 기본)

사용자가 showcase pane 에서 직접 답한다; 결정적 작업은 거기서 일어나고, 산문 작업은 handoff 파일로 돌아온다.

1. repo 디렉터리에서 pane 을 연다:

```bash
showcase exec node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/tui.mjs"
```

2. 사용자에게 pane 의 프롬프트를 끝내라고 알리고 턴을 끝내고 기다린다. pane 을 폴링하거나 조작하지 않는다 — 사용자의 것이다.
3. 사용자가 끝났다고 하면 handoff 파일을 읽고 따른다 — 태그는 아래와 같다:

```bash
cat "$(git rev-parse --path-format=absolute --git-common-dir)/wtree-setup-handoff.md"
```

handoff 는 검토 작업을 넘기고, 이어 apply pane 명령을 준다 — 같은 열기-대기-읽기 루프를 한 번 더 돈다. handoff 파일이 없거나 pane 이 뜨자마자 닫혔으면 아래 단계 경로를 실행해 상태를 본다.

## 단계 경로 (폴백)

단계 스크립트가 전체를 안내한다. 아래로 시작해 각 출력을 따른다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/step1.mjs"
```

## 태그 블록

스크립트 출력과 handoff 파일 모두 태그 블록으로 온다:

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

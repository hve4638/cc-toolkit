---
name: wtree
description: "repo 에 정책 기반 워크트리 관리를 셋업한다: TUI pane 이 wtree 훅을 조립한 뒤, 브랜치 rules 는 CLI 자신의 wtree init 에 넘긴다"
disable-model-invocation: true
---

<wtree_instruction>
# wtree — 이 repo 에 wtree 정책 셋업

`/wtree` 는 스탠드얼론 `wtree` CLI 를 위한 1회성 셋업으로, cwd 가 속한 repo 를 대상으로 한다. rules 와 settings 는 CLI 자신의 `wtree init` 이 자체 대화형 메뉴로 조립하고, 셋업 pane 은 init 이 다루지 않는 한 가지 — wtree 훅 — 만 더한다.

1. 훅 안전 점검이 먼저다: `<repo>/.wtree/hooks` 가 있으면 각 훅 파일을 읽는다. 표방한 기능 이상의 동작(네트워크 접근, 파일 삭제, 자격 증명 접근 등)이 보이면 pane 을 열기 전에 사용자에게 경고한다 — pane 이 그 훅들을 live 정책으로 가져오는 선택지를 제시하기 때문이다.
2. repo 디렉터리에서 pane 을 연다 (사용자와 한국어로 대화 중이면 `--ko` 를 붙인다):

```bash
useterminal exec node "${CLAUDE_PLUGIN_ROOT}/skills/wtree/scripts/tui.mjs"
```

tmux 밖(`$TMUX` 미설정)에서는 열 pane 이 없다 — 스크립트는 평범한 대화형 CLI 이므로, 사용자에게 위 명령을 본인 터미널에서 실행하라고 안내하고 (`!` 접두어도 가능) 턴을 끝낸다.

3. 모든 것이 pane 안에서 일어난다: 사용자가 훅을 고르고 (기존 `.wtree/hooks` 가져오기 항목이 있으면 그것도), 스크립트가 repo 정책에 기록한 뒤, `wtree init` 으로 넘어가 사용자가 시작 rules 를 고른다. 사용자에게 pane 의 프롬프트를 완료하라고 말하고, 턴을 끝내고 기다린다. pane 을 폴링하거나 조작하지 않는다 — 사용자의 것이다.
4. 결과 파일은 없다. 사용자가 pane 이 끝났다고 하면 `wtree rule` 로 적용된 정책을 읽어 보고한다. pane 이 실패로 끝났다면 사용자가 화면의 메시지를 전달한다 — 그에 따른다.
</wtree_instruction>

---
name: showcase
description: "사용자의 tmux 창 옆에 pane 을 열어 데모나 직접 봐야 하는 것을 보여준다."
disable-model-invocation: true
---

<showcase_instruction>
# showcase

사용자가 볼 수 있는 자리에 띄운다: 돌아가는 데모, 실시간 출력, 조작 중인 프로그램.
pane 은 지금 세션이 들어 있는 tmux 창에 생긴다.

`showcase` 가 tmux 안이 아니라고 하면 사용자에게 알리고 멈춘다. 다른 방법으로
보여줄 길을 찾지 않는다.

## 명령

| 명령 | 동작 |
|---|---|
| `showcase new [-- 명령...]` | pane 을 연다; KEY 를 출력 |
| `showcase ls` | 이 창의 pane 목록: `KEY [WHERE] SIZE CMD` |
| `showcase send KEY <텍스트...>` | 텍스트를 그대로 입력 — Enter 는 안 붙는다 |
| `showcase key KEY <키...>` | 키 입력: `enter` `esc` `tab` `up` `c-c` `f5` …; 수식키 `c-` `m-` `s-` |
| `showcase read KEY [-n N \| --all] [--ansi]` | 화면 캡처; `-n N` 은 스크롤백 N 줄을 덧붙인다 |
| `showcase kill KEY` | pane 을 닫는다 |

## 규칙

- 명령 없이 `new` 하면 셸이 뜬다. `send` + `key enter` 로 몰아넣으면 타이핑이
  사용자 눈에 보인다. `new -- <명령>` 은 바로 실행하고, 그 pane 은 명령이 끝나는
  순간 사라진다.
- 첫 `new` 는 자기가 앉은 열 옆에 새 열을 만들고, 이후는 그 열의 맨 아래에 붙인
  뒤 열의 행 높이를 고르게 편다. 자기 열은 창의 어느 쪽에 있든 쓰지 않는다. pane
  들이 열을 나눠 쓰므로 언젠가 `no space for new pane` 으로 실패한다.
- pane 은 KEY 로만 지칭한다. `WHERE` 열(`right-top`, `left` …)은 사용자에게 어디를
  보라고 말하기 위한 것이다. pane 이 생기고 사라지면 값이 바뀌고, 배치가 설명하기
  어려우면 아예 나오지 않는다.
- 자기 pane 은 목록에 없고 대상으로 지정할 수 없다.
- 사용자의 커서는 움직이지 않는다. 새 pane 이 포커스를 가져가지 않으므로 어디에
  생겼는지 말해준다. 사용자가 걸어둔 zoom 도 되돌려놓고 `showcase` 가 stderr 로
  알리는데, 그때는 pane 이 zoom 뒤에 가려 안 보이니 그 사실을 말해준다.
- 데모가 끝나면 이 세션이 연 pane 을 `kill` 한다. 사용자가 직접 연 pane 을 포함해
  창 안의 모든 pane 에 손이 닿으니 대상을 정확히 고른다.
- 사용자가 볼 이유가 없는 터미널 작업은 `vt` 가 맡는다.
</showcase_instruction>

$ARGUMENTS

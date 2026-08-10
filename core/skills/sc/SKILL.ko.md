---
name: sc
description: "[showcase] 사용자의 tmux 창에 pane 을 열고 조작해 무언가를 직접 보게 한다. 사용자가 데모를 요청하거나 프로그램이 도는 것을 보고 싶어 할 때, 또는 출력이 사용자가 볼 수 있는 자리에 놓여야 할 때 사용한다."
disable-model-invocation: true
---

<showcase_instruction>
# showcase

`showcase` 는 이 세션과 사용자가 함께 보는 터미널을 연다: 돌아가는 데모, 실시간 출력, 조작 중인 프로그램.

`showcase` 는 tmux 위에서 돈다. 직접 `tmux` 를 부르지 않고 `showcase` 만 거친다.

## 명령

| 명령 | 동작 |
|---|---|
| `showcase new` | 셸이 도는 pane 을 연다; KEY 를 출력 |
| `showcase exec <명령...>` | 명령이 도는 pane 을 연다; KEY 를 출력 |
| `showcase ls` | 이 창의 pane 목록: `KEY [WHERE] SIZE CMD` |
| `showcase send KEY <텍스트...>` | 텍스트를 그대로 입력 — Enter 는 안 붙는다 |
| `showcase key KEY <키...>` | 키 입력: `enter` `esc` `tab` `up` `c-c` `f5` …; 수식키 `c-` `m-` `s-` |
| `showcase read KEY [-n N \| --all] [--ansi]` | 화면 캡처; `-n N` 은 스크롤백 N 줄을 덧붙인다 |
| `showcase kill KEY` | pane 을 닫는다 |

표에 없는 옵션 세부는 `showcase --help`.

## 규칙

- `new` 는 직접 `kill` 하거나 exit 되기 전까지 사라지지 않는다. 데모를 이어가거나 명령을 여러 번 돌릴 때 쓴다. 이 셸은 rc 파일 없이 `$` 프롬프트만 달고 뜨므로 사용자의 alias·함수는 없다.
- `exec` 는 명령이 끝나면 즉시 사라진다. 오래 도는 프로그램 하나를 띄울 때 쓴다. 금방 끝나는 명령은 pane 이 자리를 잡기도 전에 사라져 호출이 실패할 수 있다.
- `exec` 는 셸을 거치지 않고 명령을 그대로 실행하므로 파이프나 리다이렉트는 `exec sh -c '…'` 로 준다.
- pane 은 KEY 로만 지칭한다.
- `ls` 목록에는 이 세션이 열지 않은 pane 도 나온다. 다른 에이전트나 사용자의 것이니 이 세션이 연 KEY 만 대상으로 삼는다.
- 용도가 끝나면 열었던 pane 을 `kill` 하여 정리한다.
- 사용자가 볼 이유가 없는 터미널 작업은 `vt` 가 맡는다.
</showcase_instruction>

$ARGUMENTS

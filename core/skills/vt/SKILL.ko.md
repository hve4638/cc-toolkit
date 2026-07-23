---
name: vt
description: "vt CLI로 터미널 세션을 조작: 셸 명령을 실행해 출력과 종료코드를 받고, 인터랙티브 프로그램(TUI, REPL, 설치 마법사)에 키를 입력하고, 렌더링된 화면을 텍스트로 읽는다. 지속 셸·키 입력·시간에 걸친 화면 관찰이 필요할 때 사용한다; 상태 없는 단발 명령은 일반 Bash로 충분하다. Linux/macOS 전용."
---

<vt_instruction>
# vt

키로 주소를 지정하는 가상 터미널 세션에서 터미널 작업을 수행한다. 세션은 화면이 딸린 지속 셸이다: 그 안에서 명령을 실행하고, 인터랙티브 프로그램에 키를 입력하고, 화면을 텍스트로 읽어온다.

Linux/macOS에서 지원한다(tmux 필요). 네이티브 Windows에서는 사용 불가.

## 명령

전역:

| command | 효과 |
|---|---|
| `vt new [dir]` | 세션 생성(dir에서 시작, 기본: cwd); 4자리 hex KEY 출력 |
| `vt ls` | 세션 목록: `KEY PANES IDLE PATH` |

세션 (KEY는 `vt new`가 출력한 값):

| command | 효과 |
|---|---|
| `vt KEY run [--timeout N] <cmd>` | 세션 셸에서 cmd 실행, 대기 후 출력 인쇄; cmd의 종료코드로 종료(기본 타임아웃 60초) |
| `vt KEY send <text>` | 텍스트 리터럴 입력 — Enter 미포함 |
| `vt KEY key <key...>` | 키 입력: `enter` `esc` `tab` `up` `c-c` `f5` …; 수식키 `c-` `m-` `s-` |
| `vt KEY read [-n N \| --all] [--ansi]` | 화면 캡처; `-n N`은 스크롤백 마지막 N줄 추가, `--all`은 전체 |
| `vt KEY panes` / `vt KEY split [-h]` / `vt KEY focus %N` / `vt KEY kill %N` | pane 목록 / 분할(새 pane ID 출력) / 기본 대상 지정 / pane 하나 닫기 |
| `vt KEY status` | 현재 경로, 실행 중 명령, 화면 크기 |
| `vt KEY close` | 세션 종료 |

표 밖의 옵션 상세: `vt --help`.

## 워크플로

1. `vt new` — 출력된 KEY를 기억; 모든 세션 명령에 필요하다.
2. 셸 명령: `vt KEY run '<cmd>'` — 명령이 끝나면 출력과 종료코드가 돌아온다.
3. 인터랙티브 프로그램(TUI, REPL, 프롬프트): `send`/`key`로 입력하고 `read`로 관찰한다; 목표 상태가 화면에 나타날 때까지 반복한다.
4. `vt KEY close` — 이 작업에서 만든 세션이 `vt ls`에 남지 않으면 완료.

## 규칙

- `run`은 세션 셸이 프롬프트에 있을 때만 동작한다; 프로그램이 pane을 점유 중이면 `send`/`key`/`read`로 조작한다.
- `run`의 옵션은 명령 앞에 쓴다; 명령 첫 단어 뒤의 토큰은 전부 셸에 그대로 전달된다.
- `run`은 여러 줄 명령을 거부한다; 그런 입력은 `send` + `key enter`로 한 줄씩 전달한다.
- `run`이 멈춤이나 타임아웃을 보고하면 `read`로 확인하고 `key c-c`로 중단한다.
- 세션은 close 전까지 턴을 넘어 유지된다.
</vt_instruction>

$ARGUMENTS

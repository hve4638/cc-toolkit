---
name: worker
description: "워크스페이스 ticket 작업 위임 — 지목된 ticket 을 수행하는 워커 세션용"
disable-model-invocation: true
---

<worker>
Your role is Worker in this project.

Orchestrator가 이 세션에 ticket 하나를 위임했다. 지목된 ticket의 정보를 수집하고, 착수 가능하면 수행까지 한다. 문서 형식과 완료 의미는 `ruleof ticket` 이 출력하는 규칙을 따른다.

## 작업 수행
1. 받은 첫 인자는 일반적으로 ticket 명이다. `wsticket <이름>` 을 실행해 대상과 선행 ticket 의 상태를 확인한다.
2. 대상 폴더 `docs/ticket/<이름>/` 의 TICKET.md 와 딸린 자료를 읽는다.
3. 미완료 선행 ticket 이 남아 있으면 착수하지 않는다. 무엇이 막고 있는지 알리고 멈춘다.
4. TICKET.md 의 status 를 in-progress 로 갱신하고 `update(ticket): ...` 형식으로 커밋한 뒤, TICKET.md 가 정의한 작업을 수행한다.
5. 완료 여부·산출물·남은 문제를 보고한다. 완료 기록 (폴더 삭제·DONE.md append) 은 하지 않는다 (Orchestrator의 몫)

## 작업 규칙

범위 외 문제 보고
- 작업 범위 외의 것은 필요한 경우가 아니면 되도록 건드리지 않는다.
  - ex) 리팩토링, 작업 중 발견한 소소한 버그 등. 이는 Orchestrator에게 보고한다.

의도 보고
- 수정이 티켓 및 사용자가 설명하지 않은 의도와 다를 가능성이 있는 경우는 작업 후 해당 사항을 나열하고 사용자에게 확인받는다. 언제든 수정 및 롤백 가능한 상태로 둔다.
  - ex) 티켓에서 지정한 기능 외 타 기능까지 영향을 미칠 수 있는 경우. 디자인, UX 등 주관적 요소가 강하게 들어가는 경우

## Orchestrator와 상호작용

- 작업 종료(사용자의 요청에 따른 merge 시), 또는 필요한 맥락 추가 제공 필요 시, 또는 범위 외 문제 보고 시 SendMessage를 통해 Orchestrator와 통신해라.
- 일반적으로 Orchestrator는 worker 자신과 동일 tmux 세션 내에 존재한다.
</worker>

Task: $ARGUMENTS

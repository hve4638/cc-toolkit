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
</worker>

Task: $ARGUMENTS

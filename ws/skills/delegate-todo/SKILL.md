---
name: delegate-todo
description: "워크스페이스 todo 작업 위임 — 지목된 todo 를 수행하는 워커 세션용"
disable-model-invocation: true
---

<delegate-todo>
오케스트레이터가 이 세션에 todo 하나를 위임했다. 지목된 todo 의 정보를 수집하고, 착수 가능하면 수행까지 한다. 문서 형식과 완료 의미는 `ruleof todo` 와 `ruleof milestone` 이 출력하는 규칙을 따른다.

1. 받은 첫 인자는 일반적으로 todo 명 또는 milestone 명이다. `wstodo <이름>` 을 실행해 대상과 선행 todo 의 상태를 확인한다. milestone 이면 출력에서 착수 가능한 todo 하나를 위임 대상으로 삼는다.
2. 대상 폴더 `docs/todo/<이름>/` 의 TODO.md 와 딸린 자료를 읽는다. milestone 경유라면 `docs/milestone/<이름>/MILESTONE.md` 의 목표와 배경도 함께 읽는다.
3. 미완료 선행 todo 가 남아 있으면 착수하지 않는다. 무엇이 막고 있는지 알리고 멈춘다.
4. TODO.md 의 status 를 in-progress 로 갱신하고 `update(todo): ...` 형식으로 커밋한 뒤, TODO.md 가 정의한 작업을 수행한다.
5. 완료 여부·산출물·남은 문제를 보고한다. 완료 기록 (폴더 삭제·DONE.md append) 은 하지 않는다 — 그것은 오케스트레이터가 write-todo 로 한다.
</delegate-todo>

Task: $ARGUMENTS

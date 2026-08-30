---
name: bootstrap-todo
description: "워크스페이스 todo·milestone 작업 착수 준비"
disable-model-invocation: true
---

<bootstrap-todo>
사용자는 지목한 todo 또는 milestone 의 정보를 수집해, 작업에 착수할 준비가 된 상태를 만들기를 원한다. 문서 형식과 완료 의미는 `ruleof todo` 와 `ruleof milestone` 이 출력하는 규칙을 따른다.

1. 받은 첫 인자는 일반적으로 milestone 명 또는 todo 명이다. `wstodo <이름>` 을 실행해 그 대상과 선행 todo 의 상태를 확인한다.
2. 대상 폴더 (`docs/todo/<이름>/` 또는 `docs/milestone/<이름>/`) 의 TODO.md·MILESTONE.md 와 딸린 자료를 읽는다. milestone 이면 출력에서 착수 가능한 todo 를 골라 그 TODO.md 도 읽는다.
3. 목표와 배경, 선행 관계 (무엇이 막고 있고 무엇부터 할 수 있는지), 바로 착수할 일을 정리해 보고한다. 이 스킬의 범위는 정보 수집까지다 — todo·milestone 의 생성·수정·완료는 write-todo 로 한다.
</bootstrap-todo>

Task: $ARGUMENTS

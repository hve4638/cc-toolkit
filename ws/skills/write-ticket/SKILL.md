---
name: write-ticket
description: "워크스페이스 ticket·milestone 생성·수정·완료"
disable-model-invocation: true
---

<write-ticket>
워크스페이스 `docs/ticket/` 의 ticket 과 `docs/milestone/` 의 milestone 을 변형한다 — 생성·수정·완료 전부. 구조·frontmatter 형식·완료 의미는 `ruleof ticket` 과 `ruleof milestone` 이 출력하는 규칙을 따른다. docs/ 는 현재 위치에서 워크스페이스 루트 방향으로 찾는다.

ticket:

- 생성: `docs/ticket/<작업명>/TICKET.md` 를 frontmatter 형식대로 만든다. depends 에 적는 이름은 기존 폴더명·DONE.md 와 대조한다.
- 완료: 폴더째 삭제하고, `docs/ticket/DONE.md` 끝에 `YYYY-MM-DD  <폴더명> — <description>` 한 줄을 추가한다.

milestone:

- 생성: `docs/milestone/<이름>/MILESTONE.md` 를 frontmatter 형식대로 만든다. tickets 에는 아직 만들지 않은 ticket 도 미리 적을 수 있다.
- 완료: `wsticket <milestone명>` 을 실행해 완료 성립 (열거된 모든 이름이 DONE.md 에 있음) 을 확인한 뒤 폴더째 삭제한다. 성립하지 않으면 출력에 남는 open·missing 이름을 알리고 멈춘다.

변형 후 `wsticket [경로]` 를 실행해 경고 없이 파싱되는지 확인하고, 각 규칙 문서의 수정 규칙대로 ws repo 에 커밋한다.
</write-ticket>

Task: $ARGUMENTS

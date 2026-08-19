---
name: write-todo
description: "워크스페이스 todo 생성·수정·완료"
disable-model-invocation: true
---

<write-todo>
워크스페이스 `docs/todo/` 의 todo 를 변형한다 — 생성·수정·완료 전부. 구조·frontmatter 형식·완료 의미는 [rule-of-workspace 의 RULE_OF_TODO.md](../rule-of-workspace/RULE_OF_TODO.md) 를 따른다. docs/todo 는 현재 위치에서 워크스페이스 루트 방향으로 찾는다.

- 생성: `docs/todo/<작업명>/TODO.md` 를 frontmatter 형식대로 만든다. depends 에 적는 이름은 기존 폴더명과 대조한다.
- 완료: 폴더째 삭제하고, 그 폴더를 depends 에 적어둔 다른 todo 에서 이름을 지운다.

변형 후 `todo [경로]` 를 실행해 경고 없이 파싱되는지 확인하고, RULE_OF_TODO.md 의 수정 규칙대로 ws repo 에 커밋한다.
</write-todo>

Task: $ARGUMENTS

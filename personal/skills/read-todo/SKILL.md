---
name: read-todo
description: "워크스페이스 todo 조회"
disable-model-invocation: true
---

<read-todo>
워크스페이스 `docs/todo/` 의 todo 를 찾아 알린다. 형식은 [rule-of-workspace 의 RULE_OF_TODO.md](../rule-of-workspace/RULE_OF_TODO.md) 를 따른다.

1. `todo [경로]` 를 실행해 전체 표를 얻는다. 경로를 생략하면 현재 위치에서 워크스페이스 루트 방향으로 docs/todo 를 찾는다.
2. 요청을 표에 대어 대상을 좁힌다:
   - 특정 todo 명 → 그 폴더의 TODO.md 와 딸린 자료를 읽는다
   - repo·priority·status 조건 ("<특정repo> 남은 작업은?", "critical 뭐 있어") → 해당 컬럼으로 거른 뒤 걸린 todo 의 TODO.md 를 읽는다
   - 집계 질문 (개수·분포·어느 repo 에 쌓였나) → 표에서 직접 센다
3. 보고는 요청이 가리키는 todo 를 전부 확인한 뒤에 한다. 본문을 읽은 todo 는 표의 한 줄 요약보다 본문 내용을 근거로 삼는다.
</read-todo>

Task: $ARGUMENTS

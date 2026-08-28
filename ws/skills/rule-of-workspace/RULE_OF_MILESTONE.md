# rule of milestone

milestone 은 todo 의 상위 단위다 — 목표 하나와, 그것을 이루는 todo 이름들의 묶음.

## 구조

- `docs/milestone/<이름>/` 폴더 하나가 milestone 하나다.
- 폴더명은 생성 후 불변이다.
- 각 폴더에는 `MILESTONE.md` 를 두고, 딸린 자료가 있으면 같은 폴더에 둔다.

## MILESTONE.md

frontmatter 는 다음 형식이다. 본문에는 목표와 배경을 서술한다.

```yaml
---
description: 한 줄 요약
todos: []            # 이 milestone 의 범위인 todo 폴더명. 아직 만들지 않은 todo 도 미리 적는다
created: YYYY-MM-DD
---
```

## 링크 방향

todo 쪽에는 milestone 소속 표시를 두지 않는다. todo 는 완료 시 폴더째 삭제되므로, todo 쪽에 둔 소속 정보는 완료와 함께 사라진다. 소속은 이 파일의 todos 열거가 유일한 출처다.

## 완료

todos 에 열거된 모든 이름이 `docs/todo/` 에 살아있지 않고 `docs/todo/DONE.md` 에 있으면 완료다. 완료를 확인한 뒤 폴더째 삭제한다.

## 수정

milestone 업데이트 시마다 ws repo 에 `update(milestone): ...` 메시지 형식으로 커밋하여 업데이트한다.

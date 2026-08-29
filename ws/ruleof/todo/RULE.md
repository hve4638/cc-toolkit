---
description: 워크스페이스 todo (docs/todo) 작업 규칙 — 구조·frontmatter·완료 절차
---

# rule of todo

## 구조

- `docs/todo/<작업명>/` 폴더 하나가 작업 하나다.
- 폴더명은 생성 후 불변이다.
- 각 폴더에는 `TODO.md` 를 두고, 작업에 딸린 자료가 있으면 같은 폴더에 둔다.

## TODO.md

frontmatter 는 다음 형식이다.

```yaml
---
description: 한 줄 요약
priority: critical | high | normal | low  # 얼마나 빨리 고쳐야 하는지 여부. 의존성과는 관계없음
repos: [afron-dev]   # 영향받는 저장소
depends: []          # 의존하는 다른 todo 의 폴더명
status: pending | in-progress | on-hold
created: YYYY-MM-DD
---
```

## 완료

작업이 완료되면 폴더째 삭제하고, `docs/todo/DONE.md` 끝에 한 줄을 추가한다.

```
YYYY-MM-DD  <폴더명> — <description>
```

DONE.md 는 append-only 원장이다 — 기존 줄은 고치지 않는다. 같은 이름이 재작업 후 다시 완료되면 줄이 하나 더 늘어날 뿐이다.

다른 todo 의 depends 에 남은 완료 이름은 지우지 않아도 된다 — `todo` CLI 가 DONE.md 를 대조해 완료로 해소한다.

## 수정

todo 업데이트 시 마다 ws repo에 `update(todo): ...` 메시지 형식으로 커밋하여 업데이트한다.

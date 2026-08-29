---
description: 워크스페이스 repo 의 폴더 구조 규칙
---

# rule of workspace

워크스페이스 repo 의 규칙이다. 경로는 모두 워크스페이스 루트 기준이다.

## 폴더

```
<루트>/            # 진입점·살아있는 문서 (CLAUDE.md, DESIGN.md·VISION.md 급) 만 둔다
├─ docs/           # 그 외 모든 문서 — 계획서·이슈·핸드오프. 문서를 참조하라고 하면 여기를 먼저 확인한다
│  ├─ BACKLOG.md   # 백로그. 내부 프로젝트가 여럿이면 BACKLOG.<이름>.md 로 나눈다
│  ├─ milestone/   # 목표 단위 — todo 묶음 (rule of milestone)
│  └─ todo/        # 작업 관리 (rule of todo)
├─ references/     # 참고할 외부 저장소를 clone 하는 자리 (git 추적 제외)
└─ <이름>/         # 내부 프로젝트 repo (git 추적 제외)
```

## 세부 규칙

- `ruleof todo`: todo 작업 수행 시
- `ruleof milestone`: milestone 작업 수행 시

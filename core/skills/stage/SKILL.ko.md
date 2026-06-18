---
name: stage
description: 현재 변경을 의도 단위로 스테이징하고 일관된 커밋 메시지를 추천. 커밋은 하지 않음.
---

<stage_instruction>
git 변경사항을 검토 → 의도 단위 스테이징 → 저장소 컨벤션에 맞춘 커밋 메시지 후보 제시까지 수행한다. **커밋은 직접 수행하지 않는다.**

## 절차

1. `git status`, `git diff` 로 변경사항 파악
2. 의도 단위로 `git add <path>` 명시적 스테이징
   - `git add .` / `-A` 지양 — `.env`·자격 증명·산출물 혼입 위험
   - 한 변경에 두 의도가 섞여 있으면 분할 스테이징을 제안
3. `git log --oneline | head -n 10` 으로 컨벤션 확인 (저장소 로그가 항상 우선)
4. 컨벤션에 맞춘 커밋 메시지 후보 제시 후 종료

## 컨벤션 (저장소 로그가 우선)

header: `type(scope): subject`
- scope 는 필요하지 않다면 생략
- type 목록: feat, fix, docs, refactor, test, chore, ci 등
- subject 는 짧고 명확하게, 마침표 생략
- Breaking Change 는 `!` 표기 (`feat(api)!: ...`)

body 는 subject 로 충분하면 생략.

**Co-authored-by 금지** — 사용자가 명시하지 않는 한 작성하지 않는다.

## 산출물

- 스테이징 결과 요약 (`git status --short`)
- 추천 커밋 메시지 (필요 시 후보 1~3개)
- 스테이징하지 않고 남긴 변경이 있다면 그 이유
</stage_instruction>

Task: $ARGUMENTS

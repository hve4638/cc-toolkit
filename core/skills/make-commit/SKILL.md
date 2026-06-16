---
name: make-commit
description: 커밋 생성
---

<make-commit>
git 변경사항을 보고 커밋을 생성합니다.

가장 중요한건 일관성입니다. `git log --oneline | head -n 10` 로 어떤 컨벤션을 지키는지 확인하세요. 아래 규칙을 위반하더라도 일관성이 우선시됩니다.

## 컨벤션

header: `type(scope): subject`
- scope는 필요하지 않다면 생략
- type 목록: feat, fix, docs, refactor, test, chore, ci 등
- subject는 짧고 명확하게, 무엇을 바꾸었는지 바로 보이게, 마침표 생략

body
- subject로 충분하다면 생략

**Co-authored-by 금지**
- 사용자가 의도적으로 명시하지 않는 한 Co-authored-by 작성 금지

Breaking Change의 경우
- !를 붙여 표현 (예: `feat(api)!: ...`)
</make-commit>

Task: $ARGUMENTS
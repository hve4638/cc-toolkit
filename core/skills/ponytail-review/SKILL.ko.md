---
name: ponytail-review
description: "ponytail: diff 과잉 설계 정리"
disable-model-invocation: true
---

<ponytail-review>

diff 에서 불필요한 복잡도를 리뷰한다. diff 의 가장 좋은 결말은 더 짧아지는
것이다. 이 폴더의 [`REVIEW_RULE.md`](REVIEW_RULE.md) 를 먼저 읽는다 — 발견
태그와 범위 경계가 거기 있다.

## 형식

`L<line>: <tag> <what>. <replacement>.`, 여러 파일 diff 면
`<file>:L<line>: ...`.

## 예시

❌ "이 EmailValidator 클래스는 필요 이상으로 복잡할 수도 있는데, 지금 단계에서
이 검증 규칙들이 다 필요한지 검토해보셨나요?"

✅ `L12-38: stdlib: 27-line validator class. "@" in email, 1 line, real validation is the confirmation mail.`

✅ `L4: native: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps.`

✅ `repo.py:L88: yagni: AbstractRepository with one implementation. Inline it until a second one exists.`

✅ `L52-71: delete: retry wrapper around an idempotent local call. Nothing replaces it.`

✅ `L30-44: shrink: manual loop builds dict. dict(zip(keys, values)), 1 line.`

## 점수

의미 있는 유일한 지표로 끝맺는다: `net: -<N> lines possible.`

자를 게 없으면 `Lean already. Ship.` 이라고 말하고 멈춘다.

## 경계

`REVIEW_RULE.md` 에 더해: 스모크 테스트 하나나 `assert` 기반 자체 점검은
ponytail 의 최소치이지 군더더기가 아니다. 절대 삭제 대상으로 지목하지 않는다.

</ponytail-review>

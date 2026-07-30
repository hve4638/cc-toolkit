---
name: ponytail-review
description: >
  과잉 설계만 겨냥한 코드 리뷰. 무엇을 지울지 찾는다: 다시 만든 표준
  라이브러리, 필요 없는 의존성, 추측성 추상화, 죽은 유연성. 발견 하나당 한 줄:
  위치, 자를 것, 대체물. 사용자가 "review for over-engineering", "what can we
  delete", "is this over-engineered", "simplify review" 라고 하거나
  /ponytail-review 를 호출할 때 적용한다. 정확성 중심 리뷰를 보완하며, 이쪽은
  복잡도만 사냥한다.
---

diff 에서 불필요한 복잡도를 리뷰한다. 발견 하나당 한 줄: 위치, 자를 것,
대체물. diff 의 가장 좋은 결말은 더 짧아지는 것이다.

## 형식

`L<line>: <tag> <what>. <replacement>.`, 여러 파일 diff 면
`<file>:L<line>: ...`.

태그:

- `delete:` 죽은 코드, 안 쓰는 유연성, 추측성 기능. 대체물: 없음.
- `stdlib:` 표준 라이브러리가 이미 제공하는데 손으로 만든 것. 함수 이름을 댄다.
- `native:` 플랫폼이 이미 하는 일을 하는 의존성이나 코드. 기능 이름을 댄다.
- `yagni:` 구현이 하나뿐인 추상화, 아무도 안 건드리는 설정, 호출자가 하나뿐인 레이어.
- `shrink:` 같은 로직, 더 적은 줄. 짧은 형태를 보여준다.

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

범위는 과잉 설계와 복잡도뿐. 정확성 버그, 보안 구멍, 성능은 명시적으로 범위
밖이다. 그런 건 이 리뷰가 아니라 일반 리뷰 패스로 보낸다. 스모크 테스트 하나나
`assert` 기반 자체 점검은 ponytail 의 최소치이지 군더더기가 아니다. 절대 삭제
대상으로 지목하지 않는다. 고치지 않고 나열만 한다.

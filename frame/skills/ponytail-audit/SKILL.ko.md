---
name: ponytail-audit
description: >
  저장소 전체를 훑는 과잉 설계 감사. ponytail-review 와 같지만 diff 대신 코드베이스
  전체를 스캔한다: 무엇을 지우고, 단순화하고, 표준 라이브러리·네이티브로 바꿀지
  순위를 매긴 목록. 사용자가 "audit this codebase", "audit for over-engineering",
  "what can I delete from this repo", "find bloat", "ponytail-audit",
  "/ponytail-audit" 라고 할 때 적용한다. 일회성 리포트이며 수정은 적용하지 않는다.
---

ponytail-review 를 저장소 전체로. diff 대신 트리 전체를 스캔한다. 크게 잘라내는
것부터 순위를 매긴다.

## 태그

ponytail-review 와 동일:

- `delete:` 죽은 코드, 안 쓰는 유연성, 추측성 기능. 대체물: 없음.
- `stdlib:` 표준 라이브러리가 이미 제공하는데 손으로 만든 것. 함수 이름을 댄다.
- `native:` 플랫폼이 이미 하는 일을 하는 의존성이나 코드. 기능 이름을 댄다.
- `yagni:` 구현이 하나뿐인 추상화, 아무도 안 건드리는 설정, 호출자가 하나뿐인 레이어.
- `shrink:` 같은 로직, 더 적은 줄. 짧은 형태를 보여준다.

## 사냥감

표준 라이브러리나 플랫폼이 이미 제공하는 의존성, 구현이 하나뿐인 인터페이스,
산출물이 하나뿐인 팩토리, 위임만 하는 래퍼, 하나만 export 하는 파일, 죽은
플래그와 설정, 손으로 만든 표준 라이브러리.

## 출력

발견 하나당 한 줄, 순위대로: `<tag> <what to cut>. <replacement>. [path]`.
끝에 `net: -<N> lines, -<M> deps possible.` 자를 게 없으면 `Lean already. Ship.`

## 경계

범위는 과잉 설계와 복잡도뿐. 정확성 버그, 보안 구멍, 성능은 명시적으로 범위
밖이다. 그런 건 일반 리뷰 패스로 보낸다. 발견을 나열할 뿐 아무것도 적용하지
않는다. 일회성.

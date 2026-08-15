---
name: ponytail-audit
description: "ponytail 저장소 전체 스캔 모드"
disable-model-invocation: true
---

<ponytail-audit>

ponytail-review 를 저장소 전체로. diff 대신 트리 전체를 스캔한다. 크게 잘라내는
것부터 순위를 매긴다. 이 폴더의 [`REVIEW_RULE.md`](REVIEW_RULE.md) 를 먼저
읽는다 — 발견 태그와 범위 경계가 거기 있다.

## 사냥감

표준 라이브러리나 플랫폼이 이미 제공하는 의존성, 구현이 하나뿐인 인터페이스,
산출물이 하나뿐인 팩토리, 위임만 하는 래퍼, 하나만 export 하는 파일, 죽은
플래그와 설정, 손으로 만든 표준 라이브러리.

## 출력

발견 하나당 한 줄, 순위대로: `<tag> <what to cut>. <replacement>. [path]`.
끝에 `net: -<N> lines, -<M> deps possible.` 자를 게 없으면 `Lean already. Ship.`
일회성.

</ponytail-audit>

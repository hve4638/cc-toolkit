---
name: anchor
description: Write ANCHOR.md, a project's list of invariants that feature proposals are checked against; amend it only on a real change of direction
disable-model-invocation: true
argument-hint: "[the project's invariants, roughly]"
---

<anchor_instruction>
# anchor

ANCHOR.md를 작성한다. ANCHOR.md는 프로젝트의 불변 조건 목록이다: 지켜야 하는 성질과, 의도적으로 하지 않을 것들을 작성한다.
구현 상태·규칙·계획은 ANCHOR.md의 관심사가 아니다.

## ANCHOR.md가 아직 없을 때

사용자가 대략적으로 던진 항목들에서 출발한다.

- 사용자가 던진 항목으로부터 목표와 비목표를 산출한다.
- 최종 확정하기 전 사용자에게 검수받는다.

형식은 다음과 같다:
```md
# ANCHOR

이 문서는 이 프로젝트의 목표와 비목표를 담는다. 새 작업이 목표 또는 비목표와 충돌하면, 사용자에게 결정을 요청한다.

## Goal
- ...

## Non-Goal
- ...
```

## ANCHOR.md가 이미 있을 때

ANCHOR.md는 기본적으로 동결이다. 불변 조건 자체가 바뀔 때만 수정한다. 구현 디테일이 바뀐 것은 수정 사유가 아니다.

- 수정 전에 진짜 방향 전환인지 확인한다.
- 바뀐 항목만 수정하고, 나머지는 쓰인 대로 둔다.

## CLAUDE.md 추가

프로젝트의 `CLAUDE.md`에 한 줄을 추가한다 (없으면 생성):
- 기능을 추가하거나 수정 시, 제안을 `ANCHOR.md`와 대조해 충돌을 확인하라.
</anchor_instruction>

$ARGUMENTS

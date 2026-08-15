---
name: ponytail-debt
description: "코드베이스의 `ponytail:` 주석 전부를 부채 원장으로 수확. 리포트만."
disable-model-invocation: true
---

<ponytail-debt>

의도적인 ponytail 지름길은 전부 `ponytail:` 주석으로 표시되어 한계와 업그레이드
경로를 담고 있다. 이 스킬은 그것들을 원장 하나로 모아, 유예가 조용히 영구가
되지 않게 한다.

## 스캔

`node_modules`, `.git`, 빌드 산출물을 빼고 저장소에서 주석 마커를 grep 한다:

`grep -rnE '(#|//) ?ponytail:' .`  (스택이 다른 주석 접두사를 쓰면 추가한다)

히트 하나가 원장 한 행이다. 주석 접두사가 있어서 이 컨벤션을 단순히 언급만 하는
산문은 원장에 끼지 않는다.

## 출력

마커 하나당 한 행, 파일별로 묶는다:

`<file>:<line>, <what was simplified>. ceiling: <the limit named>. upgrade: <the trigger to revisit>.`

컨벤션이 `ponytail: <ceiling>, <upgrade path>` 이므로 한계와 트리거는 주석에서
그대로 뽑는다. 행마다 담당자도 원하면 `git blame -L<line>,<line>` 을 더한다.

썩을 위험을 표시한다: 업그레이드 경로나 트리거를 대지 않는 `ponytail:` 주석에는
`no-trigger` 태그를 붙인다. 조용히 썩는 건 그것들이다.

끝에 `<N> markers, <M> with no trigger.` 아무것도 없으면 `No ponytail: debt. Clean ledger.`

## 경계

읽고 보고할 뿐 아무것도 바꾸지 않는다. 남기고 싶으면 말하면 원장을 파일로 쓴다
(예: `PONYTAIL-DEBT.md`). 일회성.

</ponytail-debt>

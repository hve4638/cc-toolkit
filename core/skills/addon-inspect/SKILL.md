---
name: addon-inspect
description: "애드온 스위치 상태 점검 — 사용 가능한 규칙, 현 설정으로 켜진 항목, 이벤트별 발화"
disable-model-invocation: true
---

<addon-inspect>

이 스킬 폴더 기준 `../../event/inspect.mjs` 를 `node` 로 실행하고, 출력을 가감 없이 그대로 사용자에게 보여준다.

인자는 세션 루트 하나다. 사용자가 경로를 주었으면 그 경로를 넘기고, 없으면 인자 없이 실행한다 (현재 디렉터리 기준).

</addon-inspect>

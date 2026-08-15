# frame

프로젝트에 마커 파일이 있을 때만 켜지는 코드 작업 가드레일 묶음.
이벤트 훅 하나가 마커를 확인하고 활성 가드레일로 라우팅한다.

## 동작

- 마커 — `.inlay` 같은 빈 파일. cwd 에서 루트까지 올라가며 찾고, 있으면 그 가드레일만 켠다. 없으면 해당 훅은 즉시 빠진다.
- 디스패처 — `scripts/dispatch.mjs`. 이벤트마다 마커를 보고 `guardrails/<name>/hooks/<event>.mjs` 핸들러로 stdin 페이로드를 넘긴다. 핸들러 결과를 모아 이벤트 형식에 맞게 emit.
- 핸들러 반환 — `{ context }` 는 additionalContext 주입, `{ block }` 은 Stop 차단, 없으면 null.

## 가드레일

- `.inlay` — INLAY.md 로 컨텍스트를 코드 옆에 박는 작업 규율. 마커 위치가 루트·작업범위 경계(상향 탐색 천장)다.

ponytail 가드레일은 core 플러그인의 애드온 (`core/skills/ponytail/addon.mjs`) 으로 이관됐다 — agentaddon `event` 파일의 `ponytail` 줄로 켠다.

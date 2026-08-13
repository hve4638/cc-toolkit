main ← dev ← 작업 브랜치 2단 통합에 prototype/* 실험 브랜치가 딸린 셰이프

`main` 과 `dev` 는 파괴 불가. 작업 브랜치(`feat/*` 등)는 `dev` 에 squash 로 합치고, `dev` 는 `main` 에 no-ff 로 올린다. 작업 브랜치는 ephemeral 이라 합치면 정리된다. `prototype/*` 는 `dev` 와 작업 브랜치 어디서든 갈라져 나올 수 있는 실험용 브랜치다.

자주 나오는 이탈:

- 루트 브랜치명이 `main` 이 아니면: 감지된 루트로 자동 개명되며, 다른 이름을 쓰려면 answer 의 `root` 키로 준다.
- prototype 유지 여부를 사용자에게 묻는다. 필요 없다면 answer 에 `"drop":["group:prototype"]` — 섹션과 그 `children` 참조가 함께 제거된다.
- 허용 접두어(`name-allow`)를 바꾸려면: step1 이 만든 작업장의 rules 를 step2 전에 직접 편집한다.

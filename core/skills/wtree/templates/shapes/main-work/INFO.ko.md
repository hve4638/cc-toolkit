main 루트 아래 작업 브랜치(feat/* fix/* 등)를 squash 로 합치는 가장 단순한 셰이프

`main` 은 파괴 불가 루트이고, 그 아래 `feat/* fix/* refactor/* perf/* docs/* test/* chore/*` 워크트리를 만들어 작업한 뒤 squash 단일 커밋으로 `main` 에 합친다.

자주 나오는 이탈:

- 루트 브랜치명이 `main` 이 아니면: 감지된 루트로 자동 개명되며, 다른 이름을 쓰려면 answer 의 `root` 키로 준다.
- 허용 접두어(`name-allow`)를 바꾸려면: step1 이 만든 작업장의 rules 를 step2 전에 직접 편집한다.

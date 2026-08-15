<status>Error</status>
<error>
TUI pane 이 열렸지만 결과가 기록되지 않았다 — 아직 도는 중이거나, 끝맺지 못하고 종료됐다 (pane 닫힘, 프로세스 kill, 크래시).
</error>
<next>
pane 이 아직 열려 있으면 사용자가 끝내기를 기다린다. 아니면 읽기 전용인 step 1 무인자 조회로 현 상태를 확인하고 step 루트로 이어간다:

```
node {STEP1}
```
</next>

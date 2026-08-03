---
name: pickup
description: 현재 디렉토리의 HANDOFF 파일을 찾아 위임된 작업을 로드하고 파일을 삭제
disable-model-invocation: true
---

<pickup_instruction>
# pickup

다른 세션이 HANDOFF 파일로 넘긴 작업을 로드해 요약만 사용자에게 보여주고, 작업 시작은 사용자의 명시적 지시를 기다린다.

---

## 동작 순서

### 1. 탐색
현재 작업 디렉토리에서 `HANDOFF.md` 와 `HANDOFF.*.md` 를 찾는다. 사용자가 파일이나 경로를 지정했다면 그것을 우선한다.

- 없음 → 이어받을 handoff 없음을 사용자에게 알리고 종료
- 정확히 1 개 → 로드
- 2 개 이상 → 목록을 보여주고 어느 것인지 사용자에게 묻는다

### 2. 로드
파일을 읽고 그 내용을 현재 세션의 작업 기반으로 삼는다.

### 3. 삭제
로드 성공 확인 후 파일을 삭제한다.
</pickup_instruction>

$ARGUMENTS

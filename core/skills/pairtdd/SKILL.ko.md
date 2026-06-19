---
name: pairtdd
description: 사용자가 적대적 pair-TDD 세션 실행을 요청할 때 사용. 백그라운드에 tdd-adversary 테스터 하나만 띄우고 main 세션 자신이 구현자가 된다.
argument-hint: "[수행할 task 설명]"
---

<pairtdd_instruction>

## Step 1: 스펙 확보

### 1.1 slug 도출

사용자가 제공한 task 와 현재 대화 맥락을 종합해 짧은 이름 (`[a-zA-Z0-9_-]`) 을 도출한다. 현재 시각을 `YYYYMMDD-HHMM` 포맷으로 prefix 해 slug 를 구성한다. 예: 이름이 `pricing-rules` 면 slug 는 `20260601-1234-pricing-rules`. 사용자 확인을 받지 않고 그대로 진행한다.

### 1.2 스펙 작성

현재 대화에 TDD 대상에 관한 충분한 컨텍스트 (요구사항·도메인·입출력 형태) 가 있는지 자체 판단한다.

- 충분 → 그 컨텍스트를 정리해 스펙 초안을 작성하고 사용자 검토·수정을 받는다. 인터뷰 생략.
- 부족 → 핵심 질문 3-5개로 짧게 인터뷰하고 답변을 정리해 스펙을 작성한다.

확정본을 `.agent-memory/tdd-spec/<slug>.md` 에 저장한다 (디렉토리 없으면 생성). 형식은 자연어 + 입출력 예시 + 경계 조건.

## Step 2: 셋업

`git rev-parse HEAD` 로 시작 커밋 SHA (base-sha) 를 얻는다. git `user.name` / `user.email` 이 설정돼 있는지 확인하고, 없으면 사용자에게 알리고 중단한다.

## Step 3: tester 스폰

tester 하나만 named background subagent 로 띄운다:

- `Agent({name: "tdd-adversary", subagent_type: "tdd-adversary", run_in_background: true, prompt: "작업 디렉터리는 <repo root>. 다음 SendMessage 로 도착할 bootstrap 메시지까지 대기."})`

tester 는 `core/agents/tdd-adversary.md` 의 정의를 그대로 사용한다. implementer 는 스폰하지 않는다 — main 이 그 역할이다.

이후 모든 라운드에서 이 백그라운드 subagent 를 그대로 재사용한다. Step 4 와 Step 5 의 SendMessage 가 누적 컨텍스트 (이전 SHA·no-progress 카운트·치팅 의심) 를 이어간다. 새 `Agent()` 호출 금지.

## Step 4: 첫 신호 송신

tester 에게 다음 한 줄을 정확히 보낸다:

```
bootstrap: spec=<abs spec path> worktree=<repo root> base-sha=<base-sha> — produce first red
```

abs spec path 는 `.agent-memory/tdd-spec/<slug>.md` 의 절대경로. tester 정의가 `worktree=` 키를 작업 디렉터리로 읽는다.

## Step 5: 라운드 루프

`no_progress_count` 를 0 으로 시작. tester 의 각 반환을 받아 처리한다:

- `<sha>: <case>` (새 red 커밋) → `no_progress_count = 0`. main 이 이번 라운드 구현자다:
  1. `git show <sha>` 로 실패 테스트를 읽는다.
  2. 프로덕션 코드를 작성해 통과시킨다. 평소 main 세션 흐름·inlay·외부 규칙을 그대로 따른다.
  3. 전체 테스트 스위트를 실제로 실행해 **전부 green 인지 확인한다** (가정 금지).
  4. 커밋한다. 중간 커밋 개수·메시지 형식은 자유.
  5. `git rev-parse HEAD` 로 최종 green 커밋 SHA 를 얻어 `SendMessage(to: "tdd-adversary", message: "last-impl-sha=<sha>")`.
- `no-progress: <reason>` → `no_progress_count += 1`. `>= 2` 이면 Step 6 으로 (`converged: 2 consecutive no-progress`). 미만이면 `SendMessage(to: "tdd-adversary", message: "retry: try a new region or angle")`.
- `escalation: <issue>` → 사용자에게 그대로 전달하고 결정을 기다린다. 사용자가 계속 진행을 선택하면 그 결정을 `retry: <사용자 지시>` 로 tester 에게 보내 Step 5 로 복귀한다.

사용자 중단 신호가 오면 즉시 Step 6.

## Step 6: 종료 처리

수렴 또는 사용자 중단 시:
- `git log --oneline` 출력으로 라운드 요약을 보여준다.

## 가드레일 (코어 — 보존된 tester 가 의존하므로 불변)

- tester 의 테스트 파일을 수정·삭제하지 않는다. main 은 프로덕션 코드만 건드린다. 테스트를 약화시키면 tester 가 무의미해진다.
- tester 에게 턴을 넘기기 전, HEAD 는 **전체 스위트를 실제 실행해 green 인** 커밋이다.
- 스펙은 `.agent-memory/tdd-spec/<slug>.md` 에 두고 tester 와 공유한다.
- 종료는 main 이 tester 의 연속 no-progress 를 보고 결정한다.

## 권고 (느슨 — 강제 아님)

- 테스트 입력값 하드코딩·룩업 미러링 같은 꼼수는 피한다. 어차피 tester 가 다음 라운드에 반례로 잡아 영구 테스트화한다.

</pairtdd_instruction>

Task: $ARGUMENTS

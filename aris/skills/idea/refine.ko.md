# Refine: 거친 접근에서 리뷰를 거친 제안서까지

눈에 보이는 문제와 흐릿한 기술 경로를, 구현할 수 있을 만큼 구체적이고 논문 하나가 될 만큼 초점이 맞은 제안서로 바꾼다. 각 라운드는 리뷰어 한 번과 수정 한 번으로 이뤄지고, 라운드를 더 돌릴지는 사용자가 정한다.

## 목차

- 기본값
- 출력 구조
- Step 0: 문제 앵커 고정
- Step 1: 초기 제안서 작성
- Step 2: 리뷰어 라운드
- Step 3: 수정
- Step 4: 라운드 게이트
- Step 5: 마무리

## 기본값

- **OUTPUT_DIR**: `refine-logs/`. 없으면 만든다.
- **MAX_LOCAL_PAPERS**: 15.
- **MAX_PRIMARY_CLAIMS**: 2. 주된 주장 하나와 보조 주장 최대 하나.
- **MAX_CORE_EXPERIMENTS**: 제안서 안의 검증 블록 3개. 전체 로드맵은 `plan.md` 의 몫이다.
- **CONVERSATION**: `idea-refine`.

## 출력 구조

```text
refine-logs/
  round-0-proposal.md
  round-1-review.md
  round-1-revision.md
  round-2-review.md
  ...
  FINAL_PROPOSAL.md
```

모든 `round-N-revision.md` 는 diff 가 아니라 제안서 전문을 담는다.

## Step 0: 문제 앵커 고정

무엇을 제안하기 전에 앵커부터 쓴다. 앵커는 모든 제안서와 모든 수정본에 그대로 복사된다.

- **결론적 문제**: 반드시 풀어야 하는 기술적 문제
- **반드시 풀어야 할 병목**: 현재 방법이 가진, 용납할 수 없는 구체적 약점
- **비목표**: 이 프로젝트가 명시적으로 다루지 않는 것
- **제약**: 연산, 데이터, 시간, 도구, 발표처, 배포
- **성공 조건**: 사용자가 문제가 해결됐다고 말하게 만들 증거

풀고 있는 문제 자체를 바꾸는 리뷰어 피드백은 드리프트다. 조용히 받아들이지 않고 기록한 뒤 반박한다.

## Step 1: 초기 제안서 작성

### 1.1 근거 확보

`papers/` 와 `literature/` 의 관련 부분을 MAX_LOCAL_PAPERS 개까지 읽는다. 로컬 자료가 부족하면 해당 분야의 최근 연구를 검색한다. 현재 방법이 어떤 메커니즘을 쓰는지, 이 문제에서 정확히 어디서 실패하는지, 최근 기법이나 표현 중 재사용할 수 있는 것이 무엇인지에 답한다. 초록만 보지 말고 방법 절과 실패 양상을 읽는다.

### 1.2 기술적 간극

1. **현재 파이프라인의 실패 지점**: 베이스라인이 무너지는 곳
2. **단순한 처방이 부족한 이유**: 데이터 추가, 용량 확대, 모듈 추가
3. **충분한 최소 개입**: 병목을 고칠 법한 가장 작은 메커니즘
4. **현대적 대안**: 병목에 더 잘 맞는다면, 이 분야의 최신 기법을 쓰는 경로
5. **핵심 기술 주장**: 심사를 견딜 수 있는 메커니즘 주장
6. **필요한 증거**: 그 주장에 대한 최소한의 증명

### 1.3 경로 선택

경로 두 개가 모두 그럴듯하면, 최소 경로와 현대적 경로를 다음 기준으로 비교한다: 제약 아래에서 어느 쪽이 강한 논문이 될 가능성이 큰지, 어느 쪽의 신규성 서사가 더 깔끔한지, 어느 쪽이 기여의 산만화를 피하는지. 둘 다 약하면 합치지 말고 문제를 다시 틀 짓는다.

### 1.4 `refine-logs/round-0-proposal.md` 작성

```markdown
# Research Proposal: [Title]

## Problem Anchor
- Bottom-line problem:
- Must-solve bottleneck:
- Non-goals:
- Constraints:
- Success condition:

## Technical Gap
[Why current methods fail, why bigger systems are not enough, what mechanism is missing]

## Method Thesis
- One-sentence thesis:
- Why this is the smallest adequate intervention:

## Contribution Focus
- Dominant contribution:
- Optional supporting contribution:
- Explicit non-contributions:

## Proposed Method
### Complexity Budget
- Reused components:
- New components:
- Tempting additions intentionally not used:

### System Overview
[Step-by-step pipeline or ASCII graph]

### Core Mechanism
- Input / output:
- Model, algorithm, or policy:
- Objective or signal:
- Why this is the main novelty:

### Optional Supporting Component
- Only if truly necessary:
- Why it does not create contribution sprawl:

### Integration
[Where the new method attaches, what stays fixed, what is new, run-time order]

### Failure Modes and Diagnostics
- [Failure mode]: [how to detect] / [fallback]

### Novelty Argument
[Closest work, exact difference, why this is a mechanism-level contribution rather than a module pile-up]

## Claim-Driven Validation Sketch
### Claim 1: [Main claim]
- Minimal experiment:
- Baselines / ablations:
- Metric:
- Expected evidence:

### Claim 2: [Optional]
...

## Handoff to Plan
- Must-prove claims:
- Must-run ablations:
- Critical datasets / metrics:
- Highest-risk assumptions:

## Compute and Timeline Estimate (in numbers)
- Estimated compute:
- Data cost:
- Timeline:
```

제안서는 "이걸 실제로 어떻게 만들 것인가" 에 답한다. "모듈을 하나 추가한다" 정도로만 서술된 방법은 충분히 구체적이지 않다.

## Step 2: 리뷰어 라운드

아래 프롬프트, 분야와 발표처, 리뷰할 제안서의 절대 경로 (라운드 0 제안서 또는 최신 수정본) 를 담아 `refine-logs/round-N-review-bundle.md` 를 쓴다. 라운드 1 은 대화를 시작하고, 이후 라운드는 그 대화를 이어간다.

```text
codex_agent:                       # round 1
  name: idea-refine
  message: Read <absolute path to refine-logs/round-1-review-bundle.md> and follow all instructions in it.

codex_send:                        # round 2 and later
  name: idea-refine
  message: Read <absolute path to refine-logs/round-N-review-bundle.md> and follow all instructions in it.
```

번들에 넣을 프롬프트:

```text
You are a senior reviewer for <VENUE> in <FIELD>. This is an early-stage, method-first proposal.
Your job is to stress-test whether the method (1) still solves the anchored problem, (2) is concrete enough to implement, (3) is one focused contribution, (4) uses current techniques of the field where they are the natural fit.
Prefer the smallest adequate mechanism. Penalize parallel contributions. Ask for extra experiments only when needed to prove the core claims.
Read the Problem Anchor first. If a fix you suggest would change the problem being solved, label it as drift.

Proposal path (read this file yourself): <absolute path>

Score 1-10 on each: Problem Fidelity, Method Specificity, Contribution Quality, Feasibility, Validation Focus, Venue Readiness. Then an OVERALL score weighted toward the first three.
For each dimension below 7: the specific weakness, a concrete method-level fix, and priority CRITICAL / IMPORTANT / MINOR.
Then: Simplification Opportunities (1-3, or NONE), Drift Warning (NONE or explanation), Verdict READY / REVISE / RETHINK.
READY means overall 9 or more, no drift, one dominant contribution, no obvious bloat. RETHINK means the core mechanism or framing is off.
```

라운드 2 이후에는 지난 리뷰 이후의 주요 변경 목록과, 같은 차원들을 다시 채점하고 앵커가 유지됐는지 밝혀 달라는 요청을 번들에 더한다.

응답을 `refine-logs/round-N-review.md` 에 그대로 저장한다.

## Step 3: 수정

1. 문제 앵커를 그대로 복사한다.
2. 앵커 점검: 원래 병목이 여전히 해결되는지, 어떤 리뷰어 제안이 드리프트를 일으키는지.
3. 단순성 점검: 이제 주된 기여가 무엇인지, 무엇을 빼거나 합칠 수 있는지, 어떤 제안이 불필요한 복잡도를 더하는지.
4. 리뷰어의 지적을 하나씩 처리한다: 타당한 것은 메커니즘을 날카롭게 하거나 단순하게 만들고, 논쟁의 여지가 있는 것은 근거를 밝히며 반영하고, 틀렸거나 드리프트를 일으키거나 과하게 복잡하게 만드는 것은 논문과 앵커에서 나온 증거로 반박한다.

`refine-logs/round-N-revision.md` 를 쓴다:

```markdown
# Round N Revision

## Problem Anchor
[verbatim from round 0]

## Anchor Check
- Original bottleneck:
- Why the revised method still addresses it:
- Reviewer suggestions rejected as drift:

## Simplicity Check
- Dominant contribution after revision:
- Components removed or merged:
- Reviewer suggestions rejected as unnecessary complexity:

## Changes Made
### 1. [section changed]
- Reviewer said:
- Action:
- Reasoning:

## Revised Proposal
[full proposal, same structure as round 0]
```

## Step 4: 라운드 게이트

라운드 요약을 출력하고 멈춘다:

```text
Round N: overall X/10, verdict READY / REVISE / RETHINK, drift: NONE / <summary>
Changed: <1-3 lines>
Rejected: <1-3 lines>
Files: refine-logs/round-N-review.md, refine-logs/round-N-revision.md
Next: another round, or finalize?
```

라운드를 더 돌리면 최신 수정본을 들고 Step 2 로 돌아간다. 마무리하기로 하면 Step 5 로 간다.

## Step 5: 마무리

`refine-logs/FINAL_PROPOSAL.md` 에 최신 제안서 전문만 쓰고 다른 것은 넣지 않는다. 마지막 판정이 READY 가 아니었다면 현재의 최선 버전을 쓰고 남은 약점을 맨 위에 짧은 목록으로 밝힌다.

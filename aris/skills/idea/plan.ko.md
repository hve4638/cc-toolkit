# Plan: 제안서에서 실험 로드맵으로

제안서를 주장, 증거, 실행 순서의 로드맵으로 바꾼다. 모든 실험은 주장 하나를 방어하며, 결과물은 벤치마크 희망 목록이 아니라 압축된 이야기다.

## 목차

- 기본값
- Step 0: 제안서 읽기
- Step 1: 주장 고정
- Step 2: 이야기 짜기
- Step 3: 블록별 명세
- Step 4: 실행 순서
- Step 5: 산출물 쓰기
- 규칙

## 기본값

- **OUTPUT_DIR**: `refine-logs/`.
- **MAX_PRIMARY_CLAIMS**: 2.
- **MAX_CORE_BLOCKS**: 5.
- **MAX_BASELINE_FAMILIES**: 3.
- **DEFAULT_SEEDS**: 분산이 중요하고 예산이 허락하면 3.

## Step 0: 제안서 읽기

`refine-logs/FINAL_PROPOSAL.md` 와 있다면 가장 최근의 `refine-logs/round-N-review.md` 를 읽는다. 없으면 같은 정보를 사용자의 요청에서 가져온다. Problem Anchor, 주된 기여, 선택적인 보조 기여, 리뷰어가 짚은 핵심 우려, 그리고 데이터·연산·일정 제약을 뽑아낸다.

## Step 1: 주장 고정

- **주 주장**: 기제 수준의 주된 기여
- **보조 주장**: 이야기를 곧바로 강하게 만들 때만 둔다
- **배제할 반대 주장**: 예컨대 "이득은 파라미터를 늘린 덕분일 뿐이다" 또는 "이득은 탐색 공간이 커진 덕분일 뿐이다"
- 주장마다 **설득에 필요한 최소 증거**: 까다로운 리뷰어가 봐야 할 것

## Step 2: 이야기 짜기

아래 블록에서 시작해 주장이 필요로 하지 않는 것을 지운다:

1. **주 결과**: 이 방법이 붙잡아 둔 병목을 푸는가?
2. **참신성 분리**: 주된 기여 자체가 효과를 내는가?
3. **단순성 점검**: 최종 방법 대 과하게 쌓은 변형, 또는 논문이 거절한 솔깃한 추가 구성요소
4. **구성요소 필요성**: 한 구성요소가 중심이라면, 고른 구성요소 대 가장 강한 단순 대안
5. **실패 분석**: 이 방법이 여전히 놓치는 것

블록마다 본문, 부록, 잘라내기 중 하나를 배정한다. 약한 베이스라인 여럿보다 강한 베이스라인 한 계열을 택한다.

## Step 3: 블록별 명세

남긴 블록마다 적는다:

- **검증하는 주장**
- **이 블록이 존재하는 이유**
- **데이터셋 / 분할 / 과제** (또는 채널 모델, 시나리오, 파라미터)
- **비교 대상**: 가장 강한 베이스라인, 애블레이션, 변형만
- **지표**: 결정적인 것 먼저, 보조 지표는 그다음
- **설정 세부**: 고정한 부분과 학습한 부분, 주요 하이퍼파라미터, 예산, 시드
- **성공 기준**
- **실패 해석**: 부정적 결과가 무엇을 뜻하는가
- **표 / 그림 목표**

## Step 4: 실행 순서

1. **정상성**: 데이터 파이프라인, 지표 정확성, 빠른 소규모 실행 한 번
2. **베이스라인**: 가장 강한 베이스라인을 재현
3. **주 방법**: 최종 방법을 주 환경에서 실행
4. **판정**: 참신성, 단순성, 필요성을 가르는 결정적 애블레이션
5. **마무리**: 강건성, 정성적 그림, 부록 추가분

마일스톤마다 연산량, 소요 시간, 중단 또는 진행 게이트, 그리고 위험과 그 완화책을 추정한다. 반드시 돌릴 것과 있으면 좋은 것을 나눈다.

## Step 5: 산출물 쓰기

`refine-logs/EXPERIMENT_PLAN.md`:

```markdown
# Experiment Plan

**Problem**: [problem]
**Method Thesis**: [one sentence]
**Date**: [today]

## Claim Map
| Claim | Why It Matters | Minimum Convincing Evidence | Linked Blocks |
|-------|----------------|-----------------------------|---------------|
| C1    | ...            | ...                         | B1, B2        |

## Paper Storyline
- Main paper must prove:
- Appendix can support:
- Experiments intentionally cut:

## Experiment Blocks

### Block 1: [Name]
- Claim tested:
- Why this block exists:
- Dataset / split / task:
- Compared systems:
- Metrics:
- Setup details:
- Success criterion:
- Failure interpretation:
- Table / figure target:
- Priority: MUST-RUN / NICE-TO-HAVE

### Block 2: [Name]
...

## Run Order and Milestones
| Milestone | Goal | Runs | Decision Gate | Cost | Risk |
|-----------|------|------|---------------|------|------|
| M0        | ...  | ...  | ...           | ...  | ...  |

## Compute and Data Budget
- Total estimated compute:
- Data preparation needs:
- Biggest bottleneck:

## Risks and Mitigations
- [Risk]: [Mitigation]

## Final Checklist
- [ ] Main paper tables are covered
- [ ] Novelty is isolated
- [ ] Simplicity is defended
- [ ] Nice-to-have runs are separated from must-run runs
```

`refine-logs/EXPERIMENT_TRACKER.md`:

```markdown
# Experiment Tracker

| Run ID | Milestone | Purpose | System / Variant | Split | Metrics | Priority | Status | Notes |
|--------|-----------|---------|------------------|-------|---------|----------|--------|-------|
| R001   | M0        | sanity  | ...              | ...   | ...     | MUST     | TODO   | ...   |
```

그다음 반드시 돌릴 블록, 가장 위험한 가정, 먼저 띄울 실행 세 개, 그리고 두 파일 경로를 출력한다.

## 규칙

- 계획은 기대하는 증거를 적는 것이다. 결과는 여기에 적지 않는다.

# Create: 방향에서 순위 매긴 아이디어로

넓은 연구 방향을 구체적이고 순위가 매겨진 아이디어 후보로 바꾼다. 방향은 사용자가 주고, 아이디어를 만드는 것은 이 모드의 일이다.

## 목차

- 기본값
- Step 1: 지형 조사
- Step 2: 구조적 공백
- Step 3: 리뷰어와 브레인스토밍
- Step 4: 기계적 정리
- Step 5: 리뷰어의 순위 매기기
- Step 6: 상위 선정 아이디어의 참신성 점검
- Step 7: 보고서
- 규칙

## 기본값

- **OUTPUT_DIR**: `idea-stage/`. 없으면 만든다.
- **CANDIDATES**: 브레인스토밍에서 8개에서 12개.
- **TOP_PICKS**: 순위를 매긴 뒤 2개에서 3개.
- **RESOURCES**: 사용자가 밝힌 연산 자원과 데이터. 요청에 없으면 Step 3 전에 묻는다.

## Step 1: 지형 조사

1. `papers/` 와 `literature/` 에 있는 관련 PDF 의 처음 3쪽을 읽는다.
2. WebSearch 로 최근 문헌을 찾는다. 해당 분야 상위 학회의 최근 2년치와 최근 6개월치 프리프린트를 본다. 질의 형태를 최소 5가지로 바꿔 던지고 상위 10~15편의 초록을 읽는다.
3. 논문을 하위 방향별로 묶는다. 무엇이 시도됐는지, "Future Work" 절에 반복해 나오는 한계가 무엇인지, 둘 이상의 논문이 함께 지목한 미해결 문제가 무엇인지 적는다.

## Step 2: 구조적 공백

다섯 렌즈를 순서대로 훑으며 해당하는 공백이 있으면 렌즈마다 최소 하나씩 적는다:

- **method-transfer**: 환경 A 에서는 되는데 환경 B 에서는 시도된 적이 없다
- **contradiction**: 논문들 사이에서 결과가 어긋난다
- **untested-assumption**: 모두가 전제하지만 아무도 측정하지 않았다
- **scaling-regime**: 아무도 들여다보지 않은 영역
- **diagnostic**: 아무도 던지지 않은 질문

방향이 요구하면 그 분야 전용 렌즈를 더한다.

## Step 3: 리뷰어와 브레인스토밍

`idea-stage/brainstorm_bundle.md` 에 방향, 지형 지도, 공백, 분야, 그리고 아래 프롬프트를 적는다. 그다음 대화를 시작한다:

```text
codex_agent:
  name: idea-brainstorm
  message: Read <absolute path to idea-stage/brainstorm_bundle.md> and follow all instructions in it.
```

번들에 넣을 프롬프트:

```text
You are a senior researcher in <FIELD> brainstorming research ideas.

Research direction: <direction>
Landscape: <landscape map>
Gaps: <gap list>
Resources: <compute, data, time>

Generate 8-12 concrete research ideas. For each idea give:
1. One-sentence summary
2. Core hypothesis (what you expect to find and why)
3. Minimum viable experiment (the cheapest test)
4. Contribution type: empirical finding / new method / theoretical result / diagnostic
5. Risk: LOW / MEDIUM / HIGH
6. Effort: days / weeks / months

Prioritize ideas that are testable with the stated resources, likely to give a clear positive or negative result, and simple at the core: one mechanism a colleague could restate after hearing it once.
"Apply X to Y" counts when the application reveals something non-obvious. A direct attack on a central problem counts when nobody has executed it well; proximity to strong work means the problem matters, not that it is taken.
Generate first, filter later. A bold idea with a named risk beats a hedged, complicated one.
```

응답은 `idea-stage/brainstorm_response.md` 에 그대로 저장한다.

## Step 4: 기계적 정리

1. 가설이 사실상 같은 아이디어를 묶고 묶음마다 하나만 남긴다.
2. 아이디어를 버리는 근거는 자원 사실뿐이다. 밝힌 예산을 넘는 연산량이거나, 구할 수 없음이 확인된 데이터셋인 경우다. 이유를 기록한다.
3. 남은 아이디어마다 메모 셋을 붙인다: `prior_work` (링크를 포함한 표적 검색 2~3건), `so_what` (결과가 어느 쪽으로 나오든 왜 의미가 있는지), `effort_note`.

품질, 참신성, 임팩트는 여기가 아니라 Step 5 에서 판정한다.

## Step 5: 리뷰어의 순위 매기기

`idea-stage/triage_bundle.md` 에 주석이 달린 후보 전체와 아래 프롬프트를 적고 대화를 이어간다:

```text
codex_send:
  name: idea-brainstorm
  message: Read <absolute path to idea-stage/triage_bundle.md> and follow all instructions in it.
```

번들에 넣을 프롬프트:

```text
Here is the full annotated candidate set (deduplicated, within budget).
<candidates with prior_work / so_what / effort_note>

For each idea make the strongest case both ways:
- Best case for it: what would make this the paper people cite?
- Strongest objection a reviewer would raise
- Most likely failure mode
- Is the prior_work note a real novelty problem, or differentiable?

Rank all ideas by expected information and upside within the stated resources. Name the 2-3 you would actually work on and why.
Rank; do not rewrite. An objection is answered or recorded as a named risk, never absorbed by adding a module or a qualifier. If the top set is all LOW risk, name the high-upside idea that most deserves a slot and what result would convince you.
```

응답은 `idea-stage/triage_response.md` 에 그대로 저장한다. 상위 선정에 들지 못한 아이디어는 보고서에 후보로 남는다.

## Step 6: 상위 선정 아이디어의 참신성 점검

상위 선정 아이디어마다 `novelty.md` 를 돌린다. 그 판정과 가장 가까운 선행 연구를 보고서로 옮긴다.

## Step 7: 보고서

`idea-stage/IDEA_REPORT.md` 를 쓴다. 추천 아이디어마다 방법을 가설이나 점수보다 먼저, 쉬운 말로 적는다.

```markdown
# Research Idea Report

**Direction**: [direction]
**Field / venue**: [field, target venue]
**Generated**: [date]
**Ideas**: X generated, Y within budget, Z recommended

## Landscape Summary
[3-5 paragraphs]

## Recommended Ideas (ranked)

### Idea 1: [title]
- **Method (what we actually do)**: [2-4 concrete steps]
- **Hypothesis**: [one sentence]
- **Minimum experiment**: [concrete description]
- **Expected outcome**: [what success and failure look like]
- **Novelty**: [verdict from novelty.md] - closest work: [paper]
- **Feasibility**: [compute, data, implementation]
- **Risk**: LOW / MEDIUM / HIGH
- **Contribution type**: empirical / method / theory / diagnostic
- **Reviewer's strongest objection**: [from the ranking]
- **Why this one**: [1-2 sentences]

### Idea 2: [title]
...

## Other Candidates
| Idea | Rank | Reviewer's note |
|------|------|-----------------|

## Excluded on Resources
| Idea | Reason |
|------|--------|

## Suggested Order
1. [idea and why first]
2. [backup]
```

그다음 짧은 요약을 출력한다. 상위 선정 아이디어를 한 줄씩, 그리고 보고서 경로를 적는다.

## 규칙

- 방향은 사용자의 것이다. 아이디어는 이 모드의 몫이다.
- 넓은 방향 (예컨대 하위 분야 전체) 은 브레인스토밍 전에 Step 1 에서 구체적인 틀 2~3개로 좁힌다.
- 제외한 아이디어는 이유와 함께 보고서에 남는다.

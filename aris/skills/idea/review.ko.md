# Review: 외부 비판 리뷰

제안서, 초고, 결과 묶음에 대한 비판적 리뷰를 외부 리뷰어에게서 라운드 단위로 받는다. 각 라운드는 사용자가 어떻게 대응할지 정하는 것으로 끝난다.

## 기본값

- **BRIEF**: 프로젝트 루트의 `RESEARCH_REVIEW_REQUEST.md`. 이후 라운드는 `RESEARCH_REVIEW_ROUND_N.md` 를 쓴다.
- **OUTPUT**: 프로젝트 루트의 `RESEARCH_REVIEW.md`.
- **CONVERSATION**: `idea-review`.

## Step 1: 맥락 수집

서사 문서 (예: STORY.md, README.md, 초고), 발견 사항과 실험 이력에 대한 노트, 리뷰어가 들여다봐야 할 산출물을 읽는다. 핵심 주장, 방법론, 주요 결과, 이미 알고 있는 약점을 짚어낸다.

## Step 2: 라운드 1

전체 맥락, 구체적인 질문, 주요 산출물과 원시 결과의 경로를 담아 브리프를 쓴다. 알고 있는 약점을 밝힌다. 숨기면 리뷰가 약해진다. 그다음:

```text
codex_agent:
  name: idea-review
  message: |
    Read the review brief at <absolute path to RESEARCH_REVIEW_REQUEST.md>.
    Author notes are not evidence beyond the files they cite; verify the referenced artifacts before judging.
    Act as a senior reviewer for <VENUE> in <FIELD>. Start from the assumption that the work is broken somewhere and find where. Identify:
    1. Logical gaps or unjustified claims
    2. Missing experiments that would strengthen the story
    3. Narrative weaknesses
    4. Whether the contribution is sufficient for the venue
    Say plainly when something is correct. If, after genuinely trying to break it, the work holds up, say so.
```

응답을 `RESEARCH_REVIEW_ROUND_1_RESPONSE.md` 에 그대로 저장한다.

## Step 3: 라운드 게이트

리뷰를 10줄 이내로 요약한다: 심각도별 비판과 실행 가능한 요구 사항. 그런 다음 멈추고, 어떤 지적에 증거로 답할지, 어떤 것을 반박할지, 어떤 후속 질문을 던질지 사용자에게 묻는다. 쓸 만한 후속 질문:

- "X 를 Y 로 다시 틀 지으면 평가가 달라지는가?"
- "우려 Z 를 해소하는 최소 실험은 무엇인가?"
- "연산 단위당 채택 가능성을 가장 크게 올리는 최소 추가 실험 묶음을 설계해 달라."
- "<VENUE> 용 모의 리뷰를 점수와 함께 써 달라."
- "실험 X 와 Y 의 가능한 결과들에 대한 결과-주장 매트릭스를 달라."

## Step 4: 이후 라운드

사용자가 고른 답변, 반증, 후속 질문을 담아 `RESEARCH_REVIEW_ROUND_N.md` 를 쓴 다음:

```text
codex_send:
  name: idea-review
  message: |
    Read the updated brief at <absolute path to RESEARCH_REVIEW_ROUND_N.md>.
    Focus on the unresolved weaknesses and whether the responses actually resolve them.
```

응답을 그대로 저장하고 Step 3 으로 돌아간다. 양측이 핵심 주장과 그에 필요한 증거에 합의하고, 구체적인 실험 목록이 나오고, 서사 구조가 정해지면 라운드는 수렴한 것이다.

## Step 5: 문서화

대화 없이도 읽히도록 `RESEARCH_REVIEW.md` 를 쓴다:

- 라운드별 비판과 답변 요약
- 주장, 서사, 실험에 대한 최종 합의
- 주장 매트릭스: 가능한 결과마다 어떤 주장이 허용되는지
- 연산 추정치를 붙인 우선순위 할 일 목록
- 논문 개요 (논의했다면)

## 규칙

- 리뷰어에게 던지는 모든 요청은 실행 가능한 것을 묻는다: 실험, 개요, 매트릭스.

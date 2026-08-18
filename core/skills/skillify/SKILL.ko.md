---
name: skillify
disable-model-invocation: true
argument-hint: "[선택사항: 만들 스킬의 짧은 설명 또는 슬러그]"
---

<skillify_instruction>
# skillify

[writing-great-skill](../writing-great-skill/SKILL.ko.md) 원칙을 따라 새 스킬을 작성하는 절차.

원칙 (description·정보 위계·가지치기·로컬 컨벤션) 자체는 [writing-great-skill](../writing-great-skill/SKILL.ko.md) 을 참조한다. 이 스킬은 *작성 절차* 만 담는다.

---

## 입력 모드

- 인자 또는 기존 세션 맥락이 충분 → 인터뷰 생략, Step 2 부터
- 부족 → Step 1 인터뷰

---

## Step 1. 인터뷰 (필요 시)

한 번에 묶어 5개를 받는다 (분할 질문 금지):

1. 무엇을 하는 스킬인가 (한 문장)
2. 언제 호출되어야 하는가 — 트리거 맥락
3. 어떤 실패·비효율·혼동을 막는가 (WHY)
4. 저장 위치 — 프로젝트 로컬 / 글로벌 / 플러그인
5. 비슷한 트리거 카테고리의 기존 스킬이 있는가

---

## Step 2. 이름 / 슬러그 결정

사용자와 합의한다. 이름은 소문자 영문이고, 그 스킬의 **leading word** 다 — 사용자가 타이핑하는 토큰, description 이 앞세우는 토큰, 본문이 반복하며 행동을 고정하는 토큰이 전부 이 하나다.

- 모델이 이미 갖고 있는 낱말을 골라 그 prior 를 동원한다 — `stage`, `interview`, `handoff`, `prototype`
- 맞는 낱말이 없으면 한 개념으로 읽히는 합성어를 짓는다 — `bughunt`, `memhome`, `pairtdd`

무엇이 강한 leading word 이고 어떻게 찾는지는 [writing-great-skill](../writing-great-skill/SKILL.ko.md) 의 Leading words 절.

---

## Step 3. SKILL.ko.md 작성

[writing-great-skill](../writing-great-skill/SKILL.ko.md) 의 모든 절을 적용해 한국어로 채워 `<location>/<slug>/SKILL.ko.md` 에 저장.

호출 방식은 여기서 정한다: 기본은 명시 호출 전용이고, [writing-great-skill](../writing-great-skill/SKILL.ko.md) 의 Invocation 절이 요구하는 경우에만 모델 발동으로 한다.

절차가 결정적이면 — 파일 조작, 설정 쓰기, 검증 가능한 상태 전이 — 본문 산문 대신 [skillify-stepform](../skillify-stepform/SKILL.ko.md) 의 스텝 스크립트로 짓는다.

---

## Step 4. 검토

사용자에게 본문을 보여 확인 받는다. 수정 요청이 있으면 SKILL.ko.md 만 갱신한다 (영문은 아직 만들지 않는다).

---

## Step 5. 영문 번역

확정되면 `SKILL.md` 를 일괄 영문 번역으로 채운다.

- description 은 매칭 신뢰성을 위해 영어로 정확히 작성한다
- body 는 한국어 의미 그대로 옮긴다 (압축·의역 금지)

---

## Step 6. 보고

슬러그, 위치, description 한 줄 요약을 사용자에게 보고한다.

---

## 빈 케이스 처리

이미 같은 트리거 카테고리의 스킬이 있으면, 새 스킬을 만들지 않고 기존 스킬에 룰을 추가하는 방향으로 권한다 (Step 1 의 5번 질문에서 확인).

---

## 호출 라우팅

- 사용자가 *회고·시행착오 결정화* 를 원하면 reflect 로 라우팅한다 (이 스킬 아님).
- 그 외 신규 스킬 작성은 이 스킬로 처리한다.

</skillify_instruction>

$ARGUMENTS

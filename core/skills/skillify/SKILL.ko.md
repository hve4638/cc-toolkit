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

한 번에 묶어 6개를 받는다 (분할 질문 금지):

1. 무엇을 하는 스킬인가 (한 문장)
2. 언제 호출되어야 하는가 — 트리거 맥락
3. 호출 모드 — 명시 호출 전용 / 자동 트리거 / 둘 다
4. 어떤 실패·비효율·혼동을 막는가 (WHY)
5. 저장 위치 — 프로젝트 로컬 / 글로벌 / 플러그인 / 공용 (`common/skills/`)
6. 비슷한 트리거 카테고리의 기존 스킬이 있는가

---

## Step 2. 이름 / 슬러그 결정

사용자와 합의한다.

- kebab-case, 30자 이내, 영문
- 가족이 있으면 prefix (`reflect-*`, `rule-*`)
- 좋음: `git-rebase-no-edit-flag`, `man-banaction`
- 나쁨: `general-tips`, `mistakes`, `learning-20260430`

---

## Step 3. SKILL.ko.md 작성

[writing-great-skill](../writing-great-skill/SKILL.ko.md) 의 모든 절을 적용해 한국어로 채워 `<location>/<slug>/SKILL.ko.md` 에 저장.

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

이미 같은 트리거 카테고리의 스킬이 있으면, 새 스킬을 만들지 않고 기존 스킬에 룰을 추가하는 방향으로 권한다 (Step 1 의 6번 질문에서 확인).

---

## 무거운 케이스

스킬이 다음에 해당하면 plugin `skill-creator` 호출을 권한다:

- 다중 출력 + 변동성 (출력 형태가 입력에 따라 크게 달라짐)
- 평가 자동화 필요 (eval/benchmark)
- 외부 도구·환경과 깊이 결합

---

## 호출 라우팅

- 사용자가 *회고·시행착오 결정화* 를 원하면 reflect 로 라우팅한다 (이 스킬 아님).
- 사용자가 *eval/benchmark 포함 무거운 워크플로우* 를 원하면 plugin `skill-creator` 로 라우팅한다.
- 그 외 신규 스킬 작성은 이 스킬로 처리한다.

</skillify_instruction>

$ARGUMENTS

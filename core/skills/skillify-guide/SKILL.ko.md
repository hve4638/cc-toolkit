---
name: skillify-guide
description: "스킬 작성·리뷰 컨벤션을 정의한다 — frontmatter 모드 (auto-trigger, disable-model-invocation), description 작성법, body 디시플린. 새 SKILL.md / SKILL.ko.md 를 작성하거나 기존 스킬을 리뷰·리팩토링할 때 사용한다."
---

<skillify_guide_instruction>
# skillify-guide

description 과 body 모두 3인칭·명령형으로 쓴다. 1·2인칭 (`I`/`너`/`네`) 금지: description 에서는 매칭 신뢰성에 직결되고, body 에서는 어떤 모델이 실행하든 지시를 비인격적으로 유지한다.

## Frontmatter

필수: `name`, `description` (작성 룰은 §Description 참조). `description` 은 1024 chars 이하 + XML 태그 금지.

선택:
- `disable-model-invocation: true` — 명시 호출 (`/<slug>`) 전용. 생략 시 description 매칭 auto-trigger.
- `argument-hint: "[설명]"` — 호출 시 인자를 받을 의도.

---

## Description

[Anthropic 공식 가이드](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) 기준.

1. `Length` — 1024 chars 이하 (frontmatter 검증 한도). 공식 예시 평균 ~22 words / ~145 chars. 짧을수록 좋음.
2. `What + When 구조` — 스킬이 *무엇을 하는지* + *언제 사용하는지* 두 부분. 공식 패턴: `"Generate X by Y. Use when ..."`.
3. `Key terms 포함` — 트리거가 될 도구명·확장자·명령어·도메인 용어를 *구체적으로* 명시. 추상화로 일반화하지 않는다.
4. `Specificity` — under/over-trigger 둘 다 실패. 트리거 맥락이 모호하면 매칭 신뢰성↓.

### 강한 금지

- 모호한 description ("도움이 됨", "처리한다", "Helps with documents")
- description 에 행동 룰 임베드 (body 의 몫)
- time-sensitive 정보 ("2025년 8월 이후 ...")

### description vs body 분담

- description = 디스커버리 진입로 (what + when)
- body = 호출 후 행동

description 에 룰까지 포함하지 않는다.

### 예시

❌ 1·2인칭 (디스커버리 실패):

```
"I can help you process Excel files and create pivot tables."
```

❌ 모호 (트리거 약함):

```
"Helps with documents."
```

❌ 룰 임베드 (body 무의미):

```
"Use this skill when writing git rebase commands. The --no-edit flag is invalid — omit it."
```

⭕ what + when (공식 패턴):

```
"Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes."
```

---

## Body

### 본문에는 지시만

본문은 *지시* 와 *지시의 대상* (산출물·입력·작동 객체) 만 담는다. 다음은 본문에 포함하지 않는다:

- 스킬 자체에 대한 메타 (audience·전제 환경·중요도)
- 불릿 뒤 `—` 으로 붙는 이유 부연
- 인접 도구 분류표
- 명령형 동사 없는 명사구 나열

유형:

- 가드레일형 (행동 룰): `## Rule` + 선택적 `## Not a violation`
- 워크플로우형 (다단계 절차): `### Step 1...N`
- 메타형 (skill of skills, e.g. reflect): 워크플로우 + 원칙 + 경계 조합
- 참조형 (지식 저장): `## 분류` / `## 항목` — 룰보다 사실 위주

필요 시 추가:
- `## Reason` — 트레이드오프 또는 환경 전제
- `## 경계` — 인접 스킬과의 차이 (혼동 방지)

### 결정론 vs 판단 분리

본문에는 *판단이 필요한 부분* 만 담는다. *결정론적* 단계 (계산·고정 변환·정해진 절차) 는 분리:

- 코딩 스킬 → `scripts/<name>.{sh,mjs,py}` 로 빼고 본문에서 호출 지시
- 매뉴얼·문서 스킬 → `assets/<name>.md` 같은 고정 템플릿으로 빼고 본문에서 참조 지시

### 분량 / 분리

- SKILL.md 본문은 **500 라인 이내** (Anthropic 토큰 예산 권장).
- 초과하거나 카테고리가 명확히 분리되면 별도 파일로 빼고 SKILL.md 는 진입점 역할 (progressive disclosure).
- 분리한 파일 참조는 SKILL.md → 자식 **1단계만**. 손주까지 가면 Claude 가 부분 read 만 함.
- 100 라인 넘는 참조 파일은 상단에 목차 둔다.

### 본문 디시플린

- bullet 시작 단어에는 `**bold**` 를 사용하지 않는다
- 행동을 바꾸는 핵심 룰에만 bold 를 제한적으로 사용한다
- 행동 처방 ("X 를 하지 마라") 을 구조적 가드레일 ("X 를 했다면 명시한다") 로 우회 표현할 수 있으면 가드레일 쪽으로 작성한다.
- 파일 경로는 슬래시 (`/`) 만 사용. 백슬래시 (`\`) 금지.
- 같은 개념은 한 단어로 통일 (`field` 만 쓰고 `box`/`element` 안 섞기).

</skillify_guide_instruction>

$ARGUMENTS

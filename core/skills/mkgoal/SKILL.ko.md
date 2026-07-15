---
name: mkgoal
description: 작업 설명으로 바로 붙여넣을 수 있는 /goal 프롬프트(Goal/Context/Constraints/Done When)를 작성한다. 조건에 넣는 검증 명령은 모두 repo에서 실측한다. 사용자가 goal 조건 작성을 요청하거나 /goal로 작업을 끝까지 돌리려 할 때 사용한다.
disable-model-invocation: true
argument-hint: "[작업·목표 설명]"
---

<mkgoal_instruction>
# mkgoal

주어진 인자를 완성된 `/goal` 프롬프트로 바꿔 채팅에만 출력한다. `/goal` 실행은 사용자의 몫이다. 모델은 호출할 수 없다.

인자가 비어 있으면 현재 대화에서 작업을 도출한다.

## Prompt structure

라벨 붙은 네 섹션을 순서대로:

- `Goal:` — 구체적 목표. 측정 가능한 종료 상태 하나에 고정한다.
- `Context:` — 작업이 출발하는 파일과 디렉터리.
- `Constraints:` — 도달 과정에서 지켜야 할 아키텍처 규칙과 기술 제약. 예: "다른 테스트 파일은 수정하지 않는다".
- `Done When:` — 테스트 통과 조건을 포함한 완료 판단 기준. 각 기준마다 그것을 증명하는 정확한 명령과 기대 결과를 적는다. 끝에 작업 크기에 맞춘 상한을 붙인다. 예: `or stop after 20 turns`. 사용자가 무제한을 명시할 때만 생략한다.

## Prompt rules

- Done When의 모든 기준은 Claude 자신의 출력이 증명할 수 있는 것으로 쓴다 — 명령 출력, exit code, 파일 목록. 사람의 관찰("로그가 흐르는 것을 볼 수 있다")로 쓰지 않는다. 매 턴 뒤 goal을 판정하는 평가자는 대화만 보는 작은 모델이며, 프롬프트 텍스트 전체를 저울에 올린다.
- 프롬프트를 첫 턴을 시작하는 지시문으로 쓴다: 새 턴이 이 텍스트 하나만으로 시작될 수 있어야 한다.
- 프롬프트 전체를 4,000자 미만으로, Context는 간결하게 유지한다.

## Workflow

### Step 1 — 종료 상태 고정

작업에서 측정 가능한 종료 상태 하나를 추출한다: 테스트 결과, 빌드 exit code, 파일 개수, 빈 큐, 깨끗한 git status. 검증 가능한 종료 상태가 없으면 산출 전에 표적 질문 1~2개를 던진다. 답 없이 산출할 때는 세운 가정을 각각 밝힌다.

### Step 2 — 검증 명령의 repo 실측

프롬프트에 넣는 모든 명령이 실존하는지 확인한다: package.json scripts, Makefile, CI 설정, 또는 그 프로젝트의 상응물을 읽는다. 명령은 실행되는 그대로 적는다 (`pnpm test`, "테스트"가 아니라). 종료 상태를 증명할 기존 명령이 없으면, 관찰 가능한 상태(exit code, 파일 개수, `git status` 출력)로 바꾸거나 검증 수단을 만드는 것 자체를 목표의 첫 기준으로 넣는다.

### Step 3 — 프롬프트 조립

Prompt structure대로 네 섹션을 채운다: Step 1의 종료 상태는 Goal에, Step 2의 실측한 명령은 Done When에 들어간다.

## Output

- 완성된 프롬프트를 `/goal `로 시작하는 펜스 블록 하나로, 붙여넣기 가능한 형태로.
- 세운 가정과, 붙여넣기 전에 사용자가 확인할 것을 적은 짧은 노트.
</mkgoal_instruction>

Task: $ARGUMENTS

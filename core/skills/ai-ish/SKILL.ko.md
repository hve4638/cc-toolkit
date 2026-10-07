---
name: ai-ish
description: "만든 결과물에서 AI가 만든 티를 점검하고 고친다"
disable-model-invocation: true
---

<ai-ish>
결과물에서 AI 티를 점검하고 고친다. AI 티는 결정이 있어야 할 자리에 기본값이 놓인 것이다. 이 제품에 맞는 이유를 댈 수 없는 요소, 값, 문구가 여기에 해당한다.

점검 대상은 사용자가 명령과 함께 준 파일이나 초점이다. 없으면 이 대화에서 만든 결과물이 대상이다.

## 점검 목록

점검 목록 단계 전에 대상의 종류에 맞는 목록을 읽는다:

- 프론트엔드 (페이지, 컴포넌트, 대시보드, UI 문구) → [FRONTEND.ko.md](FRONTEND.ko.md)

맞는 목록이 없으면 그렇다고 밝히고 멈춘다.

## 고치는 범위

- 바로 고친다: 기존 디자인 안에서 고칠 수 있고 기능을 바꾸지 않는 티.
- 먼저 묻는다: 기능, 컨트롤, 뷰를 더하거나 빼는 것, 그리고 점검 목록이 취향 문제로 표시한 모든 항목.

## 단계

1. 점검 목록 단계. 후보마다 이 제품에 그것이 있는 이유를 적는다. 이유가 없는 후보가 티다. 각 티를 `file:line` 이나 인용한 문구와 함께 기록한다. 고치기는 3단계에서 한다. 점검 목록의 모든 절을 대상의 모든 파일에 적용하면 끝난다.
2. 사용자 단계. 아래 메시지를 `codex_agent` 로 GPT 에게 보낸다. 제품과 그 사용자는 대화에서 채우고, 대상 경로를 채운다. 실행 중인 URL 이나 스크린샷 경로가 있으면 더한다. 메시지에는 채운 템플릿만 담는다.

   ```
   You are a user of <product>: <who uses it and for what>.
   Walk through <paths, URL, screenshots> as that user. Read the code to see what each screen shows and does.
   For every feature, control, panel, and piece of explanatory text, ask: as this user, should this be here?
   Report in this form:
   - Does not belong: <item> (<file:line>): <why, from the user's side>
   - Missing: <what this user came to this screen to do or see, and cannot find>
   Judge only. Leave every file unchanged.
   ```

   `codex_agent` 를 쓸 수 없거나 실패하면 같은 단계를 이 세션에서 실행하고, Not checked 에 `user pass ran without GPT (<reason>)` 로 기록한다. 각 항목을 위의 고치는 범위에 따라 바로 고칠 것과 먼저 물을 것으로 나누고, "Does not belong" 항목 중 사용자가 이 대화에서 요청한 것에는 그렇다고 표시한다.
3. 바로 고칠 티를 모두 고치고, 점검 목록의 수정 후 확인을 실행한다. 두 단계에서 나온 티가 모두 고쳐졌거나 사용자 결정 목록에 올라 있고, 수정 후 확인을 실행했거나 Not checked 에 기록했으면 끝난다.
4. 아래 형식으로 보고한다. 줄 번호는 고치기 전 파일 기준이다.

   ```
   ## Fixed
   - <tell>: <file:line> → <change>

   ## Needs your decision
   - <tell or user-pass item>: <evidence> → <proposal>

   ## Not checked
   - <part of the target or check that did not run>
   ```
</ai-ish>

$ARGUMENTS

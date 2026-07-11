---
name: issue-report
description: "이슈 리포트 — 새 브랜치의 zero-context Claude 세션이 그대로 실행할 수 있는 자기완결 작업 지시서 — 를 작성한다. 사용자가 현재 세션의 분석 결과를 다른 브랜치·세션용 이슈 리포트로 증류하려 할 때 사용한다."
argument-hint: "[이슈 주제]"
---

<issue_report_instruction>
# issue-report

현재 세션이 파악한 하나의 이슈를 작업 지시서로 증류한다. 산출물은 새 브랜치의 zero-context Claude 세션이 읽고 바로 착수할 수 있는 자기완결 리포트 하나다.

## 워크플로우

### 1. 범위

이슈 주제를 사용자 요청에서 잡고 그 이슈만 다룬다. 내용은 현재 세션이 이미 확보한 것에서 끌어오고, 코드베이스 탐색은 file:line 근거의 검증·보충 용도로만 한다.

### 2. 저장 위치

사용자가 지정한 경로를 쓴다. 없으면 프로젝트가 기획 문서를 두는 곳(기존 `docs/todo/`, `_docs/` 등)에 두고, 그런 위치도 없으면 `docs/issues/<slug>.md`를 쓴다. 선택한 경로는 보고 시 명시한다.

### 3. 작성

`assets/template.md`의 섹션 골격을 따른다. 대화 언어로 쓰고 제목도 그에 맞게 번역한다. 날짜는 `date +%F`로 얻는다.

- 코드 블록은 계약을 명세하거나 변경을 스케치할 때만 넣는다.
- 전체 리포트·기존 분석은 재진술하지 말고 경로로 링크한다.
- References와 Out of scope는 정말 비었을 때만 생략하고, 나머지 섹션은 유지한다.

모든 템플릿 섹션이 채워지거나 위 규칙에 따라 생략되고, 모든 file:line 인용이 현재 코드와 대조 확인되면 리포트 완료다.
</issue_report_instruction>

Task: $ARGUMENTS

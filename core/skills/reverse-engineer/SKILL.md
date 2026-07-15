---
name: reverse-engineer
description: "Analyze an entire codebase and produce a structured report covering architecture, tech stack, and data flow. Use only when analyzing a whole codebase, not for single-file review or debugging."
disable-model-invocation: true
---

<reverse-engineer-instruction>
현재 프로젝트를 분석해서 _report/{date}-project-analysis/ 에 저장해

산출물:
1. INDEX.md — 아래 모든 문서의 허브 (제목 + 한줄 요약 + 링크)
2. overview.md — 프로젝트 지식이 없는 개발자용 30분 오버뷰 (A4 3장 이내)
3. tech-stack.md — 기술 스택, 주요 의존성, 버전 정보
4. directory-structure.md — 디렉토리 트리 + 각 폴더 역할 한줄 설명
5. data-flow.md — 진입점, 요청/데이터 흐름, 라우팅/미들웨어 등 정책적 요소 (Mermaid 다이어그램 포함)
6. core-implementation.md — 핵심 기능 Top 3~5의 세부 구현 메커니즘
7. constraints.md — 알려진 제약사항, 기술 부채, 주의점
8. insights.md — 관찰된 패턴, 개선 가능 영역, 아키텍처적 인사이트

규칙:
- 각 파일은 독립적으로 읽을 수 있게 작성
- 코드 경로는 프로젝트 루트 기준 상대경로
- 추측은 "추정" 표시, 사실만 단정형으로 작성
- 핵심 기능 선정 기준: 코드량, 복잡도, 비즈니스 중요도 종합 판단
</reverse-engineer-instruction>

TASK: $ARGUMENTS

<operating_principles>
- 전문 작업은 가장 적절한 에이전트에게 위임할 것.
- 가정보다 증거를 우선시할 것: 최종 주장을 내기 전에 결과를 검증할 것.
- 품질을 보존하는 한에서 가장 가벼운 경로를 선택할 것.
- SDK/프레임워크/API 를 구현하기 전에 공식 문서를 참조할 것.
</operating_principles>

<delegation_rules>
위임 대상: 다중 파일 변경, 리팩토링, 디버깅, 리뷰, 계획, 리서치, 검증.
직접 수행: 사소한 작업, 작은 명확화, 단일 명령.
코드는 `executor` 로 라우팅 (복잡한 작업은 `model=opus` 사용). SDK 사용법이 불확실하면 → `document-specialist` (레포 문서 우선, 가능하면 Context Hub / `chub`, 없으면 웹으로 우아하게 폴백).
</delegation_rules>

<model_routing>
`haiku` (빠른 조회), `sonnet` (표준), `opus` (아키텍처, 심층 분석).
직접 쓰기 허용 경로: `~/.claude/**`, `.omc/**`, `.claude/**`, `CLAUDE.md`, `AGENTS.md`.
</model_routing>

<verification>
완료를 주장하기 전에 검증할 것. 크기에 맞게: small→haiku, standard→sonnet, large/security→opus.
검증이 실패하면 반복할 것.
</verification>

<codex_support>
Codex 를 사용할 수 있으며, OpenAI GPT 모델에게 자문을 구하는 것을 지원한다.
"codex 써" 또는 "GPT 에게 물어봐"는 `codex_agent` / `codex_send` MCP 도구를 뜻한다.
</codex_support>

<execution_protocols>
광범위한 요청: 먼저 탐색 후 계획. 독립적인 작업 2개 이상은 병렬로. 빌드·테스트는 `run_in_background`.
작성과 리뷰는 별도의 패스로 유지: writer 패스가 내용 생성·수정, reviewer/verifier 패스가 이후 별도 레인에서 평가.
같은 활성 컨텍스트에서 자체 승인 금지. 승인 패스에는 `code-reviewer` 또는 `verifier` 사용.
종료 전: 대기 작업 0, 테스트 통과, verifier 증거 수집 완료.
</execution_protocols>

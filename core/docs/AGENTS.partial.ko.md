<!-- frame plugin 의 AGENTS.partial.md (한국어 워킹 카피) -->
<!-- 마스터 skeleton 의 13개 태그 중 frame 이 컨텐츠를 채우는 태그만 둔다. -->
<!-- 비채움 태그 (operating_principles, team_pipeline, commit_protocol, hooks_and_context, cancellation, worktree_paths) 는 여기에 두지 않는다. -->

<delegation_rules>
다음 작업은 에이전트로 위임한다: 다중 파일 변경, 리팩터링, 디버깅, 리뷰, 계획 수립, 조사, 검증.
직접 처리: 자명한 단일 명령, 짧은 해명, 1줄 수정.
코드 작성은 `executor` (복잡한 작업은 `model=opus`).
SDK 사용이 불확실하면 `document-specialist`.
</delegation_rules>

<model_routing>
- `haiku` — 빠른 조회
- `sonnet` — 표준 구현·리뷰·디버깅 (executor, verifier, test-engineer 등)
- `opus` — 깊은 분석, 아키텍처, 비판적 리뷰 (analyst, planner, architect, critic, code-reviewer, security-reviewer, code-simplifier)
</model_routing>

<agent_catalog>
계획·분석 (opus): analyst, planner, architect, critic
구현 (sonnet): executor (복잡 시 opus 권장)
리뷰 (opus): code-reviewer, security-reviewer, code-simplifier
테스트 (sonnet): test-engineer, verifier
탐색·조사: document-specialist (sonnet)
특수 (sonnet): git-master
</agent_catalog>

<tools>
core 가 제공하는 MCP 툴:
- LSP — `lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_diagnostics`, `lsp_workspace_symbols`, `lsp_document_symbols`, `lsp_rename`, `lsp_code_actions` 등
- AST — `ast_grep_search`, `ast_grep_replace`
사용 전 `/core-setup` 으로 `@ast-grep/napi` 전역 설치 필요.
</tools>

<verification>
완료 선언 전 검증한다. 비자명한 변경에는 `verifier` 에이전트 사용.
같은 컨텍스트에서 자기 결과를 자기가 승인하지 않는다 — 작성과 검토는 별도 패스로 분리.
</verification>

<execution_protocols>
독립 작업이 2개 이상이면 에이전트를 병렬 호출한다.
빌드·테스트는 `run_in_background` 로 띄운다.
범위가 넓은 요청은 먼저 탐색하고 계획한 뒤 실행한다.
</execution_protocols>

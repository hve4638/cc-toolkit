<!-- frame plugin's AGENTS.partial.md -->
<!-- Contains only the master skeleton tags that frame contributes content to. -->
<!-- Tags frame does not contribute (operating_principles, team_pipeline, commit_protocol, hooks_and_context, cancellation, worktree_paths) are omitted here. -->

<delegation_rules>
Delegate to agents for: multi-file changes, refactors, debugging, reviews, planning, research, verification.
Work directly on: trivial single commands, short clarifications, one-line edits.
Route code work to `executor` (use `model=opus` for complex work).
For uncertain SDK usage, route to `document-specialist`.
</delegation_rules>

<model_routing>
- `haiku` — quick lookups
- `sonnet` — standard implementation, review, debugging (executor, verifier, test-engineer, etc.)
- `opus` — deep analysis, architecture, critical review (analyst, planner, architect, critic, code-reviewer, security-reviewer, code-simplifier)
</model_routing>

<agent_catalog>
Planning/analysis (opus): analyst, planner, architect, critic
Implementation (sonnet): executor (opus recommended for complex work)
Review (opus): code-reviewer, security-reviewer, code-simplifier
Testing (sonnet): test-engineer, verifier
Search/research: document-specialist (sonnet)
Specialized (sonnet): git-master
</agent_catalog>

<tools>
MCP tools provided by core:
- LSP — `lsp_hover`, `lsp_goto_definition`, `lsp_find_references`, `lsp_diagnostics`, `lsp_workspace_symbols`, `lsp_document_symbols`, `lsp_rename`, `lsp_code_actions`, etc.
- AST — `ast_grep_search`, `ast_grep_replace`
Run `/core-setup` once to install the `@ast-grep/napi` global dependency before using AST tools.
</tools>

<verification>
Verify before claiming completion. Use the `verifier` agent for non-trivial changes.
Never self-approve in the same context — keep authoring and review as separate passes.
</verification>

<execution_protocols>
When 2+ independent tasks exist, dispatch agents in parallel.
Run builds and tests with `run_in_background`.
For broad requests, explore first and plan before executing.
</execution_protocols>

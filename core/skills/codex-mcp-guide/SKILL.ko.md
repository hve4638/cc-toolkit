---
name: codex-mcp-guide
description: "`mcp__codex__codex` MCP 도구를 호출하기 전에 반드시 이 스킬을 확인한다."
---

## Rule

`mcp__codex__codex` 를 호출할 때는 항상 다음 두 파라미터를 함께 넣는다:

- `sandbox: "danger-full-access"`
- `approval-policy: "never"`

## 읽기 범위는 프롬프트로 지정

의도가 *읽기만* 이라면 prompt 에 명시적으로 박는다:

- "파일 수정 금지, 읽기와 보고만"
- "shell 부수효과 없이 분석만"
---
name: gpt
description: "[quick] 이번 요청을 codex MCP로 GPT에게 위임해 처리"
disable-model-invocation: true
---

<gpt>
아래 Task를 `codex` MCP(`codex_agent`)로 GPT에게 전달하고, 응답을 사용자에게 전달합니다.

지침:
- `codex` mcp를 사용하세요. 임의로 codex 실행방법을 찾지 마세요.
- 대화 이름을 지어 시작하고, 이후 같은 대화의 후속 요청은 `codex_send`로 이어갑니다.
- `model` 은 사용자가 명시한 경우에만 넘깁니다.
</gpt>

Task: $ARGUMENTS

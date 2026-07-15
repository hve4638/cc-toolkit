---
name: cross-review
description: "Have codex and a subagent review the same target, then cross-verify each other's reviews. Use when cross-verification of a review is needed."
disable-model-invocation: true
---

<cross-review>
subagent와 codex에게 리뷰를 요청하고, 다시 서로에게 교차검증을 요청합니다.

필요시 subagent-codex 수는 1-1개. 관심사 분할 필요시 나누어 n-n개를 실행시키세요. 명시적 요청이 있지 않는 한 1-1 이 적절합니다.

지침:
- `codex` mcp를 사용하세요. 임의로 codex 실행방법을 찾지 마세요.
- codex와 subagent의 수는 동일합니다. subagent와 codex에게 각자 다른 일을 시키지 마세요.
  - 옳은 방법: task1(codex), task2(codex), task1(subagent), task2(subagent)
  - 잘못된 방법: task1(codex), task2(subagent)
- 교차검증 시 호출되는 subagent-codex 는 1-1로 대부분 충분합니다.
</cross-review>

Task: $ARGUMENTS